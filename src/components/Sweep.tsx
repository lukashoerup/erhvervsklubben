/**
 * T077's sweep, made reusable — the one gesture every chart on the page uses.
 *
 * Lukas asked for the motion on the two new charts too (2026-07-30: *"Husk
 * motion feature."*), and the thing worth protecting is that it is the **same**
 * motion. Three charts on one page arriving three different ways is the
 * incoherence T077 existed to fix: *"Nu kommer den ind sådan i stykker … Ideelt
 * så skulle den ligesom komme frem som om at den blev tegnet frem fra bunden."*
 *
 * So this is a single moving edge, scaling up from the baseline, uncovering
 * everything in the plot at once — the bars, the grid, the labels and the axes
 * together, in one duration on one curve. Nothing here is per-mark and nothing
 * measures a path.
 *
 * A rect inside a clipPath rather than a CSS `clip-path: inset()` because scaling
 * a rect is a *transform*, which is what §01 permits and what composites; and
 * `clipPathUnits="objectBoundingBox"` so it is the plot's own box in fractions
 * and no caller has to know how tall its chart is.
 *
 * `id` is required and must be unique in the document — three of these are now on
 * `/oekonomi`. `.ek-plot` reads it back through `--ek-sweep-clip` (see index.css),
 * which is what lets one stylesheet rule serve every chart.
 *
 * The failure mode is deliberately "no clip": the rules that clip anything are
 * scoped to `[data-draw='armed'|'in']`, and lib/reveal.ts sets that attribute
 * only after `observe()` returns. No script, an old browser, a thrown observer,
 * jsdom — every one of them leaves the plot unclipped and fully visible.
 */
export function Sweep({ id }: { id: string }) {
  return (
    <svg
      aria-hidden="true"
      focusable="false"
      width="0"
      height="0"
      /* `0 0 1 1`, matching the clipPath's units, and it is here for WebKit
         rather than for Chromium — see FinanceChart's copy of this note. Without
         it a browser that ignores `transform-box: fill-box` resolves
         `transform-origin: bottom` against a 0 × 0 viewport and sweeps the chart
         down from the top instead of up from the baseline. Unproven on WebKit:
         the Playwright build cannot be downloaded from this environment. */
      viewBox="0 0 1 1"
      className="block size-0"
    >
      <clipPath id={id} clipPathUnits="objectBoundingBox">
        <rect className="ek-sweep" x="0" y="0" width="1" height="1" />
      </clipPath>
    </svg>
  )
}
