import { describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { AuthContext, type AuthState } from '../auth/AuthContext'
import { withQuery } from '../test/harness'

/**
 * The money page in a build that may read production but never write to it.
 *
 * Its own file because `READONLY` is read at module scope, so the mode is a
 * property of the whole module graph rather than something a test can set.
 *
 * Two halves, and both matter. It must not write — the client refuses the verbs
 * and the write-shaped UI is not rendered, which is the promise `lib/supabase`
 * makes on this page's behalf. And it must still *read*: the query used to
 * answer empty without asking, from a time when the live project had no `fines`
 * or `payments` tables at all. It has had both since 2026-07-27, so a preview
 * that short-circuits now reports a club that has charged nothing and collected
 * nothing — the one thing a read-only build exists to avoid.
 */
let rows: Record<string, unknown[]> = {}

function builder(table: string) {
  const b: Record<string, unknown> = {}
  for (const m of ['select', 'gte', 'lte', 'eq', 'order', 'limit']) b[m] = () => b
  // oxlint-disable-next-line no-thenable
  b.then = (resolve: (v: unknown) => unknown) =>
    Promise.resolve({ data: rows[table] ?? [], error: null }).then(resolve)
  return b
}

vi.mock('../lib/supabase', () => ({
  READONLY: true,
  supabase: () => ({ from: (table: string) => builder(table) }),
}))

const { default: Oekonomi } = await import('./Oekonomi')

const ROSTER = ['Anders', 'Rasmus', 'Esben', 'Oskar', 'Emil', 'Saaby', 'Lukas', 'Mads', 'Kasper', 'Have']

function renderPage(role: AuthState['role']) {
  rows = {
    attendance_records: [
      {
        id: 1,
        meeting_number: 1,
        lead: 'Esben',
        pre_location: null,
        main_location: 'Propaganda',
        post_location: null,
        meeting_date: '2026-06-04',
      },
    ],
    attendances: ROSTER.map((name) => ({ record_id: 1, member_name: name, attended: true })),
    fines: [{ member_name: 'Mads', amount_kr: 200, record_id: 1 }],
    payments: [{ month: '2026-06-01', amount_kr: 1800 }],
  }
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

describe('a read-only preview of the club’s books', () => {
  it('reports the club’s real figures rather than zeros', async () => {
    renderPage('admin')
    // June 2026: ten members at 200 kr. plus a 200 kr. fine, 1.800 kr. paid.
    expect(await screen.findByText(/Skrivebeskyttet/)).toBeInTheDocument()
    const june = screen.getByText('2026-06').closest('tr')
    expect(june).toHaveTextContent('2.200 kr.')
    expect(june).toHaveTextContent('1.800 kr.')
  })

  it('offers nothing that would write', async () => {
    renderPage('admin')
    await screen.findByText(/Skrivebeskyttet/)
    expect(screen.queryByLabelText('Møde')).not.toBeInTheDocument()
    expect(screen.queryByText(/Registrér bøder/)).not.toBeInTheDocument()
    expect(screen.queryByText(/Møder uden dato/)).not.toBeInTheDocument()
  })
})
