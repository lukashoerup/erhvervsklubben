-- DELIBERATE BREAKAGE — do not merge. Exists only to prove that CI's RLS job
-- fails on a real policy regression (T022 acceptance criterion). This grants
-- anonymous visitors read access to member attendance data, which the suite
-- asserts must return zero rows. Reverted immediately after the check goes red.
create policy "TEMP anon can read attendances"
  on public.attendances for select to anon using (true);
