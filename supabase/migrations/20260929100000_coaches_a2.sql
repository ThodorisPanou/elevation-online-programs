-- Migration A2 — give every existing row a coach, then make coach_id required.
-- Run AFTER the first coach exists (created on /admin/coaches). The coach is chosen by username:
--   psql "$DB_URL" -v ON_ERROR_STOP=1 -1 -v coach_username=<username> -f supabase/migrations/20260929100000_coaches_a2.sql
-- Plan: TODO.md → "Coaches (multi-coach)".

select set_config('a2.coach_username', :'coach_username', true);

do $$
declare
  v_coach uuid;
  v_n     int;
begin
  select id into v_coach from public.coaches where username = current_setting('a2.coach_username');
  if v_coach is null then
    raise exception 'No coach with username "%" — create it on /admin/coaches first', current_setting('a2.coach_username');
  end if;

  update public.athletes  set coach_id = v_coach where coach_id is null;
  get diagnostics v_n = row_count;  raise notice 'athletes assigned:  %', v_n;

  update public.exercises set coach_id = v_coach where coach_id is null;
  get diagnostics v_n = row_count;  raise notice 'exercises assigned: %', v_n;

  -- Programs follow their athlete (programs_set_coach trigger re-derives coach_id on update)
  update public.programs  set coach_id = null where coach_id is null;
  get diagnostics v_n = row_count;  raise notice 'programs assigned:  %', v_n;
end $$;

-- Every program must now use its own coach's exercises (the trigger only checks new writes)
do $$
declare v_bad int;
begin
  select count(*) into v_bad
  from public.block_exercises be
  join public.blocks b       on b.id = be.block_id
  join public.program_days d on d.id = b.day_id
  join public.programs p     on p.id = d.program_id
  join public.exercises e    on e.id = be.exercise_id
  where p.coach_id is distinct from e.coach_id;
  if v_bad > 0 then
    raise exception '% program exercises belong to a different coach than their program', v_bad;
  end if;
end $$;

alter table public.athletes  alter column coach_id set not null;
alter table public.exercises alter column coach_id set not null;
alter table public.programs  alter column coach_id set not null;
