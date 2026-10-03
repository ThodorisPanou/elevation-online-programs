-- Behaviour tests for migration C (athlete logins). DEV only; everything is rolled back, including the
-- migration itself — so this runs against a database that does NOT have C yet.
-- Run from the repo root:  psql "$DEV_DB_URL" -v ON_ERROR_STOP=1 -f supabase/tests/athlete_logins_c_test.sql
-- Each check prints "PASS …" or "FAIL …".

begin;

-- ─── Share links before the migration, to compare after the refactor ────────

create temp table shared_before as
select public_token, public.get_shared_program(public_token) as json
from public.programs where is_public;

\i supabase/migrations/20261002100000_athlete_logins_c.sql

-- ─── Helpers ────────────────────────────────────────────────────────────────

create temp table results (ok boolean, name text);
grant insert on results to anon, authenticated;

create function pg_temp.act_as(p_user uuid) returns void language sql as $$
  select set_config('request.jwt.claims', json_build_object('sub', p_user, 'role', 'authenticated')::text, true);
$$;
create function pg_temp.check(p_ok boolean, p_name text) returns void language sql as $$
  insert into results values (coalesce(p_ok, false), p_name);
$$;

select pg_temp.check(
  (select count(*) > 0 and bool_and(b.json = public.get_shared_program(b.public_token)) from shared_before b),
  'get_shared_program output identical after the program_json refactor');

-- ─── Fixtures: two athletes of the seed coach, one with a login ──────────────

-- The athlete with the most programs logs in; another athlete with programs is the "someone else";
-- the coach is the logged-in athlete's own coach
create temp table fx as
select
  (select athlete_id from public.programs group by athlete_id order by count(*) desc, athlete_id limit 1) as athlete_id,
  (select athlete_id from public.programs group by athlete_id order by count(*) desc, athlete_id offset 1 limit 1) as other_athlete_id,
  '33333333-3333-3333-3333-333333333333'::uuid as athlete_user;
alter table fx add column coach_id uuid, add column coach_user uuid, add column coach_username text;
update fx set (coach_id, coach_user, coach_username) = (
  select c.id, c.user_id, c.username from public.coaches c join public.athletes a on a.coach_id = c.id
  where a.id = fx.athlete_id);
grant select on fx, shared_before to anon, authenticated;

insert into auth.users (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at, created_at, updated_at)
values ('33333333-3333-3333-3333-333333333333', '00000000-0000-0000-0000-000000000000', 'authenticated',
        'authenticated', 'test.athlete@login.invalid', '', now(), now(), now());

-- As the table owner (like the service role): allowed
update public.athletes set user_id = (select athlete_user from fx), username = 'test.athlete'
where id = (select athlete_id from fx);
select pg_temp.check(true, 'service role / owner can set user_id + username');

-- ─── Usernames unique across coaches and athletes ───────────────────────────

do $$ begin
  update public.athletes set username = (select coach_username from fx) where id = (select other_athlete_id from fx);
  perform pg_temp.check(false, 'athlete can''t take a coach''s username');
exception when unique_violation then
  perform pg_temp.check(true, 'athlete can''t take a coach''s username');
end $$;

do $$ begin
  update public.coaches set username = 'test.athlete' where id = (select coach_id from fx);
  perform pg_temp.check(false, 'coach can''t take an athlete''s username');
exception when unique_violation then
  perform pg_temp.check(true, 'coach can''t take an athlete''s username');
end $$;

do $$ begin
  update public.athletes set username = 'Bad Name' where id = (select other_athlete_id from fx);
  perform pg_temp.check(false, 'username format is checked');
exception when check_violation then
  perform pg_temp.check(true, 'username format is checked');
end $$;

-- ─── Coach: may edit the athlete, not its login columns ─────────────────────

set local role authenticated;
select pg_temp.act_as((select coach_user from fx));

update public.athletes set name = name where id = (select athlete_id from fx);
select pg_temp.check(true, 'coach can still update their athlete''s normal fields');

do $$ begin
  update public.athletes set user_id = (select coach_user from fx) where id = (select athlete_id from fx);
  perform pg_temp.check(false, 'coach can''t set athletes.user_id');
exception when insufficient_privilege then
  perform pg_temp.check(true, 'coach can''t set athletes.user_id');
end $$;

do $$ begin
  update public.athletes set username = 'sneaky' where id = (select athlete_id from fx);
  perform pg_temp.check(false, 'coach can''t set athletes.username');
exception when insufficient_privilege then
  perform pg_temp.check(true, 'coach can''t set athletes.username');
end $$;

do $$ begin
  update public.athletes set login_disabled = true where id = (select athlete_id from fx);
  perform pg_temp.check(false, 'coach can''t set athletes.login_disabled');
exception when insufficient_privilege then
  perform pg_temp.check(true, 'coach can''t set athletes.login_disabled');
end $$;

do $$ begin
  insert into public.athletes (name, surname, username) values ('X', 'Y', 'new.one');
  perform pg_temp.check(false, 'coach can''t insert an athlete with a username');
exception when insufficient_privilege then
  perform pg_temp.check(true, 'coach can''t insert an athlete with a username');
end $$;

select pg_temp.check((select my_athlete_id() is null), 'a coach is not an athlete');
select pg_temp.check((select get_my_programs() = '[]'::jsonb), 'get_my_programs is empty for a coach');

do $$ begin
  perform 1 from public.athlete_login_links;
  perform pg_temp.check(false, 'coach can''t read athlete_login_links');
exception when insufficient_privilege then
  perform pg_temp.check(true, 'coach can''t read athlete_login_links');
end $$;

-- ─── Athlete: own data only, through the functions ──────────────────────────

select pg_temp.act_as((select athlete_user from fx));

select pg_temp.check((select my_athlete_id() = (select athlete_id from fx)), 'my_athlete_id() for the athlete');
select pg_temp.check((select not is_admin() and my_coach_id() is null), 'athlete is neither admin nor coach');

select pg_temp.check((select count(*) = 0 from public.athletes),        'athlete reads no athletes rows directly');
select pg_temp.check((select count(*) = 0 from public.programs),        'athlete reads no programs rows directly');
select pg_temp.check((select count(*) = 0 from public.exercises),       'athlete reads no exercises rows directly');
select pg_temp.check((select count(*) = 0 from public.block_exercises), 'athlete reads no block_exercises rows directly');
select pg_temp.check((select count(*) = 0 from public.coaches),         'athlete reads no coaches rows');

select pg_temp.check(
  (select get_my_athlete() ->> 'id' = (select athlete_id from fx)::text
      and get_my_athlete() ->> 'username' = 'test.athlete'
      and get_my_athlete() ->> 'coach_name' is not null),
  'get_my_athlete returns own profile with coach name');
select pg_temp.check((select not (get_my_athlete() ? 'notes') and not (get_my_athlete() ? 'coach_id')),
  'get_my_athlete hides the coach''s notes and coach_id');

reset role;
create temp table own_programs as
select id, created_at from public.programs where athlete_id = (select athlete_id from fx);
create temp table other_program as
select id from public.programs where athlete_id = (select other_athlete_id from fx) limit 1;
grant select on own_programs, other_program to authenticated;
set local role authenticated;
select pg_temp.act_as((select athlete_user from fx));

select pg_temp.check(
  (select jsonb_array_length(get_my_programs()) = (select count(*) from own_programs)),
  'get_my_programs returns all own programs');
select pg_temp.check(
  (select (get_my_programs() -> 0 ->> 'id')::uuid = (select id from own_programs order by created_at desc limit 1)),
  'get_my_programs is newest first');
select pg_temp.check(
  (select bool_and(get_my_program(id) ->> 'id' = id::text) from own_programs),
  'get_my_program opens every own program');
select pg_temp.check(
  (select get_my_program(id) is null from other_program),
  'get_my_program refuses someone else''s program');

do $$ begin
  perform public.program_json((select id from own_programs limit 1));
  perform pg_temp.check(false, 'program_json can''t be called by clients');
exception when insufficient_privilege then
  perform pg_temp.check(true, 'program_json can''t be called by clients');
end $$;

-- ─── Disabled login ─────────────────────────────────────────────────────────

reset role;
update public.athletes set login_disabled = true where id = (select athlete_id from fx);
set local role authenticated;
select pg_temp.act_as((select athlete_user from fx));

select pg_temp.check((select my_athlete_id() is null), 'disabled athlete: my_athlete_id() is null');
select pg_temp.check((select get_my_programs() = '[]'::jsonb and get_my_athlete() is null),
  'disabled athlete sees nothing');

-- ─── Anon ───────────────────────────────────────────────────────────────────

reset role;
set local role anon;
select set_config('request.jwt.claims', '{"role":"anon"}', true);

do $$ begin
  perform public.get_my_programs();
  perform pg_temp.check(false, 'anon can''t call get_my_programs');
exception when insufficient_privilege then
  perform pg_temp.check(true, 'anon can''t call get_my_programs');
end $$;

select pg_temp.check(
  (select public.get_shared_program((select public_token from shared_before limit 1)) is not null),
  'anon still opens share links');

-- ─── Report ─────────────────────────────────────────────────────────────────

reset role;
select case when ok then 'PASS ' else 'FAIL ' end || name as result from results;
select count(*) filter (where ok) || ' passed, ' || count(*) filter (where not ok) || ' failed' as summary from results;

rollback;
