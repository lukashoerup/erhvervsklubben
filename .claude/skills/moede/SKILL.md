---
name: moede
description: Record a club meeting from one of Lukas's messages — fines (who was late and by how much, a bet, a no-show), who was there and who was not, venues, and the evening's description in the club's own voice. Use whenever Lukas writes about an Erhvervsklub meeting (bøder, lead, for sent, fremmøde, sted, beskrivelse), tonight's or a past one. Three database calls, not twenty.
---

# Recording a meeting from a message

Lukas leads a meeting, then writes a few lines from his phone: who came late and by
how many minutes, where they started, what the evening was. That message is the
club's record until this skill has turned it into rows. The job is data entry with
the club's own rules applied, done in **at most three database calls**, because he
approves each one by hand and has said, after twenty: *"Kan ikke passe at jeg skal
acceptere 20 sql requests."*

Project: `urlabzyihqrsdeasvrfe`. The tools are `mcp__Supabase__execute_sql` (read)
and `mcp__Supabase__apply_migration` (write). Never write with `execute_sql`; a
write that is not a migration is a change the repo does not know about, and
STATUS.md check 1 exists because that has happened.

## Call 1 — read everything at once

One `execute_sql` with a `json_build_object`, never a query per question. What it
must bring back:

```sql
select json_build_object(
  'last_records', (select json_agg(json_build_object('id', id, 'n', meeting_number, 'lead', lead,
                    'date', meeting_date, 'pre', pre_location, 'main', main_location,
                    'post', post_location, 'desc', description) order by meeting_number desc)
                   from (select * from public.attendance_records order by meeting_number desc limit 4) r),
  'events',       (select json_agg(json_build_object('t', title, 'd', date, 'lead', lead,
                    'loc', location, 'desc', description) order by date)
                   from public.events where date >= current_date - 60),
  'members',      (select json_agg(json_build_object('name', name, 'status', status) order by name)
                   from public.members),
  'attendance',   (select json_agg(json_build_object('n', r.meeting_number, 'who', a.member_name, 'here', a.attended))
                   from public.attendances a join public.attendance_records r on r.id = a.record_id
                   where r.meeting_date >= current_date - 60),
  'fines',        (select json_agg(json_build_object('n', r.meeting_number, 'who', f.member_name,
                    'rule', f.rule_id, 'min', f.minutes, 'kr', f.amount_kr, 'note', f.note))
                   from public.fines f join public.attendance_records r on r.id = f.record_id
                   where r.meeting_date >= current_date - 60),
  'totals',       (select json_build_object('fines_rows', count(*), 'fines_kr', sum(amount_kr),
                    'outstanding_kr', sum(amount_kr) filter (where settled_at is null))
                   from public.fines),
  'migration',    (select json_build_object('version', version, 'name', name)
                   from supabase_migrations.schema_migrations order by version desc limit 1)
) as state;
```

Add to it rather than calling again. If the tone of the description matters, add
`news` (`title, excerpt, author, date`, newest six) and the last ten records'
descriptions to the same object.

Check before writing: the last migration version in the result equals the newest
file in `supabase/migrations/`. If not, stop — production and the repo have
drifted, and STATUS.md says what to do.

## What the message means

- **Late** — `for-sent`, **50 kr. + 5 kr. per minute**, `minutes` stored, the amount
  computed in SQL as `50 + 5 * minutes` so the file shows the arithmetic. "Anders:
  2 min" → 60 kr. One per member per meeting; the unique index enforces it.
- **A bet, a forfeit, a round lost** — `aftalt`, amount as he says, **`note`
  required** (the check constraint refuses it without), several per member allowed.
- **Missed without notice** — `udeblivelse`, 200 kr. **Cancelled after the table
  was booked** — `sent-afbud`, 100 kr. Only when he says so; never inferred from an
  absence.
- **Nobody is fined on a guess.** No fine for a man he did not name.
- **Oskar** is `founding-father`: attends, is never fined. If Lukas fines him, ask.
- **Who was there:** the lead, everyone he names as late, everyone he names as
  present. **Everyone else on the roster is absent** — write the row as `false`.
  Decided 2026-09-11 (T092): the meeting card can flip a stored row but cannot add
  an absent one, so a member with no row is invisible rather than absent, and the
  only shape the club can correct on the card is ten rows, one per member. Say in
  the reply who was written absent so he can correct it.
- **Venues:** `pre_location` (where they start), `main_location` (dinner, `not
  null`), `post_location` (after). His spelling on the card beats his spelling in
  the chat: if he has already typed a venue on /anciennitet, leave it.
- **Lead:** the record's `lead` column, and the calendar row's `lead` too.
- **Meeting number:** `max(meeting_number) + 1`, and the calendar row's title
  (`Erhvervsklub #N`) should agree. Since #27 the club's numbering and the
  database's are the same. Match an existing record on `meeting_date` or
  `meeting_number`, **never on a serial id** — a dry run burns ids.
- **The calendar row** (`events`) for the evening: set its `lead`, `location` and
  `description` where they still say nothing (`''`, `TBD`, a person's name in the
  venue field). Once the record exists the site folds the row away, but a deleted
  record would surface it again, so it must not lie.

## The description — the club's voice

`attendance_records.description` is read on the card. The club writes about itself
in a deadpan-official register, "Formandskabet" reporting on a great institution:
*"Kadencen er intakt"*, *"Tak til Lead for planlægningen. Vi ser frem til faglige
diskussioner og et godt stykke smørrebrød"*, *"Lead har valgt en potentiel tvivlsom
tur i bowlinghallen til at slutte af på"*, *"Tak til Kongen og Danmark"*. Praise is
delivered straight and is funnier for it. Two to four sentences, Danish, opening
with *"<Navn> er Lead."*, naming the venues in order. If he asks for irony (a Lead
who planned everything "in good time" the day of), write the praise sincerely; the
club knows.

## Call 2 — one migration

`apply_migration`, name in snake_case (`moede_31_late_fines`). One `do $$` block,
in this order, every statement guarded:

1. **Guard on the club's own rows** — the previous meeting exists on its date and
   `members` has ten rows — else `raise notice` and `return`. A fresh stack (CI's
   `supabase start`) must write nothing, out loud.
2. **Find or create the record** by date/number; two matches → `raise exception`.
   Carry venue and lead from the calendar row the way the app's own button does.
3. **Calendar row**: `update … where lead = ''` (and the same for location and
   description), so a row he has corrected by hand is left as he left it.
4. **Attendance**: `insert … select … from public.members m where not exists (row)`,
   present for the named, absent for the rest.
5. **Fines**: `insert … select … where not exists (record, member, rule)`; for
   `for-sent` the amount is `50 + 5 * minutes` in the SQL.
6. **Read back inside the block** and `raise exception` unless exactly the expected
   fines at the expected amounts sit on the evening and the record holds one row
   per member. An exception rolls the whole block back.

Header comment: quote his message verbatim, say what was already on the record when
the block ran, and why each guard is there. The shape to copy is
`supabase/migrations/20260911163428_moede_30_late_fines.sql` and its follow-up
`…_moede_30_evening.sql`.

No separate dry run. The block's own assertions are the dry run; a failure rolls
back and records no version. (The first time, a dry run cost record id 31 for
nothing.)

## Call 3 — read back and take the version

One `execute_sql` that returns the record, its attendance rows, its fines, the club
totals and the newest `schema_migrations` row. Then:

- copy the migration into `supabase/migrations/<version>_<name>.sql` under the
  **version production recorded**, so STATUS.md check 1 passes;
- `docs/STATUS.md`: the `_Updated` line and a dated paragraph with the new totals
  (fines rows / kr., outstanding, attendances rows / present, the record id);
- `docs/finance-reconciliation.md`: a new §17.x with the fines table for the evening;
- `tasks/done/T<next>-moede-<n>.md`: the ask verbatim, what was found, what was
  written, read-back, what is left for Lukas;
- `npm test`, `npm run build`, `npm run lint`; commit; push. No PR unless asked.

## The reply to Lukas

Plain Danish, no file names, no jargon, no code. A small table of the fines. Who
was marked absent. What is left to him (a venue to correct, a no-show to confirm).
The outstanding total, and that billing it is his decision.
