import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { AuthContext, type AuthState } from '../auth/AuthContext'
import { withQuery } from '../test/harness'
import { client, reset, state, writes } from '../test/writes'

/**
 * The news page, and the club's first screen that can change its own records.
 *
 * Everything here is offline: the client is mocked, and what the page *tried to
 * write* is what gets asserted. The database's own guard is RLS, proven
 * separately in tests/rls — these tests are about the app not offering a member
 * a button that could only fail, and not losing what an admin typed.
 */
vi.mock('../lib/supabase', () => ({ READONLY: false, supabase: () => client }))

const { default: Nyheder } = await import('./Nyheder')

const NEWS = [
  {
    id: 'n1',
    title: 'Sommerfest 2026',
    // Two paragraphs, because that is how the club actually writes. Every item it
    // has published since 2025 has them, and until 2026-08-08 this page rendered
    // them as one block — HTML collapses newlines unless told not to.
    excerpt: 'Vi holder den hos Saaby igen i år.\n\nTilmelding senest den 1. august.',
    author: 'Mathias Saaby',
    date: '2026-06-09',
  },
  {
    id: 'n2',
    title: 'Kontingentet er fordoblet',
    excerpt: 'Vedtaget på generalforsamlingen.',
    author: 'Lukas Hørup Eskildsen',
    date: '2026-04-20',
  },
]

function renderPage(role: AuthState['role']) {
  const value: AuthState = {
    userId: 'u1',
    role,
    loading: false,
    signIn: async () => ({ error: null }),
    signOut: async () => {},
  }
  return render(
    withQuery(
      <AuthContext.Provider value={value}>
        <Nyheder />
      </AuthContext.Provider>,
    ),
  )
}

/** The article that carries a given headline, controls and all. */
const cardFor = (title: string) => screen.getByText(title).closest('article')!

beforeEach(() => reset({ news: NEWS }))

describe('how an item reads', () => {
  it('keeps the paragraphs the club wrote', async () => {
    // Found on 2026-08-08, reading the club's own general assembly referat: the
    // news column has carried structure since 2025 and all three places that
    // render one were throwing it away. Six paragraphs of minutes as a single
    // block is not a styling nitpick — it is unreadable.
    renderPage('user')
    await screen.findByText(/Sommerfest/)
    const body = screen.getByText(/Tilmelding senest/)
    expect(body).toHaveClass('whitespace-pre-line')
    expect(body.textContent).toContain('\n\n')
  })
})

describe('who is offered the controls', () => {
  // Reversed 2026-08-08: "alle kan skrive nyheder, men skal godkendes af
  // bestyrelsen." A member may now write — what he may not do is publish, and that
  // is asserted below rather than here.
  it('lets an ordinary member write, but touch nothing already published', async () => {
    renderPage('user')
    expect(await screen.findByText('Sommerfest 2026')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Ny nyhed' })).toBeInTheDocument()
    // The published items are the club's, not his: no edit, no delete, no approve.
    expect(screen.queryByRole('button', { name: 'Rediger' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Slet' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Godkend' })).not.toBeInTheDocument()
  })

  it('shows the admin all three', async () => {
    renderPage('admin')
    expect(await screen.findByRole('button', { name: 'Ny nyhed' })).toBeInTheDocument()
    expect(screen.getAllByRole('button', { name: 'Rediger' })).toHaveLength(2)
    expect(screen.getAllByRole('button', { name: 'Slet' })).toHaveLength(2)
  })

  it('gives the buttons a thumb to be hit with', async () => {
    renderPage('admin')
    const ny = await screen.findByRole('button', { name: 'Ny nyhed' })
    // The design system's own floor. These are tapped on a phone; nothing in
    // jsdom has a size, so the class is what there is to read.
    expect(ny.className).toContain('min-h-12')
    expect(ny.className).toContain('bg-brand')
    // White on --color-accent measures 3.2:1 on the dark ground and fails AA.
    expect(ny.className).not.toContain('bg-accent')
  })
})

describe('writing a news item', () => {
  it('creates one from what was typed', async () => {
    const user = userEvent.setup()
    renderPage('admin')
    await user.click(await screen.findByRole('button', { name: 'Ny nyhed' }))

    await user.type(screen.getByLabelText('Overskrift'), 'Møde 29 afholdt')
    await user.type(screen.getByLabelText('Resumé'), 'Otte af ti mødte frem.')
    await user.type(screen.getByLabelText('Skrevet af'), 'Lukas')
    fireEvent.change(screen.getByLabelText('Dato'), { target: { value: '2026-08-01' } })
    await user.click(screen.getByRole('button', { name: 'Gem' }))

    await waitFor(() => expect(writes).toHaveLength(1))
    expect(writes[0]).toMatchObject({
      table: 'news',
      verb: 'insert',
      values: {
        title: 'Møde 29 afholdt',
        excerpt: 'Otte af ti mødte frem.',
        author: 'Lukas',
        date: '2026-08-01',
      },
    })
  })

  it('keeps what was typed when the keyboard is dismissed', async () => {
    // The bug that cost the club real money on the fines screen this morning:
    // a field that commits only on Enter loses everything when the writer taps
    // away — and tapping away is exactly how a phone keyboard is dismissed.
    // So leave every field by a route that is not Enter, and the text must
    // still be there when Gem is finally reached.
    const user = userEvent.setup()
    renderPage('admin')
    await user.click(await screen.findByRole('button', { name: 'Ny nyhed' }))

    await user.type(screen.getByLabelText('Overskrift'), 'Generalforsamling 2027')
    await user.tab()
    await user.type(screen.getByLabelText('Resumé'), 'Indkaldelse følger.')
    // One tap on Gem, not two. On the fines screen the first tap only took the
    // focus off the field; nothing here is waiting to be committed.
    await user.click(screen.getByRole('button', { name: 'Gem' }))

    await waitFor(() => expect(writes).toHaveLength(1))
    expect(writes[0].values).toMatchObject({
      title: 'Generalforsamling 2027',
      excerpt: 'Indkaldelse følger.',
    })
  })

  it('dates a new item today, so nobody has to type it', async () => {
    const user = userEvent.setup()
    renderPage('admin')
    await user.click(await screen.findByRole('button', { name: 'Ny nyhed' }))
    expect(screen.getByLabelText('Dato')).toHaveValue(new Date().toISOString().slice(0, 10))
  })

  it('refuses to save a news item with no headline', async () => {
    const user = userEvent.setup()
    renderPage('admin')
    await user.click(await screen.findByRole('button', { name: 'Ny nyhed' }))

    // Every column is `not null` with no other constraint, so the database
    // would happily store a row with no title at all. It is a row nobody can
    // read, and the refusal belongs where it can be seen.
    expect(screen.getByRole('button', { name: 'Gem' })).toBeDisabled()
    await user.type(screen.getByLabelText('Overskrift'), 'Noget')
    expect(screen.getByRole('button', { name: 'Gem' })).toBeEnabled()
  })

  it('corrects an existing one in place, against its own id', async () => {
    const user = userEvent.setup()
    renderPage('admin')
    await screen.findByText('Sommerfest 2026')
    await user.click(within(cardFor('Sommerfest 2026')).getByRole('button', { name: 'Rediger' }))

    const title = screen.getByLabelText('Overskrift')
    expect(title).toHaveValue('Sommerfest 2026')
    await user.clear(title)
    await user.type(title, 'Sommerfest 2026 — flyttet')
    await user.click(screen.getByRole('button', { name: 'Gem' }))

    await waitFor(() => expect(writes).toHaveLength(1))
    expect(writes[0]).toMatchObject({
      table: 'news',
      verb: 'update',
      id: 'n1',
      values: { title: 'Sommerfest 2026 — flyttet', author: 'Mathias Saaby' },
    })
  })

  it('says so when the save fails, and keeps the form open', async () => {
    const user = userEvent.setup()
    renderPage('admin')
    state.failWrites = true
    await user.click(await screen.findByRole('button', { name: 'Ny nyhed' }))
    await user.type(screen.getByLabelText('Overskrift'), 'Noget')
    await user.click(screen.getByRole('button', { name: 'Gem' }))

    expect(await screen.findByRole('alert')).toHaveTextContent('Kunne ikke gemme')
    // Still there to try again from, with the text still in it — a form that
    // closed on a failed write would throw the writing away twice over.
    expect(screen.getByLabelText('Overskrift')).toHaveValue('Noget')
  })

  it('leaves the record alone when the writer changes their mind', async () => {
    const user = userEvent.setup()
    renderPage('admin')
    await screen.findByText('Sommerfest 2026')
    await user.click(within(cardFor('Sommerfest 2026')).getByRole('button', { name: 'Rediger' }))
    await user.click(screen.getByRole('button', { name: 'Annullér' }))

    expect(writes).toHaveLength(0)
    expect(screen.getByText('Sommerfest 2026')).toBeInTheDocument()
  })
})

describe('deleting a news item', () => {
  it('asks first, and names what is about to go', async () => {
    const user = userEvent.setup()
    renderPage('admin')
    await screen.findByText('Sommerfest 2026')
    await user.click(within(cardFor('Sommerfest 2026')).getByRole('button', { name: 'Slet' }))

    // The club keeps one copy and has no backup habit. "Er du sikker?" is a
    // question nobody reads; the name of the thing is what makes it a question.
    expect(screen.getByRole('alert')).toHaveTextContent(
      'Slet “Sommerfest 2026”? Det kan ikke fortrydes.',
    )
    expect(writes).toHaveLength(0)
  })

  /**
   * The card's face, T073. `author` was written by the form and read by
   * nothing — the note in Nyheder.tsx called it "a design question for another
   * day" — and the date was a 10 px line above the headline that vanished at a
   * thumb-scroll. Both are asserted because both are content: a byline the page
   * stops printing is the club's own attribution going quietly missing.
   */
  it('signs each item with the member who wrote it', async () => {
    renderPage('user')
    await screen.findByText('Sommerfest 2026')

    expect(within(cardFor('Sommerfest 2026')).getByText('Mathias Saaby')).toBeInTheDocument()
    expect(
      within(cardFor('Kontingentet er fordoblet')).getByText('Lukas Hørup Eskildsen'),
    ).toBeInTheDocument()
  })

  it('leads the card with its date, day over month', async () => {
    renderPage('user')
    await screen.findByText('Sommerfest 2026')
    const card = within(cardFor('Sommerfest 2026'))

    // 9. juni 2026 — the day as the figure, the month as its label. No year:
    // it is the year the reader is standing in, or it would be there.
    expect(card.getByText('9')).toBeInTheDocument()
    expect(card.getByText('jun')).toBeInTheDocument()
  })

  it('does nothing at all if the second tap is Fortryd', async () => {
    const user = userEvent.setup()
    renderPage('admin')
    await screen.findByText('Sommerfest 2026')
    await user.click(within(cardFor('Sommerfest 2026')).getByRole('button', { name: 'Slet' }))
    await user.click(screen.getByRole('button', { name: 'Fortryd' }))

    expect(writes).toHaveLength(0)
    expect(screen.getByText('Sommerfest 2026')).toBeInTheDocument()
  })

  it('deletes the row it asked about, and only that one', async () => {
    const user = userEvent.setup()
    renderPage('admin')
    await screen.findByText('Kontingentet er fordoblet')
    await user.click(
      within(cardFor('Kontingentet er fordoblet')).getByRole('button', { name: 'Slet' }),
    )
    await user.click(screen.getByRole('button', { name: 'Slet endeligt' }))

    await waitFor(() => expect(writes).toHaveLength(1))
    expect(writes[0]).toMatchObject({ table: 'news', verb: 'delete', id: 'n2' })
  })
})

/**
 * Drafts and approval, 2026-08-08: *"alle kan skrive nyheder, men skal godkendes af
 * bestyrelsen."*
 *
 * The screen's job is to be honest about a rule the database enforces on its own. A
 * member's INSERT policy requires `author_id = auth.uid() and status = 'kladde'`, so
 * the assertions worth having are that the page **sends** those two — get either
 * wrong and every member's first news item is rejected by the server with nothing on
 * screen to explain it.
 */
describe('writing a news item and getting it approved', () => {
  const WITH_DRAFT = [
    ...NEWS,
    {
      id: 'd1',
      title: 'Forslag til vinsmagning',
      excerpt: 'Kunne vi lave en aften hos Emil?',
      author: 'Emil',
      date: '2026-08-08',
      status: 'kladde',
      author_id: 'u1',
    },
  ]

  it('sends the two values the database insists on', async () => {
    const user = userEvent.setup()
    renderPage('user')
    await user.click(await screen.findByRole('button', { name: 'Ny nyhed' }))
    await user.type(screen.getByLabelText(/Overskrift/), 'Forslag til vinsmagning')
    await user.type(screen.getByLabelText(/Skrevet af/), 'Emil')
    await user.click(screen.getByRole('button', { name: 'Gem' }))

    await waitFor(() => expect(writes).toHaveLength(1))
    // Not the writer's to choose, so they are seeded rather than rendered as
    // fields — and the row is refused outright if either is wrong.
    expect(writes[0]).toMatchObject({
      table: 'news',
      verb: 'insert',
      values: { status: 'kladde', author_id: 'u1', title: 'Forslag til vinsmagning' },
    })
  })

  it('tells the writer his item is not out yet', async () => {
    reset({ news: WITH_DRAFT })
    renderPage('user')
    // The border marks it and this says it: a member who wrote something and sees
    // it on the page will otherwise assume the club has read it.
    expect(await screen.findByText(/afventer godkendelse/i)).toBeInTheDocument()
  })

  it('offers the board an approve button, and the member none', async () => {
    reset({ news: WITH_DRAFT })
    renderPage('user')
    await screen.findByText('Forslag til vinsmagning')
    expect(screen.queryByRole('button', { name: 'Godkend' })).not.toBeInTheDocument()

    reset({ news: WITH_DRAFT })
    renderPage('admin')
    expect(await screen.findByRole('button', { name: 'Godkend' })).toBeInTheDocument()
  })

  it('publishes on approval, and records who did it', async () => {
    const user = userEvent.setup()
    reset({ news: WITH_DRAFT })
    renderPage('admin')
    await user.click(await screen.findByRole('button', { name: 'Godkend' }))

    await waitFor(() => expect(writes).toHaveLength(1))
    expect(writes[0]).toMatchObject({
      table: 'news',
      verb: 'update',
      id: 'd1',
      values: { status: 'godkendt', approved_by: 'u1' },
    })
    // "Godkendes af bestyrelsen" is a club rule, so who approved is worth keeping.
    expect((writes[0].values as Record<string, string>).approved_at).toBeTruthy()
  })

  it('lets a member fix his own draft and not anyone else’s', async () => {
    reset({
      news: [
        ...WITH_DRAFT,
        {
          id: 'd2',
          title: 'Andens kladde',
          excerpt: '…',
          author: 'Mads',
          date: '2026-08-08',
          status: 'kladde',
          author_id: 'u-somebody-else',
        },
      ],
    })
    renderPage('user')
    await screen.findByText('Forslag til vinsmagning')
    // One Rediger, on his own. The other draft would not reach him through RLS at
    // all; the page must not offer a control for it even if a row arrives.
    expect(screen.getAllByRole('button', { name: 'Rediger' })).toHaveLength(1)
    const mine = screen.getByText('Forslag til vinsmagning').closest('article')!
    expect(within(mine).getByRole('button', { name: 'Rediger' })).toBeInTheDocument()
  })
})
