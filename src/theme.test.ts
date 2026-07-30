import { describe, expect, it } from 'vitest'
// `?raw` rather than node:fs — the app's tsconfig has no node types, and adding
// them to read one file would be a dependency for a one-line convenience.
import css from './index.css?raw'
// Read as text for the same reason the stylesheet is: the coupling between the
// sweep's duration and the count-up's is a fact about two source files, and
// jsdom has no layout to observe it in.
import revealSource from './lib/reveal.ts?raw'

/**
 * A guard on the stylesheet, because this failure is invisible.
 *
 * Tailwind gathers every `@theme` block into a single `:root` rule regardless of
 * the at-rules wrapped around it. Putting a second `@theme` inside
 * `@media (prefers-color-scheme: light)` therefore does not scope it to light
 * mode — it overwrites the first set unconditionally, and one whole palette
 * disappears from the build.
 *
 * That happened here: the shipped stylesheet contained only the light values, so
 * the agreed dark ground never rendered on anyone's phone. Nothing failed, no
 * warning was printed, and the page looked deliberate. A browser is the only
 * place it shows, which is exactly why it needs a test.
 *
 * The override belongs in a plain `:root` inside the media query — utilities
 * compile to `var(--color-…)`, so overriding the variable is enough.
 */
describe('theme tokens', () => {
  it('declares @theme only at the top level', () => {
    // Every @theme must sit at column 0. One indented is one nested inside an
    // at-rule, which is the mistake this test exists for.
    const nested = css.match(/^[ \t]+@theme/gm)
    expect(nested, 'an indented @theme is a nested @theme — use :root instead').toBeNull()
  })

  it('overrides the palette for light mode inside a media query', () => {
    const light = css.match(/@media \(prefers-color-scheme: light\)\s*\{\s*:root\s*\{([^}]*)\}/)
    expect(light, 'no light-mode :root override found').not.toBeNull()
    expect(light![1]).toContain('--color-ground')
  })

  it('keeps both grounds distinct, so a palette cannot be silently lost', () => {
    const grounds = [...css.matchAll(/--color-ground:\s*([^;]+);/g)].map((m) => m[1].trim())
    expect(grounds).toHaveLength(2)
    expect(grounds[0]).not.toEqual(grounds[1])
  })
})

/**
 * The landing intro, guarded the same way and for the same reason: a browser is
 * the only place this shows, and the failure is silent.
 *
 * Adding a fifth animated part to the lockup and forgetting the reduced-motion
 * block is a one-line mistake that nobody making it can see — the page looks
 * right to everyone who has not asked for less motion.
 */
describe('the landing animation', () => {
  const animated = [...css.matchAll(/^\.(ek-[a-z-]+)[,\s{]/gm)].map((m) => m[1])
  const declared = new Set(
    animated.filter((c) => new RegExp(`\\.${c}\\b[^{]*\\{[^}]*animation-name`, 's').test(css)),
  )

  it('turns every animated part off for prefers-reduced-motion', () => {
    const block = css.match(/@media \(prefers-reduced-motion: reduce\)\s*\{([\s\S]*?)\n\}/)
    expect(block, 'no reduced-motion block found').not.toBeNull()
    for (const cls of declared) {
      expect(block![1], `.${cls} keeps animating for someone who asked it not to`).toContain(
        `.${cls}`,
      )
    }
    expect(block![1]).toContain('animation: none')
  })

  it('animates only compositor properties', () => {
    // Covers the members' reveals too: ek-reveal and ek-bar are matched by the
    // same @keyframes sweep below.
    // The design system's own rule: "Kun opacity og transform, så det kører
    // 60 fps på telefonen." **One** sanctioned exception now, and it is a
    // gesture no transform can express rather than a convenience: letter-spacing,
    // the wordmark tightening in the logo intro, which §01 asks for by name.
    //
    // stroke-dashoffset was the second, for the finance curves drawing
    // themselves in (T073). T077 replaced that with one clipped edge sweeping up
    // from the baseline — scaling a rect is a transform — so the exception is
    // gone rather than left standing over nothing. A stale exception is worse
    // than none: it is a licence the next pass finds already granted.
    //
    // letter-spacing is not layout either: the rule exists because height, top
    // and margin reflow, and it does not. Anything *else* appearing here does.
    const inside = [...css.matchAll(/@keyframes ek-[a-z-]+\s*\{([\s\S]*?)\n\}/g)]
    expect(inside.length).toBeGreaterThan(0)
    const props = new Set(
      inside.flatMap((m) => [...m[1].matchAll(/^\s{4}([a-z-]+):/gm)].map((p) => p[1])),
    )
    expect([...props].sort()).toEqual(['letter-spacing', 'opacity', 'transform'])
  })
})

/**
 * The self-hosted typefaces, guarded because the failure is silent and the
 * temptation to undo it is one line long.
 *
 * The app has no CDN access. A `<link>` to fonts.googleapis.com — which is what
 * the design export itself carries, and what any copy-paste of it brings along
 * — does not error: it fails to resolve, the page keeps rendering in Georgia
 * and the system sans, and it looks close enough that nobody notices for
 * another four months.
 */
describe('the typefaces', () => {
  const faces = [...css.matchAll(/@font-face\s*\{([\s\S]*?)\n\}/g)].map((m) => m[1])

  it('declares all three of the design system’s families', () => {
    const families = faces.map((f) => f.match(/font-family:\s*'([^']+)'/)?.[1])
    expect(families).toContain('Instrument Sans')
    expect(families).toContain('Instrument Serif')
    // §03's icon set. Left out until T066 because the whole face is 339 kB;
    // subset to the nine glyphs the app draws it is 1072 bytes.
    expect(families).toContain('Material Symbols Outlined')
  })

  it('serves them from this origin, never a CDN', () => {
    expect(faces.length).toBeGreaterThan(0)
    for (const f of faces) {
      const url = f.match(/url\('([^']+)'\)/)?.[1]
      expect(url, 'a @font-face with no src').toBeDefined()
      expect(url!.startsWith('/fonts/'), `${url} is not served from this origin`).toBe(true)
    }
    // The whole stylesheet, not just the @font-face blocks: an @import would be
    // just as fatal and would not appear above. Comments stripped first — the
    // rules above are explained by naming the host they must never use, and a
    // guard that its own reason for existing trips is a guard nobody keeps.
    const rules = css.replace(/\/\*[\s\S]*?\*\//g, '')
    expect(rules).not.toMatch(/fonts\.(googleapis|gstatic)\.com/)
  })

  it('swaps on the text faces and blocks on the icon face', () => {
    for (const f of faces) {
      const family = f.match(/font-family:\s*'([^']+)'/)?.[1]
      // swap exists so the club's own words stay readable while the typeface
      // arrives. The icon face has no words: what a fallback paints for a
      // Private Use Area codepoint is a tofu box, so swapping there would buy
      // a flash of empty rectangles across the tab bar in exchange for nothing.
      const wanted = family === 'Material Symbols Outlined' ? 'block' : 'swap'
      expect(f, `${family} should be font-display: ${wanted}`).toMatch(
        new RegExp(`font-display:\\s*${wanted}`),
      )
    }
  })
})

/**
 * The icon glyphs, guarded because the ways this goes wrong are all silent.
 *
 * They are Private Use Area codepoints, so a wrong one paints an empty box
 * rather than raising anything, and the tab bar has a readable label under it
 * either way — the screen looks *deliberate* while showing six blanks.
 *
 * What is asserted here is what a jsdom test can actually know. Whether the
 * codepoints exist in `public/fonts/material-symbols-subset.woff2` is a
 * question about a binary file this suite has no way to open; it is measured in
 * a browser instead, the same way T064 proved the two text faces, and the
 * subset recipe is written down in `design/README.md`.
 */
describe('the icon set', () => {
  it('inherits none of the letter-spacing or casing around it', () => {
    // The tab bar sets `tracking-wide` and the section labels set `uppercase`,
    // and both inherit. Letter-spacing adds a phantom right margin inside the
    // glyph's own box and walks it off centre — six columns, six different
    // offsets, and nothing in the markup to suggest why.
    const rule = css.match(/\.ek-icon\s*\{([^}]*)\}/)
    expect(rule, 'no .ek-icon rule').not.toBeNull()
    expect(rule![1]).toMatch(/letter-spacing:\s*normal/)
    expect(rule![1]).toMatch(/text-transform:\s*none/)
    expect(rule![1]).toMatch(/font-family:\s*'Material Symbols Outlined'/)
    // The subset is the Light cut, which is the one the export's own `.ms`
    // rule asks for. Any other weight here is a synthesised smear.
    expect(rule![1]).toMatch(/font-weight:\s*300/)
  })

  it('draws every icon from the set, and no geometric stand-ins survive', async () => {
    const { ICON } = await import('./components/Icon')
    const { ROUTES } = await import('./routes/routes')

    for (const [name, glyph] of Object.entries(ICON)) {
      expect(glyph, `${name} is not one codepoint`).toHaveLength(1)
      // U+E000–U+F8FF. A codepoint outside it is a character some real font
      // draws, which is how one of these silently becomes legible nonsense.
      const cp = glyph.codePointAt(0)!
      expect(cp, `${name} is not in the Private Use Area`).toBeGreaterThanOrEqual(0xe000)
      expect(cp, `${name} is not in the Private Use Area`).toBeLessThanOrEqual(0xf8ff)
    }

    // Every tab takes its icon from the set rather than from a character
    // chosen for its shape. The type already says so; this says it after a
    // refactor has changed the type.
    for (const r of ROUTES) {
      if (!r.nav) continue
      expect(Object.keys(ICON), `${r.path} has an icon outside the set`).toContain(r.nav.icon)
    }
  })
})

/**
 * The members' reveals. Same reasoning as the landing intro above — a browser
 * is the only place this shows — but the failure mode is worse: an element in
 * its start state is at `opacity: 0`, so a mistake here does not make the app
 * look wrong, it makes the club's records invisible.
 *
 * T064 guarded that with `@supports (animation-timeline: view())`, which was
 * sound and cost the whole club its motion: that feature is Safari 26 and the
 * members are on iPhones. The guarantee now comes from the selector instead.
 * `[data-reveal]` is what React renders and what a browser with no JavaScript
 * is left holding, and it must select nothing — only the values lib/reveal.ts
 * writes may hide anything, and it writes them only after an observer is
 * already watching that element (see lib/reveal.test.ts, which asserts the
 * behaviour rather than the stylesheet).
 */
describe('the members’ reveals', () => {
  /**
   * The stylesheet as a browser sees it: comments gone, keyframes gone.
   *
   * Both removals are load-bearing rather than tidying. Half of this file is
   * prose that names the very things these tests forbid — the paragraph above
   * `ek-reveal` explains the switch away from a scroll timeline by writing one
   * out — and a guard that its own explanation trips is a guard nobody keeps.
   * A `@keyframes` block is the one place `opacity: 0` is the entire point.
   */
  const sheet = css
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/@keyframes\s+[\w-]+\s*\{(?:[^{}]*\{[^{}]*\})*[^{}]*\}/g, '')

  /**
   * Every innermost rule, selector and body. `[^{}]+` cannot cross a brace, so
   * this matches the rules themselves and never the `@media` wrappers holding
   * them — which is what makes it safe to read a selector as a selector.
   */
  const rules = [...sheet.matchAll(/([^{}]+)\{([^{}]*)\}/g)].map((m) => ({
    selector: m[1].trim().replace(/\s+/g, ' '),
    body: m[2],
  }))

  it('leaves the bare attribute selecting nothing that could hide content', () => {
    // The properties that can make the club's history disappear, and the
    // selectors a browser reaches without any script having run. `data-draw`
    // joined the sweep here in T077: a collapsed clip over the plot is the
    // finance chart gone, and `[data-draw]` bare is what React renders.
    const bare = rules.filter((r) =>
      /(^|,\s*)\[data-(reveal|bar|draw)\](\s|,|$)/.test(r.selector),
    )
    expect(bare.length).toBeGreaterThan(0)
    for (const r of bare) {
      expect(r.body, `${r.selector} hides content with no script involved`).not.toMatch(
        /opacity:\s*0|scale[XY]?\(0|animation(-name)?:\s*ek-|clip-path:\s*url/,
      )
    }
  })

  it('hides only in a state something has to have set', () => {
    const hiding = rules.filter((r) => /opacity:\s*0[;\s}]/.test(r.body))
    // If this ever finds none, the sweep has stopped seeing the stylesheet.
    expect(hiding.length).toBeGreaterThan(0)
    for (const r of hiding) {
      // `armed` is the only state lib/reveal.ts sets after `observe()` has
      // returned on that element, so a rule scoped to it cannot outlive the
      // thing that ends it. `data-draw` joined the two in T073 and carries the
      // same promise for the finance chart.
      expect(r.selector, `${r.selector} starts content invisible on its own`).toMatch(
        /\[data-(reveal|bar|draw)='armed'\]/,
      )
    }
  })

  /**
   * The sweep's own hiding property, which the opacity sweep above cannot see.
   *
   * A clip collapsed to the baseline hides the plot exactly the way
   * `opacity: 0` hides a card, so it needs the same guarantee — and T077 can
   * give it the strong form T073 could not. There is nothing to measure now, so
   * the clip is scoped to a state `arm()` sets *after* `observe()` returned on
   * that element. No script, an old browser, a thrown observer, jsdom, a curve
   * recharts inserted late: the plot is simply never clipped.
   *
   * The reduced-motion block is the one place `clip-path` may appear
   * unconditionally, and only as `none` — see the test below it.
   */
  it('never clips the plot except while something is uncovering it', () => {
    const clipped = rules.filter((r) => /clip-path:/.test(r.body))
    expect(clipped.length).toBeGreaterThan(0)
    for (const r of clipped) {
      if (/clip-path:\s*none/.test(r.body)) continue
      expect(r.selector, `${r.selector} clips the plot with no script involved`).toMatch(
        /\[data-draw='(armed|in)'\]/,
      )
    }
  })

  /**
   * The sweep is a transform, and that is the point of it.
   *
   * T073 drew the curves with `stroke-dashoffset` and had to buy its safety from
   * CSS fallbacks — `--ek-len` was written by lib/reveal.ts after the geometry
   * answered, so every rule using it named a default that drew a complete line.
   * Both are gone. This fails if either comes back without the machinery and the
   * sanctioned exception that went with it.
   */
  it('draws the chart with a transform rather than a dash offset', () => {
    expect(sheet).not.toMatch(/stroke-dash(array|offset)/)
    expect(sheet).not.toMatch(/--ek-len/)
    const armed = rules.find((r) => r.selector === "[data-draw='armed'] .ek-sweep")
    expect(armed, 'no armed state for the sweep').toBeDefined()
    expect(armed!.body).toMatch(/transform:\s*scaleY\(0\)/)
    // The pivot lives on the element, not in the keyframe, so the finished state
    // stays the element's own plain CSS — the same shape .ek-rail and [data-bar]
    // use.
    const el = rules.find((r) => r.selector === '.ek-sweep')
    expect(el, 'no .ek-sweep rule').toBeDefined()
    expect(el!.body).toMatch(/transform-origin:\s*bottom/)
    expect(el!.body).toMatch(/transform-box:\s*fill-box/)
  })

  it('plays on a clock now, not a scroll timeline', () => {
    // The reverse of what T064 asserted, and deliberately. A scroll timeline is
    // the thing that did not exist on the club's phones; if one comes back it
    // brings its @supports guard and its silent no-op with it.
    expect(sheet).not.toMatch(/animation-timeline/)
    expect(sheet).not.toMatch(/@supports \(animation-timeline/)
    // §01: "Element · reveal 700 ms", "Kurve .16, 1, .3, 1". The arrivals still
    // use the system's own curve and nothing may quietly move off it.
    for (const state of ["[data-reveal='in']", "[data-bar='in']"]) {
      const rule = rules.find((r) => r.selector === state)
      expect(rule, `no rule for ${state}`).toBeDefined()
      expect(rule!.body).toMatch(/animation:\s*ek-\w+ \d+ms cubic-bezier\(0\.16, 1, 0\.3, 1\) both/)
    }
  })

  /**
   * The one animation on the app that is *not* §01's curve, and it is asserted
   * rather than allowed to drift.
   *
   * Lukas, 2026-07-30: *"Kan vi få en smule mere delay på den motion der er på
   * grafen? Det må godt gå lidt langsommere, da man ikke når at se at den bygger
   * op."* §01's `.16 1 .3 1` reaches 95 % at 43 % of its duration, so the chart
   * snapped and then crept; a slower version of the same curve would only creep
   * for longer. The sweep therefore runs 1600 ms on a nearly even curve. See
   * index.css for the sampled profile and design/README.md for the departure.
   */
  it('draws the chart sweep slowly, and on a curve that is not front-loaded', () => {
    const rule = rules.find((r) => r.selector === "[data-draw='in'] .ek-sweep")
    expect(rule, 'no rule for the sweep').toBeDefined()
    const match = rule!.body.match(
      /animation:\s*ek-sweep (\d+)ms cubic-bezier\(([\d.]+), ([\d.]+), ([\d.]+), ([\d.]+)\) both/,
    )
    expect(match, 'the sweep is not a plain duration + cubic-bezier any more').not.toBeNull()

    // Long enough to be watched. Below about a second the build-up is the thing
    // he could not see.
    expect(Number(match![1])).toBeGreaterThanOrEqual(1400)

    // And not front-loaded: y1 is what decides that, and §01's is 1.0 — the
    // curve leaves the origin almost vertically. Anything near it reinstates the
    // snap whatever the duration says.
    expect(Number(match![3])).toBeLessThanOrEqual(0.5)
  })

  /**
   * The sweep and the count-up are one gesture, and nothing in CSS can see that.
   *
   * The duration lives in two files — `[data-draw='in'] .ek-sweep` here and
   * `SWEEP_MS` in lib/reveal.ts — because one is a stylesheet and the other is a
   * rAF loop. They were both 900 ms by coincidence until Lukas asked for a slower
   * sweep, at which point the figures under the finance curve would have landed
   * 700 ms before the curve they read out. This is what stops the two drifting
   * apart again.
   */
  it('counts the figures over exactly as long as the sweep takes', () => {
    const rule = rules.find((r) => r.selector === "[data-draw='in'] .ek-sweep")
    const cssMs = Number(rule!.body.match(/ek-sweep (\d+)ms/)![1])
    const jsMs = Number(revealSource.match(/const SWEEP_MS = (\d+)/)![1])
    expect(jsMs).toBe(cssMs)
  })

  it('turns the whole of it off for someone who asked for less motion', () => {
    const block = sheet.match(/@media \(prefers-reduced-motion: reduce\)\s*\{([\s\S]*?)\n\}/)!
    // Not only the animations: an element already armed when the preference is
    // switched on mid-session has to land on the finished state, not stay at
    // opacity 0 waiting for an observer that will now never move it.
    const rule = block[1].match(/\[data-reveal\],[\s\S]*?\{([^}]*)\}/)
    expect(rule, 'the reveal states keep their start state under reduced motion').not.toBeNull()
    expect(rule![1]).toMatch(/animation:\s*none/)
    expect(rule![1]).toMatch(/opacity:\s*1/)
    expect(rule![1]).toMatch(/transform:\s*none/)
    // The chart's own pair. `clip-path: none` is the one that matters: an
    // element already armed when the preference is switched on mid-session would
    // otherwise keep a collapsed clip with no observer left to open it, which is
    // the club's finances gone rather than merely still.
    const plot = block[1].match(/\[data-draw\] \.ek-plot\s*\{([^}]*)\}/)
    expect(plot, 'the plot keeps its clip under reduced motion').not.toBeNull()
    expect(plot![1]).toMatch(/clip-path:\s*none/)
    const sweep = block[1].match(/\[data-draw\] \.ek-sweep\s*\{([^}]*)\}/)
    expect(sweep, 'the sweep keeps its start state under reduced motion').not.toBeNull()
    expect(sweep![1]).toMatch(/animation:\s*none/)
    expect(sweep![1]).toMatch(/transform:\s*none/)
  })
})
