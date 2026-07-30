# The design system

`erhvervsklubben-designsystem-v2.html` is the Claude Design export for
Erhvervsklubben, exported by Lukas on 2026-07-27 and committed here on purpose.

**It is committed because sessions could not otherwise reach it.** Four attempts
across 2026-07-27 failed: the `claude.ai/design` share link needs Lukas's
browser login and answers 403 to anything else, and `DesignSync` needs an
interactive authorisation a cloud session cannot perform. A design nobody can
open is not a design system. In the repo it is one `git clone` away, forever.

Open it in a browser to see it. It is a self-contained bundle — every asset,
font and script inlined — so it needs no network and no build step.

## What the app takes from it

| | |
|---|---|
| Display / headings | **Instrument Serif** |
| Body / UI | **Instrument Sans** |
| Icons | **Material Symbols Outlined** |

Palette, most-used first — these are the values in `src/index.css`:

| Hex | Role |
|---|---|
| `#2563eb` | primary blue — the accent everything leans on |
| `#0a1120` | near-black navy — ink on light, ground on dark |
| `#94a3b8` | slate — faint text |
| `#e2e8f2` | hairline borders on light |
| `#5a6b85` | muted body text |
| `#edf1f8` `#f4f7fc` `#f7f9fd` `#f9fbfe` | the near-white ground ramp |
| `#16233f` `#1b2740` | navy surfaces on dark |
| `#3b72e8` `#5b8def` `#7fa8f4` `#c3d5f6` `#d6e0f0` | the blue ramp |
| `#1f7a4d` on `#e7f3ec` | present / success |
| `#b4453c` on `#fdecec` | absent / error |

## The fonts, and where they came from

Extracted 2026-07-27 (T064). The bundle carries an asset map keyed by UUID —
`{"<uuid>": {"mime": "font/woff2", "compressed": false, "data": "<base64>"}}` —
and its `@font-face` rules use those UUIDs as `url()`s. Nine woff2 faces are in
there: Instrument Sans and Instrument Serif, each as latin and latin-ext,
upright and italic, plus Material Symbols Outlined.

Three of the nine are in the app, under `public/fonts/`:

| File | From | Size |
|---|---|---|
| `instrument-sans-latin.woff2` | Sans, latin, variable wght 400–700 | 30 kB |
| `instrument-serif-latin.woff2` | Serif, latin, 400 | 21 kB |
| `material-symbols-subset.woff2` | Material Symbols Outlined Light, **nine glyphs** | 1072 B |

**Latin only**, because no character this app renders is in latin-ext — every
letter, every æ ø å, and § · × é are all in the latin subset. **Upright only**,
because nothing in the app is italic.

They are self-hosted because they have to be: the export preconnects to
fonts.gstatic.com, and the app has no CDN access. A Google Fonts link does not
error — it just leaves the page in Georgia. `src/theme.test.ts` fails if one is
ever added back.

## The icons, and how the 339 kB became 1 kB

T064 left Material Symbols out: whole, it is seven times both text faces
together. T066 subset it instead, and the app's icons stopped being geometric
characters (◆ ▤ ✦ § ◈ ◇ ◷ →) that Instrument does not draw and that therefore
rendered differently on every phone.

Almost all of the 339 kB is the **ligature table** — 4267 entries mapping the
word `home` to its glyph. The app addresses the icons by codepoint instead
(`src/components/Icon.tsx`), so that table goes entirely, and what is left is
nine outlines: **1072 bytes**. Inline SVG was weighed against it and lost — the
same nine paths are 3869 characters, 1432 bytes gzipped before any wrapper, and
they would sit in the JavaScript bundle rather than in a file cached once.

The nine, named as §03 names them:

| Icon | U+ | Where |
|---|---|---|
| `home` | E88A | tab · Hjem |
| `bar_chart` | E26B | tab · Anciennitet |
| `calendar_month` | EBCC | tab · Møder; the "indkaldes" chip on `/` |
| `article` | EF42 | tab · Nyheder |
| `gavel` | E90E | tab · Regler |
| `savings` | E2EB | tab · Økonomi (§03 calls it "Bødekasse") |
| `place` | E55F | the venue chip on `/hjem` and `/` |
| `north_east` | F1E1 | §03 calls it "Link" — the Klubkassen cue on `/hjem` |
| `arrow_right_alt` | E941 | between a meeting's venues on `/anciennitet` |

To re-cut it — which is required the moment a tenth icon is used, or the glyph
renders blank — decode asset `89888ec1-3c68-43ef-861c-719978d8366f` out of the
bundle's map and subset it by codepoint with fontTools:

```python
from fontTools import subset
o = subset.Options()
o.layout_features, o.hinting, o.glyph_names, o.notdef_outline = [], False, False, False
o.drop_tables += ['STAT', 'gasp', 'GSUB', 'GPOS', 'DSIG']
o.name_IDs, o.name_legacy = [1, 2, 3, 5, 6, 16, 17], False
f = subset.load_font(SRC, o)
s = subset.Subsetter(options=o); s.populate(unicodes=CODEPOINTS); s.subset(f)
o.flavor = 'woff2'; subset.save_font(f, 'public/fonts/material-symbols-subset.woff2', o)
```

fontTools is not a project dependency and is not being made one — this is a
one-off that produces a committed artefact, like the extraction above it.

## The hierarchy, and what the accent is allowed to mean

T072, 2026-07-29, on Lukas's reading of the six members' screens: *"Det er lidt
ensartet med farverne, og tekststykkerne på nogle af siderne virker meget
voldsomme og store."* He was offered a smaller type scale and declined it.

The palette was not short of colours; the accent was doing four jobs at once.
Headings, figures, links and section labels were all `--color-accent`, on every
screen, which is why a page of six cards read as one texture. **Three registers
now, and each has one job:**

| Register | What it is for |
|---|---|
| **Instrument Serif, ink** | a figure that is the subject of its line, and the one display line a screen has |
| **Instrument Sans, ink** | headings and body — hierarchy from weight, size and space |
| **The accent** | what can be tapped or is a mark: buttons, links, the active tab, the streg, the chart's own curves and the icons §03 draws blue |

Nothing else is the accent. Section labels are muted with the club's signature
streg beside them — §04's desktop mock sets that very label in `#94A3B8`, so the
quiet version is the system's own, and §01's "én blå streg som signatur" is what
keeps the blue in the composition without spending it on text.

**Where the system disagrees with itself, and which side this took.** §03
TYPOGRAFI says "Instrument Sans 400/500/600/700 · **tal i 700**", and §04's stat
tiles do set their `data-count` figures in Sans 700. But §04's scroll-scene sets
the figure that *leads a panel* — "13.150 kr.", "86%" — in Instrument Serif, and
this app's landing page has done the same since T060. Two idioms for a number,
both the system's, and the app was using both without saying so. The line
between them is now named in `.ek-figure` (`src/index.css`): **the figure that
leads a block is serif; a figure in a tile with its label beneath it stays Sans
700.** Below ~14 px neither applies — Instrument Serif has one weight, so a
small serif figure has nothing to lean on — which is why Anciennitet's ten
roster counts (9.6 px) and every table cell are untouched.

**And a figure inside a running sentence stays Sans, whatever its size** — the
third case, added in T077 because the first two did not cover it and the ~14 px
floor let it through. Lukas, 2026-07-30, on the budget line: its first glyph came
from a different face than the rest, "314" as a serif 3 followed by a sans 14. It
did. **Instrument Serif has one figure set and it is an old-style one**: the `3`
drops below the baseline, the `1` is a bare stem with no flag and no foot serifs —
"111" renders as "lll" — and the digits are proportional. Measured in Chromium at
16.8 px, `3` `1` `4` advance **6.06, 4.03 and 6.44 px**, where Instrument Sans
gives a flat 10.08. The face carries no `tnum`, so `.ek-figure`'s own
`font-variant-numeric: tabular-nums` cannot switch out of any of it — the class has
been claiming fixed-width digits it does not get from the serif.

At 26–52 px leading a card those shapes *are* the register, and they are what
Lukas approved in T072 ("Den nye skrifttype på tallene er pæn"). At 16.8 px inline
in a 14 px sans sentence they are three digits at three widths on two baselines,
three pixels bigger than the prose around them — and a reader does not see a
display register, he sees the wrong font applied to part of a line. A figure there
leads on **weight** instead, in the sentence's own face: §03's "tal i 700", and the
idiom the chart's hover readout already used. `FinanceChart.test.tsx` asserts the
shape of the rule rather than a size — no `.ek-figure` may have prose beside it in
its own line box. Sibling *elements* are fine; that is the legend's own `dt`/`dd`.

Each screen was given one face, without a new colour:

| Screen | Its face |
|---|---|
| `/hjem` | **figures** — the three counts are 26 px serif, the loudest thing on the page |
| `/anciennitet` | **rhythm** — the meeting number is a 20 px serif ordinal repeating down 29 cards |
| `/oekonomi` | **the curve** — what the curve resolves to is set as display type directly under it |
| `/regler` | **text** — the amounts lead in serif from a left rail, and the statutes finally out-weigh their own paragraphs |

`/regler` was the heaviest screen and got the largest change. Fifteen statute
titles at 12 px over their own paragraphs at 11.2 px: 0.8 px doing the whole
work of saying which was the heading. **Nothing was made smaller.** The title is
14.4 px/600 in ink, the body 12 px/400 muted, the paragraphs are indented under
the §-rail and the row has real space around it — weight, colour, size *upwards*
and air, which is the four ways a gap grows without costing legibility.

Measured after, at 420 × 900 in both themes, on all eight screens, signed in:
**1860 text/background pairs composited through a canvas, zero failures**; the
only tap target under 44 px is the demo build's own 21.6 px role switch, as
before; no horizontal scroll anywhere. Anciennitet is 10 % taller (4049 →
4457 px) and its scroll cost is unchanged within run-to-run noise.

**Reading Tailwind's alpha variants still needs the canvas.** `/20` and `/40`
compile to `oklab(… / 0.2)`, and a contrast sweep that parses three decimals out
of that reports the attendance pips at 4.05:1 when they are fine. T064 was
caught by it; a first pass of T072's harness was caught by it again. Resolve
every colour by painting it into a 1 × 1 canvas and reading the pixel back.

## The tokens, and where the app stands on each

Measured in a browser at 420 × 900, both themes, signed in and out, member and
admin — not read off the source. T066's notes carry the numbers.

| §03 says | The app |
|---|---|
| Tre flader — tekstur / kort / navy | ✅ all eight screens, and no fourth surface anywhere |
| RADIUS knap 10 · kort 16 · chip 999 | ✅ since T066. The button was `rounded-lg`, `rounded-[9px]`, `rounded-[10px]` and a bare `rounded` in four places; it is now one token, `--radius-btn` |
| TOUCH min. 48 × 48 | ✅ in the app. The demo build's own role switch is 21.6 px — see below |
| IKONER 24 px linje, altid med tekst | ✅ since T066 |
| Instrument Serif display / Sans UI | ✅ |
| Ingen vandret scroll (§04) | ✅ at 420 px on every screen and state |
| Kun opacity og transform (§01) | ✅ asserted in `src/theme.test.ts` — **one** sanctioned exception since T077, the wordmark's letter-spacing |
| Reveal ved scroll (§01) | ✅ all seven scrolling screens — and since T067 it runs on the phones the club actually holds |
| IntersectionObserver, tærskel 0.18 (§05) | ✅ since T067 — `src/lib/reveal.ts` |
| Nøgletal tæller op, 900 ms easeOutExpo (§01) | ✅ since T067 on Hjem and Anciennitet, and since T073 on Økonomi's three chart figures |
| Kurver tegner sig ind (§01, "indhold træder frem") | ✅ since T073, as **one** gesture since T077 — `/oekonomi`, 900 ms, the same curve |
| Søjler vokser fra baseline, forskudt (§01) | ✅ since T067 |

Contrast is at zero failing pairs across all eight screens in both themes, with
every background layer composited.

## The motion, and where it actually runs

The export answers §01 twice and the two answers are not equivalent. Its
stylesheet binds the reveal to `animation-timeline: view()`; its own script
uses an `IntersectionObserver` at threshold 0.18 for the count-up, which is
also what §05 Implementering writes down. T064 followed the stylesheet.

That was wrong for this club and T067 undid it. `animation-timeline` is Safari
26; the members are on iPhones and the `@supports` guard meant the six screens
behind the login simply did not move for any of them — not degraded, absent.
Lukas, 2026-07-28, having checked on both his phone and his computer: *"the
cool visuals on the other pages, and flip through, I cannot see anywhere."*

It is now one code path, `src/lib/reveal.ts`, and the scroll-timeline rules are
gone rather than kept as a second branch. IntersectionObserver has been in iOS
Safari since 12.1 (2019), far under the floor this app already sits on —
Tailwind v4 needs Safari 16.4.

**The guarantee moved from a feature check to an ordering.** T064 was right that
a reveal must never strand content; its `@supports` guard was how it bought
that, at the cost of the motion. Now the stylesheet hides nothing on its own —
`[data-reveal]`, which is what React renders, selects no rule — and the only
thing that ever sets a hiding state is `arm()`, *after* `observe()` has
returned on that same element. No script, an old browser, a thrown observer, a
teardown mid-animation: every one lands on the finished page. Unlike the CSS
guard, that is a behaviour, so `src/lib/reveal.test.ts` can actually assert it.

What the members' screens do now, all of it from §01:

| | |
|---|---|
| Reveal | 22 px up + fade, 700 ms, `.16 1 .3 1`, staggered 60 ms per element in a batch (capped at six) |
| Bars | grow from the baseline over 900 ms on the same curve — §01 pairs them with the count-up, not with the cards |
| Figures | count up in 900 ms, easeOutExpo, the export's own `1 − 2^(−10p)` |
| Attendance strip | the ten pips arrive left to right, 26 ms apart, riding their card's own state |
| Meeting card | the club's blue streg is drawn under the meeting's name as the card arrives — absolutely positioned, so 29 of them add no height |
| Finance chart | one clipped edge travels up from the baseline over 900 ms and uncovers the whole plot at once — see below. T073 sequenced five marks here; T077 does not |
| Date rail | the hairline beside a news item's or a meeting's date grows downwards, 120 ms behind its card |
| Scroll indicator | the export's `#ek-progress`, as `scaleX` rather than its `width` |

**The count-up is no longer an open conflict, and Økonomi is no longer wholly
out of it.** T064 and T066 left it, reading
§01's "kun opacity og transform" as forbidding text that is rewritten every
frame. Re-read against the export, the two rules never disagreed: that one is
about which CSS properties may be animated, because those two composite — and
the export's own script counts its figures by writing `textContent`. The number
on screen is always React's; the count-up only replaces it while it is arriving,
only when it can rebuild the rendered string exactly, and the width is pinned
first so nothing moves under it ("Ingen loading-hop", §05).

Økonomi was left out entirely, on the reasoning that a bank balance spinning up
to its value is decoration on the one page whose whole job is to be exact. That
reasoning still holds and **Klubkassen still does not move** — it is the figure a
member checks his own arithmetic against. T073 drew the line one card further
in, at Lukas's word (2026-07-29: *"Og lidt mere motion på tallene"*): the three
figures in the chart's legend row are the *readout of the curve directly below
them*, they count over the same 900 ms the chart takes to sweep in, and the plot and
the number it resolves to therefore finish in the same moment. A figure that
belongs to a gesture is not the same object as a balance sitting on a card.

T073 also found the count-up's one real fault, on that page. `from` is
`performance.now()` at the moment the observer fires; `now` is the rAF
timestamp, which is the *frame's* time and need not be later than a reading
taken inside that frame. Unclamped, a millisecond of that turns easeOutExpo's
`1 − 2^(−10p)` into a large negative multiplier and the club's balance renders
as **"-24.643 kr."** for one frame. It is clamped at both ends now, and
`reveal.test.ts` drives a frame backwards to prove it.

## The chart, swept in from the baseline

Lukas, 2026-07-29: *"Det kunne også være fedt med noget motion på finansgrafen.
Så linjerne sådan kommer frem, når man åbner siden."* And 2026-07-30, on what
T073 built for it: *"Nu kommer den ind sådan i stykker (en linje ad gangen),
hvilket får det til at se lidt ud som om at den blot loader langsomt. Ideelt så
skulle den ligesom komme frem som om at den blev tegnet frem fra bunden."*

**He is right, and T073's fault was the sequencing rather than the gesture.** It
drew each curve on its own `stroke-dashoffset`, then settled the band at 620 ms,
the end dots at 780 and the dashed forecast at 900 — five marks arriving one
after another. That is what a page loading in pieces looks like, whatever the
easing on each piece. A design mistake, not a bug, and the reasoning below it
(the band, the dots, the forecast, each in its right place in a queue) was sound
argument for a queue that should not have existed.

One gesture now: a single edge travelling up from the baseline, uncovering both
curves, the band, the end dots, the dashed forecast, the gridlines and both axes
together. `.ek-sweep` is the rect of a `clipPath` over the plot, scaled from
`scaleY(0)`, so **it is a transform** — and `stroke-dashoffset` has left the app
along with the `--ek-len` machinery, the `getTotalLength()` measurement and the
four staggered delays. `src/theme.test.ts` no longer sanctions the exception:
a stale exception is a licence the next pass finds already granted.

**900 ms and `.16 1 .3 1`, unchanged.** §01 gives that pair to the count-up and
the bars, and the three figures beside the plot count over the same 900 ms, so
the chart and the numbers it resolves to finish in the same instant — measured in
Chromium, the sweep reaching full at +900 ms from `in` and the figures landing at
+927. Lukas asked for that pairing in T073 and it is the one thing here kept
exactly. It holds for a reason worth knowing: `show()` writes §01's 60 ms stagger
onto the element it fires, and `data-draw` animates a *descendant*, so the plot
takes no stagger — and neither does the count-up. Push the delay down onto the
sweep and the gesture arrives up to 360 ms after the numbers it is the readout of.

**Recharts' own animation is still not used.** Every series has carried
`isAnimationActive={false}` since the chart was built; turning it back on would
put a second easing curve and a second duration beside the system's. No series
carries a motion hook of its own any more either — `.ek-curve`, `.ek-band` and
`.ek-forecast` are gone, because one clip over the plot leaves nothing for a
per-curve class to be the handle for.

**The clip is what makes the band honest, which is what T073 needed the stagger
for.** Its objection was real: two curves drawn by dash-offset are genuinely
incomplete while they draw, so the gap between them is a shortfall that grows
while you watch, and the card exists to report that gap. A clip never shows an
unfinished shape. Every frame of the sweep is a horizontal slice of the finished
chart; nothing on it is ever a value on its way somewhere. So the band arrives
with everything else, and the reason it could not has been removed rather than
overruled.

**The guarantee is back to being an ordering**, which is the stronger form. T073
could only offer a fallback: it measured paths recharts inserts some frames after
React commits the card, too late for `arm()`'s observe-then-hide to reach. Nothing
is measured now, so the only rule that clips anything is scoped to
`[data-draw='armed']`, which `lib/reveal.ts` sets *after* `observe()` has returned
on that element. Verified in Chromium: with `observe()` throwing, and with no
`IntersectionObserver` at all, the plot is unclipped, all five paths are at full
opacity and the three figures read the club's real totals. `prefers-reduced-motion`
lands on the finished chart with nothing armed anywhere on the page.

## The cards, and what was left room for

Lukas, 2026-07-29, on Nyheder and Møder: *"de cards ... er stadig lidt kedelige.
Altså man kunne måske lave et eller andet der?"* They were a 10 px uppercase
date, a headline and a paragraph in a rounded box, repeated down a page —
nothing recurring at the same place, so the eye had no beat and every card
looked like the one above it.

They were given a face out of material they already had, in the register he had
already approved (*"Den nye skrifttype på tallene er pæn"*): the day is a **26 px
serif numeral** in a rail with its month beneath it and a hairline down its
side. It is the idiom `/anciennitet` already uses as its face and the §-rail
`/regler` got in T072 — a third screen sharing it rather than a third invention.
The year appears only when it is not the current one, which is the trap
`lib/dates.ts` already documents said the other way round.

Two things came out of the data rather than out of a decoration:

- **News items are signed.** `author` is `not null`, every row carries a real
  name, the form has always written it — and nothing read it back. The note in
  `Nyheder.tsx` called what to do with it "a design question for another day".
- **A meeting's venue has its own row**, with §03's `place` pin in the accent
  (§04 draws that icon blue by name).

**That venue row is where the map goes.** Lukas, same day: *"Derudover skal vi
have et kort, som viser alle steder vi har været implementeret på længere
sigt."* Before T073 the venue was one muted 12 px line among three and
indistinguishable from a description; it is now a single self-contained row with
its own icon and the full width of the card, so a link, a chip, a distance or a
row of markers can arrive there without the card being rebuilt around it. **No
map dependency was added and none is approved.**

**Still not verified on WebKit, and for the same reason.** The Playwright WebKit
build is not in the session's image and the download is refused by egress policy —
`playwright.download.prss.microsoft.com` answers 403, "host not permitted". T073
hit this; T077 hit it again.

What that leaves unproven is now one property: **`transform-box: fill-box` on the
sweep's rect**, which is what puts the pivot on the bottom of the plot rather than
on the SVG canvas origin. Its failure mode is the one direction that is not
benign — an ignored `transform-box` falls back to `view-box`, and a pivot at the
origin sweeps the chart *down from the top* instead of up from the baseline. So the
clip's host `<svg>` carries `viewBox="0 0 1 1"`, matching the clipPath's own
objectBoundingBox units: `transform-origin: bottom` is 50% 100% of either box and
both paths resolve to the same point. Wrong is then no longer available cheaply.
Everything else in the gesture — a `clipPath` referenced by `url(#…)` from CSS,
`clipPathUnits="objectBoundingBox"`, a transform animated on an SVG element — has
been in iOS Safari for a decade. **It still wants Lukas's eye on a phone.**

## Not done yet

**The type scale runs one notch below §04's own phone mocks.** T072 closed part
of it rather than none — Hjem's figures 22 → 26 px, a meeting number 15 → 20 px,
a statute title 12 → 14.4 px and its body 11.2 → 12 px — but the table below is
the state before that and the remaining levels are still short.

The measurement, as T066 left it — the rows T072 moved are marked:

| Role | §04 mobil | The app |
|---|---|---|
| Section label | 10 px, .18em | 9.3 px, .14em |
| Meeting number | 19 px / 700 | ~~15.2 px / 600~~ → **20 px serif** (T072) |
| Lead name | 17 px / 600 | 14.7 px / 600 |
| Route line | 13 px | 12 px |
| Attendance initials | 11 px / 600 | **8.8 px** / 600 |
| Meeting date | 12 px | 10.4 px |
| Fine amount | 14 px / 700 | 12 px / 600 |
| News headline | 16 px / 600 | 15.2 px / 600 |
| Figures, serif display, nav labels | 22 / 28 / 10 px | ✅ the same — Hjem's three are **26 px serif** since T072 |

Raising it is not a tweak: it re-flows six screens, changes Anciennitet's
height and therefore the `cover 12%` reveal range tuned against it, and the
24 px attendance pips cannot hold 11 px initials without growing — ten of them
to a card, twenty-nine cards. It is a real piece of work with a real risk of
regressing the one page that has to stay cheap, and it wants Lukas's eye on a
before/after rather than a session's judgement. **It is the largest thing left
between the app and the system.**

**There is no desktop layout.** §04 shows a 1180 px, 12-column desktop with a
wide hero, and §05 asks for "Bundmenu på mobil, topnav fra 1024 px". At 1280 px
the six members' screens are the 512 px phone column centred in the window with
the bottom tab bar still sticky. Nothing is broken — it reads as a phone app on
a big screen, which is what it is — but it is a whole section of the system the
app has not attempted, and building it is a task rather than a conformance fix.
The landing page is the exception and already goes wide.

**The demo build's role switch is 21.6 px tall**, against the 48 px floor. It
is scaffolding rather than a members' screen, and it cannot simply grow: its
height is published to the shell as `--demo-bar` and the app's full-height
layout is measured against it, so making it a proper tap target is a change to
the demo bar rather than to a button.
