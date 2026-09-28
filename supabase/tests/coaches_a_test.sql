-- Behaviour tests for migration A. DEV only; everything is rolled back.
-- psql "$DEV_DB_URL" -X -q -f supabase/tests/coaches_a_test.sql
-- Each check prints "PASS …" or "FAIL …".

begin;

-- ─── Fixtures: two coaches (auth users + coaches rows), A owns all seed data ──

insert into auth.users (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at, created_at, updated_at)
values
  ('11111111-1111-1111-1111-111111111111', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
   'coach_a@login.invalid', '', now(), now(), now()),
  ('22222222-2222-2222-2222-222222222222', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
   'coach_b@login.invalid', '', now(), now(), now());

insert into coaches (id, user_id, username, name) values
  ('aaaaaaaa-0000-0000-0000-000000000000', '11111111-1111-1111-1111-111111111111', 'coach_a', 'Coach A'),
  ('bbbbbbbb-0000-0000-0000-000000000000', '22222222-2222-2222-2222-222222222222', 'coach_b', 'Coach B');

update athletes  set coach_id = 'aaaaaaaa-0000-0000-0000-000000000000';
update exercises set coach_id = 'aaaaaaaa-0000-0000-0000-000000000000';

-- Test helpers: act as a user / as the admin, and record results
create temp table results (ok boolean, name text);
grant insert on results to anon, authenticated;

create function pg_temp.act_as(p_user uuid) returns void language sql as $$
  select set_config('request.jwt.claims', json_build_object('sub', p_user, 'role', 'authenticated')::text, true);
$$;
create function pg_temp.check(p_ok boolean, p_name text) returns void language sql as $$
  insert into results values (coalesce(p_ok, false), p_name);
$$;

-- ─── Backfill via trigger: programs follow their athlete ─────────────────────

update programs set coach_id = null;   -- trigger re-derives it from the athlete
select pg_temp.check(
  (select bool_and(coach_id = 'aaaaaaaa-0000-0000-0000-000000000000') from programs),
  'programs get coach_id from their athlete');

select pg_temp.check(
  (select count(*) = 0 from programs where coach_id = 'bbbbbbbb-0000-0000-0000-000000000000'),
  'no program assigned to coach B');

-- A program can't be forced onto another coach
update programs set coach_id = 'bbbbbbbb-0000-0000-0000-000000000000' where id = 'c0000000-0000-0000-0000-000000000001';
select pg_temp.check(
  (select coach_id = 'aaaaaaaa-0000-0000-0000-000000000000' from programs where id = 'c0000000-0000-0000-0000-000000000001'),
  'setting programs.coach_id by hand is overridden by the athlete''s coach');

-- ─── Defaults: a coach's inserts get their coach_id ──────────────────────────

set local role authenticated;
select pg_temp.act_as('22222222-2222-2222-2222-222222222222');
select pg_temp.check((select my_coach_id() = 'bbbbbbbb-0000-0000-0000-000000000000'), 'my_coach_id() for coach B');
select pg_temp.check((select not is_admin()), 'coach B is not admin');
-- Coach write policies only arrive in migration B, so insert as the table owner (RLS bypassed) —
-- auth.uid() still reads coach B's claims, which is what the column defaults use.
reset role;

insert into athletes (id, name, surname) values ('b0000000-0000-0000-0000-000000000001', 'B', 'Athlete');
insert into exercises (id, name) values ('eb000000-0000-0000-0000-000000000001', 'Back Squat');   -- same name as A's: allowed
insert into programs (id, athlete_id, title) values ('cb000000-0000-0000-0000-000000000001', 'b0000000-0000-0000-0000-000000000001', 'B program');
reset role;

select pg_temp.check((select coach_id = 'bbbbbbbb-0000-0000-0000-000000000000' from athletes  where id = 'b0000000-0000-0000-0000-000000000001'), 'athlete insert → coach B');
select pg_temp.check((select coach_id = 'bbbbbbbb-0000-0000-0000-000000000000' from exercises where id = 'eb000000-0000-0000-0000-000000000001'), 'exercise insert → coach B; same name as coach A allowed');
select pg_temp.check((select coach_id = 'bbbbbbbb-0000-0000-0000-000000000000' from programs  where id = 'cb000000-0000-0000-0000-000000000001'), 'program insert → coach B');

-- ─── Unique exercise names per coach ─────────────────────────────────────────

do $$ begin
  insert into exercises (name, coach_id) values ('  BACK squat ', 'aaaaaaaa-0000-0000-0000-000000000000');
  perform pg_temp.check(false, 'duplicate name for the same coach is rejected');
exception when unique_violation then
  perform pg_temp.check(true, 'duplicate name for the same coach is rejected');
end $$;

-- ─── Cross-coach links are rejected (even for the admin / postgres) ──────────

insert into program_days (id, program_id, name, order_index) values ('db000000-0000-0000-0000-000000000001', 'cb000000-0000-0000-0000-000000000001', 'Day 1', 0);
insert into blocks (id, day_id, name, order_index) values ('bb000000-0000-0000-0000-000000000001', 'db000000-0000-0000-0000-000000000001', 'Main', 0);

do $$ begin
  insert into block_exercises (block_id, exercise_id, order_index)
  values ('bb000000-0000-0000-0000-000000000001', 'e0000000-0000-0000-0000-000000000001', 0);   -- A's Back Squat
  perform pg_temp.check(false, 'coach A''s exercise in coach B''s program is rejected');
exception when check_violation then
  perform pg_temp.check(true, 'coach A''s exercise in coach B''s program is rejected');
end $$;

insert into block_exercises (block_id, exercise_id, order_index)
values ('bb000000-0000-0000-0000-000000000001', 'eb000000-0000-0000-0000-000000000001', 0);
select pg_temp.check(true, 'coach B''s own exercise in coach B''s program is allowed');

do $$ begin
  update block_exercises set exercise_id = 'e0000000-0000-0000-0000-000000000002'
  where block_id = 'bb000000-0000-0000-0000-000000000001';
  perform pg_temp.check(false, 'switching to another coach''s exercise is rejected');
exception when check_violation then
  perform pg_temp.check(true, 'switching to another coach''s exercise is rejected');
end $$;

-- ─── Reassigning an athlete moves their programs along ───────────────────────

update athletes set coach_id = 'bbbbbbbb-0000-0000-0000-000000000000' where id = 'a0000000-0000-0000-0000-000000000004';
select pg_temp.check(true, 'reassigning an athlete without programs works');

update athletes set coach_id = 'bbbbbbbb-0000-0000-0000-000000000000' where id = 'a0000000-0000-0000-0000-000000000002';
select pg_temp.check(
  (select bool_and(coach_id = 'bbbbbbbb-0000-0000-0000-000000000000') from programs where athlete_id = 'a0000000-0000-0000-0000-000000000002'),
  'reassigning an athlete moves their programs to the new coach');
update athletes set coach_id = 'aaaaaaaa-0000-0000-0000-000000000000' where id = 'a0000000-0000-0000-0000-000000000002';

-- ─── delete_athlete ──────────────────────────────────────────────────────────

set local role authenticated;
select pg_temp.act_as('22222222-2222-2222-2222-222222222222');
do $$ begin
  perform delete_athlete('a0000000-0000-0000-0000-000000000001');   -- A's athlete
  perform pg_temp.check(false, 'coach B cannot delete coach A''s athlete');
exception when raise_exception then
  perform pg_temp.check(true, 'coach B cannot delete coach A''s athlete');
end $$;

select pg_temp.act_as((select user_id from admins limit 1));
select pg_temp.check((select is_admin()), 'admin is_admin()');
select pg_temp.check((select can_manage('aaaaaaaa-0000-0000-0000-000000000000') and can_manage('bbbbbbbb-0000-0000-0000-000000000000')), 'admin can_manage every coach');
select delete_athlete('b0000000-0000-0000-0000-000000000001');
reset role;
select pg_temp.check((select count(*) = 0 from athletes where id = 'b0000000-0000-0000-0000-000000000001'), 'admin can delete coach B''s athlete');
select pg_temp.check((select count(*) = 0 from programs where id = 'cb000000-0000-0000-0000-000000000001'), '… and its programs');

-- ─── Inactive coach loses access ─────────────────────────────────────────────

update coaches set active = false where username = 'coach_b';
set local role authenticated;
select pg_temp.act_as('22222222-2222-2222-2222-222222222222');
select pg_temp.check((select my_coach_id() is null and not can_manage('bbbbbbbb-0000-0000-0000-000000000000')), 'inactive coach: my_coach_id() null, can_manage false');
reset role;

-- ─── coaches table visibility ────────────────────────────────────────────────

set local role authenticated;
select pg_temp.act_as('11111111-1111-1111-1111-111111111111');
select pg_temp.check((select count(*) = 1 from coaches), 'coach A sees only own coaches row');
do $$ begin
  update coaches set active = true;
  perform pg_temp.check(false, 'coach cannot write to coaches');
exception when insufficient_privilege then
  perform pg_temp.check(true, 'coach cannot write to coaches');
end $$;
select pg_temp.act_as((select user_id from admins limit 1));
select pg_temp.check((select count(*) = 2 from coaches), 'admin sees all coaches');
reset role;

-- ─── Anon ────────────────────────────────────────────────────────────────────

set local role anon;
select pg_temp.check((select get_shared_program('devtoken0001')->>'title' = 'Pre-season Week 1'), 'anon: get_shared_program works');
select pg_temp.check((select get_shared_program('does-not-exist') is null), 'anon: unknown token → null');
do $$ begin
  perform is_admin();
  perform pg_temp.check(false, 'anon cannot call is_admin()');
exception when insufficient_privilege then
  perform pg_temp.check(true, 'anon cannot call is_admin()');
end $$;
do $$ begin
  perform 1 from coaches;
  perform pg_temp.check(false, 'anon cannot read coaches');
exception when insufficient_privilege then
  perform pg_temp.check(true, 'anon cannot read coaches');
end $$;
reset role;

-- ─── PostgREST embeds stay unambiguous ───────────────────────────────────────
-- A 2nd FK between two tables breaks the app's `athletes(...)` / `exercises(...)` embeds (PGRST201).

select pg_temp.check(
  (select count(*) = 1 from pg_constraint where contype = 'f'
     and conrelid = 'public.programs'::regclass and confrelid = 'public.athletes'::regclass),
  'exactly one FK programs → athletes');
select pg_temp.check(
  (select count(*) = 1 from pg_constraint where contype = 'f'
     and conrelid = 'public.block_exercises'::regclass and confrelid = 'public.exercises'::regclass),
  'exactly one FK block_exercises → exercises');

-- ─── Report ──────────────────────────────────────────────────────────────────

select case when ok then 'PASS ' else 'FAIL ' end || name from results;
select count(*) filter (where ok) || '/' || count(*) || ' passed' from results;

rollback;
