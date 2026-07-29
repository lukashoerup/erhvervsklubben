# Task: T072 visual hierarchy on all eight screens (phase 7)

## Lukas's reading (2026-07-29)
> "Det er lidt ensartet med farverne, og tekststykkerne på nogle af siderne
> virker meget voldsomme og store."

He was offered a smaller type scale and declined it. **Nothing here was made
smaller.** Four changes he approved, done as one move rather than four patches.

## What was built

### One system, three registers
The palette was never short of colours — the accent was doing four jobs at once.
Headings, figures, links and section labels were all `--color-accent`, on every
screen, which is precisely why six cards read as one texture.

| Register | Job |
|---|---|
| Instrument Serif, ink (`.ek-figure`) | a figure that is the subject of its line |
| Instrument Sans, ink | headings and body — hierarchy from weight, size, space |
| The accent | what can be tapped, or is a mark: buttons, links, active tab, the streg, the chart's curves, §03's blue icons |

Section labels went muted with the club's signature streg beside them
(`SectionTitle` / the new `Eyebrow`, which replaced five inline copies).

**One face per screen, no new colour.** `/hjem` its figures (three counts at
26 px serif), `/anciennitet` its rhythm (a 20 px serif ordinal repeating down
29 cards), `/oekonomi` its curve (what the curve resolves to, set as display
type under it), `/regler` its text.

`/regler` was the heaviest and got the largest change: fifteen statute titles at
12 px over their own paragraphs at 11.2 px, with 0.8 px doing the whole work of
saying which was the heading. The gap grew in the four ways that cost no
legibility — weight (600 vs 400), colour (ink vs muted), size *upwards* (title
to 14.4, body to 12) and space (paragraphs indented under the §-rail, real room
around each row).

### The way back to the front page (authorised mid-task)
> "Der er ingen måde at man kan navigere tilbage til animationsforsiden …
> evt. ved at klikke på logo oppe i venstre hjørne."

`/` forwards a signed-in member to `/hjem` (T060, and rightly — both audiences
share the URL people type and share), so the landing page was live and
unvisitable from inside the app. The logo lockup is a link to it now, in the app
bar and on `/login`, and the forward yields to it rather than being deleted: the
link navigates with `state={{ forside: true }}`, which rides that one history
entry and never the URL, so a typed, bookmarked or shared `/` still forwards.

### "Hvem betaler kontingent" removed (authorised mid-task)
> "Fjern også den der boks … Det ved alle godt."

Gone from `/oekonomi`. **No money changed**: `MEMBER_RIGHTS` in
`src/data/members.ts` is untouched and is what actually stops the founding
father being charged and being offered on the fine screen. What survived is the
payer count alone, as a clause in the chart's caption — the blue line is nine
times the rate and not ten, and that is the one thing on the page a member
cannot derive from knowing his own club.

## Decisions

- **Judged against Lukas, and followed the system: the small stat tiles are not
  all serif.** §03 says "Instrument Sans 400/500/600/700 · tal i 700" and §04's
  tiles obey it; §04's scroll-scene sets the figure that *leads a panel* in
  Instrument Serif, and this app's landing page has since T060. Both idioms are
  the system's. `.ek-figure` names the line: the figure leading a block is
  serif, a figure in a tile with its label beneath it stays Sans 700, and below
  ~14 px neither applies because Instrument Serif has one weight and nothing to
  lean on. So Anciennitet's ten 9.6 px roster counts and every table cell stayed
  Sans — setting those in a display face would have been a smaller, weaker
  number, which is the opposite of what was asked for.
- **Headings were already ink.** Point 2 asked for them to move there; they
  inherit `--color-ink` and always did. The blue on them was never the problem —
  the labels, the figures and the amounts were.
- **The accent left the text and stayed as a mark.** A 12 px blue streg before
  every section label: §01 calls it "én blå streg som signatur", §04's desktop
  mock sets that label in `#94A3B8`, and it gives the long screens a findable
  start-of-block that a colour never did.
- **Icons stayed blue.** §04 draws `place` and `north_east` in `#2563EB` by
  name. An icon is a mark, not an emphasis, and diverging from an explicit mock
  to satisfy a rule about *text* would be reading the brief past its point.
- **`/oekonomi`'s two blue table columns went ink-semibold, not serif.** A
  display face at 12 px in a four-column table is worse than the Sans it
  replaces. The column leads by weight.

## Evidence
Measured in Chromium at 420 × 900, both themes, signed in, on `/hjem`
`/anciennitet` `/nyheder` `/moeder` `/regler` `/oekonomi` `/login` `/` — the
same eight T066 swept, before and after, same session, same machine.

- **Contrast: zero failing pairs, 1860 measured** (16 page-loads). Every
  background layer composited, and **every colour resolved through a 1 × 1
  canvas rather than parsed** — Tailwind's `/20` and `/40` compile to `oklab()`,
  and a first pass of this harness read them as three decimals and reported the
  attendance pips failing at 4.05:1 in both builds. That is the same trap T064
  wrote down; it catches the next person too.
- **Tap targets**: the only element under 44 px is the demo build's own role
  switch at 21.6 px, unchanged and documented in T066. The new logo link is
  44 px in the app bar and 100 px on `/login`.
- **No horizontal scroll** at 420 px on any screen, either theme.
- **Height**: `/anciennitet` 4049 → 4457 px (+10 %), `/regler` 1532 → 1678 px
  (+10 %) — that is the air. `/oekonomi` 1828 → 1794 px: the removed card more
  than pays for the padding.
- **Scroll cost on `/anciennitet`**, four runs each, top to bottom over 3 s:
  10× CPU throttle 24–30 fps before, 23–30 after; 15× 12–15 before, 11–17
  after. **Unchanged within run-to-run noise, in both directions.** These
  absolute numbers are far below T066's 58–60 fps at 10× on code it shares —
  that is this machine, not this change, which is why only the paired
  comparison is claimed.

## Found, not fixed
`design/README.md` says Anciennitet's sticky-band-free layout costs nothing, and
it does — but the `ek-stick-card` band paints a rounded rectangle in the card's
own surface colour that is faintly visible against the card on `/regler` and
`/oekonomi` in light mode. It is in both builds, so it predates this pass, and
it is a `border-radius` seam rather than a wrong colour. Not touched here.
