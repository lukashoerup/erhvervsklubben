# Task: T078 — udestående fixed, and what the club's fines are about

## Lukas, 2026-07-30

Three things, in the order they were dealt with rather than the order they arrived.

> "Der står i toppen af økonomisiden at der er udestående bøder på 2510 kr. Det
> passer ikke."

> "På økonomi siden kunne jeg godt tænke mig at der stod hvilke forseelser der er
> givet højeste bøder, og evt. også i samme visualisering, hvem det er. Masser af
> insights." … "Du må også gerne tilføje en graf længere nede som viser
> indtægtsfordeling (kontingenter, bødetyper) over tid. Tænker et søjlediagram …
> Alle medlemmer skal kunne se det. Det samme med bøderne. Husk motion feature."

> "Kan vi få en smule mere delay på den motion der er på grafen? Det må godt gå
> lidt langsommere, da man ikke når at se at den bygger op."

## 1. The bug, which was the priority

He was right, and the page was wrong in the worst available way: it summed **every
fine the club has ever incurred** and printed the total under the word
*udestående*, on the card that reads as authoritative. **It overstated what the
membership owes by the entire amount it had already paid.**

Three quantities, all true at once, and the app had one number for them:

```
2.510 kr.  pålagt      every fine a Lead ever noted     30 rows
1.780 kr.  indbetalt   what has reached the fine box    19 rows
  730 kr.  udestående  what the club is owed            11 rows
```

The arithmetic was never wrong. **One number was doing the job of three and the
label picked the wrong one** — and the same conflation sat one card down in "Bøder
pr. medlem", a *collection list*, which invited the treasurer to bill a member for
fines he settled in February.

**It had to be a column.** `payments` holds one combined figure per month covering
kontingent and fines together, because that is all the bank statement itemises
(§16), so nothing on the payments side can say which fines a month's money paid
for. `fines.settled_at` — additive, nullable, guarded, applied to production
2026-07-30.

### The 19-row split is evidence, and one row decides it
T075's **"Bøder indkrævet"** line divides møder 21–25 (1.730 kr., billed and
collected) from #26–#28 (730 kr., noted and never billed). But **1.730 ≠ 1.780**,
and the 50 kr. between them is the treasurer's own **voluntary** fine at møde #26 —
money he transferred himself, so *settled*, even though that evening was never
invoiced. Hence `meeting_number <= 25 OR rule_id = 'frivillig'`.

**A meeting cut-off alone marks 18 rows and 1.730 kr., which reconciles against
nothing.** The brief for this task said "18 fines … 1.780 settled"; those two
cannot both be true, and the kr. figures are the evidenced ones — the bank received
1.780 and §15.1 leaves 730. The migration **rolls back** unless all three totals
close, so this is asserted rather than asserted-about.

`settled_at` is the **collection round, not the transfer**: two bank transfers a
week apart make up the 1.780 kr. and the statement does not say which fine each
krone belonged to. Inventing a per-fine receipt date is the class of fabrication
T075 refused for the offences.

## 2. The insights

**Both cards are outside every treasurer gate** — his instruction, twice. What
stays his is the bank balance and the list of who is behind.

### Bøder · hvad og hvem
The tone decision is the design decision, because the same 30 rows make either
object: **one bar per member is a ranking of who behaves worst; one bar per offence
is a club looking at its own habits.** He asked for *forseelser* first and *hvem*
second, so the offence is the subject and the members are its composition.

- **Nine members as stacked segments was tried and abandoned.** The smallest share
  is 60 kr. of a 2.160 kr. bar — eight pixels at 420 px, too narrow for initials —
  so identity would have fallen back to nine hues on a dimension carrying no order,
  past the eight-hue ceiling, on a page already using blue against green. Replaced
  by **one bar per offence in one hue, with the members named in text beneath it**.
  Same information, survives a phone, costs the palette nothing.
- **`for-sent` is 86 % of every krone by construction** — the only rule with a
  per-minute component, so it will dominate any axis for as long as the club
  exists. **No log scale and no broken axis**: both make 2.160 and 250 look
  comparable, which is a lie about the money. Every bar is direct-labelled instead,
  so the 50 kr. rows are read from the figure beside them. Nothing on the card is
  legible only as a length.
- **The club leads, not a member.** 3 t 22 min of collective lateness, 23 arrivals,
  **7 of the 9 finable members**. That is the honest anti-shame fact and it is also
  the most interesting number in the data — `minutes` has only been populated since
  T075, so nothing could answer it before.

### Indtægtsfordeling pr. kvartal
- **Quarters, not months.** The regulation collects fines quarterly and §9 puts a
  dinner on the calendar every other month, so a monthly axis draws a flat 800 kr.
  bar with a spike in every second one — the club's *calendar*, which a reader takes
  for a collection problem. Six bars also fit 420 px where fourteen do not, and the
  page already reports "Kvartalsvis opkrævning".
- **Two things it says on itself rather than leaving to be misread.** The
  kontingent half is **derived** (rate × members charged that month) because the
  bank has never itemised a month; and a payment belongs to the month it
  **settles**, not the day it arrived.
- **One sequential ramp of the club's blue, four steps, not four hues.** The
  segments are the parts of one figure. Four fresh hues would say four independent
  things are measured — which the curve above already does with blue against green —
  and would undo T072. **Validated with dataviz's `validate_palette.js` in both
  palettes separately**: monotone lightness, adjacent gaps ≥ 0.06 ΔL, one hue, light
  end clearing its surface. Dark-first on the dark ground put step one at ~1.2:1 and
  lost the largest segment, so the ramp runs the other way in each. A dark palette
  flipped automatically is not a dark palette.
- **The tail is folded, not drawn.** `drikkevare` and `frivillig` are one 50 kr.
  fine each; as segments they are two pixels. One `Øvrige bøder` segment, itemised
  in the table under the chart.

## 3. The motion

T077 predicted this complaint and named the cause, so **no fourth mechanism**.
§01's `.16 1 .3 1` reaches **95 % at 43 % of its duration** — the chart snapped and
then crept, which is exactly "man ikke når at se at den bygger op" — and stretching
the same curve only lengthens the creep. Sampled progress at 10/20/30/50/70/90 % of
the duration:

| Curve | | | | | | | 95 % at |
|---|---|---|---|---|---|---|---|
| `.16 1 .3 1` | 49 | 75 | 88 | 97 | 100 | 100 | **43 %** |
| `.25 .35 .5 1` | 15 | 32 | 48 | 74 | 91 | 99 | 77 % |

**1600 ms on `.25 .35 .5 1`, one rule, all three charts.** A considered departure
from §01, written up in `design/README.md` as Lukas's call.

**The count-up moved with it deliberately.** T077 noted the synchronisation held
*by accident* — both were 900 ms. `SWEEP_MS` in `src/lib/reveal.ts` must equal the
CSS duration, `countMs()` applies it only to figures inside a `[data-draw]` chart
(so `/hjem`'s stat tiles keep §01's 900 ms), and **a test compares the two source
files** so they cannot drift apart again. `SETTLE_MS` 1100 → 1800: marking a chart
`done` mid-sweep drops the clip and finishes in one frame — the snap just removed.

## What was built
- `supabase/migrations/20260730180000_fines_settled.sql` — the column, guarded on
  the club's own fine book (30 rows / 2.510 kr.) and rolling back unless the three
  totals close. Applied to production.
- `src/data/fines.ts` — `fineTotals`, `outstandingByMember`, `byOffence`,
  `latenessFacts`, `daMinutes`, `incomeByQuarter`. Pure, no fetching.
- `src/components/FineInsights.tsx`, `src/components/IncomeMix.tsx`,
  `src/components/Sweep.tsx` (T077's gesture, made reusable).
- `src/pages/Oekonomi.tsx` — the balance card's three figures, the collection list
  corrected to what is still owed, both charts wired, and `readFines` tolerating a
  database without the three newer columns.
- `src/index.css` — the four `--color-mix-*` tokens in both palettes, the sweep's
  new timing, and `--ek-sweep-clip` so one rule serves three charts.
- 42 new tests. `npm test` 352 → **394**; build and lint clean.

## Verified
- **Production read back unchanged**: 28 meetings, 261 attendances, 30 fines /
  2.510 kr., 14 payments / 14.880 kr., 10 members — plus 19 / 1.780 settled and
  11 / 730 outstanding.
- Chromium 420 × 900, both themes, member and admin, on the demo build: both charts
  render, **no horizontal overflow** (scrollWidth 420 = clientWidth), no console
  errors, member sees both charts and neither treasurer card.
- The sweep captured in stills at exact times by driving the animation's own clock
  (`getAnimations()[0].currentTime`) rather than racing it — 0/200/400/800/1200/1600
  ms on both the curve and the bars, both confirmed on the same `ek-sweep 1600ms`.

## Known gaps — read these
- **Part 1 of the brief was not done.** Folding `/moeder` into `/anciennitet` and
  dropping the tab is untouched: `ROUTES`, `routing.test.tsx`'s `INTENDED`,
  `Moeder.tsx` and its tests are all as they were. Reason: the udestående bug
  displaced it, and part 1 is **all-or-nothing** — removing `/moeder` without moving
  the calendar's create/edit/delete somewhere would leave `events` uneditable, which
  is a capability loss, and `/moeder` is the only screen a meeting with a mistyped
  (past) date is reachable on. Half of it is worse than none of it. The date-match
  analysis that would drive it is in the report; **8 of the 12 calendar rows pair
  1:1 with a dated attendance record on date alone, with no duplicate dates on
  either side** — that is the join, and it refuses exactly where the data is
  ambiguous.
- **The perceptual end of the sweep is earlier than 1600 ms.** The finance curve
  peaks around 15.000 of a 20.000 domain, so the last ~25 % of the clip uncovers
  empty plot. Drawing completes to the eye around 800–1000 ms. That is still 3.5×
  later than before and it reads as building; if he wants more, the lever is the
  y-domain, not the duration.
- **WebKit unverified**, as in T073 and T077 — the Playwright build cannot be
  downloaded from this environment. The `viewBox="0 0 1 1"` guard on the new
  `Sweep` component is there for it and is untested.
- **Not run against a local Postgres.** The migration was applied to production and
  verified there; the local stack was not brought up, so `readFines`'s
  `undefined_column` retry is proven against the mock and the demo rather than
  against a genuinely older database.
- **`settled_at` has no UI.** Nothing in the app can mark a fine collected — the
  migration set the 19 rows and a future collection round needs SQL or a new
  control. That is deliberate for now (the 730 kr. is Lukas's decision, not a
  workflow yet) but it is the obvious next thing if he says "opkræv dem".
