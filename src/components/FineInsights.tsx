import { Bar, BarChart, Cell, LabelList, ResponsiveContainer, XAxis, YAxis } from 'recharts'
import { byOffence, daMinutes, latenessFacts, type FineRow } from '../data/fines'
import { kr } from './FinanceChart'
import { SectionTitle } from './SectionTitle'
import { Sweep } from './Sweep'

/**
 * What the club's fines are actually about.
 *
 * Lukas, 2026-07-30: *"På økonomi siden kunne jeg godt tænke mig at der stod
 * hvilke forseelser der er givet højeste bøder, og evt. også i samme
 * visualisering, hvem det er. Masser af insights."* And, separately and twice:
 * *"Alle medlemmer skal kunne se det."* So this sits outside the `isTreasurer`
 * gates, names members, and is the first thing on `/oekonomi` that tells the club
 * something about itself rather than about its balance.
 *
 * ===========================================================================
 * The two hard parts, and they are both about tone rather than pixels
 * ===========================================================================
 *
 * **1. `for-sent` is 86 % of every krone, by construction.** Late arrival is the
 * only rule with a per-minute component, so it is the only one that can exceed
 * 50 kr., and it will dominate any axis it is on for as long as the club exists.
 * The wrong fixes are a log scale and a broken axis: both make 2.160 kr. and
 * 250 kr. look comparable, which is a lie about the club's money. **The right fix
 * is a direct label on every row.** The bar keeps its true length — the dominance
 * *is* the finding — and the 50 kr. rows, nine pixels of them, are read from the
 * figure beside them rather than from their width. Nothing on this card is
 * legible only as a length.
 *
 * **2. Ten men will read this about themselves.** A chart with one bar per member
 * is a ranking of who behaves worst; a chart with one bar per offence is a club
 * looking at its own habits. Both come out of the same 30 rows, and only the
 * second is what he asked for — he asked for *forseelser* first and *hvem*
 * second. So the offence is the subject and the members are its composition:
 * each row is one offence, divided into one segment per member.
 *
 * **No member owns a colour, and the members are not segments.** Nine members on
 * four bars was tried and abandoned: the smallest share is 60 kr. of a 2.160 kr.
 * bar, which is eight pixels at 420 px — too narrow to hold initials, so identity
 * would have fallen back to nine hues on a dimension that carries no order, past
 * the eight-hue ceiling, on a page whose other chart already uses blue against
 * green. What replaced it is a **single bar per offence in one hue, with the
 * members named in text directly beneath it**: a name at reading size, with its
 * amount, instead of a sliver that needs a legend. It is the same information, it
 * survives a phone, and it costs the club's palette nothing.
 *
 * That also happens to be the kinder encoding, and not by accident — a member is
 * not a *category* of fine, he is a share of one.
 *
 * **What leads is the club's own number.** 202 minutes of collective lateness,
 * seven of nine finable members contributing. Printing that above the chart is
 * what turns "who is worst" into "this is what we are like", and it is true: it is
 * not one man's habit, it is the club's.
 */
/**
 * The club's shorthand for each rule, for the axis only.
 *
 * Keyed by `rule_id` and falling through to the regulation's full wording for an
 * id this build has never heard of — `fines.rule_id` is text precisely so the club
 * can vote in a rule without a migration (see rules.ts), and an unknown rule must
 * still get a name on the axis rather than an empty tick.
 */
const SHORT: Record<string, string> = {
  udeblivelse: 'Udeblivelse',
  'sent-afbud': 'Sent afbud',
  'for-sent': 'For sent',
  drikkevare: 'Anden drikkevare',
  skaal: 'Skål før Lead',
  frivillig: 'Frivilligt indbetalt',
  historisk: 'Ukendt forseelse',
}

export function FineInsights({ fines }: { fines: FineRow[] }) {
  const offences = byOffence(fines)
  const late = latenessFacts(fines)
  const totalKr = fines.reduce((n, f) => n + f.amount_kr, 0)

  if (offences.length === 0) {
    return (
      <section data-reveal className="rounded-2xl border border-line bg-surface p-4">
        <SectionTitle onCard>Bøder · hvad og hvem</SectionTitle>
        <p className="mt-3 text-sm leading-relaxed text-muted">
          Der er ikke registreret bøder endnu, så der er ingen forseelser at gøre op.
        </p>
      </section>
    )
  }

  const widest = offences[0].kr
  // The axis needs a name short enough to sit in 104 px beside the bar. The
  // regulation's own wording is four to seven Danish words — "Bestille en anden
  // type drikkevare end Lead under maden" — which no phone axis can hold, and
  // truncating it to "Bestille en…" names nothing. The full wording is directly
  // under the chart in the list, so the axis carries the club's shorthand and the
  // list carries the statute.
  const data = offences.map((o) => ({ ...o, short: SHORT[o.ruleId] ?? o.offence }))

  return (
    <section data-reveal className="rounded-2xl border border-line bg-surface p-4">
      <SectionTitle onCard>Bøder · hvad og hvem</SectionTitle>

      {/* The club, before any member. The figure that leads a block is serif
          (index.css, `.ek-figure`), and this is the one figure on the card that
          is a single quantity rather than a series — the whole club's lateness,
          added up, which nothing could answer until `minutes` was populated on
          every late arrival in T075. */}
      {late.arrivals > 0 && (
        <>
          <p className="ek-figure mt-3 text-[1.75rem] leading-none">{daMinutes(late.minutes)}</p>
          <p className="mt-1.5 text-xs leading-relaxed text-muted">
            har klubben tilsammen mødt for sent — fordelt på{' '}
            <span className="tabular">{late.arrivals}</span> forsinkelser hos{' '}
            <span className="tabular">{late.members}</span> medlemmer. Den længste
            enkelte forsinkelse var <span className="tabular">{late.worstMinutes}</span> minutter.
          </p>
        </>
      )}

      <p className="mt-3 text-[0.68rem] leading-relaxed text-faint">
        {/* The dominance said in words as well as drawn, because it is the answer
            to his question and a reader should not have to measure a bar to get
            it. Rounded to a whole percent: the club does not need three decimals
            to know it has one vice. */}
        For sent fremmøde er{' '}
        <span className="tabular">{Math.round(late.shareOfKr * 100)} %</span> af klubbens{' '}
        <span className="tabular">{kr(totalKr)}</span> i bøder. Det er den eneste regel
        med en minuttakst, så den vil altid være den dyreste — søjlerne står i deres
        rigtige længde, og beløbet står ved siden af, så de små også kan læses.
      </p>

      {/* One row per offence. `layout="vertical"` puts the offence names down the
          side where they can be read at full length — four Danish rule names
          across a 420 px x-axis would each be truncated to about six
          characters. Height grows with the number of offences rather than being
          fixed, so the last row's label can never be cropped by the container. */}
      <div
        role="img"
        aria-label={`Bøder pr. forseelse. ${offences
          .map((o) => `${o.offence}: ${kr(o.kr)} fordelt på ${o.count}`)
          .join('. ')}.`}
        data-draw
        className="mt-4"
      >
        <Sweep id="ek-fines-sweep" />
        <div className="ek-plot" style={{ '--ek-sweep-clip': 'url(#ek-fines-sweep)' } as React.CSSProperties}>
          <ResponsiveContainer width="100%" height={offences.length * 54 + 8}>
            <BarChart
              data={data}
              layout="vertical"
              margin={{ top: 0, right: 66, bottom: 0, left: 0 }}
              barCategoryGap={14}
            >
              {/* No grid and no x-axis. Every bar is direct-labelled with its own
                  amount, so a scale to read them against would be a second route
                  to a number nobody needs — and gridlines behind four bars on a
                  phone are chrome, not information. */}
              <XAxis type="number" hide domain={[0, widest]} />
              <YAxis
                type="category"
                dataKey="short"
                width={104}
                tickLine={false}
                axisLine={false}
                tick={{ className: 'fill-muted', fontSize: 11 }}
              />
              <Bar
                dataKey="kr"
                className="text-accent"
                fill="currentColor"
                isAnimationActive={false}
                /* 6 px, and rounded on the data end only — the bars grow from a
                   shared left baseline and a rounded root would float them off
                   it. */
                radius={[4, 4, 4, 4]}
                barSize={10}
              >
                {offences.map((o) => (
                  <Cell key={o.ruleId} />
                ))}
                {/* Selectively — the value on the bar's end, and nothing on any
                    other point. `kr` is the club's own formatter, so a bar and
                    the table under it cannot write the same amount two ways. */}
                <LabelList
                  dataKey="kr"
                  position="right"
                  offset={8}
                  className="fill-ink tabular"
                  fontSize={11}
                  fontWeight={600}
                  formatter={(v) => kr(Number(v))}
                />
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* The chart's table view, and the only place "hvem" is complete.
          It is not an accessibility afterthought bolted under a picture: a
          segment eight pixels wide cannot carry a name, and the tooltip that
          could does not exist on a phone. So the names live in text, at the size
          text is read, one row per offence — and the chart above is what makes
          the shape of it visible at a glance. */}
      <dl className="mt-4 flex flex-col gap-3">
        {offences.map((o) => (
          <div key={o.ruleId} className="border-t border-line pt-2.5">
            <dt className="flex items-baseline justify-between gap-3 text-xs font-semibold text-ink">
              <span>{o.offence}</span>
              <span className="tabular shrink-0 font-normal text-faint">
                {o.count === 1 ? '1 bøde' : `${o.count} bøder`}
                {o.minutes > 0 && ` · ${daMinutes(o.minutes)}`}
              </span>
            </dt>
            {/* Members as a wrapped row of chips rather than a stacked list.
                A list puts one name per line and turns nine members into a
                column that reads top-down as a ranking; a wrapped row reads as a
                set, which is what it is. Sorted by amount because the question
                was "hvem" and an arbitrary order would hide the answer, but the
                figure is what carries it, not the position on a chart. */}
            <dd className="mt-1.5 flex flex-wrap gap-1.5">
              {o.members.map((m) => (
                <span
                  key={m.name}
                  className="inline-flex items-baseline gap-1.5 rounded-btn border border-line px-2 py-1 text-[0.7rem]"
                >
                  <span className="text-muted">{m.name}</span>
                  <span className="tabular font-semibold text-ink">{kr(m.kr)}</span>
                  {m.count > 1 && (
                    <span className="tabular text-faint">×{m.count}</span>
                  )}
                </span>
              ))}
            </dd>
          </div>
        ))}
      </dl>

      <p className="mt-3 text-[0.68rem] leading-relaxed text-faint">
        Bøder pålagt, ikke bøder betalt. Hvad der er indbetalt, står i klubkassen.
      </p>
    </section>
  )
}
