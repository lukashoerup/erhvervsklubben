# Task: T091 — Have's buy-in, 1.100 kr.: into the papers, not onto the site

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

## What the page said for an hour, and why it does not now
With `dues_from` at 2025-06-01, `/oekonomi` charged nine members from June 2025 and
read the club as owed 2.195 kr. = 1.100 kr. kontingent (Have) + 1.095 kr. fines,
reconciling to the krone. Then Lukas: *"Du skal ikke skrive det nogen steder på
hjemmesiden. Det er blot så vi har styr på det. Vi skal lige sikre at Have er med på
den."* Have has not been asked, so the 1.100 kr. is an intention, not a charge —
and `dues_from` is a charge. Reverted to 2026-05-01 by
`supabase/migrations/20260905182331_have_buy_in_not_on_the_site.sql`, applied and
read back. The page reads 1.095 kr. of fines outstanding and nothing else, as
before. The figure is kept in `members.note` — a column no page selects — and in
§17.5. `allocation.test.ts` is back to the bank's view, with the pending 1.100 in a
comment.

## Verification
- Read back: Have `dues_from = 2025-06-01`, note set; nine other rows unchanged.
- Tests green after the split into billed/charged (counts in the commit).

## Left open
- **Lukas asks Have.** Yes: `dues_from` → 2025-06-01 (20260905181816 is the shape)
  and the page carries it. No, or another figure: correct the note and §17.5.
- **Collecting it**, once agreed: with the fines round after 30 September, or on its
  own. When it lands: allocate across June 2025 – April 2026 (§16.4).
- **The rule this set:** the site shows what the club has decided with its members,
  not what the treasurer intends to put to them (PROJECT.md).
- The general lesson is in PROJECT.md: a bank reconciliation confirms what was
  paid; it cannot cancel what was agreed.
