#!/usr/bin/env bash
# Run the RLS integration tests against the local Supabase stack.
# Populates connection env from `supabase status`, then runs vitest on tests/rls.
# With --reset, first rebuilds the DB from migrations + reseeds (schema/seed changes).
set -euo pipefail
cd "$(dirname "$0")/.."

_sg() { if docker info >/dev/null 2>&1; then "$@"; else sg docker -c "$*"; fi; }

if ! _sg supabase status >/dev/null 2>&1; then
  echo "Local Supabase stack is not running. Start it with: npm run db:start" >&2
  exit 1
fi

# shellcheck disable=SC2046
export $(_sg supabase status -o env | sed -n \
  's/^API_URL=/SUPABASE_URL=/p; s/^ANON_KEY=/SUPABASE_ANON_KEY=/p; s/^SERVICE_ROLE_KEY=/SUPABASE_SERVICE_ROLE_KEY=/p' \
  | tr -d '"')

if [ "${1:-}" = "--reset" ]; then
  echo "Resetting DB from migrations + seed..."
  _sg supabase db reset >/dev/null
  echo "Seeding auth users..."
  node scripts/seed-auth.mjs
fi

npx vitest run --config vitest.rls.config.ts
