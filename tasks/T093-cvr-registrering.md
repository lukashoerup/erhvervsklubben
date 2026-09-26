# Task: T093 — CVR registration: everything ready to press

**Status:** open 2026-09-26 — **blocked on Lukas** for the four answers below. The
registration itself is ten minutes on virk.dk with Lukas's private MitID. No agent
can or should do that step.

## The ask
Lukas, 2026-09-26: *"Kan du ikke gøre alt klar til at vi kan CVR registrere EK? Alt
der nu engang skal være klar."*

## What is ready
- `docs/cvr-registrering.md` — every field to type on virk.dk, the representative
  step, the order of everything after (bank, LEI, depot), and the recurring duties.
- The two referat drafts in the club's Drive (created 2026-09-16) are needed by the
  bank, **not** by CVR. What could be filled from the database (attendance at
  meetings #28 and #29, lead, venue, counts) and from the bank statements
  (surnames) is listed in the doc §3.1. The drafts themselves are unchanged: no
  Google Docs editor connector was available, and Drive cannot edit a doc in place.
- `npm test`, `npm run build`, `npm run lint` green on this branch (docs only).

## Findings worth knowing
- **CVR needs no documents at all** — name, address, e-mail. The referater and
  statutes are for the bank. So CVR can happen the day the four answers exist.
- **The representative's name and private address become public on cvr.dk.** That
  is why answers 1 and 4 should be the same person.
- **"Erhvervsklubben" is already a name in CVR** (at least 42267872, Frederiksberg C,
  and 41037792, Holbæk). Not confirmed whether virk.dk objects. If it does: park,
  do not rename — §14 allows statute changes only at an ordinary GF.
- **The GF draft says more than the club's own referat** in three places (dirigent's
  quorum finding, the financial-year period vs §8, "800 → 1.800 kr. pr. måned"
  read as per member). Listed in the doc §3.3 to check before signing.

## Questions for Lukas (parked)
- [ ] **1. Foreningens adresse** (public on cvr.dk) — suggestion: the treasurer's, c/o.
- [ ] **2. Foreningens e-mail** (public; receipt and CVR number go here) —
      suggestion: an address that survives a board change.
- [ ] **3. Who registers** — suggestion: Lukas.
- [ ] **4. Foreningsrepræsentant** (Digital Post; name + private address public) —
      suggestion: same person as 1.
- [ ] 5. Bank for foreningskonto + depot (fills the draft's `[pengeinstitut]`).
- [ ] 6. LEI provider and term (fills `[udbyder]`; prices in `investering-og-cvr.md` §4.1).
- [ ] 7. Who gets the trading mandate on the depot.
- [ ] 8. Surnames of Emil and Mads; confirm Anders's and Rasmus's full names (the
      bank statement truncates them).

Only 1-4 block CVR. 5-8 block the bank step.

## Decision
_(One line per answer, dated, as Lukas gives them.)_

## When the CVR number arrives
Record it in this file and in `docs/cvr-registrering.md`, add the renewal date
(+3 years) to the club's årshjul, then move this file to `tasks/done/`. The bank,
LEI and depot steps get their own task.
