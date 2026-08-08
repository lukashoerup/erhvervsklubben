import { useLastSeen } from '../data/lastSeen'
import { daDate, daWhen } from '../lib/dates'
import { useState, type CSSProperties } from 'react'
import { Sweep } from './Sweep'
import { Eyebrow } from './SectionTitle'

/**
 * Visit dates to a bar per ISO week, oldest first, on a **fixed twelve-week axis**.
 *
 * Lukas, 2026-08-08, on the first version: *"Den nye graf viser bare en stor klods …
 * der må være lidt mere, så det ikke bare er en stor klods."* He was looking at the
 * truth: every visit the club has is from the week recording started, so the chart
 * drew one bar, at full height, across the full width. One bar is a rectangle.
 *
 * So the axis is twelve slots wide whatever the data does, and — this is the part
 * that took a second try — it runs **forward from the first recorded week**, not
 * backward from this one. Backwards would fill the chart with eleven empty weeks
 * before recording began, which reads as *nobody opened the site for three months*.
 * That is false and unfair to the club. Forward shows the weeks that have not
 * happened yet, which is what he asked to be able to see.
 *
 * Once there is more than twelve weeks of history the window becomes an ordinary
 * trailing one — the last twelve — because by then the future needs no explaining
 * and a bar narrower than about 8 px on a 420 px phone stops being readable.
 *
 * `future` is carried per week rather than derived by the caller: a week with no
 * visits and a week that has not arrived look identical in a bar chart, and only one
 * of them is a fact about the club.
 */
const WEEKS = 12

export type Week = { week: string; n: number; future: boolean }

/**
 * Monday of the week a date falls in, as an ISO date.
 *
 * `getUTCDay()` is 0 on Sunday, so Sunday rolls back six days rather than one —
 * the off-by-one that would put a Sunday visit in the following week.
 */
function monday(iso: string): string {
  const d = new Date(`${iso}T00:00:00Z`)
  d.setUTCDate(d.getUTCDate() - ((d.getUTCDay() + 6) % 7))
  return d.toISOString().slice(0, 10)
}

export function byWeek(dates: string[], today = new Date().toISOString().slice(0, 10)): Week[] {
  if (dates.length === 0) return []
  const key = (d: Date) => d.toISOString().slice(0, 10)
  const step = (iso: string) => new Date(`${iso}T00:00:00Z`)
  const counts = new Map<string, number>()
  for (const iso of dates) {
    const k = monday(iso)
    counts.set(k, (counts.get(k) ?? 0) + 1)
  }
  const sorted = [...dates].sort()
  const first = step(monday(sorted[0]))
  const last = step(monday(sorted[sorted.length - 1]))
  const thisWeek = monday(today)

  // Twelve slots from the first recorded week, or the last twelve once the history
  // is longer than that. `end` is whichever is further out, so a chart that has
  // outgrown the window never loses its newest bar to the padding.
  const twelve = new Date(first)
  twelve.setUTCDate(twelve.getUTCDate() + (WEEKS - 1) * 7)
  const end = key(twelve) > key(last) ? twelve : last

  const out: Week[] = []
  for (let w = new Date(first); key(w) <= key(end); ) {
    const k = key(w)
    const n = counts.get(k) ?? 0
    // **A week with visits in it is never "future", whatever the clock says.** Both
    // the chart and the strips draw a future week as nothing at all, so this is the
    // difference between a visit being shown and a visit disappearing — and the two
    // dates being compared do not come from the same place. `visited_on` is the
    // database's `current_date`, which is Danish; `today` is the browser's UTC day.
    // Between midnight and 02:00 in Copenhagen those differ, so a member opening the
    // site late on a Sunday night gets a Monday visit that UTC still calls next week.
    // You cannot visit in a week that has not happened, so the data settles it.
    out.push({ week: k, n, future: n === 0 && k > thisWeek })
    w = new Date(w)
    w.setUTCDate(w.getUTCDate() + 7)
  }
  return out.slice(-WEEKS)
}

const DAY_MONTH: Intl.DateTimeFormatOptions = { day: 'numeric', month: 'short' }

/**
 * "27. jul. – 2. aug." — a week said the way a member would say it.
 *
 * Not "uge 31". The club does not talk in ISO week numbers and neither does anyone
 * outside a payroll department; the two dates are longer and are the only version
 * that can be read without counting.
 */
export function weekLabel(monday: string): string {
  const end = new Date(`${monday}T00:00:00Z`)
  end.setUTCDate(end.getUTCDate() + 6)
  return `${daDate(monday, DAY_MONTH)} – ${daDate(end.toISOString().slice(0, 10), DAY_MONTH)}`
}

/** Danish has a singular, and it is not "besøgsdag(e)". */
const besoegsdage = (n: number) => `${n} ${n === 1 ? 'besøgsdag' : 'besøgsdage'}`

/**
 * One member's visit days laid on the **club's own axis**.
 *
 * Lukas, 2026-08-08: *"Vi skal gerne kunne se hvor mange gange hvert medlem har
 * besøgt og hvornår. Hvis det kan fyldes ind i grafen."* The count was already on
 * the screen — *"3 dage"* — and the *when* was not: one club-wide total says how
 * busy a week was and nothing about who made it busy.
 *
 * Taking the axis as an argument rather than recomputing one per member is the
 * whole point. Ten members with ten independently-derived windows would each start
 * at their own first visit, so the columns would line up with nobody, and the club
 * bar above would stop being the sum of the strips below it. Given the axis, that
 * property holds by construction — and it is the property that makes the figure
 * readable as one thing rather than eleven.
 */
export function onAxis(weeks: Week[], dates: string[]): number[] {
  const counts = new Map<string, number>()
  for (const iso of dates) {
    const k = monday(iso)
    counts.set(k, (counts.get(k) ?? 0) + 1)
  }
  return weeks.map((w) => counts.get(w.week) ?? 0)
}

/**
 * "Sidst set" — when each member last opened the site.
 *
 * **The club's since 2026-08-08**, not the treasurer's. Lukas published it off his
 * own wishlist — *"Offentliggøre login aktivitet"* — which reverses the decision
 * below rather than refining it. The reasoning in the next paragraph has not become
 * wrong; he has decided the club can carry it, the same way he opened the finances
 * on 2026-07-30. Two RLS policies moved with it, because the names live in
 * `user_member_mapping` and timestamps nobody can attach to a person are worse than
 * either the closed or the open version.
 *
 * Lukas asked how often the members visit, and nothing in the app could tell him.
 * This is the answer, in three readings of the same rows: the club's weeks as a bar
 * chart, then per member how many days he has been in and — since 2026-08-08, on his
 * *"kan det fyldes ind i grafen"* — which weeks those were, on the club's own axis.
 * **It is still one row per member per day and nothing else**: no page, no order, no
 * duration. Every figure on this screen is that one row counted a different way.
 *
 * **Folded shut, and that is still the design** — more so now that everyone can
 * open it. This is the only thing the app records about a member's *behaviour*
 * rather than about the club, and in a club of ten where everyone knows everyone, a
 * permanent list of who has not been around is a different social object from a fact
 * you can go and look up. Closed, `/anciennitet` is exactly the page it was; open,
 * it answers the question. Publishing it changed who may open the fold, not whether
 * there is one. `<details>` rather than a state flag: it is a native disclosure, it
 * works before the JavaScript settles, and a phone gets the keyboard and screen
 * reader behaviour for nothing.
 *
 * **Sorted by name, never by recency.** Ordering ten men by how long they have
 * been away builds the league table the fold exists to avoid — and it would sit
 * directly under a bar chart that really is a ranking, which is exactly how a
 * reader would take it. Alphabetical is the one order that says nothing.
 *
 * Absence is shown as absence. Two of the ten have no login at all, and a member
 * who has one may simply never have opened the new site; those are different
 * facts, they are both said in words, and neither is rendered as a date.
 */
export function LastSeen({ roster }: { roster: string[] }) {
  const { data, isPending, error } = useLastSeen()
  /**
   * Which week the reader has tapped, or null.
   *
   * Lukas, 2026-08-08: *"Kan man lave noget så man kan se lidt tal når man trykker
   * på graferne? Det skal gerne give incitament til at man kommer mere ind."*
   *
   * So the readout is not only the figure — it is **the names**. A count says the
   * week was quiet; a list of four men says who was here and, by omission, who was
   * not, and the reader is one of the ten either way. That is the incentive he asked
   * for, and it needs no ranking to work: the fold is still alphabetical, and no
   * screen here orders the club by how much anyone has been away.
   */
  const [picked, setPicked] = useState<string | null>(null)

  // No error state and no spinner. Nothing on this page depends on it, and a
  // red box about a feature nobody asked to see is worse than the fold staying
  // shut — which, unopened, is what it already looks like.
  if (isPending || error || !data) return null

  const names = [...roster].sort((a, b) => a.localeCompare(b, 'da'))
  const withLogin = new Set(data.hasLogin)
  const days: Record<string, number> = {}
  for (const name of names) days[name] = data.visits[name]?.length ?? 0

  // The club's own rhythm, by week. Weeks rather than days because a club of ten
  // produces a handful of visits a day and a daily axis is mostly gaps; and rather
  // than months because §9 puts a meeting on the calendar every other month, so a
  // monthly bar would flatten the thing worth seeing — whether the site gets opened
  // between meetings or only around them.
  // The roster's visits, not every mapped account's. An account the club list cannot
  // name — the tooling admin, say — has no row in the list below, so counting it here
  // would make the club bar taller than the strips it is supposed to be the sum of.
  // That property is now the whole point of the figure, so it is enforced rather than
  // assumed.
  const weeks = byWeek(names.flatMap((n) => data.visits[n] ?? []))
  const most = Math.max(1, ...weeks.map((w) => w.n))
  const ahead = weeks.filter((w) => w.future).length

  // Each member's own days, on the same twelve weeks. Built here rather than in the
  // row so `busiest` can be known before the first cell is drawn.
  const strip: Record<string, number[]> = {}
  for (const name of names) strip[name] = onAxis(weeks, data.visits[name] ?? [])

  // Shading scales against the busiest week **anyone** had, not against each man's
  // own best. Per-member scaling would paint a man who came once as darkly as a man
  // who came five times, which is the one reading this figure must not support.
  // While every week is a single day — which is all the club has so far — every
  // filled cell is full strength, so "he was here that week" stays legible.
  const busiest = Math.max(1, ...Object.values(strip).flat())

  // The tapped week, resolved once. `at` is -1 when nothing is picked, which is the
  // index no strip has — so every "is this the picked cell" test below is one
  // comparison and needs no null check of its own.
  const at = picked ? weeks.findIndex((w) => w.week === picked) : -1
  const week = at >= 0 ? weeks[at] : null
  const wasIn = week ? names.filter((n) => strip[n][at] > 0) : []

  return (
    <details data-reveal className="rounded-2xl border border-line bg-surface">
      {/* min-h-12: the design system's tap floor, and this is a control. The
          marker is left as the browser's — an invented chevron is one more icon
          to keep in step with §03 for no gain. */}
      <summary className="flex min-h-12 cursor-pointer list-none items-center justify-between p-4">
        <Eyebrow>Sidst set</Eyebrow>
        <span className="text-[0.62rem] text-faint">Hele klubben</span>
      </summary>

      {/* The club's weeks first, the members' underneath. Reordered on 2026-08-08
          when the per-member strips arrived: they are read *against* this axis, and
          an axis explained after the rows that use it is an axis nobody reads. */}
      {weeks.length > 0 && (
        <div className="border-t border-line px-4 py-4">
          <Eyebrow>Besøg pr. uge · hele klubben</Eyebrow>
          {/* **The same sweep as every other chart in the app.** Lukas, 2026-08-08:
              *"Husk animationerne på grafen som der er på de andre grafer."* It had
              `data-bar` — the ten-bar grow the anciennitet chart uses, 900 ms — which
              is a different gesture from the one the three charts on /oekonomi share,
              and picking whichever neighbour is closest is how a page ends up with
              three ways of arriving. `Sweep` is that one gesture: a single clipped
              edge scaling up from the baseline over 1600 ms, uncovering the whole
              plot at once.

              It clips an ordinary list of `<span>`s here rather than an SVG chart,
              which is exactly what `clipPathUnits="objectBoundingBox"` buys — the
              clip is the element's own box in fractions, so nothing has to know how
              tall this is.

              `data-draw` on the plot box, as on the others, so the sweep starts when
              the bars are 18 % into view rather than when the heading is. */}
          {/* `relative`, so the tooltip below can hang off the plot. `mt-6` rather
              than `mt-3` gives an ordinary two-line tooltip room to clear the heading
              — but the space is *not* reserved for the worst case, because a tooltip
              overlays. Reserving its height would leave 60 px of blank card above the
              chart at all times to avoid an overlap that is the correct behaviour: a
              week with all ten names covers the eyebrow while it is open, exactly as
              `FinanceChart`'s tooltip covers its own plot. Nothing moves when it opens
              or closes, which is the part §05 actually asks for. */}
          <div data-draw className="relative mt-6">
            <Sweep id="ek-visits-sweep" />

            {/* **The tooltip Lukas asked for.** *"Kan vi få nogle tal på graferne når
                man klikker på dem? Lidt som på grafen med indestående hvor at der
                kommer en lille tooltip op"* — so it is the same card as
                `FinanceChart`'s `Readout`, down to the border, the raised ground and
                the 0.7 rem type. One tooltip idiom in the app, not two.

                **Full width with a caret, rather than a box centred on the bar.**
                Twelve bars across a 420 px phone are ~28 px each; a card wide enough
                to hold four names, centred on bar 1 or bar 12, hangs off the side of
                the card. So the box spans the plot and a caret marks which bar it is
                about — the same information, and it cannot overflow. The picked bar
                turns the brighter blue as well, so the pointer is doubled.

                Outside `.ek-plot` on purpose: that class is what the sweep clips, and
                a tooltip inside it would be cut in half by the arriving animation. */}
            {week && (
              <div
                role="status"
                className="absolute bottom-full left-0 right-0 mb-2 rounded-lg border border-line bg-raised px-2.5 py-2 text-[0.7rem] shadow-sm"
              >
                <p className="tabular text-faint">{weekLabel(week.week)}</p>
                <p className="mt-0.5 leading-relaxed">
                  {week.n === 0 ? (
                    <span className="text-muted">Ingen var inde.</span>
                  ) : (
                    <>
                      <span className="tabular font-semibold text-ink">
                        {besoegsdage(week.n)}
                      </span>
                      <span className="text-muted"> · {wasIn.join(', ')}</span>
                    </>
                  )}
                </p>
                {/* Rotated square with two borders, so it reads as a corner of the
                    card rather than as a separate mark. Positioned on the bar's own
                    centre; only 8 px wide, so it can sit at either extreme without
                    anything to clamp. */}
                <span
                  aria-hidden="true"
                  className="absolute -bottom-1 size-2 -translate-x-1/2 rotate-45 border-b border-r border-line bg-raised"
                  style={{ left: `${((at + 0.5) / weeks.length) * 100}%` }}
                />
              </div>
            )}

            {/* **No longer `aria-hidden`.** The bars are buttons now, so each one
                carries its own week and figure as its label — which means the chart
                answers to a screen reader for the first time, in the same words the
                tooltip prints. */}
            <ul
              aria-label="Besøg pr. uge"
              className="ek-plot flex items-end gap-1"
              style={{ '--ek-sweep-clip': 'url(#ek-visits-sweep)' } as CSSProperties}
            >
              {weeks.map((w) => (
                <li key={w.week} className="flex flex-1 flex-col items-center gap-1">
                  {/* h-16 clears §03's 48 px tap floor on the axis that can: twelve
                      columns on a 420 px phone are ~28 px wide and no layout makes
                      them 48. Height is what a thumb has to hit here. */}
                  <button
                    type="button"
                    aria-pressed={w.week === picked}
                    onClick={() => setPicked(w.week === picked ? null : w.week)}
                    aria-label={`${weekLabel(w.week)}: ${besoegsdage(w.n)}`}
                    className="flex h-16 w-full items-end"
                  >
                    {/* A week nobody visited is a stub on the baseline; a week that
                        has not arrived is nothing at all. They are different facts
                        and a bar chart draws them the same unless told otherwise. */}
                    {w.future ? (
                      <span className="h-px w-full rounded-full bg-line" />
                    ) : (
                      <span
                        /* The picked bar takes the brighter blue. §01 marks a live
                           row by border weight rather than fill, but a bar *is*
                           fill — there is no border to thicken — so the one thing
                           left that does not move the layout is the hue. */
                        className={`w-full rounded-t-[3px] ${
                          w.week === picked ? 'bg-accent' : 'bg-accent-d'
                        }`}
                        style={{ height: `${Math.max(4, (w.n / most) * 100)}%` }}
                      />
                    )}
                  </button>
                </li>
              ))}
            </ul>
          </div>
          {/* What a tap buys. Twelve bars two pixels apart cannot carry labels on a
              420 px phone, so the figures live here — and the *names* live here too,
              which is the half Lukas asked for: "Det skal gerne give incitament til
              at man kommer mere ind." A count says the week was quiet. Four names
              says who was here, and the reader is one of the ten either way.

              `aria-live`, so a screen reader is told the readout changed rather than
              having to go and find it — the tap is on the bar, the answer is here. */}
          {/* Back to a plain caption now that the tooltip carries the reading. It
              still has to say the total and how to get at the rest: a chart whose
              numbers only appear on a tap is a chart whose numbers a first-time
              reader never finds. */}
          <p className="mt-2 text-[0.68rem] leading-relaxed text-faint">
            Én søjle pr. uge, ældst til venstre — tryk på en søjle for at se hvem der
            var inde. I alt{' '}
            <span className="tabular">{weeks.reduce((n, w) => n + w.n, 0)}</span>{' '}
            besøgsdage
            {ahead > 0 && (
              <>
                {' '}
                — og <span className="tabular">{ahead}</span>{' '}
                {ahead === 1 ? 'uge' : 'uger'} der endnu ikke er kommet
              </>
            )}
            .
          </p>
        </div>
      )}

      {/* Its own `data-draw`, not the chart's. One wrapper around both would put the
          observer's 18 % threshold on a box twelve rows tall, so the sweep would wait
          until half the list was past the thumb — and the chart at the top of it would
          already have been on screen for a second. Two boxes, each arriving when it is
          actually looked at. */}
      <div
        data-draw
        className="border-t border-line px-4 py-1"
        style={{ '--ek-sweep-clip': 'url(#ek-visits-rows-sweep)' } as CSSProperties}
      >
        <Sweep id="ek-visits-rows-sweep" />
        <ul aria-label="Sidst set, pr. medlem">
        {names.map((name) => {
          const seen = data.seen[name]
          return (
            <li
              key={name}
              className="grid grid-cols-[1fr_auto] items-baseline gap-x-3 border-b border-line/50 py-2.5 text-sm last:border-b-0"
            >
              <span>{name}</span>
              <span className="flex items-baseline gap-3">
                {/* How many days he has been in, beside when he last was. Lukas,
                    2026-08-08: "inkl. hvor mange gange folk har været inde og
                    hvornår." Days, not page loads — a man who reloads three times
                    over lunch has been in once, and counting loads would measure
                    his browser rather than his interest. Hidden at zero rather
                    than printed as "0 dage": a member with no login has not
                    stayed away, he was never able to come. */}
                {days[name] > 0 && (
                  <span className="tabular text-[0.8rem] font-semibold text-ink">
                    {days[name] === 1 ? '1 dag' : `${days[name]} dage`}
                  </span>
                )}
                <span className={seen ? 'tabular text-muted' : 'text-faint'}>
                  {seen ? daWhen(seen) : withLogin.has(name) ? 'aldrig åbnet siden' : 'intet login'}
                </span>
              </span>

              {/* His own weeks, on the club's axis — Lukas, 2026-08-08: *"hvor mange
                  gange hvert medlem har besøgt og hvornår. Hvis det kan fyldes ind i
                  grafen."* The count was already on the line above; this is the
                  *hvornår*, and the two together are the answer.

                  Column two of the same grid row would fight the name and the date
                  for width on a 420 px phone. `col-span-2` on its own line gives it
                  the full column, which is also what makes it line up with the club
                  chart above — same width, same twelve cells, same `gap-1`. The club
                  bar is then visibly the sum of the strips under it.

                  Only for members with a login. Twelve empty cells against a man who
                  was never given an account reads as "he stays away", and he has not
                  — he cannot come. */}
              {weeks.length > 0 && withLogin.has(name) && (
                <span className="ek-plot col-span-2 mt-2 flex gap-1" aria-hidden="true">
                  {weeks.map((w, i) => {
                    const n = strip[name][i]
                    return (
                      <span
                        key={w.week}
                        /* The tapped week, marked down every strip at once. This is
                           what turns one tap into a column you can read vertically:
                           the club's bar above and, under it, which of the ten it
                           was made of. A ring rather than a colour change, so a
                           week with no visits still shows where the column is. */
                        className={`h-2 flex-1 rounded-[2px] ${
                          w.week === picked ? 'ring-1 ring-accent' : ''
                        } ${w.future ? '' : n === 0 ? 'bg-line' : 'bg-accent-d'}`}
                        style={
                          !w.future && n > 0 ? { opacity: 0.45 + 0.55 * (n / busiest) } : undefined
                        }
                      />
                    )
                  })}
                </span>
              )}
            </li>
          )
        })}
        </ul>
      </div>

      {/* Said on the screen rather than only in this file, because the members
          can be told what is recorded about them by their treasurer reading it
          off the page. */}
      <p className="px-4 pb-4 pt-3 text-[0.68rem] leading-relaxed text-faint">
        {weeks.length > 0 && (
          <>
            Striben under hvert navn følger de samme uger som grafen ovenfor: et felt er
            en uge han var inde, mørkere jo flere dage, og en tom plads er en uge der
            ikke er kommet endnu.{' '}
          </>
        )}
        Der gemmes én linje pr. medlem pr. dag han har åbnet siden — ikke hvilke sider
        nogen har set, og ikke hvor længe. Dagene før 8. august 2026 er hentet fra
        login-loggen og tæller de dage, hvor siden har været åbnet.
      </p>
    </details>
  )
}
