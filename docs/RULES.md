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
>
> **Confirmed against the account, 2026-07-30.** All 87 kontingent transfers on
> the club's bank statement are 100 kr. before June 2026 and 200 kr. from June
> 2026, per member, and 11.500 kr. is exactly what the club charged from June
> 2025 through June 2026 (8 × 100 × 11 + 9 × 100 + 9 × 200). Both the rate
> schedule and the annual report's kontingent total are now bank-confirmed
> rather than reasoned. Four members paid June's 200 kr. as two transfers of
> 100 across the rate change, which is what a mid-rhythm rise looks like in a
> statement and is not a part-payment.

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

### When the club started charging each member — `members.dues_from`

**Kontingent began June 2025**, and the bank statement of 2026-07-30 is what
says so: each of the club's first seven payers transferred 400 kr. between 30.08
and 25.09.2025 — four months at the then-rate — and two of them wrote the months
into the transfer text (`Kasper jun-sep`, `Emil juni-september`). The club's own
meeting history goes back to 2022-10-29, so **the club is roughly three years
older than the kontingent.**

`members.dues_from` holds the first month each member is charged: **2025-06-01
for eight of them, 2026-05-01 for Christian Have, null for Oskar** (§12 charges
him nothing, so there is no month). Eight payers before May 2026, nine from May
2026 — which corrects a figure the club had only from memory, "nine from June
2026". The ledger asks the count per month rather than assuming today's roster
held all along; before this it charged nine members across the whole history and
the expected-income curve was 1.200 kr. too high.

**It is not a joining date, and the two must not be conflated.** Christian Have
has attended since møde #3 and was fined at møde #26 in February 2026 — three
months before his first kontingent transfer. Oskar has attended 22 evenings and
will never carry a value. What the bank documents is **liability to pay**, and
§11 measures anciennitet by attendance alone, so nothing in the app needs a
joining date. Full evidence: `docs/finance-reconciliation.md` §16.3.

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

### Budgeting fines the club has not been charged yet

**Not a rule the club voted — a practice it had, and the app lost.** *Klubbens
finanser* carried a `Forventede bøder` column beside `Faktiske bøder`, and a
`Forventet beholdning` column that added both to the kontingent. Lukas asked for
it back on 2026-07-29: *"her har vi tidligere lavet en fremskrivning i forventet
antal bøder per måned … det synes jeg at vi skal fortsætte med."*

The sheet had the **structure** and no **method**: the four `Forventede bøder`
cells (Marts 26 146, April 132, Maj 118, Juni 107 — 503 kr. in all) are typed
constants with no formula behind them, the table definition declares no
calculated column, and every projected row after Juni 26 budgets **zero** fines
out to August 2027. So the column was not a forecast running ahead of the club;
it was four numbers entered on the day the sheet was last saved, covering the
months since the last fine anybody recorded. See
`docs/finance-reconciliation.md` §12.

What the app does instead, and why it is not a per-month average:

- **The unit is the meeting, not the month.** Fines are charged at the table
  (Bødekasseregulativ) and §9 puts a dinner on the calendar roughly every other
  month, so fines arrive in bursts. A mean over months divides a dinner by the
  empty months around it, and — worse — its answer moves when the *window*
  moves. The club's 1.730 kr. over five dinners is 133 kr. a month across a
  13-month window and 216 kr. across an 8-month one. Same five evenings.
- **The average is taken over the meetings from the first fine-bearing one to
  the last, inclusive.** Quiet evenings inside that span count as zero; meetings
  outside it do not count at all. A meeting with no fine rows is either an
  evening where nobody offended or one whose Lead never told the Kasserer, and
  the database cannot tell them apart (§9 Q10 of the reconciliation, still open).
  This window is the reading that does not have to guess which.
- **The cadence comes from §9 until the club's own dates can carry it.** Three
  dated meetings are the minimum before it is measured — one interval is an
  anecdote, and §9 lets the frequency be decided meeting by meeting. All 28
  meetings are undated today, so the rule is what is in use.
- **A budget is never money.** It is drawn as a dashed line in the same colour
  as the expected curve — the same quantity continued, not a fourth thing
  measured — labelled `Forventede bøder · budget`, and it says in Danish on the
  page that it is not money the club holds. It is never added to `Modtaget`, to
  `Faktiske bøder` or to any figure the treasurer reports.
- **The forecast never runs longer than the record behind it**, capped at a
  financial year (§8). Five months of books cannot support a year of curve.

---

## Meetings — `§9`

- Every other month, as a rule; frequency is decided meeting by meeting.
  This is also the fallback cadence the fine budget uses — see above.
- **Two meetings are always planned ahead**, so a date always exists in advance.
  This is why capturing meeting dates going forward is realistic — the club
  already works that way, the app simply never recorded it.
- The Lead role rotates. The Lead calls the meeting with at least 2 weeks'
  notice, plans the agenda, and must find a replacement Lead if they cannot
  attend their own meeting.
