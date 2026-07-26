# Task: T058 a demo build that can be opened from a link

## Why
Lukas was asked to test the app before anything was hosted. Nothing was
deployed, no database was reachable from outside this container, and the reply
he got amounted to "have a look" with nowhere to look. That was the mistake this
task fixes.

> "Giv me a link. I do not know where and what to test" — Lukas, 2026-07-26

## What it is not
It is **not** a deploy of the real site. Phase 8 is still not started, and
pointing a public URL at the club's records is a step that needs his say-so
(SYSTEM.md: agents stop and ask before deploys and anything touching prod data).

This is a build with the database replaced by fabricated numbers, folded into a
single HTML file. It reads no records, writes nothing, holds no keys, and cannot
reach Supabase — the demo branches return their own data before any query is
made.

## Shape
- `src/data/demo.ts` — `DEMO` (true only when built with `VITE_DEMO=1`) plus a
  fabricated club: 28 meetings on the real cadence, the real roster and venues,
  news, fines, payments. Shaped like the real thing so the layout is judged
  against realistic content, not lorem ipsum.
- `src/auth/DemoAuthProvider.tsx` — any password signs you in, and a bar at the
  top switches between member and treasurer, so the access rules can be *seen*
  working instead of described. Role kept in sessionStorage so a reload does not
  throw you out, which is what the real session does too.
- `scripts/build-demo.mjs` + `npm run build:demo` — inlines the stylesheet and
  the bundle into `dist-demo/index.html`. One file, no server rules, no network
  request. It refuses to run on a bundle that is not a demo build.
- The real `AuthProvider`, the real queries and the real deployment path are
  untouched. Every demo branch is behind `DEMO`, which is `false` in a normal
  build and therefore dropped by the bundler.

## Acceptance criteria
- [x] One file that opens anywhere, including hosts that serve a single page
- [x] Every screen reachable and correct: front page, Anciennitet, Nyheder,
      Regler, and the treasurer's Økonomi
- [x] Nothing about the production build changes
- [x] `npm test`, `npm run lint`, `npm run build` all green
- [x] Driven in a real browser at phone size, in both colour schemes, with no
      page errors

## Working notes

### Four bugs the browser found and the tests could not
1. **The tab bar sat below the fold.** The shell is `100vh` tall and the demo
   bar adds height above it, so the page was taller than the screen and the
   bottom navigation hung off the end. Fixed by publishing the bar's height as
   `--demo-bar` and sizing the shell `calc(100dvh - var(--demo-bar, 0px))`.
   Production never sets the variable and falls back to `0px`.
2. **`100vh` was wrong anyway.** On a phone it means the viewport *without* the
   address bar, so the tab bar starts below the fold on the real site too. Now
   `dvh` everywhere. This one is a genuine mobile fix, not a demo detail.
3. **The demo bar was translucent**, so the app header scrolled visibly through
   it. Opaque now.
4. **Danish text turned to mojibake** on a host that serves HTML without a
   charset in the header — the browser guesses, and it guesses latin-1. The
   generated file now declares `<meta charset="utf-8">` in its first bytes.

### One real bug in the shipped stylesheet
The dark palette **was not in the build at all**. `src/index.css` put the
light-mode overrides in a second `@theme` block inside
`@media (prefers-color-scheme: light)` — but Tailwind collects every `@theme`
into one `:root` regardless of the at-rules around it, so the media query was
discarded and the light values simply replaced the dark ones. The agreed dark
ground had never rendered on anyone's device.

Nothing failed and nothing warned; a browser was the only place it showed.
Fixed by overriding the variables in a plain `:root` inside the media query —
utilities compile to `var(--color-…)`, so that is sufficient — and pinned by
`src/theme.test.ts`, which fails on an indented `@theme` and on the two grounds
collapsing into one. Verified by reintroducing the bug: the guard goes red.

### Not done here
The demo has no persistence and no writing. Saving a fine in the treasurer's
screen is a real mutation against a real table, so in the demo the form is there
to look at, not to submit.
