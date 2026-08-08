import { useLastSeen } from '../data/lastSeen'
import { daWhen } from '../lib/dates'
import type { CSSProperties } from 'react'
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

export function byWeek(
  dates: string[],
  today = new Date().toISOString().slice(0, 10),
): { week: string; n: number; future: boolean }[] {
  if (dates.length === 0) return []
  const key = (d: Date) => d.toISOString().slice(0, 10)
  // Monday of the week a date falls in. `getUTCDay()` is 0 on Sunday, so Sunday
  // rolls back six days rather than one — the off-by-one that would put a Sunday
  // visit in the following week.
  const monday = (iso: string) => {
    const d = new Date(`${iso}T00:00:00Z`)
    d.setUTCDate(d.getUTCDate() - ((d.getUTCDay() + 6) % 7))
    return d
  }
  const counts = new Map<string, number>()
  for (const iso of dates) {
    const k = key(monday(iso))
    counts.set(k, (counts.get(k) ?? 0) + 1)
  }
  const sorted = [...dates].sort()
  const first = monday(sorted[0])
  const last = monday(sorted[sorted.length - 1])
  const thisWeek = key(monday(today))

  // Twelve slots from the first recorded week, or the last twelve once the history
  // is longer than that. `end` is whichever is further out, so a chart that has
  // outgrown the window never loses its newest bar to the padding.
  const twelve = new Date(first)
  twelve.setUTCDate(twelve.getUTCDate() + (WEEKS - 1) * 7)
  const end = key(twelve) > key(last) ? twelve : last

  const out: { week: string; n: number; future: boolean }[] = []
  for (let w = new Date(first); key(w) <= key(end); ) {
    const k = key(w)
    out.push({ week: k, n: counts.get(k) ?? 0, future: k > thisWeek })
    w = new Date(w)
    w.setUTCDate(w.getUTCDate() + 7)
  }
  return out.slice(-WEEKS)
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
 * Lukas asked how often the members visit, and nothing in the app could tell
 * him. This is the answer, and the whole of it: one line per member, one date,
 * no count of visits and nothing at all about which pages anyone opened.
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
  const weeks = byWeek(Object.values(data.visits).flat())
  const most = Math.max(1, ...weeks.map((w) => w.n))
  const ahead = weeks.filter((w) => w.future).length

  return (
    <details data-reveal className="rounded-2xl border border-line bg-surface">
      {/* min-h-12: the design system's tap floor, and this is a control. The
          marker is left as the browser's — an invented chevron is one more icon
          to keep in step with §03 for no gain. */}
      <summary className="flex min-h-12 cursor-pointer list-none items-center justify-between p-4">
        <Eyebrow>Sidst set</Eyebrow>
        <span className="text-[0.62rem] text-faint">Hele klubben</span>
      </summary>

      <ul className="border-t border-line px-4 py-1">
        {names.map((name) => {
          const seen = data.seen[name]
          return (
            <li
              key={name}
              className="flex items-baseline justify-between gap-3 border-b border-line/50 py-2.5 text-sm last:border-b-0"
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
                  <span className="tabular text-[0.7rem] text-faint">
                    {days[name] === 1 ? '1 dag' : `${days[name]} dage`}
                  </span>
                )}
                <span className={seen ? 'tabular text-muted' : 'text-faint'}>
                  {seen ? daWhen(seen) : withLogin.has(name) ? 'aldrig åbnet siden' : 'intet login'}
                </span>
              </span>
            </li>
          )
        })}
      </ul>

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
          <div data-draw className="mt-3">
            <Sweep id="ek-visits-sweep" />
            <ul
              className="ek-plot flex items-end gap-1"
              style={{ '--ek-sweep-clip': 'url(#ek-visits-sweep)' } as CSSProperties}
              aria-hidden="true"
            >
              {weeks.map((w) => (
                <li key={w.week} className="flex flex-1 flex-col items-center gap-1">
                  <span className="flex h-16 w-full items-end">
                    {/* A week nobody visited is a stub on the baseline; a week that
                        has not arrived is nothing at all. They are different facts
                        and a bar chart draws them the same unless told otherwise. */}
                    {w.future ? (
                      <span className="h-px w-full rounded-full bg-line" />
                    ) : (
                      <span
                        className="w-full rounded-t-[3px] bg-accent-d"
                        style={{ height: `${Math.max(4, (w.n / most) * 100)}%` }}
                      />
                    )}
                  </span>
                </li>
              ))}
            </ul>
          </div>
          {/* The chart's own text alternative, and the only place the figures are
              written out. Ten bars two pixels apart cannot carry labels on a 420 px
              phone, and a chart nobody can read the numbers off is decoration. */}
          <p className="mt-2 text-[0.68rem] leading-relaxed text-faint">
            Én søjle pr. uge, ældst til venstre. I alt{' '}
            <span className="tabular">{weeks.reduce((n, w) => n + w.n, 0)}</span> besøgsdage
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

      {/* Said on the screen rather than only in this file, because the members
          can be told what is recorded about them by their treasurer reading it
          off the page. */}
      <p className="px-4 pb-4 text-[0.68rem] leading-relaxed text-faint">
        Der gemmes én linje pr. medlem pr. dag han har åbnet siden — ikke hvilke sider
        nogen har set, og ikke hvor længe. Grafen starter 8. august 2026; før den dato
        gemte siden kun det seneste besøg.
      </p>
    </details>
  )
}
