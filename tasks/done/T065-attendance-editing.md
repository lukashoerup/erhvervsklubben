# Task: T065 admin editing of the attendance records (phase 6)

## Lukas's requirement (2026-07-27)
> "Admin is currently only me (and Claude), and these can add and edit news,
> events, and the anciennitet events. That's it. Very simple."

The third of the three, and the last. News and events shipped as T063. This is
the attendance history — `attendance_records` and `attendances`, the tables the
Anciennitet page is built from and the only part of the club's records still
being typed straight into the database.

## What was built
- `src/components/MeetingEditor.tsx` — the form. The six record columns, and
  below them a two-column grid of member buttons at the design system's 48 px.
  Reuses `EditForm` from T063, which grew a `children` slot for it.
- `src/data/useClubData.ts` — `useSaveMeeting` / `useDeleteMeeting`. Separate
  from `useSaveRow` because a meeting is two tables written together with a
  serial id read back between them, which the flat-text mutations cannot express
  honestly. `EditableTable` and the `AFFECTED` invalidation map are shared, and
  a meeting invalidates `finance` as well as `attendance`.
- `src/pages/Anciennitet.tsx` — "Registrér møde", and Rediger/Slet on every
  card. `MeetingCard` grew an `actions` slot; a member's card is unchanged.
- `src/data/derive.ts` — `Meeting.venues`, the three venue columns as stored.
- `src/pages/Oekonomi.tsx` — the "Møder uden dato" date field removed, the count
  kept. See the consolidation note below.
- `src/data/demo.ts` — `demoSaveMeeting` / `demoDeleteMeeting`, so the demo
  build never reaches the club's project.
- `src/test/writes.ts` — records every `.eq()` filter, not only `id`, and
  answers `.select().single()` on an insert with the row the database would have
  made. Attendance is addressed by `(record_id, member_name)`, so an id-only
  mock could not tell a write aimed at the wrong member from a correct one.
- 24 new tests. `npm test` 182 → 206, `npm run build` and `npm run lint` clean.

No migration. No new dependency. No SQL — RLS has allowed admins to write both
tables since the initial migration, verified in
`supabase/migrations/20260723202023_initial_schema.sql` rather than assumed.

## Decisions
- **A new meeting starts with everyone present.** Eight or nine of ten turn up,
  so ticking off the absentees is two taps where ticking on the attendees is
  eight — and the screen gets used the morning after a meeting, on a phone. The
  live count sits above the buttons so what is about to be written is on screen.
- **A member with no row keeps none.** 235 attendance rows over 29 meetings is
  not ten per meeting: a (meeting, member) pair with no row is a third state,
  and `buildRoster` counts `total` — the denominator under "X deltagelser af Y"
  — from the rows that exist. A two-position toggle has to show that member as
  absent, but saving writes nothing unless the tick is changed *to* present.
  Otherwise opening a historical meeting and pressing Gem would grow every
  member's denominator across 29 meetings as a side effect of looking at it.
  Meetings the app creates do get a row per member, which is the shape the data
  was always supposed to have.
- **The date is set in one place, and that place is the meeting.** `/oekonomi`
  had a date field per undated meeting, left over from the finance work. The new
  editor covers the same column with the lead, the venues and the attendance
  beside it, so the field there became the same write by a worse route — it
  could set a date and nothing else. The *count* stayed: how many meetings lack
  a date is a fact about those books, and it is what the finance chart's empty
  state is already counting. The cost is a slower bulk backfill, which is a
  one-time job of 29 rows whose values have to be looked up anyway.
- **The new meeting's date is not prefilled with today.** `Moeder.tsx` prefills
  today for a *planned* event, where today is a lower bound. Here it would be
  wrong by one day every time, and silently — an empty date shows as "uden dato"
  on the card and as a counted reason on Økonomi. A visible gap beats an
  invisible error in the column the club's whole finance view hangs off.
- **`Meeting.venues` had to exist.** `route` drops the empty steps, so a meeting
  with no pre-drinks and one with no after-party are the same two strings. An
  editor rebuilding the columns from it shifts a venue one column left and saves
  it there — a silent corruption of the history. `route` is for reading, the new
  field is for correcting, and a test drives the exact case.
- **The editor can name someone the club has never recorded.** The roster is
  derived from the names in `attendances`; there is no members table. An
  eleventh member has no row anywhere, so without the "nyt medlem" field their
  first meeting would be the one meeting the app could not record.
- **Deleting counts what goes with it.** Both `attendances.record_id` and
  `fines.record_id` are `on delete cascade`, so a meeting is never one row and
  "Slet" reads as though it were. The second tap says "Møde 27 · Saaby · 9.
  april 2026" — the number repeats in this club's data, so the lead and the date
  are what identify the evening — and "4 deltagelser og mødets bøder slettes
  med."
- **Not a transaction, deliberately.** PostgREST cannot offer one. A failure
  halfway leaves the meeting saved and some ticks not, which is visible on the
  next render and fixed by pressing Gem again. The alternative — delete the
  attendance rows and re-insert them — turns the same failure into a meeting
  whose attendance is gone.

## Verified in a browser
`npm run build:demo` + `vite preview`, Chromium at 420 × 900, both themes, as a
member and as an admin.
- Create, correct and delete all work end to end: 28 cards → 29 after saving a
  new meeting with two members ticked off, → 28 after deleting it, with the
  anciennitet bars and the "af 29" denominator following.
- **Zero offsite requests** and no console errors, in a build that carries the
  live project's URL and anon key.
- Every one of the 20 controls in the open form measures at least 48 × 48, and
  the two-column ticker fits 420 px with no horizontal scroll.
- Contrast: 0 failing text/background combinations on `/anciennitet` with the
  editor open and with the delete confirmation open, in both themes, measured
  from composited pixels the way T064 did it.

## Known gaps
- **Not run against a database.** The local Supabase stack was not brought up in
  this session, so `useSaveMeeting`'s two-table sequence is proven against the
  mock and the demo, not against PostgREST or RLS. The RLS suite already asserts
  that an admin may write both tables and a member may not.
- **`meeting_date` is written without the fallback the read has.**
  `readRecords` retries without the column if the database is older than the
  code; a save does not. Production has had the column since 2026-07-27, so this
  only matters against a database that has not been migrated.
- **A duplicate `(record_id, member_name)` would be updated twice.** There is no
  unique index on the pair — the club's data does not have one — so the
  attendance update is a filter, not an upsert. Both rows are equally wrong
  today; adding the index is a migration and therefore Lukas's call.
- **No bulk backfill.** Filling the 29 missing dates is 29 trips through the
  editor. Deliberate, but if it turns out to be the wrong call the fix is a
  worklist that opens the editor, not a second input.
