import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { ReactNode } from 'react'

/**
 * A QueryClient for tests.
 *
 * Retries off and no cache between tests: a retrying query turns a deliberate
 * failure case into a slow one, and a shared cache lets one test's data leak
 * into the next — both produce failures that look like flakes.
 */
export function withQuery(children: ReactNode) {
  const client = new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: 0, staleTime: 0 },
      mutations: { retry: false },
    },
  })
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>
}
