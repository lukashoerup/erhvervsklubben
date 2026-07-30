# Task: T076 — the club's books against its actual bank statement

## The problem
Every figure in `payments` came from a spreadsheet last saved **2026-06-09**,
before the month it reported on had ended. Three questions had been open against
it since T068 and none could be closed from the sheet: the 400 kr. of §5.3, the
missing 100 kr. of February 2026, and when the ninth member started paying.

On 2026-07-30 Lukas supplied **the account statement itself** — all 90
transactions from the first payment to 30.07.2026, closing **15.080,00 kr.** It
is the first time the real ledger has been available.

## What Lukas said about it, and why each thing mattered
1. **The first payment was retroactive.** The 400 kr. transfers of 30.08–25.09.2025
   each cover the club's first months. Two say so in the bank's own text:
   `Kasper jun-sep`, `Emil juni-september`. → the club's kontingent starts **June
   2025**, and the account is three years younger than the club.
2. **Anders has changed bank and owes the last month.** → the 200 kr. gap at the
   end is known, not an error.
3. **Hold out Rasmus's 200 kr. of 30.07.2026** and reconcile to **14.880 kr.**,
   the balance he photographed on 27.07. → Rasmus has paid a month in advance
   since October 2025 (§4 Stk. 3 has kontingent paid in advance), so that
   transfer settles August.
4. **Mads never paid for the first many months**, hence one large payment, and he
   is **the only member whose transfers carry no name** — the three `Overførsel`
   lines are his. → corroborated to the krone: his three transfers total exactly
   what the club charged him, and the 1.200 kr. is twelve months at 100 with no
   remainder.
5. **In the graphs, Mads must appear as having paid consistently throughout.**

## Point 5 is the whole task
It is not a request to falsify anything, and getting that distinction right
mattered more than any figure here.

`payments.month` records **the month a payment settles**, not the month the money
arrived — the column has said so since it was created. So a catch-up transfer is
allocated across the months it was for. That is ordinary accrual accounting:

- **The bank total cannot move.** Allocation redistributes a payment across
  months; it can neither create nor destroy a krone. `payments` sums to
  14.880 kr., which is the statement's closing balance less the one held-out
  transfer, and `allocation.test.ts` re-proves it against all 87 real transfers
  on every run.
- **What changes is the monthly view**, which stops punishing a man for paying
  late in one lump and starts recording what happened: he owed those months, and
  those months are paid.
- **The line between the two readings is evidence.** *Allocated to the months it
  settles* is a claim about what a payment was for, carried by the bank's own
  transfer text and by arithmetic that closes to the krone against a per-member
  total. *Moved to make a graph look nice* is a claim about nothing. Had the
  1.200 kr. left a remainder, or arrived from a member with no arrears, none of
  it would apply — and `allocateDues` throws rather than absorbing money it
  cannot place.

Said out loud in `docs/PROJECT.md`, in `src/data/allocation.ts`, in the migration
and in §16.4, because the difference is the whole of the club's trust in these
numbers.

## The answer
```
13.100  kontingent settled, June 2025 – July 2026
+1.780  bøder collected, February 2026
------
14.880  reconciled       = the balance photographed 27.07 ✓
  +200  Rasmus, settling August 2026 — held out
------
15.080  bank, 30.07.2026 = the statement's own closing balance ✓
```

Against 13.300 kr. charged: **200 kr. outstanding, Anders's July 2026**, and he
is the only member with anything outstanding in fourteen months. Nothing else
failed to reconcile.

## What was written
- **`members.dues_from`** — nullable date, additive, guarded. The schema change
  §14.5 specified and declined to make without evidence. 2025-06-01 for eight
  members, 2026-05-01 for Have, null for Oskar. **Not called `joined_on`**: the
  bank documents liability to pay, and Have has attended since møde #3 and was
  fined at møde #26 three months before his first transfer.
- **`payments`** — 13 rows corrected, 1 inserted. 13.280 → **14.880 kr.**
  February 2.480 → 2.580 (Mads's February arrived with his catch-up), April
  900 → 800 (eight payers, not nine), July 2026 new at 1.600, and every
  `bank_balance_kr` replaced with the statement's own month-end Saldo.
- **`buildLedger` asks the payer count per month**, so the expected-income curve
  charges eight members before May 2026 and nine after. §13's 1.200 kr.
  distortion is gone.

Not touched: `attendances`, `attendance_records`, `fines`, `news`, `events`,
`profiles`, `members.status` — all counted before and after and unchanged.

## Two things kept deliberately apart
**Incurred is not collected.** The statement independently confirms the
**1.780 kr. collected**; the club has **incurred 2.510 kr.**; the **730 kr.**
between them is fines a Lead noted and nobody billed. A reconciliation's natural
pull to make those agree would have written off 730 kr. of the club's money.

**Fine receipts are not allocated to the evenings they paid for.** They stay in
the month they were collected, because the fine *charges* are already dated to
their own meetings in `fines`, and re-spreading the receipt would state the same
money twice in two tables. Flagged as a judgement, reversible in one allocation.

## Questions this closed
- **§9 Q3, the 400 kr.** — Rasmus (29.06) and Lukas (30.06) paying July in
  advance. Explanation **(b)**, which the doc had rated the less likely of the
  two. Both closing figures are right about different things: 13.280 kr. is what
  the club had earned through June 2026, 13.680 kr. is what was in the account.
- **§9 Q7, February's missing 100 kr.** — nobody missed February. The club had
  **seven** members transferring and 7 × 100 = 700 exactly. The sheet charged
  eight.
- **§9 Q8, the ninth payer** — **May 2026**, refining the remembered June.
- **§9 Q9, the unnamed `Overførsel`** — Mads, corroborated to the krone.
- **§14.5's retroactive buy-in** — there is no receivable. Have owes nothing;
  the arrears were **Mads's**, and he paid them in full on 01.05.2026.

## Left open, and reported rather than tidied
1. **Anders owes 200 kr.** for July 2026. Known; the treasurer's to chase.
2. **730 kr. of fines noted and never billed.** Still Lukas's decision.
3. **`Ekstra kontingent i juni` 100 kr. is attributed to Esben by elimination**,
   not by name — the one dues krone in the statement whose payer is inferred. No
   monthly total depends on it; only Esben's own column would move.
4. **Have attended for over two years before paying kontingent** — møde #3
   onwards, fined at møde #26, first transfer May 2026. What changed in May? The
   one question the bank raises rather than answers.
5. **The annual report's 13.280 kr.** is right as accrual through June 2026 and
   400 kr. below the account's 30 June balance. Whether it gets a footnote is the
   club's call.

Found in passing, not this task's work: `fines` holds **30** rows where §15.3
tabulates 29 — same 2.510 kr. Emil's 110 kr. at møde #25, §15.6's one flagged
row, is now stored as 60 `for-sent` + 50 `skaal`, exactly what the sheet's
`{=60+50}` said. Somebody re-recorded that meeting in the app after T075 and in
doing so answered §15.6.

## Verification
`npm test` **348** (was 330), `npm run build` and `npm run lint` green. Read back
from production: `payments` 14 rows / **14.880 kr.**, `dues_from` set on 9 of 10,
`fines` 30 / 2.510 unchanged, every other table's count identical. The migration
was applied a **second** time with a sentinel note and wrote **0 rows** — the
`payments` updates are guarded on the values they replace, so it applies exactly
once and never reasserts itself over a treasurer's later correction.

Full workings: `docs/finance-reconciliation.md` §16.
