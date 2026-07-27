import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter, HashRouter } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import './index.css'
import App from './App.tsx'
import { AuthProvider } from './auth/AuthProvider'
import { DemoAuthProvider } from './auth/DemoAuthProvider'
import { DEMO } from './data/demo'

// One retry: a phone on a flaky connection should not show an error page for a
// single dropped request, but a genuinely broken query should surface quickly
// rather than spin.
const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: 1, staleTime: 30_000 } },
})

// The real site owns its domain and serves index.html for any path, so it gets
// clean URLs. The demo is a single file that can be opened from anywhere, with
// no server rewriting anything — a path-based router would 404 on reload and
// break under any sub-path. The hash keeps every page reachable regardless.
const Router = DEMO ? HashRouter : BrowserRouter

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <Router>
        {/* The demo provider exists only in a VITE_DEMO build, so a preview can
            be clicked through without pointing a public URL at the club's real
            records. The real provider is untouched. */}
        {DEMO ? (
          <DemoAuthProvider>
            <App />
          </DemoAuthProvider>
        ) : (
          <AuthProvider>
            <App />
          </AuthProvider>
        )}
      </Router>
    </QueryClientProvider>
  </StrictMode>,
)
