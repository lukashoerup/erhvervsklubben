import type { ReactNode } from 'react'
import type { Meeting, RosterEntry } from '../data/derive'
import { daDate } from '../lib/dates'
import { daMinutes } from '../data/fines'
import { describeRule } from '../data/rules'
import { Icon } from './Icon'
import { kr } from './FinanceChart'
import { Eyebrow } from './SectionTitle'

/** One fine as this card needs it — the row, not the club's totals. */
export type MeetingFine = {
  member_name: string
  rule_id: string
  minutes: number | null
  amount_kr: number
  /** Why, on an ad-hoc fine. Null on the five voted rules, where the id is the reason. */
  note?: string | null
}

/**
 * The head of a meeting card: a serif figure, a heading, a date, and the club's
 * blue streg under all three.
 *
 * Its own component because two different kinds of meeting now sit on one page.
 * Lukas, 2026-07-30, having seen the merge: *"Synes bare at planlagte møder skal
 * fremgå som de tidligere. Blot uden anciennitet."* The calendar's cards had come
 * across from `/moeder` with their own layout — a 26 px date rail down the left —
 * and two renderings of "a meeting" on one screen is exactly how this app once
 * came to look like two products.
 *
 * So the identity lives here rather than being written twice and kept in step by
 * hand: a planned meeting and a held one now differ in what they *contain*, which
 * is real, and in nothing else.
 *
 * - **figure** — the number you scan for. The meeting number behind, and the
 *   number the club gave the evening ahead.
 * - **aside** — the date, or "uden dato" for the eleven that never got one.
 */
export function MeetingHead({
  figure,
  heading,
  aside,
}: {
  figure: ReactNode
  heading: string
  aside: string
}) {
  return (
    <div className="relative flex items-baseline gap-2.5">
      {/* /anciennitet is the club's rhythm — twenty-eight evenings, one after
          another — and the figure is the only thing that changes at the same
          place on every card. It was 15 px of the same blue as the section labels
          and the links, so it read as one more emphasis rather than as the count
          it is. Serif at 20 px, in ink: the beat is legible from a thumb-scroll,
          and the blue it gives up is on the streg below, where §01 puts the
          club's signature. */}
      <span className="ek-figure text-[1.25rem] leading-none">{figure}</span>
      <h3 className="min-w-0 text-[0.92rem] font-semibold">{heading}</h3>
      <span className="tabular ml-auto shrink-0 text-[0.65rem] text-faint">{aside}</span>
      {/* "Én blå streg som signatur" (§01), giving every card a masthead.
          Absolute, so it costs no height on the longest page in the app: it lands
          in the gap the line under it already leaves.

          Not drawn, though the drawing was built and measured. Animating this one
          extra element per card cost Anciennitet 7 fps at a 6× CPU throttle, and
          almost all of what the rule gives the card it gives by being there. */}
      <span aria-hidden="true" className="absolute -bottom-1 inset-x-0 h-px bg-accent/30" />
    </div>
  )
}

/** Short month, because 29 of these stack down a phone. The year stays. */
const SHORT: Intl.DateTimeFormatOptions = { day: 'numeric', month: 'short', year: 'numeric' }

/**
 * How a pip says which state it is in, without asking anyone to see a colour.
 *
 * Filled with a solid edge, or hollow with a dashed one. Green and red were the
 * whole of it, and roughly one man in twelve cannot reliably separate those two
 * hues — in a club of ten that is not a hypothetical reader. Fill and border
 * style survive being seen in greyscale, in sunlight, and by that man, and they
 * cost no space at all: these are 24px squares, ten to a meeting, twenty-nine
 * meetings on the page. A word or an icon in each does not fit.
 */
const PIP = {
  present: 'border-solid border-present/40 bg-present/20 text-present',
  absent: 'border-dashed border-absent/50 text-absent',
} as const

/** The same two marks at legend size, so the key cannot drift from the strip. */
const SWATCH = {
  present: 'border-solid border-present/40 bg-present/20',
  absent: 'border-dashed border-absent/50',
} as const

/**
 * One meeting, as a card.
 *
 * The old site showed this as a fifteen-column table, which cannot work on a
 * phone — and the phone is where it gets used. Attendance becomes a strip of
 * initials with the reader's own ringed, so a whole meeting reads in one glance
 * and a season scrolls under a thumb.
 *
 * The key sits on every card rather than once at the top of the page, and earns
 * the line by carrying the counts: after the third card nobody is reading it as
 * a legend any more, they are reading how many turned up — which is the
 * question the strip is there to answer, now answerable without decoding it.
 */
export function MeetingCard({
  meeting,
  labels,
  me,
  fines = [],
  actions,
}: {
  meeting: Meeting
  labels: Record<string, string>
  me?: string | null
  /** This meeting's fines, for the disclosure below. Empty is ordinary. */
  fines?: MeetingFine[]
  /** The admin's Rediger and Slet, below the strip. A member is passed none
      and the card is exactly what it was. */
  actions?: ReactNode
}) {
  const pip = (name: string, present: boolean) => (
    <span
      key={name}
      // The full name only. The state used to live in this tooltip too, which
      // is the same as not saying it: there is no hover on a phone, and the
      // phone is where this page is read.
      title={name}
      className={[
        'grid size-6 place-items-center rounded-[5px] border text-[0.55rem] font-semibold',
        present ? PIP.present : PIP.absent,
        name === me ? 'outline-2 outline-offset-1 outline-accent' : '',
      ].join(' ')}
    >
      {labels[name] ?? name.slice(0, 2)}
      <span className="sr-only">{present ? ' til stede' : ' ikke til stede'}</span>
    </span>
  )

  return (
    /* data-reveal on the card, not on its parts. 29 of these stack down the
       page and the system's reveal is per element ("60 ms forskudt pr.
       element") — but a card whose date arrives after its own heading reads as
       a page still loading, not as choreography. The stagger here is the
       scroll itself: the cards enter one after another because they are
       stacked, so the thumb supplies the offset. */
    <article data-reveal className="rounded-2xl border border-line bg-surface p-4">
      <MeetingHead
        figure={meeting.number}
        heading={meeting.lead || 'Ukendt lead'}
        aside={meeting.date ? daDate(meeting.date, SHORT) : 'uden dato'}
      />

      {/* The step between venues was a literal → — which is how §04's own
          Anciennitet mock writes it, and which neither Instrument subset
          contains, so it fell back per glyph and the club's evening was drawn
          by whichever font the phone reached for. `arrow_right_alt` is the
          set's long arrow: the same mark, from the shipped file. */}
      {meeting.route.length > 0 && (
        <p className="mt-1.5 text-xs text-muted">
          {meeting.route.map((stop, i) => (
            <span key={stop + i}>
              {i > 0 && (
                <Icon name="arrow_right_alt" className="mx-1 align-[-0.15em] text-sm text-faint" />
              )}
              <span className={i === meeting.route.length - 1 ? 'font-semibold text-ink' : ''}>
                {stop}
              </span>
            </span>
          ))}
        </p>
      )}

      <p className="mt-2.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-[0.6rem] text-faint">
        <span className="flex items-center gap-1.5">
          <span aria-hidden="true" className={`size-3 rounded-[3px] border ${SWATCH.present}`} />
          <span className="tabular">{meeting.present.length}</span> til stede
        </span>
        <span className="flex items-center gap-1.5">
          <span aria-hidden="true" className={`size-3 rounded-[3px] border ${SWATCH.absent}`} />
          <span className="tabular">{meeting.absent.length}</span> ikke til stede
        </span>
      </p>

      {/* The strip settles a beat after the meeting's name — one element, not
          ten. The ten pips arriving in sequence was the nicer gesture and it
          was measured off the page: ten extra animating elements on each of 29
          cards took Anciennitet from 60 fps to 34 at a 4× CPU throttle, on the
          one screen §04 asks to stay cheap. The whole strip as one thing costs
          nothing and still says "who was there" arrives after "whose evening it
          was". See .ek-strip in index.css. */}
      <div className="ek-strip mt-2 flex flex-wrap gap-1">
        {meeting.present.map((n) => pip(n, true))}
        {meeting.absent.map((n) => pip(n, false))}
      </div>

      {/* **The way into a meeting.** Lukas, 2026-07-30: "Man skal også gerne kunne
          klikke sig ind på et møde på ancinitetssiden for et medlem og læse fulde
          beskrivelse samt se hvilke bøder der er blevet udgivet til det møde."

          A disclosure on the card rather than a route of its own. Twenty-eight
          cards down one page and a phone in one hand: a drill-in costs the reader
          his scroll position on the way back, and it would put the club's rhythm
          — the thing /anciennitet *is* — one navigation away from the detail.
          `<details>` is native, so it opens before the JavaScript settles and the
          keyboard and screen-reader behaviour come for free. Same idiom as
          "Sidst set" one card up the page.

          The summary is the first two lines of the description, so the tap target
          is the prose itself and the card gains a sentence rather than a control.
          Where a meeting has no description the summary falls back to naming what
          is inside, because a fine list is worth a way in on its own — and a card
          with neither renders nothing at all, which is 20 of the 28 today: the
          page a member already knows, unchanged. */}
      {(meeting.description || fines.length > 0) && (
        <details className="group mt-2.5 border-t border-line pt-2.5">
          <summary className="flex min-h-11 cursor-pointer list-none items-start gap-2">
            <span className="min-w-0 flex-1 text-xs leading-relaxed text-muted">
              {meeting.description ? (
                // Two lines closed, all of it open — one element, so the text
                // does not reflow from a second copy of itself.
                <span className="line-clamp-2 group-open:line-clamp-none">
                  {meeting.description}
                </span>
              ) : (
                <span className="text-faint">
                  {fines.length === 1 ? '1 bøde på mødet' : `${fines.length} bøder på mødet`}
                </span>
              )}
            </span>
            {/* Words, not a chevron. The icon font in `public/fonts/` is a
                subset of exactly nine glyphs addressed by codepoint, and
                `expand_more` is not one of them — adding it to `Icon` without
                re-subsetting the file renders a blank box, which the icon set
                says in its own header. Two words cost nothing and are the one
                affordance that cannot fall back to nothing. */}
            <span className="shrink-0 pt-px text-[0.62rem] tracking-wide text-accent uppercase">
              <span className="group-open:hidden">Mere</span>
              <span className="hidden group-open:inline">Skjul</span>
            </span>
          </summary>

          {fines.length > 0 && (
            <div className="mt-3">
              <Eyebrow>
                {fines.length === 1 ? 'Bøde på mødet' : 'Bøder på mødet'} ·{' '}
                {kr(fines.reduce((n, f) => n + f.amount_kr, 0))}
              </Eyebrow>
              {/* The offence in words, never the amount decoded back into one.
                  50 + 5/min means 95 kr. is arithmetically nine minutes late, and
                  T075 refused that inference for the whole history — a card is
                  not the place to reintroduce it. `describeRule` reads the rule
                  the row carries, and the minutes are printed only where the row
                  actually holds them. */}
              <ul className="mt-2">
                {fines.map((f, i) => (
                  <li
                    key={`${f.member_name}-${f.rule_id}-${f.amount_kr}-${i}`}
                    className="flex items-baseline justify-between gap-3 border-b border-line/50 py-1.5 text-xs last:border-b-0"
                  >
                    <span className="min-w-0">
                      <span className="font-medium">{f.member_name}</span>
                      {/* The club's own words where it wrote any, and the rule's
                          otherwise. An ad-hoc fine's `rule_id` says only "the club
                          agreed something" — printing that beside an amount is the
                          `historisk` problem all over again, and it is why the
                          database refuses an ad-hoc fine with no note. Lukas,
                          2026-08-08, from the bowling alley: *"når vi finder på
                          væddemål hvor vi giver bøder af hov."* */}
                      <span className="text-muted"> · {f.note?.trim() || describeRule(f.rule_id)}</span>
                      {f.minutes ? (
                        <span className="text-faint"> ({daMinutes(f.minutes)})</span>
                      ) : null}
                    </span>
                    <span className="tabular shrink-0 font-semibold">{kr(f.amount_kr)}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </details>
      )}

      {actions && <div className="mt-3 flex flex-wrap items-start gap-2">{actions}</div>}
    </article>
  )
}

/**
 * Anciennitet at a glance — §11 defines it as the count of attendances.
 *
 * The count is printed, not just drawn. It used to live only in a `title`
 * tooltip, which does not exist on a touchscreen: the club's most-used page
 * showed ten unlabelled bars and withheld the single number it is about.
 *
 * Every member on the top score is highlighted, not just the first. Five of
 * them are usually tied, and colouring one of a tie crowns a leader the data
 * does not have.
 *
 * **How many times each man has been lead is a line across the bars, on its own
 * scale, and a figure under his name** (2026-09-05). Lukas: *"Kan vi få ind på
 * anciennitetsgrafen hvor mange gange folk har været lead? Tænker en linje."*
 * The first answer was the figure alone, with the line refused: the counts are
 * 1–4 against attendances in the twenties on a plot 56 px tall, so a line on
 * the bars' scale lies flat along the baseline. He came back: *"Tænkte en ny y
 * akse. Til linjegrafen."* A second y-axis is the one thing the chart rules
 * forbid outright, because it lets a reader compare two series that share no
 * scale — and that was said to him once. This is the club's own chart of ten
 * men it knows by name, he is the treasurer and the reader, and it is his call
 * (PROJECT.md, 2026-09-05). So the line is drawn as honestly as a second axis
 * can be: **its scale is written at the right edge and nowhere else**, it is
 * ink rather than the bars' blue so it cannot be mistaken for a bar's
 * outline, it never reaches the top of the plot (the scale is one above the
 * highest count), and the figure under each name stays, so the number is
 * readable without the axis. It is still not anciennitet — §11 is attendance
 * alone — so it neither orders the strip nor colours a bar.
 *
 * **Geometry.** The strip is a grid of four rows — count, plot, label, lead
 * figure — and each member is a subgrid down one column, so the plot row is
 * one shared band across all ten. The line lives in that band alone, laid over
 * the columns, and the axis is an eleventh column beside it. No column gap:
 * the bars wear their own 2 px side padding instead, so the *i*-th column's
 * centre is exactly (i + ½)/n of the band's width and the dots land on the
 * bars they belong to. It grows from the baseline with the bars — same
 * `data-bar`, same 900 ms, one gesture — because a finished line floating over
 * bars still growing reads as a chart loading in pieces (design/README.md,
 * "The chart").
 */
export function AttendanceSummary({ roster }: { roster: RosterEntry[] }) {
  const top = roster[0]?.attended ?? 0
  const total = roster[0]?.total ?? 0
  const n = roster.length
  const gange = (n: number) => (n === 1 ? '1 gang' : `${n} gange`)
  // The line's own scale: one above the highest count, so the line never
  // touches the top of the plot and cannot read as level with the tallest bar.
  const maxLed = Math.max(0, ...roster.map((r) => r.led))
  const scale = maxLed + 1
  const x = (i: number) => ((i + 0.5) / n) * 100
  const y = (led: number) => (1 - led / scale) * 100
  // Rounded, so 1 − 4/5 is 20 % and not 19.999999999999996 %.
  const pct = (v: number) => `${Math.round(v * 1000) / 1000}%`
  const columns = `repeat(${n}, minmax(0, 1fr)) 1.25rem`
  return (
    <section data-reveal className="rounded-2xl border border-line bg-surface p-4">
      <Eyebrow>Anciennitet · antal deltagelser{total ? ` af ${total}` : ''}</Eyebrow>
      <ul
        className="mt-3 grid gap-y-0.5"
        style={{ gridTemplateColumns: columns, gridTemplateRows: 'auto 3.5rem auto auto' }}
      >
        {roster.map((r, i) => (
          <li
            key={r.name}
            aria-label={`${r.name}: ${r.attended} af ${r.total} · lead ${gange(r.led)}`}
            title={`${r.name}: ${r.attended} af ${r.total} · lead ${gange(r.led)}`}
            className="grid grid-rows-subgrid justify-items-center"
            // Placed by hand, every one: the line and the axis below are placed
            // by hand into the same rows, and auto-placement would step around
            // the cells they occupy rather than share them.
            style={{ gridColumn: i + 1, gridRow: '1 / span 4' }}
          >
            {/* No count-up on these ten, and §04's own Anciennitet mock agrees:
                it marks the bars as growing and leaves the figures above them
                as plain text, where its Hjem mock counts all three of its stats.
                Measured, that is the right way round — ten figures rewriting
                their text for 900 ms sit at the top of the club's longest page,
                so the cost lands on exactly the scroll that has to stay cheap
                (60 → 41 fps at a 4× CPU throttle). The bar growing under the
                number is the gesture here; the number arriving as well says the
                same thing twice and charges the page for it. */}
            <span className="tabular text-[0.6rem] leading-none font-semibold text-ink">
              {r.attended}
            </span>
            <span aria-hidden="true" className="flex h-full w-full items-end px-0.5">
              {/* "Søjler vokser ved scroll" (§04), from the baseline (§01). The
                  height stays an inline style and the growth is a scaleY on top
                  of it, so the bar's real height is still the number it
                  represents — animating the height itself would be the one
                  thing the system forbids, and it would relayout the row ten
                  times a frame. */}
              <span
                data-bar
                className={`w-full rounded-t-[3px] ${
                  r.attended === top ? 'bg-accent' : 'bg-accent-d'
                }`}
                style={{ height: `${top ? Math.max(4, (r.attended / top) * 100) : 4}%` }}
              />
            </span>
            <span className="tabular text-[0.55rem] leading-none text-muted">{r.label}</span>
            {/* Faint, not muted: the label is what a reader scans for, and this
                figure is what he reads once he has found the man. Zero is
                printed as 0 — a member who has never led is a fact about the
                rota, not a gap in it. */}
            <span data-led className="tabular text-[0.55rem] leading-none text-faint">
              {r.led}
            </span>
          </li>
        ))}

        {/* The line, over the plot row and nothing else. Percent coordinates on
            each mark rather than a viewBox: a viewBox stretched to the band
            would stretch the strokes and the dots with it. Painted twice — a
            surface-coloured halo under the ink — which is the 2 px surface ring
            the chart rules ask for where a mark crosses another, and here every
            segment crosses a bar. Decorative to a screen reader: the count is
            in every member's own label. */}
        {n > 0 && (
          <li
            role="presentation"
            aria-hidden="true"
            className="pointer-events-none relative"
            style={{ gridColumn: `1 / ${n + 1}`, gridRow: 2 }}
          >
            <svg
              data-bar
              data-lead-line
              className="absolute inset-0 h-full w-full overflow-visible"
              fill="none"
            >
              {(['stroke-surface', 'stroke-ink'] as const).map((tone) => (
                <g
                  key={tone}
                  className={tone}
                  strokeWidth={tone === 'stroke-surface' ? 4 : 2}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  {roster.slice(1).map((r, i) => (
                    <line
                      key={r.name}
                      x1={pct(x(i))}
                      y1={pct(y(roster[i].led))}
                      x2={pct(x(i + 1))}
                      y2={pct(y(r.led))}
                    />
                  ))}
                </g>
              ))}
              {roster.map((r, i) => (
                <circle
                  key={r.name}
                  data-lead-dot={r.led}
                  cx={pct(x(i))}
                  cy={pct(y(r.led))}
                  r={3.5}
                  className="fill-ink stroke-surface"
                  strokeWidth={2}
                />
              ))}
            </svg>
          </li>
        )}

        {/* The line's axis: a hairline at the right edge of the plot with the
            scale's two ends written on it, and its name in the row above. The
            only place the line's scale is stated, deliberately — a gridline
            across the bars would invite reading the bars against it. */}
        {n > 0 && (
          <>
            <li
              role="presentation"
              aria-hidden="true"
              className="self-end pl-1 text-[0.5rem] leading-none text-faint"
              style={{ gridColumn: n + 1, gridRow: 1 }}
            >
              lead
            </li>
            <li
              role="presentation"
              aria-hidden="true"
              data-lead-axis
              className="relative border-l border-line"
              style={{ gridColumn: n + 1, gridRow: 2 }}
            >
              {maxLed > 0 && (
                <span
                  className="tabular absolute left-1 -translate-y-1/2 text-[0.5rem] leading-none text-faint"
                  style={{ top: pct(y(maxLed)) }}
                >
                  {maxLed}
                </span>
              )}
              <span className="tabular absolute bottom-0 left-1 text-[0.5rem] leading-none text-faint">
                0
              </span>
            </li>
          </>
        )}
      </ul>
      {/* Said once under the strip rather than ten times inside it. */}
      <p className="mt-2 text-[0.6rem] leading-snug text-faint">
        Linjen (skala til højre) og nederste tal: antal gange som lead.
      </p>
    </section>
  )
}
