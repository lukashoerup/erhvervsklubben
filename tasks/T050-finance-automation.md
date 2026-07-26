# Task: automate the club finances (resolves Q1)

## Goal
Lukas stops maintaining the finance numbers by hand. The machine keeps them
current; he confirms them against the bank once a quarter and does nothing else.

> "Finance numbers came via an integration to Google Sheets, where I updated a
> sheet ongoingly with the financials. We can continue with that setup, but I
> will need you/the workbench to update these numbers, with minimal involvement
> from me, except a quarterly check that the bank account matches the reported
> financials." — Lukas, 2026-07-26

This resolves open question **Q1** (finance-chart data source), which has been
blocking the finance chart (T054).

## What the existing sheet actually contains
Google Sheet *"Klubbens finanser"*
(`1vOyTgOqqme7ad6ttRdr0Pmfy4izjEMY5AVu0BduIwfE`), last modified 2026-06-09.

**Monthly ledger**, one row per month from June 25:

| Column | Danish | Derivable? |
|---|---|---|
| Membership fees | Kontigenter | **Yes** — members × 100 kr/month |
| Actual fines | Faktiske bøder | **Yes, once the rules are known** — from meeting + attendance data |
| Expected fines | Forventede bøder | Yes — same rules, forward-looking |
| Money received | Indbetalinger | **No** — only the bank knows |
| Actual balance | Faktisk beholdning | No — runs off money received |
| Expected balance | Forventet beholdning | Yes — cumulative arithmetic |

**Fines grid**: member × meeting lead. Seven members named (Kasper, Emil,
Holst, Mads, Tørring, Saaby, Esben) plus Lukas.

## Findings from reading it

**A 50 kr inconsistency in the current books.** The monthly column totals
1,780 kr of actual fines; the fines grid underneath sums to 1,730 kr. The gap is
February 26's 50 kr, which has no matching column in the grid — either a lead
was never added or it was typed straight into the monthly row. Exactly the class
of error that derived numbers remove.

**The sheet is already drifting.** Actual fines stop after February 26; money
received stops after June 26. It is two months stale. This is the real argument
for automating it, not tidiness.

**The membership figure reconciles.** The old site's About page states
membership is 100 kr/month, and 8 members × 100 = the 800 kr/month in the sheet.
Confirms the fee is derivable rather than hand-entered.

**Explained 2026-07-26:** the jump to 1,800 kr/month is a **doubling of the
monthly fee**, 100 → 200 kr, confirmed by Lukas. The arithmetic is consistent
with 9 active members × 200 kr, where the earlier 800 kr was 8 × 100 kr.

Note the statutes on file (§4 Stk. 3) still say 100 kr — the document is behind
the vote. The code should follow the vote, and the document should be corrected
in the Drive.

**And the formula is narrower than it looked:** §3 distinguishes *aktive* from
*inaktive* members, and only active members pay. Income is **active members ×
rate**, never all members.

## Unblocked 2026-07-26 — and one assumption was wrong
The regulations were in the Drive, not only on the site. Transcribed into
`docs/RULES.md` from `250504_Bødekasseregulativ_Erhvervsklubben_v02.docx` and
`250426_Vedtaegter_vS.docx`.

**Correction: fines are not derivable.** This task previously claimed they could
be computed from meeting and attendance data. Reading the actual rules, four of
the five are observations only someone at the table can make — what a member
ordered, whether they toasted before the Lead, how many minutes late they were
(the fine is 50 kr. *plus 5 kr. per minute*). The fifth needs a distinction the
attendance record does not hold: *udeblivelse **uden afbud*** is not the same as
being absent.

The regulation already assigns the job to a human — *"Lead er ansvarlig for at
notere eventuelle bøder og informere kasseren umiddelbart efter hvert møde."*

So the automation is **capture and arithmetic, not derivation**: give the Lead a
fast way to record fines the moment a meeting ends, then do every sum, ledger
and quarterly total automatically. That is still nearly all of the manual work,
and it is what actually went stale in the sheet.

**The quarterly rhythm is the club's own.** Bødekasseregulativ Stk. 3: the
Kasserer collects quarterly. Lukas's quarterly bank check is not a new process
bolted on — it is the process the club already voted for.

## Design (agreed 2026-07-26)
**The split is clean.** Everything except money-actually-received is derivable
from data the club already has: the database records every meeting, who led it,
and who attended. So:

- The machine keeps the **expected** side current on its own, after every
  meeting.
- **Money received** is the one number nothing can derive. Lukas's choice: the
  machine tracks what the balance *should* be and asks him once a quarter to
  confirm it against the bank. No bank credentials, no aggregator subscription,
  no new attack surface.
- Drift between expected and actual is then a *reported number*, not something
  that quietly accumulates unnoticed — which is what happened here.

## Where the numbers live — decided 2026-07-26
**The club database.** Lukas chose to replace the Sheets integration rather than
continue it. The site already reads from the database, so the machine writes
there directly.

Consequences worth stating, because they are the reason:
- No Google service account, no credential on the box, no new dependency. The
  claude.ai Drive connector used to *read* the sheet during this investigation
  cannot be used by a scheduled job anyway — `workbench/context/STACK.md`
  restricts connectors to interactive sessions so runtime jobs stay
  zero-cloud-token.
- One source of truth instead of two. The gap between them is exactly what
  produced the 50 kr discrepancy and the two stale months.
- The existing sheet is read once, to import history, and then nothing depends
  on it. Lukas may keep it privately.

## Who can see it — decided 2026-07-26
**Admin only, reads included.** Lukas: *"Not everyone should know how much
money is in the bank account."*

This is the one place the "members read everything" rule does not hold, so the
finance table goes in `ADMIN_ONLY_TABLES` in `tests/rls/rules.ts`, which already
carries a test asserting a member sees zero rows there. The guard that fails on
an unclassified table means this cannot be forgotten when the table is created.

Design consequences, already applied to the mockups:
- The balance is **off the member front page**.
- It is **out of the launch animation** — it was a counting figure in the first
  version, and an animated number is the least private place to put one.
- The finance chart (T054) becomes a treasurer's screen, not a members' one.

## Acceptance criteria (draft — firm up once unblocked)
- [ ] Fine amounts encoded from `docs/RULES.md`, including the two escape
      clauses (late arrival waived if the Lead is told within 24h; drinks fine
      waived with the Lead's consent) and the one-fine-per-offence-per-meeting cap
- [ ] The Lead can record a meeting's fines in well under a minute, on a phone,
      the moment it ends — this is the actual product, not a form
- [ ] Every sum, per-member ledger and quarterly total derived, never typed
- [ ] Membership fees computed from **active** member count × rate (§3 —
      inactive members pay nothing), with the rate change 100 → 200 kr dated
- [ ] The fee change 100 → 200 kr encoded with its effective date
- [ ] Expected balance reconciles to the sheet's history for every past month —
      the migration is only trustworthy if it reproduces the known past
- [ ] The 50 kr discrepancy resolved, not silently absorbed
- [ ] Finance table classified `ADMIN_ONLY_TABLES`; a member reading it gets
      zero rows, proven by the existing generated test
- [ ] Quarterly reconciliation prompt to Lukas via Telegram
- [ ] Tests green in CI

## Scope
**May change:** finance calculation + its tests, `supabase/migrations/` (a
finance table, once its shape is decided)
**Must NOT touch:** bank credentials — explicitly out of scope by Lukas's choice

## Docs affected
`docs/PROJECT.md` (Q1 resolved; the finance decisions are permanent),
`docs/STATUS.md`, `docs/ARCHITECTURE.md` (where finance numbers come from).

## Size check
Several sessions. Split: rules encoding, then calculation + historical
reconciliation, then the quarterly prompt.

## Working notes (agent fills in)
