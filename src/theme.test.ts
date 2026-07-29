import { describe, expect, it } from 'vitest'
// `?raw` rather than node:fs — the app's tsconfig has no node types, and adding
// them to read one file would be a dependency for a one-line convenience.
import css from './index.css?raw'

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
    // 60 fps på telefonen." Two sanctioned exceptions, and both are gestures no
    // transform can express rather than conveniences:
    //
    //   letter-spacing — the wordmark tightening in the logo intro, which §01
    //   asks for by name;
    //   stroke-dashoffset — the finance curves drawing themselves in (T073,
    //   Lukas: "Så linjerne sådan kommer frem, når man åbner siden"). Two paths
    //   inside one SVG layer on one screen, and nothing in a list.
    //
    // Neither is layout: the rule exists because height, top and margin
    // reflow, and these do not. Anything *else* appearing here does.
    const inside = [...css.matchAll(/@keyframes ek-[a-z-]+\s*\{([\s\S]*?)\n\}/g)]
    expect(inside.length).toBeGreaterThan(0)
    const props = new Set(
      inside.flatMap((m) => [...m[1].matchAll(/^\s{4}([a-z-]+):/gm)].map((p) => p[1])),
    )
    expect([...props].sort()).toEqual([
      'letter-spacing',
      'opacity',
      'stroke-dashoffset',
      'transform',
    ])
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
    // The one property that can make the club's history disappear, and the one
    // selector a browser reaches without any script having run.
    const bare = rules.filter((r) =>
      /(^|,\s*)\[data-(reveal|bar)\](\s|,|$)/.test(r.selector),
    )
    for (const r of bare) {
      expect(r.body, `${r.selector} hides content with no script involved`).not.toMatch(
        /opacity:\s*0|scale[XY]?\(0|animation(-name)?:\s*ek-/,
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
   * The curve's own hiding property, which the opacity sweep above cannot see.
   *
   * A path with `stroke-dashoffset` equal to its length is invisible exactly
   * the way `opacity: 0` is, so it needs the same guarantee — and one more
   * besides: `--ek-len` is written by lib/reveal.ts *after* the geometry
   * answered, so every rule that uses it has to name a fallback that draws the
   * club's finances whole. An unmeasured path, a thrown observer, jsdom, no
   * script at all: `none` and `0` are a complete line.
   */
  it('never leaves a curve short of its own length', () => {
    const dashed = rules.filter((r) => /stroke-dash(array|offset):/.test(r.body))
    expect(dashed.length).toBeGreaterThan(0)
    for (const r of dashed) {
      // The reduced-motion block undraws the dashes outright, and says so in
      // literals rather than through the variable.
      if (/stroke-dasharray:\s*none/.test(r.body) && /stroke-dashoffset:\s*0/.test(r.body)) continue
      expect(r.selector, `${r.selector} chops a curve with no script involved`).toMatch(
        /\[data-draw='(armed|in)'\]/,
      )
      for (const use of r.body.matchAll(/var\(([^)]*)\)/g)) {
        expect(use[1], `${r.selector} has no fallback for an unmeasured curve`).toMatch(
          /--ek-len,\s*(none|0)/,
        )
      }
    }
  })

  it('plays on a clock now, not a scroll timeline', () => {
    // The reverse of what T064 asserted, and deliberately. A scroll timeline is
    // the thing that did not exist on the club's phones; if one comes back it
    // brings its @supports guard and its silent no-op with it.
    expect(sheet).not.toMatch(/animation-timeline/)
    expect(sheet).not.toMatch(/@supports \(animation-timeline/)
    for (const state of ["[data-reveal='in']", "[data-bar='in']"]) {
      const rule = rules.find((r) => r.selector === state)
      expect(rule, `no rule for ${state}`).toBeDefined()
      // §01: "Element · reveal 700 ms", "Kurve .16, 1, .3, 1".
      expect(rule!.body).toMatch(/animation:\s*ek-\w+ \d+ms cubic-bezier\(0\.16, 1, 0\.3, 1\) both/)
    }
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
  })
})
