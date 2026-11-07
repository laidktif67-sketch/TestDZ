-- TestDZ / 009_auth_profiles_onboarding_storage
-- Profile metadata is client-editable only through an explicit column allowlist.
-- Authorization roles remain server-managed in public.user_roles.

begin;

alter table public.profiles
  add column if not exists phone text,
  add column if not exists interests jsonb not null default '[]'::jsonb,
  add column if not exists onboarding_completed_at timestamptz;

alter table public.profiles
  add constraint profiles_interests_is_array
  check (jsonb_typeof(interests) = 'array');

-- Sync email verification from Supabase Auth; clients cannot write this column.
create or replace function private.sync_auth_user_profile()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.profiles
     set is_verified = (new.email_confirmed_at is not null),
         updated_at = now()
   where id = new.id;
  return new;
end;
$$;

revoke all on function private.sync_auth_user_profile() from public, anon, authenticated;

drop trigger if exists on_auth_user_email_confirmed_testdz on auth.users;
create trigger on_auth_user_email_confirmed_testdz
after update of email_confirmed_at on auth.users
for each row
when (old.email_confirmed_at is distinct from new.email_confirmed_at)
execute function private.sync_auth_user_profile();

update public.profiles p
   set is_verified = (u.email_confirmed_at is not null)
  from auth.users u
 where u.id = p.id
   and p.is_verified is distinct from (u.email_confirmed_at is not null);

-- User-editable fields only. Protected fields (is_verified, is_banned,
-- subscription_tier and onboarding_completed_at) are deliberately excluded.
grant update (display_name, phone, bio, locale, avatar_url, interests)
  on public.profiles to authenticated;

-- A caller can only set their own tester/developer combination.
-- Admin/support roles are never accepted or removed by this function.
create or replace function public.complete_onboarding(
  p_roles text[],
  p_interests jsonb default '[]'::jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_role text;
begin
  if v_user_id is null then
    raise exception 'authentication required' using errcode = '42501';
  end if;

  if p_roles is null
     or cardinality(p_roles) < 1
     or cardinality(p_roles) > 2
     or exists (
       select 1
       from unnest(p_roles) as requested(role_name)
       where requested.role_name not in ('tester', 'developer')
     ) then
    raise exception 'invalid role selection' using errcode = '22023';
  end if;

  if jsonb_typeof(coalesce(p_interests, '[]'::jsonb)) <> 'array'
     or jsonb_array_length(coalesce(p_interests, '[]'::jsonb)) > 20 then
    raise exception 'invalid interests' using errcode = '22023';
  end if;

  delete from public.user_roles
   where user_id = v_user_id
     and role in ('tester', 'developer');

  foreach v_role in array p_roles loop
    insert into public.user_roles(user_id, role)
    values (v_user_id, v_role)
    on conflict (user_id, role) do nothing;
  end loop;

  update public.profiles
     set interests = coalesce(p_interests, '[]'::jsonb),
         onboarding_completed_at = now(),
         updated_at = now()
   where id = v_user_id;

  return jsonb_build_object('status', 'ok', 'roles', to_jsonb(p_roles));
end;
$$;

revoke all on function public.complete_onboarding(text[], jsonb) from public, anon;
grant execute on function public.complete_onboarding(text[], jsonb) to authenticated;

-- Public avatars; writes are restricted to the authenticated owner's folder.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('avatars', 'avatars', true, 2097152, array['image/jpeg','image/png','image/webp'])
on conflict (id) do update
set public = excluded.public,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists avatars_owner_select on storage.objects;
create policy avatars_owner_select on storage.objects
  for select to authenticated
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = (select auth.uid())::text);

drop policy if exists avatars_owner_insert on storage.objects;
create policy avatars_owner_insert on storage.objects
  for insert to authenticated
  with check (bucket_id = 'avatars' and (storage.foldername(name))[1] = (select auth.uid())::text);

drop policy if exists avatars_owner_update on storage.objects;
create policy avatars_owner_update on storage.objects
  for update to authenticated
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = (select auth.uid())::text)
  with check (bucket_id = 'avatars' and (storage.foldername(name))[1] = (select auth.uid())::text);

drop policy if exists avatars_owner_delete on storage.objects;
create policy avatars_owner_delete on storage.objects
  for delete to authenticated
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = (select auth.uid())::text);

commit;
