/**
 * The two states every data page needs, in one place so they read the same
 * everywhere — and so neither is a blank screen, which looks like a broken site.
 */
export function Loading({ what }: { what: string }) {
  return (
    <p aria-busy="true" className="text-sm text-faint">
      Henter {what}…
    </p>
  )
}

export function Problem() {
  return (
    <p role="alert" className="text-sm text-absent">
      Kunne ikke hente data. Prøv at genindlæse siden.
    </p>
  )
}
