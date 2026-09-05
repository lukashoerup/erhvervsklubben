# Task: T091 — Have's buy-in, 1.100 kr., into the books

**Status:** done 2026-09-05. Branch `claude/ek-account-balance-update-kx7ffo`.

## The ask
Lukas: *"Hvor meget skylder Have?"* — and, told 110 kr. of fines: *"Jo men i de
udestående Have har ift. at han startede senere i klubben. Vi har talt tidligere om
det."*

## What the record said, and why it was wrong
- 2026-07-29 (PROJECT.md, §14.5): the ninth member must buy in retroactively; he is
  treated as having paid all along but has not.
- 2026-07-30 (T076, §16.11, STATUS.md): "there is no receivable — Have owes nothing",
  because his transfers matched what the bank had billed him from May 2026.

The second overruled the first with an inference. Matching one's bills proves the
bills were paid; it says nothing about an agreement the bank never billed. Five
weeks of the docs saying the opposite of what the treasurer had decided.

## The figure
Never written down. Put to Lukas on the club's own arithmetic — kontingent began
June 2025, Have was first billed May 2026, eleven months between at the 100 kr.
rate then in force, Mads's precedent for a twelve-month catch-up — and confirmed:
**1.100 kr.** With the 110 kr. of unbilled fines, 1.210 kr. in all.

## What was done
- `members.dues_from` → **2025-06-01** for Have, with the agreement in his `note`,
  by `supabase/migrations/20260905181816_have_dues_from_june_2025.sql`. Guarded on
  the row still holding 2026-05-01 and on the club's ten names; a fresh stack does
  nothing, out loud. Applied to production and read back; committed under the
  version production holds.
- **`payments` untouched.** His 2026 transfers stay in the months they were sent
  for, so the eleven unpaid months sit at the start of the ledger, where they are.
- `allocation.test.ts`: `DUES_FROM` stays the bank's billing view (Have 2026-05) and
  a `CHARGED_FROM` map carries the club's charge (Have 2025-06) into the ledger
  test, which now finds the club 2.030 behind at July: 200 + 730 + 1.100. Moving
  the allocator itself would have settled his 2026 money against 2025 and rewritten
  three reconciled rows.
- Docs: STATUS.md (the payer-count paragraph, §9 Q8, the struck-out buy-in item),
  finance-reconciliation.md §17.5, PROJECT.md decision, a dated correction appended
  to T076 — history left as written, corrected below it.

## What the page says now
`/oekonomi` charges nine members from June 2025 and reads the club as owed
**2.195 kr.** = 1.100 kr. kontingent (Have) + 1.095 kr. fines. It reconciles to the
krone: 18.000 charged + 2.875 fines − 18.680 received. Live at once — the page
derives from `dues_from`; no deploy needed.

## Verification
- Read back: Have `dues_from = 2025-06-01`, note set; nine other rows unchanged.
- Tests green after the split into billed/charged (counts in the commit).

## Left open
- **Collecting it.** With the fines round after 30 September, or on its own —
  Lukas's call. When it lands: allocate across June 2025 – April 2026 (§16.4).
- The general lesson is in PROJECT.md: a bank reconciliation confirms what was
  paid; it cannot cancel what was agreed.
