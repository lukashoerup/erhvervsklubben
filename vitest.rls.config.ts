import { defineConfig } from 'vitest/config'

// RLS integration tests: node environment, hit the local Supabase stack over
// HTTP. Kept separate from the default (jsdom, src-only) config so `npm test`
// stays fast and offline. Run via `npm run test:rls` (needs the stack up).
export default defineConfig({
  test: {
    include: ['tests/rls/**/*.test.ts'],
    environment: 'node',
    globals: true,
    testTimeout: 20000,
    hookTimeout: 20000,
  },
})
