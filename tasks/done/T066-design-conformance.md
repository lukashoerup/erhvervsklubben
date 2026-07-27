# Task: T066 the icons, and a conformance sweep of every screen (phase 7)

T064 put the design system on the six members' screens. This closes what it
left: the icon set it skipped, the screens built after it, and a section-by-
section pass over all eight screens now that every one of them exists.

## What was built

### The icons (commit 1)
`design/erhvervsklubben-designsystem-v2.html` §03 lists ten icons under
"IKONER · 24 PX LINJE, ALTID MED TEKST", each with a Danish word beside it. Five
of them name the very destinations this app has. The app drew those destinations
as geometric characters — `◆ ▤ ◷ ✦ § ◈` in `routes.ts`, `→` between a meeting's
venues and in the Klubkassen link, `◇` for a map pin and for a list bullet — and
neither Instrument subset contains one of them. Every icon in the app therefore
fell back per glyph to whatever the device had.

| File | What | Size |
|---|---|---|
| `public/fonts/material-symbols-subset.woff2` | Material Symbols Outlined Light, nine glyphs | **1072 B** |

- **339 kB → 1072 bytes**, and the ligature table is nearly all of the
  difference: 4267 entries whose only job is mapping the word `home` to its
  glyph. `src/components/Icon.tsx` addresses the icons by codepoint, so the
  table goes with the subset.
- **Inline SVG was weighed and lost.** The same nine outlines are 3869
  characters of path data, 1432 bytes gzipped *before* any wrapper markup, and
  they would ride in the JavaScript bundle rather than in a file the browser
  fetches once and reuses on every screen.
- **`font-display: block`**, where the two text faces `swap`. swap exists so the
  club's words stay readable while a typeface arrives; there are no words here,
  and what a fallback paints for a Private Use Area codepoint is a tofu box.
- `scripts/build-demo.mjs` needed no change — its `url(/fonts/…)` rewrite is
  general — but it was checked rather than assumed: the demo now inlines three
  woff2 as data URIs and 984 kB, and no `/fonts/` URL survives.

### The sweep (commit 2)
Measured in a browser at 420 × 900 and 1280, both themes, signed out / member /
admin, across `/`, `/login`, `/hjem`, `/anciennitet`, `/moeder`, `/nyheder`,
`/regler`, `/oekonomi` — twelve page-loads per theme.

- **`/login` was the biggest hole, and it is one because it sits outside the
  Shell.** T064 swept "the members' screens" and this is not one of them, so it
  kept: no `.ek-texture` (§03 says "Alle sider"); the letters EK in a hard-edged
  navy box, which is the exact lockup T064 replaced in the app bar (§02: the
  vector is the mark); a `bg-accent` submit button measuring **3.23:1** with
  white on the dark ground; and 46 px fields under a 48 px floor. All four
  fixed.
- **`/regler`'s fifteen statute rows were 32 px.** They are the entire
  interaction on that page — every statute is behind one — and a `<summary>`
  reads as a heading in the source, which is how T062's tap-target sweep walked
  past them.
- **`/oekonomi`'s meeting picker was 35 px.**
- **The button radius was four values for one token** — `rounded-lg` in most
  places, `rounded-[9px]` in the landing header, `rounded-[10px]` in the hero,
  a bare `rounded` on two small controls. §03 says "Knap 10". It is now
  `--radius-btn` in the theme seam, so the next control inherits the decision.
- **The landing page had no scroll reveal.** T064 was scoped to the members'
  screens; §01 is not. Four sections and nine cards on the longest public scroll
  in the app, arriving all at once under a hero that spends four seconds
  introducing itself. `data-reveal` on each card and each section header, which
  is what the export itself does.

### T065's screens, verified rather than trusted
The meeting editor, the roster ticker and the delete confirmation shipped after
the design pass. Measured against §03 they hold: every one of the 20 controls at
48 px, 16 px card radius on the card surface, no horizontal overflow at 420, and
zero contrast failures with the editor open and with the delete confirmation
open, in both themes. Two things that look like gaps and are not:

- **The editor form has no `data-reveal`, and should not.** It is not content
  coming into view, it is a thing the admin just summoned, and it appears under
  the thumb. A scroll-linked reveal on it would be motion for decoration, which
  §01 forbids by name — "aldrig for at pynte". The same is true of every admin
  form and of "Registrér møde".
- **No `SectionTitle` on it.** The system contains no form anywhere, so there is
  nothing to conform to; the app's forms follow the card idiom, which is the
  nearest thing §03 does specify, and they match it. `/anciennitet` carries no
  section labels at all, for T064's stated reason.

## Decisions

- **Codepoints, not ligatures.** Writing `home` as text and letting the font
  substitute is the documented way to use Material Symbols, and it is what makes
  the file 339 kB. The cost of the codepoint is that the source shows an
  invisible character, which is why `Icon.tsx` writes `'\ue88a'` as an escape
  rather than pasting the glyph — an invisible constant is one an editor
  normalises away without anyone seeing.
- **The one `◇` that was not an icon is drawn in CSS.** The finance card's empty
  state used it as a list bullet. §03's set is ten named jobs and "item in a
  list" is not one of them; borrowing a pin or a gavel to mean nothing would be
  worse than the character was. A rotated 6 px square is the same blue lozenge
  with nothing left to fall back from.
- **`arrow_right_alt` between a meeting's venues.** §04's own Anciennitet mock
  writes that step as a literal `→`, so the app was not diverging from the
  system — it was sharing the system's problem, since Instrument draws no arrow
  in either subset. Having shipped a subset anyway, one more glyph makes the
  club's evening render the same on every phone.
- **The demo bar's role switch is left at 21.6 px.** It is the one tap target
  under the floor and it is scaffolding, not a members' screen. It cannot simply
  grow: its height is published to the shell as `--demo-bar` and the app's
  full-height layout is measured against it, so this is a change to the demo bar
  rather than to a button, and it belongs with the demo rather than with the
  design pass.

## Not done, and it is the biggest thing left
**The members' type scale sits one notch below §04's own phone mocks** — 8–25 %
smaller at every level, and the mocks are 360 px wide where the app is measured
at 420, so it is not about room. The table is in `design/README.md`; the worst
of it is the attendance initials at 8.8 px against the system's 11 px.

Raising it re-flows six screens, changes Anciennitet's height and therefore the
`cover 12%` reveal range that was tuned against it, and the 24 px pips cannot
hold 11 px initials without growing — ten to a card, twenty-nine cards. That is
a real piece of work with a real risk of regressing the one page that has to
stay cheap, and it wants Lukas looking at a before and an after. Doing it
half-way would be worse than not doing it.

**There is no desktop layout either.** §04 draws a 1180 px, 12-column desktop
and §05 asks for "topnav fra 1024 px"; at 1280 px the members' screens are the
512 px phone column centred in the window with the bottom tab bar still sticky.
That is a section of the system the app has never attempted, not something this
pass broke, and building it is a task. The landing page already goes wide.

Also still open, both carried over from T064 and both re-read before being left
alone: §01's count-up on the figures, and no motion on iOS before Safari 26.

## Evidence
jsdom has no layout, no scroll and no fonts, so none of the below can be proven
by the suite — it is asserted there as stylesheet text and codepoint ranges, and
measured in Chromium at 420 × 900, both themes.

- **The icons render from the shipped file.** Chrome's
  `CSS.getPlatformFontsForNode` names `Material Symbols Outlined Light [custom]`
  for all nine glyphs, for both ends of the tab bar, for the Klubkassen cue and
  for the route arrow. Two controls make that answer mean something: a latin `A`
  in the same class comes back `Liberation Serif`, and a PUA codepoint the
  subset deliberately omits comes back as this font's own `.notdef` — so the
  method both can and does say no. Over real HTTP the response is
  `200 material-symbols-subset.woff2 1072`; in the one-file demo it is a data
  URI and there is no request at all. A tree walk finds no `◆ ▤ ✦ ◈ ◇ ◷ →`
  anywhere in the rendered app.
- **Zero contrast failures** on all eight screens, both themes, signed out /
  member / admin, with every background layer composited on a canvas. It was one
  before: `/login`'s submit at 3.23:1.
- **Every tap target in the app is at or above 44 px**; the only two under it
  are the demo build's own role switch.
- **No horizontal scroll** at 420 px on any screen or state, and no page paints
  a fourth surface.
- **Nothing stranded.** Every `[data-reveal]` and `[data-bar]` on all seven
  scrolling screens — including the landing page's nine new ones — is at opacity
  1 with no transform after scrolling to the bottom, in both themes.
- **Reveals behave at every viewport tried** — 420 × 900, 1280 × 900 and
  1280 × 1400. Nothing in view is transparent except an element genuinely
  mid-entry at the bottom edge, and nothing is stranded at the bottom. Worth
  knowing when reading a `fullPage` screenshot of these screens: Chromium
  resizes the viewport to the whole document to take one, which re-evaluates
  `animation-timeline: view()` against a 4000 px viewport and can leave distant
  cards at opacity 0 in the *image*. It is an artefact of the capture, not
  something a reader ever sees.
- **Scroll cost, measured rather than assumed**, against the commit before the
  sweep, on the same machine in the same session, four runs each. Anciennitet as
  an admin (5788 px): 10× CPU throttle 59–60 fps before, 58–60 after, p50 16.7
  and p95 16.8 on both; 15× 53–59 before, 47–58 after, p50 16.7 on both. The
  spread at 15× is the machine, not the change — the baseline swings as widely.
  The landing page, where nine reveals were added: 60 fps before, 58–60 after,
  p95 16.8 either way. Anciennitet's height is unchanged to the pixel.
