# Erhvervsklubben

Rebuild of a Copenhagen club's members site (currently a Lovable app) — a better,
mobile-friendly frontend on the SAME Supabase backend. Old site stays live until
cutover; production data must never be lost.

## Commands
- Test: `npm test`
- Build: `npm run build`
- Lint: `npm run lint`
- Dev: `npm run dev`

## Contract (non-negotiable)
- Run test + build + lint BEFORE every commit. NEVER commit on red.
- Work on a branch `task/T<id>-<slug>`. Never directly on main.
- Commit per completed task (atomic — rollback = one revert).
- NEVER add dependencies without Lukas's approval.
- NEVER touch: production Supabase data, `~/.secrets/`, `~/backups/`, `.env`.
- Dev/CI NEVER holds prod credentials — only local stack + staging.
- Max 3 attempts on the same failing test → stop, note it in the task file, move on.
- Done = tests green + affected docs updated + task file moved to `tasks/done/`.

## Autonomy boundary (agreed with Lukas 2026-07-24)
**Proceed without asking:** anything inside an approved plan/task file —
expanding agreed test suites, building pages per the reviewed spec, fixing red
tests, updating docs.
**Always stop and ask first:** schema or RLS changes, new dependencies,
deploys, cutover, anything touching prod data or secrets.
**Blocked on a decision?** Park it: write the question into the task file,
push, notify Lukas (Telegram if available), and continue with unblocked work.
Lukas answers via the Claude app; the answer gets committed to the task file.

## Start here after a fresh session
Read **docs/STATUS.md** — where we are, what's green, what's next. Then SETUP.md
to bring the local stack up. The repo is the memory: trust `git log` + a green
test run, never a status summary.

## Document routing (read ONLY when needed)
| Working on... | Read first |
|---|---|
| Current status / what to do next | docs/STATUS.md |
| Components, dataflow, interfaces | docs/ARCHITECTURE.md |
| Running it, commands, gotchas | docs/SETUP.md |
| Decisions + why + open questions | docs/PROJECT.md |
| Dated gotchas / war-stories | docs/LEARNINGS.md |
| What the old app is (schema, RLS, routes, design) | docs/DISCOVERY.md |
| The rebuild plan + phases | docs/PLAN.md |
| Test spec + review findings | docs/PLAN-REVIEW.md |
| Verbatim schema/RLS to reproduce | docs/schema-snapshot-2026-07-23.sql |
| Cross-project patterns | `workbench` repo → context/PATTERNS.md |

## Stack
React 19 + Vite + TS + Tailwind v4 + supabase-js + React Router + TanStack Query
+ Recharts. Tests: Vitest + RTL (+ Playwright e2e later). Hosting: Vercel.

## Theme seam
All colors/spacing live as tokens in `src/index.css` (`@theme`). Components use
tokens only, so Lukas's Claude Design template reskins in one file (task T031/T070).

## Docs duty
Any change that invalidates a docs statement fixes it in the same commit.
New decisions → docs/PROJECT.md. Dated gotchas → `workbench` repo → context/LEARNINGS.md.
