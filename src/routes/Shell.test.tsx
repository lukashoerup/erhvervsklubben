import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { Shell } from './Shell'
import { AuthContext, type AuthState } from '../auth/AuthContext'
import { minTapHeightPx } from '../test/harness'

/**
 * The furniture every signed-in page sits in. Whatever is wrong here is wrong
 * on all five of them at once.
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
  return render(
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
  )
}

test('“Log ud” is big enough to hit with a thumb', () => {
  // It was 37 × 16 px — the size of the word — on every page in the app.
  renderShell()
  expect(minTapHeightPx(screen.getByRole('button', { name: 'Log ud' }))).toBeGreaterThanOrEqual(44)
})

test('signing out leaves you on the club’s public page', async () => {
  const user = userEvent.setup()
  renderShell()
  await user.click(screen.getByRole('button', { name: 'Log ud' }))
  // Not back at the password box you just chose to step away from.
  expect(await screen.findByText('Forsiden')).toBeInTheDocument()
})
