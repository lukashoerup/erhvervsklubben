import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { Shell } from './Shell'
import { AuthContext, type AuthState } from '../auth/AuthContext'
import { minTapHeightPx, withQuery } from '../test/harness'

/**
 * The furniture every signed-in page sits in. Whatever is wrong here is wrong
 * on all six of them at once.
 */
function renderShell(over: Partial<AuthState> = {}) {
  const value: AuthState = {
    userId: 'u-1',
    role: 'user',
    loading: false,
    signIn: async () => ({ error: null }),
    signOut: async () => {},
    ...over,
  }
  // withQuery, because the app bar now names the signed-in member and that
  // name comes from a query. The Shell stopped being pure furniture the moment
  // it started saying who you are.
  return render(
    withQuery(
      <AuthContext.Provider value={value}>
        <MemoryRouter initialEntries={['/hjem']}>
          <Routes>
            <Route path="/" element={<p>Forsiden</p>} />
            <Route element={<Shell />}>
              <Route path="/hjem" element={<p>Hjem</p>} />
            </Route>
          </Routes>
        </MemoryRouter>
      </AuthContext.Provider>,
    ),
  )
}

test('“Log ud” is big enough to hit with a thumb', () => {
  // It was 37 × 16 px — the size of the word — on every page in the app.
  renderShell()
  expect(minTapHeightPx(screen.getByRole('button', { name: 'Log ud' }))).toBeGreaterThanOrEqual(44)
})

test('the logo goes back to the club’s front page, past the redirect', async () => {
  // The bug this covers is not the link, it is the forward behind it: `/`
  // sends a signed-in member to /hjem, so a logo pointing at `/` bounces
  // straight back and the landing page stays unreachable — which is exactly
  // the state Lukas found it in. The route below is the real Landing's
  // stand-in; what is asserted is that the click arrives somewhere at all.
  const user = userEvent.setup()
  renderShell()
  await user.click(screen.getByRole('link', { name: 'Til forsiden' }))
  expect(await screen.findByText('Forsiden')).toBeInTheDocument()
})

test('the logo is big enough to hit with a thumb', () => {
  renderShell()
  expect(minTapHeightPx(screen.getByRole('link', { name: 'Til forsiden' }))).toBeGreaterThanOrEqual(
    44,
  )
})

test('signing out leaves you on the club’s public page', async () => {
  const user = userEvent.setup()
  renderShell()
  await user.click(screen.getByRole('button', { name: 'Log ud' }))
  // Not back at the password box you just chose to step away from.
  expect(await screen.findByText('Forsiden')).toBeInTheDocument()
})
