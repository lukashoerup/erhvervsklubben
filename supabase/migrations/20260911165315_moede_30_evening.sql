-- Møde #30, the evening's second message: the venues, the club's words on it, and the
-- four who were not there.
--
-- Lukas, 2026-09-11, later the same evening: *"Vi starter i øvrigt på Understellet og
-- tager på Ms Cuisine bagefter. Opdater. Skriv gerne noget med at en formidabel lead
-- har forberedt noget rigtig lækkert og godt i god tid (ironisk) samme jargon som
-- nyheder og øvrige begivenheder"* — and: *"Der mangler at stå alle dem som ikke er
-- til stede på mødet i dag."*
--
-- **The venues were already on the record when this ran.** Between his two messages
-- Lukas opened the meeting on /anciennitet and wrote Café Understellet and Ma Cuisine
-- himself — his spelling on the card, not the chat's — and ticked Saaby present. So
-- this file writes a venue only where the column is still empty or still carries the
-- calendar's placeholder, and the description only where it is still empty. What he
-- typed on the card is his; a migration does not overwrite the club's own edits.
--
-- **The four absent rows correct a rule written three hours earlier.** 20260911163428
-- wrote rows for the five men the first message proved were there and refused to
-- mark the other five absent on no evidence. Lukas then ticked Saaby and asked for
-- the rest to be *listed as absent* — and the card could not do it for him: the
-- meeting editor can flip a stored row, but for a member it has no row for it
-- inserts one only when he is ticked present. An absent man with no row is not
-- absent on the card, he is missing from it. The one shape the club can correct on
-- the card is ten rows, one per member. So every member without a row is written
-- absent, on his word: Have, Mads, Oskar, Rasmus.
--
-- **The description is in the club's own register.** The news are written by
-- "Formandskabet" in a deadpan-official voice — "Kadencen er intakt", "Tak til Lead
-- for planlægningen", "Lead har valgt en potentiel tvivlsom tur i bowlinghallen" —
-- and a Lead whose calendar row said TBD until the day of is, in that voice,
-- formidable and early. He asked for exactly that.
--
-- Guarded and re-runnable like the first: nothing on a database without the club's
-- møde #30 of 2026-09-11 under Lukas; every write conditional on the column still
-- being as the app or the earlier migration left it; and a read-back that refuses,
-- and rolls back, unless the evening holds one attendance row per member and a
-- description.

do $$
declare
  rec     int;
  wrote_a int;
  rows_n  int;
  members int;
  here_n  int;
  descr   text := 'Lukas er Lead. En formidabel Lead har i særdeles god tid forberedt noget rigtig lækkert og godt: Vi starter på Café Understellet og går derefter videre til Ma Cuisine. Formandskabet noterer med tilfredshed, at programmet forelå længe før mødets start, og ser frem til faglige diskussioner på højeste niveau.';
begin
  select id into rec from public.attendance_records
   where meeting_number = 30 and meeting_date = '2026-09-11' and lead = 'Lukas';
  if rec is null then
    raise notice 'moede_30_evening: no møde #30 of 2026-09-11 here — nothing written';
    return;
  end if;

  -- ------------------------------------------------------------ the record
  -- Venues only where still empty or still the calendar's placeholder ('Lukas' in
  -- the venue field was the calendar row's workaround for a lead column it lacked);
  -- the description only where still empty.
  update public.attendance_records
     set pre_location  = coalesce(nullif(btrim(pre_location), ''), 'Café Understellet'),
         main_location = case when btrim(coalesce(main_location, '')) in ('', 'Lukas')
                              then 'Ma Cuisine' else main_location end,
         description   = coalesce(nullif(btrim(description), ''), descr),
         updated_at    = now()
   where id = rec;

  -- ------------------------------------------------------- the calendar row
  -- Folded away by the site while the record exists, surfaced again if the record
  -- were ever deleted — so it must not go on saying TBD at his house.
  update public.events
     set location = 'Ma Cuisine', description = descr, updated_at = now()
   where title = 'Erhvervsklub #30' and date = '2026-09-11'
     and location = 'Lukas' and description = 'TBD';

  -- ----------------------------------------------------------- the absent
  -- Every member with no row on the evening. Not a fixed list of four: if he has
  -- ticked another man present on the card since, that row exists and is his.
  insert into public.attendances (record_id, member_name, attended)
  select rec, m.name, false
    from public.members m
   where not exists (select 1 from public.attendances a
                      where a.record_id = rec and a.member_name = m.name);
  get diagnostics wrote_a = row_count;

  -- ----------------------------------------------------------- read back
  select count(*), count(*) filter (where attended) into rows_n, here_n
    from public.attendances where record_id = rec;
  members := (select count(*) from public.members);

  if rows_n <> members then
    raise exception 'moede_30_evening: møde #30 should hold one row per member, holds % of %', rows_n, members;
  end if;
  if (select coalesce(btrim(description), '') = '' from public.attendance_records where id = rec) then
    raise exception 'moede_30_evening: the description is still empty';
  end if;
  if (select btrim(coalesce(main_location, '')) in ('', 'Lukas') from public.attendance_records where id = rec) then
    raise exception 'moede_30_evening: the venue is still the placeholder';
  end if;

  raise notice 'moede_30_evening: % absent row(s) written; møde #30 holds % rows, % present',
    wrote_a, rows_n, here_n;
end $$;
