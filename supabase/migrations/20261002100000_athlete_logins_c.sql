-- Migration C — athlete logins (additive, non-breaking).
-- Athletes log in (first via a one-time login link from their coach) and read their own programs. They get NO
-- direct table access: RLS is per row, not per column, and their own athletes row holds the coach's notes.
-- Everything an athlete sees comes from the security-definer get_my_*() functions below. Coach/admin RLS is
-- untouched — an athlete is neither, so can_manage() is false for them everywhere.
-- Plan: TODO.md → "Athlete logins + PWA".

-- ─── 1. Login columns on athletes ───────────────────────────────────────────
-- user_id: the athlete's auth user (`<username>@login.invalid`), created on the first login link.
-- Only server routes (service role) write these three columns — see the guard trigger in section 3.

alter table public.athletes
  add column user_id        uuid    unique references auth.users (id) on delete set null,
  add column username       text    unique check (username ~ '^[a-z0-9._-]{3,32}$'),
  add column login_disabled boolean not null default false;

-- ─── 2. Usernames are unique across coaches and athletes ─────────────────────
-- Both log in as `<username>@login.invalid`, so one name can't belong to both. auth.users would refuse the
-- duplicate email anyway, but only once the athlete's auth user exists; this catches it when the coach types it.

create function public.check_username_free() returns trigger
  language plpgsql security definer set search_path = ''
as $$
begin
  if new.username is null then return new; end if;
  if (tg_table_name = 'athletes' and exists (select 1 from public.coaches  where username = new.username))
  or (tg_table_name = 'coaches'  and exists (select 1 from public.athletes where username = new.username)) then
    raise exception 'Username "%" is already taken', new.username using errcode = 'unique_violation';
  end if;
  return new;
end;
$$;

create trigger athletes_check_username_free
  before insert or update of username on public.athletes
  for each row execute function public.check_username_free();

create trigger coaches_check_username_free
  before insert or update of username on public.coaches
  for each row execute function public.check_username_free();

-- ─── 3. Only the server writes login columns ────────────────────────────────
-- Coaches can update their athletes' rows (RLS), but must not set user_id: pointing it at someone else's auth
-- user would hand that user the athlete's programs through get_my_*(). Changes go through the API routes,
-- which use the service role.

create function public.athletes_guard_login() returns trigger
  language plpgsql set search_path = ''
as $$
begin
  if current_user in ('anon', 'authenticated') and (
       (tg_op = 'INSERT' and (new.user_id is not null or new.username is not null or new.login_disabled))
    or (tg_op = 'UPDATE' and (new.user_id, new.username, new.login_disabled)
                             is distinct from (old.user_id, old.username, old.login_disabled))
  ) then
    raise exception 'Athlete logins are managed through the app' using errcode = 'insufficient_privilege';
  end if;
  return new;
end;
$$;

create trigger athletes_guard_login
  before insert or update on public.athletes
  for each row execute function public.athletes_guard_login();

-- ─── 4. Login links ─────────────────────────────────────────────────────────
-- Our own one-time token (7 days), exchanged just in time for a short-lived Supabase magic-link token by
-- POST /api/login-link/redeem. Only the SHA-256 of the token is stored. Service role only: RLS on, no policies.

create table public.athlete_login_links (
  id          uuid        primary key default gen_random_uuid(),
  athlete_id  uuid        not null references public.athletes (id) on delete cascade,
  token_hash  text        not null unique check (token_hash ~ '^[0-9a-f]{64}$'),
  expires_at  timestamptz not null,
  used_at     timestamptz,
  created_by  uuid        references auth.users (id) on delete set null,
  created_at  timestamptz not null default now()
);
create index athlete_login_links_athlete_id_idx on public.athlete_login_links (athlete_id);

alter table public.athlete_login_links enable row level security;
revoke all on public.athlete_login_links from anon, authenticated;

-- ─── 5. Who is the logged-in athlete ────────────────────────────────────────

-- The logged-in user's athlete id, only while their login is enabled
create function public.my_athlete_id() returns uuid
  language sql stable security definer set search_path = ''
as $$
  select id from public.athletes where user_id = auth.uid() and not login_disabled
$$;

-- ─── 6. Program JSON, shared by share links and the athlete app ─────────────
-- Same shape as the app's PROGRAM_QUERY select, so mapToProgramViewModel works unchanged. Internal: no client
-- may call it directly (it doesn't check access) — only the functions below.

create function public.program_json(p_program_id uuid) returns jsonb
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
  where p.id = p_program_id
$$;

-- Same output as before, now built by program_json()
create or replace function public.get_shared_program(p_token text) returns jsonb
  language sql stable security definer set search_path = ''
as $$
  select public.program_json(p.id) from public.programs p where p.public_token = p_token and p.is_public
$$;

-- ─── 7. The athlete app's reads ─────────────────────────────────────────────
-- All return null / [] for anyone who isn't a logged-in athlete with login enabled.

-- Own profile: no notes, no coach_id — just what the athlete app shows
create function public.get_my_athlete() returns jsonb
  language sql stable security definer set search_path = ''
as $$
  select jsonb_build_object(
    'id', a.id, 'name', a.name, 'surname', a.surname, 'avatar_url', a.avatar_url, 'username', a.username,
    'coach_name', (select c.name from public.coaches c where c.id = a.coach_id)
  )
  from public.athletes a
  where a.id = public.my_athlete_id()
$$;

-- All own programs, newest first (public or not — the share toggle is about links, not the athlete)
create function public.get_my_programs() returns jsonb
  language sql stable security definer set search_path = ''
as $$
  select coalesce(jsonb_agg(jsonb_build_object(
    'id', p.id, 'title', p.title, 'description', p.description, 'created_at', p.created_at,
    'day_count', (select count(*) from public.program_days d where d.program_id = p.id)
  ) order by p.created_at desc), '[]'::jsonb)
  from public.programs p
  where p.athlete_id = public.my_athlete_id()
$$;

-- One own program, or null if it isn't theirs
create function public.get_my_program(p_program_id uuid) returns jsonb
  language sql stable security definer set search_path = ''
as $$
  select public.program_json(p.id)
  from public.programs p
  where p.id = p_program_id and p.athlete_id = public.my_athlete_id()
$$;

-- ─── 8. Privileges ──────────────────────────────────────────────────────────

revoke execute on function public.program_json(uuid) from public, anon, authenticated;

revoke execute on function public.my_athlete_id(), public.get_my_athlete(), public.get_my_programs(),
  public.get_my_program(uuid) from public, anon;
grant execute on function public.my_athlete_id(), public.get_my_athlete(), public.get_my_programs(),
  public.get_my_program(uuid) to authenticated;

-- Trigger functions aren't meant to be called directly
revoke execute on function public.check_username_free(), public.athletes_guard_login()
  from public, anon, authenticated;
