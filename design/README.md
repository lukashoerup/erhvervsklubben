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
| Kun opacity og transform (§01) | ✅ asserted in `src/theme.test.ts` |
| Reveal ved scroll (§01) | ✅ all six members' screens **and** the landing page since T066 |

Contrast is at zero failing pairs across all eight screens in both themes, with
every background layer composited.

## Not done yet

**The type scale runs one notch below §04's own phone mocks.** Consistently,
across every members' screen — the app is set 8–25 % smaller than the design's
mobile screens at every level, and the design's mocks are 360 px wide where the
app is measured at 420, so it is not a question of room.

| Role | §04 mobil | The app |
|---|---|---|
| Section label | 10 px, .18em | 9.3 px, .14em |
| Meeting number | 19 px / 700 | 15.2 px / 600 |
| Lead name | 17 px / 600 | 14.7 px / 600 |
| Route line | 13 px | 12 px |
| Attendance initials | 11 px / 600 | **8.8 px** / 600 |
| Meeting date | 12 px | 10.4 px |
| Fine amount | 14 px / 700 | 12 px / 600 |
| News headline | 16 px / 600 | 15.2 px / 600 |
| Figures, serif display, nav labels | 22 / 28 / 10 px | ✅ the same |

Raising it is not a tweak: it re-flows six screens, changes Anciennitet's
height and therefore the `cover 12%` reveal range tuned against it, and the
24 px attendance pips cannot hold 11 px initials without growing — ten of them
to a card, twenty-nine cards. It is a real piece of work with a real risk of
regressing the one page that has to stay cheap, and it wants Lukas's eye on a
before/after rather than a session's judgement. **It is the largest thing left
between the app and the system.**

**Count-up on the figures.** §01 asks for "Nøgletal tæller op i 900 ms med
easeOutExpo", and the members' screens do not. Counting a number up means
rewriting text every frame, which is the one thing §01's own rule about
`opacity` and `transform` exists to prevent. Left undone deliberately rather
than half-done; it needs a decision about which rule wins.

**There is no desktop layout.** §04 shows a 1180 px, 12-column desktop with a
wide hero, and §05 asks for "Bundmenu på mobil, topnav fra 1024 px". At 1280 px
the six members' screens are the 512 px phone column centred in the window with
the bottom tab bar still sticky. Nothing is broken — it reads as a phone app on
a big screen, which is what it is — but it is a whole section of the system the
app has not attempted, and building it is a task rather than a conformance fix.
The landing page is the exception and already goes wide.

**No motion at all on iOS before Safari 26.** The price of the no-JavaScript
reveal (T064). The screens are complete and readable, simply still.

**The demo build's role switch is 21.6 px tall**, against the 48 px floor. It
is scaffolding rather than a members' screen, and it cannot simply grow: its
height is published to the shell as `--demo-bar` and the app's full-height
layout is measured against it, so making it a proper tap target is a change to
the demo bar rather than to a button.
