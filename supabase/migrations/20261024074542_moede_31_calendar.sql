-- Møde #31's calendar row, filled in from the Lead's own announcement on the morning
-- of the meeting. Source: three screenshots of the club's Messenger group Lukas sent
-- on 2026-10-24, 09.40. Have, Lead, verbatim:
--
--   Mon 19.10, 18.33: "Hej Alle, Så er det på lørdag at det går løs! En lille ændring
--     af tidligere - vi mødes direkte ved der vi skal spise 🍀 Mødetidspunkt: klokken
--     12 Restaurant: Spix's ara (dette er blot et hint - opfølgning følger ❤️)
--     Efterfølgende går vi til: Southern Cross Pub Glæder mig til at se alle
--     Dresscode - kom som du er 🍀 Mvh Have 🍀"
--   Wed 21.10, 17.50: "Dagens hint: Helge Dohrmann 🍀" — Rasmus: "Rio Bravo?" —
--     Have: "Hvordan gættede du det? 🎉"
--   Fri 23.10, 19.05: "Selvom mødetidspunktet er angivet som klokken 12, ser jeg
--     helst at folket ankommer 12.10 🍀"
--
-- So: Rio Bravo at 12, then Southern Cross Pub. The restaurant is the Lead's
-- confirmation of Rasmus's guess, not this file's reading of the hints.
--
-- What the row held when this ran: title 'Erhvervsklub #31', date 2026-10-24, lead
-- 'Have', location 'TBD', time '', description '' — untouched since 08.08.
--
-- `location` takes the restaurant alone, because recording the meeting from the card
-- carries it into the record's `main_location` (src/pages/Anciennitet.tsx). The pub
-- is in the description and becomes `post_location` when the evening is recorded.
-- `time` is '12.00' in the club's own format; Have gave no end time, so none is
-- invented.
--
-- Guards: matched on title and date, never on the id; no such row (a fresh stack,
-- CI) writes nothing, out loud; two rows raise. Each column is written only while it
-- still says nothing ('' or 'TBD'), so a field someone corrected by hand is left as
-- they left it, and a re-run changes nothing. Read back inside the block.

do $$
declare
  n int;
begin
  select count(*) into n from public.events
   where title = 'Erhvervsklub #31' and date = date '2026-10-24';
  if n = 0 then
    raise notice 'moede_31_calendar: no calendar row for møde #31, nothing written';
    return;
  elsif n > 1 then
    raise exception 'moede_31_calendar: % calendar rows for møde #31, expected one', n;
  end if;

  update public.events set location = 'Rio Bravo', updated_at = now()
   where title = 'Erhvervsklub #31' and date = date '2026-10-24'
     and coalesce(trim(location), '') in ('', 'TBD');

  update public.events set time = '12.00', updated_at = now()
   where title = 'Erhvervsklub #31' and date = date '2026-10-24'
     and coalesce(trim(time), '') = '';

  update public.events set description =
    'Have er Lead. Klubben mødes direkte ved bordet på Rio Bravo kl. 12.00 – en destination Lead har annonceret i kodet form over flere dage, og som Rasmus afkodede før nogen anden. Lead har tilkendegivet, at han helst ser folket ankomme kl. 12.10. Derefter Southern Cross Pub. Dresscode: kom som du er.',
       updated_at = now()
   where title = 'Erhvervsklub #31' and date = date '2026-10-24'
     and coalesce(trim(description), '') = '';

  if exists (select 1 from public.events
              where title = 'Erhvervsklub #31' and date = date '2026-10-24'
                and (coalesce(trim(location), '') in ('', 'TBD')
                     or coalesce(trim(time), '') = ''
                     or coalesce(trim(description), '') = ''
                     or lead <> 'Have')) then
    raise exception 'moede_31_calendar: møde #31''s calendar row still says nothing somewhere';
  end if;
end $$;
