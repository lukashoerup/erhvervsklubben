# Task: T064 the design system on the members' screens (phase 7)

## Lukas's requirement (2026-07-27)
> "We need to align all pages to follow the Claude Design closer — e.g. the
> scrolling features that make it look super cool and state of the art."

The palette, the three surfaces and the logo intro landed with T060, on the
landing page. Behind the login nothing had changed, so the app read as two
products: a designed front door and the plain layout underneath it.

## What was built

### The fonts (commit 1)
`design/erhvervsklubben-designsystem-v2.html` turned out to carry its own
assets. There is a JSON map in it keyed by UUID —
`{"<uuid>": {"mime": "font/woff2", "compressed": false, "data": "<base64>"}}` —
and the bundle's `@font-face` rules use those UUIDs as `url()`s. Nine woff2
faces: Instrument Sans and Instrument Serif, each latin and latin-ext, upright
and italic, plus Material Symbols Outlined at 339 kB.

Two of the nine are now `public/fonts/`, wired up in `src/index.css`:

| File | What | Size |
|---|---|---|
| `instrument-sans-latin.woff2` | Sans, latin, **variable wght 400–700** | 30 kB |
| `instrument-serif-latin.woff2` | Serif, latin, 400 | 21 kB |

- **Latin only.** Every non-ASCII character the app renders was checked against
  both subsets' cmaps: æ ø å Æ Ø Å, § · × é É, the dashes, curly quotes and
  ellipsis are all in latin. Nothing the app uses is in latin-ext. The
  geometric run (→ ▤ ◆ ◇ ◈ ◷ ✦) is in neither — Instrument does not draw those
  at all, so they fall back per glyph to the system font exactly as before.
- **One `@font-face` for 400–700**, because the Sans is variable across exactly
  that axis. The export declares it four times pointing at the same file.
- **Material Symbols not extracted.** Seven times the size of both text faces,
  to replace icons the app draws as characters.

### The members' screens (commit 2)
- `src/routes/Shell.tsx` — the `.ek-texture` ground on a full-width wrapper (it
  is "alle sider" in §03 and was on one), the drawn `LogoMark` in the app bar
  instead of the letters EK in a navy box, and trailing scroll room under
  `main` (see the range note below).
- `src/index.css` — `@keyframes ek-reveal` / `ek-bar`, the `[data-reveal]` and
  `[data-bar]` rules behind `prefers-reduced-motion: no-preference` **and**
  `@supports (animation-timeline: view())`, and `.ek-stick`.
- `src/components/SectionTitle.tsx` — the section label, which had been written
  out identically in eight places across three files.
- Reveals and the 16 px card radius across Hjem, Anciennitet, Nyheder, Møder,
  Regler and Økonomi; `data-bar` on Anciennitet's roster bars; serif display
  type where each screen has one line that carries it.
- 6 new tests in `src/theme.test.ts` (176 → 182).

### The contrast (commit 3)
`--color-faint` #6b7a93 → #63718a, `--color-present` #1f7a4d → #1a6b43. Both
light-mode only; dark passed throughout.

## Decisions

- ~~**CSS scroll-driven animation, no JavaScript.**~~ **Reversed by T067
  (2026-07-28).** The decision was: §05 Implementering suggests an
  IntersectionObserver at threshold 0.18 and the export itself does not use one
  — it ships `animation-timeline: view()` — so follow what the export does
  rather than what it says. Three things bought: Anciennitet's 3400 px of
  scroll stays free of a callback firing 29 times; no state where a reveal is
  armed and never fires; an old browser gets the finished page instead of a
  second code path. **The cost was that iOS before Safari 26 saw no motion on
  these screens at all** — complete and readable, just still. Recorded here as
  "the right thing to lose first", and Lukas should know it.

  He did, on 2026-07-28, and it was not the right thing to lose: *"the cool
  visuals on the other pages, and flip through, I cannot see anywhere. Neither
  on computer or phone. Note almost all EK members use iPhone."* The trade was
  made as though the affected browsers were a minority. They are the club.

  Two premises of it were also wrong on their own terms. The export **does** use
  an IntersectionObserver — its own script runs one at threshold 0.18 with
  `unobserve` after the first hit, for the count-up — so "what the export does"
  and "what it says" agreed all along. And IntersectionObserver is not a second
  code path: T067 removed the scroll-timeline rules entirely and has one.

  What was genuinely right, and is kept: a reveal must never strand content.
  T067 gets that from ordering rather than from a feature check — nothing is
  hidden until an observer is already watching that exact element, which is a
  behaviour and is therefore tested. See `src/lib/reveal.ts` and
  `design/README.md`.

- **`cover 12%`, not the export's `cover 26%`.** This is a bug the export
  cannot have and every one of these screens does. A scroll-linked animation
  only completes if the page can still scroll, and the last element on a page
  cannot: at full scroll Anciennitet's oldest meeting had 171 px of travel left
  against the 265 px that 26% asks for, and came to rest **permanently** at 72%
  opacity, 6 px low; Møder's last held meeting sat at 86%. The export is one
  long desktop page whose sections are never last. 12% is the largest value
  that still settles the smallest card these screens can end on, given the
  trailing space `main` now reserves.

- **Kept in `cover`, not switched to `entry`.** An entry range would also
  settle, but it is the element's own height — and the revealed elements here
  run 67 px to 578 px, so the statutes card would fade in over nine times the
  scroll distance the stat row does and would be half transparent while being
  read. A cover range is mostly viewport, so tall and short arrive alike.

- **Sticky labels are opaque, not blurred.** The export's bar is translucent
  with a 14 px backdrop blur. That blur is the most expensive thing in it and
  recomposites every scroll frame, and what it would reveal here is a 5%
  hairline texture. Anciennitet gets no sticky bar at all: 29 cards that each
  open with their own number, lead and date do not need one repeating a word.

- **No `will-change`.** It would promote 29 cards to their own compositor
  layers for the whole session to save a millisecond on one of them.

## Not done, deliberately
**§01's count-up** — "Nøgletal tæller op i 900 ms med easeOutExpo". Counting a
number up means rewriting text every frame, which is what §01's own rule about
`opacity` and `transform` exists to prevent, and it was an explicit constraint
on this task. Two rules in the system disagree and the conflict is Lukas's to
settle, not something to resolve by half-doing it. Recorded in
`design/README.md`.

**Done in T067, and the conflict turned out not to exist.** §01's rule is about
which *CSS properties* may be animated — those two composite and height/top/
margin do not — and the export's own script counts its figures by writing
`textContent`. The rule was being applied to something it does not describe.

## Evidence
jsdom has no layout and no scroll, so none of this can be proven by the test
suite — it is asserted there as stylesheet text, and measured in Chromium at
420 × 900 in both themes.

- **The fonts render.** Chrome's `CSS.getPlatformFontsForNode` names
  `Instrument Sans` and `Instrument Serif` as the faces it painted the headings
  with, in the served build and in the one-file demo. A width probe separates
  the real face from the fallback (596.45 px vs 655.78 px for the same string),
  and 400 vs 700 differ, so the variable axis is live.
- **Nothing is stranded.** Every `[data-reveal]` and `[data-bar]` on all six
  screens is at opacity 1 with no transform after scrolling to the bottom, and
  at rest at the top under `prefers-reduced-motion: reduce`.
- **Scroll cost on Anciennitet.** Top to bottom over 3 s under CPU throttling,
  against `main`: identical at 6×, 10× and 15× — 60 fps, p50 16.7 ms, p95
  16.7–16.8 ms, no long tasks either side. It parts company at 20× (41 fps, p95
  33.4 ms), which is far below any phone in use.
- **Contrast.** Every element carrying text, on six screens, in both themes,
  with each background layer composited on a canvas — Tailwind's `/20` and
  `/40` variants compute to `oklab()`, and reading those as rgb is what made
  the pips look like they passed when they did not. Zero failures now.

## Found, not fixed
`npm run build:demo` produced a bundle whose fonts 404. `public/fonts` is a
path only a web server can answer and the standalone file has no server, so it
fell straight back to Georgia — the exact state the fonts were extracted to
end. Fixed here in `scripts/build-demo.mjs` (inlined as data URIs, 910 kB →
976 kB) because leaving it would have shipped the demo in the wrong typefaces,
but it is build tooling rather than the presentation pass this task was scoped
to.
