import { describe, expect, it, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import { withQuery, minTapHeightPx } from '../test/harness'

/**
 * "Sidst set" as an admin actually reads it (T074).
 *
 * Two of the club's ten have no login at all, and a member who has one may
 * simply never have opened the new site. Those are different facts and neither
 * of them is a date — this is the test that stops a future refactor rendering
 * either as "1. januar 1970" or as a blank line that reads like a bug.
 */
const rows: Record<string, unknown[]> = {
  user_member_mapping: [
    { user_id: 'u-1', member_name: 'Lukas' },
    { user_id: 'u-2', member_name: 'Saaby' },
    // An account the club's member list cannot name — Claude's own admin
    // login is exactly this. It must not appear as an eleventh member.
    { user_id: 'u-9', member_name: 'Ukendt konto' },
  ],
  member_last_seen: [
    { user_id: 'u-1', last_seen_at: new Date().toISOString() },
    { user_id: 'u-9', last_seen_at: new Date().toISOString() },
  ],
}

function builder(table: string) {
  const b: Record<string, unknown> = { select: () => b }
  // oxlint-disable-next-line no-thenable
  b.then = (resolve: (v: unknown) => unknown) =>
    Promise.resolve({ data: rows[table] ?? [], error: null }).then(resolve)
  return b
}

vi.mock('../lib/supabase', () => ({
  READONLY: false,
  supabase: () => ({ from: (t: string) => builder(t) }),
}))

const { LastSeen, byWeek } = await import('./LastSeen')

/** The club as the roster hands it over: two of them have never had a login. */
const ROSTER = ['Lukas', 'Saaby', 'Kasper', 'Have']

const show = () => render(withQuery(<LastSeen roster={ROSTER} />))

describe('sidst set', () => {
  it('says when each member was last here, and says the rest in words', async () => {
    show()
    await waitFor(() => expect(screen.getByText('Lukas')).toBeInTheDocument())

    // Visited today.
    expect(screen.getByText('i dag')).toBeInTheDocument()
    // Has a login, has never opened the site. Not a date, and not blank.
    expect(screen.getByText('aldrig åbnet siden')).toBeInTheDocument()
    // No login at all — the club cannot expect to see these two here.
    expect(screen.getAllByText('intet login')).toHaveLength(2)
  })

  it('lists the club and nobody else', async () => {
    show()
    await waitFor(() => expect(screen.getByText('Lukas')).toBeInTheDocument())
    expect(screen.queryByText('Ukendt konto')).not.toBeInTheDocument()
  })

  it('is alphabetical, never a ranking by absence', async () => {
    // The order is the guard against this becoming a league table of who has
    // not been around — in a club of ten that is a different social object.
    show()
    await waitFor(() => expect(screen.getByText('Lukas')).toBeInTheDocument())
    const names = screen.getAllByRole('listitem').map((li) => li.firstChild?.textContent)
    expect(names).toEqual(['Have', 'Kasper', 'Lukas', 'Saaby'])
  })

  it('starts folded, and opens at the design system\'s tap floor', async () => {
    const { container } = show()
    await waitFor(() => expect(screen.getByText('Lukas')).toBeInTheDocument())
    expect(container.querySelector('details')?.open).toBe(false)
    expect(minTapHeightPx(container.querySelector('summary')!)).toBeGreaterThanOrEqual(48)
  })

  it('says on the screen what is recorded, so a member can be told', async () => {
    show()
    await waitFor(() => expect(screen.getByText('Lukas')).toBeInTheDocument())
    expect(screen.getByText(/ikke hvilke sider/i)).toBeInTheDocument()
  })
})

/**
 * The visit history, added 2026-08-08 for Lukas's *"hvor mange gange folk har været
 * inde og hvornår. En graf."*
 *
 * `byWeek` gets its own tests because the whole chart is one function, and two of
 * its properties are the kind that look right on a screenshot while being wrong:
 * a quiet week has to draw as a gap rather than vanish, and a Sunday visit has to
 * land in its own week rather than the next one.
 */
describe('visits by week', () => {
  // Every case pins `today`. The window is anchored to it, so a test that let it
  // default would pass this week and fail in November for no reason anyone could
  // find — the worst kind of red.
  it('keeps the quiet weeks instead of closing the gap', () => {
    // Three weeks apart. A chart that dropped the empty ones would show three
    // equal bars and say the club was here every week — the exact opposite.
    const weeks = byWeek(['2026-06-01', '2026-06-22'], '2026-06-29')
    expect(weeks.slice(0, 4).map((w) => w.n)).toEqual([1, 0, 0, 1])
  })

  it('puts a Sunday in its own week, not the next one', () => {
    // 2026-06-07 is a Sunday; its Monday is 2026-06-01. `getUTCDay()` is 0 on
    // Sunday, so the naive subtraction rolls back one day into the wrong week.
    expect(byWeek(['2026-06-07'], '2026-06-29')[0].week).toBe('2026-06-01')
    expect(byWeek(['2026-06-08'], '2026-06-29')[0].week).toBe('2026-06-08')
  })

  it('counts a day per member, so one week can exceed the roster', () => {
    // Two men on the same day is two visit-days, and the bar is visits and not
    // people. Stated because "besøg pr. uge" could be read either way.
    expect(byWeek(['2026-06-02', '2026-06-02', '2026-06-03'], '2026-06-29')[0].n).toBe(3)
  })

  it('always draws twelve weeks, so one busy week is not a solid block', () => {
    // Lukas, 2026-08-08: *"Den nye graf viser bare en stor klods."* This is that
    // bug as a test. Every visit the club had fell in one week, and a chart of one
    // bar is a rectangle — the axis has to exist before the data does.
    const weeks = byWeek(['2026-08-05', '2026-08-06'], '2026-08-08')
    expect(weeks).toHaveLength(12)
    expect(weeks[0]).toEqual({ week: '2026-08-03', n: 2, future: false })
  })

  it('runs forward from the first week, never backward from today', () => {
    // The direction is the whole argument. Twelve weeks *backward* would draw
    // eleven empty bars before the club started recording, which reads as nobody
    // opened the site all summer. The first recorded week is the left edge.
    const weeks = byWeek(['2026-08-05'], '2026-08-08')
    expect(weeks[0].week).toBe('2026-08-03')
    expect(weeks.every((w) => w.week >= '2026-08-03')).toBe(true)
  })

  it('marks the weeks that have not arrived, so they can be drawn differently', () => {
    // A week nobody visited and a week that has not happened are both n = 0, and
    // a bar chart draws them identically unless it is told which is which.
    const weeks = byWeek(['2026-08-05'], '2026-08-19')
    // Three weeks have begun: 3 Aug, 10 Aug, 17 Aug. The rest are ahead of us.
    expect(weeks.filter((w) => w.future)).toHaveLength(9)
    expect(weeks.slice(0, 3).every((w) => w.future)).toBe(false)
  })

  it('shows at most twelve weeks, keeping the newest', () => {
    const dates = Array.from({ length: 30 }, (_, i) => {
      const d = new Date(Date.UTC(2026, 0, 5))
      d.setUTCDate(d.getUTCDate() + i * 7)
      return d.toISOString().slice(0, 10)
    })
    // Past twelve weeks of history the padding stops mattering and the window is
    // an ordinary trailing one — otherwise the club's newest week would fall off
    // the right-hand edge of its own chart.
    const weeks = byWeek(dates, dates[dates.length - 1])
    expect(weeks).toHaveLength(12)
    expect(weeks[weeks.length - 1].week).toBe(dates[dates.length - 1])
    expect(weeks.some((w) => w.future)).toBe(false)
  })

  it('draws nothing at all before there is anything to draw', () => {
    // The club's first day, and every database that predates the table. An empty
    // chart with an axis reads as a broken feature; nothing reads as "not yet".
    expect(byWeek([], '2026-08-08')).toEqual([])
  })
})
