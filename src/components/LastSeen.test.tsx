import { describe, expect, it, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import { withQuery, minTapHeightPx } from '../test/harness'

/**
 * "Sidst set" as an admin actually reads it (T074).
 *
 * Two of the club's ten have no login at all, and a member who has one may
 * simply never have opened the new site. Those are different facts and neither
 * of them is a date — this is the test that stops a future refactor rendering
 * either as "1. januar 1970" or as a blank line that reads like a bug.
 */
const rows: Record<string, unknown[]> = {
  user_member_mapping: [
    { user_id: 'u-1', member_name: 'Lukas' },
    { user_id: 'u-2', member_name: 'Saaby' },
    // An account the club's member list cannot name — Claude's own admin
    // login is exactly this. It must not appear as an eleventh member.
    { user_id: 'u-9', member_name: 'Ukendt konto' },
  ],
  member_last_seen: [
    { user_id: 'u-1', last_seen_at: new Date().toISOString() },
    { user_id: 'u-9', last_seen_at: new Date().toISOString() },
  ],
}

function builder(table: string) {
  const b: Record<string, unknown> = { select: () => b }
  // oxlint-disable-next-line no-thenable
  b.then = (resolve: (v: unknown) => unknown) =>
    Promise.resolve({ data: rows[table] ?? [], error: null }).then(resolve)
  return b
}

vi.mock('../lib/supabase', () => ({
  READONLY: false,
  supabase: () => ({ from: (t: string) => builder(t) }),
}))

const { LastSeen } = await import('./LastSeen')

/** The club as the roster hands it over: two of them have never had a login. */
const ROSTER = ['Lukas', 'Saaby', 'Kasper', 'Have']

const show = () => render(withQuery(<LastSeen roster={ROSTER} />))

describe('sidst set', () => {
  it('says when each member was last here, and says the rest in words', async () => {
    show()
    await waitFor(() => expect(screen.getByText('Lukas')).toBeInTheDocument())

    // Visited today.
    expect(screen.getByText('i dag')).toBeInTheDocument()
    // Has a login, has never opened the site. Not a date, and not blank.
    expect(screen.getByText('aldrig åbnet siden')).toBeInTheDocument()
    // No login at all — the club cannot expect to see these two here.
    expect(screen.getAllByText('intet login')).toHaveLength(2)
  })

  it('lists the club and nobody else', async () => {
    show()
    await waitFor(() => expect(screen.getByText('Lukas')).toBeInTheDocument())
    expect(screen.queryByText('Ukendt konto')).not.toBeInTheDocument()
  })

  it('is alphabetical, never a ranking by absence', async () => {
    // The order is the guard against this becoming a league table of who has
    // not been around — in a club of ten that is a different social object.
    show()
    await waitFor(() => expect(screen.getByText('Lukas')).toBeInTheDocument())
    const names = screen.getAllByRole('listitem').map((li) => li.firstChild?.textContent)
    expect(names).toEqual(['Have', 'Kasper', 'Lukas', 'Saaby'])
  })

  it('starts folded, and opens at the design system\'s tap floor', async () => {
    const { container } = show()
    await waitFor(() => expect(screen.getByText('Lukas')).toBeInTheDocument())
    expect(container.querySelector('details')?.open).toBe(false)
    expect(minTapHeightPx(container.querySelector('summary')!)).toBeGreaterThanOrEqual(48)
  })

  it('says on the screen what is recorded, so a member can be told', async () => {
    show()
    await waitFor(() => expect(screen.getByText('Lukas')).toBeInTheDocument())
    expect(screen.getByText(/ikke hvilke sider/i)).toBeInTheDocument()
  })
})
