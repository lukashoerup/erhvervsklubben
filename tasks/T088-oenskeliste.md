# T088 — Lukas's wishlist, 2026-08-08

**Status:** not started. Recorded so it survives the chat window.

He photographed a note titled *"Foreslag til hjemmeside"* and said: *"her er der
andre features vi skal have lagt ind senere."* Later, not now — this file exists so
"later" has somewhere to live.

## The four, verbatim

> - alle kan skrive nyheder, men skal godkendes af bestyrelsen
> - Kan kommentere på nyheder
> - Skal tilmelde begivenheder
> - Offentliggøre login aktivitet

## What each one actually costs, so the next session can size them

**1. Anyone may write news, the board approves — ✅ done 2026-08-08.** *"Start med nyheder tilføjelse og godkendelse."* The board is the three admins; the question below was answered by choosing the smallest reversible option and writing down that it was a choice. See PROJECT.md, 2026-08-08, and `20260808093000_news_drafts.sql`.

The original sizing, kept because it was right about where the work was: the largest of the four, and the
only one that changes the club's access model rather than adding to it. `news` is
admin-write today (`Admins write news`), and this needs a third state between draft
and published — a `status` column, an RLS policy letting a member insert his own
unpublished row and read it back, and an approval control for the board. Note the
club has no "bestyrelse" in the app at all: roles are `admin` and `user`, so either
the board *is* the admins (three men today: Lukas, Anders, Rasmus) or a third role
has to exist. **That is a question for Lukas before any of it is built.**

**2. Comments on news.** A new table, member-write and member-read, with the same
`published`-style care about who may delete what. Straightforward, but it is the
first place in this app where a member writes something other members read — every
policy so far has been "members read, admins write". Worth deciding up front whether
a comment can be edited, and by whom.

**3. Sign up for events.** `events` already exists and `event_evaluations` shows the
pattern for a per-member row against an event. This is the smallest of the four and
the most immediately useful: §9 has the lead calling a meeting two weeks ahead, and
he currently counts replies by hand. Also the one that would make `/hjem`'s "næste
møde" card say something about *you*.

**4. Publish login activity — ✅ done 2026-08-08.** *"Kan vi tage det næste punkt på
listen?"* The fold on `/anciennitet` is every member's now, and it is still a fold:
publishing it changed who may open it, not whether there is one.

Extended the same day: *"Gerne login aktivitet inkl. hvor mange gange folk har været
inde og hvornår. En graf."* That needed a **new table** — the old design overwrote
itself, so no count existed to publish — and the graph therefore starts on 2026-08-08.
See `member_visits` and PROJECT.md.

It was not as cheap as this file guessed, and the reason is worth keeping. It took
**two** tables, not one — the screen shows names, and those live in
`user_member_mapping`, own-row-only until then, so opening only the timestamps would
have left every member looking at nine dates he could not attach to anyone. And it
needed a **fifth RLS bucket**: `member_last_seen` is read by everyone and written by
nobody, which neither `SHARED_TABLES` (asserts an admin can write) nor
`PERSONAL_TABLES` (asserts nobody else can read) describes. Filing it under SHARED
would have quietly asserted the opposite of the property that makes it safe.
`profiles` stays own-row-only, which is the line that matters — it holds `role`.

## Deferred with a reason: the lead may edit his own evening's attendance

Lukas, 2026-08-08: *"Kun formandskabet skal kunne ændre anciennitet/mødedeltagerne på
møderne. Evt. lead også hvis det ikke er for bøvlet at implementere."*

The first half already holds and needed no work — attendance editing has been
admin-only since T065. **The second half is more bother than it looks**, and the
reason is worth having written down before anyone estimates it again:

* The write is not one table. Ticking a member off writes `attendances`, whose rows
  reach the meeting through `record_id` — so a policy would have to join to
  `attendance_records` to ask whose evening it was, on every row written.
* `attendance_records.lead` is **free text**, with no key to `members` and no
  constraint. Matching a signed-in user to it means going user → `user_member_mapping`
  → name → string comparison against a column anyone can type anything into. A
  renamed or mistyped lead silently grants or removes the right, and nothing fails
  loudly when it does.
* It widens who may write the club's **anciennitet**, which is the one number the
  club actually measures itself by (§11) and the basis of every chart on `/hjem`.

None of that makes it wrong — it makes it a security change with a fiddly key, not a
switch. It also needs a decision that has not been made: is "formandskabet" the three
admins (Lukas, Anders, Rasmus), or the club's actual chairmanship? **Saaby is
formand and is not an admin today.** That question should be settled before any of
this is built.

## Also open, from the same conversation

- **Password reset by e-mail.** Lukas, 2026-08-08: *"Så de kan få en mail og gøre
  det selv via hjemmesiden."* Changing a password while signed in landed as T087;
  this is the other half — the case where a member *cannot* sign in. It needs e-mail
  delivery configured on the Supabase project and a route in the app to catch the
  recovery link. Ask him before building: the project's built-in mail service is
  rate-limited and Supabase says not to use it in production, so this may mean
  choosing (and possibly paying for) a mail provider.
- **The print pipeline (T081/T087 in his numbering).** Four files in his own
  `~/Downloads`, which a cloud session cannot reach. Waiting on him attaching them.
