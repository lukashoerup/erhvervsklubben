# The club's own rules, as the app must implement them

Source of truth is the Drive, not this file. Transcribed 2026-07-26 from:
- `250504_Bødekasseregulativ_Erhvervsklubben_v02.docx` (v02, 4 May 2025)
- `250426_Vedtaegter_vS.docx` (26 April 2025)

Kept here because the app encodes these amounts and thresholds, and a rule the
code implements should be readable next to the code. **If the club amends the
regulations, amend them there first, then update this file and the code in the
same commit** — the Drive document is what the members voted on.

---

## Fines — `Gældende bøderegler`

| Overtrædelse | Bøde |
|---|---|
| Udeblivelse uden afbud | 200 kr. |
| Afbud efter bordbestilling er foretaget af Lead | 100 kr. |
| For sent fremmøde | **50 kr. + 5 kr. pr. minut** |
| Bestille en anden type drikkevare end Lead under maden | 50 kr. |
| Skål før Leads første skål | 50 kr. |

Two conditions that the implementation must honour:
- **Late arrival is avoidable** by informing the Lead of an expected late
  arrival no later than 24 hours after the agenda is published.
- **The drinks fine is avoidable** with the Lead's consent.
- **Maximum one fine per offence per meeting, per member.**

### Why these cannot be calculated
Four of the five are observations only someone at the table can make: what
someone ordered, whether they toasted early, how many minutes late they were.
Even the fifth needs a distinction the attendance record does not hold —
*udeblivelse **uden afbud*** is a different thing from being absent.

**This corrects an earlier assumption in T050** that fines were derivable from
meeting and attendance data. They are not. The regulation itself already assigns
the job to a human: *"Lead er ansvarlig for at notere eventuelle bøder og
informere kasseren umiddelbart efter hvert møde."*

So the app's job is **capture and arithmetic**, not derivation: give the Lead a
fast way to record fines the moment the meeting ends, then do every sum,
per-member ledger and quarterly total automatically.

### Administration (drives the automation)
- The **Kasserer** is responsible for the fine box and for collection.
- The **Lead** records fines and tells the Kasserer immediately after each meeting.
- **Fines are collected quarterly.** This is where Lukas's quarterly bank check
  belongs — it is already the club's own rhythm, not a new invention.
- The fine-box accounts are presented at the annual general meeting with the
  rest of the accounts.
- Changing a fine rule needs 2/3 of those present, 14 days' written notice to
  all active members, and the Lead informed in advance. Unanimity if fewer than
  half the active members are present.

---

## Membership and money — `Vedtægter`

**§4 Stk. 3 — kontingent.** The statutes say **200 kr. per month**, paid in
advance, collected monthly.

> **Resolved 2026-07-26.** The Drive document was behind the vote and said
> 100 kr.; it has since been amended and now states 200 kr., so the statutes,
> this file and `rules.ts` agree. The rate stays dated rather than a single
> constant, because historical months must reconcile to what was actually
> charged then: 100 kr. before June 2026, 200 kr. from June 2026.
>
> **Do not read the annual report's "hævet fra 800 til 1.800 kr/md" as the
> per-member rate.** Those are monthly totals across the club — 8 × 100 kr.
> before, 9 × 200 kr. after. Taken as a per-member figure they imply a
> nine-fold fee rise, and put the year's 11,500 kr. of membership income out
> by roughly an order of magnitude.

`vedtaegter.ts` carries §4 Stk. 3 verbatim and reads the figure back out of the
sentence itself, and a test asserts it equals what `duesFor` charges — so the
statute and the invoice cannot drift apart without the suite going red.

**§3 — who actually pays.** This is the distinction the finance calculation
turns on:
- **Aktive medlemmer** pay kontingent and hold voting rights.
- **Inaktive medlemmer** are on pause, pay nothing, and may not attend.

So membership income is **the members who pay × rate**, never all members. Going
inactive requires 3 months' notice; 2 years inactive triggers a vote on
returning or moving to alumni status.

Until 2026-07-29 the app could not tell them apart: there was no members table,
the roster was every distinct `attendances.member_name`, and the ledger charged
all of it. `public.members` now carries a status per member and `buildLedger` is
handed the count of those who pay. **Membership status is the source of truth,
not "has ever appeared in attendances."**

### Founding father — the club's own exemption

**Not in the statutes, and written down here because the app charges money on
it.** Lukas, 2026-07-29: **Oskar** is a real member and attends, but as a
*founding father* he

- pays **no kontingent**,
- incurs **no fines**, and
- does **not vote on the use of the club's funds** (§12).

He is **not** an inactive member. §3 says an inactive member may not attend, and
he attends — 22 of the club's meetings. And his **anciennitet is unaffected**:
§11 earns it by attendance alone, so paying nothing costs him no evenings.

The three exemptions live in one place, the rights table in
`src/data/members.ts` — one row per status — so the finance code asks rather
than each screen remembering. `/oekonomi` leaves him out of the expected income
*and* out of the fine-capture screen from that same fact, and states on the page
how many members it is charging and who it is not.

**`alumne` (§4 Stk. 5 A) is deliberately not implemented.** It only arises after
two years of inactivity and a vote, and the club has never had an inactive
member. Same reasoning as the anciennitet revocation below: it is a check
constraint and a label the day the club votes one.

**§4 Stk. 2** — admission needs 2/3 approval of active members, and the person
must first have attended one event as a guest.

**§8** — the financial year is the calendar year. The Kasserer keeps the
accounts and presents them annually.

---

## Anciennitet — `§11`

Measured purely in **number of attendances**. Being an active member does not
earn it; only turning up does.

The statutes allow attendance to be **revoked by vote**: if a member leaves an
event early for something else, those present may strip the anciennitet for that
attendance. It needs 2/3 against, decided at that meeting during dinner, and if
no vote is held full anciennitet is earned automatically.

**Deliberately not built** (Lukas, 2026-07-26): it has never happened, and has
never even been proposed. Building a voting flow, a revoked state and the screens
to explain it would be real work and permanent complexity in the most-used page,
for an event with no precedent.

If it ever does happen, the existing `attendances.attended` flag already covers
it — someone flips that one row to false, which is what a revoked attendance
means anyway. No schema change, nothing to maintain in the meantime. Revisit
only if it happens twice.

Since T065 that flip no longer needs the database: an admin opens the meeting on
`/anciennitet`, taps the member's tick and saves. That is a side effect of
building ordinary attendance correction, not a decision to build revocation —
there is still no vote, no revoked state and no screen explaining any of it, and
a revoked attendance and a clerical error look identical in the data. The
paragraph above stands.

---

## Meetings — `§9`

- Every other month, as a rule; frequency is decided meeting by meeting.
- **Two meetings are always planned ahead**, so a date always exists in advance.
  This is why capturing meeting dates going forward is realistic — the club
  already works that way, the app simply never recorded it.
- The Lead role rotates. The Lead calls the meeting with at least 2 weeks'
  notice, plans the agenda, and must find a replacement Lead if they cannot
  attend their own meeting.
