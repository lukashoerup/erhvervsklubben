import { describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { AuthContext, type AuthState } from '../auth/AuthContext'
import { withQuery } from '../test/harness'
import { client, reset } from '../test/writes'

/**
 * Both editing screens in a build that may read production but never write it.
 *
 * Its own file because `READONLY` is read at module scope, so the mode is a
 * property of the whole module graph rather than something one test can set.
 *
 * The client refuses every write verb on its own (see lib/supabase), so this is
 * the second of the two independent guarantees: the write-shaped UI is not
 * rendered either. Either alone would be a promise; together they survive
 * someone forgetting the other. And the *reading* must be untouched — a
 * preview that hid the club's own calendar would be lying about the club
 * rather than protecting it.
 */
vi.mock('../lib/supabase', () => ({ READONLY: true, supabase: () => client }))

const { default: Nyheder } = await import('../pages/Nyheder')
const { default: Moeder } = await import('../pages/Moeder')

function renderAsAdmin(page: 'nyheder' | 'moeder') {
  reset({
    news: [
      { id: 'n1', title: 'Sommerfest 2026', excerpt: 'Hos Saaby.', author: 'Saaby', date: '2026-06-09' },
    ],
    events: [
      { id: 'e1', title: 'Møde #29', date: '2026-08-13', time: '18.30', location: 'Propaganda', description: '' },
    ],
  })
  const value: AuthState = {
    userId: 'u1',
    role: 'admin',
    loading: false,
    signIn: async () => ({ error: null }),
    signOut: async () => {},
  }
  return render(
    withQuery(
      <AuthContext.Provider value={value}>
        {page === 'nyheder' ? <Nyheder /> : <Moeder />}
      </AuthContext.Provider>,
    ),
  )
}

describe('a read-only preview', () => {
  it('still shows the admin the news, and offers no way to change it', async () => {
    renderAsAdmin('nyheder')
    expect(await screen.findByText('Sommerfest 2026')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Ny nyhed' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Rediger' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Slet' })).not.toBeInTheDocument()
  })

  it('still shows the calendar, and offers no way to change it', async () => {
    renderAsAdmin('moeder')
    expect(await screen.findByText('Møde #29')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Nyt møde' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Rediger' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Slet' })).not.toBeInTheDocument()
  })
})
