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
    // 60 fps på telefonen." letter-spacing is the single sanctioned exception —
    // the wordmark tightening is asked for by name and no transform expresses
    // it. Anything else here means a keyframe is animating layout.
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
 * is the only place this shows — but the failure mode is worse: these rules
 * start elements at `opacity: 0`, so a guard removed here does not make the app
 * look wrong, it makes the club's records invisible.
 *
 * Two guards, and both are load-bearing. `prefers-reduced-motion: no-preference`
 * is what gives someone who asked for less motion the finished page rather than
 * a faster version of the movement. `@supports (animation-timeline: view())` is
 * what stops a browser that cannot run the animation from being handed its
 * start state with no way to leave it — without it, every card on every screen
 * would be permanently blank on older Safari.
 */
describe('the members’ reveals', () => {
  const guarded = css.match(
    /@media \(prefers-reduced-motion: no-preference\)\s*\{\s*@supports \(animation-timeline: view\(\)\)\s*\{([\s\S]*?)\n {2}\}\n\}/,
  )

  it('sits behind both the motion preference and the feature check', () => {
    expect(guarded, 'the scroll-linked rules are not inside both guards').not.toBeNull()
  })

  it('declares the reveal and the bar growth only in there', () => {
    expect(guarded![1]).toMatch(/\[data-reveal\]/)
    expect(guarded![1]).toMatch(/\[data-bar\]/)
    // One occurrence each, so a second copy cannot escape the guards.
    expect(css.match(/\[data-reveal\]\s*\{/g)).toHaveLength(1)
    expect(css.match(/\[data-bar\]\s*\{/g)).toHaveLength(1)
  })

  it('drives them from scroll position, not a clock', () => {
    // A length here would play the reveal on a timer whether or not the reader
    // ever scrolled to it — and on a phone that means content animating
    // off-screen and arriving already finished.
    expect(guarded![1]).not.toMatch(/animation-duration:\s*\d/)
    expect(guarded![1].match(/animation-timeline:\s*view\(\)/g)).toHaveLength(2)
  })
})
