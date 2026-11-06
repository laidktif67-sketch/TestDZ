-- TestDZ / 007_seed_subscription_plans
-- Initial plan catalog. Prices are launch-draft values and remain editable by admins.
begin;

insert into public.plans (code, name, price_dzd, billing_period, limits, features, is_active)
values
  (
    'free',
    'Free',
    0,
    'month',
    '{"max_active_apps":1,"max_extra_testers":0,"priority_weight":1}'::jsonb,
    '{"reports_pdf":false,"api_access":false,"annual_price_dzd":0,"pricing_status":"draft"}'::jsonb,
    true
  ),
  (
    'plus',
    'Plus',
    990,
    'month',
    '{"max_active_apps":3,"max_extra_testers":3,"priority_weight":2}'::jsonb,
    '{"reports_pdf":true,"api_access":false,"annual_price_dzd":8900,"pricing_status":"draft"}'::jsonb,
    true
  ),
  (
    'pro',
    'Pro',
    2490,
    'month',
    '{"max_active_apps":10,"max_extra_testers":8,"priority_weight":3}'::jsonb,
    '{"reports_pdf":true,"api_access":true,"annual_price_dzd":22900,"pricing_status":"draft"}'::jsonb,
    true
  )
on conflict (code) do update
set name = excluded.name,
    price_dzd = excluded.price_dzd,
    billing_period = excluded.billing_period,
    limits = excluded.limits,
    features = excluded.features,
    is_active = excluded.is_active,
    updated_at = now();

-- Public pricing is safe to read; writes remain restricted to trusted backend/admin paths.
grant select on public.plans to anon, authenticated;
drop policy if exists plans_select_active_or_admin on public.plans;
create policy plans_select_active_or_admin on public.plans
  for select to anon, authenticated
  using (is_active or (select private.is_admin()));

commit;
