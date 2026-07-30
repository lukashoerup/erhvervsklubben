import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { MIX_KEYS, MIX_LABELS, type MixKey, type QuarterMix } from '../data/fines'
import { kr } from './FinanceChart'
import { SectionTitle } from './SectionTitle'
import { Sweep } from './Sweep'

/** Column headings for the table view, short enough for six columns at 420 px. */
const TABLE_HEAD: Record<MixKey, string> = {
  dues: 'Kontingent',
  'for-sent': 'For sent',
  skaal: 'Skål',
  other: 'Øvrige',
}

/** The ramp, as tokens. Fixed order, never sorted by size — see index.css. */
const FILL: Record<MixKey, string> = {
  dues: 'text-mix-1',
  'for-sent': 'text-mix-2',
  skaal: 'text-mix-3',
  other: 'text-mix-4',
}

/**
 * Where the club's money comes from, quarter by quarter.
 *
 * Lukas, 2026-07-30: *"Du må også gerne tilføje en graf længere nede som viser
 * indtægtsfordeling (kontingenter, bødetyper) over tid. Tænker et søjlediagram …
 * Alle medlemmer skal kunne se det."* Outside every `isTreasurer` gate, for that
 * reason.
 *
 * ===========================================================================
 * Quarters, not months
 * ===========================================================================
 * The club's own two rules decide it. Fines are collected **quarterly**
 * (Bødekasseregulativ Stk. 3), and §9 puts a dinner on the calendar roughly every
 * other month. On a monthly axis that draws a flat 800 kr. kontingent bar with a
 * fine spike in every second one and nothing in between — a sawtooth that is the
 * club's *calendar*, which a reader would take for a collection problem. On
 * quarters the fines land in the period the club actually bills them in, fourteen
 * months becomes six bars, and six bars fit 420 px where fourteen do not. The page
 * already reports "Kvartalsvis opkrævning", so the unit is one it has taught.
 *
 * ===========================================================================
 * Two things this chart must not be read as, and says so
 * ===========================================================================
 * **It is what the club charged, not what the bank itemised.** `payments` holds
 * one combined figure per month covering kontingent and fines together, because
 * that is all the statement says (docs/finance-reconciliation.md §16). The
 * kontingent half of every bar is therefore *derived* — the rate times the members
 * charged that month — and the fine half comes from the `fines` rows. Presenting
 * that as though the bank had broken it down would be inventing an itemisation
 * that does not exist.
 *
 * **`payments.month` is the month a payment settles**, not the month the money
 * arrived, so this is an accrual view. A catch-up transfer is spread across the
 * months it was for. Said on the card in one line, because the same bar height
 * would otherwise be read as cash landing in that quarter.
 *
 * ===========================================================================
 * One hue in four steps, and why it is not four colours
 * ===========================================================================
 * The segments are the parts of one figure, not four series being compared, so
 * they are a sequential ramp of the club's own blue. Four fresh hues would say
 * four independent things are being measured — which is what the curve above
 * already does with blue against green — and would undo T072's whole point about
 * the accent meaning one thing. The steps are validated in both palettes; the
 * measurements are in index.css next to the tokens.
 *
 * `drikkevare` and `frivillig` are one 50 kr. fine each and are folded into
 * `Øvrige bøder` rather than drawn as two-pixel slivers. The table under the chart
 * itemises them, so the chart carries the shape and the table carries every krone.
 */
export function IncomeMix({
  quarters,
  undatedKr,
}: {
  quarters: QuarterMix[]
  /** Fines on meetings with no date. They belong to no quarter — stated, not dropped. */
  undatedKr: number
}) {
  if (quarters.length === 0) return null

  const total = quarters.reduce((n, q) => n + q.total, 0)
  const present = MIX_KEYS.filter((k) => quarters.some((q) => q[k] > 0))
  const sumOf = (k: MixKey) => quarters.reduce((n, q) => n + q[k], 0)

  return (
    <section data-reveal className="rounded-2xl border border-line bg-surface p-4">
      <SectionTitle onCard>Indtægtsfordeling pr. kvartal</SectionTitle>
      <p className="mt-2 text-[0.68rem] leading-relaxed text-faint">
        Hvad klubben har opkrævet, fordelt på kilde. Kvartaler, fordi bøder
        opkræves kvartalsvist og der er møde hver anden måned — pr. måned ville
        kurven vise klubbens kalender frem for dens økonomi.
      </p>

      {/* The legend, with the totals in it. `≥ 2 series` means a legend is not
          optional, and putting the period total in each entry means the reader
          gets every segment's whole-history figure without hovering anything —
          which on a phone is the only way he gets it at all. */}
      <dl className="mt-3 flex flex-wrap gap-x-4 gap-y-1.5">
        {present.map((k) => (
          <div key={k} className="flex items-baseline gap-1.5">
            <span
              aria-hidden="true"
              className={`mt-[0.3em] size-2.5 shrink-0 rounded-[3px] ${FILL[k]}`}
              style={{ backgroundColor: 'currentColor' }}
            />
            <dt className="text-[0.68rem] text-muted">{MIX_LABELS[k]}</dt>
            <dd className="tabular text-[0.68rem] font-semibold text-ink">{kr(sumOf(k))}</dd>
          </div>
        ))}
      </dl>

      <div
        role="img"
        aria-label={`Søjlediagram over klubbens opkrævede indtægter pr. kvartal, ${
          quarters[0].quarter
        } til ${quarters[quarters.length - 1].quarter}, i alt ${kr(total)}. ${present
          .map((k) => `${MIX_LABELS[k]} ${kr(sumOf(k))}`)
          .join('. ')}.`}
        /* Same placement reasoning as the finance curve: `data-draw` on the plot
           box, so the sweep starts when the plot itself is 18 % into view rather
           than when the heading is. */
        data-draw
        className="mt-3 -mx-1"
      >
        <Sweep id="ek-mix-sweep" />
        <div
          className="ek-plot"
          style={{ '--ek-sweep-clip': 'url(#ek-mix-sweep)' } as React.CSSProperties}
        >
          <ResponsiveContainer width="100%" height={190}>
            <BarChart data={quarters} margin={{ top: 8, right: 6, bottom: 0, left: 0 }}>
              {/* Solid hairlines, horizontal only. Dashing a gridline makes it
                  read as a threshold, and the one dashed mark on this page is
                  the budget line on the card above. */}
              <CartesianGrid vertical={false} className="stroke-line" strokeWidth={1} />
              <XAxis
                dataKey="quarter"
                tickLine={false}
                axisLine={false}
                interval={0}
                tick={{ className: 'fill-faint tabular', fontSize: 10 }}
              />
              <YAxis
                width={46}
                tickLine={false}
                axisLine={false}
                tickFormatter={(v: number) => v.toLocaleString('da-DK')}
                tick={{ className: 'fill-faint tabular', fontSize: 10 }}
              />
              <Tooltip content={<Readout />} cursor={{ className: 'fill-line/40' }} />
              {/* One stack, in `MIX_KEYS` order and never in size order.
                  `stroke` in the card's own surface at 1 px gives the 2 px gap
                  between segments that keeps two adjacent steps of one ramp from
                  reading as one block — a gap, not a border drawn around a mark.
                  Recharts' own animation stays off, as everywhere in this app:
                  the sweep is the whole gesture. */}
              {MIX_KEYS.map((k, i) => (
                <Bar
                  key={k}
                  dataKey={k}
                  stackId="mix"
                  name={MIX_LABELS[k]}
                  className={FILL[k]}
                  fill="currentColor"
                  stroke="var(--color-surface)"
                  strokeWidth={1}
                  isAnimationActive={false}
                  maxBarSize={34}
                  /* Only the top of the stack is rounded, and only on the last
                     key that any quarter actually uses — rounding every segment
                     would draw four pills in a column instead of one bar. */
                  radius={i === MIX_KEYS.length - 1 ? [3, 3, 0, 0] : undefined}
                />
              ))}
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="mt-3 overflow-x-auto">
        <table className="w-full text-xs">
          <caption className="sr-only">
            Klubbens opkrævede indtægter pr. kvartal, fordelt på kilde
          </caption>
          <thead>
            <tr className="text-faint">
              <th className="text-left font-normal">Kvartal</th>
              {/* The legend above carries the full wording. Six columns of it at
                  420 px turned "Skål før Leads første skål" into a three-line
                  header wider than the figures beneath it. */}
              {present.map((k) => (
                <th key={k} className="text-right font-normal">
                  {TABLE_HEAD[k]}
                </th>
              ))}
              <th className="text-right font-normal">I alt</th>
            </tr>
          </thead>
          <tbody className="tabular">
            {quarters.map((q) => (
              <tr key={q.quarter} className="border-t border-line">
                <td className="py-1.5">{q.quarter}</td>
                {present.map((k) => (
                  <td key={k} className="py-1.5 text-right">
                    {q[k] > 0 ? kr(q[k]) : '—'}
                  </td>
                ))}
                <td className="py-1.5 text-right font-semibold text-ink">{kr(q.total)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* The two things a bar chart of this data can be misread as, said plainly.
          Both are facts about the source, not caveats about the drawing. */}
      <p className="mt-3 text-[0.68rem] leading-relaxed text-faint">
        Kontingentdelen er beregnet — takst gange de medlemmer, klubben opkrævede i
        måneden. Banken viser ét samlet beløb pr. måned og har aldrig delt det op,
        så opdelingen her er klubbens egen, ikke bankens. Og en indbetaling hører
        til den måned, den dækker, ikke den dag den kom ind.
        {undatedKr > 0 && (
          <>
            {' '}
            <span className="tabular">{kr(undatedKr)}</span> i bøder hører til møder
            uden dato og indgår ikke i noget kvartal.
          </>
        )}
      </p>
    </section>
  )
}

/** The hover readout. Values lead, labels follow — the same idiom as the curve. */
function Readout({
  active,
  payload,
  label,
}: {
  active?: boolean
  payload?: { payload: QuarterMix }[]
  label?: string
}) {
  const point = payload?.[0]?.payload
  if (!active || !point) return null
  const rows = MIX_KEYS.filter((k) => point[k] > 0)
  return (
    <div className="rounded-lg border border-line bg-raised px-2.5 py-2 text-[0.7rem] shadow-sm">
      <p className="tabular text-faint">{label}</p>
      <ul className="mt-1 flex flex-col gap-0.5">
        {rows.map((k) => (
          <li key={k} className="flex items-center gap-1.5">
            <span
              aria-hidden="true"
              className={`size-2 rounded-[2px] ${FILL[k]}`}
              style={{ backgroundColor: 'currentColor' }}
            />
            <span className="tabular font-semibold text-ink">{kr(point[k])}</span>
            <span className="text-faint">{MIX_LABELS[k]}</span>
          </li>
        ))}
        <li className="mt-0.5 flex items-center gap-1.5 border-t border-line pt-0.5">
          <span className="tabular font-semibold text-ink">{kr(point.total)}</span>
          <span className="text-faint">i alt</span>
        </li>
      </ul>
    </div>
  )
}
