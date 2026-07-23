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

## Document routing (read ONLY when needed)
| Working on... | Read first |
|---|---|
| What the old app is (schema, RLS, routes, design) | docs/DISCOVERY.md |
| The rebuild plan + phases | docs/PLAN.md |
| Test spec + review findings | docs/PLAN-REVIEW.md |
| Verbatim schema/RLS to reproduce | docs/schema-snapshot-2026-07-23.sql |
| Decisions + why | docs/PROJECT.md |
| Cross-project patterns | ../../workbench-context/PATTERNS.md |

## Stack
React 19 + Vite + TS + Tailwind v4 + supabase-js + React Router + TanStack Query
+ Recharts. Tests: Vitest + RTL (+ Playwright e2e later). Hosting: Vercel.

## Theme seam
All colors/spacing live as tokens in `src/index.css` (`@theme`). Components use
tokens only, so Lukas's Claude Design template reskins in one file (task T031/T070).

## Docs duty
Any change that invalidates a docs statement fixes it in the same commit.
New decisions → docs/PROJECT.md. Dated gotchas → ../../workbench-context/LEARNINGS.md.
