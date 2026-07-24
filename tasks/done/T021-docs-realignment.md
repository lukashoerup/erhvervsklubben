# Task: T021 docs realignment + discovery artifacts into git

## Goal
Docs stop assuming the lenovo is the workspace (dev now happens on Mac / cloud
sessions / CI), the agreed autonomy boundary lives in CLAUDE.md, and the
discovery tooling is preserved in the repo instead of a loose home directory.

## Acceptance criteria
- [x] CLAUDE.md has the autonomy boundary (agreed 2026-07-24)
- [x] SETUP.md is machine-agnostic; lenovo specifics are marked as such
- [x] `scripts/discovery-capture.py` + `docs/discovery-network-model.json` committed (PII-checked: clean); screenshots stay out of git, location documented
- [x] test + build + lint green

## Scope
**May change:** `CLAUDE.md`, `docs/`, `scripts/`
**Must NOT touch:** `src/`, `supabase/`, `tests/`

## Docs affected
CLAUDE.md, SETUP.md — this task IS the docs work.

## Size check
Docs + two file copies.

## Working notes (agent fills in)
- Repo went to GitHub (private, `lukashoerup/erhvervsklubben`) earlier today;
  this realignment reflects the new interface model recorded in
  `workbench/SYSTEM.md`.
