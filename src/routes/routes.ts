import type { IconName } from '../components/Icon'

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
  nav?: { label: string; icon: IconName }
}

/*
 * The icons are the design system's own, and so is the pairing. §03 lists ten
 * under "IKONER · 24 PX LINJE, ALTID MED TEKST" with a Danish word beside each,
 * and five of the six below are named there against the very destination they
 * point at: home/Hjem, bar_chart/Anciennitet, article/Nyheder, gavel/Regler,
 * calendar_month/Møde. The sixth, savings, is listed as "Bødekasse" — which is
 * what /oekonomi mostly is, the fine box plus the dues that fund it.
 *
 * They used to be ◆ ▤ ◷ ✦ § ◈, chosen for shape rather than meaning, and
 * Instrument draws none of them: the bar rendered in whatever fallback each
 * phone happened to have.
 */
export const ROUTES: RouteDef[] = [
  { path: '/login', access: 'public' },
  // The club's public face, 2026-07-27. `/` used to be the members' front page
  // and demanded a login before showing anything at all — a stranger following
  // a link to the club met a password box. It is now the landing page, and the
  // members' page moved to /hjem: a signed-in visitor at `/` is forwarded
  // there, so nobody has to choose the right URL and neither audience lands on
  // a page written for the other.
  { path: '/', access: 'public' },
  { path: '/hjem', access: 'member', nav: { label: 'Hjem', icon: 'home' } },
  { path: '/anciennitet', access: 'member', nav: { label: 'Anciennitet', icon: 'bar_chart' } },
  // `/moeder` was here from 2026-07-27 until 2026-07-30, when Lukas asked for the
  // meetings page and the anciennitet page to become one: "Så skal mødesiden
  // fjernes." The calendar it showed is now a section at the top of
  // /anciennitet — see components/Moedekalender.tsx — so `events` keeps its
  // screen, its admin editing and its two meetings ahead, and the tab bar is
  // five columns instead of six.
  { path: '/nyheder', access: 'member', nav: { label: 'Nyheder', icon: 'article' } },
  { path: '/regler', access: 'member', nav: { label: 'Regler', icon: 'gavel' } },
  // Members, not admins. It is their money: §8 puts the accounts in front of
  // the whole membership once a year, and there is no reading of the statutes
  // where the people funding the club may not see what it holds. The
  // treasurer's extra powers are gated inside the page, not at the door.
  { path: '/oekonomi', access: 'member', nav: { label: 'Økonomi', icon: 'savings' } },
]

export const NAV_ROUTES = ROUTES.filter((r) => r.nav)

export function accessFor(path: string): Access | undefined {
  return ROUTES.find((r) => r.path === path)?.access
}
