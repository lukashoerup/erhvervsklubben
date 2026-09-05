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

## Left open
- If Lukas wants it *drawn*: a lead share at the foot of each bar (part-to-whole, same
  hue, lighter step) is the honest form. Not done first because it puts a second
  meaning on the bar the club reads most, and the ramp tokens flip between themes.
