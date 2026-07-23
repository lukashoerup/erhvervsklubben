-- Erhvervsklubben prod schema snapshot — project urlabzyihqrsdeasvrfe
-- Captured read-only 2026-07-23 from information_schema / pg_catalog.
-- This is the AUDIT REFERENCE the rebuild's migrations must reproduce verbatim
-- (constraint 6 / review finding B4). It is NOT the final migration file — the
-- real migration is authored as task T010 and diffed against this. No personal
-- data here; safe to commit.

-- ============================================================ enum
CREATE TYPE public.user_role AS ENUM ('admin', 'user');

-- ============================================================ functions
-- Both SECURITY DEFINER — this is load-bearing: get_user_role() bypasses RLS so
-- policies can check a caller's role without recursing on profiles' own RLS.
CREATE OR REPLACE FUNCTION public.get_user_role(user_id uuid)
 RETURNS user_role
 LANGUAGE sql
 STABLE SECURITY DEFINER
AS $function$
  SELECT role FROM public.profiles WHERE id = user_id;
$function$;

CREATE OR REPLACE FUNCTION public.handle_new_user()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  INSERT INTO public.profiles (id, role)
  VALUES (NEW.id, 'user');
  RETURN NEW;
END;
$function$;

-- ============================================================ trigger (on auth.users!)
-- Lives on an auth-schema table; a `pg_dump --schema=public` would MISS this.
-- Must be recreated explicitly or new signups get no profile row.
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ============================================================ tables (shape only; see list_tables output in session for exact defaults)
-- profiles(id uuid PK -> auth.users.id, role user_role default 'user', created_at, updated_at)
-- news(id uuid PK default gen_random_uuid(), title, excerpt, author, date, created_at, updated_at)
-- events(id uuid PK, title, date, time text, location, description, created_at, updated_at)
-- attendance_records(id serial PK, meeting_number int, lead text, pre_location, main_location, post_location, timestamps)
-- attendances(id serial PK, record_id -> attendance_records.id, member_name text, attended bool default false)
-- event_evaluations(id uuid PK, user_id -> auth.users.id, record_id -> attendance_records.id,
--   8x {aspect}_rating int CHECK 1..5 + {aspect}_comment text, timestamps)
-- user_member_mapping(id uuid PK, user_id -> profiles.id UNIQUE, member_name text, created_at)
-- ALTER TABLE ... ENABLE ROW LEVEL SECURITY;  -- on ALL 7 tables

-- ============================================================ RLS policies (verbatim)

-- attendance_records --------------------------------------------------
CREATE POLICY "Allow authenticated users to view attendance_records"
  ON public.attendance_records FOR SELECT TO authenticated USING (true);
CREATE POLICY "Allow admin users to insert attendance_records"
  ON public.attendance_records FOR INSERT TO authenticated
  WITH CHECK (get_user_role(auth.uid()) = 'admin'::user_role);
CREATE POLICY "Allow admin users to update attendance_records"
  ON public.attendance_records FOR UPDATE TO authenticated
  USING (get_user_role(auth.uid()) = 'admin'::user_role);
CREATE POLICY "Allow admin users to delete attendance_records"
  ON public.attendance_records FOR DELETE TO authenticated
  USING (get_user_role(auth.uid()) = 'admin'::user_role);

-- attendances ---------------------------------------------------------
CREATE POLICY "Allow authenticated users to view attendances"
  ON public.attendances FOR SELECT TO authenticated USING (true);
CREATE POLICY "Allow admin users to manage attendances"
  ON public.attendances FOR ALL TO authenticated
  USING (get_user_role(auth.uid()) = 'admin'::user_role)
  WITH CHECK (get_user_role(auth.uid()) = 'admin'::user_role);

-- event_evaluations (per-user) ----------------------------------------
CREATE POLICY "Users can view their own evaluations"
  ON public.event_evaluations FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can create their own evaluations"
  ON public.event_evaluations FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update their own evaluations"
  ON public.event_evaluations FOR UPDATE USING (auth.uid() = user_id);
-- NOTE: no DELETE policy → nobody can delete evaluations (not even the owner).

-- events (public read, admin write) -----------------------------------
CREATE POLICY "Enable read access for all users"
  ON public.events FOR SELECT USING (true);   -- NB: anon-readable (Q11)
CREATE POLICY "Enable insert for admin users only"
  ON public.events FOR INSERT
  WITH CHECK ((SELECT profiles.role FROM profiles WHERE profiles.id = auth.uid()) = 'admin'::user_role);
CREATE POLICY "Enable update for admin users only"
  ON public.events FOR UPDATE
  USING ((SELECT profiles.role FROM profiles WHERE profiles.id = auth.uid()) = 'admin'::user_role);
CREATE POLICY "Enable delete for admin users only"
  ON public.events FOR DELETE
  USING ((SELECT profiles.role FROM profiles WHERE profiles.id = auth.uid()) = 'admin'::user_role);

-- news (public read, admin write) — identical shape to events ---------
CREATE POLICY "Enable read access for all users"
  ON public.news FOR SELECT USING (true);      -- NB: anon-readable (Q11)
CREATE POLICY "Enable insert for admin users only"
  ON public.news FOR INSERT
  WITH CHECK ((SELECT profiles.role FROM profiles WHERE profiles.id = auth.uid()) = 'admin'::user_role);
CREATE POLICY "Enable update for admin users only"
  ON public.news FOR UPDATE
  USING ((SELECT profiles.role FROM profiles WHERE profiles.id = auth.uid()) = 'admin'::user_role);
CREATE POLICY "Enable delete for admin users only"
  ON public.news FOR DELETE
  USING ((SELECT profiles.role FROM profiles WHERE profiles.id = auth.uid()) = 'admin'::user_role);

-- profiles ------------------------------------------------------------
CREATE POLICY "Users can read own profile"
  ON public.profiles FOR SELECT USING (auth.uid() = id);
CREATE POLICY "Only admins can update profiles"
  ON public.profiles FOR UPDATE
  USING (auth.uid() IN (SELECT profiles_1.id FROM profiles profiles_1 WHERE profiles_1.role = 'admin'::user_role));
-- RESOLVES review Q6/B3: a non-admin's USING evaluates false, so members cannot
-- UPDATE profiles at ALL — there is no self-role-escalation hole. Verbatim ==
-- secure here; no deviation needed. (No INSERT policy → only the SECURITY
-- DEFINER trigger creates rows; no SELECT of others' profiles.)

-- user_member_mapping -------------------------------------------------
CREATE POLICY "Users can view their own mapping"
  ON public.user_member_mapping FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Admins can manage all mappings"
  ON public.user_member_mapping FOR ALL
  USING (get_user_role(auth.uid()) = 'admin'::user_role)
  WITH CHECK (get_user_role(auth.uid()) = 'admin'::user_role);
