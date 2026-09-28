-- Rollback of migration B: back to the policies production had before it (baseline + athletes hotfix).
-- NOT a migration — run by hand only if B has to be undone:
--   psql "$DB_URL" -v ON_ERROR_STOP=1 -1 -f supabase/migrations/rollback/20260929110000_coaches_b_rls_down.sql

drop policy "Coach's own rows, admin all"             on public.athletes;
drop policy "Coach's own rows, admin all"             on public.programs;
drop policy "Coach's own rows, admin all"             on public.exercises;
drop policy "Rows of the coach's programs, admin all" on public.program_days;
drop policy "Rows of the coach's programs, admin all" on public.blocks;
drop policy "Rows of the coach's programs, admin all" on public.block_exercises;
drop policy "Read own admin row"                      on public.admins;
drop policy "Coach's athlete photos, admin all"       on storage.objects;

grant all on public.admins, public.athletes, public.programs, public.program_days, public.blocks,
  public.block_exercises, public.exercises to anon;
grant insert, update, delete on public.admins to authenticated;
alter default privileges for role postgres in schema public grant all on tables to anon;

-- Old policies (from 00000000000000_baseline.sql, with 20260928120000_hotfix applied)
CREATE POLICY "Admins can delete athletes" ON "public"."athletes" FOR DELETE TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."admins"
  WHERE ("admins"."user_id" = "auth"."uid"()))));

CREATE POLICY "Enable block delete for admins" ON "public"."blocks" USING ((EXISTS ( SELECT 1
   FROM "public"."admins"
  WHERE ("admins"."user_id" = "auth"."uid"()))));

CREATE POLICY "Enable block exercises delete for admins" ON "public"."block_exercises" USING ((EXISTS ( SELECT 1
   FROM "public"."admins"
  WHERE ("admins"."user_id" = "auth"."uid"()))));

CREATE POLICY "Enable delete for admins" ON "public"."block_exercises" FOR DELETE USING ((EXISTS ( SELECT 1
   FROM "public"."admins"
  WHERE ("admins"."user_id" = "auth"."uid"()))));

CREATE POLICY "Enable delete for admins" ON "public"."blocks" FOR DELETE USING ((EXISTS ( SELECT 1
   FROM "public"."admins"
  WHERE ("admins"."user_id" = "auth"."uid"()))));

CREATE POLICY "Enable delete for admins" ON "public"."program_days" FOR DELETE USING ((EXISTS ( SELECT 1
   FROM "public"."admins"
  WHERE ("admins"."user_id" = "auth"."uid"()))));

CREATE POLICY "Enable delete for admins" ON "public"."programs" FOR DELETE USING ((EXISTS ( SELECT 1
   FROM "public"."admins"
  WHERE ("admins"."user_id" = "auth"."uid"()))));

CREATE POLICY "Enable exercises delete for admins" ON "public"."exercises" USING ((EXISTS ( SELECT 1
   FROM "public"."admins"
  WHERE ("admins"."user_id" = "auth"."uid"()))));

CREATE POLICY "Enable insert for authenticated users only" ON "public"."block_exercises" FOR INSERT TO "authenticated" WITH CHECK (true);

CREATE POLICY "Enable insert for authenticated users only" ON "public"."blocks" FOR INSERT TO "authenticated" WITH CHECK (true);

CREATE POLICY "Enable insert for authenticated users only" ON "public"."exercises" FOR INSERT TO "authenticated" WITH CHECK (true);

CREATE POLICY "Enable insert for authenticated users only" ON "public"."program_days" FOR INSERT TO "authenticated" WITH CHECK (true);

CREATE POLICY "Enable insert for authenticated users only" ON "public"."programs" FOR INSERT TO "authenticated" WITH CHECK (true);

CREATE POLICY "Enable read access for all users" ON "public"."admins" FOR SELECT USING (true);

CREATE POLICY "Enable read access for all users" ON "public"."athletes" FOR SELECT USING (true);

CREATE POLICY "Enable read access for all users" ON "public"."block_exercises" FOR SELECT USING (true);

CREATE POLICY "Enable read access for all users" ON "public"."blocks" FOR SELECT USING (true);

CREATE POLICY "Enable read access for all users" ON "public"."exercises" FOR SELECT USING (true);

CREATE POLICY "Enable read access for all users" ON "public"."program_days" FOR SELECT USING (true);

CREATE POLICY "Enable read access for all users" ON "public"."programs" FOR SELECT USING (true);

CREATE POLICY "Enable update for admins" ON "public"."block_exercises" FOR UPDATE USING ((EXISTS ( SELECT 1
   FROM "public"."admins"
  WHERE ("admins"."user_id" = "auth"."uid"()))));

CREATE POLICY "Enable update for admins" ON "public"."blocks" FOR UPDATE USING ((EXISTS ( SELECT 1
   FROM "public"."admins"
  WHERE ("admins"."user_id" = "auth"."uid"()))));

CREATE POLICY "Enable update for admins" ON "public"."exercises" FOR UPDATE USING ((EXISTS ( SELECT 1
   FROM "public"."admins"
  WHERE ("admins"."user_id" = "auth"."uid"()))));

CREATE POLICY "Enable update for admins" ON "public"."program_days" FOR UPDATE USING ((EXISTS ( SELECT 1
   FROM "public"."admins"
  WHERE ("admins"."user_id" = "auth"."uid"()))));

CREATE POLICY "Enable update for admins" ON "public"."programs" FOR UPDATE USING ((EXISTS ( SELECT 1
   FROM "public"."admins"
  WHERE ("admins"."user_id" = "auth"."uid"()))));

create policy "Admins can insert athletes" on public.athletes
  for insert to authenticated
  with check (exists (select 1 from public.admins where admins.user_id = auth.uid()));
create policy "Admins can update athletes" on public.athletes
  for update to authenticated
  using      (exists (select 1 from public.admins where admins.user_id = auth.uid()))
  with check (exists (select 1 from public.admins where admins.user_id = auth.uid()));

-- Storage policy that B replaced
create policy "Admins can upload athlete images" on storage.objects to authenticated
  using (bucket_id = 'AtheletesImages') with check (bucket_id = 'AtheletesImages');
