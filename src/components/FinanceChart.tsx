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
  /** Everything owed up to and including this month. */
  expected: number
  /** Everything actually paid up to and including this month. */
  received: number
  /** Positive = the club is owed money; negative = it has been paid ahead. */
  outstanding: number
  /** The band where money is missing. Zero-height in a month that is ahead. */
  behind: [number, number]
  /** The band where more came in than was owed. Zero-height in a month behind. */
  ahead: [number, number]
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
export function financeSeries(ledger: LedgerMonth[]): FinancePoint[] {
  // Once the history crosses a new year, every tick carries its year. The axis
  // drops labels that will not fit, and the ones it drops first are the ones
  // that named the year — leaving two "jun." two years apart.
  const spansYears =
    ledger.length > 0 && ledger[0].month.slice(0, 4) !== ledger[ledger.length - 1].month.slice(0, 4)

  return ledger.map((m, i) => {
    const expected = m.expectedBalance
    const received = m.actualBalance
    return {
      month: m.month,
      label:
        spansYears || i === 0
          ? `${daMonth(m.month, { month: 'short' })} ${m.month.slice(2, 4)}`
          : daMonth(m.month, { month: 'short' }),
      expected,
      received,
      outstanding: m.outstanding,
      // Both bands exist at every point, one of them flat. Splitting them into
      // nullable series instead would break the fill at every crossing, and the
      // crossings are exactly where a reader looks.
      behind: [Math.min(received, expected), expected],
      ahead: [expected, Math.max(received, expected)],
    }
  })
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
export function FinanceChart({ ledger, books }: { ledger: LedgerMonth[]; books: BooksState }) {
  const points = financeSeries(ledger)
  if (points.length === 0) return <NothingToPlot books={books} />

  const last = points[points.length - 1]
  const gap = last.outstanding
  const ticks = niceTicks(Math.max(...points.map((p) => Math.max(p.expected, p.received))))
  const span = `${daMonth(points[0].month, { month: 'long', year: 'numeric' })} – ${daMonth(
    last.month,
    { month: 'long', year: 'numeric' },
  )}`

  // Lower case and no full stop: it is read as the tail of the sentence below,
  // where a `kr.` already supplies the point.
  const verdict =
    gap > 0
      ? `klubben mangler ${kr(gap)}`
      : gap < 0
        ? `klubben har fået ${kr(-gap)} mere ind, end den har opkrævet`
        : 'klubben har fået præcis det ind, den har opkrævet'

  return (
    <section data-reveal className="rounded-2xl border border-line bg-surface p-3">
      <SectionTitle onCard>Forventet mod modtaget</SectionTitle>
      <p className="mt-1 text-[0.68rem] leading-relaxed text-faint">
        Akkumuleret, {span}. Afstanden mellem kurverne er det, klubben har opkrævet
        og ikke fået ind.
      </p>

      {/* The legend, and the numbers, in one row — so no value on this screen is
          only reachable by hovering a curve, which on a phone means not at all. */}
      <dl className="mt-3 grid grid-cols-3 gap-2">
        <Figure keyClass="h-[2px] w-3 rounded-full bg-accent" label="Forventet" kr={last.expected} />
        <Figure keyClass="h-[2px] w-3 rounded-full bg-present" label="Modtaget" kr={last.received} />
        <Figure
          keyClass={`size-2.5 rounded-[3px] ${gap < 0 ? 'bg-present/30' : 'bg-absent/30'}`}
          label={gap < 0 ? 'Forud' : 'Mangler'}
          kr={Math.abs(gap)}
          lead
        />
      </dl>

      {/* role="img" with the whole story in words: the SVG underneath is a
          thousand path nodes to a screen reader, and the tooltip does not exist
          for one. The same figures are in the row above and in the table below,
          so nothing here is the only route to a number. */}
      <div
        role="img"
        aria-label={`Kurve over klubbens indtægter, ${span}. Opkrævet i alt ${kr(
          last.expected,
        )}, modtaget ${kr(last.received)} — ${verdict}`}
        /* Never wider than the card, and if anything ever makes it so it is
           this box that scrolls and not the page. The plot is fitted rather
           than widened-and-scrolled on purpose: two smooth curves stay
           readable compressed, and the one month a member actually wants —
           the last one — would be the one off the right-hand edge. */
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
              className="text-absent"
              fill="currentColor"
              fillOpacity={0.28}
              stroke="none"
              isAnimationActive={false}
              activeDot={false}
            />
            <Area
              dataKey="ahead"
              className="text-present"
              fill="currentColor"
              fillOpacity={0.28}
              stroke="none"
              isAnimationActive={false}
              activeDot={false}
            />
            <Line
              dataKey="expected"
              className="text-accent"
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
              className="text-present"
              stroke="currentColor"
              strokeWidth={2}
              strokeLinecap="round"
              strokeLinejoin="round"
              isAnimationActive={false}
              dot={endDot('fill-present')}
              activeDot={false}
            />
          </ComposedChart>
        </ResponsiveContainer>
      </div>
    </section>
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
      {/* Ink, not the series colour — a curve's colour is unreadable as 11px
          text, and the swatch beside the label already carries the identity.
          The gap leads by weight instead, which is the one thing on this card
          that should be read first. */}
      <dd className={`mt-0.5 ${lead ? 'text-[1.05rem] font-semibold' : 'text-[0.85rem]'} text-ink`}>
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
  return (
    <div className="rounded-lg border border-line bg-raised px-2.5 py-2 text-[0.7rem] shadow-sm">
      <p className="tabular text-faint">{daMonth(point.month, { month: 'long', year: 'numeric' })}</p>
      <ul className="mt-1 flex flex-col gap-0.5">
        <Row keyClass="h-[2px] w-3 rounded-full bg-accent" label="Forventet" kr={point.expected} />
        <Row keyClass="h-[2px] w-3 rounded-full bg-present" label="Modtaget" kr={point.received} />
        <Row
          keyClass={`size-2 rounded-[2px] ${point.outstanding < 0 ? 'bg-present/40' : 'bg-absent/40'}`}
          label={point.outstanding < 0 ? 'Forud' : 'Mangler'}
          kr={Math.abs(point.outstanding)}
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
    <section data-reveal className="rounded-2xl border border-line bg-surface p-3">
      <SectionTitle onCard>Forventet mod modtaget</SectionTitle>
      <p className="mt-2 text-sm leading-relaxed text-muted">
        Der er ingen kurve at tegne endnu — ikke fordi klubben hverken har opkrævet
        eller modtaget noget, men fordi tallene ikke er her.
      </p>
      {reasons.length > 0 && (
        <ul className="mt-2 flex flex-col gap-1.5">
          {reasons.map((r) => (
            <li key={r} className="flex gap-2 text-[0.72rem] leading-relaxed text-faint">
              <span aria-hidden="true" className="text-accent">
                ◇
              </span>
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
