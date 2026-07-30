import { useLayoutEffect } from 'react'

/**
 * The members' motion, driven by IntersectionObserver.
 *
 * T064 built this on `animation-timeline: view()` and recorded the cost as an
 * accepted trade: "on a browser without scroll-driven animations — iOS before
 * Safari 26 — these screens do not move at all." That trade is now known to be
 * the wrong way round. Lukas, 2026-07-28: *"the cool visuals on the other pages
 * ... I cannot see anywhere. Neither on computer or phone. Note almost all EK
 * members use iPhone."* The feature landed in Safari 26; the club is not on it.
 * So the motion was not degrading gracefully for a minority — it did not exist
 * for the people the app is for.
 *
 * `IntersectionObserver` is what §05 Implementering asked for in the first
 * place — "Én observer for hele siden, tærskel 0.18, unobserve efter første
 * visning" — and the design export's own script uses one for its count-up. It
 * is not a dependency: it has been in every iOS Safari since 12.1 (2019), which
 * is far below the floor this app already sits on (Tailwind v4 needs Safari
 * 16.4). One code path everywhere beats two, so the scroll-timeline rules are
 * gone rather than kept as a second branch to keep correct.
 *
 * **Nothing here is allowed to be the reason content is invisible**, which is
 * the failure T064 was right to be afraid of. The stylesheet hides nothing on
 * its own: `[data-reveal]` with no value is fully visible, and the only thing
 * that ever sets a value is `arm()` below — *after* `observe()` has succeeded
 * on that exact element. An element is therefore hidden only while something
 * that has already agreed to show it is watching it. No script, a thrown
 * observer, an old browser, `prefers-reduced-motion`, a teardown mid-animation:
 * every one of those ends with the finished page rather than a blank one.
 */

/** §05: "tærskel 0.18". */
const THRESHOLD = 0.18

/**
 * The export's own margin. It holds the arrival back until the element is
 * properly in the page rather than clipped by the bottom edge of the screen —
 * on a phone the last 8 % of the viewport is under the thumb anyway.
 */
const ROOT_MARGIN = '0px 0px -8% 0px'

/** §01 Motion tokens: "Forskydning pr. element · 60 ms". */
const STAGGER_MS = 60

/**
 * How far the stagger is allowed to run before it stops being a stagger.
 *
 * Elements arrive in whatever batch the observer reports, and a batch is
 * usually two or three cards under a thumb — but a short page, a jump to an
 * anchor, or a screenshot of the whole document can deliver a dozen at once.
 * Six steps is 360 ms; past that a reader is waiting for the page rather than
 * watching it settle.
 */
const MAX_STAGGER_STEPS = 6

/** §01: "Nøgletal tæller op i 900 ms med easeOutExpo." */
const COUNT_MS = 900

/**
 * How long after `in` an element is finished, and can stop being an animation.
 *
 * The longest arrival on any screen is a card that came in six places into its
 * batch: 360 ms of stagger and then 700 ms of its own. Its pips end sooner
 * (354 + 420) and so does its rule (90 + 550).
 *
 * This is not tidying. A CSS animation with `fill-mode: both` never ends — the
 * element keeps a filling animation for the life of the page, and the compositor
 * keeps the layer that goes with it. Anciennitet paints 280 attendance pips, 29
 * cards and 29 rules; leaving them all "animating" cost the club's longest
 * screen 15 fps against 48 at a 10× CPU throttle, measured. Retiring the state
 * puts every one of them back to plain CSS with no animation attached, and the
 * finished look is identical because the finished state *is* the plain CSS.
 */
const SETTLE_MS = 1100

/**
 * The two kinds of arrival, and the figures — matching only the ones this file
 * has not already dealt with.
 *
 * Written as "has the attribute and is in none of my states" rather than as
 * `[data-reveal=""]`, and the difference is not stylistic. `<article
 * data-reveal>` in JSX is `data-reveal={true}`, and React writes that out as
 * `data-reveal="true"` — so an empty-string match would have found nothing in
 * the app at all while passing every test written against hand-written HTML.
 * This way the marker can be spelled any of the three ways and still work.
 */
const STATES = ['armed', 'in', 'done']
const not = (attr: string) => STATES.map((s) => `:not([${attr}="${s}"])`).join('')
const PENDING = [
  `[data-reveal]${not('data-reveal')}`,
  `[data-bar]${not('data-bar')}`,
  `[data-draw]${not('data-draw')}`,
  '[data-count]:not([data-counted])',
].join(', ')

/** What `arm()` has hidden, and what `release()` therefore has to hand back. */
const ARMED = '[data-reveal="armed"], [data-bar="armed"], [data-draw="armed"]'

const MOTION_OFF = '(prefers-reduced-motion: reduce)'

function reducedMotion(): boolean {
  return typeof matchMedia === 'function' && matchMedia(MOTION_OFF).matches
}

/**
 * Which attribute carries this element's state.
 *
 * One attribute doing both jobs — marker and state — is what keeps the CSS
 * honest: `[data-reveal]` alone (the value React renders) styles nothing at
 * all, so an element is at its natural opacity until this file says otherwise.
 */
function stateAttr(el: Element): 'data-reveal' | 'data-bar' | 'data-draw' | null {
  if (el.hasAttribute('data-reveal')) return 'data-reveal'
  if (el.hasAttribute('data-bar')) return 'data-bar'
  if (el.hasAttribute('data-draw')) return 'data-draw'
  return null
}

/**
 * Count a figure up to what the page already says.
 *
 * §01 asks for this by name and T064/T066 left it undone, on the reading that
 * rewriting text every frame is what §01's "kun opacity og transform" rule
 * exists to forbid. Re-read against the export, that reading does not hold: the
 * rule is about which *CSS properties* may be animated, because those two
 * composite and height/top/margin do not — and the export's own script counts
 * its figures by writing `textContent`. Two rules in the system were never in
 * conflict; one of them was being applied to something it does not describe.
 *
 * The number on screen is React's, always. `data-count` is the target, the
 * element's own text is the finished string, and the first thing this does is
 * check that it can rebuild that string exactly — if the formatting does not
 * match, it counts nothing and leaves the figure alone. A count-up that can
 * disagree with the page it is decorating is worse than no count-up, and the
 * club's figures are the point of three of these screens.
 *
 * The width is pinned before the first frame. "0" is narrower than "19", and
 * the one thing §05 asks of an arriving figure is that nothing moves under it —
 * "Ingen loading-hop. Reserveret plads til billeder og tal."
 */
type Counter = { el: HTMLElement; text: Text; before: string; after: string; from: number }

/**
 * Every figure currently counting, on one animation frame between them.
 *
 * Anciennitet starts ten at once — the roster's ten anciennitet counts, beside
 * the ten bars growing. Ten independent rAF loops would be ten callbacks and
 * ten closures to schedule for the same 900 ms; this is one.
 */
const counting = new Set<Counter>()
let ticker = 0

function tick(now: number) {
  ticker = 0
  for (const c of counting) {
    // A figure whose card was unmounted mid-count — an admin opening the meeting
    // editor over it, say. Nothing to write to, and nothing to finish.
    if (!c.el.isConnected) {
      counting.delete(c)
      continue
    }
    // Re-read the target every frame rather than closing over it: a refetch can
    // land inside these 900 ms, and a count-up that finishes on the number the
    // page had when it started is a stale figure nothing will correct.
    const to = Number(c.el.dataset.count)
    // Clamped at both ends, and the lower one is not defensive tidying. `from`
    // is `performance.now()`, taken when the observer said the figure was in
    // view; `now` is the rAF timestamp, which is the *frame's* time and can be
    // a fraction earlier than a reading taken during that same frame. One
    // negative millisecond puts easeOutExpo above 1 in the wrong direction —
    // `1 − 2^(−10p)` with p < 0 is a large negative multiplier — and the club's
    // bank balance renders as "-24.643 kr." for a frame. Found on /oekonomi
    // (T073), where a figure being briefly, confidently wrong about money is
    // the one failure this count-up was allowed on the page to avoid.
    const p = Math.min(1, Math.max(0, (now - c.from) / COUNT_MS))
    if (p < 1) {
      // easeOutExpo, the export's own formula. It never quite reaches 1, which
      // is why the last frame is written from the target rather than from it.
      const eased = 1 - Math.pow(2, -10 * p)
      c.text.nodeValue = c.before + Math.round(to * eased).toLocaleString('da-DK') + c.after
    } else {
      c.text.nodeValue = c.before + to.toLocaleString('da-DK') + c.after
      counting.delete(c)
    }
  }
  if (counting.size > 0) ticker = requestAnimationFrame(tick)
}

function count(el: HTMLElement) {
  el.setAttribute('data-counted', '')

  const target = Number(el.dataset.count)
  // The one text node React rendered the figure into, written through rather
  // than replaced. `el.textContent = …` removes that node and inserts a new
  // one, which is a childList mutation — and the MutationObserver below would
  // then wake fifty-four times a second per figure, on the screen with ten of
  // them. Setting `nodeValue` is characterData, which nothing here watches.
  const text = el.firstChild
  if (!text || text.nodeType !== Node.TEXT_NODE || el.childNodes.length !== 1) return

  const finished = text.nodeValue ?? ''
  if (!Number.isFinite(target) || target === 0) return

  // Where the digits sit in the finished string, so "68 %" and "19" and
  // "3.600 kr." all rebuild with their own punctuation around them. Not found
  // means the page formats this figure some way this cannot reproduce, and the
  // right answer then is to leave the club's number exactly as it is.
  const printed = target.toLocaleString('da-DK')
  const at = finished.indexOf(printed)
  if (at < 0) return

  const box = el.getBoundingClientRect().width
  if (box > 0) el.style.minWidth = `${box}px`

  counting.add({
    el,
    text: text as Text,
    before: finished.slice(0, at),
    after: finished.slice(at + printed.length),
    from: performance.now(),
  })
  if (!ticker) ticker = requestAnimationFrame(tick)
}

/**
 * Hide an element, but only once something is watching it.
 *
 * The order is the whole guarantee and is not an implementation detail:
 * `observe()` first, and the attribute — the only thing in the app that hides
 * anything — only after it returned. `observe()` never calls back
 * synchronously, so there is no window in between; if it throws, the element is
 * simply never hidden.
 *
 * **The finance chart is covered by this again, and was not under T073.** That
 * pass drew each curve with `stroke-dashoffset` and had to measure every path
 * with `getTotalLength()` — paths recharts inserts some frames after React
 * commits the card, which is too late for an ordering to reach, so it bought
 * its safety from CSS fallbacks instead. The plot is swept in by one clipped
 * edge now (`.ek-sweep`, `src/index.css`); there is nothing per-path to
 * measure, `data-draw` is an ordinary marker like the other two, and a curve
 * that arrives after the sweep has finished is simply an unclipped curve.
 */
function arm(io: IntersectionObserver, el: HTMLElement) {
  if (el.hasAttribute('data-count')) {
    // A figure is not hidden and then shown — it is on the page from the first
    // frame and counts up when it comes into view. Observed all the same, so
    // the count starts when it is looked at rather than when the tab loads.
    io.observe(el)
    return
  }
  const attr = stateAttr(el)
  if (!attr) return
  io.observe(el)
  el.setAttribute(attr, 'armed')
}

/** Play the arrival, `step` places into the batch it came in with. */
function show(el: HTMLElement, step: number) {
  if (el.hasAttribute('data-count')) {
    count(el)
    return
  }
  const attr = stateAttr(el)
  if (!attr) return
  // The stagger lands on the element's own animation, which for `data-reveal`
  // and `data-bar` is the element itself. `data-draw` animates a *descendant*
  // (`.ek-sweep`), and animation-delay does not inherit — so the plot takes no
  // stagger, and that is what makes the chart and the three figures beside it
  // finish together: the count-up takes none either (see `count()` above, called
  // straight from `show`). Measured: the sweep completes at +900 ms from `in`
  // and the figures land at +927. Push the delay down onto the sweep and the
  // gesture arrives up to 360 ms after the numbers it is the readout of.
  if (step > 0) el.style.animationDelay = `${Math.min(step, MAX_STAGGER_STEPS) * STAGGER_MS}ms`
  el.setAttribute(attr, 'in')
  // See SETTLE_MS. A timer rather than `animationend`, because what has to be
  // waited for is the *card's* pips and rule as well as the card, and three
  // listeners to learn a number that is known here is bookkeeping for its own
  // sake. Nothing depends on the moment being exact: `done` and a finished
  // `in` look the same.
  setTimeout(() => {
    if (el.getAttribute(attr) === 'in') el.setAttribute(attr, 'done')
  }, SETTLE_MS)
}

/**
 * Give back everything still hidden, without playing anything.
 *
 * Called on teardown, and it is the reason a torn-down observer cannot strand a
 * card. React's StrictMode mounts, unmounts and remounts every effect in
 * development, so this path runs on the club's own machine every time the dev
 * server reloads — an armed element whose observer had just been disconnected
 * would be blank until the next navigation.
 */
function release(root: ParentNode) {
  for (const el of root.querySelectorAll(ARMED)) {
    const attr = stateAttr(el)
    if (attr) el.setAttribute(attr, '')
  }
}

/**
 * One observer for the whole app, and a MutationObserver to feed it.
 *
 * The mutation callback is deliberately not debounced. It is delivered at the
 * microtask checkpoint after React's commit — before the browser paints — so an
 * element is hidden in the same frame it was inserted and there is no flash of
 * content appearing and then leaving. A 150 ms debounce, which is what the
 * export uses, would put that flash on every card on every page.
 */
export function installReveals(root: ParentNode & Node): () => void {
  // Not a capability check for its own sake: jsdom has no IntersectionObserver,
  // so the whole test suite runs down this branch — which is the fallback, and
  // is why "is the club's history readable without any of this" is a question
  // the offline suite can actually answer.
  if (typeof IntersectionObserver !== 'function' || reducedMotion()) return () => {}

  const io = new IntersectionObserver(
    (entries) => {
      let step = 0
      for (const entry of entries) {
        if (!entry.isIntersecting) continue
        // "unobserve efter første visning" (§05). Nothing on these screens
        // leaves and arrives again; re-running it on the way back up the page
        // would make scrolling feel like it was re-loading.
        io.unobserve(entry.target)
        show(entry.target as HTMLElement, step)
        step += 1
      }
    },
    { threshold: THRESHOLD, rootMargin: ROOT_MARGIN },
  )

  const scan = (within: ParentNode) => {
    const found = [...within.querySelectorAll<HTMLElement>(PENDING)]
    // The added node itself may be the card, not its container.
    if (within instanceof HTMLElement && within.matches(PENDING)) found.unshift(within)
    for (const el of found) {
      // Per element, and swallowed. One element the observer refuses must not
      // stop the rest of the page being armed, and this runs inside a
      // MutationObserver callback — where an exception is an unhandled error in
      // a task nobody owns. An element that fails here is simply never hidden,
      // which is the correct outcome and needs no reporting.
      try {
        arm(io, el)
      } catch {
        /* the element keeps its finished state */
      }
    }
  }

  scan(root)

  /**
   * Only what was added, never the page again.
   *
   * Re-querying the whole document on every mutation is what the export's own
   * script does, and it can afford to because it is one static page. Here the
   * mutations are React's: Anciennitet carries ~350 marked elements, and a
   * whole-tree rescan per commit turns every list update into a sweep of all of
   * them. What arrived is exactly what needs arming.
   */
  const mo = new MutationObserver((records) => {
    for (const record of records) {
      for (const node of record.addedNodes) {
        if (node.nodeType === Node.ELEMENT_NODE) scan(node as Element)
      }
    }
  })
  mo.observe(root, { childList: true, subtree: true })

  return () => {
    mo.disconnect()
    io.disconnect()
    release(root)
  }
}

/**
 * Installed once, at the top of the app, in a layout effect.
 *
 * Layout rather than passive: children have rendered by the time a parent's
 * layout effect runs and the browser has not painted yet, so the first screen's
 * cards are hidden before anyone could see them at full opacity.
 */
export function useReveal() {
  useLayoutEffect(() => installReveals(document.body), [])
}

/**
 * The scroll indicator — "én blå streg som signatur", used as an index.
 *
 * Straight out of the export, which carries `#ek-progress` as a 2 px blue rule
 * across the top of the page. It earns its place here for a reason the export
 * does not have: Anciennitet is 29 meetings over ~3400 px on a 900 px screen,
 * and until you reach the bottom nothing tells you whether that is a quarter of
 * the club's history or all of it.
 *
 * `scaleX`, where the export animates `width`. Width is layout, on the one
 * screen that has to stay cheap, on every scroll frame; a transform composites.
 * §01's own rule, applied to the export's own element.
 *
 * **How long the page is, is measured when it changes and not while scrolling.**
 * The export reads `scrollHeight` inside its own scroll handler; that property
 * forces a layout, so on Anciennitet it is a full re-layout of 29 cards on
 * every frame of every scroll — a cost that is invisible on a laptop and is the
 * whole frame budget on a phone. A ResizeObserver on the document element says
 * the same thing when it is actually news.
 *
 * The write is queued to an animation frame, so a burst of scroll events costs
 * one transform rather than one each.
 *
 * Not gated on `prefers-reduced-motion`, and the export does not gate it
 * either: this is not motion added to content, it is a readout of where the
 * thumb already is. It draws nothing on a page too short to scroll.
 */
export function useScrollProgress(ref: React.RefObject<HTMLElement | null>) {
  useLayoutEffect(() => {
    const doc = document.documentElement
    let queued = 0
    let max = 0

    const remeasure = () => {
      max = doc.scrollHeight - window.innerHeight
      draw()
    }

    const draw = () => {
      queued = 0
      const el = ref.current
      if (!el) return
      const p = max > 8 ? Math.min(1, Math.max(0, window.scrollY / max)) : 0
      el.style.transform = `scaleX(${p.toFixed(4)})`
    }

    const onScroll = () => {
      if (!queued) queued = requestAnimationFrame(draw)
    }

    remeasure()
    // The page grows and shrinks under this: a query resolving, an admin
    // opening the meeting editor, the address bar sliding away on a phone.
    // Guarded because jsdom has no ResizeObserver — every browser since Safari
    // 13.1 does, and without one this falls back to measuring on resize, which
    // costs the indicator some accuracy and nothing else.
    const ro = typeof ResizeObserver === 'function' ? new ResizeObserver(remeasure) : null
    ro?.observe(doc)
    window.addEventListener('scroll', onScroll, { passive: true })
    window.addEventListener('resize', remeasure)
    return () => {
      if (queued) cancelAnimationFrame(queued)
      ro?.disconnect()
      window.removeEventListener('scroll', onScroll)
      window.removeEventListener('resize', remeasure)
    }
  }, [ref])
}
