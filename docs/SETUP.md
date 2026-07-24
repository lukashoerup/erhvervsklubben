# Setup

How to run this project on the lenovo. Environment, commands, gotchas, and where
things live. For dated war-stories see [LEARNINGS.md](LEARNINGS.md).

## Prerequisites (already installed on the lenovo, 2026-07-24)
- Node 22, npm — `package.json` scripts.
- Docker 29 — the local Supabase stack. The `lukashoerup` user is in the `docker`
  group, **but group membership doesn't apply in non-login shells**, so scripts
  wrap docker calls in `sg docker -c "..."` (see `scripts/rls-test.sh`). Ad-hoc:
  `sg docker -c "docker ps"`.
- Supabase CLI 2.109 — `supabase` (installed via .deb).

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

## Local stack facts
- Postgres **17** locally (Supabase CLI default) vs prod **15**. Forcing 15 broke
  GoTrue locally; the engine version doesn't affect what we test. See LEARNINGS.
- Local anon/service keys are the well-known Supabase demo keys (not secret).
- Read connection env at runtime with `source scripts/test-env.sh` (populates
  `SUPABASE_URL` / `SUPABASE_ANON_KEY` / `SUPABASE_SERVICE_ROLE_KEY` from
  `supabase status`). The RLS runner does this for you.
- DB shell: `sg docker -c "docker exec supabase_db_erhvervsklubben psql -U postgres -d postgres"`.

## Where things live (NOT in git)
- **Prod data backup:** `~/backups/erhvervsklubben/` (mode 600 — contains member
  emails). A read-only snapshot taken before any work.
- **Secrets:** `~/.secrets/` (never read or printed).
- **Generated seed ids:** `tests/rls/seed-ids.json` (gitignored; regenerated each seed).
- Prod Supabase project: `urlabzyihqrsdeasvrfe` (Supabase MCP for read-only inspection).

## Do-not-touch
- Production Supabase **data** — dev/CI never holds prod credentials; only the
  local stack and (later) a staging clone.
- The old Lovable site stays live until an explicit, Lukas-present cutover.
- `~/.secrets/`, `~/backups/`, `.env`.
