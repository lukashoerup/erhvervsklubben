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
    expect(screen.queryByRole('button', { name: 'Registrér møde' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Rediger' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Slet' })).not.toBeInTheDocument()
  })

  it('gives the admin the three controls, on every meeting', async () => {
    renderPage('admin')
    await screen.findByText('Esben')
    expect(screen.getByRole('button', { name: 'Registrér møde' })).toBeInTheDocument()
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
    await user.click(await screen.findByRole('button', { name: 'Registrér møde' }))

    await user.type(screen.getByLabelText(/Lead/), 'Oskar')
    await user.type(screen.getByLabelText(/^Sted/), 'Marv og Ben')
    fireEvent.change(screen.getByLabelText(/Dato/), { target: { value: '2026-08-13' } })
    await user.click(screen.getByRole('button', { name: 'Gem' }))

    await waitFor(() => expect(writes).toHaveLength(2))
    expect(writes[0]).toMatchObject({
      table: 'attendance_records',
      verb: 'insert',
      values: { meeting_number: 29, lead: 'Oskar', main_location: 'Marv og Ben', meeting_date: '2026-08-13' },
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
    await user.click(await screen.findByRole('button', { name: 'Registrér møde' }))

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
    await user.click(await screen.findByRole('button', { name: 'Registrér møde' }))
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
    await user.click(await screen.findByRole('button', { name: 'Registrér møde' }))

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
    await user.click(await screen.findByRole('button', { name: 'Registrér møde' }))

    // `lead` and `main_location` are `not null`; the number is prefilled.
    expect(screen.getByRole('button', { name: 'Gem' })).toBeDisabled()
    await user.type(screen.getByLabelText(/Lead/), 'Oskar')
    expect(screen.getByRole('button', { name: 'Gem' })).toBeDisabled()
    await user.type(screen.getByLabelText(/^Sted/), 'Marv og Ben')
    expect(screen.getByRole('button', { name: 'Gem' })).toBeEnabled()
  })

  it('can record someone the club has never written down before', async () => {
    // The roster is every name already in `attendances` — there is no members
    // table — so without this an eleventh member could never be ticked, and
    // the club would be back to typing rows into the database by hand.
    const user = userEvent.setup()
    renderPage('admin')
    await user.click(await screen.findByRole('button', { name: 'Registrér møde' }))

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
    await user.click(await screen.findByRole('button', { name: 'Registrér møde' }))
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
