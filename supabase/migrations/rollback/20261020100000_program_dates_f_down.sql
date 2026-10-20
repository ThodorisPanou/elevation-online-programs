-- Rollback for migration F (program dates). Restores the schema to right after migration E.
-- LOSES DATA: every program's start and end date (all programs become visible to their athletes again).
-- Deploy the app WITHOUT program dates first: the new app reads and writes the columns dropped here.

-- Program JSON: back to migration E's version (no dates)
create or replace function public.program_json(p_program_id uuid) returns jsonb
  language sql stable security definer set search_path = ''
as $$
  select jsonb_build_object(
    'id', p.id, 'title', p.title, 'description', p.description,
    'public_token', p.public_token, 'created_at', p.created_at,
    'coach_name', (select c.name from public.coaches c where c.id = p.coach_id),
    'athletes', (
      select jsonb_build_object('id', a.id, 'name', a.name, 'surname', a.surname, 'avatar_url', a.avatar_url)
      from public.athletes a where a.id = p.athlete_id
    ),
    'program_days', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', d.id, 'name', d.name, 'order_index', d.order_index,
        'blocks', coalesce((
          select jsonb_agg(jsonb_build_object(
            'id', b.id, 'name', b.name, 'order_index', b.order_index,
            'block_exercises', coalesce((
              select jsonb_agg(jsonb_build_object(
                'id', be.id, 'sets', be.sets, 'reps', be.reps, 'kg', be.kg,
                'rest_seconds', be.rest_seconds, 'notes', be.notes, 'order_index', be.order_index,
                'track', be.track,
                'exercises', (
                  select jsonb_build_object('id', e.id, 'name', e.name, 'video_url', e.video_url)
                  from public.exercises e where e.id = be.exercise_id
                )
              ) order by be.order_index)
              from public.block_exercises be where be.block_id = b.id
            ), '[]'::jsonb)
          ) order by b.order_index)
          from public.blocks b where b.day_id = d.id
        ), '[]'::jsonb)
      ) order by d.order_index)
      from public.program_days d where d.program_id = p.id
    ), '[]'::jsonb)
  )
  from public.programs p
  where p.id = p_program_id
$$;

-- Share link, athlete reads: back to migration C's versions
create or replace function public.get_shared_program(p_token text) returns jsonb
  language sql stable security definer set search_path = ''
as $$
  select public.program_json(p.id) from public.programs p where p.public_token = p_token and p.is_public
$$;

create or replace function public.get_my_programs() returns jsonb
  language sql stable security definer set search_path = ''
as $$
  select coalesce(jsonb_agg(jsonb_build_object(
    'id', p.id, 'title', p.title, 'description', p.description, 'created_at', p.created_at,
    'day_count', (select count(*) from public.program_days d where d.program_id = p.id)
  ) order by p.created_at desc), '[]'::jsonb)
  from public.programs p
  where p.athlete_id = public.my_athlete_id()
$$;

create or replace function public.get_my_program(p_program_id uuid) returns jsonb
  language sql stable security definer set search_path = ''
as $$
  select public.program_json(p.id)
  from public.programs p
  where p.id = p_program_id and p.athlete_id = public.my_athlete_id()
$$;

-- Logging: back to migration D's version (no availability check)
create or replace function public.log_exercise(
  p_block_exercise_id uuid, p_performed_on date, p_reps integer, p_kg numeric, p_note text default null
) returns jsonb
  language plpgsql security definer set search_path = ''
as $$
declare
  v_athlete  uuid := public.my_athlete_id();
  v_exercise uuid;
  v_log      public.exercise_logs;
begin
  if v_athlete is null then
    raise exception 'Only athletes can log exercises' using errcode = 'insufficient_privilege';
  end if;

  select be.exercise_id into v_exercise
  from public.block_exercises be
  join public.blocks       b on b.id = be.block_id
  join public.program_days d on d.id = b.day_id
  join public.programs     p on p.id = d.program_id
  where be.id = p_block_exercise_id and be.track and p.athlete_id = v_athlete;
  if v_exercise is null then
    raise exception 'This exercise can''t be logged' using errcode = 'insufficient_privilege';
  end if;

  perform public.check_exercise_log(p_performed_on, p_reps, p_kg, p_note);
  insert into public.exercise_logs (athlete_id, exercise_id, block_exercise_id, performed_on, reps, kg, note)
  values (v_athlete, v_exercise, p_block_exercise_id, p_performed_on, p_reps, p_kg, nullif(btrim(p_note), ''))
  returning * into v_log;
  return public.exercise_log_json(v_log);
end;
$$;

drop function if exists public.program_unavailable_json(public.programs);
drop function if exists public.program_is_available(public.programs);

alter table public.programs drop constraint if exists programs_dates_check;
alter table public.programs drop column if exists start_date, drop column if exists end_date;

drop function if exists public.app_today();
