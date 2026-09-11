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

## Second round, the same evening: venues, the club's words, the four absent

Lukas, three hours later: *"Vi starter i øvrigt på Understellet og tager på Ms
Cuisine bagefter. Opdater. Skriv gerne noget med at en formidabel lead har forberedt
noget rigtig lækkert og godt i god tid (ironisk) samme jargon som nyheder og øvrige
begivenheder. Skriv en skill eller et eller andet. Kan ikke passe at jeg skal
acceptere 20 sql requests for at du kan opdatere det her. Der mangler at stå alle dem
som ikke er til stede på mødet i dag."*

**What one read found** (a single `json_build_object` query — the point of the skill):
- He had already opened the card and written the venues himself: `Café Understellet`,
  `Ma Cuisine` (his card spelling; the chat said "Ms"). Left exactly as typed.
- He had ticked **Saaby** present — six rows, all present.
- The calendar row `Erhvervsklub #30` was **gone**: recording a meeting from the card
  retires its calendar row (`retireEvent` in Anciennitet.tsx). So the first
  migration's `events` update had done its work and the second's touched nothing.
- **Item 1 of the first round was wrong about the card.** The editor's `fresh` filter
  inserts a row for a member it has none for **only when he is ticked present**; there
  is no way to write an absence from the site for a member with no row. That is why
  the four were "missing" rather than absent, and why the first round's rule could
  not stand.

**`20260911165315_moede_30_evening.sql`**, applied once (no dry run — the block's own
assertions roll back, and the first dry run cost record id 31), read back:
- `description` on record 32, in the club's Formandskabet register: *"Lukas er Lead.
  En formidabel Lead har i særdeles god tid forberedt noget rigtig lækkert og godt: Vi
  starter på Café Understellet og går derefter videre til Ma Cuisine. Formandskabet
  noterer med tilfredshed, at programmet forelå længe før mødets start, og ser frem til
  faglige diskussioner på højeste niveau."* Written only where the column was empty.
- Venues only where still empty or still the calendar placeholder — a no-op tonight.
- **Absent rows for every member without one**: Have, Mads, Oskar, Rasmus. The evening
  holds **ten rows, six present**; the table 281 / 206.
- Assertions: one row per member, a description, a real venue.

**The skill: `.claude/skills/moede/SKILL.md`.** One read (the query to copy), one
migration (the block to copy, guards in order), one read-back; the rules for late,
bets, no-shows, Oskar, attendance-from-a-message (ten rows), venues, the calendar row,
the club's voice for descriptions, the docs to touch, and the shape of the reply.
`/moede` is user-invocable.

**Why twenty prompts.** Two causes. The first round fanned reads out as a dozen
queries — fixed by the recipe. And Claude Code on the web loads `.claude/settings.json`
only from the session's primary working directory; a session on two repositories has
`/home/user` as primary and never reads this repo's allow-list (docs: settings,
"Settings in cloud sessions" — found by the claude-code-guide agent, not verified from
inside a session). A session started on `erhvervsklubben` alone should not prompt.
Also in `workbench/context/LEARNINGS.md`.

## Left open — for Lukas
1. **The four absent — Have, Mads, Oskar, Rasmus — on his word** ("alle dem som ikke
   er til stede"). If one of them was there after all, tick him on the card; the row
   exists now, so the card can flip it.
2. **Udeblivelse / sent afbud.** Four absent, and nothing said about notice, so nothing
   charged. Missing without notice is 200 kr., cancelling after the table was booked
   100 kr. — the Lead's to say.
3. **1.525 kr. of fines noted and never billed** — §15.1's 730, the bowling 365 and
   tonight's 430. Five evenings now. Still Lukas's decision.
4. **The app cannot write an absence for a member with no row.** A meeting the app
   creates gets ten rows, so it only bites on a meeting a migration created — which the
   skill now prevents. Worth a small change in `useSaveMeeting` anyway (insert
   `false` rows for un-ticked members with no row on a *dated* meeting) if it recurs.
