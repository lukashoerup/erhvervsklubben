import { describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { AuthContext, type AuthState } from '../auth/AuthContext'
import { withQuery } from '../test/harness'
import { client, reset } from '../test/writes'

/**
 * Both editing screens in a build that may read production but never write it.
 *
 * Its own file because `READONLY` is read at module scope, so the mode is a
 * property of the whole module graph rather than something one test can set.
 *
 * The client refuses every write verb on its own (see lib/supabase), so this is
 * the second of the two independent guarantees: the write-shaped UI is not
 * rendered either. Either alone would be a promise; together they survive
 * someone forgetting the other. And the *reading* must be untouched — a
 * preview that hid the club's own calendar would be lying about the club
 * rather than protecting it.
 */
vi.mock('../lib/supabase', () => ({ READONLY: true, supabase: () => client }))

const { default: Nyheder } = await import('../pages/Nyheder')
const { Moedekalender } = await import('../components/Moedekalender')
const { default: Anciennitet } = await import('../pages/Anciennitet')

/**
 * One button for both kinds of meeting since 2026-07-30. It was "Registrér møde"
 * beside the calendar's "Nyt møde i kalenderen", and Lukas: *"der ligger jo to
 * knapper der laver møder … Det er jo alt sammen møder."* The form routes on the
 * date it is given, so the label no longer says which table it will write.
 */
const NEW_MEETING = 'Nyt møde'

const PAGES = { nyheder: Nyheder, kalender: Moedekalender, anciennitet: Anciennitet }

function renderAsAdmin(page: keyof typeof PAGES) {
  reset({
    news: [
      { id: 'n1', title: 'Sommerfest 2026', excerpt: 'Hos Saaby.', author: 'Saaby', date: '2026-06-09' },
    ],
    events: [
      { id: 'e1', title: 'Erhvervsklub #29', date: '2099-08-13', time: '18.30', location: 'Propaganda', description: '' },
    ],
    attendance_records: [
      {
        id: 1,
        meeting_number: 28,
        lead: 'Esben',
        pre_location: null,
        main_location: 'Propaganda',
        post_location: null,
        meeting_date: null,
      },
    ],
    attendances: [
      { record_id: 1, member_name: 'Anders', attended: true },
      { record_id: 1, member_name: 'Mads', attended: false },
    ],
  })
  const value: AuthState = {
    userId: 'u1',
    role: 'admin',
    loading: false,
    signIn: async () => ({ error: null }),
    signOut: async () => {},
  }
  const Page = PAGES[page]
  return render(
    withQuery(
      <AuthContext.Provider value={value}>
        <Page />
      </AuthContext.Provider>,
    ),
  )
}

describe('a read-only preview', () => {
  it('still shows the admin the news, and offers no way to change it', async () => {
    renderAsAdmin('nyheder')
    expect(await screen.findByText('Sommerfest 2026')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Ny nyhed' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Rediger' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Slet' })).not.toBeInTheDocument()
  })

  it('still shows the calendar, and offers no way to change it', async () => {
    renderAsAdmin('kalender')
    // By its heading: a plain numbered title puts the number in the serif slot
    // and the venue in the heading (`calendarHead`), so no element holds the
    // title text. The date is far ahead so the card stays in the planned half.
    expect(await screen.findByText('Propaganda')).toBeInTheDocument()
    // No create button here at all any more — creating a meeting is
    // /anciennitet's one button, and it is gone in a read-only build too.
    expect(screen.queryByRole('button', { name: /nyt møde/i })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Rediger' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Slet' })).not.toBeInTheDocument()
  })

  it('still shows the attendance history, and offers no way to change it', async () => {
    // The one with the most to lose: a meeting carries ~10 attendance rows and
    // its fines, and the club has fifteen years of them and no backup.
    renderAsAdmin('anciennitet')
    expect(await screen.findByText('Esben')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: NEW_MEETING })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Rediger' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Slet' })).not.toBeInTheDocument()
  })
})
