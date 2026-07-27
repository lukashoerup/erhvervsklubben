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

/**
 * The smallest this element can be, in px, according to its own classes.
 *
 * jsdom does no layout, so a tap target cannot be measured here — the class
 * list is the only thing there is to read, which is honest about what this
 * suite can and cannot prove. Tailwind's spacing scale is 0.25rem a step, so
 * `min-h-12` is 48 px: the design system's own floor ("TOUCH Min. 48 × 48 px"),
 * and past the 44 px everyone else asks for.
 */
export function minTapHeightPx(el: HTMLElement): number {
  const found = el.className.match(/min-h-(\d+)/)
  return found ? Number(found[1]) * 4 : 0
}
