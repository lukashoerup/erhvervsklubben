# T080 — the meetings page folds into anciennitet

**Status:** done, 2026-07-30
**Branch:** `task/T080-meetings-merged`

## What was asked

Lukas, 2026-07-30, in two messages. First the constraint:

> Ancinitetssiden er den rigitge. Den må der ikke ændres på.

Then the scope:

> Men den skal merges ind. Men ancinitetssiden er den rigtige version, så der
> skal ikke ændres noget i den. Men nogle af de beskrivelser der har været inde i
> møderne må gerne komme med, samt der skal være mulighed for at lave en kort
> beskrivelse i ancinitetssiden. Man skal også gerne kunne klikke sig ind på et
> møde på ancinitetssiden for et medlem og læse fulde beskrivelse samt se hvilke
> bøder der er blevet udgivet til det møde. Så skal mødesiden fjernes.

Five things, and the first one governs the other four: **/anciennitet is right and
nothing in it may change.** So this is additive by construction. Everything that
was on the page is still on it, in the order it was, and the merge is three
additions above and inside it.

T078 had declined this deliberately, on the grounds that removing `/moeder`
without relocating the calendar's create/edit/delete leaves `events` uneditable.
That reasoning was sound and is what shapes the design below; what T078 lacked was
this brief.

## What was built

**1. A meeting record carries its own description.**
`supabase/migrations/20260730193000_meeting_description.sql` — a nullable column,
applied to production, plus a backfill of the calendar's own prose onto the eight
meetings it belongs to.

The match is a **date, corroborated by a lead**. An event pairs with a record only
where the two share a date *and* that date carries exactly one row on each side:
8 of the 12 events. What makes it more than a date collision is that seven of the
eight name the evening's lead in their own text — "Oskar er Lead", "Emil er lead",
"Anders er Lead", "Rasmus er lead", "Esben er Lead", "Formand er lead" (Saaby is
formand), and #22 saying the day was handed to "vores kasserer Lukas" — and every
one agrees with `attendance_records.lead` on the row it lands on. The eighth (#21,
Esben) names nobody and matches on venue instead: Bjælkehuset on both sides.

**The number in the title is never used.** T071 established that the club's own
numbering ran a meeting ahead of the database's through the middle of the history
and closed the gap again, so "Erhvervsklub #20" is not record 20. Joining on it
would move a third of the history by one.

Four events are deliberately left behind, because the join refuses rather than
guesses:

| Event | Why not |
|---|---|
| `2025-04-26 Erhvervsklub #20` | Has a real description, but record #20 is one of the eleven the history never dated — nothing to match it to |
| `2025-04-20 Udarbejdelse af vedtægtsudkast` | A working session, not a numbered club meeting; no attendance record at all |
| `2026-08-08 #29`, `2026-09-11 #30` | Still ahead. A future meeting cannot have an attendance record |

**2. The card opens onto the evening.** `components/MeetingCard.tsx` grows a
`<details>` between the attendance strip and the admin's buttons: the description
clamped to two lines as the summary, the whole of it plus that meeting's fines
inside. A disclosure rather than a route of its own — 28 cards down one page, and a
drill-in costs the reader his scroll position on the way back.

Three details worth keeping:
* **A meeting with nothing to say renders no fold at all**, which is 20 of the
  club's 28. A disclosure that always appeared would put an empty fold on
  two-thirds of the longest page in the app.
* **The offence is read from the rule the row carries**, never decoded from the
  amount. 95 kr. is arithmetically nine minutes late; T075 refused that inference
  for the whole history and a card is not the place to reintroduce it.
* **The affordance is two words, not a chevron.** The icon font is a subset of
  exactly nine glyphs addressed by codepoint, and `expand_more` is not one of
  them — adding it to `Icon` without re-subsetting renders a blank box.

**3. `events` keeps a screen.** `components/Moedekalender.tsx` is the old page as a
section at the top of `/anciennitet`: planned meetings for every member, the admin's
create/edit/delete, and the held entries folded shut. It could not simply be
deleted, because `events` holds two things `attendance_records` structurally
cannot — **meetings still ahead** (#29 and #30 are planned and dated; without this
the club's next meeting is unchangeable, on the front page as much as here) and
**a held meeting whose record has no date** (#20's description lives here).

**4. `/moeder` is gone** — the route, the tab, the page and its import. Five
columns in the tab bar instead of six. `pages/Moeder.test.tsx` moved to
`components/Moedekalender.test.tsx` with its 16 assertions intact; only the
new-meeting button's name changed, to "Nyt møde i kalenderen", because
`/anciennitet` now carries two buttons that write different tables.

**5. One finance query, not two.** `useFinance` moved from `pages/Oekonomi.tsx` to
`data/useClubData.ts` and both pages use it. Same `['finance']` key, which
`AFFECTED` already invalidates, so a saved meeting refreshes both screens
whichever one it was saved from — and there is one copy of the fines retry ladder
rather than two that can drift.

## Verification

* Tests **393 → 402**. New: the card's disclosure (five cases, including the
  empty one), the page-level merge (four, one of which asserts the *order* of the
  page rather than its contents — a merge that quietly reorders the club's longest
  page has broken the instruction even with every feature present), and the
  read ladder's middle rung.
* `readRecords` now drops one optional column per rung, newest first. The bug a
  single assertion would miss: a retry that drops *both* on the first failure,
  which costs the dates on every database that merely lacks the newer column.
* Production verified after the migration: 8 records carry a description, each on
  the record whose lead its text names. 28 meetings, 261 attendances, 30 fines,
  14 payments, 12 events — all unchanged.
* Checked on a 420 px viewport as member and as admin: five tabs, no horizontal
  overflow, 12 folds on the demo's 28 cards, no console errors.

## Left open

* **`fines.settled_at` still has no UI** (from T078). Marking a fine collected
  needs SQL, which matters to Lukas's open decision on the 730 kr.
* **The club map** — Lukas, 2026-07-29: *"vi skal have et kort, som viser alle
  steder vi har været implementeret på længere sigt."* The venue row on the
  calendar card is where it goes. Needs his choice between OpenStreetMap (free)
  and Google (API key, possible cost).
* **#20's description is on the calendar, not on its meeting.** Dating record #20
  would let a re-run of the backfill move it; eleven records are undated.
