import { beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { AuthContext, type AuthState } from '../auth/AuthContext'
import { withQuery } from '../test/harness'

/**
 * The club's money, as a member sees it.
 *
 * Two things this page has got wrong before and must not again: it kept the
 * finances away from the people paying them, and it printed the same kind of
 * number two different ways on one screen.
 */
let rows: Record<string, unknown[]> = {}

function builder(table: string) {
  const b: Record<string, unknown> = {}
  for (const m of ['select', 'gte', 'lte', 'eq', 'order', 'limit', 'upsert', 'update']) b[m] = () => b
  // oxlint-disable-next-line no-thenable
  b.then = (resolve: (v: unknown) => unknown) =>
    Promise.resolve({ data: rows[table] ?? [], error: null }).then(resolve)
  return b
}

vi.mock('../lib/supabase', () => ({
  READONLY: false,
  supabase: () => ({ from: (table: string) => builder(table) }),
}))

const { default: Oekonomi } = await import('./Oekonomi')

const ROSTER = ['Anders', 'Rasmus', 'Esben', 'Oskar', 'Emil', 'Saaby', 'Lukas', 'Mads', 'Kasper', 'Have']

/** Three dated meetings, ten members, and the demo build's fines and payments. */
function aClubWithBooks() {
  const meetings = [
    { id: 1, date: '2026-02-05' },
    { id: 2, date: '2026-04-09' },
    { id: 3, date: '2026-06-04' },
  ]
  rows = {
    attendance_records: meetings.map((m) => ({
      id: m.id,
      meeting_number: m.id,
      lead: 'Esben',
      pre_location: null,
      main_location: 'Propaganda',
      post_location: null,
      meeting_date: m.date,
    })),
    attendances: meetings.flatMap((m) =>
      ROSTER.map((name) => ({ record_id: m.id, member_name: name, attended: true })),
    ),
    fines: [
      { member_name: 'Esben', amount_kr: 50, record_id: 1 },
      { member_name: 'Mads', amount_kr: 185, record_id: 2 },
      { member_name: 'Kasper', amount_kr: 265, record_id: 2 },
      { member_name: 'Mads', amount_kr: 200, record_id: 3 },
      { member_name: 'Saaby', amount_kr: 110, record_id: 3 },
    ],
    payments: [
      { month: '2026-04-01', amount_kr: 900 },
      { month: '2026-05-01', amount_kr: 900 },
      { month: '2026-06-01', amount_kr: 1800 },
    ],
  }
}

/** Production as it stands: 29 meetings, none dated, and no books at all. */
function theClubAsItIsToday() {
  rows = {
    attendance_records: Array.from({ length: 29 }, (_, i) => ({
      id: i + 1,
      meeting_number: i + 1,
      lead: 'Esben',
      pre_location: null,
      main_location: 'Propaganda',
      post_location: null,
      meeting_date: null,
    })),
    attendances: ROSTER.map((name) => ({ record_id: 1, member_name: name, attended: true })),
    fines: [],
    payments: [],
  }
}

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
        <Oekonomi />
      </AuthContext.Provider>,
    ),
  )
}

beforeEach(() => {
  rows = {}
})

describe('who the finance graph is for', () => {
  it('shows an ordinary member the club’s income against what it charged', async () => {
    aClubWithBooks()
    renderPage('user')
    const chart = await screen.findByRole('img')
    expect(chart).toHaveAccessibleName(/Opkrævet i alt 6\.810 kr\., modtaget 3\.600 kr\./)
    expect(chart).toHaveAccessibleName(/klubben mangler 3\.210 kr\./)
  })

  it('still keeps the bank balance and the debtor list with the treasurer', async () => {
    aClubWithBooks()
    renderPage('user')
    await screen.findByRole('img')
    expect(screen.queryByText(/kun kassereren/i)).not.toBeInTheDocument()

    renderPage('admin')
    expect((await screen.findAllByText(/kun kassereren/i)).length).toBeGreaterThan(0)
  })
})

describe('the figures in the monthly table', () => {
  it('writes money the same way as the rest of the page', async () => {
    aClubWithBooks()
    renderPage('user')
    await screen.findByRole('img')
    // February: ten members at 100 kr. plus one 50 kr. fine. It used to render
    // as a bare 1050 next to cards printing 3.600 kr.
    expect(screen.getByText('2026-02').closest('tr')).toHaveTextContent('1.050 kr.')
    expect(screen.queryByText('1050')).not.toBeInTheDocument()
    // June, when the dues doubled: 10 × 200 + 310 in fines, 1.800 kr. paid.
    const june = screen.getByText('2026-06').closest('tr')
    expect(june).toHaveTextContent('2.310 kr.')
    expect(june).toHaveTextContent('1.800 kr.')
  })
})

describe('the club as it actually stands', () => {
  it('explains the missing chart instead of drawing an empty one', async () => {
    theClubAsItIsToday()
    renderPage('user')
    expect(await screen.findByText(/ingen kurve at tegne endnu/i)).toBeInTheDocument()
    expect(
      screen.getByText(/hverken bøder eller indbetalinger er registreret/i),
    ).toBeInTheDocument()
    expect(screen.getByText(/ingen af klubbens 29 møder har en dato/i)).toBeInTheDocument()
    // No plot, and no monthly table either — there is nothing honest to put in
    // one, and an empty grid reads as a club that charged nothing.
    expect(screen.queryByRole('img')).not.toBeInTheDocument()
    expect(screen.queryByRole('table')).not.toBeInTheDocument()
  })
})
