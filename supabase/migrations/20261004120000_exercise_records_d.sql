-- Migration D — exercise records (additive, non-breaking).
-- The coach ticks "Track" on a few exercise rows of a program; on those rows the athlete logs their best set
-- (reps × kg) with a date, as often as they do that day. History belongs to the exercise, so it continues across
-- programs. Athletes write only through the security-definer functions below (no direct table access, like
-- migration C); coaches and the admin can only read their athletes' records.
-- Plan: TODO.md → "Exercise records".

-- ─── 1. "Track" on program rows ─────────────────────────────────────────────
-- Written by the coach's program editor under the existing block_exercises RLS.

alter table public.block_exercises add column track boolean not null default false;

-- ─── 2. Records ─────────────────────────────────────────────────────────────
-- exercise_id is stored, not derived from the row: a coach can swap the exercise of an existing row, and next
-- month's program is a copy with new rows. block_exercise_id only says where it was logged from.
-- No delete rule on exercise_id: the app can't delete exercises, and a record must never silently disappear.

create table public.exercise_logs (
  id                 uuid          primary key default gen_random_uuid(),
  athlete_id         uuid          not null references public.athletes (id) on delete cascade,
  exercise_id        uuid          not null references public.exercises (id),
  block_exercise_id  uuid          references public.block_exercises (id) on delete set null,
  performed_on       date          not null check (performed_on >= date '2020-01-01'),
  reps               integer       not null check (reps between 1 and 100),
  kg                 numeric(6, 2) not null check (kg between 0 and 1000),
  note               text          check (char_length(note) <= 500),
  created_at         timestamptz   not null default now(),
  updated_at         timestamptz   not null default now()
);
create index exercise_logs_athlete_exercise_idx on public.exercise_logs (athlete_id, exercise_id, performed_on desc);
create index exercise_logs_block_exercise_id_idx on public.exercise_logs (block_exercise_id);
create index exercise_logs_exercise_id_idx on public.exercise_logs (exercise_id);

alter table public.exercise_logs enable row level security;

-- Coaches see their own athletes' records, the admin all (athletes are never can_manage → nothing)
create policy "Records of the coach's athletes, admin all" on public.exercise_logs
  for select to authenticated
  using (exists (select 1 from public.athletes a where a.id = athlete_id and public.can_manage(a.coach_id)));

revoke all on public.exercise_logs from anon, authenticated;
grant select on public.exercise_logs to authenticated;

-- ─── 3. Program JSON returns "track" ────────────────────────────────────────
-- Same as migration C plus 'track' on each row.

create or replace function public.program_json(p_program_id uuid) returns jsonb
  language sql stable security definer set search_path = ''
as $$
  select jsonb_build_object(
    'id', p.id, 'title', p.title, 'description', p.description,
    'public_token', p.public_token, 'created_at', p.created_at,
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

-- ─── 4. The athlete's writes and reads ──────────────────────────────────────
-- Friendly messages (shown in the app) for bad values; the table checks are the backstop.
-- "Future" allows tomorrow: the server's date is UTC, the athlete's phone may already be on the next day.

create function public.check_exercise_log(p_performed_on date, p_reps integer, p_kg numeric, p_note text)
  returns void language plpgsql stable set search_path = ''
as $$
begin
  if p_performed_on is null or p_performed_on < date '2020-01-01' or p_performed_on > current_date + 1 then
    raise exception 'Pick a date that isn''t in the future' using errcode = 'check_violation';
  end if;
  if p_reps is null or p_reps not between 1 and 100 then
    raise exception 'Reps must be between 1 and 100' using errcode = 'check_violation';
  end if;
  if p_kg is null or p_kg not between 0 and 1000 then
    raise exception 'Kg must be between 0 and 1000' using errcode = 'check_violation';
  end if;
  if char_length(p_note) > 500 then
    raise exception 'The note can be at most 500 characters' using errcode = 'check_violation';
  end if;
end;
$$;

-- A record as the athlete app sees it
create function public.exercise_log_json(l public.exercise_logs) returns jsonb
  language sql immutable set search_path = ''
as $$
  select jsonb_build_object(
    'id', l.id, 'exercise_id', l.exercise_id, 'block_exercise_id', l.block_exercise_id,
    'performed_on', l.performed_on, 'reps', l.reps, 'kg', l.kg, 'note', l.note, 'created_at', l.created_at
  )
$$;

-- New record on a tracked row of one of the athlete's own programs
create function public.log_exercise(
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

-- Edit an own record (even if the coach has since unticked "Track")
create function public.update_my_exercise_log(
  p_id uuid, p_performed_on date, p_reps integer, p_kg numeric, p_note text default null
) returns jsonb
  language plpgsql security definer set search_path = ''
as $$
declare
  v_log public.exercise_logs;
begin
  perform public.check_exercise_log(p_performed_on, p_reps, p_kg, p_note);
  update public.exercise_logs
  set performed_on = p_performed_on, reps = p_reps, kg = p_kg, note = nullif(btrim(p_note), ''), updated_at = now()
  where id = p_id and athlete_id = public.my_athlete_id()
  returning * into v_log;
  if not found then
    raise exception 'Record not found' using errcode = 'no_data_found';
  end if;
  return public.exercise_log_json(v_log);
end;
$$;

create function public.delete_my_exercise_log(p_id uuid) returns void
  language plpgsql security definer set search_path = ''
as $$
begin
  delete from public.exercise_logs where id = p_id and athlete_id = public.my_athlete_id();
  if not found then
    raise exception 'Record not found' using errcode = 'no_data_found';
  end if;
end;
$$;

-- Own records of these exercises (all programs), newest first
create function public.get_my_exercise_logs(p_exercise_ids uuid[]) returns jsonb
  language sql stable security definer set search_path = ''
as $$
  select coalesce(jsonb_agg(public.exercise_log_json(l) order by l.performed_on desc, l.created_at desc), '[]'::jsonb)
  from public.exercise_logs l
  where l.athlete_id = public.my_athlete_id() and l.exercise_id = any (p_exercise_ids)
$$;

-- All own records with the exercise's name, newest first — the athlete's progress page
create function public.get_my_exercise_history() returns jsonb
  language sql stable security definer set search_path = ''
as $$
  select coalesce(jsonb_agg(
    public.exercise_log_json(l) || jsonb_build_object('exercise_name', e.name)
    order by l.performed_on desc, l.created_at desc), '[]'::jsonb)
  from public.exercise_logs l
  join public.exercises e on e.id = l.exercise_id
  where l.athlete_id = public.my_athlete_id()
$$;

-- ─── 5. Privileges ──────────────────────────────────────────────────────────

revoke execute on function public.check_exercise_log(date, integer, numeric, text),
  public.exercise_log_json(public.exercise_logs) from public, anon, authenticated;

revoke execute on function public.log_exercise(uuid, date, integer, numeric, text),
  public.update_my_exercise_log(uuid, date, integer, numeric, text), public.delete_my_exercise_log(uuid),
  public.get_my_exercise_logs(uuid[]), public.get_my_exercise_history() from public, anon;
grant execute on function public.log_exercise(uuid, date, integer, numeric, text),
  public.update_my_exercise_log(uuid, date, integer, numeric, text), public.delete_my_exercise_log(uuid),
  public.get_my_exercise_logs(uuid[]), public.get_my_exercise_history() to authenticated;
