import { useState } from 'react'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import App from '../App'
import { AuthContext, type AuthState } from '../auth/AuthContext'
import { ROUTES } from './routes'

/**
 * Route protection, tested offline.
 *
 * These never touch Supabase — the auth state is supplied directly through the
 * context, which is exactly why AuthContext has no default implementation. The
 * fast suite has to run in CI without the database stack.
 *
 * Worth being clear about what this proves and what it does not: these are
 * *behaviour* tests, not security tests. Anyone can bypass JavaScript. The
 * security is in the database policies (tests/rls). This is what makes the site
 * behave correctly for someone using it normally.
 */
function renderAt(path: string, auth: Partial<AuthState>) {
  const value: AuthState = {
    userId: null,
    role: null,
    loading: false,
    signIn: async () => ({ error: null }),
    signOut: async () => {},
    ...auth,
  }
  return render(
    <AuthContext.Provider value={value}>
      <MemoryRouter initialEntries={[path]}>
        <App />
      </MemoryRouter>
    </AuthContext.Provider>,
  )
}

const MEMBER = { userId: 'u-1', role: 'user' as const }
const ADMIN = { userId: 'u-2', role: 'admin' as const }

const MEMBER_PATHS = ROUTES.filter((r) => r.access === 'member').map((r) => r.path)
const ADMIN_PATHS = ROUTES.filter((r) => r.access === 'admin').map((r) => r.path)

// --------------------------------------------------------------- the policy
//
// Everything below derives its expectations from ROUTES, which proves the
// guards work but cannot catch a route declared at the *wrong* level — the
// tests would simply verify the mistake. Caught in review: downgrading
// /oekonomi to 'member' left the whole suite green.
//
// So the intended policy is written out here, independently. Changing an access
// level now fails until someone changes this line too, which is the point: it
// should take a deliberate act, not a one-word edit.
const INTENDED: Record<string, string> = {
  '/login': 'public',
  '/': 'member',
  '/anciennitet': 'member',
  '/nyheder': 'member',
  '/regler': 'member',
  '/oekonomi': 'admin', // the club's money — Lukas, 2026-07-26
}

test('every route is declared at the access level we intend', () => {
  const actual = Object.fromEntries(ROUTES.map((r) => [r.path, r.access]))
  expect(actual).toEqual(INTENDED)
})

// -------------------------------------------------------------- signed out
describe('a signed-out visitor', () => {
  test.each(MEMBER_PATHS)('is sent to the login page from %s', (path) => {
    renderAt(path, {})
    expect(screen.getByLabelText('Adgangskode')).toBeInTheDocument()
  })

  test.each(ADMIN_PATHS)('is sent to the login page from %s', (path) => {
    renderAt(path, {})
    expect(screen.getByLabelText('Adgangskode')).toBeInTheDocument()
  })

  test('can reach the login page itself', () => {
    renderAt('/login', {})
    expect(screen.getByRole('button', { name: 'Log ind' })).toBeInTheDocument()
  })

  test('an unknown URL does not slip past the gate', () => {
    renderAt('/findes-ikke', {})
    expect(screen.getByLabelText('Adgangskode')).toBeInTheDocument()
  })
})

// ------------------------------------------------------------ still loading
test('a hard refresh does not bounce a signed-in member to the login page', () => {
  // The session is known only after an async lookup. Redirecting during that
  // window would log everyone out on every refresh — the classic version of
  // this bug, and invisible until someone reloads.
  renderAt('/anciennitet', { loading: true, userId: null })
  expect(screen.queryByLabelText('Adgangskode')).not.toBeInTheDocument()
  expect(screen.getByLabelText('Indlæser')).toBeInTheDocument()
})

// ----------------------------------------------------------------- a member
describe('a signed-in member', () => {
  test.each(MEMBER_PATHS)('can reach %s', (path) => {
    renderAt(path, MEMBER)
    expect(screen.queryByLabelText('Adgangskode')).not.toBeInTheDocument()
    expect(screen.getByRole('navigation', { name: 'Hovedmenu' })).toBeInTheDocument()
  })

  test.each(ADMIN_PATHS)('is refused %s, and told why', (path) => {
    renderAt(path, MEMBER)
    // Not a blank screen: an empty page reads as a broken site.
    expect(screen.getByRole('heading', { name: 'Kun for kassereren' })).toBeInTheDocument()
  })

  test('is not offered the treasurer link on the front page', () => {
    renderAt('/', MEMBER)
    expect(screen.queryByText(/Klubkassen/)).not.toBeInTheDocument()
  })
})

// ------------------------------------------------------------------ admin
describe('an admin', () => {
  test.each([...MEMBER_PATHS, ...ADMIN_PATHS])('can reach %s', (path) => {
    renderAt(path, ADMIN)
    expect(screen.queryByRole('heading', { name: 'Kun for kassereren' })).not.toBeInTheDocument()
    expect(screen.queryByLabelText('Adgangskode')).not.toBeInTheDocument()
  })

  test('is offered the treasurer link on the front page', () => {
    renderAt('/', ADMIN)
    expect(screen.getByText(/Klubkassen/)).toBeInTheDocument()
  })
})

// ------------------------------------------------------- returning to intent
test('signing in returns you to the page you asked for', async () => {
  const user = userEvent.setup()

  function Harness() {
    const [signedIn, setSignedIn] = useState(false)
    return (
      <AuthContext.Provider
        value={{
          userId: signedIn ? 'u-1' : null,
          role: signedIn ? 'user' : null,
          loading: false,
          signIn: async () => {
            setSignedIn(true)
            return { error: null }
          },
          signOut: async () => {},
        }}
      >
        <MemoryRouter initialEntries={['/regler']}>
          <App />
        </MemoryRouter>
      </AuthContext.Provider>
    )
  }

  render(<Harness />)
  await user.type(screen.getByLabelText('E-mail'), 'bob@test.local')
  await user.type(screen.getByLabelText('Adgangskode'), 'password123')
  await user.click(screen.getByRole('button', { name: 'Log ind' }))

  // Back to /regler, not dumped on the front page.
  expect(await screen.findByRole('heading', { name: 'Regler' })).toBeInTheDocument()
})

// ------------------------------------------------------------- failed login
test('a wrong password says so, without revealing whether the email exists', async () => {
  const user = userEvent.setup()
  renderAt('/login', {
    signIn: async () => ({ error: 'Forkert e-mail eller adgangskode.' }),
  })

  await user.type(screen.getByLabelText('E-mail'), 'bob@test.local')
  await user.type(screen.getByLabelText('Adgangskode'), 'wrong')
  await user.click(screen.getByRole('button', { name: 'Log ind' }))

  const alert = await screen.findByRole('alert')
  expect(alert).toHaveTextContent('Forkert e-mail eller adgangskode.')
})
