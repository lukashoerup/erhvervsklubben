import { beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { AuthContext, type AuthState } from '../auth/AuthContext'
import { minTapHeightPx, withQuery } from '../test/harness'

/**
 * The club's money, as a member sees it.
 *
 * Two things this page has got wrong before and must not again: it kept the
 * finances away from the people paying them, and it printed the same kind of
 * number two different ways on one screen.
 */
let rows: Record<string, unknown[]> = {}
/** What the page actually tried to write. Money, so the payload is the test. */
let upserted: Record<string, unknown>[] = []

function builder(table: string) {
  const b: Record<string, unknown> = {}
  for (const m of ['select', 'gte', 'lte', 'eq', 'order', 'limit', 'update']) b[m] = () => b
  b.upsert = (written: Record<string, unknown>[]) => {
    upserted = written
    return b
  }
  // oxlint-disable-next-line no-thenable
  b.then = (resolve: (v: unknown) => unknown) =>
    Promise.resolve({ data: rows[table] ?? [], error: null }).then(resolve)
  return b
}

vi.mock('../lib/supabase', () => ({
  READONLY: false,
  supabase: () => ({ from: (table: string) => builder(table) }),
}))

const { default: Oekonomi } = await import('./Oekonomi')

/**
 * Which chart, by name.
 *
 * `/oekonomi` carried exactly one `role="img"` until T078 and now carries three —
 * the finance curve, the fine insights and the income mix. An unqualified
 * `getByRole('img')` therefore stopped meaning anything, and it broke loudly
 * rather than silently asserting against whichever chart came first in the DOM,
 * which is the good version of this failure.
 */
const CURVE = /Kurve over klubbens indtægter/

const ROSTER = ['Anders', 'Rasmus', 'Esben', 'Oskar', 'Emil', 'Saaby', 'Lukas', 'Mads', 'Kasper', 'Have']

/**
 * The club's membership as it stands (T069): ten members, nine of whom pay.
 *
 * Every fixture below carries it, because this page's central figure is now a
 * function of it. Before there was a members table the roster *was* the member
 * list, so the ledger charged all ten — the founding father included, who has
 * never paid a krone.
 */
const MEMBERS = ROSTER.map((name) => ({
  name,
  status: name === 'Oskar' ? 'founding-father' : 'aktiv',
}))

/** Three dated meetings, ten members, and the demo build's fines and payments. */
function aClubWithBooks() {
  const meetings = [
    { id: 1, date: '2026-02-05' },
    { id: 2, date: '2026-04-09' },
    { id: 3, date: '2026-06-04' },
  ]
  rows = {
    attendance_records: meetings.map((m) => ({
      id: m.id,
      meeting_number: m.id,
      lead: 'Esben',
      pre_location: null,
      main_location: 'Propaganda',
      post_location: null,
      meeting_date: m.date,
    })),
    attendances: meetings.flatMap((m) =>
      ROSTER.map((name) => ({ record_id: m.id, member_name: name, attended: true })),
    ),
    members: MEMBERS,
    // Since T078 a fine carries its rule, its minutes and whether it has been
    // collected. The first two evenings are settled and the last is not, so
    // incurred (810), collected (500) and outstanding (310) are three different
    // numbers here — the page printed the first of them under the third's name
    // until Lukas caught it.
    fines: [
      { member_name: 'Esben', amount_kr: 50, record_id: 1, rule_id: 'skaal', minutes: null, settled_at: '2026-05-01' },
      { member_name: 'Mads', amount_kr: 185, record_id: 2, rule_id: 'for-sent', minutes: 27, settled_at: '2026-05-01' },
      { member_name: 'Kasper', amount_kr: 265, record_id: 2, rule_id: 'for-sent', minutes: 43, settled_at: '2026-05-01' },
      { member_name: 'Mads', amount_kr: 200, record_id: 3, rule_id: 'for-sent', minutes: 30, settled_at: null },
      { member_name: 'Saaby', amount_kr: 110, record_id: 3, rule_id: 'for-sent', minutes: 12, settled_at: null },
    ],
    payments: [
      { month: '2026-04-01', amount_kr: 900 },
      { month: '2026-05-01', amount_kr: 900 },
      { month: '2026-06-01', amount_kr: 1800 },
    ],
  }
}

/** Production as it stands: 29 meetings, none dated, and no books at all. */
function theClubAsItIsToday() {
  rows = {
    attendance_records: Array.from({ length: 29 }, (_, i) => ({
      id: i + 1,
      meeting_number: i + 1,
      lead: 'Esben',
      pre_location: null,
      main_location: 'Propaganda',
      post_location: null,
      meeting_date: null,
    })),
    attendances: ROSTER.map((name) => ({ record_id: 1, member_name: name, attended: true })),
    members: MEMBERS,
    fines: [],
    payments: [],
  }
}

function renderPage(role: AuthState['role']) {
  const value: AuthState = {
    userId: 'u1',
    role,
    loading: false,
    signIn: async () => ({ error: null }),
    signOut: async () => {},
  }
  return render(
    withQuery(
      <AuthContext.Provider value={value}>
        <Oekonomi />
      </AuthContext.Provider>,
    ),
  )
}

beforeEach(() => {
  rows = {}
  upserted = []
})

describe('who the finance graph is for', () => {
  it('shows an ordinary member the club’s income against what it charged', async () => {
    aClubWithBooks()
    renderPage('user')
    const chart = await screen.findByRole('img', { name: CURVE })
    // 6.210, not 6.810: the nine paying members, not the roster's ten. The
    // extra 600 kr. was a founding father being invoiced by arithmetic.
    expect(chart).toHaveAccessibleName(/Opkrævet i alt 6\.210 kr\., modtaget 3\.600 kr\./)
    expect(chart).toHaveAccessibleName(/klubben mangler 2\.610 kr\./)
  })

  it('still keeps the bank balance and the debtor list with the treasurer', async () => {
    aClubWithBooks()
    renderPage('user')
    await screen.findByRole('img', { name: CURVE })
    expect(screen.queryByText(/kun kassereren/i)).not.toBeInTheDocument()

    renderPage('admin')
    expect((await screen.findAllByText(/kun kassereren/i)).length).toBeGreaterThan(0)
  })
})

describe('the figures in the monthly table', () => {
  it('writes money the same way as the rest of the page', async () => {
    aClubWithBooks()
    renderPage('user')
    await screen.findByRole('img', { name: CURVE })
    // February: the nine paying members at 100 kr. plus one 50 kr. fine. It
    // used to render as a bare 950 next to cards printing 3.600 kr.
    expect(screen.getByText('2026-02').closest('tr')).toHaveTextContent('950 kr.')
    expect(screen.queryByText('950')).not.toBeInTheDocument()
    // June, when the dues doubled: 9 × 200 + 310 in fines, 1.800 kr. paid.
    const june = screen.getByText('2026-06').closest('tr')
    expect(june).toHaveTextContent('2.110 kr.')
    expect(june).toHaveTextContent('1.800 kr.')
  })
})

describe('recording a meeting’s fines', () => {
  it('counts them in Danish, not in "bøde(r)"', async () => {
    // The placeholder plural shipped: the treasurer read it at the end of every
    // meeting, and it said the app was unfinished.
    const user = userEvent.setup()
    aClubWithBooks()
    renderPage('admin')
    await user.selectOptions(await screen.findByLabelText('Møde'), '1')

    await user.click(screen.getAllByRole('button', { name: /Skål før/ })[0])
    expect(screen.getByRole('button', { name: 'Gem 1 bøde' })).toBeInTheDocument()

    await user.click(screen.getAllByRole('button', { name: /Skål før/ })[1])
    expect(screen.getByRole('button', { name: 'Gem 2 bøder' })).toBeInTheDocument()
  })

  it('writes the minutes the Lead typed, without anyone pressing Enter', async () => {
    // The whole of the worst bug, end to end: type, put the keyboard away by
    // tapping the thing you meant to tap next, and the club has the money.
    const user = userEvent.setup()
    aClubWithBooks()
    renderPage('admin')
    await user.selectOptions(await screen.findByLabelText('Møde'), '1')
    await user.click(screen.getAllByRole('button', { name: /For sent fremmøde/ })[0])
    await user.type(screen.getByLabelText(/Minutter for sent/), '12')

    // The first tap on Save only takes the focus off the field — Save is still
    // disabled, because at that instant nothing is recorded. What matters is
    // that the tap commits the fine rather than discarding it, so the second
    // tap has something to save.
    const save = screen.getByRole('button', { name: /^Gem / })
    await user.click(save)
    expect(save).toHaveAccessibleName('Gem 1 bøde')

    await user.click(save)
    await waitFor(() => expect(upserted).toHaveLength(1))
    expect(upserted[0]).toMatchObject({ rule_id: 'for-sent', minutes: 12, amount_kr: 110 })
  })

  it('saves behind a button that can be hit, and read', async () => {
    const user = userEvent.setup()
    aClubWithBooks()
    renderPage('admin')
    await user.selectOptions(await screen.findByLabelText('Møde'), '1')
    await user.click(screen.getAllByRole('button', { name: /Skål før/ })[0])

    const save = screen.getByRole('button', { name: 'Gem 1 bøde' })
    expect(minTapHeightPx(save)).toBeGreaterThanOrEqual(44)
    // White on --color-accent measures 3.2:1 on the dark ground and fails AA.
    // --color-brand is the landing page's #2563eb, where it measures 5.1:1 on
    // either ground. Nothing in jsdom can see that, so the token is what there
    // is to assert.
    expect(save.className).toContain('bg-brand')
    expect(save.className).not.toContain('bg-accent')
  })
})

describe('the club as it actually stands', () => {
  it('explains the missing chart instead of drawing an empty one', async () => {
    theClubAsItIsToday()
    renderPage('user')
    expect(await screen.findByText(/ingen kurve at tegne endnu/i)).toBeInTheDocument()
    expect(
      screen.getByText(/hverken bøder eller indbetalinger er registreret/i),
    ).toBeInTheDocument()
    expect(screen.getByText(/ingen af klubbens 29 møder har en dato/i)).toBeInTheDocument()
    // No plot, and no monthly table either — there is nothing honest to put in
    // one, and an empty grid reads as a club that charged nothing.
    expect(screen.queryByRole('img', { name: CURVE })).not.toBeInTheDocument()
    expect(screen.queryByRole('table')).not.toBeInTheDocument()
  })

  it('counts the meetings with no date, and sends the fix to one screen', async () => {
    // This page used to carry a date field per undated meeting — a second way
    // to write `attendance_records.meeting_date`, on a page about money. T065
    // gave the meeting its own editor on Anciennitet, where the date sits with
    // the lead, the venues and who attended. The count stays here, because the
    // hole is in these books; the input does not, because two inputs on one
    // column are two places for it to start behaving differently.
    theClubAsItIsToday()
    renderPage('admin')
    await screen.findByText(/ingen kurve at tegne endnu/i)
    const counted = screen.getByText(/møder har ingen dato/i)
    expect(counted).toHaveTextContent('29')
    expect(counted).toHaveTextContent(/under Anciennitet/)
    expect(document.querySelectorAll('input[type="date"]')).toHaveLength(0)
  })
})

/**
 * The books exactly as T068 imported them: the 13 monthly payments and the 17
 * fines from "Klubbens finanser", against meetings that still have no dates.
 *
 * Worth pinning as a fixture rather than a generic one, because this is the
 * only data the page has in production right now, and two of its properties
 * are easy to regress. The fines carry `rule_id = 'historisk'`, an id no rule
 * in this build defines; and every meeting they hang off is undated, which is
 * the branch that decides whether 1.730 kr is counted or quietly dropped.
 */
function theImportedBooks() {
  const grid: [number, string, number][] = [
    [21, 'Kasper', 100], [21, 'Rasmus', 95], [21, 'Anders', 80],
    [22, 'Kasper', 105], [22, 'Emil', 50], [22, 'Rasmus', 50], [22, 'Mads', 200],
    [23, 'Emil', 75], [23, 'Saaby', 75], [23, 'Esben', 155],
    [24, 'Saaby', 200], [24, 'Esben', 70],
    [25, 'Kasper', 60], [25, 'Emil', 110], [25, 'Mads', 185], [25, 'Saaby', 60], [25, 'Esben', 60],
  ]
  const months = ['2025-06', '2025-07', '2025-08', '2025-09', '2025-10', '2025-11',
    '2025-12', '2026-01', '2026-02', '2026-03', '2026-04', '2026-05', '2026-06']
  const amounts = [800, 800, 800, 800, 800, 800, 800, 800, 2480, 800, 900, 900, 1800]
  rows = {
    attendance_records: Array.from({ length: 28 }, (_, i) => ({
      id: i + 1,
      meeting_number: i + 1,
      lead: 'Esben',
      pre_location: null,
      main_location: 'Propaganda',
      post_location: null,
      meeting_date: null,
    })),
    attendances: ROSTER.map((name) => ({ record_id: 21, member_name: name, attended: true })),
    members: MEMBERS,
    fines: grid.map(([record_id, member_name, amount_kr]) => ({
      member_name,
      amount_kr,
      record_id,
      rule_id: 'historisk',
    })),
    payments: months.map((m, i) => ({ month: `${m}-01`, amount_kr: amounts[i] })),
  }
}

describe('the imported spreadsheet history (T068)', () => {
  it('counts every krone of it, on a rule id this build never defined', async () => {
    theImportedBooks()
    renderPage('admin')
    await screen.findByRole('img', { name: CURVE })
    // 13.280 received and 1.730 owed are the two figures the whole import has
    // to reproduce. If either moves, the import or the arithmetic is wrong.
    // Read off the treasurer's own card: both figures legitimately appear
    // elsewhere on the page, and a loose match would pass on the wrong one.
    const card = screen.getByText(/Klubkassen/).closest('section')!
    expect(card).toHaveTextContent('13.280 kr.')
    // Asserted through the sentence rather than as a bare figure, because since
    // T078 the card names three quantities and this import's fines are all
    // uncollected — so 1.730 is legitimately both what was incurred and what is
    // outstanding, and `getByText` matched two nodes. The words are the part
    // that must not drift.
    expect(card).toHaveTextContent('Bøder pålagt 1.730 kr.')
  })

  it('says out loud that the fines sit on meetings with no date', async () => {
    theImportedBooks()
    renderPage('admin')
    await screen.findByRole('img', { name: CURVE })
    // Not silently dropped and not dumped into an arbitrary month, either of
    // which would misstate a quarter. The page states the amount it left out.
    expect(
      screen.getByText(/1\.730 kr\. i bøder hører til møder uden dato/),
    ).toBeInTheDocument()
  })

  it('names every fined member with the right total', async () => {
    theImportedBooks()
    renderPage('admin')
    await screen.findByRole('img', { name: CURVE })
    // The sheet's own row totals, which is the second axis the grid balances
    // on. Rasmus and Anders are the sheet's "Holst" and "Tørring".
    const owed = screen.getByText(/Udestående bøder pr\. medlem/).closest('section')!
    for (const [member, total] of [
      ['Kasper', '265 kr.'], ['Emil', '235 kr.'], ['Rasmus', '145 kr.'],
      ['Mads', '385 kr.'], ['Anders', '80 kr.'], ['Saaby', '335 kr.'], ['Esben', '285 kr.'],
    ]) {
      // Scoped to the treasurer's own card. Since T078 every member is also
      // named in the fine-insight chips that the whole club can see, so an
      // unscoped query finds two of each — and the figure that has to be right
      // here is the one on the collection list.
      expect(within(owed).getByText(member)).toBeInTheDocument()
      expect(within(owed).getByText(total)).toBeInTheDocument()
    }
  })
})

/**
 * Membership status, on the page whose figures depend on it (T069).
 *
 * The expected-income curve was the size of the roster times the rate, so a
 * founding father who has never paid a krone was billed by arithmetic in every
 * month the club has ever had. These pin both directions: what the page charges
 * and who it will let the Lead fine.
 */
describe('who the club charges', () => {
  it('says how many members the expected line is charged to', async () => {
    // This used to assert a card — "Hvem betaler kontingent", nine of ten,
    // Oskar named as founding father and §12 quoted under him. Lukas had it
    // removed on 2026-07-29: "Det ved alle godt." What replaced it is the
    // count alone, in the chart's own caption, because the height of the blue
    // curve is the one thing on this page a member cannot derive from knowing
    // his own club. The names and the reason live in data/members.ts, which is
    // what actually stops the money being charged.
    //
    // The count is now stated as **today's**, because since 2026-07-30 the blue
    // curve is charged per month: the bank statement dated the ninth payer to
    // May 2026, so one number can no longer stand for the whole history. It was
    // honest while the count was assumed and became a small lie the moment it
    // was measured.
    aClubWithBooks()
    renderPage('user')
    await screen.findByRole('img', { name: CURVE })
    expect(screen.getByText(/opkrævede i den enkelte måned/)).toHaveTextContent(
      /kontingent fra de medlemmer, klubben\s*opkrævede i den enkelte måned\s*\(\s*9\s*i\s*dag\)/,
    )
    // Gone, and not reinstated in smaller type somewhere else on the page.
    expect(screen.queryByText(/Hvem betaler kontingent/)).not.toBeInTheDocument()
    expect(screen.queryByText('Founding father')).not.toBeInTheDocument()
  })

  it('does not offer a founding father to be fined', async () => {
    const user = userEvent.setup()
    aClubWithBooks()
    renderPage('admin')
    await user.selectOptions(await screen.findByLabelText('Møde'), '1')

    // One heading per member the Lead can fine. He attended — all ten did — so
    // this is membership status doing the work and not the attendance filter
    // that was already there.
    const offered = screen.getAllByRole('heading', { level: 3 }).map((h) => h.textContent)
    expect(offered).toHaveLength(9)
    expect(offered).not.toContain('Oskar')
    expect(offered).toContain('Anders')
  })
})
