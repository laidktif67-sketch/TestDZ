-- TestDZ / 003_master_blueprint_alignment
-- Adds unambiguous missing platform/trust domains and tightens client write boundaries.
-- Apply only to the dedicated TestDZ Supabase project.

begin;

-- Device signals: store only a keyed/hashed fingerprint, never raw device identifiers.
create table public.devices (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  fingerprint_hash text not null,
  platform text not null default 'android' check (platform in ('android','ios','web','other')),
  app_version text,
  first_seen_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  revoked_at timestamptz,
  created_at timestamptz not null default now(),
  unique (user_id, fingerprint_hash)
);
create index devices_fingerprint_hash_idx on public.devices(fingerprint_hash);
create index devices_user_last_seen_idx on public.devices(user_id,last_seen_at desc);

-- Fraud signal events are evidence for review, not automatic enforcement.
create table public.fraud_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete restrict,
  signal_code text not null,
  weight smallint not null default 0,
  evidence jsonb not null default '{}'::jsonb,
  occurred_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);
create index fraud_events_user_time_idx on public.fraud_events(user_id,occurred_at desc);

-- Coupons are configurable and do not themselves grant subscription access.
create table public.coupons (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  discount_type text not null check (discount_type in ('fixed_dzd','percentage','credits_bonus')),
  discount_value integer not null check (discount_value > 0),
  max_redemptions integer check (max_redemptions is null or max_redemptions > 0),
  redemption_count integer not null default 0 check (redemption_count >= 0),
  starts_at timestamptz,
  expires_at timestamptz,
  is_active boolean not null default false,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  constraint coupons_date_order check (expires_at is null or starts_at is null or expires_at > starts_at),
  constraint coupons_percentage_bound check (discount_type <> 'percentage' or discount_value <= 100)
);
create table public.coupon_redemptions (
  id uuid primary key default gen_random_uuid(),
  coupon_id uuid not null references public.coupons(id) on delete restrict,
  user_id uuid not null references public.profiles(id) on delete restrict,
  payment_id uuid references public.payments(id) on delete set null,
  redeemed_at timestamptz not null default now(),
  unique (coupon_id,user_id)
);
create index coupon_redemptions_user_idx on public.coupon_redemptions(user_id,redeemed_at desc);

-- One referral attribution per invited account.
create table public.referrals (
  id uuid primary key default gen_random_uuid(),
  referrer_id uuid not null references public.profiles(id) on delete restrict,
  referred_user_id uuid not null unique references public.profiles(id) on delete restrict,
  referral_code text not null,
  status text not null default 'pending' check (status in ('pending','qualified','rewarded','rejected')),
  qualified_at timestamptz,
  rewarded_at timestamptz,
  created_at timestamptz not null default now(),
  constraint referrals_not_self check (referrer_id <> referred_user_id)
);
create index referrals_referrer_created_idx on public.referrals(referrer_id,created_at desc);

-- Feature usage counters are operational telemetry, not authorization truth.
create table public.feature_usage (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.profiles(id) on delete set null,
  feature_key text not null,
  usage_count integer not null default 1 check (usage_count > 0),
  period_start date not null default (now() at time zone 'UTC')::date,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index feature_usage_user_feature_period_idx on public.feature_usage(user_id,feature_key,period_start);

-- Transactional outbox for reliable notifications/webhook follow-up.
create table public.events (
  id uuid primary key default gen_random_uuid(),
  event_type text not null,
  aggregate_type text not null,
  aggregate_id uuid,
  payload jsonb not null default '{}'::jsonb,
  status text not null default 'pending' check (status in ('pending','processing','delivered','failed')),
  attempts integer not null default 0 check (attempts >= 0),
  available_at timestamptz not null default now(),
  processed_at timestamptz,
  last_error text,
  created_at timestamptz not null default now()
);
create index events_dispatch_idx on public.events(status,available_at,created_at)
  where status in ('pending','failed');

-- Keep review semantics explicit: this table is not Google Play public-star manipulation.
-- App/test review UX will be designed in a later product migration after the review workflow is specified.

alter table public.devices enable row level security;
alter table public.fraud_events enable row level security;
alter table public.coupons enable row level security;
alter table public.coupon_redemptions enable row level security;
alter table public.referrals enable row level security;
alter table public.feature_usage enable row level security;
alter table public.events enable row level security;

-- No direct client writes/reads for sensitive operational tables.
revoke all on public.devices,public.fraud_events,public.coupons,public.coupon_redemptions,
  public.referrals,public.feature_usage,public.events from anon,authenticated;

-- Users can see only their own registered device records; writes remain server-controlled.
grant select on public.devices to authenticated;
create policy devices_select_owner_or_admin on public.devices
  for select to authenticated
  using (user_id = (select auth.uid()) or (select private.is_admin()));

-- A user may view their own referral attribution only.
grant select on public.referrals to authenticated;
create policy referrals_select_participant on public.referrals
  for select to authenticated
  using (referrer_id = (select auth.uid()) or referred_user_id = (select auth.uid()) or (select private.is_admin()));

-- Publicly readable active coupon codes expose no redemption data; validation stays server-side.
grant select on public.coupons to authenticated;
create policy coupons_select_active on public.coupons
  for select to authenticated
  using (is_active and (starts_at is null or starts_at <= now()) and (expires_at is null or expires_at > now()));

-- Restrict client updates to non-privileged descriptive fields only.
revoke update on public.apps from authenticated;
grant update (name,description,icon_url,play_store_url) on public.apps to authenticated;

revoke update on public.tests from authenticated;
grant update (title,description,min_testers,start_date,end_date) on public.tests to authenticated;

-- Ledger and audit records are append-only at the database layer too.
create or replace function private.prevent_immutable_mutation()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  raise exception 'table %.% is append-only', tg_table_schema, tg_table_name
    using errcode = '55000';
end;
$$;
revoke all on function private.prevent_immutable_mutation() from public,anon,authenticated;

create trigger points_ledger_no_update_delete
before update or delete on public.points_ledger
for each row execute function private.prevent_immutable_mutation();

create trigger audit_logs_no_update_delete
before update or delete on public.audit_logs
for each row execute function private.prevent_immutable_mutation();

-- Seed only safe, disabled-by-default switches and configurable initial defaults.
insert into public.platform_config(key,value,description) values
 ('trial.enabled','false'::jsonb,'Trials are disabled until abuse controls are validated'),
 ('trial.days','7'::jsonb,'Trial duration when enabled'),
 ('referral.enabled','false'::jsonb,'Referral rewards are disabled by default'),
 ('referral.reward_points','15'::jsonb,'Earned points after a referral qualifies'),
 ('payments.enabled','false'::jsonb,'Payments remain disabled until verified provider webhooks are deployed'),
 ('payments.gateway','"chargily"'::jsonb,'Configured payment provider'),
 ('fraud.auto_suspend','false'::jsonb,'Must remain false: fraud scores never auto-suspend users'),
 ('cohort.auto_form','true'::jsonb,'Allow controlled automatic cohort formation'),
 ('checkin.min_text_length','20'::jsonb,'Minimum useful check-in note length'),
 ('cohort.size.free','13'::jsonb,'Initial Free cohort size proposal'),
 ('cohort.size.plus','13'::jsonb,'Initial Plus cohort base size proposal'),
 ('cohort.size.pro','13'::jsonb,'Initial Pro cohort base size proposal'),
 ('bonus.assignment_completed','50'::jsonb,'Draft earned-points reward; configurable'),
 ('bonus.feedback_accepted','10'::jsonb,'Draft earned-points reward; configurable'),
 ('bonus.daily_checkin','2'::jsonb,'Draft earned-points reward; configurable')
on conflict (key) do nothing;

commit;
