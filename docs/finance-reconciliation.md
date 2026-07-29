# Erhvervsklubben — finance reconciliation and import plan

Investigation 2026-07-27. **Executed 2026-07-29 as T068 — see §11 for what was
actually written, what was refused, and where §8.2's "import nothing" verdict
was overtaken.** Sections 0–10 are the investigation as it stood on 2026-07-27
and are left unedited, because §11 is only readable against what it changed.

Sources:
- Google Sheet **"Klubbens finanser"** `1vOyTgOqqme7ad6ttRdr0Pmfy4izjEMY5AVu0BduIwfE`,
  last modified **2026-06-09T15:43:55Z** (this date matters — see §5).
- Google Slides **"Aarsberetning_Erhvervsklubben"** — two copies exist,
  `1gOZWzlAr0nB93m1Pmwu02_B0ayTEziQHPN6_BLSnBR0` (created 2026-06-25 20:08) and
  `1FagzKE0V4_GeAazTXibB66zkjoAvcnO3uaZ6NmMeVVs` (created 2026-06-25 19:56).
  Both state the same figures.
- Supabase project `urlabzyihqrsdeasvrfe`.
- **Bank screenshot supplied by Lukas, taken 2026-07-27 17:58** — see §5.
- Repo, read-only: `docs/RULES.md`, `src/data/rules.ts`, `src/data/ledger.ts`.

---

## 0. The answer, first

**The 50 kr. is not an error and no money is missing.** Both numbers are correct
and they are measuring different things:

- **1.730 kr.** is Sheet2's total. Sheet2 breaks fines down per member across
  **five** Lead columns. It is the subtotal of five meetings.
- **1.780 kr.** is Sheet1's total, a live `SUM()` over a column that has **six**
  months with actual fines. The sixth — **Februar 26, 50 kr.** — has no Lead
  column in Sheet2, so Sheet2's grand total simply never counted it.

`1.730 + 50 = 1.780`. Sheet2 is not wrong; it is **incomplete**.

The decisive evidence is not the subtraction — it is a formula inside the sheet.
The February 2026 payment cell is not a typed number, it is
`=700+1545+235 → 2480`, and **1545 + 235 = 1780**. The club's own record of what
was actually transferred into the account says 1.780 kr. of fines was collected.
The 50 kr. was charged **and paid**. See §3.

So the annual report's **1.780 kr. is right**, and its **11.500 kr.** of
kontingent and **13.280 kr.** total are right too — all three fall straight out
of the sheet's own formulas (§3.4).

What is genuinely unknown is much smaller than "50 kr. is missing": **we do not
know whose fine the 50 kr. was.** That affects one member's fine history. It
affects nobody's balance, because it has already been paid.

---

## 1. How the sheet was read (this matters)

A plain-text rendering of this workbook is **actively misleading**, exactly as
suspected. `read_file_content` and the Drive metadata snippet both collapse empty
cells, so the Juni 25 row renders as six values for seven columns and the
Indbetalinger figure of 800 slides left into the *Forventede bøder* column.
Read that way, every month before Marts 26 appears to carry an expected-fines
figure it does not have.

The grid below was recovered by `download_file_content` with
`exportMimeType=application/vnd.openxmlformats-officedocument.spreadsheetml.sheet`,
unzipping the `.xlsx` and parsing `xl/worksheets/sheet{1,2}.xml` with an XML
parser, using each cell's `r=` reference as authority.

**Warning for anyone repeating this:** a naive regex over `<c r=...>` silently
mis-attributes values, because empty cells are written self-closing
(`<c r="D2" s="4"/>`) and a lazy `(.*?)</c>` swallows the *next* cell's value.
That produced a wrong grid on the first pass here. Use a real XML parser.

The `.xlsx` export also preserves **formulas**, which the text export does not.
Those formulas are what settle this case.

---

## 2. Sheet2 — the fines grid, as it actually sits

Columns are Leads, rows are members. Blank = no fine.

| Member | Lukas Lead | Esben Lead | Oskar Lead | Emil Lead | Saaby Lead | Row total |
|---|---:|---:|---:|---:|---:|---:|
| Kasper  | 105 | 100 |     |     | 60  | **265** |
| Emil    | 50  |     | 75  |     | 110 `{=60+50}` | **235** |
| Holst   | 50  | 95  |     |     |     | **145** |
| Mads    | 200 |     |     |     | 185 | **385** |
| Tørring |     | 80  |     |     |     | **80** |
| Saaby   |     |     | 75  | 200 | 60  | **335** |
| Esben   |     |     | 155 | 70  | 60  | **285** |
| **Sum** | **405** | **275** | **305** | **270** | **475** | **1.730** |

Verified both ways:

```
columns: 405 + 275 + 305 + 270 + 475 = 1730
rows:    265 + 235 + 145 + 385 +  80 + 335 + 285 = 1730
```

**Sheet2 contains no arithmetic error.** It is internally consistent to the
krone. Only `B10` and `G3` are live `SUM()`s; the other totals are pasted values
— but they all happen to be correct.

Note `F4 = {=60+50} → 110`: Emil's Saaby-Lead cell is explicitly **two** fines,
not one. So the grid's cells are per-member-per-meeting *totals*, and at least
one is known to bundle multiple offences. This matters in §7.

---

## 3. Sheet1 — the monthly ledger, and the three formulas that settle it

### 3.1 The `Faktiske bøder` column

| Month | Cell | Content | Value |
|---|---|---|---:|
| Juni 25 | C2 | **`=100+95+80`** | 275 |
| Juli 25 | C3 | typed | 0 |
| August 25 | C4 | **`=105+50+50+200`** | 405 |
| September 25 | C5 | typed | 0 |
| Oktober 25 | C6 | typed | 305 |
| November 25 | C7 | typed | 270 |
| December 25 | C8 | typed | 0 |
| Januar 26 | C9 | typed | 475 |
| **Februar 26** | **C10** | **typed** | **50** |
| Total | C29 | `=SUM(Finanser[Faktiske bøder])` | **1.780** |

```
275 + 0 + 405 + 0 + 305 + 270 + 0 + 475 + 50 = 1780
                                        └── the 50 kr.
excluding Februar 26:                       = 1730  ← Sheet2's total
```

C29 is a **live table-wide `SUM()`**, not a typed number. So Sheet1 does not
"disagree with itself" — it sums its own column correctly. The 1.780 is produced
by the spreadsheet, not typed by a human.

### 3.2 The two formulas that prove the Lead ↔ month mapping

This is the strongest evidence in the whole exercise, and it is not statistical:

- **C2 = `100+95+80`.** The **Esben Lead** column of Sheet2, read top to bottom,
  is Kasper 100, Holst 95, Tørring 80. Identical figures, identical order.
- **C4 = `105+50+50+200`.** The **Lukas Lead** column, top to bottom, is
  Kasper 105, Emil 50, Holst 50, Mads 200. Identical figures, identical order.

Whoever built this sheet typed each Lead column into one month cell. That
establishes, as fact rather than inference, that **one Sheet1 fine-month = one
Sheet2 Lead column**, and pins two of the five directly.

The remaining three follow uniquely, because the five column sums and the five
nonzero month values are the same set of five **distinct** numbers:

| Sheet1 month | Value | Lead column | Basis |
|---|---:|---|---|
| Juni 25 | 275 | Esben Lead | **formula C2** |
| August 25 | 405 | Lukas Lead | **formula C4** |
| Oktober 25 | 305 | Oskar Lead | unique value match |
| November 25 | 270 | Emil Lead | unique value match |
| Januar 26 | 475 | Saaby Lead | unique value match |
| **Februar 26** | **50** | **— none —** | **the gap** |

There is no sixth Lead column. That is the entire discrepancy.

### 3.3 The formula that proves the 50 kr. was actually collected

The February 2026 `Indbetalinger` cell:

```
E10 = 700 + 1545 + 235  →  2480
```

Three transfers. Decompose them:

```
1545 + 235 = 1780     ← the fines, in full
       235            = Emil's row total in Sheet2, exactly
      1545            = everyone-except-Emil in Sheet2 (1495) + 50
       700            = that month's kontingent (100 short of 800 — see §6.2)
```

So February's 2.480 kr. is **700 kr. of kontingent plus 1.780 kr. of fines**,
the fines arriving as two transfers: Emil's own 235, and a 1.545 kr. lump from
everyone else.

Two things follow:

1. **1.780 is the collected amount, confirmed against money movement, not just
   a column sum.** This is independent of Sheet2 entirely.
2. **The extra 50 kr. sits inside the 1.545 lump, not inside Emil's 235.**
   Emil's transfer matches his Sheet2 row exactly. So whoever owes the 50 kr.,
   **it is not Emil.**

### 3.4 The annual report reproduces exactly

Taking February's kontingent as 700 (per E10) and every other month's
Indbetalinger as kontingent:

```
Juni 25 – Januar 26   800 × 8  = 6.400
Februar 26                       = 700
Marts 26                         = 800
April 26                         = 900
Maj 26                           = 900
Juni 26                          = 1.800
                        Kontingent 11.500   ← annual report: 11.500 ✓
                        Bøder       1.780   ← annual report:  1.780 ✓
                        Total      13.280   ← annual report: 13.280 ✓
```

And independently, `E29 = SUM(Finanser[Indbetalinger]) = 13.280`.

The annual report is not a second opinion that happens to differ — **it is a
correct reading of this sheet**, including the 50 kr. that Sheet2 omits. The
report is right and Sheet2 is the incomplete document.

---

## 4. Which figure is right — verdict

**1.780 kr. is right.** Three independent supports:

1. Sheet1's `Faktiske bøder` column contains six actual-fine months, and its
   total is a live `SUM()` over them.
2. The February payment formula `700+1545+235` shows 1.780 kr. of fines actually
   moved into the account.
3. The 11.500 / 1.780 / 13.280 split in the annual report reconstructs exactly
   from the sheet's own cells, with no rounding or slack.

**1.730 kr. is also right, for what it measures** — fines across the five
meetings Sheet2 breaks down. It was never the year's total. Reading it as one is
the actual mistake.

The club's known "50 kr. spreadsheet error" is therefore **not an arithmetic
error at all**. It is a *missing sixth column* in the per-member grid. No krone
is unaccounted for; one attribution is.

---

## 5. The bank statement (screenshot, 2026-07-27 17:58)

Recorded here so a future reader can tell bank-sourced figures from
sheet-sourced ones. Account "Erhvervsklub konto". **Saldo 14.880,00 kr.**,
kommende betalinger 0,00. Visible July entries, all credits of 200,00 kr.:

| Description | Date | Amount | Balance after |
|---|---|---:|---:|
| Kontingent Kasper | 2 jul 2026 | 200,00 | 14.880,00 |
| Emil kontingent | 2 jul 2026 | 200,00 | 14.680,00 |
| Mathias Saaby | 2 jul 2026 | 200,00 | 14.480,00 |
| Christian Have | 2 jul 2026 | 200,00 | 14.280,00 |
| Overførsel *(payer not named)* | 2 jul 2026 | 200,00 | 14.080,00 |
| Kontingent - Esben C. | 1 jul 2026 | 200,00 | 13.880,00 |

**The list is cut off below the last row.** Everything below it is dated 1 July
or earlier.

### 5.1 What the bank settles

- **Dues are 200 kr. per member per month.** Six separate 200,00 credits, one
  per named member. This closes the question in `docs/RULES.md` lines 69–73:
  "800 → 1.800 kr/md" is a **club-wide monthly total**, never a per-member rate.
  `DUES_SCHEDULE` in `src/data/rules.ts` (100 before 2026-06, 200 from 2026-06)
  is confirmed correct, and 1.800 = 9 members × 200.
- **Kontingent and bøder share one account.** Nothing in the bank separates
  them. The 11.500 / 1.780 split exists only in the sheet's formulas — which is
  precisely why §3.3 matters.
- Payer names appear in the transfer text, but inconsistently
  ("Kontingent Kasper", "Emil kontingent", "Mathias Saaby", "Overførsel").

### 5.2 What the bank does **not** settle

**It does not touch the 50 kr. question**, and cannot: the account shows only
combined credits. The 50 kr. is resolved by the sheet's formulas alone.

### 5.3 A second, independent 400 kr. question

Balance immediately before the 1 July payment = `13.880 − 200 = 13.680 kr.`
The sheet and the annual report both close at **13.280 kr.** Gap: **400 kr.**,
exactly two 200 kr. dues payments.

Critically, **the sheet was last modified 2026-06-09** — before the month it
reports on had finished. The annual report (created 2026-06-25) copied that
figure. So the club's declared closing balance is a **9 June snapshot presented
as a year-end figure**, and was never reconciled against the bank.

Two live explanations, and the screenshot cannot separate them because it is cut
off:

- **(a) Two more 1 July payments sit just below the cut.** Then the pre-July
  balance was exactly 13.280, and the sheet and annual report are precisely
  right. July would stand at 8 payments (1.600) of an expected 9 (1.800).
- **(b) Two 200 kr. payments arrived 10–30 June**, after the sheet was saved.
  Then June's true receipts were 2.200, the true 30 June balance was 13.680, and
  **the annual report understates the closing balance by 400 kr.**

**(a) is the more likely of the two**, because the visible July payments cluster
on the 1st–2nd of the month; by the same pattern June's nine would have landed
1–2 June and been captured well before the 9 June save. But this is a behavioural
argument, not evidence, and it is the club's money — so it stays open.

**This is a separate matter from the 50 kr.** The 50 kr. concerns fines in
February 2026 and is settled. The 400 kr. concerns dues in June/July 2026 and is
not. Nothing links them.

### 5.4 The unattributed transfer

The 2 jul 2026 entry reading only **"Overførsel"** names no payer. It is
recorded here as **unattributable**. It is not guessed at. Of the nine active
members, five are named in July so far; this transfer is a sixth payment whose
payer is unknown from the screenshot.

---

## 6. Attributing fines to meetings

### 6.1 `attendance_records.lead` alone is NOT sufficient

Every one of Sheet2's five Lead names leads **multiple** meetings:

| Lead | `attendance_records.id` with that lead | Candidates |
|---|---|---:|
| Lukas | 9, 22 | 2 |
| Esben | 7, 16, 21, 29 | 4 |
| Oskar | 6, 15, 23 | 3 |
| Emil | 2, 10, 24 | 3 |
| Saaby | 5, 14, 25 | 3 |

So a `lead`-only join is **ambiguous 2-to-4 ways per column**. It must not be
used on its own. `meeting_date` is NULL on all 29 rows, so it cannot help.

### 6.2 It becomes unique once `created_at` is used as a date proxy

`attendance_records.created_at` is when the row was inserted. Records 1–20 were
bulk-backfilled (all 2025-04-20 or earlier) and carry no date signal. From 21
onward the timestamps are spread out and track the meetings:

| id | # | Lead | `created_at` | Location |
|---|---|---|---|---|
| 21 | 21 | Esben | 2025-05-31 | Bjælkehuset |
| 22 | 22 | Lukas | 2025-08-30 | Tivolihallen |
| 23 | 23 | Oskar | 2025-10-10 | Café Lindevang |
| 24 | 24 | Emil | 2025-11-21 | Les St Jacques |
| 25 | 25 | Saaby | 2026-02-05 | Marv og Ben |
| 26 | 26 | Anders | 2026-02-21 | Le Petit Rouge |
| 27 | 27 | Rasmus | 2026-04-24 | Restaurant Tokyo |
| 28 | 27 | *(empty)* | 2026-04-24 | *(empty)* |
| 29 | 28 | Esben | 2026-06-26 | Propaganda |

Within the sheet's actual-fines window (Juni 25 – Februar 26) **each of the five
Lead names occurs exactly once**, and in the same order as the fine months. The
mapping resolves:

| Sheet1 month | Lead column | → `record_id` | Confidence |
|---|---|---:|---|
| Juni 25 | Esben Lead | **21** | formula C2 + ordering |
| August 25 | Lukas Lead | **22** | formula C4 + ordering |
| Oktober 25 | Oskar Lead | **23** | ordering + unique value |
| November 25 | Emil Lead | **24** | ordering + unique value |
| Januar 26 | Saaby Lead | **25** | ordering + unique value |
| Februar 26 | *(none)* | **26?** | **unconfirmed** — see §8 |

The two formula-anchored rows agree with the `created_at` ordering, which is a
real cross-validation: two independent methods, same answer.

**Caveat:** `created_at` is a database insert time, not a meeting date. The
alignment slips by up to a month in both directions (record 21 created 31 May,
fines booked June; record 25 created 5 Feb, fines booked January). It is reliable
for *ordering*, and must not be written into `meeting_date`.

The Februar 26 row has a natural candidate — **record 26, Anders Lead, created
2026-02-21**, the only meeting in that month with no Sheet2 column, and Anders is
the one Lead with no column. That fits perfectly, but nothing in the sheet says
so. It is a hypothesis, not a finding.

### 6.3 Member names do not fully map

Sheet2 mixes first names and surnames. The database uses first names only:

| Sheet2 | DB `member_name` | Basis |
|---|---|---|
| Kasper, Emil, Mads, Saaby, Esben | same | direct |
| **Holst** | **Rasmus** | annual report slide 1: "Rasmus Holst, Næstformand" — high confidence, unconfirmed |
| **Tørring** | **unknown** | one of Anders / Lukas / Oskar / Have |

On Tørring: his only fine is 80 kr. at meeting 21, and 80 is reachable only as
`50 + 5×6` (late, 6 minutes) — an offence requiring **presence**. Record 21's
attendance lists Anders, Esben, Lukas, Rasmus present. Esben led; Rasmus is
Holst, fined separately. That leaves **Anders or Lukas**, and Lukas is called
"Lukas" elsewhere in this very sheet — so **Tørring is most likely Anders**.
But record 21 holds only 4 attendance rows and no absences at all, so the roster
is incomplete and the constraint is weak. **Not safe to import on.**

Full DB roster (10): Anders, Emil, Esben, Have, Kasper, Lukas, Mads, Oskar,
Rasmus, Saaby. Sheet2 names 7. Bank names Christian Have and Mathias Saaby.

---

## 7. Rule and minutes cannot be recovered — the real import blocker

`public.fines` requires, all `NOT NULL`:
`record_id`, `member_name`, `rule_id`, `minutes`, `amount_kr`.

Sheet2 stores **per-member-per-meeting totals only**. There is no record of
which offence produced them, and the regulation allows several fines per member
per meeting (one per offence). `F4 = {=60+50}` proves bundling happens.

Against `FINE_RULES` (200 udeblivelse / 100 sent-afbud / 50 + 5·min for-sent /
50 drikkevare / 50 skaal), most cells are ambiguous:

| Amount | Possible decompositions | Unique? |
|---|---|---|
| 60 | `for-sent` 2 min | **yes** |
| 70 | `for-sent` 4 min | **yes** |
| 75 | `for-sent` 5 min | **yes** |
| 80 | `for-sent` 6 min | **yes** |
| 95 | `for-sent` 9 min | **yes** |
| 50 | `drikkevare` **or** `skaal` **or** `for-sent` 0 min | no — 3 ways |
| 100 | `sent-afbud` **or** `drikkevare+skaal` **or** `for-sent` 10 min | no |
| 105 | `for-sent` 11 min **or** 50-rule + `for-sent` 1 min | no |
| 155 | `for-sent` 21 min **or** `drikkevare+skaal+for-sent` 1 min | no |
| 185 | `for-sent` 27 min **or** `sent-afbud` + 50-rule + `for-sent` 7 min | no |
| 200 | `udeblivelse` **or** `for-sent` 30 min **or** three-rule combos | no |

Attendance narrows some — Mads was **present** at record 22, so his 200 there
cannot be `udeblivelse`; Kasper has no attendance row for record 21 and his 100
there fits `sent-afbud`. But narrowing is not determining.

**Conclusion: `fines` cannot be faithfully populated from this sheet.** Not
because of the 50 kr., but because `rule_id` and `minutes` do not exist in the
source for roughly two thirds of the cells. Inventing them would put fabricated
offence records against named members' names — worse than importing nothing.

---

## 8. Proposed import — as data

### 8.1 `payments` — READY (with one flagged row)

`payments` has **no member column** (`id, month, amount_kr, bank_balance_kr,
note, confirmed_by, created_at`). The schema is inherently a **monthly
aggregate**, so per-transfer rows are not representable without a schema change.

That is also the right shape for reconciliation: `bank_balance_kr` per month is
directly comparable to the running balance printed on a statement like §5's, and
matches the sheet's `Faktisk beholdning` column one-to-one. Per-member transfers
would reconcile against nothing the club currently keeps.

| `month` | `amount_kr` | `bank_balance_kr` | `note` |
|---|---:|---:|---|
| 2025-06-01 | 800 | 800 | |
| 2025-07-01 | 800 | 1600 | |
| 2025-08-01 | 800 | 2400 | |
| 2025-09-01 | 800 | 3200 | |
| 2025-10-01 | 800 | 4000 | |
| 2025-11-01 | 800 | 4800 | |
| 2025-12-01 | 800 | 5600 | |
| 2026-01-01 | 800 | 6400 | |
| 2026-02-01 | 2480 | 8880 | 700 kontingent + 1545 + 235 bøder (sheet formula E10) |
| 2026-03-01 | 800 | 9680 | |
| 2026-04-01 | 900 | 10580 | |
| 2026-05-01 | 900 | 11480 | |
| 2026-06-01 | 1800 | 13280 | **PROVISIONAL** — 2026-06-09 sheet snapshot; bank shows 13.680 before 1 Jul (§5.3) |

Total `amount_kr` = **13.280**, matching `E29` and the annual report.

Rows 1–12 (through Maj 26, cumulative 11.480) are unambiguous and can be
imported as final. The June row is correct as far as the sheet knows but is a
9 June snapshot; it may need to become 2200 / 13680. Recommend importing it
**with the note**, rather than withholding it — omitting it would leave
`actualBalance` wrong by 1.800 rather than possibly wrong by 400.

### 8.2 `fines` — BLOCKED, do not import

For the record, this is the complete data the sheet supports — 17 cells,
1.730 kr. `rule_id` and `minutes` are marked `??` because they are **not
present in the source** (§7):

| `record_id` | Meeting | `member_name` | `amount_kr` | `rule_id` | `minutes` |
|---:|---|---|---:|---|---|
| 22 | #22 Lukas / Tivolihallen | Kasper | 105 | ?? | ?? |
| 22 | | Emil | 50 | ?? | ?? |
| 22 | | Rasmus *(Holst)* | 50 | ?? | ?? |
| 22 | | Mads | 200 | ?? (not `udeblivelse` — present) | ?? |
| 21 | #21 Esben / Bjælkehuset | Kasper | 100 | ?? (fits `sent-afbud`) | ?? |
| 21 | | Rasmus *(Holst)* | 95 | `for-sent` | 9 |
| 21 | | **?? *(Tørring)*** | 80 | `for-sent` | 6 |
| 23 | #23 Oskar / Café Lindevang | Emil | 75 | `for-sent` | 5 |
| 23 | | Saaby | 75 | `for-sent` | 5 |
| 23 | | Esben | 155 | ?? | ?? |
| 24 | #24 Emil / Les St Jacques | Saaby | 200 | ?? | ?? |
| 24 | | Esben | 70 | `for-sent` | 4 |
| 25 | #25 Saaby / Marv og Ben | Kasper | 60 | `for-sent` | 2 |
| 25 | | Emil | 60 | `for-sent` | 2 |
| 25 | | Emil | 50 | ?? | ?? |
| 25 | | Mads | 185 | ?? | ?? |
| 25 | | Saaby | 60 | `for-sent` | 2 |
| 25 | | Esben | 60 | `for-sent` | 2 |
| **26?** | **#26 Anders / Le Petit Rouge** | **??** | **50** | ?? | ?? |

(Emil's Saaby-Lead 110 is split into 60 + 50 per formula `F4`. Total of the 18
listed known-amount rows = 1.730; the final row is the unattributed 50.)

Six rows have a determinable rule. Twelve do not. Two have no usable
`member_name`. One has no confirmed `record_id` **and** no `member_name`.

**Recommendation: import nothing into `fines` today.** A partial import would
seed the members' page with invented offences. If the club wants the totals
visible before the detail exists, that is a product decision (an
`ukendt`/unspecified rule, or a per-member opening-balance concept) and needs
Lukas's agreement — it is not a data-cleaning judgement to make quietly.

### 8.3 Not to be imported

- **`Forventede bøder`** (Marts–Juni 26: 146, 132, 118, 107; total 503) are
  **projections**, not charges. The declining series is a forecast. They must not
  enter `fines`.
- **Months Juli 26 – August 27** in Sheet1 are projection rows only; their
  `Faktisk beholdning` of 13.280 is a carried-forward constant, not data.

---

## 9. Everything still uncertain, and the question Lukas must answer

| # | Uncertainty | Impact | **Question for Lukas** |
|---|---|---|---|
| 1 | **Who owes the 50 kr.** Known: not Emil (§3.3); already paid. | Per-member fine history only. No balance effect. | Which member, and at which meeting? Most likely a fine from the February 2026 meeting at Le Petit Rouge that never got its own column in the grid. |
| 2 | **Was the Februar 26 fine from meeting #26 (Anders Lead)?** | Sets `record_id` for that fine. | Was there a fine at the Le Petit Rouge dinner in February? |
| 3 | **The 400 kr.** Bank shows 13.680 before 1 July; sheet says 13.280. | Annual report's closing balance may understate by 400. | **Scroll the statement two rows further back. If the next entries are dated 1 July, the report is exactly right. If they are dated in June, the closing balance should be 13.680.** |
| 4 | **Which offences produced each fine amount** (12 of 18 cells). | Blocks the entire `fines` import. | Do the Leads still have their notes from those five dinners — or is the amount all that survives? |
| 5 | **"Tørring" is which member?** Best guess Anders; evidence weak. | 80 kr. unattributable. | Who is Tørring? |
| 6 | **"Holst" = Rasmus?** From the annual report's "Rasmus Holst". | 145 kr. | Confirm. |
| 7 | **February 2026 kontingent was 700, not 800** — one member short 100 kr. | Possibly 100 kr. of dues never collected. | Did someone miss February, and was it ever paid? |
| 8 | **April and Maj 26 received 900** against 800 charged. | Suggests a 9th member joining ~April, or February arrears repaid. | When did the 9th member join and start paying? |
| 9 | **The unnamed "Overførsel"** of 2 jul 2026. | One July payment unattributed. | Whose transfer was that? |
| 10 | **Are fines still being recorded?** Actual fines stop at Februar 26; meetings #27 (April) and #28 (June) have none. | 4+ months of fines may be uncollected. | Were there really no fines since February, or did recording just stop? |

---

## 10. Repo issues found (read-only — **not** changed)

**`src/data/ledger.ts` lines 8–10 state the wrong explanation** and should be
corrected by whoever owns that file:

> `Storing a total is how the old sheet came to disagree with itself by 50 kr —`
> `the monthly column said 1,780 while the grid beneath it summed to 1,730.`

The sheet does **not** disagree with itself. `C29` is a live
`SUM(Finanser[Faktiske bøder])` over its own column and is correct at 1.780.
The 1.730 comes from a *different sheet* covering *five of six* meetings. The
real failure mode is a **missing dimension in the breakdown**, not a stored
total — and a derived-totals design does not prevent it. If the sixth Lead
column is never entered, a derived total is short by exactly the same 50 kr.
That is worth saying plainly, because the current comment claims the class of
bug is now impossible when it is not.

Same story appears in `src/pages/Oekonomi.tsx:21`, `src/data/ledger.test.ts:92`,
and `tasks/T050-finance-automation.md` lines 145 and 173.

`tasks/T050-finance-automation.md` lines 36–40 **already located** the 50 kr. at
Februar 26 with no matching column — that part was right. What is new here is
that the February payment formula proves the 50 kr. was **collected**, so it is
an attribution gap rather than an error, and the annual report is vindicated.

**`docs/RULES.md` lines 69–73** is confirmed correct by the bank (§5.1) and can
now cite the 2026-07-27 statement rather than reasoning.

**Data hygiene:** `attendance_records` **id 28** is a junk row — duplicate
`meeting_number` 27, empty `lead`, empty `main_location`, zero attendances,
created within 0.13 s of id 27. It is a valid FK target and should be cleaned up
before `fines.record_id` starts pointing at meetings.

**Deck labelling:** slide 8 of `1gOZ…` reads "BALANCE PR. 31. MAJ 2026 —
13.280". The sheet puts 11.480 at Maj 26 and 13.280 at Juni 26. The figure is
the **June** one. The other copy (`1Fag…`) labels it "juni 2026" correctly.

---

## 11. What was imported — T068, 2026-07-29

Executed against production `urlabzyihqrsdeasvrfe`. **Insert-only**: no `UPDATE`
and no `DELETE` was issued against any table, and `attendance_records`,
`attendances`, `news`, `events`, `profiles` and `user_member_mapping` were
counted before and after and are unchanged.

The statements are committed as
`supabase/migrations/20260729120000_finance_history_import.sql`, so the import
is reviewable in a diff. Both inserts end in `on conflict … do nothing` against
the tables' own unique keys — `payments (month)` and
`fines (record_id, member_name, rule_id)` — so re-running is a no-op. That was
verified by re-running a sample of both after the fact: 0 rows inserted, counts
and sums unchanged. `do nothing` rather than `do update` is deliberate: once the
treasurer corrects a row in the app, a re-run must not silently reassert the
spreadsheet over him.

To reverse it, exactly and only:

```sql
delete from public.fines where rule_id = 'historisk';
delete from public.payments where month between '2025-06-01' and '2026-06-01';
```

### 11.1 What the source re-verification found

The sheet was re-read from the `.xlsx` export rather than trusting §2–§3.
Everything material re-verified:

- **`C2 = 100+95+80` and `C4 = 105+50+50+200` are real**, present as formulas,
  and are the Esben and Lukas Lead columns typed in top-to-bottom order. §3.2's
  claim stands, and with it the Lead-column-to-meeting mapping. This was the one
  claim the import was not allowed to take on trust, because a wrong mapping puts
  a fine on the wrong evening.
- The Sheet2 grid is unchanged from §2, and `E29`/`C29` are still live `SUM()`s
  at 13.280 and 1.780.
- `Faktisk beholdning` is the **exact** running total of `Indbetalinger` across
  all thirteen months — checked in the sheet and again in the database after
  writing.

One methodological note for whoever repeats this: the `.xlsx` arrives as
base64 through the Drive tool, and transcribing ~14 kB of it by hand corrupts
it. Check `zipfile.testzip()` before believing a single cell. Here exactly one
entry failed CRC, the damage was localised to a projection row (`G27`), and the
import-relevant cells were then cross-validated against the CRC-intact
`sheet2.xml` and against the sheet's own live sums before being used.

### 11.2 `payments` — 13 rows, 13.280 kr.

`amount_kr` from `Indbetalinger`, `bank_balance_kr` from `Faktisk beholdning`.
`Kontigenter` (charged, not received) and `Forventede bøder` (a forecast) were
not imported; §8.3 still applies.

Read back from the database after writing:

| check | value |
|---|---|
| rows | 13 |
| `sum(amount_kr)` | **13.280** — matches `E29` and the annual report |
| final `bank_balance_kr` | 13.280 |
| `bank_balance_kr` = running total of `amount_kr`, all 13 months | **yes** |

The Februar 26 and Juni 26 rows carry their caveats in `note`, per §8.1: the
February kontingent of 700 is 100 short of the 800 charged, and the June balance
is the 2026-06-09 snapshot that §5.3's 400 kr. question hangs on.

### 11.3 `fines` — 17 rows, 1.730 kr.

All 17 carry **`rule_id = 'historisk'`** and **`minutes = 0`**. §7 is right that
the offence cannot be recovered, but its conclusion — import nothing — was
overtaken: the money is knowable to the krone even where the offence is not, and
recording the amount honestly labelled beats recording nothing. `historisk` is
defined in `src/data/rules.ts` and deliberately kept **out of `FINE_RULES`**, so
it can never be offered in the capture UI as something to charge a member under.

Read back, per meeting, against Sheet2's own column sums:

| `record_id` | Meeting | Rows | DB total | Sheet column | |
|---:|---|---|---:|---:|---|
| 21 | #21 Esben / Bjælkehuset | Anders 80, Kasper 100, Rasmus 95 | 275 | 275 | ✓ |
| 22 | #22 Lukas / Tivolihallen | Emil 50, Kasper 105, Mads 200, Rasmus 50 | 405 | 405 | ✓ |
| 23 | #23 Oskar / Café Lindevang | Emil 75, Esben 155, Saaby 75 | 305 | 305 | ✓ |
| 24 | #24 Emil / Les St Jacques | Esben 70, Saaby 200 | 270 | 270 | ✓ |
| 25 | #25 Saaby / Marv og Ben | Emil 110, Esben 60, Kasper 60, Mads 185, Saaby 60 | 475 | 475 | ✓ |
| | | **17 rows** | **1.730** | **1.730** | ✓ |

And against Sheet2's row totals — the second axis, so the grid reconciles both
ways exactly as it does in the sheet:

| Member | DB | Sheet | Member | DB | Sheet |
|---|---:|---:|---|---:|---:|
| Kasper | 265 | 265 | Saaby | 335 | 335 |
| Emil | 235 | 235 | Esben | 285 | 285 |
| Rasmus *(Holst)* | 145 | 145 | Anders *(Tørring)* | 80 | 80 |
| Mads | 385 | 385 | | | |

`Holst = Rasmus` and `Tørring = Anders` were **answered by Lukas on 2026-07-29**,
closing §9's questions 5 and 6. §6.3's warning that the Tørring evidence was too
weak to import on was correct at the time; it is no longer the basis.

**Emil's 110 kr. at record 25 is one row, not two.** The sheet's cell is
`{=60+50}` — two bundled offences (§2). The table's unique key is
`(record_id, member_name, rule_id)`, which is the regulation's
one-fine-per-offence-per-meeting rule, so two rows would need two *different*
rule ids — and with both offences unknown there is no honest pair. Inventing two
to satisfy a constraint would fabricate precisely what this import refuses to
guess. The krone total is identical either way.

### 11.4 What was deliberately NOT imported

**The Februar 26 fine of 50 kr.** It is real and it was collected — §3.3's
`E10 = 700+1545+235` proves the money moved, and it is inside the 1.545 lump, so
it is not Emil's. But Sheet2 never got a sixth column, so the fine has **no
member and no meeting**. Record 26 (Anders Lead, Le Petit Rouge, created
2026-02-21) fits perfectly and remains a hypothesis, not a finding. A fine on
the wrong evening against the wrong member is worse than a fine not yet entered,
so it stays out.

**This is the entire gap: imported fines total 1.730, the year's fines were
1.780, and the difference is this one unattributed 50 kr.** It is an attribution
gap, not a missing krone — the club has the money.

**Every fine's offence.** Recorded as `historisk` rather than guessed, per §7.

**`Forventede bøder` and the Juli 26 – August 27 projection rows**, per §8.3.

### 11.5 How this renders

`/oekonomi` never selects `rule_id`, so `historisk` cannot blank or break
anything there; `src/data/rules.ts` now also exports `describeRule()`, which
names an unknown id instead of rendering an empty cell beside an amount. Tests
cover both, plus the imported books end to end.

All 28 meetings are still undated, so **all 1.730 kr. counts towards what the
club is owed but sits outside the month-by-month ledger**, and the page states
the amount it is leaving out rather than dumping it into an arbitrary month.
That is designed behaviour (§6.2's caveat: `created_at` orders meetings but must
never be written into `meeting_date`), and it resolves itself as Lukas supplies
the real dates on `/anciennitet`.

### 11.6 Still open after this

Unchanged and still needing Lukas: **3** (the 400 kr. — scroll the bank statement
two rows further back), **4** (do the Leads still have their notes, which is the
only thing that could ever replace `historisk` with real offences), and **7**,
**9–10**. Questions **5 and 6 are now answered** and were used.

**Superseded on 2026-07-29 by T071 — see §14.** Questions **1–2** (whose 50 kr.,
and which dinner) are answered: it was Lukas's own, and it was the Le Petit Rouge
dinner, record 26, on 2026-02-21. Question **8** (when did the ninth member join)
is answered: June 2026. Both came from Lukas the same day.

§10's repo issues were partly overtaken by events: `src/data/ledger.ts` and
`src/pages/Oekonomi.tsx` have since been corrected to describe the 50 kr.
accurately, and the junk `attendance_records` row id 28 has been deleted — the
table now holds 28 rows with ids 1–27 and 29, which is why the fines could be
hung off records 21–25 without ambiguity.

---

## 12. What the sheet's own budgeting actually was — T070, 2026-07-29

Investigated because Lukas asked for the club's fine budgeting back (2026-07-29,
his words in `docs/RULES.md`), and because a projection built on a
misremembered method is worse than none.

Read as `.xlsx` again, per §1 — and the base64 hazard §11.1 warns about bit a
second time. The transcription dropped ~33 bytes inside `xl/worksheets/sheet1.xml`
alone; every other zip member inflated to a clean deflate EOF. **Feeding the
stream to `zlib` a byte at a time recovers everything before the damage** —
9.994 of 10.637 bytes here, which was all of `Faktiske bøder`, `Forventede
bøder`, `Indbetalinger` and `Forventet beholdning`. The value grid was
cross-checked independently against a `text/csv` export of the same sheet, which
preserves column alignment where the plain-text rendering does not. Both agree.

### 12.1 The `Forventede bøder` column has no formula

| Cell | Month | Content |
|---|---|---|
| D11 | Marts 26 | typed `146` |
| D12 | April 26 | typed `132` |
| D13 | Maj 26 | typed `118` |
| D14 | Juni 26 | typed `107` |
| D28 | Total | `SUM(Finanser[Forventede bøder])` → 503 |

None of D11–D14 carries an `<f>` element, and `xl/tables/table1.xml` declares
`Forventede bøder` with `totalsRowFunction="custom"` and **no
`calculatedColumnFormula`**. The four numbers were typed.

They decline by roughly 10 % a month — a constant ratio in the band 0,899–0,902
reproduces all four under rounding — but nothing in the workbook says so, and no
combination of the sheet's own history reproduces them: a mean over the nine
fine-months is 197,78, over twelve months 148,33, and neither rounds to 146.
**The intent is not recoverable, and it is not worth guessing.**

### 12.2 The column that *does* have a formula

```
G2 = B2+C2+D2            → 1.075
G3 = G2+C3+B3+D3         → 1.875
```

`Forventet beholdning` is a running total of **Kontigenter + Faktiske bøder +
Forventede bøder**, kept strictly apart from `Faktisk beholdning`, which is the
running total of `Indbetalinger` alone. That separation — a budgeted balance
beside a real one, never mixed — is the club's own design and is what T070
rebuilt.

### 12.3 The forward projection budgets no fines at all

`Forventede bøder` is empty for every month from Juli 26 to August 27, and
`Forventet beholdning` in those rows advances by exactly the kontingent:
13.683 → 15.483 → 17.283 … → 38.883, i.e. +1.800 a month. So the column was
never a forecast running ahead of the club. **It covered the four months between
the last recorded fine (Februar 26) and the day the sheet was last saved
(2026-06-09)** — an accrual for evenings that had happened and never been
written down, not a projection of evenings to come.

That matters for what "continue doing this" means: the club's *structure* is
worth keeping and its *arithmetic* has to be supplied. See `src/data/projection.ts`.

---

## 13. Why the club reads as 680 kr. ahead — T070, 2026-07-29

Lukas's hypothesis was that fines explain it. **They do not, and they push the
other way.** Measured against production `urlabzyihqrsdeasvrfe` (SELECT only).

| | kr. |
|---|---:|
| What `/oekonomi` expects (9 payers × the §4 rate, 13 months) | 12.600 |
| Fines inside that expectation | **0** |
| Received (`sum(payments.amount_kr)`) | 13.280 |
| **What the page reports** | **680 ahead** |

Against what the club actually charged, from the sheet's own columns:

| | kr. |
|---|---:|
| `Kontigenter` charged, Juni 25 – Juni 26 (800 × 12 + 1.800) | 11.400 |
| `Faktiske bøder` | 1.780 |
| Truly owed | 13.180 |
| Received | 13.280 |
| **Truly ahead** | **100** |

The 580 kr. between the two figures is two bookkeeping gaps pulling in opposite
directions, and they very nearly cancel:

| | kr. effect on the reported gap |
|---|---:|
| Dues charged to **9** payers where the club charged **8**, 12 months × 100 kr. | +1.200 |
| The 1.730 kr. of imported fines, kept out of every month because all 28 meetings are undated | −1.730 |
| The Februar 26 fine of 50 kr., never imported (§11.4) | −50 |
| **Net** | **−580** |

Two consequences worth stating plainly:

1. **If the fines could be placed in months, the club would read as 1.050 kr.
   *behind*, not ahead** (14.330 expected against 13.280 received). Fines are
   the single largest thing missing from the expected line, and putting them
   back moves the club from ahead to behind.
2. **The real surplus is about 100 kr.**, and the sheet says where it came from:
   Februar 26 collected 700 against 800 charged (−100), while April and Maj 26
   each collected 900 against 800 (+100 each).

The **ninth payer is the cause of the +1.200**. §9 Q8 already noticed the club
receiving 900 from April 26 and asked when the ninth member joined; `/oekonomi`
charges today's nine members across the whole history because the club has never
recorded a joining date, and the page says as much in `Hvem betaler kontingent`.
Answering Q8 is what fixes it — a per-month paying count, not more arithmetic.

**Still open and untouched by this:** §5.3's 400 kr. The Juni 26 row is the
2026-06-09 snapshot. If two more dues payments landed in June rather than on
1 July, received is 13.680 and the page would report 1.080 kr. ahead instead of
680. Neither reading changes the decomposition above.

---

## 14. The meetings have dates — T071, 2026-07-29

All 28 meetings were undated, which is why §13 had to book 1.780 kr. of fines as
*outside* every month. **17 of the 28 now carry a date. 11 do not, on purpose.**

Source: Lukas's Outlook calendar. The club's invitations and his own all-day
blocks for it are there, under subjects that vary a great deal —
`Erhvervsklubben`, `Erhvervsklub`, with and without `#N`, with and without a
venue, and twice with no number at all. The search had to be run per date window
and per organiser; a single wide query silently truncates and misses events (the
2024-10-12 invitation does not come back from a 2023–2026 search but does from a
2024-only one).

### 14.1 The trap: `#N` in a subject is not `meeting_number`

**The club's own numbering ran one ahead of the database's through the middle of
the history, then closed the gap again.** This is not a suspicion, it is visible
in two invitations whose bodies name the venues:

| Calendar subject | Date | Body names | Database row |
|---|---|---|---|
| `Erhvervsklub #18` | 2024-10-12 | Stenosgade 3, **Aamanns 1921**, **St. Pauli 54**, **ÅBEN i Kødbyen** | record **17** — lead Kasper, main `Aamanns`, post `St. Pauli + ÅBEN` |
| `Erhvervsklub #13 - Ekskursion til Odense` | 2024-01-20 | **RESTAURANT HOS**, Kongensgade 65, Odense | record **12** — lead Mads, main `Hos`, pre `DSB`, post `Sir Club` |

Both are exact venue-for-venue matches to a record numbered one lower. By
2025-11-21 the two numberings agree again (`Erhvervsklub #24` is record 24). So
**every date below was matched on lead + venue + ordering**, and the number in
the subject was used only as a tiebreak once lead and venue already agreed.
Anyone repeating this work who joins on `#N` will silently shift a third of the
history by one meeting.

### 14.2 The 17 that were written

| # | Date | What corroborated it |
|---:|---|---|
| 5 | 2022-10-29 | Subject `#5 - Restaurant Kronborg`; location Brolæggerstræde 12 **is** Restaurant Kronborg; organiser Saaby = lead |
| 6 | 2023-01-21 | Organiser Oskar = lead; starts at the private Ægirsgade 29, and the record says `Privaten inden med papvin`; the only club event between the confirmed 5 and 7 |
| 7 | 2023-03-11 | Subject `#7 - Restaurant Møntergade`; location Møntergade 19; organiser Esben = lead |
| 9 | 2023-08-05 | Subject `#9`; body: bubbles at his own Asminderødgade 3 (`Privaten`), then **Hansens Familiehave**; organiser Lukas = lead |
| 10 | 2023-09-09 | Subject `#10`; body: his own Blegdamsvej 74C (`Privaten`), then **Restaurant Palægade**; organiser Emil = lead |
| 11 | 2023-11-11 | Organiser Rasmus = lead; venue still `TBD` in the invitation, so no venue match — but the only club event between the confirmed 10 and 12, and an evening at 2.000 kr. a head fits Punk Royal |
| 12 | 2024-01-20 | **RESTAURANT HOS, Odense** = main `Hos`; organiser Mads = lead; `DSB` is the train there and `Sir Club` is in Odense. Subject says 13 |
| 13 | 2024-03-09 | Location **Seaside Toldboden** = pre `Seaside`; organiser Anders = lead. Subject carries no number at all (`#X`) |
| 17 | 2024-10-12 | **Aamanns 1921 / St. Pauli 54 / ÅBEN** and Stenosgade 3 = `Privaten`; organiser Kasper = lead. Subject says 18 |
| 21 | 2025-05-31 | All-day club block that date; record created the same day; lead Esben = the Esben Lead column, §3.2 |
| 22 | 2025-08-30 | Club block that date **and** Saaby's `Placeholder \| Erhvervsklub` invitation to the club for it; record created the same day; lead Lukas = the Lukas Lead column, §3.2 |
| 23 | 2025-10-11 | Subject `#23`; preceded by Saaby's `Erhvervsklub \| Check-in` call the afternoon before, which is when the record was created; lead Oskar = the Oskar Lead column, §3.2 |
| 24 | 2025-11-21 | Subject `#24 \| Fredagsbar`; organiser Emil = lead; his own Nordre Frihavnsgade 19 = `Privaten`; a Friday, and the invitation calls the Friday format new; lead Emil = the Emil Lead column, §3.2 |
| 25 | 2026-01-24 | Subject `#25`; lead Saaby = the Saaby Lead column, which §3.2 pins to **Januar 26** — decisive, because the record was not created until 2026-02-05 and `created_at` alone would have left February open |
| 26 | 2026-02-21 | Subject `#26`; record created the same day; lead Anders |
| 27 | 2026-04-24 | Club block 16.00–23.30 local that date; record created that afternoon; lead Rasmus |
| 28 | 2026-06-26 | Subject `#28 - Generalforsamling`; body: meet at Esben's Sylviavej 26 (`Privaten`), then dinner at **Propaganda**; organiser Esben = lead; record created the same day |

**The spreadsheet is a second, independent source for records 21–25, and it
agrees.** §3.2 pins each of Sheet2's five Lead columns to a month of Sheet1 by
two verbatim formulas. Those months are Juni 25, August 25, Oktober 25,
November 25, Januar 26, under leads Esben, Lukas, Oskar, Emil, Saaby. The
calendar — which has never seen that spreadsheet — dates records 21–25 to
meetings led by Esben, Lukas, Oskar, Emil and Saaby, in that order, in May,
August, October and November 2025 and January 2026. Four land in the sheet's own
month exactly. The fifth is a dinner on **31 May**, whose 275 kr. of fines the
ledger books in its first month, June. Two sources built from nothing in common
agreeing on five leads and five months is what makes these five safe rather than
merely plausible.

### 14.3 The 11 that were refused, and why

A missing date is visible in the app. A wrong one is not, and it puts a fine in
the wrong month and quarter — the exact error this whole effort has been
avoiding. So:

| # | Why not |
|---:|---|
| 1, 2, 3, 4 | **No calendar evidence at all.** Nothing club-shaped in Lukas's calendar before 2022-10-29. The club pre-dates the invitations he still holds |
| 8 | One candidate (an all-day block, 2023-06-10) between the confirmed 7 and 9 — but it is titled `Erhvervsklub (Lukas)` while record 8's lead is **Have**. A conflicting signal is not a corroborating one |
| 14, 15, 16 | **Three records, one candidate.** Between the confirmed 13 (2024-03-09) and 17 (2024-10-12) the database has three meetings and the calendar has exactly one event, 2024-06-15. Two of the three are simply not there, and nothing says which |
| 18 | Identified beyond doubt — `London Erhvervsklub`, and record 18's venues are The Grafton, King Williams the Fourth and `Pubs i London` — but the block is **all-day across 2025-01-18 and 19**, and nothing decides which. The month is certain (January 2025); the day is not |
| 19, 20 | Two candidates in the right order (2025-03-08, 2025-04-26), but both are bare all-day blocks: no organiser but Lukas, no location, no body. They match only by position in a run assumed complete — and the 2024 gap above **proves this calendar is not complete**. Position alone is not corroboration |

### 14.4 The Februar 26 fine went in

Lukas answered §9 Q1 on 2026-07-29: **the 50 kr. was his own**, a voluntary fine
he transferred himself, as treasurer, because a year in which the treasurer
incurred no fine at all looked implausible. That is also why he is the one member
with no row in Sheet2's grid.

Q2 — which dinner — the dating answers. Exactly one meeting falls in February
2026: record 26, 2026-02-21, lead Anders, Le Petit Rouge. Record 25 is not a
second candidate, because §3.2 puts its 475 kr. in **Januar 26**.

Imported in the same shape as the other seventeen, `rule_id = 'historisk'`,
because the offence is no more known here than for any of them.

```
fines: 17 rows / 1.730 kr.  ->  18 rows / 1.780 kr.   ✓ annual report
```

Fines now sit in the months the sheet says they do:

| Month | Meeting | Lead | kr. | Sheet1 `Faktiske bøder` |
|---|---:|---|---:|---|
| 2025-05 | 21 | Esben | 275 | Juni 25 (dinner 31 May, booked the month after) |
| 2025-08 | 22 | Lukas | 405 | August 25 ✓ |
| 2025-10 | 23 | Oskar | 305 | Oktober 25 ✓ |
| 2025-11 | 24 | Emil | 270 | November 25 ✓ |
| 2026-01 | 25 | Saaby | 475 | Januar 26 ✓ |
| 2026-02 | 26 | Anders | 50 | Februar 26 ✓ |

### 14.5 The ninth member, and the receivable the app cannot express

Lukas, 2026-07-29, answering §9 Q8: **the club became nine members in June 2026.**
Months before 2026-06 had **eight** paying members.

And a second fact that is not the same thing: **the ninth must still buy in
retroactively.** He is treated as though he had paid kontingent all along, but he
has not actually paid. That is a **receivable** — money owed to the club and not
in the bank — and **nothing in the schema can hold it.** `payments` records money
that moved, by month, with no member on it, and must keep meaning exactly that.
`members` carries `name`, `status`, `note` and a `created_at` that is when the row
was written, not when the man joined.

**Not fixed here.** Adding a joining date is a schema change and needs Lukas
first. What it would take, in full: a nullable `joined_on date` on `members`
(additive, so RLS and the CI seed are untouched); `buildLedger` counting payers
per month from it instead of being handed one roster length; the buy-in modelled
as its own receivable rather than smuggled into `payments`; and the ledger tests
extended to a roster that changes size mid-history. Until that exists, `/oekonomi`
names who it charges in `Hvem betaler kontingent`, which is the honest version of
being wrong.

### 14.6 What this does to §13

§13's decomposition was built on all 28 meetings being undated and the 50 kr.
never imported. Both have changed, so the two figures move:

| §13 line | Then | Now |
|---|---:|---:|
| Fines kept out of every month because the meeting is undated | −1.730 | **−545** (the 11 still-undated meetings carry no fines at all; all 1.780 kr. now sits on dated meetings) |
| The Februar 26 fine, never imported | −50 | **0** — imported |
| Dues charged to 9 payers where the club charged 8 | +1.200 | unchanged until `members` can carry a joining date |

The 1.780 kr. of fines is now inside the month-by-month ledger in full, which is
what §13 predicted would move the club **from ahead to behind**. The remaining
distortion is the payer count, and that is §14.5, not the meeting dates.
