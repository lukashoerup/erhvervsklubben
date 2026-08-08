# T081 — August 2026 collected, and the club's last outstanding kontingent settled

**Asked for by Lukas, 2026-08-08**, on the morning of an EK meeting: *"Der er EK
møde i dag. Jeg vil gerne have opdateret hjemmesiden med seneste status. Anders
Tørring har indbetalt det han skylder. Og der er mere i kassen."*

## The source

A photograph of the account statement for 4086341662, **01.06.2026 – 04.08.2026**,
27 transactions, closing **16.880,00 kr.**

Its June and July lines reproduce T076's CSV exactly — same dates, same transfer
texts, same amounts — so the overlap is **corroboration of the existing books
rather than a second source to reconcile against them**. Nothing before
2026-07-30 moves.

## What is new since T076's statement closed on 30.07.2026

Eight transfers, 1.800 kr.:

| Date | Text on the statement | kr. | Settles |
|---|---|---:|---|
| 31.07.2026 | `Lukas` | 200 | august |
| 03.08.2026 | `Kontingent - Esben C.` | 200 | august |
| 03.08.2026 | `Anders Tørring` | **400** | **juli + august** |
| 04.08.2026 | `Emil kontingent` | 200 | august |
| 04.08.2026 | `Kontingent Kasper` | 200 | august |
| 04.08.2026 | `Overførsel` | 200 | august — Mads (§16.2) |
| 04.08.2026 | `Christian Have` | 200 | august |
| 04.08.2026 | `Mathias Saaby` | 200 | august |

Rasmus's 200 kr. of 30.07 was already on T076's statement and was **deliberately
held out** of the books as August money. It is in the 2026-08 row now, which is
what it was always for. That is why nine members paid August and only eight
transfers appear above.

## Anders's 400 kr. is not read off the transfer text, and it does not need to be

The bank says `Anders Tørring` and `400,00`. Three independent things place it:

1. **Lukas said so** — *"Anders Tørring har indbetalt det han skylder."*
2. **The arithmetic has one solution.** He owed exactly 200 kr. (July, T076 §16.8
   — the club's only outstanding kontingent in fourteen months, because he had
   changed bank) and 200 kr. is August's rate. 400 = 200 + 200 with no remainder,
   and `allocateDues` places it oldest-month-first without being told.
3. **The transfer text changed with him.** Every earlier Anders line reads
   `Anders Tørring Hanse` (the bank truncating a longer name); this one reads
   `Anders Tørring`. A new bank is exactly what T076 recorded as the reason the
   200 kr. was late in the first place, so the text corroborates rather than
   confuses.

## What the club's position now is

```
15.100  kontingent settled, June 2025 – August 2026
+1.780  bøder collected, February 2026
------
16.880  reconciled
16.880  bank, 04.08.2026 = the statement's own closing balance ✓
```

**The two agree exactly, for the first time in the club's recorded history.**
That is not a tidier result, it is a different fact: T076 had to hold one
transfer out because the club was mid month-change, and here nobody has paid
September in advance yet, so there is no float to hold out. When Rasmus and
Lukas transfer at the end of August the gap will reopen — and it should.

**Kontingent outstanding: 0 kr.** Every month from June 2025 to August 2026 is
settled in full by every member the club charges.

**Still outstanding: the 730 kr. of fines** a Lead noted and nobody billed (§15.1)
— untouched here, and still Lukas's decision, not the app's.

## What was written

- `supabase/migrations/20260808120000_august_2026_statement.sql`
  - `payments` 2026-07: `amount_kr` **1600 → 1800**. Anders settled it.
    `bank_balance_kr` stays **15.080** — that is what the account held on
    30.07.2026, which is what the column means. The two figures now coincide by
    accident and not by composition: the 15.080 contained Rasmus's August
    transfer and not Anders's July.
  - `payments` 2026-08: **new row**, 1.800 kr., `bank_balance_kr` 16.880.
- `src/data/allocation.test.ts` — the pinned statement extended to 95 transfers /
  15.100 kr. and re-run through `allocateDues`. The reconciliation to 16.880 kr.
  and the zero outstanding are now re-proved on every test run.
- Docs: `docs/finance-reconciliation.md` §17, `docs/STATUS.md`.

**Nothing else was touched** — no fine, no meeting, no member, no schema. The
migration is guarded on the values it replaces and on the club's own ten names,
so it applies exactly once and is a no-op on any other database.

To reverse it, exactly and only:

```sql
delete from public.payments where month = '2026-08-01';
update public.payments set amount_kr = 1600,
  note = (select note from public.payments where month = '2026-07-01')
 where month = '2026-07-01';
```

## Not done, and deliberately

**The meeting of 2026-08-08 was not added to `events` or
`attendance_records`.** Lukas mentioned it as the reason for the update, not as
something to record, and a meeting is entered on `/anciennitet` after it happens
along with who attended. Offered to him instead.
