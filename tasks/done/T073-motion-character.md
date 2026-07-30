# Task: T073 motion and character on the members' screens (phase 7)

## Lukas's reading of T072 (2026-07-29)
> "Synes ikke rigtig at jeg kan se den store forskel på farverne … de cards der
> er på møde og nyheder siderne er stadig lidt kedelige. Altså man kunne måske
> lave et eller andet der?"

And the one thing he liked: *"Den nye skrifttype på tallene er pæn."*

T072's diagnosis was wrong. He was not asking for hierarchy. He was asking for
the members' screens to feel like the landing page's logo intro, which he calls
*"genial"* — for **character**, not for tidier. Three things he asked for by
name, all of them already in §01 Bevægelse.

## What was built

### 1. The finance curves draw themselves in
> "Det kunne også være fedt med noget motion på finansgrafen. Så linjerne sådan
> kommer frem, når man åbner siden."

> **Superseded by T077 (2026-07-30).** The mechanism below — a dash-offset draw
> per path, then the band, the dots and the forecast in a queue — is gone. Lukas,
> on seeing it: *"Nu kommer den ind sådan i stykker (en linje ad gangen), hvilket
> får det til at se lidt ud som om at den blot loader langsomt."* He is right, and
> the diagnosis is the sequencing rather than the easing: five marks arriving one
> after another is what a slow page load looks like. The plot is now uncovered by
> one clipped edge travelling up from the baseline (`.ek-sweep`), in one duration
> on one curve. `--ek-len`, `getTotalLength()`, the four staggered delays and the
> `stroke-dashoffset` exception are all removed. **What survives from this section
> is the timing** — 900 ms on `.16 1 .3 1`, and the three figures landing with the
> gesture, which Lukas liked and which T077 kept exactly.

900 ms on `.16 1 .3 1` — the timing §01 gives the count-up and the bars, not the
700 ms it gives a card, because a drawn line is one quantity being read out
rather than an element arriving. `data-draw` sits on the plot rather than on the
card, so the gesture starts when the plot is 18 % in view and not while it is
still below the fold.

Recharts' own animation is not used and was not turned back on: every series has
carried `isAnimationActive={false}` since the chart was built, and re-enabling it
puts a second easing curve and a second duration beside the system's.
`lib/reveal.ts` measures each path with `getTotalLength()`, writes `--ek-len` on
it, and four rules in `index.css` do the rest.

**The band settles after the curves and does not draw with them.** It is not a
third series — it is the distance between the two lines, which is the one number
the card exists to report. Drawn alongside them it reads as a third thing
arriving on its own account, and for 900 ms it would be showing the gap between
two curves that are not finished: a shortfall that grows while you watch, which
is not what the club's books did. Lines first, gap filled in behind them at
620 ms, end dots at 780 ms with the lines that reach them, dashed forecast last
at 900 ms — the only mark on the chart that has not happened yet. All four of
those are opacity.

> **T077: the objection was right and the answer was wrong.** A dash-offset draw
> does show the gap between two unfinished curves, so this argument held against
> *that* mechanism. A clip never shows an unfinished shape — every frame of the
> sweep is a horizontal slice of the finished chart, and nothing on it is a value
> on its way somewhere. The band arrives with everything else because the reason it
> could not has been removed, not overruled.

### 2. More motion on the numbers
> "Og lidt mere motion på tallene."

The count-up itself has existed since T067 (T064 and T066 skipped it; `design/
README.md` has carried it as done since). What T073 added is Økonomi's three
chart figures, which the same document had recorded as deliberately out.

**The exclusion's reasoning is what makes them the exception.** It argues
against a *bank balance* that spins up to its value — decoration on the one page
whose whole job is to be exact — and **Klubkassen still does not move**. These
three are the readout of the curve directly below them; they count over the same
900 ms it takes to draw, so the line and the number it resolves to finish
together. Nothing was added to `/anciennitet`, which already starts ten at once
and is the page that has to stay cheap.

### 3. Nyheder and Møder have a face
The date left the top of the card and became it: a **26 px serif day numeral**
in a rail, month beneath, hairline down its side (`components/DateRail.tsx`).
That is the register Lukas already approved and the idiom `/anciennitet` uses as
its face and `/regler` got as its §-rail in T072 — a third screen sharing it
rather than a third invention. The rail's hairline is the only drawn thing on
these two pages: it grows downwards 120 ms behind its card, which is exactly the
gesture `/anciennitet` measured and could not afford at 29 cards.

Two things came out of the data rather than out of decoration:

- **News items are signed.** `author` is `not null`, every row carries a real
  name, the form has always written it, and nothing read it back — the note in
  `Nyheder.tsx` called what to do with it "a design question for another day".
- **A meeting's venue has its own row**, with §03's `place` pin in the accent
  (§04 draws that icon blue by name).

The year on the rail appears only when it is not the current one — the trap
`lib/dates.ts` documents, said the other way round.

## Decisions

- **stroke-dashoffset is the second sanctioned exception to §01's "kun opacity
  og transform"**, beside the wordmark's letter-spacing, and for the same
  reason: a line drawing itself cannot be said with either. The rule is about
  what composites — height, top and margin reflow and these do not — and this is
  two paths inside one SVG layer on one screen, none of them in a list.
  `theme.test.ts` asserts the exception by name so a third cannot arrive
  quietly.
  > **Withdrawn by T077.** Scaling a clip rect is a transform, so the gesture
  > needs no exception at all — and `theme.test.ts` now asserts one sanctioned
  > property rather than two. The exception was removed rather than left standing
  > over nothing: a stale exception is a licence the next pass finds granted.
- **The draw's guarantee is a fallback, not an ordering.** `arm()`'s
  observe-then-hide cannot cover these paths: recharts inserts them some frames
  after React commits the card. Every rule that hides a curve names a default
  instead — `stroke-dasharray: none`, `stroke-dashoffset: 0`, a complete line —
  and `theme.test.ts` fails if one ever uses `--ek-len` without one.
  > **T077 got the ordering back**, which is the stronger form. Nothing per-path
  > is measured any more, so the only rule that clips the plot is scoped to
  > `[data-draw='armed']` — set after `observe()` returned on that element.
- **The venue row is where the map goes, and that is the whole of the room left
  for it.** Lukas: *"Derudover skal vi have et kort, som viser alle steder vi
  har været implementeret på længere sigt."* Before this the venue was one muted
  12 px line among three, indistinguishable from a description. It is now a
  single self-contained row with its own icon and the full width of the card, so
  a link, a chip, a distance or a row of markers can arrive there without the
  card being rebuilt around it. **No map dependency was added; none is
  approved.**
- **The status of a meeting is said by the rail, not by a chip.** Blue hairline
  while it is ahead, the ordinary line once it has been held. §01 calls that
  mark "én blå streg som signatur"; used as an index down the left of the
  calendar it says which half of the page you are in without adding a word, and
  the next meeting keeps its 1.5 px blue border as the live-row mark.
- **The day numeral drops da-DK's ordinal full stop.** "9." is grammar in a
  sentence; in a rail with the month under it, it is a mark hanging off a 26 px
  numeral, and it pushed "20." wider than the rail.

## Found and fixed
**The count-up could print negative money.** `from` is `performance.now()` at
the moment the observer fires; `now` is the rAF timestamp, which is the frame's
time and need not be later than a reading taken inside that frame. Unclamped, a
millisecond of that turns easeOutExpo's `1 − 2^(−10p)` into a large negative
multiplier — the club's balance rendering as **"-24.643 kr."** for one frame.
Surfaced by instrumenting `/oekonomi` (the figures were the first money to
count), clamped at both ends, and `reveal.test.ts` now drives a frame backwards
to prove it.

## Evidence
Chromium at 420 × 900, both themes, signed out / member / admin, on all eight
screens — the same sweep T066 and T072 used, same machine, same session.

- **Contrast: zero failing pairs.** Every background layer composited and every
  colour resolved through a 1 × 1 canvas, which is what T064 and T072 were both
  caught by and what `design/README.md` warns about.
- **Tap targets**: the only element under 44 px is the demo build's own role
  switch at 21.6 px, unchanged and documented since T066.
- **No horizontal scroll** at 420 px on any screen, either theme.
- **Nothing stranded**: after walking every screen top to bottom in both themes,
  no `[data-reveal]`, `[data-bar]` or `[data-draw]` is left under full opacity
  and no curve is left short of its own length.
- **Scroll cost on `/anciennitet`**, four runs each, top to bottom over 3 s,
  against a build of `main` on the same machine minutes apart: 10× CPU throttle
  **23–27 fps before, 20–27 after**; 15× **10–13 before, 13–14 after**.
  Unchanged within run-to-run noise, in both directions. The page is untouched
  by this pass; what was being checked is `scan()`'s added
  `querySelectorAll('.ek-curve path')` per mutation, and it does not show.
- **The count-up and the draw, sampled per frame** on `/oekonomi`: figures step
  6.210 → 2.265 → 4.385 → … → 6.210 kr. and dash offsets 145 px → 0 over
  ~900 ms, landing exactly on the string React rendered.
  > T077 re-measured the pairing against the sweep: full at +900 ms from `in`,
  > figures landing at +927. Still together, and for a reason worth knowing —
  > `show()` writes §01's stagger onto the element it fires, and `data-draw`
  > animates a descendant, so neither the plot nor the count-up takes one.
  > `lib/reveal.ts` says so beside the line that writes it.
- **Reduced motion**: figures at their final value, curves at full length, no
  element ever armed. Asserted in `reveal.test.ts` and in the sweep, which runs
  with `reducedMotion: 'reduce'`.

## Not verified
**WebKit.** The Playwright WebKit build is not installed in this image and
`npx playwright install webkit` fails to download from this environment, so
every measurement above is Chromium. What that leaves unproven is narrow:
`var()` substituted inside a `@keyframes` block, which is what carries
`--ek-len` into the draw. Its failure mode is benign in the direction that
matters — an unresolvable `var()` makes `stroke-dashoffset` invalid, the
animation's from-value falls back to the computed value, and the curve appears
whole with no draw. *(T077: still unavailable — the download host answers 403,
"host not permitted", by egress policy. What is unproven there is now
`transform-box: fill-box`; see `design/README.md`.)* Everything else here (`getTotalLength`, custom properties
set on an element, dash animation on an SVG path, `IntersectionObserver`) has
been in iOS Safari for a decade. **It wants Lukas's eye on a phone.**
