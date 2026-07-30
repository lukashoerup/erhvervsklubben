import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { AuthContext, type AuthState } from '../auth/AuthContext'
import { withQuery } from '../test/harness'
import { client, reset, writes } from '../test/writes'

/**
 * The meetings the attendance history has no evening for, on /anciennitet.
 *
 * Two properties are load-bearing and the first is why this component was rewritten
 * on 2026-07-30. Lukas, looking at the merge: *"alle møder ligger flere gange …
 * denne funktionalitet med at have møder separat fra kortene på anciennitetssiden
 * giver ikke så meget mening. Det er jo alt sammen møder."* Ten of the club's twelve
 * `events` rows are the same evenings as the attendance cards below them, and both
 * were being drawn.
 *
 * So: **a row the history covers is not drawn at all**, and **a row it does not is**
 * — because a meeting whose year was mistyped lands in the past, and this is the
 * only screen it is reachable on. Filtering on "is it in the future" alone would
 * lose it; filtering on nothing prints the club's history twice.
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
  { id: 'e2', title: 'Erhvervsklub #30', date: day(70), time: '18.30', location: '', description: '' },
  { id: 'e1', title: 'Erhvervsklub #29', date: day(14), time: '18.30', location: 'Propaganda', description: 'Oskar lægger op.' },
  // Behind, and the history *has* this evening — a duplicate of a card below.
  { id: 'dup', title: 'Erhvervsklub #28 JUBILÆUM', date: day(-46), time: '18.30', location: 'Tivolihallen', description: '' },
  // Behind, and the history has nothing on this date: the club's own #20 case,
  // and the shape a mistyped year takes.
  { id: 'orphan', title: 'Generalforsamling 2026', date: day(-120), time: '17.00', location: 'Marv og Ben', description: '' },
]

/** What the attendance records cover. `dup` is on this list; `orphan` is not. */
const HELD = new Set([day(-46), day(-3)])

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
        <Moedekalender heldDates={HELD} />
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
    // the serif slot and the venue in the heading, so no element holds the title.
    expect(await screen.findByText('Propaganda')).toBeInTheDocument()
    expect(screen.getByText('Sted endnu ikke sat')).toBeInTheDocument()
    expect(screen.getByText('Planlagte møder')).toBeInTheDocument()
  })

  it('draws no card for an evening the history already has', async () => {
    renderPage('user')
    await screen.findByText('Propaganda')
    // The defect Lukas found. This row shares its date with an attendance record,
    // so the card below is the meeting and this would be a second copy of it.
    expect(screen.queryByText('JUBILÆUM')).not.toBeInTheDocument()
  })

  it('keeps a past row the history has no evening for', async () => {
    renderPage('user')
    // Two real cases at once: the club's `Erhvervsklub #20`, whose record never
    // got a date, and any meeting whose year was mistyped. Drop this and a wrong
    // date becomes a meeting nobody can reach.
    expect(await screen.findByText('Generalforsamling 2026')).toBeInTheDocument()
    expect(screen.getByText('Kun i kalenderen')).toBeInTheDocument()
  })

  it('offers a member nothing that writes, and nobody a second new-meeting button', async () => {
    renderPage('user')
    await screen.findByText('Propaganda')
    expect(screen.queryByRole('button', { name: 'Rediger' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Slet' })).not.toBeInTheDocument()

    renderPage('admin')
    // "der ligger jo to knapper der laver møder" — creating a meeting is
    // /anciennitet's one button now, and this component has none.
    expect(screen.queryByRole('button', { name: /nyt møde/i })).not.toBeInTheDocument()
  })

  it('renders nothing at all when every row is a duplicate', async () => {
    reset({ events: [EVENTS[2]] })
    const { container } = renderPage('user')
    await waitFor(() => expect(container.textContent).toBe(''))
  })
})

describe('what an admin can correct', () => {
  it('gives Rediger and Slet on a meeting ahead', async () => {
    renderPage('admin')
    await screen.findByText('Propaganda')
    const card = within(cardFor('Propaganda'))
    expect(card.getByRole('button', { name: 'Rediger' })).toBeInTheDocument()
    expect(card.getByRole('button', { name: 'Slet' })).toBeInTheDocument()
  })

  it('gives them on the past row too, which is where a mistyped date lands', async () => {
    renderPage('admin')
    await screen.findByText('Generalforsamling 2026')
    expect(
      within(cardFor('Generalforsamling 2026')).getByRole('button', { name: 'Rediger' }),
    ).toBeInTheDocument()
  })

  it('corrects the date against the meeting’s own id', async () => {
    const user = userEvent.setup()
    renderPage('admin')
    await screen.findByText('Propaganda')
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
    await screen.findByText('Propaganda')
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
  const ev = (title: string, location = '', date = '2026-08-08') => ({
    id: 'x',
    title,
    date,
    time: '18.30',
    location,
    description: '',
  })

  it('lifts the club’s own number out, and lets the venue take the heading', () => {
    expect(calendarHead(ev('Erhvervsklub #29', 'Frk. Barners'))).toEqual({
      figure: '29',
      heading: 'Frk. Barners',
    })
    // "Møde #30" too: the club writes both, and neither word is a heading.
    expect(calendarHead(ev('Møde #30', 'Lukas'))).toEqual({ figure: '30', heading: 'Lukas' })
  })

  it('keeps anything the title says beyond naming and numbering', () => {
    // The assertion that matters most. Strip one word too many and the club's
    // 25th meeting stops saying it was its jubilee.
    expect(calendarHead(ev('Erhvervsklub #25 JUBILÆUM', 'Marv & Ben'))).toEqual({
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

  it('says the venue is unset rather than heading a card with nothing', () => {
    expect(calendarHead(ev('Erhvervsklub #31'))).toEqual({
      figure: '31',
      heading: 'Sted endnu ikke sat',
    })
  })
})
