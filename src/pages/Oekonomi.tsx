/**
 * Treasurer-only. Reached through RequireAccess access="admin", and the finance
 * data will be admin-only at the database level too — hiding a page only stops
 * honest people (docs/PROJECT.md, 2026-07-26).
 */
export default function Oekonomi() {
  return (
    <div>
      <h2 className="text-xl font-semibold">Klubkassen</h2>
      <p className="mt-2 text-sm text-muted">Indhold følger — se T050.</p>
    </div>
  )
}
