# Setup

How to run this project on any machine (Mac, cloud session, CI, or the lenovo).
Environment, commands, gotchas, and where things live. For dated war-stories
see [LEARNINGS.md](LEARNINGS.md).

## Prerequisites
- Node 22+, npm — `package.json` scripts.
- Docker — only for the local Supabase stack (RLS tests). Unit tests, lint and
  build need no Docker and run anywhere.
- Supabase CLI 2.x.

**Lenovo quirk:** the `lukashoerup` user is in the `docker` group, but group
membership doesn't apply in non-login shells, so scripts wrap docker calls in
`sg docker -c "..."` (see `scripts/rls-test.sh`). Ad-hoc: `sg docker -c "docker ps"`.

## First-time / fresh clone
```
npm install
npm run db:start          # boots the local Supabase stack (Docker; first run pulls images)
npm run test:rls:reset    # applies migrations + seed + auth users, runs RLS tests
```

## Everyday commands
| Command | What |
|---|---|
| `npm run dev` | Vite dev server |
| `npm test` | component/unit tests (jsdom, fast, offline) |
| `npm run build` / `npm run lint` | tsc build / oxlint |
| `npm run db:start` / `db:stop` | start/stop the local Supabase stack |
| `npm run db:reset` | re-apply migrations + `seed.sql` (⚠️ does NOT seed auth users) |
| `npm run test:rls` | RLS integration tests (stack must be up) |
| `npm run test:rls:reset` | full reset + `seed.sql` + `seed-auth.mjs` + RLS tests |

**Seeding is two steps.** `seed.sql` loads the user-independent data; auth users
must be created via the GoTrue admin API (`scripts/seed-auth.mjs`) — raw
`auth.users` INSERTs fail GoTrue's schema scan. Only `test:rls:reset` runs both.

## CI — what judges a push
`.github/workflows/ci.yml`, on every push and PR. Two jobs:

| Job | Runs | Why separate |
|---|---|---|
| `checks` | lint → `tsc -b` + build → `npm test` | Seconds, offline. A lint error should not wait behind a stack boot. |
| `rls` | installs the Supabase CLI, `supabase start`, `npm run test:rls:reset` | Minutes — it pulls container images. Failing here is a policy regression, not a build error. |

The `rls` job runs the repo's own script rather than restating its steps in
YAML, so CI and a laptop execute literally the same sequence.

**This is what makes RLS work possible from a cloud session.** Those tests need
Docker; a session without it cannot run them, and an agent that writes RLS tests
it cannot execute is asserting rather than proving. CI is the thing that keeps
"tests are the judge, never an agent's self-report" true when the author has no
stack.

The CLI is installed globally in the runner at a pinned version, not via a
marketplace action — an action is a dependency, and the contract forbids adding
those unasked. A global install touches the runner only; nothing enters
`package.json`. Bump `SUPABASE_CLI_VERSION` in the workflow deliberately: an
unpinned CLI would let an upstream release turn the suite red with no change
here, and it would read as a policy regression rather than a version bump.

Claude Code hooks live in `.claude/settings.json`: oxlint after every edit, the
unit suite on session stop. Both are fast and offline; the RLS suite is
deliberately not hooked, since it needs the stack running.

## Local stack facts
- Postgres **17** locally (Supabase CLI default) vs prod **15**. Forcing 15 broke
  GoTrue locally; the engine version doesn't affect what we test. See LEARNINGS.
- Local anon/service keys are the well-known Supabase demo keys (not secret).
- Read connection env at runtime with `source scripts/test-env.sh` (populates
  `SUPABASE_URL` / `SUPABASE_ANON_KEY` / `SUPABASE_SERVICE_ROLE_KEY` from
  `supabase status`). The RLS runner does this for you.
- DB shell: `sg docker -c "docker exec supabase_db_erhvervsklubben psql -U postgres -d postgres"`.

## Deployment — Vercel

The Vercel project builds this repo from GitHub, so its configuration lives in
`vercel.json` rather than in the dashboard: a setting only someone with the
dashboard open can see is a setting nobody can review in a diff.

Three build variables are set there, and the third is the important one:

| Variable | Why |
|---|---|
| `VITE_SUPABASE_URL` | The prod project. Reads only — see below. |
| `VITE_SUPABASE_ANON_KEY` | Publishable key; it is designed to ship inside a browser bundle. Not a secret, and **not** the service-role key, which must never appear here. |
| `VITE_READONLY=1` | Makes writing impossible, not merely hidden. |

**`VITE_READONLY` is `0` since 2026-07-27 — the deployed app writes to
production.** Lukas lifted the lock once he held a full data export and
screenshots of the anciennitet history. Before that, every deployment refused
to write: `supabase.ts` rejects `insert`/`update`/`upsert`/`delete`/`rpc` and
the write-shaped UI is not rendered.

**The switch stays, and stays tested both ways** (`src/lib/supabase.test.ts`).
Set it to `1` for any build that should read production without being able to
change it — a preview for review, a session inspecting live data. It is one
line, and it is the cheapest safety net in the project.

It is forced off in the demo build regardless of this file: `build:demo` is a
production build and inherited the flag from here, which silently stripped the
treasurer's whole fine-recording screen out of the build made for showing the
app. `READONLY` is now `&& !DEMO` in code — there is no database behind the
demo, so there is nothing for it to protect.

`fines`, `payments` and `attendance_records.meeting_date` were added to the
prod project on 2026-07-27 (migrations `add_fines_and_payments`,
`add_meeting_date_to_attendance_records`). Both are additive; no existing row
was modified, and the date backfill deliberately filled nothing rather than
guess, because the events' titles do not match `Møde #N`. So every meeting is
currently undated in production.

`rewrites` sends every unmatched path to `index.html`: the app routes in the
browser, so without it a refresh on `/nyheder` would 404 from the CDN.

## Where things live (NOT in git)
- **Prod data backup:** `~/backups/erhvervsklubben/` (mode 600 — contains member
  emails). A read-only snapshot taken before any work.
- **Discovery screenshots of the old app:** `~/erhverv-review/shots/` on the
  lenovo — kept out of git because they show member names. The capture script
  and its PII-free output ARE in git: `scripts/discovery-capture.py`,
  `docs/discovery-network-model.json`.
- **Secrets:** `~/.secrets/` (never read or printed).
- **Generated seed ids:** `tests/rls/seed-ids.json` (gitignored; regenerated each seed).
- Prod Supabase project: `urlabzyihqrsdeasvrfe` (Supabase MCP for read-only inspection).

## Do-not-touch
- Production Supabase **data** — dev/CI never holds prod credentials; only the
  local stack and (later) a staging clone.
- The old Lovable site stays live until an explicit, Lukas-present cutover.
- `~/.secrets/`, `~/backups/`, `.env`.
