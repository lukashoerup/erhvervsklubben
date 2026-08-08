import { useLastSeen } from '../data/lastSeen'
import { daWhen } from '../lib/dates'
import { Eyebrow } from './SectionTitle'

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
              <span className={seen ? 'tabular text-muted' : 'text-faint'}>
                {seen ? daWhen(seen) : withLogin.has(name) ? 'aldrig åbnet siden' : 'intet login'}
              </span>
            </li>
          )
        })}
      </ul>

      {/* Said on the screen rather than only in this file, because the members
          can be told what is recorded about them by their treasurer reading it
          off the page. */}
      <p className="px-4 pb-4 text-[0.68rem] leading-relaxed text-faint">
        Kun tidspunktet for seneste besøg gemmes — ét pr. medlem, som overskrives.
        Der registreres ikke hvilke sider nogen har set.
      </p>
    </details>
  )
}
