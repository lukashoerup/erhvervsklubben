/**
 * A PostgREST client that records what the page tried to write.
 *
 * The read half is the same thenable builder the other suites use — every
 * filter returns itself and awaiting it resolves. The write half is the point:
 * these screens exist to change the club's only copy of its own records, so
 * "what payload, to which table, against which id" is the thing worth asserting,
 * and a mock that merely swallowed the call would prove nothing.
 */
export type Write = { table: string; verb: 'insert' | 'update' | 'delete'; values?: unknown; id?: string }

export const writes: Write[] = []
export const state: { rows: Record<string, unknown[]>; failWrites: boolean } = {
  rows: {},
  failWrites: false,
}

export function reset(rows: Record<string, unknown[]> = {}) {
  writes.length = 0
  state.rows = rows
  state.failWrites = false
}

function builder(table: string) {
  const b: Record<string, unknown> = {}
  let write: Write | null = null

  for (const m of ['select', 'gte', 'lte', 'order', 'limit']) b[m] = () => b

  // `.eq('id', …)` is how update and delete say which row. Recorded on the
  // pending write rather than ignored: a delete aimed at the wrong id is the
  // failure this whole mock exists to be able to catch.
  b.eq = (_column: string, value: string) => {
    if (write) write.id = value
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
  b.then = (resolve: (v: unknown) => unknown) =>
    Promise.resolve(
      write && state.failWrites
        ? { data: null, error: { message: 'nede' } }
        : { data: state.rows[table] ?? [], error: null },
    ).then(resolve)

  return b
}

export const client = { from: (table: string) => builder(table) }
