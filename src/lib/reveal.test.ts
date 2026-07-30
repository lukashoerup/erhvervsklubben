import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { installReveals } from './reveal'

/**
 * The reveal, tested for the one property it must never lose: that it cannot be
 * the reason a member cannot read the club's records.
 *
 * T064 got that guarantee from `@supports (animation-timeline: view())` — a
 * browser without scroll-driven animations was never handed the start state.
 * The price was that the same browsers, which is to say every iPhone in this
 * club, got no motion at all. The guarantee now comes from ordering instead:
 * nothing is hidden until an observer is already watching it. Ordering is a
 * behaviour, so unlike the CSS guard it can actually be tested here.
 *
 * jsdom has no IntersectionObserver, so the default state of this file — and of
 * every other test in the suite — is the fallback path. That is deliberate: the
 * question "is the app readable with none of this running" is answered by the
 * whole offline suite, not by one assertion.
 */

/** A controllable IntersectionObserver: nothing fires until a test says so. */
class FakeIO {
  static live: FakeIO[] = []
  watched: Element[] = []
  disconnected = false
  cb: IntersectionObserverCallback
  options?: IntersectionObserverInit
  // Assigned in the body rather than declared as parameter properties: the app
  // builds with `erasableSyntaxOnly`, which those are not.
  constructor(cb: IntersectionObserverCallback, options?: IntersectionObserverInit) {
    this.cb = cb
    this.options = options
    FakeIO.live.push(this)
  }
  observe(el: Element) {
    this.watched.push(el)
  }
  unobserve(el: Element) {
    this.watched = this.watched.filter((w) => w !== el)
  }
  disconnect() {
    this.disconnected = true
    this.watched = []
  }
  /** Report the given elements as having come into view, in one batch. */
  fire(...els: Element[]) {
    this.cb(
      els.map((target) => ({ target, isIntersecting: true }) as IntersectionObserverEntry),
      this as unknown as IntersectionObserver,
    )
  }
}

function useFakeIO() {
  FakeIO.live = []
  vi.stubGlobal('IntersectionObserver', FakeIO)
  return () => FakeIO.live[0]
}

function markup(html: string) {
  document.body.innerHTML = html
  return document.body
}

/**
 * Let the MutationObserver deliver.
 *
 * Its callbacks are microtasks, which is the whole reason there is no debounce
 * on the scan: in a browser the microtask checkpoint after React's commit runs
 * *before* the frame is painted, so a card is hidden in the same frame it was
 * inserted and nobody ever sees it at full opacity first. A debounce — which is
 * what the design export uses — would turn that into a visible flash on every
 * card on every screen.
 */
const mutations = () => Promise.resolve()

/**
 * Every observer this file installs, torn down after the test that made it.
 *
 * Not tidiness: the observers watch `document.body`, which every test shares,
 * so one left running arms the *next* test's markup before that test's own
 * observer has looked at it — and the symptom is an element that is already
 * `armed` with nobody watching it, which is the exact bug this suite exists to
 * catch. Found the hard way.
 */
const installed: Array<() => void> = []
const install = (root: ParentNode & Node) => {
  const stop = installReveals(root)
  installed.push(stop)
  return stop
}

beforeEach(() => {
  document.body.innerHTML = ''
})

afterEach(() => {
  while (installed.length) installed.pop()!()
  vi.unstubAllGlobals()
})

describe('with no IntersectionObserver — every iPhone before iOS 12.1, and jsdom', () => {
  it('leaves the club’s records fully readable', () => {
    vi.stubGlobal('IntersectionObserver', undefined)
    const root = markup('<article data-reveal>Møde 28</article><span data-bar></span>')

    install(root)

    // The bare attribute, which is what React renders and what the stylesheet
    // is required to style into nothing.
    expect(root.querySelector('[data-reveal]')!.getAttribute('data-reveal')).toBe('')
    expect(root.querySelector('[data-bar]')!.getAttribute('data-bar')).toBe('')
  })

  it('leaves a figure showing the number the page rendered', () => {
    vi.stubGlobal('IntersectionObserver', undefined)
    const root = markup('<div data-count="19">19</div>')

    install(root)

    expect(root.querySelector('[data-count]')!.textContent).toBe('19')
  })
})

describe('with an observer', () => {
  it('hides nothing until that element is being watched', () => {
    const io = useFakeIO()
    const root = markup('<article data-reveal>Møde 28</article>')
    const card = root.querySelector('[data-reveal]')!

    install(root)

    expect(io().watched).toContain(card)
    expect(card.getAttribute('data-reveal')).toBe('armed')
  })

  it('finds the marker however it was spelled', () => {
    // `<article data-reveal>` in JSX is `data-reveal={true}`, and React writes
    // it out as `data-reveal="true"`. Matching the empty string instead would
    // have found nothing anywhere in the app while passing every test written
    // against hand-written HTML — which is exactly what happened once.
    const io = useFakeIO()
    const root = markup('<article data-reveal="true">Møde 28</article>')
    install(root)

    expect(io().watched).toHaveLength(1)
    expect(root.querySelector('[data-reveal]')!.getAttribute('data-reveal')).toBe('armed')
  })

  it('never hides an element it failed to observe', async () => {
    // The failure this ordering exists for. An observer that throws — a browser
    // bug, a detached root, anything — must cost the animation and not the
    // meeting card underneath it. And it must not throw out of a
    // MutationObserver callback, which is a task with nobody to catch it.
    const io = useFakeIO()
    const root = markup('<article data-reveal>Møde 28</article>')
    install(root)
    io().observe = () => {
      throw new Error('nej')
    }

    const [broken, fine] = ['Møde 27', 'Møde 26'].map((t) => {
      const el = document.createElement('article')
      el.setAttribute('data-reveal', '')
      el.textContent = t
      root.appendChild(el)
      return el
    })
    await mutations()

    expect(broken.getAttribute('data-reveal')).toBe('')
    // The one after it is still scanned, rather than the page stopping at the
    // first element that would not take.
    expect(fine.getAttribute('data-reveal')).toBe('')
  })

  it('plays the arrival when the element comes into view, once', () => {
    const io = useFakeIO()
    const root = markup('<article data-reveal>Møde 28</article>')
    const card = root.querySelector('[data-reveal]')!
    install(root)

    io().fire(card)

    expect(card.getAttribute('data-reveal')).toBe('in')
    // §05: "unobserve efter første visning."
    expect(io().watched).not.toContain(card)
  })

  it('asks for the design system’s own threshold', () => {
    const io = useFakeIO()
    install(markup('<article data-reveal></article>'))
    // §05 Implementering: "Én observer for hele siden, tærskel 0.18."
    expect(io().options?.threshold).toBe(0.18)
  })

  it('staggers a batch 60 ms apart, and caps it', () => {
    const io = useFakeIO()
    const root = markup(
      Array.from({ length: 9 }, (_, i) => `<article data-reveal>${i}</article>`).join(''),
    )
    const cards = [...root.querySelectorAll<HTMLElement>('[data-reveal]')]
    install(root)

    io().fire(...cards)

    // §01 Motion tokens: "Forskydning pr. element · 60 ms".
    expect(cards[0].style.animationDelay).toBe('')
    expect(cards[1].style.animationDelay).toBe('60ms')
    expect(cards[3].style.animationDelay).toBe('180ms')
    // Capped, so a batch of twenty-nine is not a reader waiting on the page.
    expect(cards[6].style.animationDelay).toBe('360ms')
    expect(cards[8].style.animationDelay).toBe('360ms')
  })

  it('arms content that arrives after the first render', async () => {
    // The club's screens are all query-driven: at install time the page is a
    // "Henter…" line and every card appears later.
    const io = useFakeIO()
    const root = markup('<p>Henter anciennitet…</p>')
    install(root)

    const card = document.createElement('article')
    card.setAttribute('data-reveal', '')
    root.appendChild(card)
    await mutations()

    expect(io().watched).toContain(card)
    expect(card.getAttribute('data-reveal')).toBe('armed')
  })

  it('hands back everything still hidden when it is torn down', () => {
    // StrictMode mounts, unmounts and remounts every effect in development, so
    // this runs on the club's own machine on every reload. A card armed by an
    // observer that has just been disconnected would stay blank.
    const io = useFakeIO()
    const root = markup('<article data-reveal>Møde 28</article><span data-bar></span>')
    const stop = install(root)
    expect(root.querySelector('[data-reveal]')!.getAttribute('data-reveal')).toBe('armed')

    stop()

    expect(root.querySelector('[data-reveal]')!.getAttribute('data-reveal')).toBe('')
    expect(root.querySelector('[data-bar]')!.getAttribute('data-bar')).toBe('')
    expect(io().disconnected).toBe(true)
  })

  it('does nothing at all for someone who asked for less motion', () => {
    useFakeIO()
    vi.stubGlobal('matchMedia', (q: string) => ({ matches: q.includes('reduce') }))
    const root = markup('<article data-reveal>Møde 28</article><div data-count="19">19</div>')

    install(root)

    // Not a faster reveal — none, and the finished page from the first frame.
    expect(root.querySelector('[data-reveal]')!.getAttribute('data-reveal')).toBe('')
    expect(root.querySelector('[data-count]')!.textContent).toBe('19')
  })
})

/**
 * §01: "Nøgletal tæller op i 900 ms med easeOutExpo." The number on screen is
 * always the one React rendered — this only replaces it while it is arriving,
 * and only when it can rebuild the rendered string exactly.
 */
describe('the figures counting up', () => {
  const frames = () => {
    const queue: FrameRequestCallback[] = []
    let now = 0
    vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => {
      queue.push(cb)
      return queue.length
    })
    vi.stubGlobal('performance', { now: () => now })
    return {
      advance(ms: number) {
        now += ms
        const due = queue.splice(0)
        for (const cb of due) cb(now)
      },
    }
  }

  it('starts low and lands on exactly what the page said', () => {
    const io = useFakeIO()
    const clock = frames()
    const root = markup('<div data-count="19">19</div>')
    const figure = root.querySelector<HTMLElement>('[data-count]')!
    install(root)

    io().fire(figure)
    clock.advance(200)
    expect(Number(figure.textContent)).toBeGreaterThan(0)
    expect(Number(figure.textContent)).toBeLessThan(19)

    clock.advance(900)
    expect(figure.textContent).toBe('19')
  })

  it('keeps the punctuation the page put around the number', () => {
    const io = useFakeIO()
    const clock = frames()
    const root = markup('<div data-count="68">68%</div>')
    const figure = root.querySelector<HTMLElement>('[data-count]')!
    install(root)

    io().fire(figure)
    clock.advance(200)
    expect(figure.textContent).toMatch(/^\d+%$/)

    clock.advance(900)
    expect(figure.textContent).toBe('68%')
  })

  it('leaves a figure alone when it cannot rebuild what the page wrote', () => {
    // A formatting change here should cost the count-up, never the number: the
    // club's own figures are the point of three of these screens.
    const io = useFakeIO()
    const clock = frames()
    const root = markup('<div data-count="1780">1 780 kr.</div>')
    const figure = root.querySelector<HTMLElement>('[data-count]')!
    install(root)

    io().fire(figure)
    clock.advance(400)

    expect(figure.textContent).toBe('1 780 kr.')
  })

  it('follows the number if it changes while it is still counting', () => {
    const io = useFakeIO()
    const clock = frames()
    const root = markup('<div data-count="19">19</div>')
    const figure = root.querySelector<HTMLElement>('[data-count]')!
    install(root)

    io().fire(figure)
    clock.advance(200)
    figure.dataset.count = '20'
    clock.advance(900)

    expect(figure.textContent).toBe('20')
  })

  /**
   * A frame whose clock reads earlier than the figure's own start.
   *
   * `from` is `performance.now()` at the moment the observer fired; `now` is
   * the rAF timestamp, which is the frame's time and need not be later than a
   * reading taken inside that frame. Unclamped, easeOutExpo turns those few
   * negative milliseconds into a large negative multiplier: the club's balance
   * flashing as "-24.643 kr." on the one screen whose whole job is to be exact.
   */
  it('never prints a negative krone on a frame that arrives early', () => {
    const io = useFakeIO()
    const clock = frames()
    const root = markup('<dd data-count="6210">6.210 kr.</dd>')
    const figure = root.querySelector<HTMLElement>('[data-count]')!
    install(root)

    io().fire(figure)
    // The next frame's timestamp is behind the moment the count began.
    clock.advance(-4)
    expect(figure.textContent).toBe('0 kr.')

    clock.advance(1000)
    expect(figure.textContent).toBe('6.210 kr.')
  })

  /**
   * §01: "prefers-reduced-motion slår alt fra og viser indhold med det samme."
   * A figure is the one kind of element where getting that wrong is not a
   * missing animation but a wrong number on screen — the club's money, held at
   * whatever the easing had reached. It is asserted here as well as in the
   * reveal's own reduced-motion test because /oekonomi's three figures now
   * count too (T073), and a count-up that spins a balance for somebody who
   * asked for stillness is worse than one that never ran.
   */
  it('shows the club’s real figure, not a count, when less motion was asked for', () => {
    useFakeIO()
    const clock = frames()
    vi.stubGlobal('matchMedia', (q: string) => ({ matches: q.includes('reduce') }))
    const root = markup('<dd data-count="2610">2.610 kr.</dd>')
    const figure = root.querySelector<HTMLElement>('[data-count]')!

    install(root)
    clock.advance(200)

    expect(figure.textContent).toBe('2.610 kr.')
    // Nothing was ever started, so nothing has to finish for this to be true.
    expect(figure.hasAttribute('data-counted')).toBe(false)
  })
})

/**
 * The finance chart, swept in from the baseline.
 *
 * Lukas, 2026-07-29: "Det kunne også være fedt med noget motion på
 * finansgrafen." And 2026-07-30, on what T073 built for it: "Nu kommer den ind
 * sådan i stykker (en linje ad gangen) ... Ideelt så skulle den ligesom komme
 * frem som om at den blev tegnet frem fra bunden."
 *
 * **The interesting change here is what this file stopped doing.** T073 measured
 * every path with `getTotalLength()` and wrote `--ek-len` onto it, because a
 * curve drawn by `stroke-dashoffset` has to know its own length. It also meant
 * the safety came from CSS fallbacks rather than from `arm()`'s ordering:
 * recharts inserts those paths some frames after React commits the card, too
 * late for observe-then-hide to reach. One clipped edge over the whole plot
 * needs no measurement, so `data-draw` is an ordinary marker again and the
 * ordering — which is a behaviour, and therefore testable — covers the chart.
 */
describe('the finance chart sweeping in', () => {
  const chart = () =>
    markup(
      '<div data-draw><svg><clipPath id="ek-plot-sweep"><rect class="ek-sweep"/></clipPath></svg>' +
        '<div class="ek-plot"><svg><g><path d="M0 0 L10 10"></path></g></svg></div></div>',
    )

  it('hides nothing until the plot is being watched', () => {
    const io = useFakeIO()
    const root = chart()
    install(root)

    const plot = root.querySelector('[data-draw]')!
    expect(plot.getAttribute('data-draw')).toBe('armed')
    expect(io().watched).toContain(plot)
  })

  it('sweeps when the plot comes into view', () => {
    const io = useFakeIO()
    const root = chart()
    install(root)

    const plot = root.querySelector<HTMLElement>('[data-draw]')!
    io().fire(plot)

    expect(plot.getAttribute('data-draw')).toBe('in')
  })

  /**
   * One attribute on the plot is the whole of the state, and nothing per-curve.
   *
   * The path here stands in for one recharts has not inserted yet — the state
   * every page load passes through. T073 had to reach inside and measure it, and
   * a path it never reached was kept whole by a CSS fallback. Nothing reaches
   * inside now, so a curve that arrives late, early or not at all is an ordinary
   * curve under a clip that is on its way open.
   */
  it('touches nothing inside the plot', async () => {
    useFakeIO()
    const root = chart()
    // Lent, so a call would succeed rather than throw — the point is that none
    // is made. jsdom declares getTotalLength and does not implement it.
    const path = root.querySelector<SVGPathElement>('.ek-plot path')!
    let asked = 0
    path.getTotalLength = () => {
      asked += 1
      return 420
    }
    install(root)
    await mutations()

    expect(asked).toBe(0)
    expect(path.getAttribute('style')).toBeNull()
    expect(root.querySelector('.ek-sweep')!.getAttribute('style')).toBeNull()
  })

  it('hands the plot back if it is torn down before it was ever seen', () => {
    useFakeIO()
    const root = chart()
    const stop = install(root)

    stop()

    expect(root.querySelector('[data-draw]')!.getAttribute('data-draw')).toBe('')
  })

  it('never arms the plot for someone who asked for less motion', () => {
    useFakeIO()
    vi.stubGlobal('matchMedia', (q: string) => ({ matches: q.includes('reduce') }))
    const root = chart()
    install(root)

    expect(root.querySelector('[data-draw]')!.getAttribute('data-draw')).toBe('')
  })
})
