#!/usr/bin/env node
/**
 * Fold the demo build into one self-contained HTML file.
 *
 * Run after `VITE_DEMO=1 npm run build`. Reads dist/, inlines the stylesheet and
 * the module bundle, and writes dist-demo/index.html — no other file, no network
 * request, no server rules.
 *
 * Why one file: the demo has to be openable from a link on a phone, from a chat
 * message, from anywhere — including hosts that serve a single page and do not
 * rewrite unknown paths to index.html. Anything split across files needs a
 * server that agrees about paths, and this must not.
 *
 * The real deployment does NOT use this. It ships dist/ as normal, with a proper
 * database behind it.
 */
import { readFileSync, writeFileSync, mkdirSync, readdirSync } from 'node:fs'
import { join } from 'node:path'

const dist = 'dist'
const out = 'dist-demo'

const assets = readdirSync(join(dist, 'assets'))
const js = assets.find((f) => f.endsWith('.js'))
const css = assets.find((f) => f.endsWith('.css'))
if (!js || !css) throw new Error(`expected one .js and one .css in ${dist}/assets, got ${assets}`)

const script = readFileSync(join(dist, 'assets', js), 'utf8')
const rawStyle = readFileSync(join(dist, 'assets', css), 'utf8')

/**
 * Fold the self-hosted typefaces into the stylesheet.
 *
 * `public/fonts` is a directory the real build serves over HTTP, and there is
 * no HTTP here — one file, opened from a chat message. Left as `url(/fonts/…)`
 * both faces 404 and the demo silently renders in Georgia and the system sans,
 * which is precisely the state the fonts were extracted to end. Verified by
 * serving dist-demo from a static server: two 404s, and Chrome painting the
 * headings in Liberation Serif.
 *
 * base64 costs a third on top of 51 kB. Against a 900 kB bundle that is noise,
 * and it is the only way this file keeps its promise of needing nothing.
 */
function inlineFonts(sheet) {
  return sheet.replace(/url\(\/(fonts\/[^)]+\.woff2)\)/g, (_, rel) => {
    const data = readFileSync(join(dist, rel)).toString('base64')
    return `url(data:font/woff2;base64,${data})`
  })
}

const style = inlineFonts(rawStyle)
if (style.includes('url(/fonts/')) throw new Error('a font url survived inlining')

// A bundle is allowed to contain the literal characters "</script>" inside a
// string. Unescaped, the HTML parser would end the block there and the rest of
// the application would render as text. Escaping the slash changes nothing about
// what JavaScript sees.
const safe = (s) => s.replace(/<\/(script|style)/gi, '<\\/$1')

if (!script.includes('Demoversion')) {
  throw new Error('bundle does not look like a VITE_DEMO build — build with VITE_DEMO=1')
}

/**
 * Answer to an explicit theme as well as the operating system's.
 *
 * The app follows `prefers-color-scheme` alone, which is right for a site people
 * open in their own browser. A viewer that offers its own light/dark switch sets
 * `data-theme` on the root element instead, and the app would ignore it — the
 * switch would appear to do nothing.
 *
 * Derived from the stylesheet rather than written out again: the light values are
 * read from the media query and the dark ones from the tokens it overrides, so
 * this cannot drift from the palette. Attribute selectors outrank the bare
 * `:root` in the media query, so an explicit choice wins over the system in both
 * directions.
 */
function themeAttributeRules(sheet) {
  const light = sheet.match(/@media \(prefers-color-scheme:\s*light\)\{:root\{([^}]*)\}/)
  if (!light) throw new Error('no light-mode override found in the stylesheet')
  const names = [...light[1].matchAll(/(--[\w-]+):/g)].map((m) => m[1])
  // Only look before the media query. A token that no utility consumes is
  // dropped from the theme layer entirely, so searching the whole sheet would
  // find its light value and emit that as the dark one.
  const before = sheet.slice(0, light.index)
  const dark = names
    .map((n) => {
      const found = [...before.matchAll(new RegExp(`${n}:([^;}]+)`, 'g'))].pop()
      return found ? `${n}:${found[1]}` : null
    })
    .filter(Boolean)
    .join(';')
  return `:root[data-theme="light"]{${light[1]}}:root[data-theme="dark"]{${dark}}`
}

// Deliberately no <html>, <head> or <body>: this is valid on its own (a browser
// supplies them) and it also drops straight into a host that provides its own
// document skeleton. One file that works in both places beats two that differ.
// The charset declaration comes first and is not optional: a host that serves
// this without a charset in the Content-Type header makes the browser guess,
// and it guesses latin-1 — which turns every æ, ø and å in a Danish interface
// into mojibake. Caught by serving the file from a plain static server.
const html = `<meta charset="utf-8" />
<title>Erhvervsklubben — demo</title>
<meta name="viewport" content="width=device-width, initial-scale=1.0" />
<style>
${safe(style)}
${themeAttributeRules(style)}
</style>
<div id="root"></div>
<script type="module">
${safe(script)}
</script>
`

mkdirSync(out, { recursive: true })
writeFileSync(join(out, 'index.html'), html)
console.log(`${out}/index.html — ${(html.length / 1024).toFixed(0)} kB, one file`)
