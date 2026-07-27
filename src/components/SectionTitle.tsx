import type { ReactNode } from 'react'

/**
 * The label above a section, and the one piece of furniture the long members'
 * screens share.
 *
 * It was written out four different ways across Møder, Regler and Økonomi —
 * same size, same tracking, same blue, three copies — which is how the pages
 * had already started to drift apart from each other before anyone touched
 * them. One component, so the next screen cannot invent a fifth.
 *
 * Sticky because these screens are long: Regler folds fifteen statutes and
 * Økonomi stacks six sections, and scrolled into the middle of either the
 * heading had gone off the top of the screen. The header above it is not
 * sticky, so the band lands against the viewport edge.
 *
 * `onCard` is not styling taste, it is which surface the band is painted on —
 * a heading inside a white card blurring into the page's ground colour reads as
 * a rendering fault. See `.ek-stick` in index.css.
 */
export function SectionTitle({
  children,
  onCard = false,
}: {
  children: ReactNode
  /** The heading sits inside a card rather than on the page ground. */
  onCard?: boolean
}) {
  return (
    <h2
      className={[
        'ek-stick text-[0.58rem] tracking-[0.14em] text-accent uppercase',
        // The negative margin pulls the band out to the full width of the
        // column and the padding puts the text back where it was: a bar inset
        // by the page gutter leaves content sliding past in the margin beside
        // it, which is the one thing a sticky bar must not do.
        onCard ? 'ek-stick-card -mx-3 rounded-t-2xl px-3 py-2' : '-mx-4 px-4 py-2',
      ].join(' ')}
    >
      {children}
    </h2>
  )
}
