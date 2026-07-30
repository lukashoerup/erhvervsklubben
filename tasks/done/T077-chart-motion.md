# Task: T077 the finance card, read on a phone (phase 7)

Three things, all from Lukas looking at `/oekonomi` on his own iPhone on
2026-07-30. He is the treasurer, so his screen carries the Klubkassen card above
everything else — which is part of why the second one bit him and not us.

## 1. The motion was wrong, and his diagnosis was right

> "Motion fungerer heller ikke helt optimalt på grafen. Ideelt så skulle den
> ligesom komme frem som om at den blev tegnet frem fra bunden. Nu kommer den ind
> sådan i stykker (en linje ad gangen), hvilket får det til at se lidt ud som om
> at den blot loader langsomt."

T073 drew each curve on its own `stroke-dashoffset`, settled the band at 620 ms,
the end dots at 780 and the dashed forecast at 900. **Five marks arriving one
after another is what a slow page load looks like**, whatever the easing on each
one. That is a design mistake rather than a bug, and no amount of retuning the
five delays would have fixed it — the queue itself was the thing being seen.

One gesture now. `.ek-sweep` is the rect of a `clipPath` over the plot, scaled
from `scaleY(0)` at the baseline to full, so both curves, the band, the end dots,
the dashed forecast, the gridlines and both axes are uncovered together by a
single moving edge. One animation, one duration, one easing.

**900 ms and `.16 1 .3 1`, unchanged**, because the pairing Lukas liked in T073 —
the three figures beside the plot landing in the same instant as the gesture — is
the thing that makes the card feel composed, and both halves of it are already on
§01's count-up timing. Measured in Chromium: the sweep reaches full at +900 ms
from `in`, the figures land at +927.

### What came out with it

`--ek-len`, `getTotalLength()`, `measure()`, `measureCurves()`, the four staggered
`[data-draw]` rules, the `ek-draw` and `ek-fade-in` keyframes, and the
`.ek-curve` / `.ek-band` / `.ek-forecast` hooks on the recharts series. Nothing
selects them any more; a hook left behind is the next reader's wrong guess about
where the motion lives.

**And the second sanctioned exception to §01's "kun opacity og transform".**
Scaling a clip rect is a transform, so the gesture needs no exception —
`src/theme.test.ts` now asserts one sanctioned property rather than two. It was
withdrawn rather than left standing over nothing: a stale exception is a licence
the next pass finds already granted.

## 2. The chart goes above the budget

> "Jeg synes at grafen skal være over 'forventet bøder budget' teksten, da man så
> vil kunne se den på skærmen når man logger ind."

Measured before and after at 420 × 900, signed in as the treasurer, with the
bottom tab bar's own floor at y 841:

| | before | after |
|---|---|---|
| plot top / bottom | 651 / 861 | **413 / 623** |
| of its 210 px above the tab bar | 189 | **210** |
| scroll needed to clear the bar | 21 px | **0** |

And at the viewport an iPhone 14 actually gives Safari (390 × 664, tab bar floor
at 605), which is the screen he was holding:

| | before | after |
|---|---|---|
| of its 210 px on screen | **0** | **191** |
| scroll needed | **292 px** | 19 px |

The `Forventede bøder · budget` block is 222 px of heading, figure, paragraph and
three bullets, and with it above the plot there was no phone viewport on which
any of the chart was visible on arrival. **The chart is what this card is; the
budget is a note about it.** `FinanceChart.test.tsx` asserts the document order,
which is the part jsdom can know and the part that decides it.

## 3. The font glitch, and what actually caused it

> The line "314 kr. pr. møde — 114 kr. pr. måned i gennemsnit, frem til juni
> 2027." rendered with its first glyph in a different face from the rest — "314"
> as a serif 3 followed by a sans 14.

Not a fallback and not the count-up. Chromium's `CSS.getPlatformFontsForNode`
reports every glyph in that span drawn from Instrument Serif, one font, no
substitution. The cause is the face itself, and the register rule that let it be
used here.

**Instrument Serif has one figure set and it is an old-style one.** Its `3` drops
below the baseline; its `1` is a bare stem with no flag and no foot serifs, so
"111" renders as "lll"; and its digits are proportional — at 16.8 px, `3` `1` `4`
advance **6.06, 4.03 and 6.44 px**, where Instrument Sans gives a flat 10.08.
There is no `tnum` in the face to switch out of any of it, so `.ek-figure`'s own
`font-variant-numeric: tabular-nums` has been claiming fixed-width digits it does
not get from the serif.

At 26–52 px leading a card those shapes *are* the register, and they are what
Lukas approved in T072. At 16.8 px inline in a 14 px sans sentence they are three
digits at three widths on two baselines, three pixels bigger than the prose
around them — and a reader does not see a display register, he sees the wrong font
applied to part of a line.

**The register rule never covered this case.** `.ek-figure` in `index.css` draws
the line at "the figure that leads a block is serif; a figure in a tile with its
label beneath it stays Sans 700", with a floor at ~14 px. A number in the middle
of a running sentence is neither, and the floor let it through. It stays in the
sentence's own face now and leads on **weight** — §03's "tal i 700", and the idiom
the chart's own hover readout already used.

### The test that would have caught it

`FinanceChart.test.tsx`: **no `.ek-figure` may have prose beside it in its own
line box.** Asserted as the shape of the rule rather than as a size — a text node
with letters in it beside the figure fails; sibling *elements* are fine, which is
what the legend's `dt`/`dd` and Regler's rail are. It fails on the old markup and
passes on the new one, and it will catch the next figure dropped into a sentence
anywhere on this card.

## Decisions

- **The clip is what makes the band honest, and that is why the stagger could
  go.** T073's objection was real: two curves drawn by dash-offset are genuinely
  incomplete while they draw, so the gap between them is a shortfall that grows
  while you watch, and the card exists to report that gap. A clip never shows an
  unfinished shape — every frame of the sweep is a horizontal slice of the
  finished chart. The band arrives with everything else because the reason it
  could not has been removed rather than overruled.
- **The guarantee is an ordering again**, which is the stronger form and the one
  T073 could not have. It measured paths recharts inserts some frames after React
  commits the card, too late for `arm()`'s observe-then-hide to reach, so it
  bought safety from CSS fallbacks. Nothing is measured now: the only rule that
  clips anything is scoped to `[data-draw='armed']`, which `lib/reveal.ts` sets
  after `observe()` has returned on that element.
- **The stagger does not reach the sweep, and that is load-bearing.** `show()`
  writes §01's 60 ms-per-element delay onto the element it fires; `data-draw`
  animates a *descendant*, and `animation-delay` does not inherit. So the plot
  takes no stagger — and neither does the count-up, which `show()` starts
  directly. That is what makes the two finish together. Measured: the plot's
  inline `animation-delay` is `300ms` and inert. Pushed down onto `.ek-sweep` it
  would put the gesture up to 360 ms behind the numbers it is the readout of, so
  there is now a note beside the line that writes it.
- **The clip's host `<svg>` carries `viewBox="0 0 1 1"`, for WebKit.**
  `.ek-sweep` pivots on `transform-box: fill-box`; a browser that ignores that
  property falls back to `view-box`, and against a 0 × 0 viewport the pivot lands
  on the origin and the chart sweeps *down from the top*. With the viewBox
  declared, `transform-origin: bottom` is 50% 100% of either box and both paths
  resolve to the bottom of the plot. One attribute, and the one failure mode that
  was not benign is no longer cheap to reach.
- **Recharts' own animation stays off**, as it has since the chart was built. A
  second easing curve and a second duration beside the system's is what
  `isAnimationActive={false}` has always been there to prevent.

## Evidence

Chromium 1194 at 420 × 900, both themes, demo build served by `vite preview`.

- **Frames through the sweep**, five per theme, each taken when the edge had
  actually reached the height it is labelled with rather than at a guessed
  timestamp. The CSS clock is slowed 20× with CDP `Animation.setPlaybackRate`;
  `performance.now()` and reveal.ts's one 1100 ms `setTimeout` are scaled to
  match, or half the app runs on a different clock from the gesture and the state
  retires a fifth of the way through it. At the edge's 20 / 50 / 80 %, the
  figures read 21 / 50 / 80 % of their targets — the pairing, visible in stills.
- **The sweep and the figures land together**: full at +900 ms from `in`, figures
  at +927 (light) and +930 (dark), over 242 sampled frames each.
- **Scroll offsets** before and after, both roles, two viewports — the tables
  above.
- **The guarantee, in a browser.** With `observe()` throwing, and with no
  `IntersectionObserver` at all: `data-draw` never armed, `clip-path: none`, all
  five paths at full opacity, the three figures reading the club's real totals.
  An observer that observes but never reports still holds the plot armed — that
  is the same contract every `[data-reveal]` card on every screen has had since
  T067 and is not something this pass changed.
- **Reduced motion**: `clip-path: none`, no transform on the sweep, figures at
  their final values, nothing armed anywhere on the page, both themes.
- **Nothing stranded**: after walking all six members' screens top to bottom in
  both themes, no `[data-reveal]`, `[data-bar]` or `[data-draw]` under full
  opacity and no plot left clipped. No horizontal scroll at 420 px anywhere.
- **The font glitch, per glyph**, via CDP `CSS.getPlatformFontsForNode` and
  per-character `Range` widths — the numbers in §3 above.
- **Suite**: 334 tests, 28 files, green. `npm run build` and `npm run lint`
  green. Four tests added on the chart, two removed with the machinery they
  measured, one replaced in `theme.test.ts` by two.

## Not verified

**WebKit, again.** `npx playwright install webkit` fails from this environment:
`playwright.download.prss.microsoft.com` answers 403, "request rejected: host not
permitted". That is an egress policy denial, not a transient failure, so it was
reported rather than retried. What it leaves unproven is one property —
`transform-box: fill-box` — and the `viewBox` above is there so that the failure
mode is the right gesture rather than an upside-down one. **It wants Lukas's eye
on a phone.**

**Whether it now reads as drawing rather than loading.** The frames say the
gesture is right: one edge, bottom to top, everything at once. What the stills
cannot settle is the curve. `.16 1 .3 1` is heavily front-loaded — 76 % of the
sweep happens in the first 200 ms and the last 5 % takes the remaining 700 —
which on a wipe reads as *quick, then settling* rather than as an even draw. That
is the system's own curve and §01 asks for it by name, so it was kept and not
tuned on a session's judgement. If Lukas says it still snaps, the honest next move
is the duration split, not another mechanism.
