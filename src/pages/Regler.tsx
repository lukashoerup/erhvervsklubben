import { FINE_RULES, duesFor } from '../data/rules'
import { VEDTAEGTER } from '../data/vedtaegter'
import { SectionTitle } from '../components/SectionTitle'

/**
 * The rules, given a page of their own rather than a buried third tab.
 *
 * Amounts sit in the left column so you can find the one you are arguing about
 * mid-argument, without reading a paragraph.
 *
 * **This is the text page, and it was the heaviest screen in the app** (Lukas,
 * 2026-07-29: *"tekststykkerne på nogle af siderne virker meget voldsomme og
 * store"*). Fifteen statutes, each with a title set at 12 px and its own
 * paragraphs at 11.2 px — a 0.8 px difference doing the entire work of saying
 * which one is the heading. Nothing here got smaller; he was offered that and
 * said no. The gap got bigger instead, in the four ways that do not cost a
 * pixel of legibility: **weight** (600 against 400), **colour** (ink against
 * muted), **size upwards** (the title to 14.4 px, and the body up too, to
 * 12 px), and **space** — the statute's own paragraphs now sit in a column with
 * room around them rather than stacked against the row below.
 *
 * The amounts are the page's other face. They were 12 px semibold in the accent
 * — the same blue as the section label above them and the §-numbers beside them
 * — and they are the one thing on this page anybody looks up in a hurry. Serif
 * at 17 px in ink, in a left rail: findable without reading, and no longer
 * competing with four other blue things for the same job.
 */
export default function Regler() {
  const dues = duesFor(new Date().toISOString().slice(0, 7))

  return (
    <div className="flex flex-col gap-4">
      <section data-reveal className="rounded-2xl border border-line bg-surface p-4">
        <SectionTitle onCard>Bødekasseregulativ</SectionTitle>
        <dl className="mt-2">
          {FINE_RULES.map((r) => (
            <div key={r.id} className="flex gap-3.5 border-b border-line py-3 last:border-0">
              <dt className="ek-figure w-[4.5rem] shrink-0 text-[1.05rem] leading-tight">
                {r.kr} kr.
                {r.perMinute && (
                  <span className="mt-0.5 block font-sans text-[0.65rem] tracking-normal text-faint">
                    +{r.perMinute}/min
                  </span>
                )}
              </dt>
              <dd className="text-[0.8rem] leading-relaxed text-muted">
                {r.offence}
                {r.waiver && (
                  <span className="mt-1 block text-[0.7rem] leading-relaxed text-faint">
                    {r.waiver}
                  </span>
                )}
              </dd>
            </div>
          ))}
        </dl>
        <p className="mt-3 text-[0.68rem] leading-relaxed text-faint">
          Et medlem kan ikke pålægges mere end én bøde pr. forseelse pr. møde.
          Bøder opkræves kvartalsvist af kassereren.
        </p>
      </section>

      <section data-reveal className="rounded-2xl border border-line bg-surface p-4">
        <SectionTitle onCard>Medlemskab · vedtægterne §4</SectionTitle>
        <div className="mt-2 flex gap-3.5 py-2">
          <span className="ek-figure w-[4.5rem] shrink-0 text-[1.05rem] leading-tight">
            {dues} kr.
          </span>
          <p className="text-[0.8rem] leading-relaxed text-muted">
            Pr. måned, betalt forud. Optagelse kræver godkendelse fra mindst 2/3 af de
            aktive medlemmer — og man skal have deltaget som gæst mindst én gang først.
          </p>
        </div>
      </section>

      {/* The statutes in full, each section folded away.
          Fifteen sections open at once is a wall nobody reads, but a summary
          would be a second version of rules members are actually held to — so
          the text is verbatim and the folding does the shortening. */}
      <section data-reveal className="rounded-2xl border border-line bg-surface p-4">
        <SectionTitle onCard>Vedtægter</SectionTitle>
        <p className="mt-2 text-[0.68rem] leading-relaxed text-faint">
          Vedtaget på generalforsamlingen. Ændringer kræver 2/3 flertal, jf. §14.
        </p>
        <div className="mt-3">
          {VEDTAEGTER.map((s) => (
            <details key={s.n} className="border-b border-line last:border-0">
              {/* 48 px, §03's touch floor. These fifteen rows are the whole
                  interaction on this page — every statute is behind one — and
                  they measured 32. The sweep in T062 caught the buttons and
                  the chips; a <summary> looks like a heading in the source and
                  was read as one. Flex rather than more padding, so the row is
                  exactly the floor and not fifteen × 16 px of extra page. */}
              <summary className="flex min-h-12 cursor-pointer list-none items-baseline gap-2.5 py-2.5">
                {/* The §-number in the display face and the title at 14.4/600
                    against a 12 px muted body. That difference is the whole of
                    what makes this page readable, and it used to be 0.8 px. */}
                <span className="ek-figure w-[2.25rem] shrink-0 text-[1.05rem] leading-none text-muted">
                  §{s.n}
                </span>
                <span className="text-[0.9rem] leading-snug font-semibold text-ink">{s.title}</span>
              </summary>
              {/* Indented to clear the §-rail, so an opened statute reads as
                  belonging to its own heading rather than starting a new one. */}
              <div className="flex flex-col gap-2 pb-4 pl-[2.9rem]">
                {s.items.map((item, i) => (
                  <p key={i} className="text-[0.75rem] leading-relaxed text-muted">
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
