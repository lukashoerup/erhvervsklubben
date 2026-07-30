import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { AuthContext, type AuthState } from '../auth/AuthContext'
import { withQuery } from '../test/harness'
import { client, reset, writes } from '../test/writes'

/**
 * The club's calendar, and the screen an admin corrects it on.
 *
 * The page's reason for existing is in the second block below: a meeting whose
 * date was typed wrong is in the past, and every other view of `events` shows
 * only the future. If the held meetings ever drop off this page, a mistyped
 * year becomes a meeting the club cannot get back.
 */
vi.mock('../lib/supabase', () => ({ READONLY: false, supabase: () => client }))

const { Moedekalender } = await import('./Moedekalender')

const day = (offset: number) => new Date(Date.now() + offset * 864e5).toISOString().slice(0, 10)

/** Two ahead, two behind — and the query answers newest first, as the real one does. */
const EVENTS = [
  { id: 'e2', title: 'Møde #30', date: day(70), time: '18.30', location: '', description: '' },
  { id: 'e1', title: 'Møde #29', date: day(14), time: '18.30', location: 'Propaganda', description: 'Oskar lægger op.' },
  { id: 'p1', title: 'Møde #28', date: day(-46), time: '18.30', location: 'Tivolihallen', description: '' },
  { id: 'p2', title: 'Generalforsamling 2026', date: day(-120), time: '17.00', location: 'Marv og Ben', description: '' },
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

/** Relabelled 2026-07-30: /anciennitet now carries two new-meeting buttons that
    write different tables — this one plans an evening, "Registrér møde" records
    one that happened. Named once here so the distinction cannot rot in four
    places. */
const NEW_MEETING = 'Nyt møde i kalenderen'

const cardFor = (title: string) => screen.getByText(title).closest('article')!

beforeEach(() => reset({ events: EVENTS }))

describe('the calendar a member sees', () => {
  it('lists what is planned and what has been held', async () => {
    renderPage('user')
    expect(await screen.findByText('Møde #29')).toBeInTheDocument()
    expect(screen.getByText('Møde #30')).toBeInTheDocument()
    expect(screen.getByText('Møde #28')).toBeInTheDocument()
    expect(screen.getByText('Generalforsamling 2026')).toBeInTheDocument()
  })

  it('offers a member nothing that writes', async () => {
    renderPage('user')
    await screen.findByText('Møde #29')
    expect(screen.queryByRole('button', { name: NEW_MEETING })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Rediger' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Slet' })).not.toBeInTheDocument()
  })

  it('says the venue is unset rather than leaving a blank line', async () => {
    renderPage('user')
    // §9 has the lead calling the meeting two weeks ahead, so a date without a
    // venue is the ordinary state of the second one — not a page that failed.
    expect(await screen.findByText('Sted endnu ikke sat')).toBeInTheDocument()
  })

  it('states the statutes’ promise when nothing is planned', async () => {
    reset({ events: EVENTS.filter((e) => e.date < day(0)) })
    renderPage('user')
    expect(await screen.findByText(/der planlægges altid to møder forud/i)).toBeInTheDocument()
  })
})

describe('what this page shows that the others cannot', () => {
  it('keeps the held meetings, which is where a mistyped date lands', async () => {
    // The front page shows the next meeting and the public page the next two.
    // Type 2025 instead of 2026 and the meeting vanishes from both — this is
    // the only screen it is still reachable on, so it must stay editable here.
    renderPage('admin')
    await screen.findByText('Møde #28')
    expect(
      within(cardFor('Møde #28')).getByRole('button', { name: 'Rediger' }),
    ).toBeInTheDocument()
  })
})

describe('writing a meeting', () => {
  it('creates one from what was typed', async () => {
    const user = userEvent.setup()
    renderPage('admin')
    await user.click(await screen.findByRole('button', { name: NEW_MEETING }))

    await user.type(screen.getByLabelText(/Titel/), 'Møde #31')
    fireEvent.change(screen.getByLabelText(/Dato/), { target: { value: '2026-12-03' } })
    // A text field, not <input type="time">: the club writes "18.30", which the
    // native control refuses outright.
    await user.type(screen.getByLabelText(/Tidspunkt/), '18.30')
    await user.type(screen.getByLabelText(/Sted/), 'Lord Nelson')
    await user.type(screen.getByLabelText(/Beskrivelse/), 'Anders lægger op.')
    await user.click(screen.getByRole('button', { name: 'Gem' }))

    await waitFor(() => expect(writes).toHaveLength(1))
    expect(writes[0]).toMatchObject({
      table: 'events',
      verb: 'insert',
      values: {
        title: 'Møde #31',
        date: '2026-12-03',
        time: '18.30',
        location: 'Lord Nelson',
        description: 'Anders lægger op.',
      },
    })
  })

  it('keeps what was typed when the keyboard is dismissed', async () => {
    // Same bug, same shape, on the other table: leave every field by a route
    // that is not Enter and nothing may be lost on the way to Gem.
    const user = userEvent.setup()
    renderPage('admin')
    await user.click(await screen.findByRole('button', { name: NEW_MEETING }))

    await user.type(screen.getByLabelText(/Titel/), 'Julefrokost')
    await user.tab()
    await user.type(screen.getByLabelText(/Sted/), 'Tivolihallen')
    await user.click(screen.getByRole('button', { name: 'Gem' }))

    await waitFor(() => expect(writes).toHaveLength(1))
    expect(writes[0].values).toMatchObject({ title: 'Julefrokost', location: 'Tivolihallen' })
  })

  it('refuses to save a meeting with no title', async () => {
    const user = userEvent.setup()
    renderPage('admin')
    await user.click(await screen.findByRole('button', { name: NEW_MEETING }))
    expect(screen.getByRole('button', { name: 'Gem' })).toBeDisabled()
  })

  it('corrects a wrong date against the meeting’s own id', async () => {
    const user = userEvent.setup()
    renderPage('admin')
    await screen.findByText('Møde #29')
    await user.click(within(cardFor('Møde #29')).getByRole('button', { name: 'Rediger' }))

    fireEvent.change(screen.getByLabelText(/Dato/), { target: { value: '2026-09-10' } })
    await user.click(screen.getByRole('button', { name: 'Gem' }))

    await waitFor(() => expect(writes).toHaveLength(1))
    expect(writes[0]).toMatchObject({
      table: 'events',
      verb: 'update',
      id: 'e1',
      values: { date: '2026-09-10', title: 'Møde #29', location: 'Propaganda' },
    })
  })
})

/**
 * The card's face, T073 — and the row a map will one day hang off.
 *
 * Lukas, 2026-07-29, on the long view: "vi skal have et kort, som viser alle
 * steder vi har været implementeret på længere sigt." The venue is on its own
 * row with the set's pin rather than being one more muted line among three, so
 * that a link, a chip or a marker can arrive there without the card being
 * rebuilt around it. What is asserted is what the club can lose: the venue is
 * still printed, still says so in words when nobody has set one, and the date
 * still leads.
 */
describe('the card’s face', () => {
  it('gives the venue its own row, named or not', async () => {
    renderPage('user')
    await screen.findByText('Møde #29')

    expect(within(cardFor('Møde #29')).getByText('Propaganda')).toBeInTheDocument()
    // §9 has the venue settled after the date, so an empty line would read as
    // a card that failed to load.
    expect(within(cardFor('Møde #30')).getByText('Sted endnu ikke sat')).toBeInTheDocument()
  })

  it('leads with the day and keeps the time beside it', async () => {
    renderPage('user')
    await screen.findByText('Møde #29')
    const card = within(cardFor('Møde #29'))
    const when = new Date(Date.now() + 14 * 864e5)

    expect(card.getByText(String(when.getUTCDate()))).toBeInTheDocument()
    expect(card.getByText('18.30')).toBeInTheDocument()
  })
})

describe('deleting a meeting', () => {
  it('asks first, and puts the date in the question', async () => {
    const user = userEvent.setup()
    renderPage('admin')
    await screen.findByText('Møde #29')
    await user.click(within(cardFor('Møde #29')).getByRole('button', { name: 'Slet' }))

    // Two meetings can share a title — "Møde #29" is one typo away from
    // existing twice — so the question carries the date that tells them apart.
    expect(screen.getByRole('alert')).toHaveTextContent('Møde #29 ·')
    expect(screen.getByRole('alert')).toHaveTextContent('Det kan ikke fortrydes.')
    expect(writes).toHaveLength(0)
  })

  it('deletes the meeting it asked about', async () => {
    const user = userEvent.setup()
    renderPage('admin')
    await screen.findByText('Møde #28')
    await user.click(within(cardFor('Møde #28')).getByRole('button', { name: 'Slet' }))
    await user.click(screen.getByRole('button', { name: 'Slet endeligt' }))

    await waitFor(() => expect(writes).toHaveLength(1))
    expect(writes[0]).toMatchObject({ table: 'events', verb: 'delete', id: 'p1' })
  })
})
