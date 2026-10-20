-- Behaviour tests for migration F (program start / end dates). Everything is rolled back, including the
-- migration itself — so this runs against a database that does NOT have F yet (but has E).
-- Run from the repo root:  psql "$DB_URL" -v ON_ERROR_STOP=1 -f supabase/tests/program_dates_f_test.sql
-- Each check prints "PASS …" or "FAIL …".

begin;

create temp table shared_before as
select p.id, p.public_token, public.get_shared_program(p.public_token) as json
from public.programs p where p.is_public;

\i supabase/migrations/20261020100000_program_dates_f.sql

-- ─── Helpers ────────────────────────────────────────────────────────────────

create temp table results (ok boolean, name text);
grant insert on results to anon, authenticated;

create function pg_temp.act_as(p_user uuid) returns void language sql as $$
  select set_config('request.jwt.claims', json_build_object('sub', p_user, 'role', 'authenticated')::text, true);
$$;
create function pg_temp.check(p_ok boolean, p_name text) returns void language sql as $$
  insert into results values (coalesce(p_ok, false), p_name);
$$;

-- ─── Backfill ───────────────────────────────────────────────────────────────

select pg_temp.check(
  (select bool_and(start_date = (created_at at time zone 'Europe/Athens')::date) from public.programs),
  'backfill: start = the day it was created (Greek time)');

select pg_temp.check(
  (select bool_and(end_date = start_date + 30)
   from public.programs p join public.athletes a on a.id = p.athlete_id
   where not (a.name = 'All Exercises' and a.surname = '(Library)')),
  'backfill: end = start + 30 days');

select pg_temp.check(
  (select coalesce(bool_and(end_date = date '2099-12-31'), true)
   from public.programs p join public.athletes a on a.id = p.athlete_id
   where a.name = 'All Exercises' and a.surname = '(Library)'),
  'backfill: the library program stays open until 2099');

select pg_temp.check(public.app_today() = (now() at time zone 'Europe/Athens')::date, 'today is the date in Greece');

-- ─── Fixtures ───────────────────────────────────────────────────────────────
-- The newest program P that has exercise rows, its athlete A with a login, one row of P tracked.

create temp table fx as
select p.athlete_id as a_id, p.id as p_id, p.public_token as p_token,
  '33333333-3333-3333-3333-333333333333'::uuid as a_user
from public.programs p
where exists (select 1 from public.block_exercises be
              join public.blocks b on b.id = be.block_id join public.program_days d on d.id = b.day_id
              where d.program_id = p.id and be.exercise_id is not null)
order by p.created_at desc limit 1;
alter table fx add column row_id uuid;
update fx set row_id = (
  select be.id from public.block_exercises be
  join public.blocks b on b.id = be.block_id join public.program_days d on d.id = b.day_id
  where d.program_id = fx.p_id and be.exercise_id is not null order by be.id limit 1);
grant select on fx to anon, authenticated;

update public.block_exercises set track = true where id = (select row_id from fx);
update public.programs set is_public = true where id = (select p_id from fx);

insert into auth.users (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at, created_at, updated_at)
values ('33333333-3333-3333-3333-333333333333', '00000000-0000-0000-0000-000000000000', 'authenticated',
        'authenticated', 'test.a@login.invalid', '', now(), now(), now());
update public.athletes set user_id = (select a_user from fx), username = 'test.a', login_disabled = false
where id = (select a_id from fx);

select pg_temp.check((select p_id is not null and row_id is not null from fx), 'fixtures: a program with a row');

-- ─── Dates must make sense; defaults ────────────────────────────────────────

do $$
begin
  update public.programs set start_date = date '2026-10-20', end_date = date '2026-10-19'
  where id = (select p_id from fx);
  perform pg_temp.check(false, 'end before start is rejected');
exception when check_violation then
  perform pg_temp.check(true, 'end before start is rejected');
end $$;

do $$
begin
  update public.programs set start_date = null where id = (select p_id from fx);
  perform pg_temp.check(false, 'a missing start date is rejected');
exception when not_null_violation then
  perform pg_temp.check(true, 'a missing start date is rejected');
end $$;

insert into public.programs (athlete_id, title) select a_id, 'Test default dates' from fx;
select pg_temp.check(
  (select start_date = public.app_today() and end_date = public.app_today() + 30
   from public.programs where title = 'Test default dates'),
  'no dates sent (old app, copy) → today until today + 30');
delete from public.programs where title = 'Test default dates';

-- ─── Availability, day by day ───────────────────────────────────────────────
-- Each case: P's dates relative to today, then what the athlete and the share link get.

create temp table cases (name text, start_off int, end_off int, available boolean);
insert into cases values
  ('ended yesterday',          -10, -1, false),
  ('last day is today',        -10,  0, true),
  ('first day is today',         0, 10, true),
  ('one-day program, today',     0,  0, true),
  ('starts tomorrow',            1, 10, false);
grant select on cases to anon, authenticated;

create temp table seen (name text, available boolean, listed boolean, my_full boolean, my_closed boolean,
  shared_full boolean, shared_closed boolean, closed_has_days boolean, can_log boolean);
grant insert on seen to anon, authenticated;

do $$
declare
  c cases;
  v_listed boolean; v_my jsonb; v_shared jsonb; v_log boolean;
begin
  for c in select * from cases loop
    update public.programs
    set start_date = public.app_today() + c.start_off, end_date = public.app_today() + c.end_off
    where id = (select p_id from fx);

    -- The athlete
    perform set_config('role', 'authenticated', true);
    perform pg_temp.act_as((select a_user from fx));
    v_listed := exists (select 1 from jsonb_array_elements(public.get_my_programs()) e
                        where (e->>'id')::uuid = (select p_id from fx));
    v_my     := public.get_my_program((select p_id from fx));
    begin
      perform public.log_exercise((select row_id from fx), public.app_today(), 5, 50);
      v_log := true;
    exception when insufficient_privilege then
      v_log := false;
    end;

    -- Anyone with the link
    perform set_config('role', 'anon', true);
    perform set_config('request.jwt.claims', '{"role":"anon"}', true);
    v_shared := public.get_shared_program((select p_token from fx));

    perform set_config('role', 'authenticated', true);
    insert into seen values (c.name, c.available, v_listed,
      v_my ? 'program_days', coalesce((v_my->>'unavailable')::boolean, false),
      v_shared ? 'program_days', coalesce((v_shared->>'unavailable')::boolean, false),
      (not c.available) and (v_my ? 'program_days' or v_shared ? 'program_days'),
      v_log);
    reset role;
  end loop;
end $$;

select pg_temp.check(listed = available,       name || ': athlete''s list')                       from seen;
select pg_temp.check(my_full = available and my_closed = not available,
                                                name || ': athlete opening it')                     from seen;
select pg_temp.check(shared_full = available and shared_closed = not available,
                                                name || ': share link')                             from seen;
select pg_temp.check(not closed_has_days,       name || ': no exercises when closed')               from seen;
select pg_temp.check(can_log = available,       name || ': logging')                                from seen;

-- Closed answer still carries what the page needs
update public.programs set start_date = public.app_today() + 3, end_date = public.app_today() + 33
where id = (select p_id from fx);
select pg_temp.check(
  (select j->>'title' is not null and (j->>'start_date')::date = public.app_today() + 3 and j ? 'coach_name'
   from (select public.get_shared_program((select p_token from fx)) j) s),
  'closed: title, dates and coach name for the message');

-- Not public / unknown links still give nothing
update public.programs set is_public = false where id = (select p_id from fx);
select pg_temp.check(public.get_shared_program((select p_token from fx)) is null, 'private program: share link null');
select pg_temp.check(public.get_shared_program('no-such-token') is null, 'unknown token: null');

-- ─── Open share links unchanged apart from the dates ────────────────────────

select pg_temp.check(
  (select bool_and(public.get_shared_program(b.public_token) - 'start_date' - 'end_date' = b.json)
   from shared_before b join public.programs p on p.id = b.id
   where public.program_is_available(p) and b.id <> (select p_id from fx)),
  'available share links: same output as before, plus the dates');

-- Clients can't call the JSON helper directly
select pg_temp.check(
  not has_function_privilege('anon', 'public.program_unavailable_json(public.programs)', 'execute')
  and not has_function_privilege('authenticated', 'public.program_unavailable_json(public.programs)', 'execute'),
  'clients can''t call program_unavailable_json');

select case when ok then 'PASS ' else 'FAIL ' end || name as result from results;
select count(*) filter (where ok) || ' passed, ' || count(*) filter (where not ok) || ' failed' as summary from results;

rollback;
