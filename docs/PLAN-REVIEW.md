# Plan review + test spec (Fable adversarial pass, 2026-07-23)

Adversarial review of docs/PLAN.md against docs/DISCOVERY.md and the real data.
Findings ranked. The enumerated test list at the bottom is the authoritative
spec that Phase 2/T02x and the component/e2e tasks implement.

## Blockers (fix before build starts)
- **B1 — No data backup until cutover.** The 235 attendances lived in one copy
  on a free-tier DB that already auto-paused once. FIXED IN PART 2026-07-23: a
  read-only snapshot (identity map + counts on disk at
  `~/backups/erhvervsklubben/`, full row-level data captured in session). Make a
  complete `pg_dump` the literal first build task (T000). Decide Q3 (paid tier?).
- **B2 — Staging clone recipe is broken as written.** (1) FK order omits
  `auth.users` — `profiles.id` FKs to it, so no profile can be inserted first.
  (2) "synthetic + FK remap" contradicts "row counts = prod" unless you create
  10 synthetic users with an explicit old→new UUID map applied to profiles.id,
  user_member_mapping.user_id, event_evaluations.user_id. (3) `handle_new_user`
  fires on synthetic user creation → auto-profile collides with copied profile
  PK; disable trigger during load or reconcile. (4) Serial sequences
  (attendances, attendance_records) must be `setval` to max(id) or the first
  "Add Record" hits a PK collision. Rewrite T014.
- **B3 — "verbatim policies" vs "no role escalation" precedence.** RESOLVED by
  reading the actual policy: `Only admins can update profiles` USING restricts
  to admins, so members cannot update profiles at all — no escalation hole.
  Verbatim == secure; no deviation needed. (See schema-snapshot SQL.)
- **B4 — Verbatim policies existed nowhere.** FIXED 2026-07-23: full policy +
  function + trigger DDL captured in docs/schema-snapshot-2026-07-23.sql. Parity
  test diffs against this snapshot.

## Should-fix
- **S1** pg_dump `--schema=public` does NOT miss the enum/functions (they're in
  public) — it misses the `auth.users` trigger + ownership/grants. Plan's
  wording was imprecise; T010 acceptance = the SP-* tests pass, incl. a real signUp.
- **S3/Q11** events & news SELECT are `USING (true)` for the `public` role —
  anonymous internet users can read the club's meeting venues/times via the REST
  API with just the anon key. Reproduced verbatim; DECIDE whether to keep.
- **S4** Missing matrix cells are a THIRD state: 235 ≠ 29×10. Late joiners
  (Kasper, Have) simply have no row for early meetings. Pivot contract must be
  cell ∈ {attended, absent, none}; totals count attended=true only.
- **S5** The matrix overflows already at 1280px (the "Have" column is clipped in
  the screenshot) — the desktop rebuild MUST use overflow-x + sticky Nr/Lead
  columns, not treat it as optional. Key rows by record_id, never meeting_number
  (duplicate #27 → duplicate React keys). The blank record 28 (meeting_number 27,
  empty lead/locations) must render without crashing.
- **S6** Cutover: `VITE_*` vars bake at build → rollback = revert + rebuild
  (minutes), true instant rollback is "use the old URL". Data can't be lost by
  migration (there is none) but CAN be corrupted by a new-admin-UI write bug
  post-cutover — pre-flight dump is that insurance. Password-reset emails follow
  the project Site URL; free-tier SMTP is rate-limited.
- **S8** Local RLS tests only prove the migration; add a read-only anon probe
  against PROD (S-06) at cutover to prove the live boundary.

## Nice-to-have
N2 accessibility (real <table>, labelled chips, focus mgmt in the drill-down);
N3 unmapped-login graceful degrade (2 auth users have no member mapping — a
test account and one member); N6 the landing "upcoming events" empty state is what members
see day one (all 10 events are in the past).

## Data facts confirmed from the backup (feed the seed + tests)
- 2 admins (Lukas, Saaby), 8 users. `Oskar` appears in attendance data but has
  NO auth user and NO mapping — member_name is free text, decoupled from logins.
- Duplicate meeting_number 27 = records id 27 (Rasmus/Restaurant Tokyo) and id 28
  (blank). Record id 28 has empty lead + empty main_location + null locations.
- `attendances` ids are not gap-free (row 173/172 out of order; id 196/198/etc
  missing) — do not assume contiguous ids.
- Only DELETE-less table policy set means event_evaluations can never be deleted
  by anyone via the API.

---

# Enumerated test spec
Fixtures (seed, T012): admin (role admin, name "Anders"), member1 (user, "Lukas"),
member2 (user, "Mads"); seed includes two attendance_records sharing
meeting_number 27 (one blank) and a late-joiner with rows only in later records.
Clients: anon, member1, member2, admin.
Denial semantics: RLS-filtered SELECT/UPDATE/DELETE → success with 0 rows;
INSERT/UPDATE violating WITH CHECK → error 42501. Every write-deny re-read via admin.

## A. Schema parity (SQL vs fresh local stack + prod snapshot)
- SP-01 all 7 tables + columns match snapshot (attendances.attended bool; events.time text; meeting_number has NO unique constraint)
- SP-02 user_role enum = {admin,user} exactly
- SP-03 get_user_role present, returns user_role, prosecdef=true, owner/search_path match
- SP-04 handle_new_user present, prosecdef=true, body matches
- SP-05 on_auth_user_created AFTER INSERT on auth.users EXECUTE handle_new_user, enabled
- SP-06 relrowsecurity=true for all 7 tables
- SP-07 pg_policies rowset byte-identical to snapshot (any extra/missing policy fails)
- SP-08 FK graph intact incl. user_member_mapping.user_id UNIQUE
- SP-09 normalized schema dump diff empty
- SP-10 both serial sequences exist and owned

## B. RLS behaviour (Vitest, 4 clients vs local stack) — the security net
news:      N1 anon SELECT allowed(2) · N2 member SELECT all · N3 anon INSERT 42501 · N4 member INSERT 42501 · N5 member UPDATE 0 rows · N6 member DELETE 0 rows · N7 admin CRUD ok
events:    E1 anon SELECT allowed · E2 member SELECT · E3 anon INSERT 42501 · E4 member INSERT/UPDATE/DELETE denied · E5 admin CRUD ok
attendance_records: AR1 anon SELECT 0 rows · AR2 member SELECT all (incl both #27) · AR3 anon INSERT 42501 · AR4 member INSERT 42501 · AR5 member UPDATE 0 · AR6 member DELETE 0 · AR7 admin CRUD ok
attendances: A1 anon SELECT 0 · A2 member SELECT all · A3 anon INSERT 42501 · A4 member INSERT own cell 42501 · A5 member UPDATE 0 · A6 member DELETE 0 · A7 admin CRUD/toggle ok
profiles:  P1 anon SELECT 0 · P2 member SELECT own(1) · P3 member SELECT other → per snapshot (own-only) · P4 self-escalation role=admin denied + no effect · P5 member UPDATE other 0 · P6 member INSERT 42501 · P7 member DELETE 0 · P8 admin UPDATE role both ways ok · P9 anon UPDATE 0
user_member_mapping: M1 anon SELECT 0 · M2 member SELECT own · M3 member INSERT (spoof) 42501 · M4 member UPDATE own 0 · M5 member DELETE own 0 · M6 admin CRUD ok, dup user_id UNIQUE fails
event_evaluations: EV1 anon SELECT 0 · EV2 member SELECT → only own, no error · EV3 member SELECT other.eq 0 · EV4 member INSERT own ok (8 ratings persist) · EV5 member INSERT user_id=other 42501 · EV6 member UPDATE other 0 · EV7 member DELETE other 0 (+ NO delete policy exists → own delete also denied, assert) · EV8 member UPDATE own ok
trigger:   T1 signUp → profiles row role='user' · T2 new user writes denied · T3 new user no mapping (0 rows) · T4 after admin sets role, get_user_role reflects immediately · T5 both policy styles allow/deny consistently

## C. Unit — seniority pivot (pure)
U-01 basic pivot shape (sorted by meeting_number desc, cell map) · U-02 missing cell = 'none' ≠ absent · U-03 late joiner (Kasper rows only records 16+) earlier = none, totals count attended only · U-04 duplicate meeting_number 27 → both rows kept, keyed by record_id · U-05 empty state no throw · U-06 blank record (id 28: empty lead/locations) renders, no crash · U-07 totals = attended=true only · U-08 member column order pinned (total desc, alpha tiebreak) · U-09 orphan attendance (record_id not in records) dropped+warn · U-10 da-DK date format · U-11 finance series (blocked Q1)

## D. Component (Vitest + RTL)
C-01 protected routes redirect to /login · C-02 public routes render · C-03 AdminOnly absent for member · C-04 present for admin · C-05 desktop matrix in overflow-x container, sticky Nr/Lead, 10 headers · C-06 mobile cards one per record_id (incl both #27) · C-07 three chip states w/ a11y labels · C-08 own-member highlight; unmapped user → no highlight no crash · C-09 drill-down timeline · C-10 duplicate-27 no dup-key warning · C-11 news date-desc da-DK · C-12 events.time verbatim · C-13 add-record form validation+payload · C-14 query error state visible · C-15 landing upcoming-events empty state (all events past)

## E. E2E smoke (Playwright, 390px + 1280px)
E2E-01 member login, no admin controls anywhere · E2E-02 admin sees Edit/Add · E2E-03 every route both roles, zero console errors · E2E-04 admin add-record round-trip persists · E2E-05 member: no UI controls AND server denies raw insert (42501) · E2E-06 390px = cards, no body h-scroll, ≥40px touch targets · E2E-07 1280px = matrix, scroll reveals last col, sticky stays · E2E-08 logout → bounced · E2E-09 signup end-to-end (member pages, no highlight, profile row) · E2E-10 anon boundary (landing ok, REST attendances denied) · E2E-11 mobile hamburger nav

## F. Staging clone & cutover (runbook checks)
S-01 staging counts = prod (235/29/10/8/10) · S-01b duplicate-27 survived (2 rows) · S-02 zero FK orphans post-remap · S-03 sequences bumped, insert+delete no PK collision · S-04 staging logins work · S-05 trigger provisions on staging signUp · S-06 PROD anon probe: events/news readable, attendances/records/profiles/mapping/evals denied · S-07 post-flip verify (29 meetings/235 cells, admin edit, old URL still works) · S-08 reset-email Site URL correct
