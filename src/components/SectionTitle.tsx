import type { ReactNode } from 'react'

/**
 * The label above a block of content, in the two places a label appears: at the
 * top of a section, and at the top of a card.
 *
 * It was written out four different ways across Møder, Regler and Økonomi —
 * same size, same tracking, same blue, three copies — which is how the pages
 * had already started to drift apart from each other before anyone touched
 * them. One component, so the next screen cannot invent a fifth.
 *
 * **The label is no longer blue** (Lukas, 2026-07-29). It was, on every screen,
 * at the same moment the figures and the links were — "det er lidt ensartet med
 * farverne" — and a page on which four different jobs all carry the emphasis is
 * a page with no emphasis at all. The accent now means one thing, this can be
 * tapped, and a section label cannot. The letters go muted; the blue stays on
 * screen as the club's signature streg, which is what §01 calls it ("én blå
 * streg som signatur") and the one thing it has always meant. §04's desktop
 * mock sets this very label in #94A3B8, so the quiet version is the system's
 * own rather than a departure from it.
 *
 * The streg earns its line twice: it keeps the accent in the composition, and
 * twelve pixels of blue at the left edge of every label is what makes the start
 * of a block findable on screens that are fifteen blocks long.
 */
const LABEL = 'flex items-center gap-2 text-[0.58rem] tracking-[0.14em] text-muted uppercase'

/** aria-hidden: the streg is punctuation, not a word. */
function Streg() {
  return <span aria-hidden="true" className="h-px w-3 shrink-0 bg-accent" />
}

export function SectionTitle({
  children,
  onCard = false,
}: {
  children: ReactNode
  /** The heading sits inside a card rather than on the page ground. */
  onCard?: boolean
}) {
  return (
    /* Sticky because these screens are long: Regler folds fifteen statutes and
       Økonomi stacks seven sections, and scrolled into the middle of either the
       heading had gone off the top of the screen. The header above it is not
       sticky, so the band lands against the viewport edge.

       `onCard` is not styling taste, it is which surface the band is painted on
       — a heading inside a white card blurring into the page's ground colour
       reads as a rendering fault. See `.ek-stick` in index.css. */
    <h2
      className={[
        'ek-stick',
        LABEL,
        // The negative margin pulls the band out to the full width of the
        // column and the padding puts the text back where it was: a bar inset
        // by the page gutter leaves content sliding past in the margin beside
        // it, which is the one thing a sticky bar must not do. Both insets are
        // 4 now — every card carrying one of these is p-4 since the air went
        // in, and a bar inset by the wrong gutter is visibly a bar in the
        // wrong place.
        onCard ? 'ek-stick-card -mx-4 rounded-t-2xl px-4 py-2' : '-mx-4 px-4 py-2',
      ].join(' ')}
    >
      <Streg />
      {children}
    </h2>
  )
}

/**
 * The same label on a card that carries only one of them, where nothing needs
 * to stick.
 *
 * Five of these were written inline — Hjem's "Næste møde" and "Kasserer",
 * Anciennitet's roster caption, Økonomi's "Klubkassen", the chart's budget note
 * — each with its own size and tracking, and all of them blue. They are the
 * same object as the heading above and now look like it.
 */
export function Eyebrow({ children }: { children: ReactNode }) {
  return (
    <p className={LABEL}>
      <Streg />
      {children}
    </p>
  )
}
