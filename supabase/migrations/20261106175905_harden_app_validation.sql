
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
  if v_user_id is null then raise exception using errcode='28000', message='AUTH_REQUIRED'; end if;
  if not exists (select 1 from public.user_roles ur where ur.user_id=v_user_id and ur.role in ('developer','admin')) then
    raise exception using errcode='42501', message='DEVELOPER_ROLE_REQUIRED';
  end if;
  if p_name is null or char_length(btrim(p_name)) < 3 or char_length(btrim(p_name)) > 50 then
    raise exception using errcode='22023', message='APP_NAME_INVALID';
  end if;
  if p_description is null or char_length(btrim(p_description)) < 20 or char_length(btrim(p_description)) > 500 then
    raise exception using errcode='22023', message='APP_DESCRIPTION_INVALID';
  end if;
  if p_package_name is null or p_package_name !~ '^[a-z][a-z0-9_]*([.][a-z][a-z0-9_]*)+$' then
    raise exception using errcode='22023', message='PACKAGE_NAME_INVALID';
  end if;
  if p_category is null or p_category not in ('games','tools','education','social','health','other') then
    raise exception using errcode='22023', message='APP_CATEGORY_INVALID';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(v_user_id::text,0));
  select s.plan_code,s.limits into v_plan_code,v_limits from public.get_active_subscription() s limit 1;
  if v_plan_code is null then
    select p.code,p.limits into v_plan_code,v_limits from public.plans p where p.code='free' and p.is_active limit 1;
  end if;
  v_max_apps:=coalesce((v_limits->>'max_active_apps')::integer,1);
  select count(*)::integer into v_current_count from public.apps a where a.developer_id=v_user_id and a.status<>'archived';
  if v_current_count>=v_max_apps then
    raise exception using errcode='P0001',message='PLAN_LIMIT_REACHED',
      detail=jsonb_build_object('plan',coalesce(v_plan_code,'free'),'used',v_current_count,'limit',v_max_apps)::text;
  end if;
  insert into public.apps(developer_id,name,package_name,description,category,status)
  values(v_user_id,btrim(p_name),lower(btrim(p_package_name)),btrim(p_description),p_category,'draft')
  returning id into v_app_id;
  return v_app_id;
end;
$$;

create or replace function private.update_app_impl(
  p_app_id uuid,p_name text,p_description text,p_category text,p_icon_url text default null
) returns void
language plpgsql
security definer
set search_path=''
as $$
declare v_user_id uuid:=auth.uid();
begin
  if v_user_id is null then raise exception using errcode='28000',message='AUTH_REQUIRED'; end if;
  if p_name is null or char_length(btrim(p_name))<3 or char_length(btrim(p_name))>50
     or p_description is null or char_length(btrim(p_description))<20 or char_length(btrim(p_description))>500
     or p_category is null or p_category not in ('games','tools','education','social','health','other') then
    raise exception using errcode='22023',message='APP_FIELDS_INVALID';
  end if;
  if p_icon_url is not null and p_icon_url !~ '^https://[^[:space:]]+$' then
    raise exception using errcode='22023',message='APP_ICON_URL_INVALID';
  end if;
  update public.apps set name=btrim(p_name),description=btrim(p_description),category=p_category,
    icon_url=case when p_icon_url is null then icon_url else p_icon_url end,updated_at=now()
  where id=p_app_id and developer_id=v_user_id and status<>'archived';
  if not found then raise exception using errcode='P0002',message='APP_NOT_FOUND_OR_NOT_OWNED'; end if;
end;
$$;
