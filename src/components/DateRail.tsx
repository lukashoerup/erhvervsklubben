import { daDate } from '../lib/dates'

/**
 * The date, as the face of a card.
 *
 * Lukas, 2026-07-29, having looked at Nyheder and Møder: *"de cards der er på
 * møde og nyheder siderne er stadig lidt kedelige. Altså man kunne måske lave
 * et eller andet der?"* They were a 10 px uppercase date, a headline and a
 * paragraph, in a rounded box, eight or twenty times down a page — nothing on
 * any of them repeated at the same place, so the eye had no beat to follow and
 * every card looked like the one above it.
 *
 * The one thing he did like was the typeface on the numbers: *"Den nye
 * skrifttype på tallene er pæn."* So the card is given its face out of the
 * material it already has and the register he already approved. The day becomes
 * a 26 px serif numeral — the size Hjem's three counts run at since T072 — with
 * its month under it and a hairline down its right-hand side. `.ek-figure`'s
 * rule holds: this is the figure that leads the block, so it is serif; the
 * month and the year beneath it are a label, so they stay Sans.
 *
 * It is the idiom /anciennitet already uses and design/README.md calls that
 * screen's face — "a 20 px serif ordinal repeating down 29 cards" — and the
 * §-rail /regler got in the same pass. Two more screens now share it instead of
 * inventing a third thing, which is what a system is for.
 *
 * **The year appears only when it is not this one.** Every news item and every
 * meeting from the year you are standing in says "9 JUN" and nothing more; a
 * meeting from 2024 says so. A year printed on all of them is noise on the
 * ninety per cent that do not need it, and printed on none of them is the trap
 * dates.ts already documents — five cards reading "4. dec." with nothing saying
 * which December.
 */
export function DateRail({
  iso,
  /** Under the month, where a meeting has one. Text, as the column is — "18.30". */
  time,
  /** The hairline carries the club's blue where what it dates has not happened yet. */
  ahead = false,
}: {
  iso: string
  time?: string
  ahead?: boolean
}) {
  // da-DK prints an ordinal day with its full stop — "9." — because in Danish
  // the date is an ordinal. Here the number stands alone in a rail with its
  // month under it, where the stop is not grammar but a mark hanging off the
  // right of a 26 px numeral, and it pushes "20." wider than the rail.
  const day = daDate(iso, { day: 'numeric' }).replace('.', '')
  // Three letters and no full stop. Danish abbreviates to "jun."; the stop is
  // punctuation inside a label that is already set in caps and tracked out, and
  // at 9 px it is a smudge rather than a mark.
  const month = daDate(iso, { month: 'short' }).replace('.', '').slice(0, 3)
  const year = daDate(iso, { year: 'numeric' })
  const thisYear = String(new Date().getFullYear())

  return (
    <div className="relative w-12 shrink-0 pr-3 text-center">
      <div className="ek-figure text-[1.625rem] leading-none">{day}</div>
      <div className="mt-1 text-[0.55rem] leading-none tracking-[0.1em] text-faint uppercase">
        {month}
      </div>
      {year !== thisYear && (
        <div className="tabular mt-1 text-[0.55rem] leading-none text-faint">{year}</div>
      )}
      {time && <div className="tabular mt-1.5 text-[0.55rem] leading-none text-faint">{time}</div>}
      {/* The hairline is the whole rail — absolutely positioned, so it costs no
          width and cannot push the headline about, and it is what makes the
          numeral read as a date block rather than as a number that wandered in.

          It is also the only thing on these two screens that is drawn: it
          grows downwards as its card arrives, the way /anciennitet's streg was
          built and unlike it can afford to be. That measurement was 29 cards
          deep — "two animating elements per card cost 7 fps at a 6× CPU
          throttle" — and these lists are three and four long in the demo, a
          dozen or two in the club's real records. One extra element on a short
          page is the same trade with the denominator taken out.

          Blue where the meeting has not happened yet, and the club's own
          hairline where it has. §01 calls that mark "én blå streg som
          signatur"; used as an index down the left of the calendar it says
          which half of the page you are in without a word or a chip. */}
      <span
        aria-hidden="true"
        className={`ek-rail absolute inset-y-0 right-0 w-px ${ahead ? 'bg-accent/45' : 'bg-line-hi'}`}
      />
    </div>
  )
}
