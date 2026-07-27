# Task: T060 public landing page (phase 4)

## Lukas's requirement (2026-07-27)
> "There should be a landing page for both members and the public. This is the
> page where the animation is. With some core details. Then everything else
> should be behind the login page."

Until now `/` was the members' front page. A visitor following a link to
Erhvervsklubben met a password box, which tells them nothing about the club —
and §4 Stk. 2 A. means people *do* arrive before they have a login: you attend
once as a guest before anyone may vote on your membership.

## What was built
- `src/pages/Landing.tsx` — the club's public face. The logo intro, the purpose
  and cadence quoted from the statutes, the meeting calendar, recent news, and
  the route to membership.
- `src/components/LogoMark.tsx` — the mark inline rather than as an `<img>`, so
  the plate and the two letters can be animated separately.
- The intro and the design system's three surfaces in `src/index.css`.

## Decisions
- **`/` is public; the members' front page moved to `/hjem`.** A signed-in
  member opening `/` is forwarded there, so both audiences use the URL people
  actually type and share, and neither lands on a page written for the other.
  An unknown URL now shows the landing page rather than the login form — a
  mistyped link is not a security event.
- **Signing out goes to `/`, not `/login`.** There is somewhere to be now.
- **Only `news` and `events` are read.** They are the two anon-readable tables
  (Lukas, 2026-07-23). The page does not merely omit member names, attendance
  and money — it never asks for them, and `Landing.test.tsx` asserts the set of
  tables it queries. RLS would refuse the rest anyway, but a page that tries and
  fails is one policy edit away from leaking.
- **Every claim about the club is quoted from `vedtaegter.ts`.** A landing page
  is where invented copy normally lives; copy nobody voted on is exactly what
  drifts from what the club is.
- **No dues figure, and no counts.** Not member names, attendance or finances,
  and not the 200 kr. either — public in the statutes, but it reads as a price
  tag to someone deciding about the club. Putting it out front is Lukas's call,
  not a side effect. One line in `Kernefakta` if he wants it.
- **The empty calendar is the shipping state**, not a fallback nobody sees:
  there are 0 future-dated events today. So the card's subject is the club's
  *rhythm* (§9), which is true whether or not a date exists, and the missing
  date is a chip inside a complete card. A failed query renders identically —
  "kunne ikke hente data" tells a member to reload and tells a stranger the club
  is broken.
- **The intro follows the design system's logo timeline, with one departure.**
  The tail (wordmark, rule, words) is pulled forward from 2.2/2.7/3.0 s to
  1.2/1.6/1.9 s. The guide times that for its own hero, where the intro is the
  page; here, at three seconds the screen was a lone mark above an empty band —
  not deliberate slowness, a page that looks unloaded. Gestures, order, curve
  and the 60 ms stagger are unchanged. Reasoning is over the keyframes.
- **`--color-brand`, a theme-constant #2563eb for filled buttons.** White on
  `--color-accent` measures 3.2:1 on the dark ground; the primary call to action
  on the club's public page cannot fail AA. The accent still has to lighten in
  dark mode to work as *text*, so the button fill needed to stop borrowing it.

## Acceptance criteria
- [x] `/` reachable signed out, and it is a page rather than a login form
- [x] The logo animation, CSS only, no new dependencies
- [x] `prefers-reduced-motion` gets the finished lockup and no movement
- [x] Core club details, all of them sourced from the statutes
- [x] Signed-in members still land somewhere sensible (`/hjem`)
- [x] Nothing member-only is shown, and nothing member-only is requested
- [x] The empty event state looks deliberate
- [x] Danish throughout
- [x] `npm test` (99), `npm run build`, `npm run lint` green

## Verified in a browser
Chromium at 420×900, both colour schemes, `prefers-reduced-motion` both ways:
no horizontal overflow, no tap target under 48 px, no text failing AA contrast.

## Left undone
- **The two Instrument fonts are still not extracted** from the design bundle,
  so the display type is Georgia. A page leaning on Instrument Serif at 52 px is
  the place where that shows most. They must be self-hosted — no CDN access.
- **`bg-accent` buttons elsewhere** (login, Økonomi) still measure 3.2:1 in dark
  mode. `--color-brand` exists for them now; changing them is its own pass.
- **Live data was never seen.** This environment's browser cannot present a
  trusted certificate to Supabase, so both queries failed and the screenshots
  show the empty and error states. Those are correct, and the empty calendar is
  what production shows today — but the news list has only been seen with
  fixtures.
