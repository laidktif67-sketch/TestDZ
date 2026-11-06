-- TestDZ / 006_subscription_rpc_invoker_and_admin_reads
-- Prefer SECURITY INVOKER: underlying table GRANTs and RLS remain authoritative.

begin;

create or replace function public.get_active_subscription()
returns table (
  plan_code text,
  features jsonb,
  limits jsonb,
  expires_at timestamptz
)
language sql
stable
security invoker
set search_path = ''
as $$
  select p.code,p.features,p.limits,s.current_period_end
  from public.subscriptions s
  join public.plans p on p.id = s.plan_id
  where s.user_id = (select auth.uid())
    and s.status in ('active','trialing')
    and s.current_period_end > now()
  order by s.current_period_end desc
  limit 1;
$$;

-- Admin-only read surfaces. Mutations remain server/RPC controlled.
grant select on public.audit_logs,public.fraud_reviews,public.fraud_events,public.platform_config to authenticated;

create policy audit_logs_select_admin on public.audit_logs
  for select to authenticated
  using ((select private.is_admin()));

create policy fraud_reviews_select_admin on public.fraud_reviews
  for select to authenticated
  using ((select private.is_admin()));

create policy fraud_events_select_admin on public.fraud_events
  for select to authenticated
  using ((select private.is_admin()));

create policy platform_config_select_admin on public.platform_config
  for select to authenticated
  using ((select private.is_admin()));

-- Users may inspect their own coupon redemption history; writes stay server-controlled.
grant select on public.coupon_redemptions to authenticated;
create policy coupon_redemptions_select_owner_or_admin on public.coupon_redemptions
  for select to authenticated
  using (user_id = (select auth.uid()) or (select private.is_admin()));

-- Usage analytics may be read only by the account owner or an administrator.
grant select on public.feature_usage to authenticated;
create policy feature_usage_select_owner_or_admin on public.feature_usage
  for select to authenticated
  using (user_id = (select auth.uid()) or (select private.is_admin()));

commit;
