-- Behaviour tests for migration E (coach name in the program JSON). Everything is rolled back, including the
-- migration itself — so this runs against a database that does NOT have E yet (but has D).
-- Run from the repo root:  psql "$DB_URL" -v ON_ERROR_STOP=1 -f supabase/tests/coach_name_e_test.sql
-- Each check prints "PASS …" or "FAIL …".

begin;

create temp table shared_before as
select p.public_token, public.get_shared_program(p.public_token) as json, c.name as coach_name, c.username
from public.programs p join public.coaches c on c.id = p.coach_id
where p.is_public;

\i supabase/migrations/20261005100000_coach_name_e.sql

create temp table results (ok boolean, name text);
grant insert on results to anon, authenticated;
grant select on shared_before to anon;
create function pg_temp.check(p_ok boolean, p_name text) returns void language sql as $$
  insert into results values (coalesce(p_ok, false), p_name);
$$;

select pg_temp.check((select count(*) > 0 from shared_before), 'there are share links to compare');

select pg_temp.check(
  (select bool_and(public.get_shared_program(b.public_token) - 'coach_name' = b.json) from shared_before b),
  'share links: same output as before, apart from coach_name');

select pg_temp.check(
  (select bool_and(public.get_shared_program(b.public_token)->>'coach_name' = b.coach_name) from shared_before b),
  'coach_name is the coach''s display name');

-- Anon still opens share links
set local role anon;
select set_config('request.jwt.claims', '{"role":"anon"}', true);
select pg_temp.check(
  (select public.get_shared_program((select public_token from shared_before limit 1))->>'coach_name' is not null),
  'anon: share link includes the coach name');

reset role;
select case when ok then 'PASS ' else 'FAIL ' end || name as result from results;
select count(*) filter (where ok) || ' passed, ' || count(*) filter (where not ok) || ' failed' as summary from results;

rollback;
