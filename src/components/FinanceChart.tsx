import type { ReactElement } from 'react'
import {
  Area,
  CartesianGrid,
  ComposedChart,
  type DotItemDotProps,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import type { LedgerMonth } from '../data/ledger'
import type { BudgetMonth, FineBudget } from '../data/projection'
import { SectionTitle } from './SectionTitle'

/**
 * Danish money, defined once.
 *
 * The ledger table and this chart have to round and group identically, and the
 * page already proved what two copies costs: the same screen printed
 * `3.600 kr.` in one card and `3600` in the next, which reads as two different
 * numbers before you have finished the sentence.
 */
export const kr = (n: number) => `${n.toLocaleString('da-DK')} kr.`

const daMonth = (month: string, opts: Intl.DateTimeFormatOptions) =>
  new Date(`${month}-01T00:00:00Z`).toLocaleDateString('da-DK', { timeZone: 'UTC', ...opts })

export type FinancePoint = {
  month: string
  /** Axis tick. Carries its year where that could be ambiguous — see financeSeries. */
  label: string
  /** Everything owed up to and including this month. Null in a budgeted month. */
  expected: number | null
  /** Everything actually paid up to and including this month. Null in a budgeted month. */
  received: number | null
  /** Positive = the club is owed money; negative = it has been paid ahead. */
  outstanding: number | null
  /** The band where money is missing. Zero-height in a month that is ahead. */
  behind?: [number, number]
  /** The band where more came in than was owed. Zero-height in a month behind. */
  ahead?: [number, number]
  /**
   * The budgeted balance — dues the club will charge plus the fine budget.
   *
   * A separate key from `expected` on purpose. One series cannot be half
   * measured and half guessed: a reader following an unbroken line has no way
   * to see where the club's records stop and its arithmetic starts, and this
   * line runs a year past the last krone anybody has counted.
   */
  budgeted?: number
  /** True for the months after the books end. */
  isBudget: boolean
}

/**
 * The ledger as a curve, accumulated rather than month by month.
 *
 * Two reasons it is the running total and not each month on its own, and the
 * second is the one that decides it.
 *
 * The vertical distance between the two curves *is* `outstanding` — the number
 * the rest of the page already reports and the one thing a member wants from
 * this screen. Drawing anything else would put a second, different "gap" on a
 * page that already names one.
 *
 * And fines are collected **quarterly** (Bødekasseregulativ, Stk. 3). A month's
 * payment against that month's charge is therefore meaningless by design: one
 * month shows a quarter's money arriving and the two either side show none. A
 * monthly chart would draw that sawtooth as if it were a collection problem,
 * when it is simply the club's own rhythm. The running totals are immune to it —
 * the curves only separate when money genuinely has not arrived.
 *
 * The month-by-month figures are not lost: they are in the table directly under
 * the chart, which is also its table view.
 */
export function financeSeries(ledger: LedgerMonth[], budget: BudgetMonth[] = []): FinancePoint[] {
  // Once the history crosses a new year, every tick carries its year. The axis
  // drops labels that will not fit, and the ones it drops first are the ones
  // that named the year — leaving two "jun." two years apart.
  const months = [...ledger.map((m) => m.month), ...budget.map((m) => m.month)]
  const spansYears = months.length > 0 && months[0].slice(0, 4) !== months[months.length - 1].slice(0, 4)
  const tick = (month: string, first: boolean) =>
    spansYears || first
      ? `${daMonth(month, { month: 'short' })} ${month.slice(2, 4)}`
      : daMonth(month, { month: 'short' })

  const actual: FinancePoint[] = ledger.map((m, i) => {
    const expected = m.expectedBalance
    const received = m.actualBalance
    return {
      month: m.month,
      label: tick(m.month, i === 0),
      expected,
      received,
      outstanding: m.outstanding,
      // Both bands exist at every point, one of them flat. Splitting them into
      // nullable series instead would break the fill at every crossing, and the
      // crossings are exactly where a reader looks.
      behind: [Math.min(received, expected), expected],
      ahead: [expected, Math.max(received, expected)],
      // The last real month carries the budget line's first value too, so the
      // dashed line starts on the solid one instead of floating a month away
      // from it. It is the same balance, said twice — not an extra krone.
      budgeted: i === ledger.length - 1 && budget.length > 0 ? expected : undefined,
      isBudget: false,
    }
  })

  return [
    ...actual,
    ...budget.map((m) => ({
      month: m.month,
      label: tick(m.month, actual.length === 0),
      // Nothing was charged and nothing arrived: these months have not
      // happened. Null rather than zero, so the two real curves stop dead at
      // the last month the club has records for rather than diving to the axis.
      expected: null,
      received: null,
      outstanding: null,
      budgeted: m.expectedBalance,
      isBudget: true,
    })),
  ]
}

/**
 * Axis ticks a person would have chosen: 0, 10.000, 20.000 rather than the
 * 8.500 / 17.000 / 25.500 that comes out of dividing the largest value into
 * equal parts. Money is read against round numbers, and an axis nobody can
 * read at a glance costs more than the empty space above the curve.
 */
export function niceTicks(max: number, count = 4): number[] {
  if (!(max > 0)) return [0]
  const rough = max / count
  const magnitude = 10 ** Math.floor(Math.log10(rough))
  const step = [1, 2, 2.5, 5, 10].map((m) => m * magnitude).find((s) => s >= rough) ?? magnitude * 10
  const ticks: number[] = []
  for (let v = 0; v < max + step; v += step) ticks.push(v)
  return ticks
}

/** What the club has recorded, for a chart that has to explain its own absence. */
export type BooksState = {
  /** How many members the expected line is charged to. */
  payers: number
  fines: number
  payments: number
  meetings: number
  /** A fine on an undated meeting belongs to no month, so it cannot be plotted. */
  undatedMeetings: number
}

/**
 * Expected income against what actually arrived.
 *
 * The subject is the *gap*. Two thin curves would leave a reader measuring the
 * distance between them by eye; the shaded band between them turns that distance
 * into the largest object on the screen, which is what it is — every krone in it
 * is money the club has charged and not collected.
 *
 * Colour does identity, position does sign. Blue is what the rules say should
 * come in, green is what did, and the band is tinted by which of the two is on
 * top: the club's own red for money that did not turn up, the same green for a
 * period paid ahead. Red is never asked to be told apart from green by hue —
 * it only ever appears as a wash bounded by the two curves, and the figures
 * above the chart say which way it went in words.
 */
export function FinanceChart({
  ledger,
  books,
  budget,
  budgetMonths = [],
  budgetNotes = [],
}: {
  ledger: LedgerMonth[]
  books: BooksState
  /** The fine budget behind the dashed line. Absent when there is nothing to budget. */
  budget?: FineBudget
  budgetMonths?: BudgetMonth[]
  /** What the budget cannot know, in the club's own words. */
  budgetNotes?: string[]
}) {
  const showBudget = !!budget && budget.basis !== 'none' && budgetMonths.length > 0
  const points = financeSeries(ledger, showBudget ? budgetMonths : [])
  if (points.length === 0) return <NothingToPlot books={books} />

  const actual = points.filter((p) => !p.isBudget)
  const last = actual[actual.length - 1]
  const gap = last.outstanding ?? 0
  const ticks = niceTicks(
    Math.max(...points.map((p) => Math.max(p.expected ?? 0, p.received ?? 0, p.budgeted ?? 0))),
  )
  const span = `${daMonth(points[0].month, { month: 'long', year: 'numeric' })} – ${daMonth(
    last.month,
    { month: 'long', year: 'numeric' },
  )}`
  const budgetSpan = showBudget
    ? daMonth(budgetMonths[budgetMonths.length - 1].month, { month: 'long', year: 'numeric' })
    : ''

  // Lower case and no full stop: it is read as the tail of the sentence below,
  // where a `kr.` already supplies the point.
  const verdict =
    gap > 0
      ? `klubben mangler ${kr(gap)}`
      : gap < 0
        ? `klubben har fået ${kr(-gap)} mere ind, end den har opkrævet`
        : 'klubben har fået præcis det ind, den har opkrævet'

  return (
    <section data-reveal className="rounded-2xl border border-line bg-surface p-4">
      <SectionTitle onCard>Forventet mod modtaget</SectionTitle>
      {/* What the blue line is made of, in one clause. `/oekonomi` used to
          carry a whole card for it — who pays, who does not, and why — and it
          is gone at Lukas's word (2026-07-29): "Det ved alle godt." He is right
          that a club of ten knows its own members. What nobody can know by
          looking is that the expected line is nine times the rate rather than
          ten, so a member checking the curve against his own arithmetic lands
          somewhere else. The count stays; the names, the reason and the card do
          not.

          Since 2026-07-30 it is charged per month rather than flat — the bank
          statement dated the ninth payer to May 2026 — so the clause says the
          count is today's. Printing one number as though it held for the whole
          curve was true while the count was assumed and stopped being true the
          moment it was measured. */}
      <p className="mt-2 text-[0.68rem] leading-relaxed text-faint">
        Akkumuleret, {span}. Forventet er kontingent fra de medlemmer, klubben
        opkrævede i den enkelte måned (<span className="tabular">{books.payers}</span> i
        dag), plus bøder; afstanden mellem kurverne er det, klubben har opkrævet
        og ikke fået ind.
      </p>

      {/* The legend, and the numbers, in one row — so no value on this screen is
          only reachable by hovering a curve, which on a phone means not at all. */}
      <dl className="mt-4 grid grid-cols-3 gap-2">
        <Figure keyClass="h-[2px] w-3 rounded-full bg-accent" label="Forventet" kr={last.expected ?? 0} />
        <Figure keyClass="h-[2px] w-3 rounded-full bg-present" label="Modtaget" kr={last.received ?? 0} />
        <Figure
          keyClass={`size-2.5 rounded-[3px] ${gap < 0 ? 'bg-present/30' : 'bg-absent/30'}`}
          label={gap < 0 ? 'Forud' : 'Mangler'}
          kr={Math.abs(gap)}
          lead
        />
      </dl>

      {/* The budget is deliberately not a fourth cell in the row above. Those
          three are money — charged, arrived, and the difference between them —
          and a figure standing in line with them is read as a fourth of the
          same kind. It gets its own block, its own word, and a dashed key that
          matches the only dashed thing on the chart. */}
      {showBudget && <BudgetNote budget={budget} until={budgetSpan} notes={budgetNotes} />}

      {/* role="img" with the whole story in words: the SVG underneath is a
          thousand path nodes to a screen reader, and the tooltip does not exist
          for one. The same figures are in the row above and in the table below,
          so nothing here is the only route to a number. */}
      <div
        role="img"
        aria-label={`Kurve over klubbens indtægter, ${span}. Opkrævet i alt ${kr(
          last.expected ?? 0,
        )}, modtaget ${kr(last.received ?? 0)} — ${verdict}.${
          showBudget
            ? ` Den stiplede linje er et budget frem til ${budgetSpan}, ikke penge klubben har: ${kr(
                budget.perMonthKr,
              )} i forventede bøder pr. måned.`
            : ''
        }`}
        /* Never wider than the card, and if anything ever makes it so it is
           this box that scrolls and not the page. The plot is fitted rather
           than widened-and-scrolled on purpose: two smooth curves stay
           readable compressed, and the one month a member actually wants —
           the last one — would be the one off the right-hand edge. */
        /* `data-draw` sits here rather than on the card, so the curves start
           drawing when the plot itself is 18 % into view: the heading, the
           sentence and the three figures stand above it, and armed from the
           card the whole gesture would play with the plot still off-screen.
           lib/reveal.ts measures the paths; the `[data-draw]` rules in
           index.css carry the timing and the order. */
        data-draw
        className="mt-3 -mx-1 overflow-x-auto"
      >
        <ResponsiveContainer width="100%" height={210}>
          <ComposedChart data={points} margin={{ top: 8, right: 10, bottom: 0, left: 0 }}>
            <CartesianGrid vertical={false} className="stroke-line" strokeWidth={1} />
            <XAxis
              dataKey="label"
              tickLine={false}
              axisLine={false}
              minTickGap={8}
              interval="preserveStartEnd"
              tick={{ className: 'fill-faint tabular', fontSize: 10 }}
            />
            <YAxis
              width={46}
              tickLine={false}
              axisLine={false}
              /* From zero, and on round numbers. A money scale that starts at
                 the first month's balance makes any gap look like whatever the
                 crop chose. */
              domain={[0, ticks[ticks.length - 1]]}
              ticks={ticks}
              tickFormatter={(v: number) => v.toLocaleString('da-DK')}
              tick={{ className: 'fill-faint tabular', fontSize: 10 }}
            />
            <Tooltip content={<Readout />} cursor={{ className: 'stroke-line-hi', strokeWidth: 1 }} />
            {/* `currentColor` plus a text-* class on the wrapper, not a fill-*
                class and not a hex. recharts paints its own colour onto the
                <path> as a presentation attribute and puts any className on the
                <g> around it, so a fill-* utility loses to the attribute and
                the whole chart comes out recharts blue — it did. `color` is
                inherited, and currentColor resolves on the path itself, so the
                token wins and still swaps with the light and dark palettes on
                its own. */}
            <Area
              dataKey="behind"
              className="text-absent ek-band"
              fill="currentColor"
              fillOpacity={0.28}
              stroke="none"
              isAnimationActive={false}
              activeDot={false}
            />
            <Area
              dataKey="ahead"
              className="text-present ek-band"
              fill="currentColor"
              fillOpacity={0.28}
              stroke="none"
              isAnimationActive={false}
              activeDot={false}
            />
            <Line
              dataKey="expected"
              className="text-accent ek-curve"
              stroke="currentColor"
              strokeWidth={2}
              strokeLinecap="round"
              strokeLinejoin="round"
              isAnimationActive={false}
              dot={endDot('fill-accent')}
              activeDot={false}
            />
            <Line
              dataKey="received"
              className="text-present ek-curve"
              stroke="currentColor"
              strokeWidth={2}
              strokeLinecap="round"
              strokeLinejoin="round"
              isAnimationActive={false}
              dot={endDot('fill-present')}
              activeDot={false}
            />
            {/* The budget. Same hue as the expected curve, because it is the
                same quantity continued — a fourth colour would say a fourth
                thing is being measured. Dashed is what carries the difference,
                and it is the only dashed mark on the card: the gridlines are
                solid hairlines precisely so that a dash can mean "this part is
                not counted, it is budgeted". No end dot either — the dot on the
                other two says "this is where the club stands now", and the far
                end of a forecast is the one point that is least true. */}
            {showBudget && (
              <Line
                dataKey="budgeted"
                className="text-accent ek-forecast"
                stroke="currentColor"
                strokeWidth={2}
                strokeDasharray="5 4"
                strokeLinecap="round"
                strokeLinejoin="round"
                isAnimationActive={false}
                dot={false}
                activeDot={false}
              />
            )}
          </ComposedChart>
        </ResponsiveContainer>
      </div>
    </section>
  )
}

/**
 * The budget, said in words before it is drawn as a line.
 *
 * The club had this in *Klubbens finanser* as a `Forventede bøder` column and
 * lost it in the move (Lukas, 2026-07-29: *"det synes jeg at vi skal fortsætte
 * med"*). What it must never become is a figure a member reads as the club's
 * money — so it is the one block on this card with a rule down its side, the
 * word **budget** in its label, and a sentence saying in Danish that it is not
 * money the club holds. `Faktiske bøder` and `Modtaget` say what happened;
 * this says what we are planning for.
 *
 * The per-*meeting* figure leads and the per-month figure follows, because the
 * evening is the honest unit — see data/projection.ts. A member who reads only
 * the big number has read the one that is measured rather than spread.
 */
function BudgetNote({
  budget,
  until,
  notes,
}: {
  budget: FineBudget
  until: string
  notes: string[]
}) {
  return (
    <div className="mt-4 border-l-2 border-dashed border-accent pl-3">
      {/* Muted, and no streg on this one: the dashed rule down its side is
          already the mark, and two blue marks on one four-line block is the
          uniformity this pass exists to undo. */}
      <p className="text-[0.6rem] tracking-[0.14em] text-muted uppercase">
        Forventede bøder · budget
      </p>
      <p className="mt-1.5 text-sm leading-snug text-ink">
        <span className="ek-figure text-[1.05rem]">{kr(budget.perMeetingKr)}</span> pr. møde
        {' — '}
        <span className="tabular">{kr(budget.perMonthKr)}</span> pr. måned i gennemsnit
        {until && `, frem til ${until}`}.
      </p>
      <p className="mt-1 text-[0.68rem] leading-relaxed text-faint">
        Det er et budget, ikke penge klubben har. Den stiplede linje viser, hvor
        beholdningen lander, hvis møderne fortsætter som hidtil.
      </p>
      {notes.length > 0 && (
        <ul className="mt-1.5 flex flex-col gap-1">
          {notes.map((n) => (
            <li key={n} className="flex gap-2 text-[0.68rem] leading-relaxed text-faint">
              <span aria-hidden="true" className="mt-[0.45em] size-1.5 shrink-0 rotate-45 bg-accent" />
              {n}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

/** One figure in the legend row. The swatch mirrors its mark: a line, or a fill. */
function Figure({
  keyClass,
  label,
  kr: amount,
  lead = false,
}: {
  keyClass: string
  label: string
  kr: number
  lead?: boolean
}) {
  return (
    <div>
      <dt className="flex items-center gap-1.5 text-[0.6rem] text-faint">
        <span aria-hidden="true" className={keyClass} />
        {label}
      </dt>
      {/* The three figures the curve resolves to, and the page's own face:
          /oekonomi is about the curve, so what the curve *says* is set as
          display type directly under it rather than as three more Sans values
          in a card of Sans values. Ink, not the series colour — a curve's
          colour is unreadable as 11 px text, and the swatch beside the label
          already carries the identity. The gap leads by size — 22 px against
          16 px, because Instrument Serif has one weight and the bold that used
          to make it lead is not available to it. */}
      {/* `data-count`: Lukas, 2026-07-29 — "Og lidt mere motion på tallene."
          These three are the exception to design/README.md's note that
          /oekonomi is left out of the count-up, and the note's reasoning is
          what makes them one. What it argues against is a *bank balance* that
          spins up to its value, "decoration on the one page whose whole job is
          to be exact" — and Klubkassen, the balance a member checks his own
          arithmetic against, still does not move. These are not that. They are
          the readout of the curve directly below them, they count over the same
          900 ms it takes to draw, and the number they land on is the string
          React rendered rather than one this arrived at (lib/reveal.ts refuses
          any figure it cannot rebuild exactly). The line and the figure it
          resolves to finish together, which is the whole point of the card. */}
      <dd
        data-count={amount > 0 ? amount : undefined}
        className={`ek-figure mt-1 ${lead ? 'text-[1.375rem]' : 'text-[1rem]'} text-ink`}
      >
        {kr(amount)}
      </dd>
    </div>
  )
}

/**
 * A dot on the last point only.
 *
 * A marker on every month is a number-on-every-point in another form. The end
 * dot says "this is where the club stands now", which is the one point on the
 * curve that is not history. The 2px ring in the surface colour keeps it legible
 * where the two curves nearly meet.
 */
function endDot(fill: string) {
  return function Dot({ cx, cy, index, points }: DotItemDotProps): ReactElement {
    if (index !== points.length - 1 || cx == null || cy == null) return <g />
    return <circle cx={cx} cy={cy} r={4} className={`${fill} stroke-surface`} strokeWidth={2} />
  }
}

/** The hover readout. Values lead, labels follow — the reader has the month. */
function Readout({
  active,
  payload,
}: {
  active?: boolean
  payload?: { payload: FinancePoint }[]
}) {
  const point = payload?.[0]?.payload
  if (!active || !point) return null
  // A budgeted month has no receipts and no shortfall, and printing either as
  // 0 kr. would report a month that has not happened as a month that went
  // badly. It gets one row, and that row says the word.
  if (point.isBudget) {
    return (
      <div className="rounded-lg border border-line border-dashed bg-raised px-2.5 py-2 text-[0.7rem] shadow-sm">
        <p className="tabular text-faint">
          {daMonth(point.month, { month: 'long', year: 'numeric' })}
        </p>
        <ul className="mt-1 flex flex-col gap-0.5">
          <Row
            keyClass="h-0 w-3 border-t-2 border-dashed border-accent"
            label="Budget"
            kr={point.budgeted ?? 0}
          />
        </ul>
        <p className="mt-1 text-faint">Ikke penge klubben har.</p>
      </div>
    )
  }
  const outstanding = point.outstanding ?? 0
  return (
    <div className="rounded-lg border border-line bg-raised px-2.5 py-2 text-[0.7rem] shadow-sm">
      <p className="tabular text-faint">{daMonth(point.month, { month: 'long', year: 'numeric' })}</p>
      <ul className="mt-1 flex flex-col gap-0.5">
        <Row keyClass="h-[2px] w-3 rounded-full bg-accent" label="Forventet" kr={point.expected ?? 0} />
        <Row keyClass="h-[2px] w-3 rounded-full bg-present" label="Modtaget" kr={point.received ?? 0} />
        <Row
          keyClass={`size-2 rounded-[2px] ${outstanding < 0 ? 'bg-present/40' : 'bg-absent/40'}`}
          label={outstanding < 0 ? 'Forud' : 'Mangler'}
          kr={Math.abs(outstanding)}
        />
      </ul>
    </div>
  )
}

function Row({ keyClass, label, kr: amount }: { keyClass: string; label: string; kr: number }) {
  return (
    <li className="flex items-center gap-1.5">
      <span aria-hidden="true" className={keyClass} />
      <span className="tabular font-semibold text-ink">{kr(amount)}</span>
      <span className="text-faint">{label}</span>
    </li>
  )
}

/**
 * There is nothing to draw, and the card says exactly why.
 *
 * This is the state the club is actually in today: `fines` and `payments` are
 * empty and every meeting is undated, so `buildLedger` has no month to group
 * anything into. The temptation is a flat line along zero — it fills the space
 * and looks like a working chart. It would also be a lie: a flat zero says the
 * club charged nothing and collected nothing, when what is true is that its
 * books have not been moved in here yet. So the space carries the reasons
 * instead, each one measured rather than assumed, and each one something a
 * member can watch disappear.
 */
function NothingToPlot({ books }: { books: BooksState }) {
  const reasons: string[] = []
  if (books.fines === 0 && books.payments === 0) {
    reasons.push(
      'Hverken bøder eller indbetalinger er registreret endnu. Regnskabet ligger stadig i regnearket og er ikke flyttet ind.',
    )
  } else if (books.payments === 0) {
    reasons.push(
      'Der er ikke registreret en eneste indbetaling, så der er intet at holde det opkrævede op imod.',
    )
  } else if (books.fines === 0) {
    reasons.push('Der er ikke registreret bøder endnu.')
  }
  if (books.undatedMeetings > 0 && books.undatedMeetings === books.meetings) {
    reasons.push(
      `Ingen af klubbens ${books.meetings} møder har en dato, så en bøde kan ikke placeres i en måned.`,
    )
  } else if (books.undatedMeetings > 0) {
    reasons.push(
      `${books.undatedMeetings} af ${books.meetings} møder mangler en dato, så deres bøder hører ikke til nogen måned.`,
    )
  }

  return (
    <section data-reveal className="rounded-2xl border border-line bg-surface p-4">
      <SectionTitle onCard>Forventet mod modtaget</SectionTitle>
      <p className="mt-3 text-sm leading-relaxed text-muted">
        Der er ingen kurve at tegne endnu — ikke fordi klubben hverken har opkrævet
        eller modtaget noget, men fordi tallene ikke er her.
      </p>
      {/* The bullet is drawn rather than set. It was a ◇, which Instrument does
          not contain and which therefore arrived from whatever font the phone
          reached for; and the icon set is ten named jobs (§03) with no entry
          for "item in a list", so borrowing a pin or a gavel to mean nothing at
          all would be worse than the character was. A rotated square is the
          same blue lozenge with nothing left to fall back from. */}
      {reasons.length > 0 && (
        <ul className="mt-2 flex flex-col gap-1.5">
          {reasons.map((r) => (
            <li key={r} className="flex gap-2 text-[0.72rem] leading-relaxed text-faint">
              <span
                aria-hidden="true"
                className="mt-[0.45em] size-1.5 shrink-0 rotate-45 bg-accent"
              />
              {r}
            </li>
          ))}
        </ul>
      )}
      <p className="mt-3 text-[0.68rem] leading-relaxed text-faint">
        Vi tegner ikke en flad linje ved nul i mellemtiden. Den ville se ud som et
        regnskab, der går op.
      </p>
    </section>
  )
}
