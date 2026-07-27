/**
 * A PostgREST client that records what the page tried to write.
 *
 * The read half is the same thenable builder the other suites use — every
 * filter returns itself and awaiting it resolves. The write half is the point:
 * these screens exist to change the club's only copy of its own records, so
 * "what payload, to which table, against which id" is the thing worth asserting,
 * and a mock that merely swallowed the call would prove nothing.
 */
export type Write = {
  table: string
  verb: 'insert' | 'update' | 'delete'
  values?: unknown
  id?: string
  /** Every `.eq()` on the write, column → value. An attendance row is addressed
      by two of them, so `id` alone cannot say which row was aimed at. */
  match?: Record<string, string>
}

export const writes: Write[] = []
export const state: {
  rows: Record<string, unknown[]>
  failWrites: boolean
  /** The `id` the database hands back to an insert that asks for its row. */
  insertedId: number
} = {
  rows: {},
  failWrites: false,
  insertedId: 99,
}

export function reset(rows: Record<string, unknown[]> = {}) {
  writes.length = 0
  state.rows = rows
  state.failWrites = false
  state.insertedId = 99
}

function builder(table: string) {
  const b: Record<string, unknown> = {}
  let write: Write | null = null
  let oneRow = false

  for (const m of ['select', 'gte', 'lte', 'order', 'limit']) b[m] = () => b
  for (const m of ['single', 'maybeSingle']) {
    b[m] = () => {
      oneRow = true
      return b
    }
  }

  // `.eq('id', …)` is how update and delete say which row. Recorded on the
  // pending write rather than ignored: a delete aimed at the wrong id is the
  // failure this whole mock exists to be able to catch. Attendance is corrected
  // by `(record_id, member_name)` instead of an id, so every column is kept —
  // a write aimed at the right meeting and the wrong member is the same class
  // of bug and has to be catchable too.
  b.eq = (column: string, value: string | number) => {
    if (write) {
      if (column === 'id') write.id = String(value)
      write.match = { ...write.match, [column]: String(value) }
    }
    return b
  }

  for (const verb of ['insert', 'update'] as const) {
    b[verb] = (values: unknown) => {
      write = { table, verb, values }
      writes.push(write)
      return b
    }
  }
  b.delete = () => {
    write = { table, verb: 'delete' }
    writes.push(write)
    return b
  }

  // oxlint-disable-next-line no-thenable
  b.then = (resolve: (v: unknown) => unknown) => {
    if (write && state.failWrites) {
      return Promise.resolve({ data: null, error: { message: 'nede' } }).then(resolve)
    }
    const rows = state.rows[table] ?? []
    // An insert asked for its own row answers with the row the database made,
    // serial id and all. That id is the only way a new meeting's attendance
    // rows can find the meeting, so a mock that returned the table's existing
    // rows here would let a broken chain pass.
    const data =
      write?.verb === 'insert' && oneRow
        ? { id: state.insertedId, ...(write.values as object) }
        : oneRow
          ? (rows[0] ?? null)
          : rows
    return Promise.resolve({ data, error: null }).then(resolve)
  }

  return b
}

export const client = { from: (table: string) => builder(table) }
