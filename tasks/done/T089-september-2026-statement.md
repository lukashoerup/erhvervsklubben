# Task: T089 — September 2026 into the books, and a month of red CI

**Status:** done 2026-09-05. Branch `claude/ek-account-balance-update-kx7ffo`.

## The ask
Lukas, 2026-09-05, with a screenshot of the club's account: *"Vil du opdatere data på
hvor mange penge der er på kontoen i EK? Se screenshot. Se også lige at alt kører og er
som det skal være."*

Two halves: put the new balance into the club's books, and check that everything is
running.

## What the screenshot shows
*Erhvervsklub konto*, saldo **18.680,00 kr.**, *Kommende betalinger 0,00*, and under
*September 2026* six transfers of 200,00 with the running balance beside each:
Christian Have 04.09 (→ 18.680), Mathias Saaby, Overførsel, Kontingent Kasper, Emil
kontingent — all 02.09 — and Anders Tørring, cut off at the bottom edge. The August row
holds 16.880 on 04.08, and 18.680 − 16.880 = 1.800 = nine × 200. Six seen, three
inferred: Rasmus, Lukas and Esben, who paid before the 4th in August too. Recorded as
inferred, in the row's note and in `docs/finance-reconciliation.md` §17.2.

## What was done

**1. One row into production `payments`** — `2026-09-01 / 1.800 / 18.680`, guarded on
the club's ten names and `on conflict (month) do nothing`, the same shape as the
August row. Applied via the Supabase connector as version `20260905103847` and
committed in the same hour as
`supabase/migrations/20260905103847_september_2026_statement.sql`, filename version
= database version (STATUS.md check 1, the August lesson).

**2. The migration that broke CI, guarded.** `20260808180000_adhoc_fines.sql` inserts
a fine against `attendance_records` id 30 and asserts Esben holds two ad-hoc fines
there. On a fresh database — every CI run — there is no record 30, so `supabase start`
failed on the foreign key and the `rls` job never ran, from 2026-08-08 15:52 onward.
Production had the row, so nobody saw it there. The three data statements now carry
`exists (select 1 from attendance_records where id = 30)` and the assertion block
returns with a notice when the record is absent, as `fines_settled` does when the
totals are not this club's. The schema half (column, partial index, check) is
unchanged and still applies everywhere. Production has already run this version, so
the change affects fresh stacks only.

**3. Docs.** STATUS.md: header, attendance counts, a dated September block, and three
findings the older paragraphs do not know (CI, the fine totals, the silent home
server). finance-reconciliation.md: §17 — August reconstructed from the migration's
notes, September from the screenshot, the six new fines, what is open.
`workbench/context/LEARNINGS.md`: the cross-project lesson about data migrations that
name production rows.

## Verification

* Production read back after the write: `payments` 16 rows / 18.680 kr., September
  row `1.800 / 18.680`; a second application with a sentinel note wrote **0 rows**.
* `fines` 36 / 2.875, `members` 10, `attendance_records` 29, `attendances` 271 rows /
  200 attended, `news` 11, `events` 12, `profiles` 9 — nothing else touched.
* Local: `npm test` 467 passing (33 files), `npm run build` clean, `npm run lint`
  clean. Workbench: 87 passing.
* The `rls` job could not be reproduced here — no Docker daemon in this sandbox — so
  the guard is argued from the CI log (the failing statement is the one guarded) and
  proven by CI on the push. If CI is still red on this branch, the cause is not the
  one fixed here and is written down in the run, not guessed at.
* Vercel: the production deployment of `main` (commit 31c563a, LEI code) is `READY`.
  The site never stopped; only the RLS suite was not being run.

## Checked and found wanting, not fixed here

* **The home server has been silent since 2026-08-07 05:05** — `workbench/STATUS.md`'s
  last commit. Offline or the publisher is broken; nothing in this repo depends on it.
  Needs a look at the box itself, which no cloud session can reach.
* **1.095 kr. of unbilled fines** (730 + 365). Lukas's decision, as before.
* **`bank_balance_kr` means the day-of-check balance for August and September** and
  the month-end close before that. Noted in §17.2; harmless to the page.

## Left open
* The three September transfers the screenshot does not show — one statement page.
* The August statement itself, so §17.1 stops being a reconstruction.
