import { useAuth } from '../auth/AuthContext'
import { useNews, type NewsItem } from '../data/useClubData'
import { READONLY } from '../lib/supabase'
import { todayISO } from '../lib/dates'
import { DateRail } from '../components/DateRail'
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
 * `author` is on the card now, and that was the open question on this screen.
 *
 * The column is `not null` and every existing row carries a real name, so the
 * form has always written it — but nothing ever read it back, and the note that
 * stood here said what to do with it was "a design question for another day".
 * Lukas, 2026-07-29: *"de cards der er på møde og nyheder siderne er stadig
 * lidt kedelige."* The day arrived. A byline is material the card already had,
 * and it is the one line on it that says the club's news is written by somebody
 * in the club rather than published at it.
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
          <article key={n.id} data-reveal className="rounded-2xl border border-line bg-surface p-4">
            {/* The date left the top of the card and became its face. It was a
                10 px uppercase line above the headline — correct, and invisible
                at a thumb-scroll, which is what made eight of these read as one
                block of text. As a 26 px serif numeral in a rail it is the one
                thing that repeats at the same place on every card, so the page
                gets a beat to scroll down. See components/DateRail.tsx.

                Nothing on this card is tappable to a member, so nothing on it
                is the accent — the headline still leads by weight and by ink. */}
            <div className="flex gap-3">
              <DateRail iso={n.date} />
              <div className="min-w-0 flex-1">
                <h3 className="text-[0.95rem] leading-snug font-semibold">{n.title}</h3>
                <p className="mt-1.5 text-[0.8rem] leading-relaxed text-muted">{n.excerpt}</p>
                {/* The byline, in the newspaper's own shape: an em dash and a
                    name, under the text rather than over it. Set faint and
                    small because it is an attribution and not a headline — the
                    club writes in a dry, formal register and signs its notices,
                    and this is that signature and no more than it. Hidden when
                    the row has no author rather than printed as a bare dash;
                    RLS lets a legacy row be blank even though the column is
                    not, and "— " on its own is a card that failed to load. */}
                {n.author && (
                  <p className="mt-2 text-[0.62rem] leading-none text-faint">
                    <span aria-hidden="true">— </span>
                    <span className="sr-only">Skrevet af </span>
                    {n.author}
                  </p>
                )}
              </div>
            </div>

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
