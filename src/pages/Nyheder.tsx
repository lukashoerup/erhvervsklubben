import { useAuth } from '../auth/AuthContext'
import { useNews, type NewsItem } from '../data/useClubData'
import { READONLY } from '../lib/supabase'
import { daDate, todayISO } from '../lib/dates'
import { Loading, Problem } from '../components/State'
import {
  blankDraft,
  DeleteConfirm,
  EditButton,
  EditForm,
  NewButton,
  useEditor,
  type Draft,
  type Field,
} from '../components/AdminEdit'

/**
 * `author` is here even though no card shows it.
 *
 * The column is `not null` and every existing row carries a real name, so a
 * form that left it out would write an empty author onto every news item the
 * club creates from now on — a column quietly emptied by the screen meant to
 * fill it. What to do with it on the card is a design question for another day;
 * losing the data while that is decided is not.
 */
const FIELDS: Field[] = [
  { name: 'title', label: 'Overskrift' },
  { name: 'excerpt', label: 'Resumé', kind: 'textarea' },
  { name: 'author', label: 'Skrevet af' },
  { name: 'date', label: 'Dato', kind: 'date' },
]

const draftOf = (n: NewsItem): Draft => ({
  title: n.title,
  excerpt: n.excerpt,
  author: n.author,
  date: n.date,
})

/** A new item is dated today until the writer says otherwise. */
const blank = () => blankDraft(FIELDS, { date: todayISO() })

/** The one page Lukas said already worked — same shape, now writable by an admin. */
export default function Nyheder() {
  const { data, isPending, error } = useNews()
  const { role } = useAuth()
  const editor = useEditor('news')

  // Admin is Lukas and Claude, nobody else (PROJECT.md 2026-07-27) — and never
  // a read-only build, whose whole promise is that it cannot change the club's
  // records. RLS refuses a member's write regardless; this is what stops the
  // app offering a button that would only fail.
  const mayEdit = role === 'admin' && !READONLY

  if (isPending) return <Loading what="nyheder" />
  if (error) return <Problem />

  // The same form whether it is creating or correcting — one set of fields to
  // get right rather than two that drift.
  const form = (id: string | null) => (
    <EditForm
      key={id ?? 'ny'}
      fields={FIELDS}
      draft={editor.draft}
      onChange={editor.change}
      onSave={editor.save}
      onCancel={editor.close}
      saving={editor.saving}
      failed={editor.failed}
      // A news item without a headline is not a news item. Everything else can
      // be filled in later, and blocking on all four would make writing one
      // down at the table harder than not writing it.
      canSave={Boolean(editor.draft.title?.trim())}
    />
  )

  return (
    <div className="flex flex-col gap-3">
      {mayEdit &&
        (editor.creating ? (
          form(null)
        ) : (
          <NewButton label="Ny nyhed" onClick={() => editor.create(blank())} />
        ))}

      {data.length === 0 && <p className="text-sm text-muted">Ingen nyheder endnu.</p>}

      {data.map((n) =>
        mayEdit && editor.editing(n.id) ? (
          form(n.id)
        ) : (
          <article key={n.id} className="rounded-xl border border-line bg-surface p-3">
            <p className="tabular text-[0.6rem] tracking-[0.1em] text-accent uppercase">
              {daDate(n.date, { day: 'numeric', month: 'long' })}
            </p>
            <h3 className="mt-1 text-[0.95rem] leading-snug font-semibold">{n.title}</h3>
            <p className="mt-1 text-xs leading-relaxed text-muted">{n.excerpt}</p>

            {mayEdit && (
              <div className="mt-3 flex flex-wrap items-start gap-2">
                <EditButton onClick={() => editor.edit(n.id, draftOf(n))} />
                <DeleteConfirm
                  what={n.title}
                  onDelete={() => editor.remove(n.id)}
                  pending={editor.removing(n.id)}
                  failed={editor.removeFailed(n.id)}
                />
              </div>
            )}
          </article>
        ),
      )}
    </div>
  )
}
