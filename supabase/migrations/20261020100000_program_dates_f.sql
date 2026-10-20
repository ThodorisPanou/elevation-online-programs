-- Migration F — program start and end dates (additive, non-breaking).
-- Every program is available from its start date through its end date (both included, dates only). Outside them
-- athletes don't see it in their app, and its share link / app page shows "not available" — without the exercises,
-- so the content really is closed, not just hidden. "Today" is the date in Greece, decided here, never by a phone.
-- Existing programs: start = the day they were created (Greek time), end = start + 30 days; the exercise library
-- program ("All Exercises (Library)") stays open until 2099. Coaches/admin keep full access through their tables.

-- ─── 1. Columns ─────────────────────────────────────────────────────────────

create function public.app_today() returns date
  language sql stable set search_path = ''
as $$
  select (now() at time zone 'Europe/Athens')::date
$$;

alter table public.programs add column start_date date, add column end_date date;

update public.programs set start_date = (created_at at time zone 'Europe/Athens')::date;
update public.programs set end_date = start_date + 30;

-- The library program is a catalogue of every exercise, not a training block — keep its link working
update public.programs p set end_date = date '2099-12-31'
from public.athletes a
where a.id = p.athlete_id and a.name = 'All Exercises' and a.surname = '(Library)';

-- The app always sends both dates. The defaults are for anything that doesn't: the app version still live while
-- this migration is applied, and "Copy to athlete" (a copy starts today, for 30 days)
alter table public.programs
  alter column start_date set default public.app_today(),
  alter column end_date   set default public.app_today() + 30,
  alter column start_date set not null,
  alter column end_date   set not null,
  add constraint programs_dates_check check (end_date >= start_date);

-- ─── 2. Availability ────────────────────────────────────────────────────────

create function public.program_is_available(p public.programs) returns boolean
  language sql stable set search_path = ''
as $$
  select public.app_today() between p.start_date and p.end_date
$$;

-- What a closed program shows: enough for "not available, speak with your coach", nothing of its content
create function public.program_unavailable_json(p public.programs) returns jsonb
  language sql stable security definer set search_path = ''
as $$
  select jsonb_build_object(
    'id', p.id, 'title', p.title, 'unavailable', true,
    'start_date', p.start_date, 'end_date', p.end_date,
    'coach_name', (select c.name from public.coaches c where c.id = p.coach_id)
  )
$$;

-- ─── 3. Program JSON returns the dates ──────────────────────────────────────
-- Same as migration E plus 'start_date' / 'end_date'.

create or replace function public.program_json(p_program_id uuid) returns jsonb
  language sql stable security definer set search_path = ''
as $$
  select jsonb_build_object(
    'id', p.id, 'title', p.title, 'description', p.description,
    'public_token', p.public_token, 'created_at', p.created_at,
    'start_date', p.start_date, 'end_date', p.end_date,
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

-- ─── 4. Share links and the athlete app ─────────────────────────────────────

-- Share link: the program while available, else only "unavailable" (null for unknown / not public, as before)
create or replace function public.get_shared_program(p_token text) returns jsonb
  language sql stable security definer set search_path = ''
as $$
  select case when public.program_is_available(p) then public.program_json(p.id)
              else public.program_unavailable_json(p) end
  from public.programs p where p.public_token = p_token and p.is_public
$$;

-- Own programs available today, newest start first
create or replace function public.get_my_programs() returns jsonb
  language sql stable security definer set search_path = ''
as $$
  select coalesce(jsonb_agg(jsonb_build_object(
    'id', p.id, 'title', p.title, 'description', p.description, 'created_at', p.created_at,
    'start_date', p.start_date, 'end_date', p.end_date,
    'day_count', (select count(*) from public.program_days d where d.program_id = p.id)
  ) order by p.start_date desc, p.created_at desc), '[]'::jsonb)
  from public.programs p
  where p.athlete_id = public.my_athlete_id() and public.program_is_available(p)
$$;

-- One own program: in full while available, else only "unavailable"; null if it isn't theirs
create or replace function public.get_my_program(p_program_id uuid) returns jsonb
  language sql stable security definer set search_path = ''
as $$
  select case when public.program_is_available(p) then public.program_json(p.id)
              else public.program_unavailable_json(p) end
  from public.programs p
  where p.id = p_program_id and p.athlete_id = public.my_athlete_id()
$$;

-- ─── 5. Logging only on available programs ──────────────────────────────────
-- Same as migration D plus the availability check. Editing / deleting own records stays allowed: they belong to
-- the athlete's history, not to the program.

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
  where be.id = p_block_exercise_id and be.track and p.athlete_id = v_athlete and public.program_is_available(p);
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

-- ─── 6. Privileges ──────────────────────────────────────────────────────────
-- app_today() / program_is_available() are harmless (the defaults and checks above use them); the JSON helper
-- doesn't check access, so no client may call it.

revoke execute on function public.program_unavailable_json(public.programs) from public, anon, authenticated;
