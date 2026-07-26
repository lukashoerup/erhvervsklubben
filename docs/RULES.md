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

**§4 Stk. 3 — kontingent.** The statutes as written say **100 kr. per month**,
paid in advance, collected monthly.

> **Amended since:** Lukas confirmed 2026-07-26 that the club voted to double
> the monthly fee. That is why the sheet's membership income steps from 800 to
> 1,800 kr. in June 26. The arithmetic is consistent with **9 active members ×
> 200 kr.**, where the earlier 800 kr. was 8 × 100 kr. The statutes on file
> still say 100 kr., so the document is behind the vote — worth fixing there.

**§3 — who actually pays.** This is the distinction the finance calculation
turns on:
- **Aktive medlemmer** pay kontingent and hold voting rights.
- **Inaktive medlemmer** are on pause, pay nothing, and may not attend.

So membership income is **active members × rate**, never all members. Going
inactive requires 3 months' notice; 2 years inactive triggers a vote on
returning or moving to alumni status.

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
it — the treasurer flips that one row to false, which is what a revoked
attendance means anyway. No schema change, no UI, nothing to maintain in the
meantime. Revisit only if it happens twice.

---

## Meetings — `§9`

- Every other month, as a rule; frequency is decided meeting by meeting.
- **Two meetings are always planned ahead**, so a date always exists in advance.
  This is why capturing meeting dates going forward is realistic — the club
  already works that way, the app simply never recorded it.
- The Lead role rotates. The Lead calls the meeting with at least 2 weeks'
  notice, plans the agenda, and must find a replacement Lead if they cannot
  attend their own meeting.
