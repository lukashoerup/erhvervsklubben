# Task: T061 the club's finance graph (phase 5 — PLAN.md calls it T054)

## Lukas's requirement (2026-07-27)
> "Members cannot see the finance graph. I.e., the financials of the club
> (expected vs. realised income)."

`/oekonomi` has been a member route since 2026-07-27 (§8 puts the accounts in
front of the whole membership once a year), and it already did every sum — but
it did them as tables. The thing the page exists to show, the distance between
what the club charges and what actually arrives, had to be worked out by
reading two columns and subtracting.

## What was built
- `src/components/FinanceChart.tsx` — two curves and the band between them, plus
  the empty state, the axis rounding and the `kr()` formatter.
- `src/pages/Oekonomi.tsx` — the chart above the treasurer's tools, and the
  monthly table finally formatted like the rest of the page.
- `src/components/FinanceChart.test.tsx`, `src/pages/Oekonomi.test.tsx` — 18 new
  tests. Nothing added to the suite touches a network or a real browser.

No new dependency: recharts has been in `package.json` since 2026-07-23 and had
never been imported. It costs ~107 kB gzipped, and this is the only screen that
uses it — see "Left undone".

## Decisions
- **The curves are running totals, not month against month.** Fines are
  collected **quarterly** (Bødekasseregulativ, Stk. 3), so a month's payment
  against that month's charge is meaningless by design: one month shows a
  quarter's money arriving and the two either side show none. A monthly chart
  draws that sawtooth as though it were a collection problem. On running totals
  the vertical distance between the curves *is* `outstanding` — the number the
  rest of the page already reports — and the curves separate only where money
  genuinely has not arrived. The monthly figures stay in the table underneath,
  which doubles as the chart's table view.
- **The gap is a filled band, not the space between two lines.** Two thin curves
  leave a reader measuring the distance by eye. Shaded, that distance becomes
  the largest object on the card, which is what it is: every krone in it is
  money the club has charged and not collected.
- **Colour does identity, position does sign.** Blue is what the rules say
  should come in, green is what did, and the band takes the club's own red where
  it is behind and the same green where it is ahead. The red is never asked to
  be told apart from the green *by hue* — it only appears as a wash bounded by
  the two curves, and the figures above the chart say which way it went in
  words. `validate_palette.js` on the two series colours: every hard gate passes
  in both modes (light all-pass; dark clears CVD ΔE 21.8, normal-vision 23.5 and
  ≥3:1 contrast, and fails only the lightness-band check because
  `--color-present` sits L 0.728 against a 0.67 ceiling — a palette-shape note,
  not a legibility one, and not worth repainting every attendance pip for).
- **An empty chart is a card of reasons, not a flat line at zero.** This is the
  state production is in: `fines` and `payments` are empty and all 29 meetings
  are undated, so there is no month to group anything into. A line along zero
  would fill the space and read as a club that charged nothing and collected
  nothing. Each reason is measured rather than assumed — "hverken bøder eller
  indbetalinger", "ingen af klubbens 29 møder har en dato", or "6 af 29" — so
  they disappear one at a time as the books are filled in.
- **Fitted, not widened-and-scrolled.** A long history compresses instead of
  scrolling inside the card: two smooth curves stay readable narrow, and the one
  month a member actually wants — the last — is the one that would sit off the
  right-hand edge. Verified at 30 months: the page never scrolls sideways.
- **Every figure is printed beside the chart**, so no value on the screen needs a
  hover to read; the tooltip and the table are the second and third routes to the
  same numbers, and `role="img"` with a Danish summary is the fourth.
- **`kr()` moved out of `Oekonomi.tsx` and is exported from the chart**, because
  the table and the chart have to round and group identically. The page was
  printing `3.600 kr.` in one card and `1050` in the next.
- **The year rides on every axis tick once the history crosses one.** The axis
  drops labels that will not fit, and it drops them from the middle — exactly
  where the tick naming the new year lives, leaving two unqualified "jun." two
  years apart.

## Acceptance criteria
- [x] Expected against realised income over time, on `/oekonomi`
- [x] Every member sees it; the bank balance and the debtor list stay with the
      treasurer
- [x] The gap is the thing the eye catches
- [x] Reuses `buildLedger` / `quarterlyTotals` / `balancesByMember` — no second
      calculation of any number
- [x] Tokens only, no raw hex; correct in light and dark
- [x] 420 px first; no sideways page scroll at 5 months or 30
- [x] The production (empty) state is deliberate and truthful
- [x] Ledger table figures carry `kr.` and a thousands separator
- [x] Danish throughout
- [x] `npm test` (117), `npm run build`, `npm run lint` green
- [x] No new dependency

## Verified in a browser
Chromium at 420×900, both colour schemes, both roles, against `build:demo`:
the populated chart, the hover readout, the production-shaped empty state
(demo data temporarily blanked and every meeting date nulled), and a 30-month
history. No horizontal page scroll in any of them.

## Left undone
- **Never seen with real numbers.** Production has no fines and no payments, so
  the only populated view that exists anywhere is the demo build's fabricated
  one. The arithmetic behind it is the same `buildLedger` the ledger tests pin
  against the real sheet history, but the drawn chart has never met a club
  figure.
- **Recharts doubles the bundle** — 521 kB → 894 kB raw, 152 kB → 259 kB
  gzipped — for one screen. `React.lazy` would keep it off every other page, but
  `scripts/build-demo.mjs` requires exactly one JS chunk in `dist/assets` and
  would silently produce a broken demo. Splitting the bundle means changing that
  script first.
- **`activeMembers` is still the whole roster**, not the active members §3
  actually charges. Pre-existing, and it inflates the expected curve by whatever
  the club has in inactive members. There is no active/inactive flag in the
  database to read.
- **No reduced-motion work**, because there is no motion: the chart is drawn
  static. The design system asks for growth-from-baseline on bars; if that is
  ever wanted here it needs a `prefers-reduced-motion` check, which recharts
  does not do on its own.
