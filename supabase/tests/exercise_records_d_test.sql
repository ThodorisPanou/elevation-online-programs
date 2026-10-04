-- Behaviour tests for migration D (exercise records). DEV only; everything is rolled back, including the
-- migration itself — so this runs against a database that does NOT have D yet (but has C).
-- Run from the repo root:  psql "$DEV_DB_URL" -v ON_ERROR_STOP=1 -f supabase/tests/exercise_records_d_test.sql
-- Each check prints "PASS …" or "FAIL …".

begin;

create temp table shared_before as
select public_token, public.get_shared_program(public_token) as json
from public.programs where is_public;

\i supabase/migrations/20261004120000_exercise_records_d.sql

-- ─── Helpers ────────────────────────────────────────────────────────────────

create temp table results (ok boolean, name text);
grant insert on results to anon, authenticated;

create function pg_temp.act_as(p_user uuid) returns void language sql as $$
  select set_config('request.jwt.claims', json_build_object('sub', p_user, 'role', 'authenticated')::text, true);
$$;
create function pg_temp.check(p_ok boolean, p_name text) returns void language sql as $$
  insert into results values (coalesce(p_ok, false), p_name);
$$;

-- Share links: same output as before, plus "track" on every row
select pg_temp.check(
  (select count(*) > 0 and bool_and(
     jsonb_path_query_array(public.get_shared_program(b.public_token), '$.program_days[*].blocks[*].block_exercises[*].track')
       = (select coalesce(jsonb_agg(false), '[]'::jsonb)
          from jsonb_path_query(b.json, '$.program_days[*].blocks[*].block_exercises[*]'))
   ) from shared_before b),
  'share links: every row now has "track": false');

-- ─── Fixtures ───────────────────────────────────────────────────────────────
-- Athlete A (most programs) and athlete B (next), both with a login; coach of A; a second coach with no athletes.

create temp table fx as
select
  (select athlete_id from public.programs group by athlete_id order by count(*) desc, athlete_id limit 1) as a_id,
  (select athlete_id from public.programs group by athlete_id order by count(*) desc, athlete_id offset 1 limit 1) as b_id,
  '33333333-3333-3333-3333-333333333333'::uuid as a_user,
  '44444444-4444-4444-4444-444444444444'::uuid as b_user,
  '55555555-5555-5555-5555-555555555555'::uuid as coach2_user;
alter table fx add column coach_user uuid, add column tracked uuid, add column untracked uuid, add column b_row uuid,
  add column exercise_id uuid, add column other_exercise_id uuid, add column a_program uuid;

update fx set coach_user = (
  select c.user_id from public.coaches c join public.athletes a on a.coach_id = c.id where a.id = fx.a_id);

-- Two rows of A's newest program, one row of B's
update fx set a_program = (select id from public.programs where athlete_id = fx.a_id order by created_at desc limit 1);
update fx set (tracked, exercise_id) = (
  select be.id, be.exercise_id from public.block_exercises be
  join public.blocks b on b.id = be.block_id join public.program_days d on d.id = b.day_id
  where d.program_id = fx.a_program and be.exercise_id is not null order by be.id limit 1);
update fx set untracked = (
  select be.id from public.block_exercises be
  join public.blocks b on b.id = be.block_id join public.program_days d on d.id = b.day_id
  where d.program_id = fx.a_program and be.id <> fx.tracked order by be.id limit 1);
update fx set b_row = (
  select be.id from public.block_exercises be
  join public.blocks b on b.id = be.block_id join public.program_days d on d.id = b.day_id
  join public.programs p on p.id = d.program_id where p.athlete_id = fx.b_id order by be.id limit 1);
update fx set other_exercise_id = (
  select e.id from public.exercises e join public.athletes a on a.coach_id = e.coach_id
  where a.id = fx.a_id and e.id <> fx.exercise_id order by e.id limit 1);
alter table fx add column exercise_name text;
update fx set exercise_name = (select name from public.exercises where id = fx.exercise_id);
grant select on fx to anon, authenticated;

insert into auth.users (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at, created_at, updated_at)
select u.id, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', u.email, '', now(), now(), now()
from (values ('33333333-3333-3333-3333-333333333333'::uuid, 'test.a@login.invalid'),
             ('44444444-4444-4444-4444-444444444444'::uuid, 'test.b@login.invalid'),
             ('55555555-5555-5555-5555-555555555555'::uuid, 'test.coach2@login.invalid')) u(id, email);

update public.athletes set user_id = (select a_user from fx), username = 'test.a' where id = (select a_id from fx);
update public.athletes set user_id = (select b_user from fx), username = 'test.b' where id = (select b_id from fx);
insert into public.coaches (user_id, username, name, must_change_password)
values ((select coach2_user from fx), 'test.coach2', 'Test Coach 2', false);

update public.block_exercises set track = true where id in ((select tracked from fx), (select b_row from fx));

select pg_temp.check(
  (select count(*) = 1 from fx where tracked is not null and untracked is not null and b_row is not null
     and other_exercise_id is not null and coach_user is not null),
  'fixtures found');

-- ─── Coach: "Track" through the editor's RLS ────────────────────────────────

set local role authenticated;
select pg_temp.act_as((select coach_user from fx));

update public.block_exercises set track = true where id = (select untracked from fx);
select pg_temp.check((select track from public.block_exercises where id = (select untracked from fx)),
  'coach can tick "Track" on own athlete''s row');
update public.block_exercises set track = false where id = (select untracked from fx);

-- ─── Athlete A ──────────────────────────────────────────────────────────────

select pg_temp.act_as((select a_user from fx));

select pg_temp.check(
  (select jsonb_path_query_array(public.get_my_program((select a_program from fx)),
     '$.program_days[*].blocks[*].block_exercises[*] ? (@.track == true).id')
   = jsonb_build_array((select tracked from fx))),
  'athlete''s program shows which row is tracked');

create temp table logged as
select public.log_exercise((select tracked from fx), current_date - 7, 3, 80, '  felt easy  ') as j;
grant select on logged to authenticated;
select pg_temp.check(
  (select (j->>'exercise_id')::uuid = (select exercise_id from fx) and j->>'note' = 'felt easy'
      and (j->>'reps')::int = 3 and (j->>'kg')::numeric = 80 from logged),
  'log on a tracked row: exercise copied from the row, note trimmed');

select pg_temp.check(
  (select (public.log_exercise((select tracked from fx), current_date, 4, 82.5)->>'kg')::numeric = 82.5),
  'decimal kg (82.5) accepted');

select pg_temp.check(
  (select (public.log_exercise((select tracked from fx), current_date + 1, 1, 0, '')->>'note') is null),
  'tomorrow allowed (timezones), kg 0 allowed, empty note → null');

do $$ begin
  perform public.log_exercise((select untracked from fx), current_date, 3, 80);
  perform pg_temp.check(false, 'can''t log an untracked row');
exception when insufficient_privilege then
  perform pg_temp.check(true, 'can''t log an untracked row');
end $$;

do $$ begin
  perform public.log_exercise((select b_row from fx), current_date, 3, 80);
  perform pg_temp.check(false, 'can''t log a row of someone else''s program');
exception when insufficient_privilege then
  perform pg_temp.check(true, 'can''t log a row of someone else''s program');
end $$;

do $$
declare
  bad record;
begin
  for bad in select * from (values
    (current_date + 5, 3,   80::numeric, 'future date'),
    (current_date,     0,   80::numeric, 'reps 0'),
    (current_date,     101, 80::numeric, 'reps 101'),
    (current_date,     3,   -1::numeric, 'kg -1'),
    (current_date,     3, 1001::numeric, 'kg 1001')) v(d, r, k, label)
  loop
    begin
      perform public.log_exercise((select tracked from fx), bad.d, bad.r, bad.k);
      perform pg_temp.check(false, 'refused: ' || bad.label);
    exception when check_violation then
      perform pg_temp.check(true, 'refused: ' || bad.label);
    end;
  end loop;
end $$;

do $$ begin
  perform public.log_exercise((select tracked from fx), current_date, 3, 80, repeat('x', 501));
  perform pg_temp.check(false, 'refused: note over 500 characters');
exception when check_violation then
  perform pg_temp.check(true, 'refused: note over 500 characters');
end $$;

select pg_temp.check(
  (select jsonb_array_length(l) = 3 and (l->0->>'performed_on')::date = current_date + 1
      and (l->2->>'performed_on')::date = current_date - 7
   from (select public.get_my_exercise_logs(array[(select exercise_id from fx)]) l) x),
  'own records: all three, newest first');

select pg_temp.check(
  (select jsonb_array_length(h) = 3 and h->0->>'exercise_name' = (select exercise_name from fx)
   from (select public.get_my_exercise_history() h) x),
  'own history: all records with the exercise name');

select pg_temp.check((select count(*) = 0 from public.exercise_logs), 'athlete can''t read the table directly');

do $$ begin
  insert into public.exercise_logs (athlete_id, exercise_id, performed_on, reps, kg)
  values ((select a_id from fx), (select exercise_id from fx), current_date, 1, 1);
  perform pg_temp.check(false, 'athlete can''t insert into the table directly');
exception when insufficient_privilege then
  perform pg_temp.check(true, 'athlete can''t insert into the table directly');
end $$;

select pg_temp.check(
  (select (public.update_my_exercise_log((select (j->>'id')::uuid from logged), current_date - 6, 5, 80, 'pb')->>'reps')::int = 5),
  'athlete edits own record');

-- ─── Athlete B: nothing of A's ──────────────────────────────────────────────

select pg_temp.act_as((select b_user from fx));

select pg_temp.check(
  (select public.get_my_exercise_logs(array[(select exercise_id from fx)]) = '[]'::jsonb),
  'another athlete sees none of A''s records');
select pg_temp.check((select public.get_my_exercise_history() = '[]'::jsonb), 'another athlete''s history: none of A''s');

do $$ begin
  perform public.update_my_exercise_log((select (j->>'id')::uuid from logged), current_date, 1, 1);
  perform pg_temp.check(false, 'another athlete can''t edit A''s record');
exception when no_data_found then
  perform pg_temp.check(true, 'another athlete can''t edit A''s record');
end $$;

do $$ begin
  perform public.delete_my_exercise_log((select (j->>'id')::uuid from logged));
  perform pg_temp.check(false, 'another athlete can''t delete A''s record');
exception when no_data_found then
  perform pg_temp.check(true, 'another athlete can''t delete A''s record');
end $$;

-- ─── Coaches: read only, own athletes only ──────────────────────────────────

select pg_temp.act_as((select coach_user from fx));

select pg_temp.check(
  (select count(*) = 3 from public.exercise_logs where athlete_id = (select a_id from fx)),
  'coach sees own athlete''s records');

do $$ begin
  update public.exercise_logs set reps = 1 where athlete_id = (select a_id from fx);
  perform pg_temp.check(false, 'coach can''t edit records');
exception when insufficient_privilege then
  perform pg_temp.check(true, 'coach can''t edit records');
end $$;

do $$ begin
  delete from public.exercise_logs where athlete_id = (select a_id from fx);
  perform pg_temp.check(false, 'coach can''t delete records');
exception when insufficient_privilege then
  perform pg_temp.check(true, 'coach can''t delete records');
end $$;

do $$ begin
  perform public.log_exercise((select tracked from fx), current_date, 3, 80);
  perform pg_temp.check(false, 'coach can''t log as an athlete');
exception when insufficient_privilege then
  perform pg_temp.check(true, 'coach can''t log as an athlete');
end $$;

select pg_temp.act_as((select coach2_user from fx));
select pg_temp.check((select count(*) = 0 from public.exercise_logs), 'another coach sees no records');

-- ─── Records survive program edits ──────────────────────────────────────────

reset role;

-- Untick "Track": no new records, but the athlete can still edit old ones
update public.block_exercises set track = false where id = (select tracked from fx);
set local role authenticated;
select pg_temp.act_as((select a_user from fx));
do $$ begin
  perform public.log_exercise((select tracked from fx), current_date, 3, 80);
  perform pg_temp.check(false, 'unticked row can''t get new records');
exception when insufficient_privilege then
  perform pg_temp.check(true, 'unticked row can''t get new records');
end $$;
select pg_temp.check(
  (select (public.update_my_exercise_log((select (j->>'id')::uuid from logged), current_date - 6, 6, 80)->>'reps')::int = 6),
  'old record still editable after unticking');

reset role;

-- Swap the row's exercise: existing records keep theirs
update public.block_exercises set exercise_id = (select other_exercise_id from fx) where id = (select tracked from fx);
select pg_temp.check(
  (select bool_and(exercise_id = (select exercise_id from fx)) from public.exercise_logs where athlete_id = (select a_id from fx)),
  'swapping the row''s exercise keeps the records'' exercise');

-- Remove the row: records stay, unlinked
delete from public.block_exercises where id = (select tracked from fx);
select pg_temp.check(
  (select count(*) = 3 and bool_and(block_exercise_id is null) from public.exercise_logs where athlete_id = (select a_id from fx)),
  'removing the row keeps its records (unlinked)');

-- ─── Delete, disabled login, anon ───────────────────────────────────────────

set local role authenticated;
select pg_temp.act_as((select a_user from fx));
select public.delete_my_exercise_log((select (j->>'id')::uuid from logged));
select pg_temp.check(
  (select jsonb_array_length(public.get_my_exercise_logs(array[(select exercise_id from fx)])) = 2),
  'athlete deletes own record');

reset role;
update public.athletes set login_disabled = true where id = (select a_id from fx);
set local role authenticated;
select pg_temp.act_as((select a_user from fx));
select pg_temp.check(
  (select public.get_my_exercise_logs(array[(select exercise_id from fx)]) = '[]'::jsonb),
  'disabled athlete sees no records');

reset role;
set local role anon;
select set_config('request.jwt.claims', '{"role":"anon"}', true);
do $$ begin
  perform public.get_my_exercise_logs(array[(select exercise_id from fx)]);
  perform pg_temp.check(false, 'anon can''t call get_my_exercise_logs');
exception when insufficient_privilege then
  perform pg_temp.check(true, 'anon can''t call get_my_exercise_logs');
end $$;
do $$ begin
  perform public.get_my_exercise_history();
  perform pg_temp.check(false, 'anon can''t call get_my_exercise_history');
exception when insufficient_privilege then
  perform pg_temp.check(true, 'anon can''t call get_my_exercise_history');
end $$;
do $$ begin
  perform count(*) from public.exercise_logs;
  perform pg_temp.check(false, 'anon can''t read the table');
exception when insufficient_privilege then
  perform pg_temp.check(true, 'anon can''t read the table');
end $$;

reset role;
delete from public.athletes where id = (select a_id from fx);
select pg_temp.check(
  (select count(*) = 0 from public.exercise_logs where athlete_id = (select a_id from fx)),
  'deleting the athlete deletes their records');

-- ─── Report ─────────────────────────────────────────────────────────────────

reset role;
select case when ok then 'PASS ' else 'FAIL ' end || name as result from results;
select count(*) filter (where ok) || ' passed, ' || count(*) filter (where not ok) || ' failed' as summary from results;

rollback;
