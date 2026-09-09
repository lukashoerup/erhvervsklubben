# T092 — Adopt the Workbench review and project partner workflow

## Goal
Make independent scrutiny of goals, code, architecture and working practices a
standard part of this project without asking Lukas to request routine checks.

## Authorization
2026-09-08: Lukas requested this across Workbench projects, explicitly including
Erhvervsklubben, and answered "Also update the GitHub project rules now".

## Acceptance criteria
- [x] Local versioned copy matches Workbench's canonical shared policy.
- [x] CLAUDE.md and its AGENTS.md symlink expose the policy and review rules.
- [x] Project-specific permissions remain intact; current guidance respects
      the already-settled decision to keep fine recording with admins.
- [x] Decision and status records distinguish adopted rules from unconfigured
      automated review triggers and scheduled partner check-ins.
- [x] Unit tests, build and lint pass; affected docs updated.

## Scope
May change: CLAUDE.md, docs/WORKBENCH.md, docs/PROJECT.md, docs/STATUS.md,
this task. No application, database, credential, CI or deployment changes.

## Docs affected
The files above. Workbench owns policy changes; this project retains its goals
and permissions and receives a versioned local copy for offline sessions.

## Working notes
Codex authored this policy adoption; no independent Claude review has run.
Background automation must be configured and verified separately.

## Validation
- npm test: 480 tests passed in 33 files.
- npm run build: passed; existing large-bundle warning remains.
- npm run lint and git diff --check: passed.
- Local policy matches Workbench byte for byte; AGENTS.md resolves to CLAUDE.md.
- No app or database code changed. The separate database integration job runs in CI.

## Follow-up decision — 2026-09-09
Lukas chose questioning whether a quiet project is still worth pursuing as the
default. Policy version 2026-09-09.1 reflects that preference in both projects.
