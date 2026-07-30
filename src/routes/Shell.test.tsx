import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { Shell } from './Shell'
import { AuthContext, type AuthState } from '../auth/AuthContext'
import { minTapHeightPx, withQuery } from '../test/harness'
import { LogoMark } from '../components/LogoMark'

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

/**
 * The blue line walking around the mark in the app bar, on Lukas's request
 * (2026-07-30): *"sådan stille og roligt kører rundt om logoet som står oppe i
 * venstre hjørne, når man er logget ind."*
 *
 * The mechanism is the whole risk. There is no timer and no state — the walk is
 * CSS, and CSS animations replay only when the element is replaced. The Shell
 * outlives every navigation, so without the key the line travels once in a
 * session and then never again, which is a failure nothing visible would report:
 * the frame is already in its finished position, so the bar looks correct.
 */
test('the mark walks its line, and is replaced on arrival so it can walk again', async () => {
  const user = userEvent.setup()
  render(
    withQuery(
      <AuthContext.Provider
        value={{
          userId: 'u-1',
          role: 'user',
          loading: false,
          signIn: async () => ({ error: null }),
          signOut: async () => {},
        }}
      >
        <MemoryRouter initialEntries={['/hjem']}>
          <Routes>
            <Route element={<Shell />}>
              <Route path="/hjem" element={<p>Hjem</p>} />
              {/* Distinct from the tab's own label, so the assertion below
                  cannot pass on the nav link it just clicked. */}
              <Route path="/regler" element={<p>Reglerne står her</p>} />
            </Route>
          </Routes>
        </MemoryRouter>
      </AuthContext.Provider>,
    ),
  )

  const edge = () => document.querySelector('.ek-frame-t')!
  // The walk's own delays, not the intro's 1350 ms — the app bar has no plate
  // fading up and no letters sliding in to wait for.
  expect(edge().closest('.ek-walk')).not.toBeNull()
  // Only the frame: the plate and the two letters must not re-run the intro on
  // every tab tap.
  expect(document.querySelector('.ek-square')).toBeNull()
  expect(document.querySelector('.ek-e')).toBeNull()

  const before = edge()
  await user.click(screen.getByRole('link', { name: 'Regler' }))
  await screen.findByText('Reglerne står her')
  // A different element, which is what restarts the animation. Same node would
  // mean the line walked once per session.
  expect(document.querySelector('.ek-frame-t')).not.toBe(before)
})

/**
 * The landing page's 104 px lockup, unchanged to the pixel.
 *
 * The inset and the line weight became functions of `size` so the 26 px mark in
 * the app bar would not wear the big lockup's proportions. At 104 they have to
 * come out at exactly the 5 px and 2 px that were hardcoded before, or the intro
 * Lukas calls genial has been quietly redrawn as a side effect.
 */
test('the big mark keeps the inset and weight it was drawn with', () => {
  render(<LogoMark size={104} animated />)
  const top = document.querySelector('.ek-frame-t') as HTMLElement
  expect(top.style.top).toBe('-5px')
  expect(top.style.height).toBe('2px')

  render(<LogoMark size={26} walk />)
  const small = document.querySelectorAll('.ek-frame-t')[1] as HTMLElement
  expect(small.style.top).toBe('-3px')
  expect(small.style.height).toBe('1.5px')
})
