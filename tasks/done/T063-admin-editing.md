# Task: T063 admin editing of news and events (phase 6)

## Lukas's requirement (2026-07-27)
> "Admin is currently only me (and Claude), and these can add and edit news,
> events, and the anciennitet events. That's it. Very simple."

News and events in this task. The database has permitted it since the initial
migration — `news` and `events` are anon-readable and admin-writable — and the
write lock came off the same afternoon. The UI was the only thing missing.

## What was built
- `src/components/AdminEdit.tsx` — the form, the two-step delete, the "new"
  button and the open-row state, shared by both tables. The *interaction* is
  shared; the fields and the copy stay on the pages.
- `src/data/useClubData.ts` — `useEvents()` (the whole calendar, held meetings
  included) plus `useSaveRow` / `useDeleteRow`.
- `src/pages/Nyheder.tsx` — create, edit and delete a news item in place.
- `src/pages/Moeder.tsx` — **new page, new member route `/moeder`**: planned and
  held meetings, with the same three controls for an admin.
- `src/lib/dates.ts` — the UTC date formatter the meeting card already had,
  extracted so four pages stop parsing plain dates in the reader's own zone.
- `src/data/demo.ts` — the demo build's writes, applied to its own arrays. Found
  while driving the build in a browser: `build:demo` is a production build with
  VITE_DEMO=1 on top, so it carries the club's real Supabase URL and anon key,
  and a save would have sent the live project a request. RLS would have refused
  it — the demo holds no session — but "refused" is a weaker promise than "never
  sent". `demoWrites.test.tsx` asserts the client is never asked, and the
  browser run confirms zero offsite requests.
- 35 new tests across `Nyheder.test.tsx`, `Moeder.test.tsx`,
  `AdminEdit.readonly.test.tsx`, `demoWrites.test.tsx`, `dates.test.ts` and the
  route table. Offline: the client is mocked and what the page *tried to write*
  is what is asserted.

No migration. No new dependency. No SQL of any kind.

## Decisions
- **The controls live on the members' pages, not behind an admin route.** Same
  shape as the treasurer's tools on `/oekonomi`: `const { role } = useAuth()`,
  `role === 'admin'`, and the write-shaped UI is simply not rendered otherwise
  (nor in a READONLY build). A member sees the news and the calendar exactly as
  before and is never offered a button that could only fail.
- **`/moeder` is a member route, not an admin one.** `events` is anon-readable
  by the 2026-07-23 decision, so the club's own meeting list cannot be more
  private to a member than it is to a stranger on the landing page. Only the
  buttons are the admin's — and members gain the first view of the calendar
  beyond "the next one".
- **Held meetings stay on the page.** A date typed with the wrong year lands in
  the past, and `useUpcoming` — the front page, the public page — shows only the
  future. Without the held half, a typo is a meeting the club cannot get back.
  That is why `useEvents` is a second query rather than a loosening of the
  first: widening `useUpcoming` would put fifteen years of meetings on the front
  page to save a function.
- **Deleting asks twice, and the second question names the thing.** One copy of
  everything, no undo, no backup habit. "Er du sikker?" is a question nobody
  reads; the meeting's question carries its date too, because two meetings can
  share a title.
- **Every field is controlled from the first keystroke.** This is the fines bug
  in the shape it takes in a form: there the minutes field committed only on
  Enter, and on a phone tapping away is how the keyboard is dismissed, so the
  ordinary way of finishing with a field was the way to throw it away. Both test
  files pin it end to end — type, leave the field by a route that is not Enter,
  and the text is still in the payload.
- **One required field per table: the title.** Every column is `not null` with
  no other constraint, so the database would store a titleless row happily — a
  row nobody can read. The date, the venue and the time are routinely settled
  later (§9 has the lead calling the meeting two weeks ahead), so requiring them
  would stop the club writing down the one thing it has agreed.
- **`author` is in the news form although no card shows it.** The column is
  `not null` and every existing row carries a real name; a form that omitted it
  would write an empty author onto every item created from here on.
- **Tidspunkt is a text field, not `<input type="time">`.** The column is text
  and the club writes "18.30", which the native control refuses outright.

## Acceptance criteria
- [x] An admin can create, edit and delete news items
- [x] An admin can create, edit and delete events
- [x] A member sees the content and none of the controls; a READONLY build shows
      an admin none of them either
- [x] Confirmation before any delete, naming what will be deleted
- [x] Nothing is lost when the phone keyboard is dismissed
- [x] Dates parsed and printed in UTC; Danish plurals, no "(r)"
- [x] Tokens only, no raw hex; correct in light and dark
- [x] Tap targets at the design system's 48 px floor; filled buttons `bg-brand`
- [x] 420 px first, no sideways page scroll
- [x] `src/routes/routes.ts` and `routing.test.tsx` both updated deliberately
- [x] `npm test` (176), `npm run build`, `npm run lint` green
- [x] Danish throughout

## Verified in a browser
Chromium at 420×900, both colour schemes, both roles, against `build:demo`:
`/nyheder` and `/moeder` as admin and as member, the empty create form, an edit
form populated from a row, and the delete confirmation. Six tabs fit the bar.
No horizontal page scroll (`scrollWidth` 420 = `innerWidth` 420) and no console
error in any of them.

Then the whole flow driven end to end: create a meeting — leaving the last
field by tapping the header rather than pressing Enter — save, see it land in
date order, edit its venue, save, and delete it through the confirmation. The
page ends where it started. **Zero network requests left the page** in the
whole run, which is the demo build's promise about the club's live project.

## Left undone
- **Never run against the real database.** Every test mocks the client, and the
  demo build has no backend. The RLS suite proves the policies allow exactly
  these writes for an admin and refuse them for a member, but no row in the
  club's project has been written by this UI. The first real save is Lukas's.
- **No optimistic update.** A save waits for the round trip and then refetches,
  which on a slow connection is a visible pause with a "Gemmer…" label and no
  more. Correct, not fast.
- **No ordering control.** News is sorted by its date and the calendar by its
  own; there is no way to pin an item. Nobody asked, and a sort order is a
  column.
- **The native date picker follows the browser's locale, not the app's.** It
  renders `07/27/2026` in an en-US browser. The value stored is always ISO, so
  this is presentation only, and replacing it means writing a date picker.
- **Attendance records are still not editable in the app** — the third thing in
  Lukas's sentence. `/oekonomi` can set a missing meeting date, but creating a
  meeting and ticking off who came is still done outside. That is its own task.
