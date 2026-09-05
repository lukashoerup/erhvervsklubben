-- September 2026 collected: nine of nine, and the account stands at 18.680,00 kr.
-- Source: Lukas's screenshot of the account ("Erhvervsklub konto"), sent 2026-09-05,
-- showing the balance and the September transfers. Full workings:
-- docs/finance-reconciliation.md §17.2.
--
-- What the screenshot shows, newest first, with the running balance beside each:
--
--   04.09  Christian Have      +200   18.680,00
--   02.09  Mathias Saaby       +200   18.480,00
--   02.09  Overførsel (Mads)   +200   18.280,00   — the unnamed transfers are his (§16.2)
--   02.09  Kontingent Kasper   +200   18.080,00
--   02.09  Emil kontingent     +200   17.880,00
--   ??.09  Anders Tørring      +200  (17.680,00)  — the row is cut off at the screen edge
--
-- Six transfers seen, 1.200 kr. The August row holds the 04.08 balance, 16.880 kr.,
-- and 18.680 − 16.880 = 1.800 = nine × 200 — so the 600 kr. between 16.880 and the
-- balance before Anders's transfer are three more members' September, and the three
-- who paid before the 4th last month too are Rasmus, Lukas and Esben. That is
-- arithmetic, not sight: the screenshot ends at Anders. The note says so.
--
-- `bank_balance_kr` is the balance on the day the figure was checked, 04.09.2026,
-- exactly as the August row holds the 04.08 balance. Not the calendar month's
-- closing Saldo — nobody has seen that yet, and a later correction to the
-- month-end figure is welcome and would not change amount_kr.
--
-- Guarded on the club's own ten names so a fresh stack or CI writes nothing, and
-- on conflict (month) so it applies exactly once — the same shape as August.

insert into public.payments (month, amount_kr, bank_balance_kr, note)
select date '2026-09-01', 1800, 18680,
  'Afstemt mod kontoens saldo 04.09.2026: 18.680,00 kr. (skærmbillede fra Lukas, 05.09.2026). Ni opkrævede à 200 kr., alle betalt. Seks overførsler ses på skærmbilledet: Anders, Emil, Kasper, Mads (Overførsel) og Saaby 02.09, Have 04.09. De sidste 600 kr. mellem saldoen 04.08 (16.880) og Anders'' overførsel er udledt af regnestykket 18.680 − 16.880 = 1.800 = 9 × 200 — efter mønstret fra august er det Rasmus, Lukas og Esben, der betaler før den 4. Ikke set på skærmbilledet. Ingen udestående kontingent, og de samlede indbetalinger (18.680 kr.) er for anden måned i træk nøjagtig kontoens saldo.'
where (select count(*) from public.members x
        where x.name in ('Anders','Rasmus','Esben','Emil','Saaby',
                         'Lukas','Mads','Kasper','Have','Oskar')) = 10
on conflict (month) do nothing;
