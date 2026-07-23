#!/usr/bin/env bash
# Export local Supabase connection env for the RLS/integration tests.
# Usage:  source scripts/test-env.sh   (needs the local stack running)
# Works whether or not the caller is in the docker group (falls back to sg).
_status() {
  if docker info >/dev/null 2>&1; then
    supabase status -o env
  else
    sg docker -c "supabase status -o env"
  fi
}
_env="$(_status 2>/dev/null)"
export SUPABASE_URL="$(printf '%s\n' "$_env" | sed -n 's/^API_URL="\?\([^"]*\)"\?/\1/p')"
export SUPABASE_ANON_KEY="$(printf '%s\n' "$_env" | sed -n 's/^ANON_KEY="\?\([^"]*\)"\?/\1/p')"
export SUPABASE_SERVICE_ROLE_KEY="$(printf '%s\n' "$_env" | sed -n 's/^SERVICE_ROLE_KEY="\?\([^"]*\)"\?/\1/p')"
export SUPABASE_DB_URL="$(printf '%s\n' "$_env" | sed -n 's/^DB_URL="\?\([^"]*\)"\?/\1/p')"
[ -n "$SUPABASE_URL" ] && echo "test env ready: $SUPABASE_URL" || echo "could not read supabase status — is the stack up?"
