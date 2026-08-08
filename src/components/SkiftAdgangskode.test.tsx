import { beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { withQuery } from '../test/harness'

/**
 * Changing your own password, which the club had no way to do until 2026-08-08.
 *
 * The one that matters most is the last: a **read-only or demo build must not offer
 * it at all**. Both carry the club's real Supabase project, and `auth.updateUser`
 * does not go through the read-only Proxy in `lib/supabase` — that wraps `from` and
 * `rpc`, which is where the club's *data* lives, and an auth call would sail
 * straight past it into a real member's real account.
 */
const updateUser = vi.fn()

vi.mock('../lib/supabase', () => ({
  READONLY: false,
  supabase: () => ({ auth: { updateUser } }),
}))

const { SkiftAdgangskode } = await import('./SkiftAdgangskode')

const open = () => {
  render(withQuery(<SkiftAdgangskode />))
  // `<details>` renders its content either way in jsdom, so the fields are
  // reachable without opening it. Opening anyway, because that is the path.
  document.querySelector('details')?.setAttribute('open', '')
}

const field = (name: RegExp) => screen.getByLabelText(name)
const gem = () => screen.getByRole('button', { name: /Gem adgangskode/ })

beforeEach(() => {
  updateUser.mockReset()
  updateUser.mockResolvedValue({ error: null })
})

describe('changing your own password', () => {
  it('refuses to save until it is long enough and typed the same twice', async () => {
    const user = userEvent.setup()
    open()
    expect(gem()).toBeDisabled()

    await user.type(field(/^Ny adgangskode/), 'kort')
    expect(screen.getByText('Mindst 8 tegn.')).toBeInTheDocument()
    expect(gem()).toBeDisabled()

    await user.clear(field(/^Ny adgangskode/))
    await user.type(field(/^Ny adgangskode/), 'erhvervsklub2026')
    await user.type(field(/Gentag/), 'erhvervsklub2025')
    // A typo in a single field is a member locked out of his own account until
    // Lukas resets it by hand, which is the errand this exists to end.
    expect(screen.getByText('De to felter er ikke ens.')).toBeInTheDocument()
    expect(gem()).toBeDisabled()

    await user.clear(field(/Gentag/))
    await user.type(field(/Gentag/), 'erhvervsklub2026')
    expect(gem()).toBeEnabled()
  })

  it('sends the new password and says the session survives', async () => {
    const user = userEvent.setup()
    open()
    await user.type(field(/^Ny adgangskode/), 'erhvervsklub2026')
    await user.type(field(/Gentag/), 'erhvervsklub2026')
    await user.click(gem())

    await waitFor(() => expect(updateUser).toHaveBeenCalledWith({ password: 'erhvervsklub2026' }))
    // Supabase keeps the session, and a member who is not told that will assume he
    // has been signed out and go looking for the login screen.
    expect(await screen.findByText(/Du er stadig logget ind/)).toBeInTheDocument()
    // Cleared, so a shoulder-surfer does not read it off the screen afterwards.
    expect((field(/^Ny adgangskode/) as HTMLInputElement).value).toBe('')
  })

  it('passes the server’s own refusal through', async () => {
    updateUser.mockResolvedValue({ error: new Error('Password should be at least 12 characters') })
    const user = userEvent.setup()
    open()
    await user.type(field(/^Ny adgangskode/), 'erhvervsklub2026')
    await user.type(field(/Gentag/), 'erhvervsklub2026')
    await user.click(gem())

    // The one place in this app where echoing Supabase back is right: the reader is
    // already signed in as the account, and what the server objected to is the only
    // thing that tells him what to type instead. On the login form the same message
    // would tell a stranger whether an e-mail belongs to a member.
    expect(await screen.findByRole('alert')).toHaveTextContent(/at least 12 characters/)
  })

  it('never asks for the current password', () => {
    open()
    // Deliberate. The club's sessions outlive the sign-in that made them by months
    // (T074), so a member who has not typed his password since Lukas handed it to
    // him could not produce it — and he is exactly who this is for.
    expect(screen.queryByLabelText(/nuværende|gamle/i)).not.toBeInTheDocument()
    expect(screen.getAllByLabelText(/adgangskode/i)).toHaveLength(2)
  })
})

describe('a build that must not touch a real account', () => {
  it('does not render in a read-only preview', async () => {
    vi.resetModules()
    vi.doMock('../lib/supabase', () => ({ READONLY: true, supabase: () => ({ auth: { updateUser } }) }))
    const { SkiftAdgangskode: ReadOnly } = await import('./SkiftAdgangskode')
    const { container } = render(withQuery(<ReadOnly />))
    expect(container.textContent).toBe('')
    vi.doUnmock('../lib/supabase')
  })

  it('does not render in the demo build', async () => {
    vi.resetModules()
    vi.doMock('../data/demo', async (orig) => ({
      ...(await orig<Record<string, unknown>>()),
      DEMO: true,
    }))
    const { SkiftAdgangskode: Demo } = await import('./SkiftAdgangskode')
    const { container } = render(withQuery(<Demo />))
    expect(container.textContent).toBe('')
    vi.doUnmock('../data/demo')
  })
})
