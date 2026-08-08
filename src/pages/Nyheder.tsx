import { useAuth } from '../auth/AuthContext'
import { useNews, useSaveRow, type NewsItem } from '../data/useClubData'
import { READONLY } from '../lib/supabase'
import { todayISO } from '../lib/dates'
import { DateRail } from '../components/DateRail'
import { Kommentarer } from '../components/Kommentarer'
import { Loading, Problem } from '../components/State'
import {
  blankDraft,
  FILLED,
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

/**
 * A new item is dated today until the writer says otherwise, and it starts as a
 * draft owned by whoever is typing.
 *
 * `status` and `author_id` are seeded into the draft rather than rendered as fields:
 * they are not the writer's to choose. They ride along to `useSaveRow` because
 * `blankDraft` keeps whatever the seed carries, and the database refuses the row
 * outright if they are wrong — a member's INSERT policy requires exactly
 * `author_id = auth.uid() and status = 'kladde'`, so this is the client agreeing
 * with the rule rather than enforcing it.
 *
 * An admin gets the same draft and the same two values. That is deliberate: the
 * board writing an item and then approving it is two acts, and collapsing them for
 * the three men who can do both would mean the queue never shows what they wrote.
 */
const blank = (userId: string) =>
  blankDraft(FIELDS, { date: todayISO(), status: 'kladde', author_id: userId })

/** The one page Lukas said already worked — same shape, now writable by an admin. */
export default function Nyheder() {
  const { data, isPending, error } = useNews()
  const { role, userId } = useAuth()
  const editor = useEditor('news')
  const approve = useSaveRow('news')

  // **Anyone signed in may write; only the board publishes.** Lukas, 2026-08-08:
  // "alle kan skrive nyheder, men skal godkendes af bestyrelsen." The board is the
  // three admins — the app has two roles and no board, and inventing a third would
  // be a bigger change than the feature; if the club wants the formand in that set
  // it is one row in `profiles`. See the migration.
  //
  // Never in a read-only build, whose whole promise is that it cannot change the
  // club's records. RLS refuses regardless; this is what stops the app offering a
  // button that would only fail.
  const mayWrite = Boolean(userId) && !READONLY
  const isBoard = role === 'admin' && !READONLY

  /** His own, still a draft — the only rows a member may change. Mirrors the policy. */
  const mayEditItem = (n: NewsItem) =>
    isBoard || (mayWrite && n.status === 'kladde' && n.author_id === userId)

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
      {mayWrite &&
        (editor.creating ? (
          form(null)
        ) : (
          <NewButton label="Ny nyhed" onClick={() => editor.create(blank(userId!))} />
        ))}

      {data.length === 0 && <p className="text-sm text-muted">Ingen nyheder endnu.</p>}

      {data.map((n) =>
        mayEditItem(n) && editor.editing(n.id) ? (
          form(n.id)
        ) : (
          <article
            key={n.id}
            data-reveal
            /* A draft is marked by border weight, the way the design system marks
               every live row — never by a fill or a badge colour. It is the same
               1.5 px the next meeting gets on /anciennitet. */
            className={`rounded-2xl border bg-surface p-4 ${
              n.status === 'kladde' ? 'border-[1.5px] border-accent' : 'border-line'
            }`}
          >
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

            {n.status === 'kladde' && (
              /* Said on the card rather than left to the border, because the border
                 is a mark and this is a fact: the item is written and nobody outside
                 this page can see it yet. Whose draft it is matters to the reader —
                 the board sees everyone's here, a member only his own. */
              <p className="mt-3 text-[0.68rem] leading-relaxed text-accent">
                Kladde — afventer godkendelse. Den er ikke synlig for klubben endnu.
              </p>
            )}

            {/* The thread, on published items only — the database refuses a comment
                on a draft, so offering a box there would be a form that can only
                fail. Under the card's own controls in reading order: the item, then
                what the club said about it, then what you may do to it. */}
            {n.status === 'godkendt' && (
              <Kommentarer
                newsId={n.id}
                userId={userId}
                isAdmin={isBoard}
                mayWrite={mayWrite}
              />
            )}

            {(mayEditItem(n) || (isBoard && n.status === 'kladde')) && (
              <div className="mt-3 flex flex-wrap items-start gap-2">
                {isBoard && n.status === 'kladde' && (
                  <button
                    type="button"
                    onClick={() =>
                      approve.mutate({
                        id: n.id,
                        values: {
                          status: 'godkendt',
                          approved_by: userId!,
                          approved_at: new Date().toISOString(),
                        },
                      })
                    }
                    disabled={approve.isPending}
                    className={FILLED}
                  >
                    {approve.isPending ? 'Godkender…' : 'Godkend'}
                  </button>
                )}
                {mayEditItem(n) && (
                  <>
                    <EditButton onClick={() => editor.edit(n.id, draftOf(n))} />
                    <DeleteConfirm
                      what={n.title}
                      onDelete={() => editor.remove(n.id)}
                      pending={editor.removing(n.id)}
                      failed={editor.removeFailed(n.id)}
                    />
                  </>
                )}
              </div>
            )}
          </article>
        ),
      )}
    </div>
  )
}
