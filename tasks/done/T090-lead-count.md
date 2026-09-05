# Task: T090 — how many times each member has been lead, on the anciennitet strip

**Status:** done 2026-09-05. Branch `claude/ek-account-balance-update-kx7ffo`.

## The ask
Lukas, 2026-09-05: *"Kan vi få ind på anciennitetsgrafen hvor mange gange folk har
været lead? Tænker en linje."*

## What "the graph" is
`AttendanceSummary` at the top of `/anciennitet`: ten columns, one per member, sorted
by attendances, the count printed above each bar and a two-letter label below. Not a
line chart, and the page Lukas has said must not be changed — so the addition had to
be an addition.

## Why not a line
Tried on paper before any code, and refused twice over:

1. **Scale.** Lead counts run 1–4; attendances run into the twenties; the plot is
   56 px tall. A line through the lead counts sits within a few pixels of the baseline
   and reads as nothing. A second axis for it is the one thing the dataviz rules
   forbid outright.
2. **Meaning.** The x-axis is ten *people* in attendance order. A line between them
   draws a trend from Anders to Kasper that does not exist — the slope between two
   neighbours is an artefact of the sort.

What he can read is what the strip already does with the attendance: a printed figure.
So: one more figure under each name, in the faint ink the labels use, and one sentence
under the strip saying what the row is. *"En linje"* — a line of numbers.

## What was done
- `RosterEntry.led`, computed in `buildRoster` from `attendance_records.lead` against
  the roster. `leadsIn(lead, names)` does the matching: whole names only, split on
  non-letters, so `Andersen` never credits `Anders` and a two-word name still matches.
- **Møde 18 — "Rasmus (Co-lead Oskar)" — credits both.** The club wrote both names
  into the lead field; a first-word rule would be the app overruling the club about
  its own evening. Tested.
- A lead the roster does not know (a guest, a typo) credits nobody and joins nobody:
  leading is not what §11 says makes a member.
- The count is **not anciennitet** and does not order the strip, colour a bar or join
  the eyebrow. It rides beside the count. The `aria-label` and `title` say it in words:
  *"Anders: 22 af 29 · lead 4 gange"*.
- Zero is printed as 0, not hidden: a member who has never led is a fact about the
  rota.

## Live figures (production, 2026-09-05)
Anders 4, Esben 4, Mads 4, Emil 3, Oskar 3, Rasmus 3, Saaby 3, Lukas 2, Have 1,
Kasper 1 — 30 records; Oskar's third is the London co-lead.

## Verification
- Tests 467 → 476: six on the derivation (count, guest lead, co-lead, order untouched,
  nought for a new member, whole-name matching) and three on the strip (the figures,
  the words, and that the bar and eyebrow are untouched). One existing test updated:
  its label pattern was anchored at the end of the string and the label now carries
  the lead clause after the count; it also asserts the lead figure rests on its number.
- Build and lint clean.
- Not checked on a device: the strip gains one 0.55 rem row per column, which is the
  labels' own size; at 420 px the columns are ~30 px wide and a one- or two-digit
  figure fits. Worth a glance on Lukas's phone.

## Second round, the same day: the line, on its own axis
Lukas, on reading the above: *"Tænkte en ny y akse. Til linjegrafen."*

A second y-axis is the one chart form the dataviz rules forbid without exception, and
he had been told once why a line was refused. Asked twice, it is his call — recorded in
PROJECT.md — and the job became drawing a dual axis as honestly as one can be drawn:

- **The line is ink, not the bars' blue**, painted over a surface-coloured halo (the
  2 px surface ring the rules ask for where marks cross), so it never reads as a bar's
  outline and stays legible over blue and over the gaps in both themes.
- **Its scale is written at the right edge and nowhere else**: a hairline axis with
  `0` and the highest count on it, titled *lead*, and no gridline across the bars —
  a gridline would invite reading the bars against the line's scale.
- **The scale runs to one above the highest count**, so the line's peak never sits
  level with the tallest bar.
- **The figures under the names stay.** The number is readable without the axis.
- **It grows from the baseline with the bars** — the same `data-bar` state and the
  same 900 ms — so the strip is still one gesture rather than bars growing under a
  finished line.

Geometry: the strip is now a CSS grid of four rows (count, plot, label, lead figure)
with a subgrid per member, so the plot row is one shared band; the line is an SVG laid
over that band alone, with percent coordinates on each mark rather than a stretched
viewBox. The columns lost their 4 px gap and the bars wear 2 px side padding instead,
so column *i*'s centre is exactly (i + ½)/n and the dots land on their bars. Every cell
is placed by hand on the grid, because auto-placement steps around cells an explicit
item occupies rather than sharing them.

Tests 476 → 480: the dots' positions on the scale and at the column centres, the halo
and ink passes, the axis carrying the scale and nothing else ruled, the line riding
the bars' animation state, and an empty roster drawing no line.

## Left open
- The figure row under the names is now the second statement of the same number. If
  Lukas finds the strip busy, the row is the thing to drop, not the axis.
