-- The offences behind the fines, from the Leads' own notes (T075).
--
-- Source: the notes Lukas kept on his phone — one block per Lead, in the order
-- the meetings happened — plus a screenshot of the note for the general
-- assembly, timestamped 2026-06-27 11.41, the morning after that dinner.
-- Transcribed into docs/finance-reconciliation.md §15.
--
-- This answers §9 Q4, the one question that could ever replace `historisk`
-- with a real rule: *do the Leads still have their notes?* Partly. They cover
-- four of the six fine-bearing evenings, and even there they mostly record an
-- amount and no reason. Three of the eighteen imported fines gain an offence.
--
-- The rule this migration is written under, and it is the whole point:
--
--   **A reason is imported only where the note states it in words.**
--
-- Never derived from the amount. 80 kr is arithmetically only `for-sent` at
-- six minutes, and 95 kr only nine minutes — but "Holst: 95kr" says nothing
-- about why, and a decomposition that happens to be unique is still a guess
-- about an evening nobody wrote down. T068 refused to guess and that refusal
-- stands; this migration narrows it with evidence, it does not overturn it.
-- Fifteen of the club's fines therefore keep `historisk` after this runs.
--
-- Where the note *does* give a reason, the regulation's own arithmetic checks
-- it: `for-sent` is 50 kr + 5 kr/minute, so "Kasper: 11 min for sent 105 kr"
-- must satisfy 50 + 5×11 = 105, and it does. Every match below was verified
-- that way before it was written, and every one reconciled to the krone.
--
-- A fourth block was added after Lukas answered for the fines the notes did
-- not explain — see "the rest of them" below. It is the reason exactly one
-- fine still carries `historisk` when this migration has run.
--
-- Re-runnable, and additive. The updates are guarded on `rule_id = 'historisk'`
-- so a second run matches nothing, and so a correction the treasurer makes in
-- the app is never quietly reasserted — the same reasoning as T068's
-- `on conflict do nothing`. The inserts carry that clause outright.
--
-- To reverse it, exactly and only:
--   update public.fines set rule_id = 'historisk', minutes = 0
--    where record_id between 21 and 27 or record_id = 29;
--   update public.fines set minutes = 0 where rule_id = 'historisk';
--   delete from public.fines where record_id in (26, 27, 29)
--     and not (record_id = 26 and member_name = 'Lukas');

-- ---------------------------------------------------------------------------
-- Reasons for fines already imported — UPDATE only, no amount is touched
-- ---------------------------------------------------------------------------
-- Only the Lukas Lead block (record 22, møde #22, Tivolihallen) names offences.
-- The Esben, Oskar and Emil blocks list "name: amount" and nothing else, and
-- the Saaby Lead evening (record 25, 475 kr — the club's most expensive) has no
-- note at all. Those all keep `historisk`.
--
-- `amount_kr` is in each WHERE clause as a second lock: if a row's amount is
-- ever not what the note says, this must miss it rather than relabel a fine
-- that is no longer the one the note describes. Nothing here writes an amount.

-- "Kasper: 11 min for sent 105 kr" — the note gives minutes and total, and
-- 50 + 5×11 = 105 is the regulation reproducing the note exactly. Kasper is
-- recorded present at this meeting, which is the offence's own precondition.
update public.fines
   set rule_id = 'for-sent', minutes = 11
 where record_id = 22 and member_name = 'Kasper'
   and rule_id = 'historisk' and amount_kr = 105
   and exists (select 1 from public.attendance_records ar
                where ar.id = 22 and ar.lead = 'Lukas' and ar.meeting_date = '2025-08-30');

-- "Emil: bøde for skål 50kr" — skål før Leads første skål, a flat 50 kr with
-- no per-minute component, so `minutes` stays 0. It is not a claim of zero
-- minutes; the rule has no minutes.
update public.fines
   set rule_id = 'skaal'
 where record_id = 22 and member_name = 'Emil'
   and rule_id = 'historisk' and amount_kr = 50
   and exists (select 1 from public.attendance_records ar
                where ar.id = 22 and ar.lead = 'Lukas' and ar.meeting_date = '2025-08-30');

-- "Holst: bøde for skål 50kr". Holst = Rasmus (Lukas, 2026-07-29). Two members
-- toasted early at the same dinner and were charged the same 50 kr; the sheet
-- recorded two identical amounts with no way to tell they were the same
-- offence, which is precisely what the notes restore.
update public.fines
   set rule_id = 'skaal'
 where record_id = 22 and member_name = 'Rasmus'
   and rule_id = 'historisk' and amount_kr = 50
   and exists (select 1 from public.attendance_records ar
                where ar.id = 22 and ar.lead = 'Lukas' and ar.meeting_date = '2025-08-30');

-- ---------------------------------------------------------------------------
-- Fines the spreadsheet never had — INSERT
-- ---------------------------------------------------------------------------
-- The notes run past the sheet. A line reading "Bøder indkrævet" (fines
-- collected) sits after the fourth Lead block, and the three blocks below it —
-- Anders lead, Holst lead, Esben lead (GF) — are evenings whose fines were
-- noted and never entered anywhere. That is the answer to §9 Q10, which asked
-- whether fines simply stopped being recorded after Februar 26: they did not
-- stop being *recorded*, they stopped reaching the treasurer's sheet.
--
-- **This moves the club's fine total off 1.780 kr.** That figure is the annual
-- report's, and it remains exactly right for what it measures — fines
-- *collected* in the year. It was never the fines *incurred*. Adding these
-- makes it 2.510 kr., and the 730 kr. difference is money the club is owed and
-- has not asked for. See §15 of docs/finance-reconciliation.md, which states
-- the delta rather than letting the total drift quietly.
--
-- Two of the three evenings pre-date the sheet's last save (2026-06-09) and
-- should have been in it. The general assembly on 2026-06-26 could not have
-- been: the sheet was already seventeen days closed.
--
-- Guarded on `id + lead + meeting_date` together, not on `id` alone. A
-- migration runs on every database, and a bare existence check would happily
-- hang this club's fines off some other database's record 26. All three
-- triples are facts about *these* meetings, so on a fresh stack or in CI the
-- insert selects nothing and the migration is a no-op — which is the correct
-- outcome, not an error. One club's history is not part of the schema.
insert into public.fines (record_id, member_name, rule_id, minutes, amount_kr)
select v.record_id, v.member_name, v.rule_id, v.minutes, v.amount_kr
from (values
  -- record 26 — møde #26, Anders lead, Le Petit Rouge, 2026-02-21.
  -- Note: "Anders lead | 21. Februar" — the note carries the date itself, and
  -- it is the meeting's own. Three members two minutes late: 50 + 5×2 = 60.
  -- All three are recorded present, as being late requires.
  --
  -- This meeting already holds one fine: Lukas's own 50 kr, the voluntary one
  -- he transferred as treasurer (T071 §14.4). It is untouched. What it means
  -- now is that the sheet's "Februar 26 = 50" was not the evening's fines — it
  -- was the treasurer's own, and the Lead's three never reached him.
  (26, 'Esben',  'for-sent',   2, 60, 'Anders', date '2026-02-21'),
  (26, 'Rasmus', 'for-sent',   2, 60, 'Anders', date '2026-02-21'),  -- note: "Holst"
  (26, 'Have',   'for-sent',   2, 60, 'Anders', date '2026-02-21'),

  -- record 27 — møde #27, Rasmus lead, Restaurant Tokyo, 2026-04-24.
  -- Note: "Holst lead / Saaby: 6 min for sent". Holst = Rasmus is the lead, so
  -- the note names the evening the way the sheet's columns do. 50 + 5×6 = 80.
  -- The first fine this meeting has ever had in the database.
  (27, 'Saaby',  'for-sent',   6, 80, 'Rasmus', date '2026-04-24'),

  -- record 29 — møde #28, Esben lead, Propaganda, 2026-06-26: the
  -- generalforsamling. **Record id 29, meeting number 28** — the two diverge
  -- here because the junk duplicate of møde #27 was deleted (T068 §10), so ids
  -- run 1–27 and 29. Joining on the meeting number would put every one of
  -- these fines on the wrong evening.
  --
  -- From the screenshot, whose own timestamp (2026-06-27 11.41) is the morning
  -- after this dinner. Its four late arrivals carry both minutes and amount,
  -- and all four reproduce under 50 + 5×min: 6→80, 6→80, 9→95, 3→65.
  (29, 'Mads',   'for-sent',   6, 80, 'Esben',  date '2026-06-26'),
  (29, 'Kasper', 'for-sent',   6, 80, 'Esben',  date '2026-06-26'),
  (29, 'Emil',   'for-sent',   9, 95, 'Esben',  date '2026-06-26'),
  (29, 'Anders', 'for-sent',   3, 65, 'Esben',  date '2026-06-26'),

  -- The note's second half is headed "Restaurant:" and names two offences in
  -- words with no amounts beside them — the opposite of the sheet's problem.
  -- Both rules are flat 50 kr with no per-minute term, so the amount follows
  -- from the regulation exactly rather than being estimated. Recorded here
  -- because a named offence fixes its own price; the ambiguity T068 refused to
  -- resolve ran the other way, from a price to an unknown offence.
  --
  -- "Have køber øl alene" — ordering a different drink from the Lead during
  -- the meal. Waivable with the Lead's consent, and the Lead is the man who
  -- wrote it down as a fine.
  (29, 'Have',   'drikkevare', 0, 50, 'Esben',  date '2026-06-26'),
  -- "Holst og Mads drikker før lead skåler" — both of them, so two rows.
  -- Mads is therefore fined twice at this meeting, under two different rules,
  -- which the regulation allows: the cap is one fine per *offence* per meeting,
  -- and it is the table's unique key (record_id, member_name, rule_id).
  (29, 'Rasmus', 'skaal',      0, 50, 'Esben',  date '2026-06-26'),  -- note: "Holst"
  (29, 'Mads',   'skaal',      0, 50, 'Esben',  date '2026-06-26')
) as v (record_id, member_name, rule_id, minutes, amount_kr, lead, meeting_date)
where exists (
  select 1 from public.attendance_records ar
   where ar.id = v.record_id
     and ar.lead = v.lead
     and ar.meeting_date = v.meeting_date
)
on conflict (record_id, member_name, rule_id) do nothing;

-- ---------------------------------------------------------------------------
-- The rest of them, answered from the treasurer's memory — Lukas, 2026-07-30
-- ---------------------------------------------------------------------------
-- Everything above was written under "only what the note states in words", and
-- that left fifteen fines at `historisk`. Lukas then answered for all of them
-- at once: *"De bøder som du har spærret for var alle pga. for sent fremmøde.
-- Jeg kan godt huske det. Så det må du gerne notere."*
--
-- That is the member with the club's own records saying what the offence was.
-- It is not an inference from an amount, and it is the same standing that
-- closed `Holst = Rasmus` and `Tørring = Anders` in T068. So it is authorised
-- where a decomposition would not have been.
--
-- **The arithmetic is then a test of his memory, not a conversion.** The rule
-- is 50 kr + 5 kr/minute, so a late arrival's amount must be 50 + 5n for a
-- whole n — and a fine that is something else cannot be made to fit. All
-- fourteen divide cleanly:
--
--   60→2   70→4   75→5   80→6   95→9   100→10  110→12  155→21  185→27  200→30
--
-- Fourteen of fourteen. Two independent things agreeing — the treasurer
-- remembers late arrivals, and every amount is a whole number of minutes at
-- the club's own rate — is much stronger than either alone, and the next
-- person reading these rows should know it was both. Had any amount failed the
-- division it would have stayed `historisk` and been reported, because that
-- would have meant the classification was wrong for that row, never that the
-- amount was.
--
-- **No amount changes here.** Every `amount_kr` was reconciled against the
-- sheet and the annual report in T068 and is left exactly as it was; `minutes`
-- is derived *from* it, so the two cannot disagree.
--
-- One row deserves its caveat: **Emil's 110 kr at møde #25**. The sheet stores
-- that cell as `{=60+50}` — the treasurer's own note that it was two bundled
-- offences (§2, §11.3). As a single `for-sent` at twelve minutes it satisfies
-- the formula and Lukas's answer, but it cannot be two late arrivals: the
-- regulation caps one fine per offence per meeting. Recorded as he answered it,
-- and flagged in §15 so the disagreement is visible rather than buried.
update public.fines f
   set rule_id = 'for-sent',
       minutes = (f.amount_kr - 50) / 5
  from public.attendance_records ar
 where ar.id = f.record_id
   and f.rule_id = 'historisk'
   -- The five spreadsheet columns and nothing else — the exact set of fines
   -- that was blocked for want of a reason. Identified by lead and date
   -- together, not by id, so this cannot fire on another database's rows.
   and (ar.id, ar.lead, ar.meeting_date) in (
         (21, 'Esben', date '2025-05-31'),
         (22, 'Lukas', date '2025-08-30'),
         (23, 'Oskar', date '2025-10-11'),
         (24, 'Emil',  date '2025-11-21'),
         (25, 'Saaby', date '2026-01-24'))
   -- 50 kr is `for-sent` at zero minutes *and* exactly what skål and
   -- drikkevare cost, so at 50 the formula proves nothing and the note rules.
   -- Nothing at 50 is touched here. Lukas's own February 50 kr — the voluntary
   -- one he transferred as treasurer — is on møde #26 and is not in the list
   -- above either, so it is excluded twice over and keeps `historisk`.
   and f.amount_kr > 50
   -- The test. A row that is not a whole number of minutes at the club's rate
   -- is not a late arrival, whatever anyone remembers, and keeps `historisk`.
   and (f.amount_kr - 50) % 5 = 0
   -- The regulation's cap, which is also this table's unique key: a member
   -- cannot hold two `for-sent` fines at one meeting. Nothing in this club's
   -- data trips it, and if it ever did the row must be left alone rather than
   -- take the migration down.
   and not exists (
         select 1 from public.fines g
          where g.record_id = f.record_id
            and g.member_name = f.member_name
            and g.rule_id = 'for-sent');

-- ---------------------------------------------------------------------------
-- Oskar is in the notes twice and is charged nothing — deliberately
-- ---------------------------------------------------------------------------
-- "Oskar lead: Oskar: 75kr" and "Emil lead: Oskar: 200kr". Neither appears in
-- the spreadsheet's grid, in either the column totals or his own row — he has
-- no row — and neither is inserted here. 275 kr. noted, 0 kr. charged.
--
-- This is the first independent evidence that the founding father's exemption
-- (§12; Lukas, 2026-07-29: pays no kontingent, incurs no fines) was actually
-- *practised* and not merely stated afterwards. The Leads went on noting his
-- offences like anyone else's and the treasurer never billed them. Recording
-- them now would invent a debt the club spent two years not collecting.
