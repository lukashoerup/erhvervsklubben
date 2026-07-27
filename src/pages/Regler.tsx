import { FINE_RULES, duesFor } from '../data/rules'
import { VEDTAEGTER } from '../data/vedtaegter'
import { SectionTitle } from '../components/SectionTitle'

/**
 * The rules, given a page of their own rather than a buried third tab.
 *
 * Amounts sit in the left column so you can find the one you are arguing about
 * mid-argument, without reading a paragraph.
 */
export default function Regler() {
  const dues = duesFor(new Date().toISOString().slice(0, 7))

  return (
    <div className="flex flex-col gap-3">
      <section data-reveal className="rounded-2xl border border-line bg-surface p-3">
        <SectionTitle onCard>Bødekasseregulativ</SectionTitle>
        <dl className="mt-1">
          {FINE_RULES.map((r) => (
            <div key={r.id} className="flex gap-3 border-b border-line py-2 last:border-0">
              <dt className="tabular w-20 shrink-0 text-xs font-semibold text-accent">
                {r.kr} kr.
                {r.perMinute && <span className="block text-[0.65rem]">+{r.perMinute}/min</span>}
              </dt>
              <dd className="text-xs leading-snug text-muted">
                {r.offence}
                {r.waiver && <span className="mt-0.5 block text-faint">{r.waiver}</span>}
              </dd>
            </div>
          ))}
        </dl>
        <p className="mt-2 text-[0.68rem] text-faint">
          Et medlem kan ikke pålægges mere end én bøde pr. forseelse pr. møde.
          Bøder opkræves kvartalsvist af kassereren.
        </p>
      </section>

      <section data-reveal className="rounded-2xl border border-line bg-surface p-3">
        <SectionTitle onCard>Medlemskab · vedtægterne §4</SectionTitle>
        <div className="mt-1 flex gap-3 py-2">
          <span className="tabular w-20 shrink-0 text-xs font-semibold text-accent">
            {dues} kr.
          </span>
          <p className="text-xs leading-snug text-muted">
            Pr. måned, betalt forud. Optagelse kræver godkendelse fra mindst 2/3 af de
            aktive medlemmer — og man skal have deltaget som gæst mindst én gang først.
          </p>
        </div>
      </section>

      {/* The statutes in full, each section folded away.
          Fifteen sections open at once is a wall nobody reads, but a summary
          would be a second version of rules members are actually held to — so
          the text is verbatim and the folding does the shortening. */}
      <section data-reveal className="rounded-2xl border border-line bg-surface p-3">
        <SectionTitle onCard>Vedtægter</SectionTitle>
        <p className="mt-1 text-[0.68rem] text-faint">
          Vedtaget på generalforsamlingen. Ændringer kræver 2/3 flertal, jf. §14.
        </p>
        <div className="mt-2">
          {VEDTAEGTER.map((s) => (
            <details key={s.n} className="border-b border-line last:border-0">
              {/* 48 px, §03's touch floor. These fifteen rows are the whole
                  interaction on this page — every statute is behind one — and
                  they measured 32. The sweep in T062 caught the buttons and
                  the chips; a <summary> looks like a heading in the source and
                  was read as one. Flex rather than more padding, so the row is
                  exactly the floor and not fifteen × 16 px of extra page. */}
              <summary className="flex min-h-12 cursor-pointer list-none items-center py-2 text-xs">
                <span className="tabular mr-2 font-semibold text-accent">§{s.n}</span>
                <span className="text-ink">{s.title}</span>
              </summary>
              <div className="flex flex-col gap-1.5 pb-3">
                {s.items.map((item, i) => (
                  <p key={i} className="text-[0.7rem] leading-relaxed text-muted">
                    {item}
                  </p>
                ))}
              </div>
            </details>
          ))}
        </div>
      </section>
    </div>
  )
}
