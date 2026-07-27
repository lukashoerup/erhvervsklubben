import { Navigate, Route, Routes } from 'react-router-dom'
import { RequireAccess } from './routes/RequireAccess'
import { Shell } from './routes/Shell'
import Login from './pages/Login'
import Landing from './pages/Landing'
import Home from './pages/Home'
import Anciennitet from './pages/Anciennitet'
import Moeder from './pages/Moeder'
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

      {/* Outside the Shell, deliberately: the Shell is the members' furniture —
          a tab bar to pages a stranger cannot open, and a "Log ud" button. The
          landing page carries its own. */}
      <Route index element={<Landing />} />

      <Route element={<Shell />}>
        <Route path="/hjem" element={<RequireAccess access="member"><Home /></RequireAccess>} />
        <Route path="/anciennitet" element={<RequireAccess access="member"><Anciennitet /></RequireAccess>} />
        <Route path="/moeder" element={<RequireAccess access="member"><Moeder /></RequireAccess>} />
        <Route path="/nyheder" element={<RequireAccess access="member"><Nyheder /></RequireAccess>} />
        <Route path="/regler" element={<RequireAccess access="member"><Regler /></RequireAccess>} />
        <Route path="/oekonomi" element={<RequireAccess access="member"><Oekonomi /></RequireAccess>} />
      </Route>

      {/* An unknown URL goes to the landing page, which is now public — so a
          mistyped or stale link shows the club rather than a password box, and
          a signed-in member is forwarded on to /hjem from there. */}
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}
