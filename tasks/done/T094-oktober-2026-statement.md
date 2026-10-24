# Task: T094 — October 2026 into the books, the morning of møde #31

**Status:** done 2026-10-24. Branch `task/T094-oktober-2026`, branched from
`claude/boeder-ek-moede-5wmii6` (møde #30, never merged — see below).

## The ask
Lukas, 2026-10-24: *"Kan du opdatere informationer inden vores møde senere i dag?"* —
the day of `EK #31` in his calendar. Asked what he wanted updated and what was
missing, he sent four screenshots: *"Billeder fra banken af konto"*.

## What the screenshots show
*Erhvervsklub konto*, 24.10.2026 09.37: saldo **20.480,00 kr.**, *Kommende
betalinger 0,00*, then every transfer back to 30.07 with its running balance. October:
nine × 200 — Rasmus 29.09, Lukas 30.09, Have, Esben, Anders 01.10, Saaby, Emil, Kasper,
Overførsel (Mads) 02.10. 18.680 + 1.800 = 20.480. All seen, none inferred. Full table
and the chain from 15.080 (30.07): `docs/finance-reconciliation.md` §17.7.

## What was done
1. **One row into production `payments`** — `2026-10-01 / 1.800 / 20.480`, guarded on
   the club's ten names, `on conflict (month) do nothing`, and a read-back inside the
   block that rolls back unless payments to October sum to 20.480. Applied as version
   `20261024074128`, committed under that version.
2. **The September row was not touched.** Its note says Anders paid 02.09; the bank
   says 01.09. Overwriting a club record needs Lukas's yes, and the date changes no
   amount, so the correction is in the October row's note and §17.7.
3. **Docs.** STATUS.md (header, October, the `main` drift), finance-reconciliation.md
   §17.7, and §17.2/§17.4 marked closed where the screenshots closed them.

## Read back from production
`payments` 17 rows / 20.480 kr., October row `1.800 / 20.480`. `fines` 40 / 3.305
(1.525 outstanding), `attendances` 281 / 206, `attendance_records` 30, `members` 10,
`events` 11, `news` 11 — unchanged. Newest migration `20261024074128
oktober_2026_statement` = newest file in `supabase/migrations/` on this branch.

## Found on the way
* **`main` is behind production since 2026-09-11.** Møde #30's two migrations and the
  `moede` skill are on `claude/boeder-ek-moede-5wmii6` (CI green), applied to
  production, never merged. This branch carries them; merging it to `main` deploys,
  so that is Lukas's call.
* `task/T093-cvr-registrering` (CVR prep, docs only, CI green) is also unmerged, as is
  PR #1. Two tasks are numbered T092.

## Left for Lukas
* **Tonight's calendar row, `Erhvervsklub #31`**, says `TBD` for the venue and has no
  time or description. Lead is Have. Nothing in the mail or calendar says where — it
  needs the invitation, or Have.
* **Merge to `main`** (deploys) — yes or no.
* **1.525 kr. of fines noted, never billed** — unchanged, still his decision.
* Have's 1.100 kr. buy-in — still in the papers only until Have has agreed.
