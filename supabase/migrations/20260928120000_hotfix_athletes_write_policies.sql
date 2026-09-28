-- Hotfix: athletes could be inserted/updated by ANYONE (anon key, no login) and by any signed-up user.
-- "Enable insert for admins" / "Enable update for admins" were `to public ... true`, despite their names.
-- Restrict insert + update to rows in `admins`, like the other tables' write policies.

drop policy "Enable insert for admins"                   on public.athletes;
drop policy "Enable insert for authenticated users only" on public.athletes;
drop policy "Enable update for admins"                   on public.athletes;

create policy "Admins can insert athletes" on public.athletes
  for insert to authenticated
  with check (exists (select 1 from public.admins where admins.user_id = auth.uid()));

create policy "Admins can update athletes" on public.athletes
  for update to authenticated
  using      (exists (select 1 from public.admins where admins.user_id = auth.uid()))
  with check (exists (select 1 from public.admins where admins.user_id = auth.uid()));
