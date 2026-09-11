# Task: T092 — møde #30, 11.09.2026: four late arrivals, fined

**Status:** done 2026-09-11. Branch `claude/boeder-ek-moede-5wmii6`.

## The ask
Lukas, 2026-09-11, the evening of the meeting: *"Bøder til EK møde. Hvor jeg er lead.
I dag. Anders: 2 min · Esben: 5 min · Kasper: 12 min · Emil: 27 min"*

## What was found first
- **The evening did not exist.** `attendance_records` ended at møde #29 (2026-08-08,
  record 30). The calendar held `Erhvervsklub #30` on 2026-09-11, 17.00–22.00,
  location `Lukas`, description `TBD`, **lead empty** — the row the events_lead
  migration deliberately left alone on 08.08 because nothing then could say whether
  Lukas was the lead or the venue was his house. He has now said the first half.
- **The rule.** `for-sent` is 50 kr. + 5 kr. pr. minut (docs/RULES.md, `rules.ts`),
  and the four amounts are that arithmetic: 60, 75, 110, 185 — **430 kr.**
- Production's migration list matched `supabase/migrations/` (check 1 in STATUS.md)
  before anything was written: last version 20260905182331 on both sides.

## What was done
`supabase/migrations/20260911163428_moede_30_late_fines.sql`, dry-run first (the
same block with a `raise exception` at its end, so it wrote, read back and rolled
itself back — record 31, 5 attendance rows, 4 fines, totals 40 / 3.305 / 1.525), then
applied through `apply_migration` and committed under the version production
recorded. One guarded `do` block:

- **Guard:** returns, out loud, unless møde #29 sits on 2026-08-08 and `members` has
  ten rows. A fresh stack writes nothing.
- **The evening:** matched on `meeting_date = 2026-09-11 or meeting_number = 30`,
  never on a serial id; two matches is an exception, none is an insert. Written as
  meeting_number **30**, lead **Lukas**, date **2026-09-11**, `main_location` carried
  from the calendar row (`Lukas`) exactly as the app's own record-from-event button
  carries it; the other venues and the description null.
- **The calendar row** gets `lead = 'Lukas'`, matched on the empty lead so a row he
  has corrected by hand is left as he left it.
- **Attendance, only what the message proves:** Lukas (lead), Anders, Esben, Kasper,
  Emil — five rows, present. A late arrival is an arrival. The other five are **not
  written as absent**: the message says nothing about them, and an absence on no
  evidence counts against a man's §11 anciennitet.
- **Fines:** four `for-sent` rows with the minutes, `amount_kr = 50 + 5 × minutes`,
  `not exists`-guarded per (record, member, rule). `noted_by` null like every other
  row a migration has written; the file says who noted them.
- **Read-back inside the block:** refuses and rolls back unless exactly four late
  fines summing to 430 kr. sit on the evening, each at the regulativ's price for its
  minutes.

## Read back from production after writing

| | |
|---|---|
| `attendance_records` | 30 rows; møde #30 is **record 32**, lead Lukas, 2026-09-11, sted `Lukas` |
| `attendances` | 276 rows, **205 present** (271 / 200 + the five) |
| `fines` | **40 rows / 3.305 kr.**; outstanding **1.525 kr.** across 21 rows (1.095 + 430) |
| `events` `Erhvervsklub #30` | lead `Lukas` |

Per member, unsettled: Kasper 305, Esben 285, Emil 280, Mads 130, Saaby 130,
Anders 125, Have 110, Rasmus 110, Lukas 50.

**Record ids now run 1–27, 29, 30, 32.** Id 31 was consumed by the dry run: a
sequence does not roll back with the transaction that drew from it. Harmless — nothing
in the app or the docs keys on the id being contiguous — and written down here so the
next reader does not go looking for a deleted meeting.

## Verification
- Dry run against production, rolled back; then applied; then every table read back
  (above). Filename version = the database's version, so STATUS.md check 1 passes.
- `npm test`, `npm run build`, `npm run lint` green before the commit (no code
  changed; the suite guards the docs-vs-source assertions).
- The RLS job needs Docker and runs in CI; the block is guarded on the club's own
  rows, the same shape as `absences_recorded` and the guarded `adhoc_fines`, so
  `supabase start` on a clean machine writes nothing.

## Left open — for Lukas, on /anciennitet or in a message
1. **Who else was there?** Have, Mads, Oskar, Rasmus and Saaby have no row on møde
   #30. Ticking them on the meeting card writes the rows (the editor inserts a row for
   any member it has none for). If any of them was absent, tick nothing for him — the
   next absences pass (the shape of `absences_recorded`) can write the false rows once
   the present ones are known.
2. **The venue.** The card says `Lukas` under Sted because the calendar row did. If the
   evening was somewhere else, correct it on the card.
3. **Udeblivelse / sent afbud.** Nothing was said about anyone missing without notice,
   so nothing was charged. If someone did, it is one more row — 200 kr. or 100 kr. —
   and it belongs to the Lead to say.
4. **1.525 kr. of fines noted and never billed** — §15.1's 730, the bowling 365 and
   tonight's 430. Five evenings now. Still Lukas's decision.
