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
