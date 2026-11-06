
-- Week 3: app catalog, trusted mutations, and app icon storage.
alter table public.apps
  add column if not exists category text not null default 'other',
  add column if not exists archived_from_status text;

alter table public.apps
  add constraint apps_category_check
  check (category in ('games','tools','education','social','health','other'));

-- Android application IDs are globally unique, including archived records.
create unique index if not exists apps_package_name_global_unique
  on public.apps (lower(package_name));

create index if not exists apps_developer_status_created_idx
  on public.apps (developer_id, status, created_at desc);

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('app-icons','app-icons',true,512000,array['image/png','image/jpeg'])
on conflict (id) do update
set public = excluded.public,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists app_icons_public_read on storage.objects;
create policy app_icons_public_read on storage.objects
for select to anon, authenticated
using (bucket_id = 'app-icons');

drop policy if exists app_icons_owner_insert on storage.objects;
create policy app_icons_owner_insert on storage.objects
for insert to authenticated
with check (
  bucket_id = 'app-icons'
  and (storage.foldername(name))[1] = (select auth.uid())::text
);

drop policy if exists app_icons_owner_update on storage.objects;
create policy app_icons_owner_update on storage.objects
for update to authenticated
using (
  bucket_id = 'app-icons'
  and (storage.foldername(name))[1] = (select auth.uid())::text
)
with check (
  bucket_id = 'app-icons'
  and (storage.foldername(name))[1] = (select auth.uid())::text
);

drop policy if exists app_icons_owner_delete on storage.objects;
create policy app_icons_owner_delete on storage.objects
for delete to authenticated
using (
  bucket_id = 'app-icons'
  and (storage.foldername(name))[1] = (select auth.uid())::text
);

create or replace function private.create_app_impl(
  p_name text,
  p_package_name text,
  p_description text,
  p_category text
) returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_plan_code text;
  v_limits jsonb;
  v_max_apps integer;
  v_current_count integer;
  v_app_id uuid;
begin
  if v_user_id is null then
    raise exception using errcode = '28000', message = 'AUTH_REQUIRED';
  end if;

  if not exists (
    select 1 from public.user_roles ur
    where ur.user_id = v_user_id and ur.role in ('developer','admin')
  ) then
    raise exception using errcode = '42501', message = 'DEVELOPER_ROLE_REQUIRED';
  end if;

  if p_name is null or char_length(btrim(p_name)) < 3 or char_length(btrim(p_name)) > 50 then
    raise exception using errcode = '22023', message = 'APP_NAME_INVALID';
  end if;
  if p_description is null or char_length(btrim(p_description)) < 20 or char_length(btrim(p_description)) > 500 then
    raise exception using errcode = '22023', message = 'APP_DESCRIPTION_INVALID';
  end if;
  if p_package_name is null or p_package_name !~ '^[a-z][a-z0-9_]*(\\.[a-z][a-z0-9_]*)+$' then
    raise exception using errcode = '22023', message = 'PACKAGE_NAME_INVALID';
  end if;
  if p_category not in ('games','tools','education','social','health','other') then
    raise exception using errcode = '22023', message = 'APP_CATEGORY_INVALID';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(v_user_id::text, 0));

  select s.plan_code, s.limits
    into v_plan_code, v_limits
  from public.get_active_subscription() s
  limit 1;

  if v_plan_code is null then
    select p.code, p.limits into v_plan_code, v_limits
    from public.plans p where p.code = 'free' and p.is_active
    limit 1;
  end if;

  v_max_apps := coalesce((v_limits ->> 'max_active_apps')::integer, 1);

  select count(*)::integer into v_current_count
  from public.apps a
  where a.developer_id = v_user_id
    and a.status <> 'archived';

  if v_current_count >= v_max_apps then
    raise exception using errcode = 'P0001',
      message = 'PLAN_LIMIT_REACHED',
      detail = jsonb_build_object('plan',coalesce(v_plan_code,'free'),'used',v_current_count,'limit',v_max_apps)::text;
  end if;

  insert into public.apps (developer_id,name,package_name,description,category,status)
  values (v_user_id,btrim(p_name),lower(btrim(p_package_name)),btrim(p_description),p_category,'draft')
  returning id into v_app_id;

  return v_app_id;
end;
$$;

create or replace function private.update_app_impl(
  p_app_id uuid,
  p_name text,
  p_description text,
  p_category text,
  p_icon_url text default null
) returns void
language plpgsql
security definer
set search_path = ''
as $$
declare v_user_id uuid := auth.uid();
begin
  if v_user_id is null then
    raise exception using errcode='28000', message='AUTH_REQUIRED';
  end if;
  if p_name is null or char_length(btrim(p_name)) < 3 or char_length(btrim(p_name)) > 50
     or p_description is null or char_length(btrim(p_description)) < 20 or char_length(btrim(p_description)) > 500
     or p_category not in ('games','tools','education','social','health','other') then
    raise exception using errcode='22023', message='APP_FIELDS_INVALID';
  end if;

  update public.apps
  set name=btrim(p_name),
      description=btrim(p_description),
      category=p_category,
      icon_url=case when p_icon_url is null then icon_url else p_icon_url end,
      updated_at=now()
  where id=p_app_id and developer_id=v_user_id and status <> 'archived';

  if not found then
    raise exception using errcode='P0002', message='APP_NOT_FOUND_OR_NOT_OWNED';
  end if;
end;
$$;

create or replace function private.archive_app_impl(p_app_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare v_user_id uuid := auth.uid();
begin
  if v_user_id is null then raise exception using errcode='28000', message='AUTH_REQUIRED'; end if;
  update public.apps
  set archived_from_status=status, status='archived', updated_at=now()
  where id=p_app_id and developer_id=v_user_id and status <> 'archived';
  if not found then raise exception using errcode='P0002', message='APP_NOT_FOUND_OR_ALREADY_ARCHIVED'; end if;
end;
$$;

create or replace function private.restore_app_impl(p_app_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_max_apps integer;
  v_used integer;
  v_limits jsonb;
begin
  if v_user_id is null then raise exception using errcode='28000', message='AUTH_REQUIRED'; end if;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(v_user_id::text, 0));

  select s.limits into v_limits from public.get_active_subscription() s limit 1;
  if v_limits is null then
    select p.limits into v_limits from public.plans p where p.code='free' and p.is_active limit 1;
  end if;
  v_max_apps := coalesce((v_limits ->> 'max_active_apps')::integer,1);

  select count(*)::integer into v_used from public.apps
  where developer_id=v_user_id and status <> 'archived';
  if v_used >= v_max_apps then
    raise exception using errcode='P0001', message='PLAN_LIMIT_REACHED';
  end if;

  update public.apps
  set status=coalesce(archived_from_status,'draft'), archived_from_status=null, updated_at=now()
  where id=p_app_id and developer_id=v_user_id and status='archived';
  if not found then raise exception using errcode='P0002', message='APP_NOT_FOUND_OR_NOT_ARCHIVED'; end if;
end;
$$;

revoke all on function private.create_app_impl(text,text,text,text) from public, anon, authenticated;
revoke all on function private.update_app_impl(uuid,text,text,text,text) from public, anon, authenticated;
revoke all on function private.archive_app_impl(uuid) from public, anon, authenticated;
revoke all on function private.restore_app_impl(uuid) from public, anon, authenticated;
grant execute on function private.create_app_impl(text,text,text,text) to authenticated;
grant execute on function private.update_app_impl(uuid,text,text,text,text) to authenticated;
grant execute on function private.archive_app_impl(uuid) to authenticated;
grant execute on function private.restore_app_impl(uuid) to authenticated;

create or replace function public.create_app(
  p_name text,
  p_package_name text,
  p_description text,
  p_category text
) returns uuid
language sql
security invoker
set search_path = ''
as $$ select private.create_app_impl(p_name,p_package_name,p_description,p_category); $$;

create or replace function public.update_app(
  p_app_id uuid,
  p_name text,
  p_description text,
  p_category text,
  p_icon_url text default null
) returns void
language sql
security invoker
set search_path = ''
as $$ select private.update_app_impl(p_app_id,p_name,p_description,p_category,p_icon_url); $$;

create or replace function public.archive_app(p_app_id uuid)
returns void language sql security invoker set search_path=''
as $$ select private.archive_app_impl(p_app_id); $$;

create or replace function public.restore_app(p_app_id uuid)
returns void language sql security invoker set search_path=''
as $$ select private.restore_app_impl(p_app_id); $$;

revoke all on function public.create_app(text,text,text,text) from public, anon;
revoke all on function public.update_app(uuid,text,text,text,text) from public, anon;
revoke all on function public.archive_app(uuid) from public, anon;
revoke all on function public.restore_app(uuid) from public, anon;
grant execute on function public.create_app(text,text,text,text) to authenticated;
grant execute on function public.update_app(uuid,text,text,text,text) to authenticated;
grant execute on function public.archive_app(uuid) to authenticated;
grant execute on function public.restore_app(uuid) to authenticated;

-- Clients read app rows through RLS; all mutations go through the audited RPC boundary.
revoke insert, update, delete on public.apps from anon, authenticated;
grant select on public.apps to authenticated;
