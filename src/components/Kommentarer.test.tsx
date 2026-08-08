import { beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { withQuery } from '../test/harness'
import { client, reset, state, writes } from '../test/writes'

/**
 * Comments on the news — the first thing in this app a member writes for the other
 * members to read (Lukas's wishlist, 2026-08-08).
 *
 * The assertions that matter are about *who may do what to whose words*. RLS is the
 * real lock and it is tested against a live database in tests/rls; what is tested
 * here is the screen agreeing with it, because a button that only ever fails is its
 * own kind of defect.
 *
 * Two rules, both easy to lose in a refactor. **Nobody edits a comment** — Lukas,
 * 2026-08-08, and there is no UPDATE policy for a button to reach. **An admin may
 * delete another member's** — a deletion is visible as an absence, which is what
 * makes it the only safe form of moderation.
 */
vi.mock('../lib/supabase', () => ({ READONLY: false, supabase: () => client }))

const { Kommentarer } = await import('./Kommentarer')

const COMMENTS = [
  {
    id: 'c1',
    news_id: 'n1',
    author_id: 'u-2',
    body: 'Kommer der en tilmeldingsliste?',
    created_at: '2026-08-01T18:20:00Z',
  },
  {
    id: 'c2',
    news_id: 'n1',
    author_id: 'u-1',
    body: 'Ja — den kommer i næste uge.',
    created_at: '2026-08-01T19:05:00Z',
  },
  // Another item's thread. It must not appear under n1.
  {
    id: 'c3',
    news_id: 'n2',
    author_id: 'u-1',
    body: 'Hører ikke til her.',
    created_at: '2026-08-02T09:00:00Z',
  },
]

const MAPPING = [
  { user_id: 'u-1', member_name: 'Lukas' },
  { user_id: 'u-2', member_name: 'Saaby' },
]

beforeEach(() => reset({ news_comments: COMMENTS, user_member_mapping: MAPPING }))

const show = (props: Partial<Parameters<typeof Kommentarer>[0]> = {}) =>
  render(
    withQuery(
      <Kommentarer newsId="n1" userId="u-1" isAdmin={false} mayWrite={true} {...props} />,
    ),
  )

const thread = () => within(screen.getByRole('list', { name: 'Kommentarer' }))

describe('a thread under a news item', () => {
  it('shows this item’s comments and nobody else’s', async () => {
    show()
    await waitFor(() => expect(screen.getByText(/tilmeldingsliste/)).toBeInTheDocument())
    expect(screen.queryByText('Hører ikke til her.')).not.toBeInTheDocument()
  })

  it('names the writer from the club’s own mapping', async () => {
    // The name is not stored on the comment — a text column would freeze the name
    // at the moment of writing, which is the bug `news.author` already has.
    show()
    await waitFor(() => expect(screen.getByText('Saaby')).toBeInTheDocument())
    expect(screen.getByText('Lukas')).toBeInTheDocument()
  })

  it('keeps the newlines a member typed', async () => {
    show()
    await waitFor(() => expect(screen.getByText(/tilmeldingsliste/)).toBeInTheDocument())
    // Two thoughts run together into one sentence is a rendering bug that looks
    // like a writing style.
    const body = screen.getByText(/tilmeldingsliste/)
    expect(body).toHaveClass('whitespace-pre-line')
  })
})

describe('who may change whose words', () => {
  it('lets a member withdraw his own, and touch nobody else’s', async () => {
    show({ userId: 'u-1', isAdmin: false })
    await waitFor(() => expect(screen.getByText('Saaby')).toBeInTheDocument())

    const items = thread().getAllByRole('listitem')
    // Saaby's, first in the thread: no controls at all for an ordinary member.
    expect(within(items[0]).queryByRole('button', { name: 'Slet' })).not.toBeInTheDocument()
    // His own, second.
    expect(within(items[1]).getByRole('button', { name: 'Slet' })).toBeInTheDocument()
  })

  it('offers nobody a way to change a comment — not even his own', async () => {
    // Lukas, 2026-08-08: *"man behøver ikke at kunne rette i egne kommentarer."*
    // Asserted for both roles, because the button that would come back in a
    // refactor is the one on your own row.
    for (const isAdmin of [false, true]) {
      const view = show({ userId: 'u-1', isAdmin })
      await waitFor(() => expect(view.getAllByText('Saaby').length).toBeGreaterThan(0))
      expect(view.queryAllByRole('button', { name: 'Ret' })).toHaveLength(0)
      expect(view.queryAllByRole('textbox', { name: 'Ret kommentar' })).toHaveLength(0)
      view.unmount()
    }
  })

  it('lets the board delete another member’s comment', async () => {
    // **The one asymmetry left, and the reason for it.** A deleted comment is
    // visible to everyone as an absence; an edit would leave a member's name on
    // words he did not write, and this app has no history that would show it.
    show({ userId: 'u-1', isAdmin: true })
    await waitFor(() => expect(screen.getByText('Saaby')).toBeInTheDocument())
    expect(
      within(thread().getAllByRole('listitem')[0]).getByRole('button', { name: 'Slet' }),
    ).toBeInTheDocument()
  })

  it('asks before deleting, and names whose comment it asked about', async () => {
    const user = userEvent.setup()
    show({ userId: 'u-1', isAdmin: true })
    await waitFor(() => expect(screen.getByText('Saaby')).toBeInTheDocument())

    await user.click(within(thread().getAllByRole('listitem')[0]).getByRole('button', { name: 'Slet' }))
    expect(screen.getByRole('alert')).toHaveTextContent('Saabys kommentar')
    expect(writes).toHaveLength(0)

    await user.click(screen.getByRole('button', { name: 'Slet endeligt' }))
    await waitFor(() => expect(writes).toHaveLength(1))
    expect(writes[0]).toMatchObject({ table: 'news_comments', verb: 'delete', id: 'c1' })
  })
})

describe('writing one', () => {
  it('files it under this item, in the writer’s own name', async () => {
    const user = userEvent.setup()
    show({ userId: 'u-1' })
    await waitFor(() => expect(screen.getByText('Saaby')).toBeInTheDocument())

    await user.type(screen.getByLabelText('Skriv en kommentar'), '  Enig.  ')
    await user.click(screen.getByRole('button', { name: 'Send' }))

    await waitFor(() => expect(writes).toHaveLength(1))
    // Trimmed: the database refuses a body of spaces outright, and a comment with
    // a trailing newline from the textarea is the same comment.
    expect(writes[0]).toMatchObject({
      table: 'news_comments',
      verb: 'insert',
      values: { news_id: 'n1', author_id: 'u-1', body: 'Enig.' },
    })
  })

  it('will not send an empty one', async () => {
    show({ userId: 'u-1' })
    await waitFor(() => expect(screen.getByText('Saaby')).toBeInTheDocument())
    expect(screen.getByRole('button', { name: 'Send' })).toBeDisabled()
  })

  it('never sends an update, whatever the thread contains', async () => {
    // The screen's half of "written once". The policy is the real lock — there is
    // no UPDATE policy on the table — and this is the assertion that the app does
    // not ask for something it would be refused.
    const user = userEvent.setup()
    show({ userId: 'u-1', isAdmin: true })
    await waitFor(() => expect(screen.getByText('Saaby')).toBeInTheDocument())

    await user.type(screen.getByLabelText('Skriv en kommentar'), 'Noget nyt.')
    await user.click(screen.getByRole('button', { name: 'Send' }))

    await waitFor(() => expect(writes).toHaveLength(1))
    expect(writes.every((w) => w.verb !== 'update')).toBe(true)
  })

  it('keeps the box open when the save fails, so nothing typed is lost', async () => {
    const user = userEvent.setup()
    state.failWrites = true
    show({ userId: 'u-1' })
    await waitFor(() => expect(screen.getByText('Saaby')).toBeInTheDocument())

    await user.type(screen.getByLabelText('Skriv en kommentar'), 'Enig.')
    await user.click(screen.getByRole('button', { name: 'Send' }))

    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent(/kunne ikke sende/i))
    expect(screen.getByLabelText('Skriv en kommentar')).toHaveValue('Enig.')
  })

  it('offers a read-only build nothing that writes', async () => {
    // The build made for showing the app off. Its whole promise is that it cannot
    // change the club's records, and a comment box that always failed would break
    // that promise in the most visible place on the page.
    show({ mayWrite: false })
    await waitFor(() => expect(screen.getByText('Saaby')).toBeInTheDocument())
    expect(screen.queryByLabelText('Skriv en kommentar')).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Slet' })).not.toBeInTheDocument()
  })
})
