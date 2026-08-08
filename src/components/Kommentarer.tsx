import { useState } from 'react'
import {
  useComments,
  useDeleteComment,
  useMemberNames,
  useSaveComment,
  type Comment,
} from '../data/comments'
import { daWhen } from '../lib/dates'
import { DeleteConfirm, FILLED } from './AdminEdit'

/**
 * The thread under a news item.
 *
 * Lukas's wishlist, 2026-08-08: *"Kan kommenterer på nyheder."* Then: *"Næste er at
 * man skal lave kommentarer. Det skal vi bygge nu."*
 *
 * **Open, not folded**, and that is the one layout decision worth arguing. "Sidst
 * set" on `/anciennitet` is a fold because it is a fact you go and look up; a
 * comment is somebody talking to the club, and a conversation nobody sees is a
 * conversation nobody joins. So a thread that exists is drawn, and the box to add
 * to it is under it — one tap from reading to writing.
 *
 * **Only under published items.** The database refuses a comment on a draft (see the
 * migration: an editorial note would become the whole club's the moment the board
 * approved the item, with nothing having warned anyone), so the caller does not
 * render this there. The rule lives in the policy; this is the screen agreeing with
 * it rather than enforcing it.
 *
 * **Written once. Nobody edits a comment** — not its author, not the board. Lukas,
 * 2026-08-08: *"Admins må slette kommentarer. Men man behøver ikke at kunne rette i
 * egne kommentarer."* There is no UPDATE policy on the table for a button here to
 * reach; a member who mistypes withdraws his comment and writes it again.
 *
 * What survives is one asymmetry, and it is the interesting one: **an admin may
 * delete another member's comment.** A deletion is visible to everyone as an
 * absence, which is what makes it the only safe form of moderation — an edit would
 * leave a member's name on words he did not write, with no history to show it.
 */
export function Kommentarer({
  newsId,
  userId,
  isAdmin,
  mayWrite,
}: {
  newsId: string
  /** Null when signed out, which on this page cannot happen — but the type says so. */
  userId: string | null
  /** The board. May remove any comment; nobody may change one. */
  isAdmin: boolean
  /** False in a read-only build, whose promise is that it changes nothing. */
  mayWrite: boolean
}) {
  const { data, isPending } = useComments()
  const names = useMemberNames()
  const save = useSaveComment()
  const remove = useDeleteComment()
  const [text, setText] = useState('')

  // No spinner and no error box. A thread is an addition to a card that is already
  // readable, and "henter kommentarer…" under every news item on the page is eight
  // lines of noise for something usually empty.
  if (isPending) return null

  const thread = data?.[newsId] ?? []
  const mine = (c: Comment) => mayWrite && c.author_id === userId
  const nameOf = (id: string) => names.data?.[id] ?? 'Et medlem'

  const submit = () => {
    if (!text.trim() || !userId) return
    save.mutate(
      { news_id: newsId, author_id: userId, body: text },
      // Cleared only once the row is actually written. Clearing on the tap would
      // empty the box on a request that may fail, and the words would be gone.
      { onSuccess: () => setText('') },
    )
  }

  return (
    <section className="mt-3 border-t border-line pt-3">
      {thread.length > 0 && (
        <ul aria-label="Kommentarer" className="flex flex-col gap-3">
          {thread.map((c) => (
            <li key={c.id} className="text-[0.8rem] leading-relaxed">
              <p className="flex items-baseline gap-2 text-[0.62rem] leading-none text-faint">
                <span className="font-semibold text-muted">{nameOf(c.author_id)}</span>
                <span className="tabular">{daWhen(c.created_at)}</span>
              </p>
              {/* `whitespace-pre-line`: the club writes in paragraphs and a textarea
                  keeps the newlines. Collapsing them would turn two thoughts into
                  one sentence. */}
              <p className="mt-1 whitespace-pre-line text-muted">{c.body}</p>

              {/* Withdraw your own; the board removes any. There is no third
                  control, and that is the design rather than an omission. */}
              {(mine(c) || (isAdmin && mayWrite)) && (
                <div className="mt-1.5">
                  <DeleteConfirm
                    what={`${nameOf(c.author_id)}s kommentar`}
                    onDelete={() => remove.mutate(c.id)}
                    pending={remove.isPending}
                    failed={remove.isError}
                  />
                </div>
              )}
            </li>
          ))}
        </ul>
      )}

      {mayWrite && (
        <div className={`flex flex-col gap-2 ${thread.length > 0 ? 'mt-3' : ''}`}>
          <label className="text-xs text-muted">
            <span className="sr-only">Skriv en kommentar</span>
            <textarea
              rows={2}
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder="Skriv en kommentar…"
              aria-label="Skriv en kommentar"
              className="block w-full rounded-btn border border-line bg-raised px-3 py-2 text-sm leading-relaxed text-ink"
            />
          </label>
          <div>
            <button
              type="button"
              className={FILLED}
              disabled={!text.trim() || save.isPending}
              onClick={submit}
            >
              {save.isPending ? 'Sender…' : 'Send'}
            </button>
          </div>
          {save.isError && (
            <p role="alert" className="text-xs text-absent">
              Kunne ikke sende. Prøv igen.
            </p>
          )}
        </div>
      )}
    </section>
  )
}
