-- Keep application distribution metadata in the database and expose a validated atomic creation RPC.
-- Existing create_app remains the source of truth for role, input, subscription, and plan-limit checks.

begin;

alter table public.apps
  add column if not exists distribution_method text not null default 'none',
  add column if not exists distribution_url text;

alter table public.apps
  drop constraint if exists apps_distribution_method_check,
  add constraint apps_distribution_method_check
    check (distribution_method in ('none', 'play_store', 'external_link', 'apk_upload'));

alter table public.apps
  drop constraint if exists apps_distribution_url_check,
  add constraint apps_distribution_url_check
    check (
      distribution_url is null
      or (
        char_length(distribution_url) between 8 and 2048
        and distribution_url ~* '^https?://[^[:space:]]+$'
      )
    );

-- Backfill legacy Play Store links without overwriting an explicitly set method.
update public.apps
set distribution_method = 'play_store',
    distribution_url = coalesce(distribution_url, play_store_url)
where play_store_url is not null
  and btrim(play_store_url) <> ''
  and distribution_method = 'none';

create or replace function public.create_app_with_distribution(
  p_name text,
  p_package_name text,
  p_description text,
  p_category text,
  p_distribution_url text
) returns uuid
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_user_id uuid := auth.uid();
  v_app_id uuid;
  v_distribution_url text := btrim(coalesce(p_distribution_url, ''));
begin
  if v_user_id is null then
    raise exception using errcode = '28000', message = 'AUTH_REQUIRED';
  end if;

  if char_length(v_distribution_url) < 8
     or char_length(v_distribution_url) > 2048
     or v_distribution_url !~* '^https?://[^[:space:]]+$' then
    raise exception using errcode = '22023', message = 'DISTRIBUTION_URL_INVALID';
  end if;

  -- Reuse the established server-side validation, role authorization, advisory lock,
  -- subscription lookup, plan-limit enforcement, and draft creation.
  v_app_id := public.create_app(
    p_name,
    p_package_name,
    p_description,
    p_category
  );

  update public.apps
  set distribution_method = 'external_link',
      distribution_url = v_distribution_url,
      updated_at = pg_catalog.now()
  where id = v_app_id
    and developer_id = v_user_id;

  if not found then
    raise exception using errcode = '42501', message = 'APP_DISTRIBUTION_UPDATE_DENIED';
  end if;

  return v_app_id;
end;
$function$;

revoke all on function public.create_app_with_distribution(text, text, text, text, text)
  from public, anon, authenticated;
grant execute on function public.create_app_with_distribution(text, text, text, text, text)
  to authenticated;

commit;
