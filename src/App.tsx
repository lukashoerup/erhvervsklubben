import { Navigate, Route, Routes } from 'react-router-dom'
import { RequireAccess } from './routes/RequireAccess'
import { Shell } from './routes/Shell'
import Login from './pages/Login'
import Home from './pages/Home'
import Anciennitet from './pages/Anciennitet'
import Nyheder from './pages/Nyheder'
import Regler from './pages/Regler'
import Oekonomi from './pages/Oekonomi'

/**
 * The router. Access levels are declared in routes.ts rather than inline, so
 * there is one place to read when asking "who can see what" — and adding a page
 * without answering that question is a visible omission rather than a silent
 * one.
 *
 * No BrowserRouter here on purpose: main.tsx supplies it in the app, and tests
 * supply a MemoryRouter. That is what lets the routing rules be tested without
 * a browser or a database.
 */
export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />

      <Route element={<Shell />}>
        <Route index element={<RequireAccess access="member"><Home /></RequireAccess>} />
        <Route path="/anciennitet" element={<RequireAccess access="member"><Anciennitet /></RequireAccess>} />
        <Route path="/nyheder" element={<RequireAccess access="member"><Nyheder /></RequireAccess>} />
        <Route path="/regler" element={<RequireAccess access="member"><Regler /></RequireAccess>} />
        <Route path="/oekonomi" element={<RequireAccess access="member"><Oekonomi /></RequireAccess>} />
      </Route>

      {/* An unknown URL goes home, which then applies the same guard as any
          other member route — so a stray link cannot slip past the gate. */}
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}
