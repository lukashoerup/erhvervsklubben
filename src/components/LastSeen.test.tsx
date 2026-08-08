import { describe, expect, it, vi } from 'vitest'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
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
  // Fixed dates rather than relative ones. The axis runs twelve weeks forward from
  // the first visit, so it is the same twelve weeks whenever this suite is run —
  // only which of them are still in the future moves with the clock.
  member_visits: [
    { user_id: 'u-1', visited_on: '2026-08-03' },
    { user_id: 'u-1', visited_on: '2026-08-04' },
    // The account the club cannot name. It must not be in the club's total either.
    { user_id: 'u-9', visited_on: '2026-08-05' },
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

const { LastSeen, byWeek, onAxis } = await import('./LastSeen')

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
    // Scoped to the member list by its label. The chart's twelve bars are list
    // items too since they became buttons — they are in the accessibility tree on
    // purpose now, and an unscoped query would read them as members.
    const list = within(screen.getByRole('list', { name: 'Sidst set, pr. medlem' }))
    const names = list.getAllByRole('listitem').map((li) => li.firstChild?.textContent)
    expect(names).toEqual(['Have', 'Kasper', 'Lukas', 'Saaby'])
  })

  it('starts folded, and opens at the design system\'s tap floor', async () => {
    const { container } = show()
    await waitFor(() => expect(screen.getByText('Lukas')).toBeInTheDocument())
    expect(container.querySelector('details')?.open).toBe(false)
    expect(minTapHeightPx(container.querySelector('summary')!)).toBeGreaterThanOrEqual(48)
  })

  it('gives a strip to every member who has a login, and to nobody else', async () => {
    // Twelve empty cells against a man who was never given an account reads as
    // "he stays away". He has not — he cannot come, and the row says so in words.
    const { container } = show()
    await waitFor(() => expect(screen.getByText('Lukas')).toBeInTheDocument())

    const strips = container.querySelectorAll('span.ek-plot')
    expect(strips).toHaveLength(2) // Lukas and Saaby; Kasper and Have have no login.
    for (const s of strips) expect(s.children).toHaveLength(12)
  })

  it("counts only the club in the club's total", async () => {
    // The fixture's third visit belongs to an account the member list cannot name.
    // Counting it would make the chart taller than the strips it is the sum of.
    show()
    await waitFor(() => expect(screen.getByText('Lukas')).toBeInTheDocument())
    expect(screen.getByText(/besøgsdage/)).toHaveTextContent('I alt 2 besøgsdage')
  })

  it('names who was in when a week is tapped, which is the incentive', async () => {
    // Lukas, 2026-08-08: *"Kan man lave noget så man kan se lidt tal når man
    // trykker på graferne? Det skal gerne give incitament til at man kommer mere
    // ind."* A count says the week was quiet; the names say who was here, and the
    // reader is one of the ten either way. That is the half that does the work.
    const user = userEvent.setup()
    show()
    await waitFor(() => expect(screen.getByText('Lukas')).toBeInTheDocument())

    const bars = within(screen.getByRole('list', { name: 'Besøg pr. uge' }))
    await user.click(bars.getAllByRole('button')[0])

    // The tooltip, by its role rather than by its text: it is a live region, and
    // the figure sits in its own `tabular` span so the digits line up — which
    // splits the sentence across elements and defeats a text match.
    expect(screen.getByRole('status')).toHaveTextContent('3. aug. – 9. aug.')
    expect(screen.getByRole('status')).toHaveTextContent('2 besøgsdage · Lukas')
  })

  it('says so plainly when nobody was in that week', async () => {
    // The weeks that motivate. An empty readout, or a bar that does not respond,
    // would read as a broken chart rather than as a quiet week.
    const user = userEvent.setup()
    show()
    await waitFor(() => expect(screen.getByText('Lukas')).toBeInTheDocument())

    const bars = within(screen.getByRole('list', { name: 'Besøg pr. uge' }))
    await user.click(bars.getAllByRole('button')[3])
    expect(screen.getByRole('status')).toHaveTextContent('Ingen var inde.')
  })

  it('lets go of the week when the same bar is tapped again', async () => {
    const user = userEvent.setup()
    show()
    await waitFor(() => expect(screen.getByText('Lukas')).toBeInTheDocument())

    const bar = within(screen.getByRole('list', { name: 'Besøg pr. uge' })).getAllByRole(
      'button',
    )[0]
    await user.click(bar)
    expect(bar).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByRole('status')).toBeInTheDocument()

    await user.click(bar)
    expect(bar).toHaveAttribute('aria-pressed', 'false')
    expect(screen.queryByRole('status')).not.toBeInTheDocument()
    // The caption stays either way: a chart whose numbers only appear on a tap is
    // a chart whose numbers a first-time reader never finds.
    expect(screen.getByText(/tryk på en søjle/)).toBeInTheDocument()
  })

  it('gives every bar its figure as a label, so the chart can be heard', async () => {
    // It was `aria-hidden` while it was decoration. The bars carry the numbers now,
    // in the same words the readout prints.
    show()
    await waitFor(() => expect(screen.getByText('Lukas')).toBeInTheDocument())
    expect(
      screen.getByRole('button', { name: '3. aug. – 9. aug.: 2 besøgsdage' }),
    ).toBeInTheDocument()
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

  it('never calls a week with visits in it a future week', () => {
    // A future week draws as nothing, in the chart and in every strip — so getting
    // this wrong does not misplace a visit, it deletes one. And the two dates being
    // compared come from different clocks: `visited_on` is the database's Danish
    // date, `today` is the browser's UTC day. Late on a Sunday night in Copenhagen
    // they disagree by one, which is exactly this case.
    const weeks = byWeek(['2026-08-03', '2026-08-10'], '2026-08-09')
    expect(weeks[1]).toEqual({ week: '2026-08-10', n: 1, future: false })
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

  /**
   * Each member's own weeks, laid on the club's axis — Lukas, 2026-08-08:
   * *"hvor mange gange hvert medlem har besøgt og hvornår. Hvis det kan fyldes ind
   * i grafen."*
   */
  it('gives every member the same twelve columns, however few he has', () => {
    const axis = byWeek(['2026-08-03', '2026-08-05'], '2026-08-08')
    // A short row would still draw — misaligned with the chart above and with
    // every other member, which is the failure that looks fine in isolation.
    expect(onAxis(axis, [])).toEqual(Array.from({ length: 12 }, () => 0))
    expect(onAxis(axis, ['2026-08-05'])).toHaveLength(12)
  })

  it("puts a member's day in the same column as the club's", () => {
    const axis = byWeek(['2026-08-03', '2026-08-12'], '2026-08-19')
    expect(onAxis(axis, ['2026-08-12'])).toEqual([0, 1, ...Array.from({ length: 10 }, () => 0)])
  })

  it('sums to the club chart, week by week', () => {
    // The property the whole figure rests on: the bar above is the strips below
    // added up. If it ever stops being true, the chart is quietly claiming visits
    // that belong to nobody on the list.
    const lukas = ['2026-08-03', '2026-08-04', '2026-08-19']
    const saaby = ['2026-08-04', '2026-08-20']
    const axis = byWeek([...lukas, ...saaby], '2026-08-24')
    const a = onAxis(axis, lukas)
    const b = onAxis(axis, saaby)
    expect(axis.map((w) => w.n)).toEqual(a.map((n, i) => n + b[i]))
  })

  it('draws nothing at all before there is anything to draw', () => {
    // The club's first day, and every database that predates the table. An empty
    // chart with an axis reads as a broken feature; nothing reads as "not yet".
    expect(byWeek([], '2026-08-08')).toEqual([])
  })
})
