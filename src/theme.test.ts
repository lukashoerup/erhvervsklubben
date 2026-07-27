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
