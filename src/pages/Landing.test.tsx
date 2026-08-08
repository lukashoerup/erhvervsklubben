import { beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { AuthContext, type AuthState } from '../auth/AuthContext'
import { withQuery } from '../test/harness'

/**
 * The public landing page.
 *
 * Supabase is mocked at the client rather than at the hooks, so these exercise
 * the real queries — which is the point of the first test below. What a public
 * page *asks the database for* is the thing worth pinning down: RLS would
 * refuse a member table anyway, but a page that tries is one policy edit away
 * from leaking, and nothing else in the suite would notice.
 */
const asked: string[] = []
let rows: Record<string, unknown[]> = {}
let fail = false

/** A PostgREST builder: every filter returns itself, and awaiting it resolves. */
function builder(table: string) {
  const b: Record<string, unknown> = {}
  for (const m of ['select', 'gte', 'lte', 'eq', 'order', 'limit']) b[m] = () => b
  // Thenable on purpose, and lint is right to be suspicious in general — but
  // this is what a PostgREST query builder is. Faking anything else would test
  // a client the app does not use.
  // oxlint-disable-next-line no-thenable
  b.then = (resolve: (v: unknown) => unknown) =>
    Promise.resolve(
      fail
        ? { data: null, error: { message: 'nede' } }
        : { data: rows[table] ?? [], error: null },
    ).then(resolve)
  return b
}

vi.mock('../lib/supabase', () => ({
  READONLY: false,
  supabase: () => ({
    from: (table: string) => {
      asked.push(table)
      return builder(table)
    },
  }),
}))

const { default: Landing } = await import('./Landing')

function renderLanding(auth: Partial<AuthState> = {}) {
  const value: AuthState = {
    userId: null,
    role: null,
    loading: false,
    signIn: async () => ({ error: null }),
    signOut: async () => {},
    ...auth,
  }
  return render(
    withQuery(
      <AuthContext.Provider value={value}>
        <MemoryRouter>
          <Landing />
        </MemoryRouter>
      </AuthContext.Provider>,
    ),
  )
}

beforeEach(() => {
  asked.length = 0
  rows = {}
  fail = false
})

describe('what the public page reads', () => {
  it('asks only for the two anon-readable tables', async () => {
    renderLanding()
    await screen.findByRole('heading', { level: 1 })
    // news and events are public by decision (2026-07-23). Everything else —
    // attendances, attendance_records, profiles, fines, payments — is behind
    // the login and must not even be requested here.
    expect(new Set(asked)).toEqual(new Set(['news', 'events']))
  })

  it('clamps a long item instead of letting it become the front page', async () => {
    // The club's general assembly referat is ~1200 characters of minutes, and the
    // landing page is what a stranger decides about the club from. A teaser is a
    // teaser: the full item lives behind the login on /nyheder.
    rows = {
      news: [
        {
          id: 'n1',
          title: 'Referat: generalforsamling 2026',
          excerpt: 'Dirigent: Mathias.\n\n' + 'Meget lang tekst. '.repeat(60),
          date: '2026-06-26',
        },
      ],
    }
    renderLanding()
    await screen.findByText('Referat: generalforsamling 2026')
    expect(screen.getByText(/Dirigent: Mathias/)).toHaveClass('line-clamp-3')
  })

  it('prints no figure about the club’s money', async () => {
    rows = {
      news: [
        { id: 'n1', title: 'Generalforsamling afholdt', excerpt: 'Referatet er rundsendt.', date: '2026-04-20' },
      ],
    }
    renderLanding()
    await screen.findByText('Generalforsamling afholdt')
    const text = document.body.textContent ?? ''
    // Not even the dues rate, which is public in the statutes but reads as a
    // price tag on a page a stranger is deciding about the club from. If the
    // club wants it out front that is Lukas's call, not a side effect.
    expect(text).not.toMatch(/\d[\d.]*\s*kr\./)
    expect(text).not.toMatch(/\d+\s*%/)
  })
})

describe('the meeting calendar with nothing in it', () => {
  it('states the cadence instead of leaving a hole', async () => {
    renderLanding()
    // §9 Stk. 3, quoted. The card's subject is the rhythm, so an empty
    // calendar still answers the question the section asks.
    expect(
      await screen.findByText(/der til enhver tid er to planlagte møder/i),
    ).toBeInTheDocument()
    expect(screen.getByText('Datoen er ikke offentliggjort')).toBeInTheDocument()
  })

  it('says nothing about a failure when the query is the thing that failed', async () => {
    fail = true
    renderLanding()
    expect(await screen.findByText('Datoen er ikke offentliggjort')).toBeInTheDocument()
    // The members' pages say "kunne ikke hente data", which tells a member to
    // reload. A stranger reads the same sentence as a broken club.
    expect(screen.queryByText(/kunne ikke hente/i)).not.toBeInTheDocument()
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })
})

describe('the meeting calendar once the club schedules something', () => {
  it('shows the next two meetings', async () => {
    rows = {
      events: [
        { id: 'e1', title: 'Møde #29', date: '2026-08-13', time: '18.30', location: 'Propaganda' },
        { id: 'e2', title: 'Møde #30', date: '2026-10-08', time: '18.30', location: '' },
      ],
    }
    renderLanding()
    expect(await screen.findByText('Møde #29')).toBeInTheDocument()
    expect(screen.getByText('Møde #30')).toBeInTheDocument()
    expect(screen.getByText(/13\. august 2026/)).toBeInTheDocument()
    expect(screen.getByText('Propaganda')).toBeInTheDocument()
    expect(screen.queryByText('Datoen er ikke offentliggjort')).not.toBeInTheDocument()
  })
})

describe('what the page says about the club', () => {
  it('quotes the statutes rather than paraphrasing them', async () => {
    renderLanding()
    // §2 Stk. 1 and Stk. 2, verbatim — the purpose the members actually voted.
    expect(
      await screen.findByText(/at skabe et netværk for enkeltpersoner/i),
    ).toBeInTheDocument()
    expect(screen.getByText(/dele erfaringer, sparre om idéer/i)).toBeInTheDocument()
    // §4 Stk. 2 A. — the club does not recruit through a signup button, so the
    // page must not offer one.
    expect(screen.getByText(/deltaget til ét arrangement som gæst/i)).toBeInTheDocument()
    expect(screen.queryByText(/bliv medlem/i)).not.toBeInTheDocument()
  })

  it('offers the way in that exists: the members’ login', async () => {
    renderLanding()
    const links = await screen.findAllByRole('link', { name: /log ind/i })
    expect(links.length).toBeGreaterThan(0)
    for (const l of links) expect(l).toHaveAttribute('href', '/login')
  })
})
