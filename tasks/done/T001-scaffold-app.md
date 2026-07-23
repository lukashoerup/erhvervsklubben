# Task: T001 scaffold-app

## Goal
A React+Vite+TS+Tailwind app skeleton with a green test/build/lint pipeline.

## Acceptance criteria
- [x] Vite + React 19 + TS scaffold, Tailwind v4 via @tailwindcss/vite
- [x] Vitest + React Testing Library + jsdom wired; one smoke test passes
- [x] `npm test`, `npm run build`, `npm run lint` all green
- [x] Theme tokens live in src/index.css @theme (the design-template seam)
- [x] CLAUDE.md index + docs/PROJECT.md decision log

## Scope
**May change:** repo root, src/, package.json, tsconfigs, vite.config.ts
**Must NOT touch:** docs/DISCOVERY|PLAN|PLAN-REVIEW, prod Supabase, ~/backups

## Docs affected
CLAUDE.md, docs/PROJECT.md created.

## Working notes
Merged Vite react-ts template into the existing repo (preserving docs/tasks/tests).
tsc needed `vitest/globals` + `@testing-library/jest-dom` in tsconfig.app types to
build with the test file present. Done: test 1 passed, build ok, lint clean.
