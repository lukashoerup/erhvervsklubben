/**
 * Every route in the app, and who may reach it. One list, deliberately.
 *
 * Scattering guards through the tree is how a page ends up unprotected: the
 * mistake is invisible, because nothing looks wrong until someone tries. Here,
 * adding a route without choosing an access level does not compile.
 *
 * This is the *page* layer only. It is not security — anyone can bypass
 * JavaScript. The database policies are the security (see docs/RULES.md and
 * tests/rls). This layer is what makes the site behave correctly.
 */
export type Access =
  /** Reachable signed out — the club's public face. */
  | 'public'
  /** Any signed-in member. */
  | 'member'
  /** Admin only. The club's money lives behind this (Lukas, 2026-07-26). */
  | 'admin'

export type RouteDef = {
  path: string
  access: Access
  /** Shown in the bottom tab bar, in this order. Omit to keep a route off it. */
  nav?: { label: string; icon: string }
}

export const ROUTES: RouteDef[] = [
  { path: '/login', access: 'public' },
  { path: '/', access: 'member', nav: { label: 'Hjem', icon: '◆' } },
  { path: '/anciennitet', access: 'member', nav: { label: 'Anciennitet', icon: '▤' } },
  { path: '/nyheder', access: 'member', nav: { label: 'Nyheder', icon: '✦' } },
  { path: '/regler', access: 'member', nav: { label: 'Regler', icon: '§' } },
  // Members, not admins. It is their money: §8 puts the accounts in front of
  // the whole membership once a year, and there is no reading of the statutes
  // where the people funding the club may not see what it holds. The
  // treasurer's extra powers are gated inside the page, not at the door.
  { path: '/oekonomi', access: 'member', nav: { label: 'Økonomi', icon: '◈' } },
]

export const NAV_ROUTES = ROUTES.filter((r) => r.nav)

export function accessFor(path: string): Access | undefined {
  return ROUTES.find((r) => r.path === path)?.access
}
