import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import { buildLedger, type LedgerMonth } from '../data/ledger'
import { budgetFines, projectBudget } from '../data/projection'
import { FinanceChart, financeSeries, kr, niceTicks, type BooksState } from './FinanceChart'

/**
 * The chart is asserted through its words, not its paths.
 *
 * A recharts SVG in jsdom has no layout, so every coordinate in it is zero —
 * asserting on the drawing would test the renderer rather than the club's
 * books. What is worth pinning is what the card *says*: the shaping the curves
 * are drawn from, the figures printed beside them, and the sentence the empty
 * state gives a member. Those are also the parts that must stay true.
 */

const NO_BOOKS: BooksState = { payers: 9, fines: 0, payments: 0, meetings: 0, undatedMeetings: 0 }

/** The demo build's figures: five months, ten members, behind throughout. */
function demoLedger(): LedgerMonth[] {
  return buildLedger({
    from: '2026-02',
    to: '2026-06',
    fines: [
      { month: '2026-02', member_name: 'Esben', amount_kr: 50 },
      { month: '2026-04', member_name: 'Mads', amount_kr: 185 },
      { month: '2026-04', member_name: 'Kasper', amount_kr: 265 },
      { month: '2026-06', member_name: 'Mads', amount_kr: 200 },
      { month: '2026-06', member_name: 'Saaby', amount_kr: 110 },
    ],
    payments: [
      { month: '2026-04', amount_kr: 900 },
      { month: '2026-05', amount_kr: 900 },
      { month: '2026-06', amount_kr: 1800 },
    ],
    payingMembers: () => 10,
  })
}

describe('what the curves are drawn from', () => {
  it('accumulates, so the distance between the curves is what is owed', () => {
    const points = financeSeries(demoLedger())
    expect(points.map((p) => p.expected)).toEqual([1050, 2050, 3500, 4500, 6810])
    expect(points.map((p) => p.received)).toEqual([0, 0, 900, 1800, 3600])
    // The gap is the ledger's own `outstanding`, not a second calculation of
    // it: two ways of working out one number is how they drift apart. Good
    // reason on its own — but not the story of the old sheet's 50 kr, which
    // was a page never counted (docs/finance-reconciliation.md).
    expect(points.map((p) => (p.expected ?? 0) - (p.received ?? 0))).toEqual(
      points.map((p) => p.outstanding),
    )
  })

  it('puts the shortfall in the band above the received curve', () => {
    const [first] = financeSeries(demoLedger())
    expect(first.behind).toEqual([0, 1050])
    // Nothing to draw on the other side, but the series still exists at every
    // point: a nullable band would tear the fill open at each crossing.
    expect(first.ahead).toEqual([1050, 1050])
  })

  it('flips the band when the club has been paid ahead', () => {
    // February 2026 in the real history: a quarter's fines arrived in one
    // month, so the club was temporarily 1.155 kr. in front.
    const ledger = buildLedger({
      from: '2026-01',
      to: '2026-02',
      fines: [
        { month: '2026-01', member_name: 'Mads', amount_kr: 475 },
        { month: '2026-02', member_name: 'Emil', amount_kr: 50 },
      ],
      payments: [
        { month: '2026-01', amount_kr: 800 },
        { month: '2026-02', amount_kr: 2480 },
      ],
      payingMembers: () => 8,
    })
    const feb = financeSeries(ledger)[1]
    expect(feb.outstanding).toBe(-1155)
    expect(feb.ahead).toEqual([2125, 3280])
    expect(feb.behind).toEqual([2125, 2125])
  })

  it('names the year on every tick once the history crosses one', () => {
    // The axis drops the labels that will not fit, and it drops them from the
    // middle — where the one naming the new year lives. Two unqualified "jun."
    // ticks two years apart is the failure this avoids.
    const across = financeSeries(
      buildLedger({ from: '2025-11', to: '2026-02', fines: [], payments: [], payingMembers: () => 0 }),
    )
    expect(across.map((p) => p.label)).toEqual(['nov. 25', 'dec. 25', 'jan. 26', 'feb. 26'])
  })

  it('names it once inside a single year, where it cannot be misread', () => {
    expect(financeSeries(demoLedger()).map((p) => p.label)).toEqual([
      'feb. 26', 'mar.', 'apr.', 'maj', 'jun.',
    ])
  })
})

describe('the axis a person would have drawn', () => {
  it('rounds to numbers money is read in', () => {
    expect(niceTicks(6810)).toEqual([0, 2000, 4000, 6000, 8000])
    expect(niceTicks(32810)).toEqual([0, 10000, 20000, 30000, 40000])
    expect(niceTicks(1050)).toEqual([0, 500, 1000, 1500])
  })

  it('survives a ledger that is all zeros', () => {
    expect(niceTicks(0)).toEqual([0])
  })
})

describe('the figures beside the curves', () => {
  it('prints the totals and the gap, so no value needs a hover', () => {
    render(<FinanceChart ledger={demoLedger()} books={NO_BOOKS} />)
    expect(screen.getByText('6.810 kr.')).toBeInTheDocument()
    expect(screen.getByText('3.600 kr.')).toBeInTheDocument()
    expect(screen.getByText('Mangler')).toBeInTheDocument()
    expect(screen.getByText('3.210 kr.')).toBeInTheDocument()
  })

  it('says which way the gap goes rather than showing a negative number', () => {
    const ledger = buildLedger({
      from: '2026-01',
      to: '2026-01',
      fines: [],
      payments: [{ month: '2026-01', amount_kr: 1000 }],
      payingMembers: () => 8,
    })
    render(<FinanceChart ledger={ledger} books={NO_BOOKS} />)
    expect(screen.getByText('Forud')).toBeInTheDocument()
    expect(screen.getByText('200 kr.')).toBeInTheDocument()
    expect(screen.queryByText(/-\d/)).not.toBeInTheDocument()
  })

  it('describes the whole chart in words for anyone who cannot see it', () => {
    render(<FinanceChart ledger={demoLedger()} books={NO_BOOKS} />)
    const chart = screen.getByRole('img')
    expect(chart).toHaveAccessibleName(/februar 2026 – juni 2026/)
    expect(chart).toHaveAccessibleName(/klubben mangler 3\.210 kr\./)
  })
})

describe('when there is nothing to plot', () => {
  const empty: LedgerMonth[] = []

  it('refuses to draw a flat line at zero, and says why', () => {
    render(<FinanceChart ledger={empty} books={NO_BOOKS} />)
    expect(screen.getByText(/ingen kurve at tegne endnu/i)).toBeInTheDocument()
    expect(screen.getByText(/flad linje ved nul/i)).toBeInTheDocument()
    // Nothing that could be mistaken for a measured figure.
    expect(screen.queryByRole('img')).not.toBeInTheDocument()
  })

  it('gives the club’s actual reason: the books have not been imported', () => {
    render(<FinanceChart ledger={empty} books={{ ...NO_BOOKS, meetings: 29, undatedMeetings: 29 }} />)
    expect(screen.getByText(/hverken bøder eller indbetalinger er registreret/i)).toBeInTheDocument()
    expect(screen.getByText(/ingen af klubbens 29 møder har en dato/i)).toBeInTheDocument()
  })

  it('counts the undated meetings rather than claiming all of them', () => {
    render(
      <FinanceChart
        ledger={empty}
        books={{ payers: 9, fines: 4, payments: 0, meetings: 29, undatedMeetings: 6 }}
      />,
    )
    expect(screen.getByText(/6 af 29 møder mangler en dato/i)).toBeInTheDocument()
    expect(screen.getByText(/ikke registreret en eneste indbetaling/i)).toBeInTheDocument()
    expect(screen.queryByText(/hverken bøder eller indbetalinger/i)).not.toBeInTheDocument()
  })
})

describe('money on the page', () => {
  it('groups thousands and carries the unit', () => {
    expect(kr(1050)).toBe('1.050 kr.')
    expect(kr(0)).toBe('0 kr.')
    expect(kr(11500)).toBe('11.500 kr.')
  })
})

/**
 * The budget line, and the one thing it must never do.
 *
 * `Forventede bøder` is a plan; everything else on this card is money that
 * moved. These are about keeping the two apart on a phone a member glances at.
 * The arithmetic behind the figure is data/projection.test.ts.
 */
describe('the fine budget', () => {
  const budget = budgetFines({
    meetings: [
      { number: 1, kr: 300 },
      { number: 2, kr: 0 },
      { number: 3, kr: 300 },
    ],
    meetingDates: [],
  })
  const months = projectBudget({
    after: '2026-06',
    months: 3,
    openingBalance: 6810,
    budget,
    payingMembers: () => 9,
  })

  const draw = () =>
    render(
      <FinanceChart
        ledger={demoLedger()}
        books={NO_BOOKS}
        budget={budget}
        budgetMonths={months}
        budgetNotes={['En note om hvad budgettet ikke ved.']}
      />,
    )

  it('calls itself a budget, in the same breath as the figure', () => {
    draw()
    expect(screen.getByText(/forventede bøder · budget/i)).toBeInTheDocument()
    expect(screen.getByText(/det er et budget, ikke penge klubben har/i)).toBeInTheDocument()
  })

  it('leads with the per-meeting figure, which is the measured one', () => {
    draw()
    // 600 kr. over the 3 meetings in the window = 200 kr. an evening; §9's
    // cadence halves it to 100 kr. a month. Both are on the card, evening first.
    expect(screen.getByText('200 kr.')).toBeInTheDocument()
    expect(screen.getByText('100 kr.')).toBeInTheDocument()
    expect(screen.getByText(/pr\. møde/)).toBeInTheDocument()
  })

  it('adds no krone to the three figures that are money', () => {
    draw()
    expect(screen.getByText('6.810 kr.')).toBeInTheDocument()
    expect(screen.getByText('3.600 kr.')).toBeInTheDocument()
    expect(screen.getByText('3.210 kr.')).toBeInTheDocument()
  })

  it('does not lengthen the period the real curves claim to cover', () => {
    draw()
    const chart = screen.getByRole('img')
    expect(chart).toHaveAccessibleName(/februar 2026 – juni 2026/)
    expect(chart).toHaveAccessibleName(/stiplede linje er et budget/)
    expect(chart).toHaveAccessibleName(/ikke penge klubben har/)
  })

  it('passes the club’s own caveats through instead of stating certainty', () => {
    draw()
    expect(screen.getByText('En note om hvad budgettet ikke ved.')).toBeInTheDocument()
  })

  it('is absent entirely when there is nothing to budget', () => {
    const nothing = budgetFines({ meetings: [{ number: 1, kr: 0 }], meetingDates: [] })
    render(<FinanceChart ledger={demoLedger()} books={NO_BOOKS} budget={nothing} budgetMonths={[]} />)
    // Not a 0 kr. budget line, which would claim the club expects no fines.
    expect(screen.queryByText(/forventede bøder · budget/i)).not.toBeInTheDocument()
    expect(financeSeries(demoLedger(), []).every((p) => !p.isBudget)).toBe(true)
  })

  it('starts the dashed line on the solid one rather than a month later', () => {
    const points = financeSeries(demoLedger(), months)
    const lastReal = points.filter((p) => !p.isBudget).at(-1)!
    // The same balance said twice — the join, not an extra krone.
    expect(lastReal.budgeted).toBe(lastReal.expected)
    expect(points.filter((p) => p.isBudget)).toHaveLength(3)
  })

  /**
   * The handle the sweep hangs off, asserted here because it is invisible from
   * the screen it animates and silent when it breaks: drop `data-draw` and the
   * club loses the motion and nothing else, so nothing else would ever fail.
   *
   * ResponsiveContainer measures itself and jsdom reports every box as zero, so
   * recharts renders no chart at all here. What *is* checkable is the structure
   * the stylesheet reaches through — the marker, the box that gets clipped, and
   * the clipPath the rule names — and that is exactly the part with no runtime
   * error to announce it. The gesture itself is measured in a browser (T077).
   */
  it('marks the plot so the whole chart can be swept into view', () => {
    const { container } = draw()

    expect(container.querySelector('[data-draw]')).toBeTruthy()
    // On the plot, not on the card: armed from the card the gesture would play
    // with the plot still below the fold.
    expect(container.querySelector('[data-draw]')).toBe(container.querySelector('[role="img"]'))
  })

  /**
   * The clip's reference, which is not allowed to dangle.
   *
   * `clip-path: url(#ek-plot-sweep)` naming a clipPath that is not in the
   * document is not a no-op in SVG — it is grounds for not rendering the
   * referencing element, which here is the club's whole chart. The id lives in
   * one place in the markup and one in the stylesheet, and this is the only thing
   * that would notice the two drifting apart.
   */
  it('keeps the sweep’s clip, its rect and the box it clips together', () => {
    const { container } = draw()
    const plot = container.querySelector('[data-draw]')!

    const clip = plot.querySelector('clipPath')
    expect(clip?.getAttribute('id')).toBe('ek-plot-sweep')
    // Fractions of the plot's own box, so nothing here has to know how tall the
    // chart is.
    expect(clip?.getAttribute('clipPathUnits')).toBe('objectBoundingBox')
    expect(clip?.querySelector('rect')).toHaveClass('ek-sweep')
    // The clipped box, which `[data-draw='armed'] .ek-plot` reaches for.
    expect(plot.querySelector('.ek-plot')).toBeTruthy()
    // The clip defined beside what it clips rather than inside it.
    expect(plot.querySelector('.ek-plot')!.querySelector('clipPath')).toBeNull()
  })

  /**
   * The chart stands above the budget, because the chart is what the card is.
   *
   * Lukas, 2026-07-30: *"Jeg synes at grafen skal være over 'forventet bøder
   * budget' teksten, da man så vil kunne se den på skærmen når man logger ind."*
   * That block is 222 px of heading, figure, paragraph and three bullets, and
   * with it above the plot there was no viewport an iPhone gives Safari on which
   * any of the chart was on screen unscrolled.
   *
   * Document order rather than pixels: it is the part jsdom can actually know,
   * and it is the part that decides it.
   */
  it('puts the plot above the budget block', () => {
    const { container } = draw()
    const plot = container.querySelector('[data-draw]')!
    const budget = screen.getByText(/forventede bøder · budget/i)

    expect(plot.compareDocumentPosition(budget) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
  })

  /**
   * No display figure shares a line with body text.
   *
   * Lukas, 2026-07-30, on the budget sentence: its first glyph came from a
   * different face than the rest — "314" as a serif 3 followed by a sans 14. It
   * did. `.ek-figure` is Instrument Serif, whose only figure set is an old-style
   * one: the `3` drops below the baseline, the `1` is a bare stem with no flag and
   * no foot serifs ("111" renders as "lll"), the digits are proportional
   * (6.06 / 4.03 / 6.44 px at 16.8 px, measured), and the face carries no `tnum`
   * to switch out of any of it. At 26–52 px leading a card those shapes are the
   * register. At 16.8 px inline in a 14 px sans sentence they are a font glitch.
   *
   * The rule `.ek-figure` states in index.css — serif leads a block, Sans 700 in
   * a tile — never covered a number in the middle of a sentence, and its ~14 px
   * floor let this one through. So this asserts the shape of the rule rather than
   * a size: a display figure may not have prose beside it in its own line box.
   * Sibling *elements* are fine — that is the legend's own dt/dd — but a text node
   * with letters in it is not.
   */
  it('never sets a serif figure inside a line of body text', () => {
    const { container } = draw()
    const figures = [...container.querySelectorAll('.ek-figure')]
    expect(figures.length).toBeGreaterThan(0)

    for (const fig of figures) {
      const prose = [...(fig.parentElement?.childNodes ?? [])]
        .filter((n) => n.nodeType === Node.TEXT_NODE && /\p{L}/u.test(n.nodeValue ?? ''))
        .map((n) => n.nodeValue?.trim())
      expect(prose, `"${fig.textContent}" is a serif figure set in a sans sentence`).toEqual([])
    }
  })

  /**
   * And the sentence itself, in one face, with the leading figure still leading.
   *
   * The per-meeting figure is the measured one and has to come first — see
   * data/projection.ts. It does that on weight now, in the sentence's own face,
   * which is §03's "tal i 700" and the idiom the hover readout already used.
   */
  it('sets both figures in the budget sentence in the same face', () => {
    draw()
    const perMeeting = screen.getByText('200 kr.')
    const perMonth = screen.getByText('100 kr.')

    for (const el of [perMeeting, perMonth]) {
      expect(el).toHaveClass('tabular')
      expect(el).not.toHaveClass('ek-figure')
    }
    expect(perMeeting).toHaveClass('font-semibold')
    expect(perMonth).not.toHaveClass('font-semibold')
  })

  /**
   * "Og lidt mere motion på tallene" (Lukas, 2026-07-29). The three figures the
   * curve resolves to count over the same 900 ms the sweep takes — and they carry
   * the *exact* value, because lib/reveal.ts rebuilds the rendered string or
   * leaves the figure alone.
   */
  it('lets the three figures above the curve count up to what they say', () => {
    draw()
    const figures = screen.getAllByText(/kr\./).filter((el) => el.hasAttribute('data-count'))

    expect(figures.length).toBeGreaterThanOrEqual(3)
    for (const el of figures) {
      expect(el.textContent).toContain(Number(el.dataset.count).toLocaleString('da-DK'))
    }
  })

  it('leaves the real curves null in a month that has not happened', () => {
    const projected = financeSeries(demoLedger(), months).filter((p) => p.isBudget)
    // Zero would draw both curves diving to the axis, reporting a month with no
    // records as a month where nothing was collected.
    expect(projected.map((p) => p.expected)).toEqual([null, null, null])
    expect(projected.map((p) => p.received)).toEqual([null, null, null])
    expect(projected.map((p) => p.behind)).toEqual([undefined, undefined, undefined])
  })
})
