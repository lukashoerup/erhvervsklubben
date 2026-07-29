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
 * The finance chart's curves, drawing themselves in.
 *
 * Lukas, 2026-07-29: "Det kunne også være fedt med noget motion på
 * finansgrafen. Så linjerne sådan kommer frem, når man åbner siden."
 *
 * The animation itself is four CSS rules; what is testable — and what actually
 * matters — is that the club's finances are never drawn short. A path is
 * hidden only by `--ek-len`, which is only ever written after the geometry
 * answered, so every path this cannot measure is a whole line.
 */
describe('the finance curves drawing in', () => {
  const chart = () =>
    markup(
      '<div data-draw><svg><g class="ek-curve"><path d="M0 0 L10 10"></path></g></svg></div>',
    )

  /** jsdom has no geometry, so a length has to be lent to the path. */
  const withLength = (root: ParentNode, len: number) => {
    const path = root.querySelector<SVGPathElement>('.ek-curve path')!
    // jsdom implements the element but not its geometry: getTotalLength is
    // declared and throws. Lending it one is what stands in for layout.
    path.getTotalLength = () => len
    return path
  }

  it('hides nothing until the plot is being watched', () => {
    const io = useFakeIO()
    const root = chart()
    withLength(root, 420)
    install(root)

    const plot = root.querySelector('[data-draw]')!
    expect(plot.getAttribute('data-draw')).toBe('armed')
    expect(io().watched).toContain(plot)
  })

  it('measures each curve so the CSS has something to draw', async () => {
    useFakeIO()
    const root = chart()
    const path = withLength(root, 420)
    install(root)
    await mutations()

    expect(path.style.getPropertyValue('--ek-len')).toBe('420')
  })

  it('draws when the plot comes into view', () => {
    const io = useFakeIO()
    const root = chart()
    withLength(root, 420)
    install(root)

    const plot = root.querySelector<HTMLElement>('[data-draw]')!
    io().fire(plot)

    expect(plot.getAttribute('data-draw')).toBe('in')
  })

  /**
   * The guarantee, in the one form it can take here: a path with no length
   * carries no `--ek-len`, and the two rules that hide it fall back to
   * `stroke-dasharray: none` and `stroke-dashoffset: 0` — a complete curve.
   * recharts fills the SVG in some frames after React commits the card, so
   * "not measured yet" is a state this passes through on every page load.
   */
  it('leaves an unmeasured curve whole', async () => {
    useFakeIO()
    const root = chart()
    const path = root.querySelector<SVGPathElement>('.ek-curve path')!
    install(root)
    await mutations()

    expect(path.style.getPropertyValue('--ek-len')).toBe('')
  })

  it('hands the plot back if it is torn down before it was ever seen', () => {
    useFakeIO()
    const root = chart()
    withLength(root, 420)
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
