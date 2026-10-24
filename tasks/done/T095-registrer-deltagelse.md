# Task: T095 — "Registrér deltagelse" did nothing on a phone

**Status:** done 2026-10-24, code only — **not live until merged to `main`**, which
deploys and so waits for Lukas. Branch `task/T095-registrer-deltagelse`, on top of
`task/T094-oktober-2026`.

## The ask
Lukas, 2026-10-24, during møde #31: *"Registrer deltagelse knappen på haves møde i
dag virker ikke. Kan du fikse den?"*

## What was wrong
The button worked; the form did not appear where he was looking. `recordFrom` set
`open = 'ny'`, and the 'ny' form is rendered at the **top** of /anciennitet, above the
anciennitet chart and "Sidst set" — while the button sits on the calendar card below
them. Reproduced in the demo build at 390 × 844 with a planned meeting dated today:
after the tap the form's top was **−1.375 px** (off-screen above), the page scrolled
from 550 to 1.507 as the form pushed content down, and the screenshot before and
after the tap were identical. On a phone that is a dead button.

Not the data: the code path that seeds the form from the calendar row (lead, date,
venue, description) and saves the record, ten attendance rows and retires the row was
correct, and its tests passed. A database read to check today's logs was declined, so
nothing in production was read for this task.

## What changed
* `Moedekalender` takes `recording` (the row being recorded) and `recordForm`, and
  renders the form **in place of that card** — the same thing "Rediger" does for a
  held meeting.
* `Anciennitet` keeps the top form for "Nyt møde" only, and "Nyt møde" now clears any
  calendar seed, so it always opens blank.
* Two tests in `Anciennitet.test.tsx`: the form lands between "Planlagte møder" and
  the first held meeting with the card gone, Annullér restores the card; and "Nyt
  møde" after opening from the calendar gives one blank form. **Both fail on the old
  code**, verified by stashing the fix.

## Verified
* `npm test` 482 passing (480 + 2), `npm run build` and `npm run lint` clean.
* Browser, demo build, 390 × 844: after the tap the form's top is at **85 px**, scroll
  position unchanged (550 → 550), ten attendance buttons visible below.

## Left for Lukas
* **Merge to `main`** so it goes live (deploys). Until then, on the live site: tap the
  button, then scroll to the very top of Anciennitet — the form is there, filled in
  from the calendar row.
