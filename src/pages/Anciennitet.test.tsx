import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { AuthContext, type AuthState } from '../auth/AuthContext'
import { minTapHeightPx, withQuery } from '../test/harness'
import { client, reset, state, writes } from '../test/writes'

/**
 * The club's meeting history, and the screen it is finally written on.
 *
 * Attendance was typed into the database by hand until now. Two properties of
 * that history are the reason this suite is shaped the way it is: every meeting
 * in production is undated, and the meeting numbers repeat — so nothing here
 * may assume a date exists or that a number identifies a meeting.
 */
vi.mock('../lib/supabase', () => ({ READONLY: false, supabase: () => client }))

const { default: Anciennitet } = await import('./Anciennitet')

/**
 * One button for both kinds of meeting since 2026-07-30. It was "Registrér møde"
 * beside the calendar's "Nyt møde i kalenderen", and Lukas: *"der ligger jo to
 * knapper der laver møder … Det er jo alt sammen møder."* The form routes on the
 * date it is given, so the label no longer says which table it will write.
 */
const NEW_MEETING = 'Nyt møde'

/** A date behind today, so a save records a held meeting rather than planning one. */
const HELD_DATE = '2026-06-26'

/**
 * Two meetings, four members, and one member with no row at all.
 *
 * Kasper never appears on meeting 28. That is a real third state — not absent —
 * and it is what `buildRoster` counts `total` from, so it decides the
 * denominator under every member's anciennitet.
 */
const RECORDS = [
  {
    id: 1,
    meeting_number: 28,
    lead: 'Esben',
    pre_location: null,
    main_location: 'Propaganda',
    post_location: 'Tryk Bar',
    meeting_date: null,
  },
  {
    id: 2,
    meeting_number: 27,
    lead: 'Saaby',
    pre_location: 'Mojos',
    main_location: 'Le Petit Rouge',
    post_location: null,
    meeting_date: '2026-04-09',
  },
]

const ATTENDANCES = [
  { record_id: 1, member_name: 'Anders', attended: true },
  { record_id: 1, member_name: 'Mads', attended: true },
  { record_id: 1, member_name: 'Saaby', attended: false },
  { record_id: 2, member_name: 'Anders', attended: true },
  { record_id: 2, member_name: 'Mads', attended: false },
  { record_id: 2, member_name: 'Saaby', attended: true },
  { record_id: 2, member_name: 'Kasper', attended: false },
]

function renderPage(role: AuthState['role']) {
  const value: AuthState = {
    userId: 'u1',
    role,
    loading: false,
    signIn: async () => ({ error: null }),
    signOut: async () => {},
  }
  return render(
    withQuery(
      <AuthContext.Provider value={value}>
        <Anciennitet />
      </AuthContext.Provider>,
    ),
  )
}

/** The card is keyed by its lead — the number repeats, in this club's real data. */
const cardFor = (lead: string) => screen.getByText(lead).closest('article')!

/** The open form, which is not an article. */
const form = () => document.querySelector('form')!

const tick = (name: string) => within(form()).getByRole('button', { name: new RegExp(`^${name}`) })

async function openEditor(user: ReturnType<typeof userEvent.setup>, lead: string) {
  await screen.findByText(lead)
  await user.click(within(cardFor(lead)).getByRole('button', { name: 'Rediger' }))
}

beforeEach(() => reset({ attendance_records: RECORDS, attendances: ATTENDANCES }))

describe('who may write the club’s history', () => {
  it('offers a member nothing that writes', async () => {
    renderPage('user')
    expect(await screen.findByText('Esben')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: NEW_MEETING })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Rediger' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Slet' })).not.toBeInTheDocument()
  })

  it('gives the admin the three controls, on every meeting', async () => {
    renderPage('admin')
    await screen.findByText('Esben')
    expect(screen.getByRole('button', { name: NEW_MEETING })).toBeInTheDocument()
    expect(screen.getAllByRole('button', { name: 'Rediger' })).toHaveLength(2)
    expect(screen.getAllByRole('button', { name: 'Slet' })).toHaveLength(2)
  })

  it('leaves the history itself unchanged for both', async () => {
    renderPage('admin')
    // The page's own job still comes first: the card, the pips and the bars.
    expect(await screen.findByText('uden dato')).toBeInTheDocument()
    expect(screen.getByText('9. apr. 2026')).toBeInTheDocument()
    expect(writes).toHaveLength(0)
  })
})

describe('recording a meeting', () => {
  it('writes the meeting first, then hangs the attendance on the id it got back', async () => {
    // Not cosmetic ordering: the serial id is chosen by the database, so the
    // attendance rows have nothing to point at until the record exists.
    const user = userEvent.setup()
    state.insertedId = 42
    renderPage('admin')
    await user.click(await screen.findByRole('button', { name: NEW_MEETING }))

    await user.type(screen.getByLabelText(/Lead/), 'Oskar')
    await user.type(screen.getByLabelText(/^Sted/), 'Marv og Ben')
    // Behind today, so this records a held meeting. A date ahead of it goes in the
    // calendar instead — see 'a meeting still ahead' below.
    fireEvent.change(screen.getByLabelText(/Dato/), { target: { value: HELD_DATE } })
    await user.click(screen.getByRole('button', { name: 'Gem' }))

    await waitFor(() => expect(writes).toHaveLength(2))
    expect(writes[0]).toMatchObject({
      table: 'attendance_records',
      verb: 'insert',
      values: { meeting_number: 29, lead: 'Oskar', main_location: 'Marv og Ben', meeting_date: HELD_DATE },
    })
    expect(writes[1]).toMatchObject({ table: 'attendances', verb: 'insert' })
    for (const row of writes[1].values as { record_id: number }[]) {
      expect(row.record_id).toBe(42)
    }
  })

  it('starts everyone present, so the absentees are what gets tapped', async () => {
    // Eight or nine of ten turn up. Ticking the two who did not is two taps;
    // ticking the eight who did is eight, on a phone, the morning after.
    const user = userEvent.setup()
    renderPage('admin')
    await user.click(await screen.findByRole('button', { name: NEW_MEETING }))

    expect(within(form()).getByText(/Til stede/)).toHaveTextContent('4 af 4')
    await user.click(tick('Mads'))
    expect(within(form()).getByText(/Til stede/)).toHaveTextContent('3 af 4')

    await user.type(screen.getByLabelText(/Lead/), 'Oskar')
    await user.type(screen.getByLabelText(/^Sted/), 'Marv og Ben')
    await user.click(screen.getByRole('button', { name: 'Gem' }))

    await waitFor(() => expect(writes).toHaveLength(2))
    expect(writes[1].values).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ member_name: 'Mads', attended: false }),
        expect.objectContaining({ member_name: 'Anders', attended: true }),
        expect.objectContaining({ member_name: 'Saaby', attended: true }),
        expect.objectContaining({ member_name: 'Kasper', attended: true }),
      ]),
    )
  })

  it('leaves an empty date and empty venues as null, not as an empty string', async () => {
    // A `date` column refuses ''. The venue columns hold null across the whole
    // history, and a mix of '' and null is two spellings of "nothing" for
    // derive.ts to filter twice.
    const user = userEvent.setup()
    renderPage('admin')
    await user.click(await screen.findByRole('button', { name: NEW_MEETING }))
    await user.type(screen.getByLabelText(/Lead/), 'Oskar')
    await user.type(screen.getByLabelText(/^Sted/), 'Marv og Ben')
    await user.click(screen.getByRole('button', { name: 'Gem' }))

    await waitFor(() => expect(writes).toHaveLength(2))
    expect(writes[0].values).toMatchObject({
      meeting_date: null,
      pre_location: null,
      post_location: null,
    })
  })

  it('keeps what was typed when the keyboard is dismissed', async () => {
    // The fines bug, in the shape it takes in a form: on a phone, tapping away
    // is how the keyboard is put down, so leaving a field by anything other
    // than Enter must not throw it away. It cost the club real money once.
    const user = userEvent.setup()
    renderPage('admin')
    await user.click(await screen.findByRole('button', { name: NEW_MEETING }))

    await user.type(screen.getByLabelText(/Lead/), 'Oskar')
    await user.tab()
    await user.type(screen.getByLabelText(/^Sted/), 'Marv og Ben')
    // Straight to Gem from inside the last field — no blur of its own first.
    await user.click(screen.getByRole('button', { name: 'Gem' }))

    await waitFor(() => expect(writes).toHaveLength(2))
    expect(writes[0].values).toMatchObject({ lead: 'Oskar', main_location: 'Marv og Ben' })
  })

  it('refuses to save without the three columns the database requires', async () => {
    const user = userEvent.setup()
    renderPage('admin')
    await user.click(await screen.findByRole('button', { name: NEW_MEETING }))

    // `lead` and `main_location` are `not null`; the number is prefilled.
    expect(screen.getByRole('button', { name: 'Gem' })).toBeDisabled()
    await user.type(screen.getByLabelText(/Lead/), 'Oskar')
    expect(screen.getByRole('button', { name: 'Gem' })).toBeDisabled()
    await user.type(screen.getByLabelText(/^Sted/), 'Marv og Ben')
    expect(screen.getByRole('button', { name: 'Gem' })).toBeEnabled()
  })

  it('can record someone the club has never written down before', async () => {
    // The roster is the members table plus every name in `attendances`, and
    // this fixture holds no members — so without this field a guest, or anyone
    // admitted between meetings, could never be ticked off on the night, and
    // the club would be back to typing rows into the database by hand.
    const user = userEvent.setup()
    renderPage('admin')
    await user.click(await screen.findByRole('button', { name: NEW_MEETING }))

    await user.type(screen.getByLabelText('Nyt medlem'), 'Have')
    await user.click(screen.getByRole('button', { name: 'Tilføj' }))
    expect(tick('Have')).toHaveAttribute('aria-pressed', 'true')

    await user.type(screen.getByLabelText(/Lead/), 'Oskar')
    await user.type(screen.getByLabelText(/^Sted/), 'Marv og Ben')
    await user.click(screen.getByRole('button', { name: 'Gem' }))

    await waitFor(() => expect(writes).toHaveLength(2))
    expect(writes[1].values).toEqual(
      expect.arrayContaining([expect.objectContaining({ member_name: 'Have', attended: true })]),
    )
  })

  it('saves behind a button that can be hit, and read', async () => {
    const user = userEvent.setup()
    renderPage('admin')
    await user.click(await screen.findByRole('button', { name: NEW_MEETING }))
    const save = screen.getByRole('button', { name: 'Gem' })
    expect(minTapHeightPx(save)).toBeGreaterThanOrEqual(48)
    // White on --color-accent measures 3.2:1 on the dark ground and fails AA.
    expect(save.className).toContain('bg-brand')
    // Ten of these get tapped in a row, on a phone, one-handed.
    expect(minTapHeightPx(tick('Anders'))).toBeGreaterThanOrEqual(48)
  })
})

describe('correcting a meeting already recorded', () => {
  it('writes only the tick that changed', async () => {
    const user = userEvent.setup()
    renderPage('admin')
    await openEditor(user, 'Esben')

    expect(tick('Anders')).toHaveAttribute('aria-pressed', 'true')
    expect(tick('Saaby')).toHaveAttribute('aria-pressed', 'false')
    await user.click(tick('Mads'))
    await user.click(screen.getByRole('button', { name: 'Gem' }))

    await waitFor(() => expect(writes).toHaveLength(2))
    expect(writes[0]).toMatchObject({ table: 'attendance_records', verb: 'update', id: '1' })
    // Addressed by meeting *and* member: there is no unique index on the pair,
    // so this is a filter rather than an upsert, and an id would not exist for
    // a member who has no row yet anyway.
    expect(writes[1]).toMatchObject({
      table: 'attendances',
      verb: 'update',
      values: { attended: false },
      match: { record_id: '1', member_name: 'Mads' },
    })
  })

  it('leaves a member who has no row without one', async () => {
    // Kasper has no row on meeting 28. The form has to show him as absent —
    // a toggle has two positions — but saving must not create the row: `total`
    // is counted from the rows that exist, so materialising them would grow
    // the denominator under "X deltagelser af Y" for every member, across 29
    // meetings, as a side effect of opening a form and pressing Gem.
    const user = userEvent.setup()
    renderPage('admin')
    await openEditor(user, 'Esben')

    expect(tick('Kasper')).toHaveAttribute('aria-pressed', 'false')
    await user.click(screen.getByRole('button', { name: 'Gem' }))

    await waitFor(() => expect(writes).toHaveLength(1))
    expect(writes[0].table).toBe('attendance_records')
  })

  it('does create the row when he is ticked as present', async () => {
    const user = userEvent.setup()
    renderPage('admin')
    await openEditor(user, 'Esben')

    await user.click(tick('Kasper'))
    await user.click(screen.getByRole('button', { name: 'Gem' }))

    await waitFor(() => expect(writes).toHaveLength(2))
    expect(writes[1]).toMatchObject({ table: 'attendances', verb: 'insert' })
    expect(writes[1].values).toEqual([
      { record_id: 1, member_name: 'Kasper', attended: true },
    ])
  })

  it('puts each venue back in the column it came out of', async () => {
    // The regression this exists for: the card reads the route with the empty
    // steps dropped, so meeting 27 — Mojos, then Le Petit Rouge, no after-party
    // — is two strings, exactly like a meeting with no pre-drinks. Rebuilt from
    // that list the venues shift one column left and get saved there.
    const user = userEvent.setup()
    renderPage('admin')
    await openEditor(user, 'Saaby')

    expect(screen.getByLabelText(/Før/)).toHaveValue('Mojos')
    expect(screen.getByLabelText(/^Sted/)).toHaveValue('Le Petit Rouge')
    expect(screen.getByLabelText(/Efter/)).toHaveValue('')

    await user.click(screen.getByRole('button', { name: 'Gem' }))
    await waitFor(() => expect(writes).toHaveLength(1))
    expect(writes[0].values).toMatchObject({
      pre_location: 'Mojos',
      main_location: 'Le Petit Rouge',
      post_location: null,
    })
  })

  it('fills in a date the history never had', async () => {
    // All 29 meetings in production are undated. This is the one screen that
    // changes that, and Økonomi counts what is left.
    const user = userEvent.setup()
    renderPage('admin')
    await openEditor(user, 'Esben')

    fireEvent.change(screen.getByLabelText(/Dato/), { target: { value: '2026-06-04' } })
    await user.click(screen.getByRole('button', { name: 'Gem' }))

    await waitFor(() => expect(writes).toHaveLength(1))
    expect(writes[0]).toMatchObject({ id: '1', values: { meeting_date: '2026-06-04' } })
  })

  it('says so when the save fails, and keeps the form open', async () => {
    const user = userEvent.setup()
    renderPage('admin')
    await openEditor(user, 'Esben')
    state.failWrites = true

    await user.click(screen.getByRole('button', { name: 'Gem' }))
    expect(await screen.findByText('Kunne ikke gemme. Prøv igen.')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Gem' })).toBeInTheDocument()
  })
})

describe('deleting a meeting', () => {
  it('asks first, and counts what goes with it', async () => {
    const user = userEvent.setup()
    renderPage('admin')
    await screen.findByText('Saaby')
    await user.click(within(cardFor('Saaby')).getByRole('button', { name: 'Slet' }))

    const asked = screen.getByRole('alert')
    // The number repeats in this club's data, so the lead and the date are
    // what say which evening.
    expect(asked).toHaveTextContent('Møde 27 · Saaby · 9. april 2026')
    // ~10 rows and any fines go too — both foreign keys cascade — and "Slet"
    // reads like one row.
    expect(asked).toHaveTextContent('4 deltagelser og mødets bøder slettes med.')
    expect(asked).toHaveTextContent('Det kan ikke fortrydes.')
    expect(writes).toHaveLength(0)
  })

  it('names an undated meeting as undated rather than leaving a gap', async () => {
    const user = userEvent.setup()
    renderPage('admin')
    await screen.findByText('Esben')
    await user.click(within(cardFor('Esben')).getByRole('button', { name: 'Slet' }))
    expect(screen.getByRole('alert')).toHaveTextContent('Møde 28 · Esben · uden dato')
  })

  it('deletes the meeting it asked about', async () => {
    const user = userEvent.setup()
    renderPage('admin')
    await screen.findByText('Esben')
    await user.click(within(cardFor('Esben')).getByRole('button', { name: 'Slet' }))
    await user.click(screen.getByRole('button', { name: 'Slet endeligt' }))

    await waitFor(() => expect(writes).toHaveLength(1))
    expect(writes[0]).toMatchObject({ table: 'attendance_records', verb: 'delete', id: '1' })
  })
})

/**
 * The page with none of its motion running — which is where every iPhone in
 * this club stood until T067, and where jsdom stands permanently.
 *
 * T064 got that from a CSS feature check, and the price was that the screens
 * did not move on the phones the club actually uses. It now comes from
 * lib/reveal.ts hiding nothing it is not already watching, and that is a
 * behaviour rather than a stylesheet — so this page can be asked directly
 * whether its records are readable with no observer in the room.
 */
describe('the club’s history with no observer at all', () => {
  it('renders the whole page, with nothing left in a start state', async () => {
    // jsdom has no IntersectionObserver, so this is the fallback path by
    // default rather than by arrangement.
    expect('IntersectionObserver' in window).toBe(false)
    renderPage('user')

    // The card, the route, the counts and the strip — the four things the page
    // is for, all of them present and none of them waiting on a script.
    expect(await screen.findByText('Esben')).toBeInTheDocument()
    expect(screen.getByText('Le Petit Rouge')).toBeInTheDocument()
    expect(screen.getByText('9. apr. 2026')).toBeInTheDocument()
    expect(screen.getAllByTitle('Anders').length).toBeGreaterThan(0)

    // There are reveals and bars on this page to speak of at all.
    expect(document.querySelectorAll('[data-reveal], [data-bar]').length).toBeGreaterThan(3)
    // …and not one of them is in a state lib/reveal.ts set. `armed` is the only
    // thing in the app that puts content at opacity 0 and `in` is the only
    // thing that animates it; neither may happen with no observer in the room.
    expect(
      document.querySelectorAll(
        '[data-reveal="armed"], [data-reveal="in"], [data-bar="armed"], [data-bar="in"]',
      ),
    ).toHaveLength(0)
  })

  it('shows every anciennitet figure as its final number', async () => {
    renderPage('user')
    await screen.findByText('Esben')

    // The count-up is the home page's; this page prints its figures straight
    // from React. Asserting it here anyway is the point — the guarantee is
    // "no observer, no missing numbers", and it has to hold on the screen the
    // club actually reads, count-up or not. Anders is at two of two, and a
    // figure that had been animated from zero would still read 0 here.
    expect(screen.getAllByLabelText(/Anders: \d+ af \d+/).length).toBeGreaterThan(0)
    for (const el of screen.getAllByLabelText(/: \d+ af \d+$/)) {
      const [, shown, total] = el.getAttribute('aria-label')!.match(/: (\d+) af (\d+)$/)!
      expect(el.textContent).toContain(shown)
      expect(Number(shown)).toBeLessThanOrEqual(Number(total))
    }

    // And where the count-up *does* run, its elements rest on their target.
    for (const f of document.querySelectorAll<HTMLElement>('[data-count]')) {
      expect(f.textContent).toBe(f.dataset.count)
    }
  })
})

/**
 * The meetings page folded into this one on 2026-07-30. Lukas: *"Ancinitetssiden
 * er den rigtige. Den må der ikke ændres på"*, then *"Så skal mødesiden fjernes"*.
 *
 * So the assertions are of two kinds, and the second is the one that matters:
 * the calendar and the fines arrived, **and everything that was already here is
 * still here, in the order it was.** A merge that quietly reorders the club's
 * longest page has broken the instruction even with every feature present.
 */
describe('the calendar and the fines, now that /moeder is gone', () => {
  const PLANNED = [
    {
      id: 'e1',
      title: 'Erhvervsklub #29',
      // Far enough ahead that the suite cannot age into calling it held.
      date: '2099-08-08',
      time: '18.30',
      location: 'Frk. Barners',
      description: 'Kasper er Lead.',
    },
  ]
  const FINES = [
    { member_name: 'Mads', amount_kr: 95, record_id: 1, rule_id: 'for-sent', minutes: 9 },
    { member_name: 'Anders', amount_kr: 60, record_id: 1, rule_id: 'skaal', minutes: null },
  ]

  beforeEach(() =>
    reset({
      attendance_records: RECORDS,
      attendances: ATTENDANCES,
      events: PLANNED,
      fines: FINES,
      payments: [],
    }),
  )

  it('shows a member what is planned, on the page that survived', async () => {
    renderPage('user')
    // By its heading, which for a plain numbered title is the venue — the card
    // and the held meetings below now share one head (MeetingHead), at Lukas's
    // word: "planlagte møder skal fremgå som de tidligere. Blot uden anciennitet."
    expect(await screen.findByText('Frk. Barners')).toBeInTheDocument()
    expect(screen.getByText('29')).toBeInTheDocument()
    expect(screen.getByText('Planlagte møder')).toBeInTheDocument()
    // The calendar's own editing is the admin's, exactly as it was on /moeder.
    expect(
      screen.queryByRole('button', { name: 'Nyt møde i kalenderen' }),
    ).not.toBeInTheDocument()
  })

  it('offers one button for both kinds of meeting, not two', async () => {
    renderPage('admin')
    await screen.findByRole('button', { name: NEW_MEETING })
    // Lukas: "der ligger jo to knapper der laver møder … Det er jo alt sammen
    // møder." Exactly one control on this page creates a meeting; which table it
    // lands in is the date's business, not his.
    expect(screen.getAllByRole('button', { name: /nyt møde|registrér møde/i })).toHaveLength(1)
  })

  it('plans a meeting still ahead into the calendar, from that same button', async () => {
    const user = userEvent.setup()
    renderPage('admin')
    await user.click(await screen.findByRole('button', { name: NEW_MEETING }))

    fireEvent.change(screen.getByLabelText(/Dato/), { target: { value: '2099-08-08' } })
    await user.type(screen.getByLabelText(/^Sted/), 'Frk. Barners')
    // The ten attendance buttons are gone, because nobody attended a meeting that
    // has not happened — and the form says why rather than just dropping them.
    expect(screen.getByText(/lægges i kalenderen/i)).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /til stede/ })).not.toBeInTheDocument()
    await user.type(screen.getByLabelText(/Tidspunkt/), '18.30')
    await user.click(screen.getByRole('button', { name: 'Gem' }))

    await waitFor(() => expect(writes).toHaveLength(1))
    expect(writes[0]).toMatchObject({
      table: 'events',
      verb: 'insert',
      // The club's own title convention, so `calendarHead` reads the number back
      // out of it and a meeting planned here is indistinguishable from the twelve
      // the club typed itself.
      values: { title: 'Erhvervsklub #29', date: '2099-08-08', location: 'Frk. Barners' },
    })
  })

  it('does not move a held meeting into the calendar when its date is mistyped', async () => {
    const user = userEvent.setup()
    renderPage('admin')
    await screen.findByText('Esben')
    await user.click(within(cardFor('Esben')).getByRole('button', { name: 'Rediger' }))
    fireEvent.change(screen.getByLabelText(/Dato/), { target: { value: '2099-01-01' } })
    await user.click(screen.getByRole('button', { name: 'Gem' }))

    // A wrong year on an existing record is a typo, not a plan. Routing it to
    // `events` would strand ~10 attendance rows and the evening's fines on a
    // record nothing renders.
    await waitFor(() => expect(writes.length).toBeGreaterThan(0))
    expect(writes[0]).toMatchObject({ table: 'attendance_records', verb: 'update' })
  })

  it('puts each meeting’s fines on its own card, for a member', async () => {
    renderPage('user')
    await screen.findByText('Esben')
    // Meeting 1 (Esben) has both fines; meeting 2 (Saaby) has none, and gets no
    // fold at all — which is 20 of the club's 28 real meetings.
    const esben = cardFor('Esben')
    expect(within(esben).getByText('95 kr.')).toBeInTheDocument()
    expect(within(esben).getByText('60 kr.')).toBeInTheDocument()
    expect(within(esben).getByText(/155 kr\./)).toBeInTheDocument()
    expect(cardFor('Saaby').querySelector('details')).toBeNull()
  })

  it('leaves the history below the calendar, in the order it was', async () => {
    renderPage('user')
    await screen.findByText('Esben')
    const order = [...document.querySelectorAll('h2, article h3, [class*="ek-figure"]')]
      .map((el) => el.textContent?.trim())
      .filter(Boolean)
    // Planned meetings first, then the club's own history newest-first: 28
    // before 27. Anciennitet's own summary and cards keep their places.
    expect(order.indexOf('Planlagte møder')).toBeLessThan(order.indexOf('Esben'))
    expect(order.indexOf('Esben')).toBeLessThan(order.indexOf('Saaby'))
  })
})

/**
 * The order of the page, as one list rather than two.
 *
 * Lukas, on the screenshot: *"Er det ikke lidt spøjst med rækkefølgen?"* It was —
 * the planned meetings ran soonest-first and the history newest-first, so the page
 * read 29, 30, 28, 27: the number climbing and then dropping back. Two separate
 * sections could each run outward from today and be right; one continuous stream
 * cannot.
 *
 * Asserted as a property of the whole page rather than of either group, because that
 * is the only form of the assertion that would have caught it: both groups were
 * internally sorted correctly the whole time.
 */
describe('the order of the meetings', () => {
  const PLANNED_TWO = [
    { id: 'e29', title: 'Erhvervsklub #29', date: '2099-08-08', time: '18.30', location: 'Frk. Barners', description: '' },
    { id: 'e30', title: 'Erhvervsklub #30', date: '2099-09-11', time: '17.00', location: 'Lukas', description: '' },
  ]

  beforeEach(() =>
    reset({ attendance_records: RECORDS, attendances: ATTENDANCES, events: PLANNED_TWO }),
  )

  it('runs newest first the whole way down, planned and held alike', async () => {
    renderPage('user')
    // Both queries, not just the history: the events one settles second, and
    // waiting on the history alone samples the page before the planned cards exist.
    await screen.findByText('Esben')
    await screen.findByText('Frk. Barners')

    // Every card's serif figure, in the order they are on the page. RECORDS is
    // meetings 28 and 27; the planned ones are the club's 30 and 29.
    const figures = [...document.querySelectorAll('article .ek-figure')].map(
      (el) => el.textContent,
    )
    expect(figures).toEqual(['30', '29', '28', '27'])
  })

  it('still marks the *next* meeting, not the furthest one', async () => {
    renderPage('user')
    await screen.findByText('Frk. Barners')
    // The design system marks the live row by border weight. Newest-first puts the
    // next meeting last among the planned, so a position-based check would have
    // quietly moved the border to September.
    expect(cardFor('Frk. Barners').className).toContain('border-accent')
    expect(cardFor('Lukas').className).not.toContain('border-accent')
  })
})

/**
 * Turning tonight's plan into tonight's meeting.
 *
 * Lukas, on the day of one: *"Jeg kan i øvrigt ikke rette deltagere til dagens
 * møde på anciennitetssiden."* He could — "Nyt møde" with today's date routes to
 * `attendance_records` and offers the ten ticks — but nothing on the evening's own
 * card said so, and a capability nobody can find is not one.
 */
describe('recording the evening from its own card', () => {
  const TODAY = new Date().toISOString().slice(0, 10)
  const TONIGHT = [
    {
      id: 'e29',
      title: 'Erhvervsklub #29',
      date: TODAY,
      time: '11.00 – 18.00',
      location: 'Frk. Barners',
      description: 'Mads er Lead.',
    },
    {
      id: 'e30',
      title: 'Erhvervsklub #30',
      date: '2099-09-11',
      time: '17.00',
      location: 'Lukas',
      description: '',
    },
  ]

  beforeEach(() =>
    reset({ attendance_records: RECORDS, attendances: ATTENDANCES, events: TONIGHT }),
  )

  it('offers it on a meeting that has happened, and not on one weeks away', async () => {
    renderPage('admin')
    await screen.findByText('Frk. Barners')
    expect(
      within(cardFor('Frk. Barners')).getByRole('button', { name: 'Registrér deltagelse' }),
    ).toBeInTheDocument()
    // Nobody to tick off at an evening that has not happened.
    expect(
      within(cardFor('Lukas')).queryByRole('button', { name: 'Registrér deltagelse' }),
    ).not.toBeInTheDocument()
  })

  it('is the admin’s, like every other write on this page', async () => {
    renderPage('user')
    await screen.findByText('Frk. Barners')
    expect(screen.queryByRole('button', { name: 'Registrér deltagelse' })).not.toBeInTheDocument()
  })

  it('opens the form already carrying what the club announced', async () => {
    const user = userEvent.setup()
    renderPage('admin')
    await screen.findByText('Frk. Barners')
    await user.click(
      within(cardFor('Frk. Barners')).getByRole('button', { name: 'Registrér deltagelse' }),
    )

    // Date, venue and what the lead wrote, so the evening is recorded as it was
    // announced rather than retyped from memory the morning after.
    expect((screen.getByLabelText(/Dato/) as HTMLInputElement).value).toBe(TODAY)
    expect((screen.getByLabelText(/^Sted/) as HTMLInputElement).value).toBe('Frk. Barners')
    expect((screen.getByLabelText(/Beskrivelse/) as HTMLTextAreaElement).value).toBe('Mads er Lead.')
    // And the ten ticks, which is the whole point — today's date is not ahead, so
    // this is a held meeting rather than another calendar row.
    expect(screen.getByRole('button', { name: /^Anders/ })).toBeInTheDocument()
    expect(screen.queryByText(/lægges i kalenderen/i)).not.toBeInTheDocument()
  })
})
