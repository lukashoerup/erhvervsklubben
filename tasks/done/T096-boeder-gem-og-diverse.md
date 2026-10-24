# Task: T096 — fines would not save, and a "Diverse" fine

**Status:** done 2026-10-24, code only — **not live until merged to `main`** (deploys,
Lukas's call). Branch `task/T096-boeder-gem-og-diverse`, on top of T094 → the møde #30
branch. Not on T095: that one is parked, and a yes to this must not carry it.

## The ask
Lukas, during møde #31: *"Jeg kan ikke registrere bøder. Den kan ikke gemme. Kan du
ikke lave en diverse bøde også. Så man kan skrive et beløb ned under diverse som
bøde."*

## Why it would not save — proved, not guessed
* Production's database log, 2026-10-24 11:16:54–11:17:03 UTC: five errors, *"there is
  no unique or exclusion constraint matching the ON CONFLICT specification"* — his five
  taps.
* `fines` indexes in production: `fines_one_per_offence … (record_id, member_name,
  rule_id) WHERE (rule_id <> 'aftalt')`, and no plain unique constraint on those
  columns. `20260808180000_adhoc_fines.sql` dropped it so bets could repeat.
* `/oekonomi` saved with `upsert(…, { onConflict: 'record_id,member_name,rule_id' })`.
  Postgres only infers a partial index as the arbiter when the INSERT repeats its
  predicate; PostgREST's `on_conflict` cannot. So **every** save from the app has
  failed since 2026-08-08 15:47 UTC. Møde #29's bets and møde #30's fines were written
  by migration, which is why nobody met it until today.
* The unit tests passed throughout because the mock accepted any `upsert`.

## What changed
* `useRecordFines` (Oekonomi.tsx): read the evening's fines; a voted offence already
  there is **updated by id** (the regulativ's one-per-offence, and how a wrong minute
  count gets corrected); everything else — new offences and every diverse fine — is
  **one insert**, so a refused row refuses the batch. The form empties after a save,
  so a second tap cannot write the same diverse fine twice.
* `FineCapture`: a **Diverse** button per member adds an entry with an amount field
  and a "Hvad for" field, edited in place, removable, several allowed. Save stays shut
  while one is unfinished, with the reason on screen. Amount 1–1.000 kr. (typo guard).
  It writes `rule_id = 'aftalt'` with the note — the database requires the note.
* `describeRule('aftalt')` reads *"Diverse — aftalt uden for regulativet"*.
* Tests: the Oekonomi mock has no `upsert` (the old call is now a TypeError), applies
  `.eq` to reads, and records inserts and updates. New: insert on a fresh fine;
  update-by-id on a correction; a diverse fine end to end; two on one man; the typo
  guard and removal. One old test's comment was wrong about what the first tap on Save
  does (it always saved) and now says so.

## Verified
* `npm test` 487 passing, `npm run build`, `npm run lint` clean.
* Not exercised against a real database: no Docker here, and writing test fines into
  production to prove it is not on. The calls are a plain `insert` and an `update … eq
  id` on columns production has (`note` included), under the same `Admins write fines`
  policy the upsert ran under.

## Left for Lukas
* **Merge to `main`** so it goes live — and with it T094/T095 and møde #30.
* Tonight's fines: until it is live, send them to Claude and they go in by migration.
