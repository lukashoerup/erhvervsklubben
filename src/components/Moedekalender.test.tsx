import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { AuthContext, type AuthState } from '../auth/AuthContext'
import { withQuery } from '../test/harness'
import { client, reset, writes } from '../test/writes'

/**
 * The meetings still ahead, on /anciennitet.
 *
 * The one property that carries the whole component: **nothing in the past is
 * drawn.** Two decisions in a row put it there. First Lukas found the duplication —
 * *"alle møder ligger flere gange … Det er jo alt sammen møder"* — because ten of the
 * club's twelve `events` rows are the same evenings as the attendance cards below.
 * Then he asked for the two that were not duplicates to go as well: *"Fjern de to
 * kalender aftaler som kun er i kalenderen. De er gamle og vi laver formentligt ikke
 * sådan nogle igen."*
 *
 * So the filter is a date and not a set of dates, and `heldDates` is gone with the
 * rows it was there to hide. Nothing past is drawn, so nothing can be drawn twice.
 */
vi.mock('../lib/supabase', () => ({ READONLY: false, supabase: () => client }))

const { Moedekalender, calendarHead } = await import('./Moedekalender')

const day = (offset: number) => new Date(Date.now() + offset * 864e5).toISOString().slice(0, 10)

/**
 * Two ahead, two behind — and the query answers newest first, as the real one does.
 *
 * The titles are shaped like the club's own, because since 2026-07-30 the card
 * derives its figure and its heading from the title (`calendarHead`) and a fixture
 * with invented titles would not exercise that at all. Three of the four shapes
 * production actually holds are here: numbered, numbered-with-something-to-say, and
 * unnumbered.
 */
const EVENTS = [
  // Nothing decided but the date: no lead and no venue. The state §9 puts a meeting
  // in for most of the months before it, and since 2026-08-08 the state the card has
  // to name rather than head with an empty string.
  { id: 'e2', title: 'Erhvervsklub #30', date: day(70), time: '18.30', lead: '', location: '', description: '' },
  { id: 'e1', title: 'Erhvervsklub #29', date: day(14), time: '18.30', lead: 'Oskar', location: 'Propaganda', description: '' },
  // Behind, and a duplicate of a card in the history below.
  { id: 'dup', title: 'Erhvervsklub #28 JUBILÆUM', date: day(-46), time: '18.30', lead: 'Esben', location: 'Tivolihallen', description: '' },
  // Behind, and *not* a duplicate — the club's own `Erhvervsklub #20`, whose record
  // never got a date. Gone from the frontend too since 2026-07-30, at Lukas's word.
  { id: 'orphan', title: 'Generalforsamling 2026', date: day(-120), time: '17.00', lead: 'Saaby', location: 'Marv og Ben', description: '' },
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
        <Moedekalender />
      </AuthContext.Provider>,
    ),
  )
}

const cardFor = (heading: string) => screen.getByText(heading).closest('article')!

beforeEach(() => reset({ events: EVENTS }))

describe('what a member sees', () => {
  it('shows the meetings still ahead', async () => {
    renderPage('user')
    // By the heading each card shows: a plain numbered title puts the number in
    // the serif slot and the *lead* in the heading, so no element holds the title.
    expect(await screen.findByText('Oskar')).toBeInTheDocument()
    expect(screen.getByText('Lead ikke valgt endnu')).toBeInTheDocument()
    expect(screen.getByText('Planlagte møder')).toBeInTheDocument()
  })

  it('draws nothing at all for a date in the past', async () => {
    renderPage('user')
    await screen.findByText('Oskar')
    // Both past rows, and for two different reasons. The duplicate is the defect
    // Lukas found — its evening is already a card in the history below. The other
    // is not a duplicate and goes anyway, at his word: "De er gamle og vi laver
    // formentligt ikke sådan nogle igen."
    expect(screen.queryByText('JUBILÆUM')).not.toBeInTheDocument()
    expect(screen.queryByText('Generalforsamling 2026')).not.toBeInTheDocument()
    expect(screen.queryByText('Kun i kalenderen')).not.toBeInTheDocument()
  })

  it('offers a member nothing that writes, and nobody a second new-meeting button', async () => {
    renderPage('user')
    await screen.findByText('Oskar')
    expect(screen.queryByRole('button', { name: 'Rediger' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Slet' })).not.toBeInTheDocument()

    renderPage('admin')
    // "der ligger jo to knapper der laver møder" — creating a meeting is
    // /anciennitet's one button now, and this component has none.
    expect(screen.queryByRole('button', { name: /nyt møde/i })).not.toBeInTheDocument()
  })

  it('renders nothing at all when the club has planned nothing', async () => {
    // Not "ingen møder planlagt": §9 promises two ahead, and a bare heading over an
    // empty space would announce the promise broken on a page that is not the
    // club's compliance report. /hjem leads with the next meeting or its absence.
    reset({ events: EVENTS.filter((e) => e.date < day(0)) })
    const { container } = renderPage('user')
    await waitFor(() => expect(container.textContent).toBe(''))
  })
})

describe('what an admin can correct', () => {
  it('gives Rediger and Slet on a meeting ahead', async () => {
    renderPage('admin')
    await screen.findByText('Oskar')
    const card = within(cardFor('Propaganda'))
    expect(card.getByRole('button', { name: 'Rediger' })).toBeInTheDocument()
    expect(card.getByRole('button', { name: 'Slet' })).toBeInTheDocument()
  })

  it('warns before a date change makes the card leave the list', async () => {
    const user = userEvent.setup()
    renderPage('admin')
    await screen.findByText('Oskar')
    await user.click(within(cardFor('Propaganda')).getByRole('button', { name: 'Rediger' }))

    expect(screen.queryByText(/forsvinder fra listen/i)).not.toBeInTheDocument()
    fireEvent.change(screen.getByLabelText(/Dato/), { target: { value: day(-1) } })
    // A card that vanishes on Gem with no explanation reads as data lost. It is
    // not lost — it is a held meeting now, and those are recorded in the history.
    expect(screen.getByText(/forsvinder fra listen/i)).toBeInTheDocument()
  })

  it('corrects the date against the meeting’s own id', async () => {
    const user = userEvent.setup()
    renderPage('admin')
    await screen.findByText('Oskar')
    await user.click(within(cardFor('Propaganda')).getByRole('button', { name: 'Rediger' }))

    const date = screen.getByLabelText(/Dato/)
    fireEvent.change(date, { target: { value: '2026-09-10' } })
    await user.click(screen.getByRole('button', { name: 'Gem' }))

    await waitFor(() => expect(writes).toHaveLength(1))
    // By id, never by title: two meetings can share one, and the club's data has
    // duplicates of exactly that kind.
    expect(writes[0]).toMatchObject({ table: 'events', verb: 'update', id: 'e1' })
  })

  it('asks before deleting, and names the row it asked about', async () => {
    const user = userEvent.setup()
    renderPage('admin')
    await screen.findByText('Oskar')
    await user.click(within(cardFor('Propaganda')).getByRole('button', { name: 'Slet' }))

    // The *title*, not the card's derived heading: this asks about a row, and the
    // row is what the club typed. The date tells two same-titled rows apart.
    expect(screen.getByRole('alert')).toHaveTextContent('Erhvervsklub #29 ·')
    expect(writes).toHaveLength(0)

    await user.click(screen.getByRole('button', { name: 'Slet endeligt' }))
    await waitFor(() => expect(writes).toHaveLength(1))
    expect(writes[0]).toMatchObject({ table: 'events', verb: 'delete', id: 'e1' })
  })
})

/**
 * The rule that turns a calendar title into a figure and a heading, against the
 * four title shapes production actually holds.
 *
 * Worth its own tests because it is the one piece of derivation on this card, and
 * because the failure is silent: a rule that stripped too much would quietly drop
 * "JUBILÆUM" or "Generalforsamling" off a card that still looked perfectly fine.
 */
describe('reading a calendar title', () => {
  const ev = (title: string, location = '', date = '2026-08-08', lead = '') => ({
    id: 'x',
    title,
    date,
    time: '18.30',
    lead,
    location,
    description: '',
  })

  it('lifts the club’s own number out, and lets the lead take the heading', () => {
    // The lead, since 2026-08-08 — which is what a *held* meeting's card puts in
    // this slot, and the reason the two kinds of card now read the same.
    expect(calendarHead(ev('Erhvervsklub #29', 'Frk. Barners', '2026-08-08', 'Oskar'))).toEqual({
      figure: '29',
      heading: 'Oskar',
    })
    // "Møde #30" too: the club writes both, and neither word is a heading.
    expect(calendarHead(ev('Møde #30', '', '2026-08-08', 'Lukas'))).toEqual({
      figure: '30',
      heading: 'Lukas',
    })
  })

  it('falls back to the venue while nobody has been named', () => {
    // §9 has the lead calling the meeting two weeks ahead, so a booked venue with
    // no lead yet is an ordinary state and not a half-filled row.
    expect(calendarHead(ev('Erhvervsklub #29', 'Frk. Barners'))).toEqual({
      figure: '29',
      heading: 'Frk. Barners',
    })
  })

  it('keeps anything the title says beyond naming and numbering', () => {
    // The assertion that matters most. Strip one word too many and the club's
    // 25th meeting stops saying it was its jubilee.
    // Ahead of the lead, deliberately: the club only writes something into a title
    // when that something is the point of the evening.
    expect(calendarHead(ev('Erhvervsklub #25 JUBILÆUM', 'Marv & Ben', '2026-08-08', 'Saaby'))).toEqual({
      figure: '25',
      heading: 'JUBILÆUM',
    })
  })

  it('keeps the whole title where there is no number, and dates the figure', () => {
    expect(calendarHead(ev('Generalforsamling 2026', 'Marv og Ben', '2026-01-24'))).toEqual({
      figure: '24',
      heading: 'Generalforsamling 2026',
    })
    expect(
      calendarHead(ev('Udarbejdelse af vedtægtsudkast', 'Café Runddelen', '2025-04-20')),
    ).toEqual({ figure: '20', heading: 'Udarbejdelse af vedtægtsudkast' })
  })

  it('names what is missing rather than heading a card with nothing', () => {
    // Nothing decided but the date. It says the lead is missing rather than the
    // venue, because the lead is what the club decides first and what the rest of
    // the evening hangs off — §9 has him calling the meeting two weeks ahead.
    expect(calendarHead(ev('Erhvervsklub #31'))).toEqual({
      figure: '31',
      heading: 'Lead ikke valgt endnu',
    })
  })
})
