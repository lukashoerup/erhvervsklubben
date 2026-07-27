/**
 * The design system's icon set, and the whole of it.
 *
 * §03 Fundament lists ten under "IKONER · 24 PX LINJE, ALTID MED TEKST", each
 * with the job it does — home/Hjem, bar_chart/Anciennitet, savings/Bødekasse,
 * place/Sted, north_east/Link. The app drew those jobs as geometric characters
 * instead (◆ ▤ ✦ § ◈ ◇ ◷ →), and neither Instrument subset contains a single
 * one of them: every icon in the app fell back per glyph to whatever the device
 * had, so the tab bar was a different set of shapes on every phone and none of
 * them were the club's.
 *
 * Written as escapes, not as the characters themselves. These live in the
 * Private Use Area, where a source file shows them as an empty box or as
 * nothing at all — invisible constants are how one gets quietly deleted by an
 * editor that normalises what it cannot render.
 *
 * Addressed by codepoint rather than by the ligature name the export writes.
 * Material Symbols maps the word "home" to its glyph through a ligature table,
 * and that table is 4267 entries — essentially the whole 339 kB. Naming the
 * codepoint costs nothing and lets the ligatures go: the subset in
 * `public/fonts/` is **1072 bytes**, ten glyphs including .notdef. The nine
 * below are exactly what is in it, so a tenth added here without re-subsetting
 * renders as a blank. `design/README.md` carries the recipe.
 *
 * Inline SVG was the alternative and it loses on its own terms: the same nine
 * outlines are 3869 characters of path data, 1432 bytes gzipped *before* any
 * wrapper markup, and they would ride in the JavaScript bundle rather than in a
 * file the browser fetches once and reuses on every screen.
 */
export const ICON = {
  home: '\ue88a',
  bar_chart: '\ue26b',
  article: '\uef42',
  gavel: '\ue90e',
  savings: '\ue2eb',
  calendar_month: '\uebcc',
  place: '\ue55f',
  north_east: '\uf1e1',
  arrow_right_alt: '\ue941',
} as const

export type IconName = keyof typeof ICON

/**
 * `aria-hidden` without exception, because §03 requires the text beside it —
 * "ALTID MED TEKST".
 *
 * Every icon in this app sits next to its own label: the tab bar writes "Hjem"
 * under the house, the chip writes the venue after the pin. An icon that
 * announced itself would make a screen reader say the name twice, and one that
 * had to carry meaning alone would be a place where that rule had been broken.
 */
export function Icon({ name, className = '' }: { name: IconName; className?: string }) {
  return (
    <span aria-hidden="true" className={`ek-icon ${className}`}>
      {ICON[name]}
    </span>
  )
}
