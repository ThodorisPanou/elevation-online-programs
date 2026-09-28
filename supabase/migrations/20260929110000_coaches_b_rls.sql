-- Migration B — RLS switch (BREAKING). Run only after migration A2 and after the app that uses
-- get_shared_program + coach folders for avatars is deployed.
--   admin (row in `admins`)      → everything
--   coach (active `coaches` row) → only rows with their coach_id (+ days/blocks/exercises of their programs)
--   anon                         → no table access at all; share links go through get_shared_program()
-- Rollback: supabase/migrations/rollback/20260929110000_coaches_b_rls_down.sql
-- Plan: TODO.md → "Coaches (multi-coach)".

-- ─── 1. Drop every existing policy on the app tables ────────────────────────
-- (production accumulated overlapping ones, some open to anon — start clean)

do $$
declare r record;
begin
  for r in
    select tablename, policyname from pg_policies
    where schemaname = 'public'
      and tablename in ('admins', 'athletes', 'programs', 'program_days', 'blocks', 'block_exercises', 'exercises')
  loop
    execute format('drop policy %I on public.%I', r.policyname, r.tablename);
  end loop;
end $$;

-- ─── 2. Helpers for the nested tables ───────────────────────────────────────

create or replace function public.can_manage_day(p_day_id uuid) returns boolean
  language sql stable security definer set search_path = ''
as $$
  select public.can_manage_program((select program_id from public.program_days where id = p_day_id))
$$;

create or replace function public.can_manage_block(p_block_id uuid) returns boolean
  language sql stable security definer set search_path = ''
as $$
  select public.can_manage_day((select day_id from public.blocks where id = p_block_id))
$$;

revoke execute on function public.can_manage_day(uuid), public.can_manage_block(uuid) from public, anon;
grant  execute on function public.can_manage_day(uuid), public.can_manage_block(uuid) to authenticated;

-- ─── 3. Policies ────────────────────────────────────────────────────────────
-- One policy per table for select/insert/update/delete; `with check` also stops moving a row to
-- another coach. Cross-coach links (program ↔ athlete, program ↔ exercise) are blocked by the triggers.

create policy "Coach's own rows, admin all" on public.athletes
  for all to authenticated
  using (public.can_manage(coach_id)) with check (public.can_manage(coach_id));

create policy "Coach's own rows, admin all" on public.programs
  for all to authenticated
  using (public.can_manage(coach_id)) with check (public.can_manage(coach_id));

create policy "Coach's own rows, admin all" on public.exercises
  for all to authenticated
  using (public.can_manage(coach_id)) with check (public.can_manage(coach_id));

create policy "Rows of the coach's programs, admin all" on public.program_days
  for all to authenticated
  using (public.can_manage_program(program_id)) with check (public.can_manage_program(program_id));

create policy "Rows of the coach's programs, admin all" on public.blocks
  for all to authenticated
  using (public.can_manage_day(day_id)) with check (public.can_manage_day(day_id));

create policy "Rows of the coach's programs, admin all" on public.block_exercises
  for all to authenticated
  using (public.can_manage_block(block_id)) with check (public.can_manage_block(block_id));

-- Only "am I admin?"; admins are managed in SQL
create policy "Read own admin row" on public.admins
  for select to authenticated
  using (user_id = auth.uid());

-- ─── 4. Anon: no direct table access ────────────────────────────────────────

revoke all on public.admins, public.athletes, public.programs, public.program_days, public.blocks,
  public.block_exercises, public.exercises, public.coaches from anon;
revoke execute on function public.delete_athlete(uuid) from anon;
-- New tables would get anon grants from Supabase's default privileges — stop that
alter default privileges for role postgres in schema public revoke all on tables from anon;

-- Signed-in users never write admins; coaches is written by the service role only
revoke insert, update, delete on public.admins from authenticated;

-- ─── 5. Storage: athlete photos ─────────────────────────────────────────────
-- New photos: <coach_id>/<file>. A coach may write/delete inside their own folder, or delete an older
-- (folder-less) photo still used by one of their athletes. Admin: everything. Reading stays public (bucket).

drop policy if exists "Admins can upload athlete images" on storage.objects;

create or replace function public.can_manage_avatar(p_name text) returns boolean
  language sql stable security definer set search_path = ''
as $$
  select public.is_admin()
      or (storage.foldername(p_name))[1] = public.my_coach_id()::text
      or exists (
           select 1 from public.athletes a
           where a.avatar_url like '%/AtheletesImages/' || p_name
             and public.can_manage(a.coach_id)
         )
$$;
revoke execute on function public.can_manage_avatar(text) from public, anon;
grant  execute on function public.can_manage_avatar(text) to authenticated;

create policy "Coach's athlete photos, admin all" on storage.objects
  for all to authenticated
  using      (bucket_id = 'AtheletesImages' and public.can_manage_avatar(name))
  with check (bucket_id = 'AtheletesImages' and public.can_manage_avatar(name));
