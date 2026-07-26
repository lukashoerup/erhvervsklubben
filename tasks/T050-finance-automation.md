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

**Unexplained:** the figure jumps to 1,800 kr/month from June 26. That is either
18 members or a fee change, and it must be pinned down before the calculation is
trusted — guessing here silently corrupts every later month.

## Blocked on
**The fine rules.** Lukas says they are published on the old site under
*Om os → Bødekasseregulativ*. That page cannot be reached from a cloud session:
plain fetch returns 403 and a real browser gets a blocked tunnel, because this
environment's proxy does not allow that host. The repo's screenshot of that page
(`docs/old-site-shots/07-om-os.png`) captures only the first tab, and the new
app is still a bare scaffold with no content carried over.

So the regulations need to arrive another way — pasted, screenshotted, or
fetched from a session that can reach the site.

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
- [ ] Fine rules encoded from the published regulations, with the source quoted
      in the code so the rule and its authority stay together
- [ ] Fines computed from meeting + attendance data, not hand-entered
- [ ] Membership fees computed from member count × the published rate
- [ ] The 1,800 kr/month change from June 26 explained and encoded
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
