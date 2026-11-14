-- Add a safe external distribution link to developer-owned apps.
alter table public.apps
  add column if not exists distribution_method text not null default 'external_link',
  add column if not exists distribution_url text;

alter table public.apps
  drop constraint if exists apps_distribution_method_check;
alter table public.apps
  add constraint apps_distribution_method_check
  check (distribution_method in ('external_link', 'apk_upload'));

alter table public.apps
  drop constraint if exists apps_distribution_url_https_check;
alter table public.apps
  add constraint apps_distribution_url_https_check
  check (
    distribution_url is null
    or distribution_url ~* '^https://[^[:space:]]+$'
  );

-- Create an app and save its external distribution URL in one transaction.
-- APK upload remains unavailable until secure storage and validation are implemented.
create or replace function private.create_app_with_distribution_impl(
  p_name text,
  p_package_name text,
  p_description text,
  p_category text,
  p_distribution_url text
) returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_app_id uuid;
begin
  if v_user_id is null then
    raise exception using errcode = '28000', message = 'AUTH_REQUIRED';
  end if;
  if p_distribution_url is null
     or p_distribution_url !~* '^https://[^[:space:]]+$' then
    raise exception using errcode = '22023', message = 'APP_DISTRIBUTION_URL_INVALID';
  end if;

  v_app_id := private.create_app_impl(
    p_name, p_package_name, p_description, p_category
  );

  update public.apps
  set distribution_method = 'external_link',
      distribution_url = btrim(p_distribution_url),
      updated_at = now()
  where id = v_app_id
    and developer_id = v_user_id;

  if not found then
    raise exception using errcode = 'P0002', message = 'APP_NOT_FOUND_OR_NOT_OWNED';
  end if;

  return v_app_id;
end;
$$;

revoke all on function private.create_app_with_distribution_impl(text,text,text,text,text)
  from public, anon, authenticated;
grant execute on function private.create_app_with_distribution_impl(text,text,text,text,text)
  to authenticated;

create or replace function public.create_app_with_distribution(
  p_name text,
  p_package_name text,
  p_description text,
  p_category text,
  p_distribution_url text
) returns uuid
language sql
security invoker
set search_path = ''
as $$
  select private.create_app_with_distribution_impl(
    p_name, p_package_name, p_description, p_category, p_distribution_url
  );
$$;

revoke all on function public.create_app_with_distribution(text,text,text,text,text)
  from public, anon;
grant execute on function public.create_app_with_distribution(text,text,text,text,text)
  to authenticated;
