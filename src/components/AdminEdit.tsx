import { useState } from 'react'
import { useDeleteRow, useSaveRow, type EditableTable } from '../data/useClubData'

/** One field of an admin form. One line unless it says otherwise. */
export type Field = {
  name: string
  label: string
  kind?: 'text' | 'date' | 'textarea'
  /** Shown under the label when the column's format is not obvious. */
  hint?: string
}

export type Draft = Record<string, string>

/* 48 px, the design system's touch floor, on every control here — these are
   tapped on a phone. bg-brand for the filled button and never bg-accent: white
   on the accent measures 3.2:1 on the dark ground and fails AA. */
const INPUT =
  'mt-1 block min-h-12 w-full rounded-lg border border-line bg-raised px-3 py-2 text-sm text-ink'
const FILLED =
  'inline-flex min-h-12 items-center justify-center rounded-lg bg-brand px-4 text-sm font-semibold text-white hover:bg-brand-hi disabled:opacity-50'
const QUIET =
  'inline-flex min-h-12 items-center justify-center rounded-lg border border-line px-4 text-sm text-muted hover:border-accent'
/* Outlined, not filled. --color-absent is a light coral on the dark ground and
   a brick red on the light one; white sits legibly on neither, and a button
   that destroys something is the last place to ship a contrast failure. */
const DANGER =
  'inline-flex min-h-12 items-center justify-center rounded-lg border border-absent px-4 text-sm font-semibold text-absent disabled:opacity-50'

/**
 * The form behind "Ny" and "Rediger", for both tables an admin may write.
 *
 * Every field holds its value in state from the first keystroke rather than
 * being read back when the form is submitted. That is the fines bug in the
 * shape it takes in a form: there, the minutes field committed only on Enter,
 * and on a phone tapping elsewhere is how the keyboard is dismissed — so the
 * ordinary way of finishing with a field was the way to throw it away, and the
 * club lost real money to it. Controlled from the first character, blur, Enter,
 * reaching straight for Gem and putting the phone down are all the same thing.
 */
export function EditForm({
  fields,
  draft,
  onChange,
  onSave,
  onCancel,
  saving,
  failed,
  canSave,
}: {
  fields: Field[]
  draft: Draft
  onChange: (next: Draft) => void
  onSave: () => void
  onCancel: () => void
  saving: boolean
  failed: boolean
  canSave: boolean
}) {
  return (
    <form
      className="flex flex-col gap-2 rounded-2xl border border-accent-d bg-surface p-3"
      onSubmit={(e) => {
        e.preventDefault()
        if (canSave && !saving) onSave()
      }}
    >
      {fields.map((f) => (
        <label key={f.name} className="block text-xs text-muted">
          {f.label}
          {f.hint && <span className="ml-1 text-faint">· {f.hint}</span>}
          {f.kind === 'textarea' ? (
            <textarea
              rows={3}
              className={INPUT}
              value={draft[f.name] ?? ''}
              onChange={(e) => onChange({ ...draft, [f.name]: e.target.value })}
            />
          ) : (
            <input
              type={f.kind ?? 'text'}
              className={INPUT}
              value={draft[f.name] ?? ''}
              onChange={(e) => onChange({ ...draft, [f.name]: e.target.value })}
            />
          )}
        </label>
      ))}

      <div className="mt-1 flex flex-wrap gap-2">
        <button type="submit" disabled={!canSave || saving} className={FILLED}>
          {saving ? 'Gemmer…' : 'Gem'}
        </button>
        <button type="button" onClick={onCancel} className={QUIET}>
          Annullér
        </button>
      </div>

      {failed && (
        <p role="alert" className="text-xs text-absent">
          Kunne ikke gemme. Prøv igen.
        </p>
      )}
    </form>
  )
}

/**
 * Delete, asked twice, with the name of the thing in the question.
 *
 * The club keeps one copy of everything and has no backup habit, so a deleted
 * news item is gone. The second tap therefore names what is about to go rather
 * than asking "er du sikker?", which is a question nobody reads — the point is
 * to be told *what* you are about to lose, not to be asked whether you meant
 * the tap you just made.
 */
export function DeleteConfirm({
  what,
  onDelete,
  pending,
  failed,
}: {
  what: string
  onDelete: () => void
  pending: boolean
  failed: boolean
}) {
  const [asking, setAsking] = useState(false)

  if (!asking) {
    return (
      <button type="button" className={QUIET} onClick={() => setAsking(true)}>
        Slet
      </button>
    )
  }

  return (
    <div className="flex flex-col gap-2">
      <p role="alert" className="text-xs text-absent">
        Slet “{what}”? Det kan ikke fortrydes.
      </p>
      <div className="flex flex-wrap gap-2">
        <button type="button" className={DANGER} disabled={pending} onClick={onDelete}>
          {pending ? 'Sletter…' : 'Slet endeligt'}
        </button>
        <button type="button" className={QUIET} onClick={() => setAsking(false)}>
          Fortryd
        </button>
      </div>
      {failed && (
        <p role="alert" className="text-xs text-absent">
          Kunne ikke slette. Prøv igen.
        </p>
      )}
    </div>
  )
}

/** The button that opens an empty form. Its label names the thing, not the verb. */
export function NewButton({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} className={`${FILLED} self-start`}>
      {label}
    </button>
  )
}

/** "Rediger", beside the row it opens. */
export function EditButton({ onClick }: { onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} className={QUIET}>
      Rediger
    </button>
  )
}

/**
 * Which row is open, and the two writes it can make.
 *
 * One value rather than a set of flags: "which row is being edited" and "are we
 * writing a new one" are the same question — the row is either an id or nothing
 * — and holding them apart is how a screen ends up with two forms open at once,
 * both aimed at the same record.
 *
 * Shared by news and events because the interaction is identical and the
 * *fields* are the only difference. Sharing the interaction is not a CMS; it is
 * refusing to write the same open/save/close three times and get it right twice.
 */
export function useEditor(table: EditableTable) {
  const [open, setOpen] = useState<{ id: string | null; draft: Draft } | null>(null)
  const save = useSaveRow(table)
  const remove = useDeleteRow(table)

  function start(id: string | null, draft: Draft) {
    // A failure from the previous row must not greet the next one: the message
    // belongs to the attempt, not to the form.
    save.reset()
    setOpen({ id, draft })
  }

  return {
    creating: open?.id === null,
    editing: (id: string) => open?.id === id,
    draft: open?.draft ?? {},
    create: (draft: Draft) => start(null, draft),
    edit: (id: string, draft: Draft) => start(id, draft),
    change: (draft: Draft) => setOpen((o) => (o ? { ...o, draft } : o)),
    close: () => setOpen(null),
    // The form closes only once the row is actually written. Closing on the tap
    // would show a saved-looking list built from a request that may still fail.
    save: () =>
      open && save.mutate({ id: open.id, values: open.draft }, { onSuccess: () => setOpen(null) }),
    saving: save.isPending,
    failed: save.isError,
    remove: (id: string) => remove.mutate(id),
    // Scoped to the row it belongs to: one mutation serves every row, so an
    // unscoped flag would put "Sletter…" on all of them at once.
    removing: (id: string) => remove.isPending && remove.variables === id,
    removeFailed: (id: string) => remove.isError && remove.variables === id,
  }
}

/** The blank a new row starts from — every field present, so none is undefined. */
export function blankDraft(fields: Field[], preset: Draft = {}): Draft {
  return { ...Object.fromEntries(fields.map((f) => [f.name, ''])), ...preset }
}
