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

Two of the nine are in the app, under `public/fonts/`:

| File | From | Size |
|---|---|---|
| `instrument-sans-latin.woff2` | Sans, latin, variable wght 400–700 | 30 kB |
| `instrument-serif-latin.woff2` | Serif, latin, 400 | 21 kB |

**Latin only**, because no character this app renders is in latin-ext — every
letter, every æ ø å, and § · × é are all in the latin subset. **Upright only**,
because nothing in the app is italic. **Material Symbols is not extracted**: at
339 kB it is seven times the two text faces together, and the app draws its
icons as geometric characters (▤ ◆ ◇ ◈ ◷ ✦) that Instrument does not contain
and that fall back to the system font per glyph, as they always have.

They are self-hosted because they have to be: the export preconnects to
fonts.gstatic.com, and the app has no CDN access. A Google Fonts link does not
error — it just leaves the page in Georgia. `src/theme.test.ts` fails if one is
ever added back.
