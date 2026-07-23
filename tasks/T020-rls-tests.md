# Task: T020-T022 RLS behaviour suite (IN PROGRESS)

## Goal
Implement the full ~50-case RLS matrix from docs/PLAN-REVIEW.md Part B.

## Status
Harness proven: 4 clients (anon/admin/member1/member2) + service client vs the
local stack; 9 representative cases green (anon boundaries, member write denial,
admin CRUD, event_evaluations isolation, forge, self-escalation, profiles own-only).
NEXT: expand to the full per-table × per-actor × per-operation matrix (N/E/AR/A/
P/M/EV/T groups). Fable to review coverage.
