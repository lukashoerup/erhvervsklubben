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

## Not done yet

The two Instrument fonts are inlined in the bundle but **not yet extracted into
the app** — the app currently falls back to Georgia and the system sans, which
is close in feel but not the real thing. Extracting them is the next step, and
they must be self-hosted: the app has no external CDN access.
