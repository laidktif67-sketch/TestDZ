
create or replace function public.get_app_limit()
returns table(plan_code text, max_active_apps integer, current_active_apps integer, can_create boolean)
language sql
stable
security invoker
set search_path=''
as $$
  with active_plan as (
    select s.plan_code, s.limits
    from public.get_active_subscription() s
    limit 1
  ), effective as (
    select coalesce(ap.plan_code,p.code,'free') as plan_code,
           coalesce((coalesce(ap.limits,p.limits)->>'max_active_apps')::integer,1) as max_apps
    from (select 1) seed
    left join active_plan ap on true
    left join public.plans p on p.code='free' and p.is_active
  ), owned as (
    select count(*)::integer as used
    from public.apps a
    where a.developer_id=(select auth.uid()) and a.status <> 'archived'
  )
  select e.plan_code,e.max_apps,o.used,(o.used < e.max_apps)
  from effective e cross join owned o;
$$;
revoke all on function public.get_app_limit() from public, anon;
grant execute on function public.get_app_limit() to authenticated;
