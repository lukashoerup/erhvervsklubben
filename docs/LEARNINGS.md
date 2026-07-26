# Learnings — dated, can expire

Experiences, not decisions (those live in [PROJECT.md](PROJECT.md)). Each entry is
what was true on its date. Delete entries that stop being true.

## 2026-07-24 — Local Supabase must run its default Postgres (17), not prod's (15)
Setting `major_version = 15` in `config.toml` (to match prod) broke the bundled
GoTrue: logins/createUser failed with `converting NULL to string is unsupported`
on `confirmation_token` and Kong "invalid response from upstream". The CLI's GoTrue
image expects its default PG (17); a mismatched engine leaves the auth schema
half-migrated. Fix: keep local at 17. Parity is checked on our objects (schema,
RLS, policies), not the engine version. Changing `major_version` needs
`supabase stop --no-backup` then `start` — the old data volume is version-locked.

## 2026-07-24 — Seed auth users via the admin API, never raw SQL
Raw `INSERT INTO auth.users (...)` makes GoTrue throw "Database error querying
schema" because token columns end up NULL. Create users through the GoTrue admin
API instead (`supabase.auth.admin.createUser`, service-role key). The
`on_auth_user_created` trigger then provisions the profile automatically; elevate
admins and add mappings afterward. See `scripts/seed-auth.mjs`.

## 2026-07-24 — A hand-authored migration must add PostgREST grants
Hosted Supabase auto-grants new tables to `anon`/`authenticated`/`service_role`;
a migration written by hand does not. Without `grant ... on all tables` +
`alter default privileges`, PostgREST returns permission-denied (42501) instead
of RLS's empty result, and the service-role seeder can't write. Grants are broad
by design — **RLS still governs which rows each role sees.** Consequence/rule:
every future migration that creates a table MUST enable RLS in the same migration,
or the default-privileges grant makes it instantly anon-accessible.

## 2026-07-24 — Verify fidelity against prod, not against a summary
The captured schema snapshot was "shape only", so the first migration invented
details. Checking against the live prod catalog caught two real divergences:
`event_evaluations`' two FKs are NO ACTION (I'd written CASCADE), and the id
columns are `serial`/`nextval` (I'd used identity columns). It also showed a
"blocker" from review (8 vs 9 rating aspects) was a *docs* miscount — prod has 9.
Lesson: `pg_get_functiondef`, `pg_constraint.confdeltype`, `information_schema`
against the real DB beat any prose description.

## 2026-07-24 — RLS denial semantics differ by operation (test accordingly)
PostgREST + RLS: a filtered SELECT/UPDATE/DELETE returns **success with 0 rows**
(not an error); an INSERT/UPDATE violating WITH CHECK returns **error 42501**.
Also: `profiles` SELECT is own-row-only *even for admins* (no admin-read-all
policy), so tests must verify true DB state via a service-role client, not by
reading as the admin user. Both facts are baked into `tests/rls/`.

## 2026-07-26 — Tailwind v4 ignores what wraps an `@theme` block
Every `@theme` block is collected into one `:root` regardless of the at-rules
around it. A second `@theme` inside `@media (prefers-color-scheme: light)` is
therefore **not** scoped to light mode — it overwrites the first set
unconditionally, and one whole palette disappears from the build. That is what
happened here: the shipped stylesheet contained only the light values, so the
agreed dark ground never rendered anywhere. Nothing failed, nothing warned, and
the result looked deliberate.

Define the tokens once in `@theme`, then override the **variables** in a plain
`:root` inside the media query — utilities compile to `var(--color-…)`, so that
is all it takes. `src/theme.test.ts` now fails on an indented `@theme`.

## 2026-07-26 — `100vh` puts a bottom tab bar below the fold on a phone
`100vh` is the viewport measured with the browser chrome hidden, so a
`min-h-screen` column with navigation at its end starts partly off-screen and
only becomes reachable by scrolling. `dvh` is the honest unit. Neither the unit
tests nor a desktop-sized browser show this; a 390×844 viewport does immediately.
