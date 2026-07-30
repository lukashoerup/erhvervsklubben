/**
 * The club's mark, inline rather than an `<img src="/brand/logo-ek.svg">`.
 *
 * The landing page animates the plate and the two letters separately, and a
 * referenced SVG is a closed box — nothing outside it can address its parts.
 * The paths are the same outlines as `public/brand/logo-ek.svg`; that file
 * stays, because a favicon, an OG image or an e-mail signature needs a real
 * file, not a React component.
 *
 * Colours come from tokens, not the file's own hex: `--color-navy` is the
 * logo's blue and is deliberately constant across themes, so the mark looks
 * the same on either ground. The corner radius is the design system's
 * "7,3 % af siden", the inner hairline and the drop shadow are its own —
 * that shadow is one of only three in the whole system, and this is one of
 * the three things allowed to carry it.
 */
export function LogoMark({
  size,
  animated = false,
  walk = false,
}: {
  /** Rendered edge length, in px. The design system's floor is 24. */
  size: number
  /** Play the intro once. A reduced-motion request turns it off in CSS. */
  animated?: boolean
  /**
   * Walk the blue line around the mark, and nothing else — no plate fading up,
   * no letters sliding in. This is the app bar's version of the landing page's
   * finale, on Lukas's request (2026-07-30), and it plays once on arrival at a
   * page rather than looping: see `.ek-walk` in index.css for why not.
   */
  walk?: boolean
}) {
  // The frame is inset and weighted off the rendered size, so the small mark in
  // the app bar does not wear the 104 px lockup's proportions. At 104 this is
  // 5 px and 2 px — exactly the values that were hardcoded here before, so the
  // landing page is unchanged to the pixel.
  const inset = Math.max(3, Math.round(size * 0.048))
  const line = size >= 64 ? 2 : 1.5
  return (
    <span
      className="relative inline-block shrink-0"
      style={{ width: size, height: size }}
    >
      <svg
        viewBox="0 0 256 256"
        role="img"
        aria-label="Erhvervsklubben"
        className="block size-full"
        style={{ filter: 'drop-shadow(0 20px 46px rgb(22 35 63 / 0.22))' }}
      >
        <g className={animated ? 'ek-square' : undefined}>
          <rect width="256" height="256" rx="18.7" className="fill-navy" />
          <rect
            x="7"
            y="7"
            width="242"
            height="242"
            rx="12"
            fill="none"
            stroke="#FFFFFF"
            strokeOpacity="0.14"
          />
        </g>
        {/* Two paths, not one: the E arrives from the left and the K from the
            right, which is the whole point of drawing the mark rather than
            linking to it. */}
        <g fill="#FFFFFF">
          <path
            className={animated ? 'ek-e' : undefined}
            d="M35.84 175.1254961832061 48.9664539975894 173.06494817195662V82.85873523503416L35.84 80.8745038167939V76.82972438730414H112.6144925672961V101.3273507432704H107.57759742868622L105.13546645239052 84.76665006026518Q96.58800803535557 83.69821775813581 80.40889031739654 83.69821775813581H63.69555644837284V123.6881124949779H91.32216311771796L93.68797750100441 111.4774576134994H98.57223945359583V142.91989393330655H93.68797750100441L91.32216311771796 130.55660586580956H63.69555644837284V172.3017822418642H83.84313700281237Q103.53281799919647 172.3017822418642 109.63814543993571 171.08071675371636L113.98819124146243 152.15420168742466H119.02508638007232L117.57507111289675 179.17027561269586H35.84Z"
          />
          <path
            className={animated ? 'ek-k' : undefined}
            d="M212.1467577340297 76.82972438730414V80.8745038167939L200.3176858175974 82.85873523503416L165.36468621936518 117.04856890317397L209.09409401366008 173.06494817195662L220.15999999999997 175.1254961832061V179.17027561269586H195.12815749296905L155.0619461631177 127.4276255524307L141.24864282844516 138.49353153877058V173.06494817195662L155.90142868621933 175.1254961832061V179.17027561269586H113.3930863800723V175.1254961832061L126.5195403776617 173.06494817195662V82.85873523503416L113.3930863800723 80.8745038167939V76.82972438730414H154.37509682603454V80.8745038167939L141.24864282844516 82.85873523503416V131.09082201687426L190.24389554037765 82.85873523503416L180.09378867014863 80.8745038167939V76.82972438730414Z"
          />
        </g>
      </svg>

      {/* The blue line that walks around the mark. Four elements because it has
          to hand off at each corner; without the animation they are simply an
          open frame, so the mark still reads.

          `ek-walk` on the wrapper rather than on each edge: it only shifts the
          four delays, and putting it here means the sequence is described in one
          place. The wrapper is unpositioned, so the edges still lay themselves
          out against the outer `relative` span. */}
      {(animated || walk) && (
        <span aria-hidden="true" className={walk ? 'ek-walk' : undefined}>
          <span
            className="ek-frame ek-frame-t absolute bg-accent"
            style={{ top: -inset, right: -inset, left: -inset, height: line }}
          />
          <span
            className="ek-frame ek-frame-r absolute bg-accent"
            style={{ top: -inset, right: -inset, bottom: -inset, width: line }}
          />
          <span
            className="ek-frame ek-frame-b absolute bg-accent"
            style={{ right: -inset, bottom: -inset, left: -inset, height: line }}
          />
          <span
            className="ek-frame ek-frame-l absolute bg-accent"
            style={{ top: -inset, bottom: -inset, left: -inset, width: line }}
          />
        </span>
      )}
    </span>
  )
}
