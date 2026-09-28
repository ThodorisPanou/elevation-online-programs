-- Migration A — coaches (additive, non-breaking).
-- Existing RLS policies stay as they are; the app keeps working unchanged. coach_id stays NULLABLE here:
-- migration A2 backfills it to the first coach (created from /admin/coaches) and sets NOT NULL.
-- Plan: TODO.md → "Coaches (multi-coach)".

-- ─── 1. Merge duplicate exercise names ──────────────────────────────────────
-- Needed for the per-coach unique name index below. Per case-insensitive name, keep the row with a video
-- (else the oldest), copy over a missing description/video, point block_exercises at it, delete the rest.

create temp table exercise_merge on commit drop as
with ranked as (
  select id, name, video_url, description,
         lower(trim(name)) as key,
         row_number() over (
           partition by lower(trim(name))
           order by (video_url is null), created_at nulls last, id
         ) as rn
  from public.exercises
)
select d.id as dup_id, k.id as keep_id
from ranked d
join ranked k on k.key = d.key and k.rn = 1
where d.rn > 1;

update public.exercises k
set description = coalesce(k.description, d.description),
    video_url   = coalesce(k.video_url,   d.video_url)
from exercise_merge m
join public.exercises d on d.id = m.dup_id
where k.id = m.keep_id;

update public.block_exercises be
set exercise_id = m.keep_id
from exercise_merge m
where be.exercise_id = m.dup_id;

delete from public.exercises e
using exercise_merge m
where e.id = m.dup_id;

-- ─── 2. Coaches ─────────────────────────────────────────────────────────────
-- Login is `<username>@login.invalid` in auth.users (created by the admin via the service role).
-- Admins stay in `admins` and need no coach row.

create table public.coaches (
  id                   uuid        primary key default gen_random_uuid(),
  user_id              uuid        not null unique references auth.users (id) on delete restrict,
  username             text        not null unique check (username ~ '^[a-z0-9._-]{3,32}$'),
  name                 text        not null check (length(trim(name)) > 0),
  email                text,       -- contact only, never used to log in
  active               boolean     not null default true,
  must_change_password boolean     not null default true,
  created_at           timestamptz not null default now()
);

-- ─── 3. Helper functions ────────────────────────────────────────────────────
-- security definer: they read admins/coaches regardless of those tables' RLS (and avoid policy recursion).

create function public.is_admin() returns boolean
  language sql stable security definer set search_path = ''
as $$
  select exists (select 1 from public.admins where user_id = auth.uid())
$$;

-- The logged-in user's coach id, only while the coach is active
create function public.my_coach_id() returns uuid
  language sql stable security definer set search_path = ''
as $$
  select id from public.coaches where user_id = auth.uid() and active
$$;

create function public.can_manage(p_coach_id uuid) returns boolean
  language sql stable security definer set search_path = ''
as $$
  -- coalesce: my_coach_id() is null for non-coaches / inactive coaches → false, not null
  select public.is_admin() or coalesce(p_coach_id = public.my_coach_id(), false)
$$;

-- ─── 4. coach_id columns ────────────────────────────────────────────────────
-- Inserts from a coach fill coach_id automatically; the admin sends it explicitly (picks the coach).

alter table public.athletes  add column coach_id uuid references public.coaches (id) on delete restrict
  default public.my_coach_id();
alter table public.exercises add column coach_id uuid references public.coaches (id) on delete restrict
  default public.my_coach_id();
alter table public.programs  add column coach_id uuid references public.coaches (id) on delete restrict;

create index athletes_coach_id_idx  on public.athletes  (coach_id);
create index exercises_coach_id_idx on public.exercises (coach_id);
create index programs_coach_id_idx  on public.programs  (coach_id);

-- Exercise names unique per coach (case/space-insensitive)
create unique index exercises_coach_name_key on public.exercises (coach_id, lower(trim(name))) nulls not distinct;

-- For RLS on program_days / blocks / block_exercises (migration B)
create function public.can_manage_program(p_program_id uuid) returns boolean
  language sql stable security definer set search_path = ''
as $$
  select public.can_manage((select coach_id from public.programs where id = p_program_id))
$$;

-- ─── 5. Consistency: nothing can be linked across coaches ────────────────────

-- A program always belongs to its athlete's coach: set on every program insert/update, and moved along when
-- an athlete is reassigned. (Not a composite FK programs(athlete_id, coach_id) → athletes: a second FK between
-- the tables makes PostgREST's `athletes(...)` embed ambiguous — PGRST201 — and breaks the app's queries.)
create function public.programs_set_coach() returns trigger
  language plpgsql set search_path = ''
as $$
begin
  select coach_id into new.coach_id from public.athletes where id = new.athlete_id;
  return new;
end;
$$;

create trigger programs_set_coach
  before insert or update of athlete_id, coach_id on public.programs
  for each row execute function public.programs_set_coach();

create function public.athletes_move_programs() returns trigger
  language plpgsql set search_path = ''
as $$
begin
  update public.programs set coach_id = new.coach_id where athlete_id = new.id;
  return null;
end;
$$;

create trigger athletes_move_programs
  after update of coach_id on public.athletes
  for each row when (old.coach_id is distinct from new.coach_id)
  execute function public.athletes_move_programs();

-- A program may only use its own coach's exercises (applies to the admin too)
create function public.block_exercises_check_coach() returns trigger
  language plpgsql set search_path = ''
as $$
declare
  v_program_coach  uuid;
  v_exercise_coach uuid;
begin
  if new.exercise_id is null then return new; end if;

  select p.coach_id into v_program_coach
  from public.blocks b
  join public.program_days d on d.id = b.day_id
  join public.programs p     on p.id = d.program_id
  where b.id = new.block_id;

  select coach_id into v_exercise_coach from public.exercises where id = new.exercise_id;

  if v_program_coach is distinct from v_exercise_coach then
    raise exception 'Exercise belongs to a different coach than this program'
      using errcode = 'check_violation';
  end if;
  return new;
end;
$$;

create trigger block_exercises_check_coach
  before insert or update of exercise_id, block_id on public.block_exercises
  for each row execute function public.block_exercises_check_coach();

-- ─── 6. Share links ─────────────────────────────────────────────────────────
-- Returns one public program in the same shape as the app's PROGRAM_QUERY select, so
-- mapToProgramViewModel works unchanged. Migration B then removes anon's direct table access.

create function public.get_shared_program(p_token text) returns jsonb
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
  where p.public_token = p_token and p.is_public
$$;

-- ─── 7. delete_athlete: coach-aware ─────────────────────────────────────────

create or replace function public.delete_athlete(p_athlete_id uuid) returns text
  language plpgsql set search_path = 'public'
as $$
declare
  v_avatar_url text;
  v_coach_id   uuid;
begin
  select avatar_url, coach_id into v_avatar_url, v_coach_id from athletes where id = p_athlete_id;
  if not found or not public.can_manage(v_coach_id) then
    raise exception 'Athlete could not be deleted (not found, or your account is not allowed to delete athletes)';
  end if;
  delete from programs where athlete_id = p_athlete_id;
  delete from athletes where id = p_athlete_id;
  if not found then
    raise exception 'Athlete could not be deleted (not found, or your account is not allowed to delete athletes)';
  end if;
  return v_avatar_url;
end;
$$;

-- ─── 8. Privileges + RLS for the new objects ────────────────────────────────

alter table public.coaches enable row level security;
revoke all on public.coaches from anon, authenticated;
grant select on public.coaches to authenticated;
-- Writes only from server routes (service role bypasses RLS)
create policy "Coaches read own row, admins read all" on public.coaches
  for select to authenticated
  using (user_id = auth.uid() or public.is_admin());

revoke execute on function public.is_admin(), public.my_coach_id(), public.can_manage(uuid),
  public.can_manage_program(uuid) from public, anon;
grant execute on function public.is_admin(), public.my_coach_id(), public.can_manage(uuid),
  public.can_manage_program(uuid) to authenticated;

-- Trigger functions aren't meant to be called directly
revoke execute on function public.programs_set_coach(), public.athletes_move_programs(),
  public.block_exercises_check_coach() from public, anon, authenticated;

revoke execute on function public.get_shared_program(text) from public;
grant execute on function public.get_shared_program(text) to anon, authenticated;
