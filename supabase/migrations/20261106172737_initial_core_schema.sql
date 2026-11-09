-- TestDZ / 001_core_schema
-- Dedicated project only: naqjjykcglxiobkmdllj
-- This migration creates the initial relational model and a deny-by-default API surface.

begin;

create schema if not exists private;
revoke all on schema private from public, anon;
grant usage on schema private to authenticated;

create or replace function private.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text,
  avatar_url text,
  bio text,
  locale text not null default 'fr-DZ',
  is_verified boolean not null default false,
  is_banned boolean not null default false,
  subscription_tier text not null default 'free',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint profiles_locale_length check (char_length(locale) between 2 and 16)
);

create table public.user_roles (
  user_id uuid not null references public.profiles(id) on delete cascade,
  role text not null check (role in ('tester','developer','admin','support')),
  granted_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  primary key (user_id, role)
);

create or replace function private.is_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.user_roles ur
    where ur.user_id = (select auth.uid())
      and ur.role = 'admin'
  );
$$;

revoke all on function private.set_updated_at() from public, anon, authenticated;
revoke all on function private.is_admin() from public, anon;
grant execute on function private.is_admin() to authenticated;

create table public.apps (
  id uuid primary key default gen_random_uuid(),
  developer_id uuid not null references public.profiles(id) on delete restrict,
  name text not null,
  package_name text not null,
  description text,
  icon_url text,
  play_store_url text,
  status text not null default 'draft' check (status in ('draft','published','paused','archived')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (developer_id, package_name),
  constraint apps_name_length check (char_length(name) between 2 and 120),
  constraint apps_package_name_length check (char_length(package_name) between 3 and 255)
);

create table public.tests (
  id uuid primary key default gen_random_uuid(),
  app_id uuid not null references public.apps(id) on delete restrict,
  developer_id uuid not null references public.profiles(id) on delete restrict,
  title text not null,
  description text,
  status text not null default 'recruiting'
    check (status in ('recruiting','ready','running','at_risk','completed','failed','cancelled')),
  min_testers integer not null default 12 check (min_testers between 1 and 500),
  start_date date,
  end_date date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint tests_date_order check (end_date is null or start_date is null or end_date >= start_date)
);

create table public.cohorts (
  id uuid primary key default gen_random_uuid(),
  test_id uuid not null references public.tests(id) on delete cascade,
  name text not null,
  capacity integer not null check (capacity > 0),
  status text not null default 'forming' check (status in ('forming','ready','running','completed','cancelled')),
  priority_snapshot jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.assignments (
  id uuid primary key default gen_random_uuid(),
  cohort_id uuid not null references public.cohorts(id) on delete cascade,
  test_id uuid not null references public.tests(id) on delete cascade,
  tester_id uuid not null references public.profiles(id) on delete restrict,
  status text not null default 'pending'
    check (status in ('pending','active','completed','withdrawn','failed','rejected')),
  start_date date,
  completed_at timestamptz,
  developer_confirmed_at timestamptz,
  auto_validation_at timestamptz,
  medical_extension_days integer not null default 0 check (medical_extension_days >= 0),
  medical_exception_note text,
  medical_exception_approved_by uuid references public.profiles(id) on delete set null,
  medical_exception_approved_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (cohort_id, tester_id),
  constraint assignment_medical_approval_consistency check (
    (medical_extension_days = 0 and medical_exception_approved_at is null)
    or
    (medical_extension_days > 0 and medical_exception_approved_at is not null
      and medical_exception_approved_by is not null
      and medical_exception_note is not null)
  )
);

create index assignments_tester_status_idx on public.assignments(tester_id, status);
create index assignments_test_status_idx on public.assignments(test_id, status);

create table public.checkins (
  id uuid primary key default gen_random_uuid(),
  assignment_id uuid not null references public.assignments(id) on delete cascade,
  tester_id uuid not null references public.profiles(id) on delete restrict,
  checkin_date date not null,
  note text,
  evidence_url text,
  created_at timestamptz not null default now(),
  unique (assignment_id, checkin_date),
  constraint checkins_note_length check (note is null or char_length(note) <= 4000)
);

create index checkins_tester_date_idx on public.checkins(tester_id, checkin_date);

create table public.feedback (
  id uuid primary key default gen_random_uuid(),
  assignment_id uuid not null references public.assignments(id) on delete cascade,
  tester_id uuid not null references public.profiles(id) on delete restrict,
  rating smallint check (rating between 1 and 5),
  body text not null,
  category text not null default 'general'
    check (category in ('general','bug','usability','performance','compatibility')),
  quality_status text not null default 'pending'
    check (quality_status in ('pending','accepted','rejected')),
  reviewed_by uuid references public.profiles(id) on delete set null,
  reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  constraint feedback_body_length check (char_length(body) between 20 and 8000)
);

create table public.play_opt_in_events (
  id uuid primary key default gen_random_uuid(),
  assignment_id uuid not null references public.assignments(id) on delete cascade,
  tester_id uuid not null references public.profiles(id) on delete restrict,
  event_type text not null check (event_type in ('opted_in','opted_out','returned','evidence_reviewed')),
  occurred_at timestamptz not null,
  evidence_url text,
  notes text,
  recorded_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now()
);

create index play_opt_in_assignment_time_idx on public.play_opt_in_events(assignment_id, occurred_at);

create table public.wallets (
  user_id uuid primary key references public.profiles(id) on delete restrict,
  earned_points bigint not null default 0 check (earned_points >= 0),
  purchased_credits bigint not null default 0 check (purchased_credits >= 0),
  updated_at timestamptz not null default now()
);

create table public.points_ledger (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete restrict,
  wallet_type text not null check (wallet_type in ('earned_points','purchased_credits')),
  amount bigint not null check (amount <> 0),
  reason text not null,
  reference_type text,
  reference_id uuid,
  idempotency_key text not null unique,
  reversal_of uuid references public.points_ledger(id) on delete restrict,
  created_at timestamptz not null default now()
);

create index points_ledger_user_created_idx on public.points_ledger(user_id, created_at desc);

create table public.plans (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  name text not null,
  price_dzd integer not null default 0 check (price_dzd >= 0),
  billing_period text not null default 'month' check (billing_period in ('month','year','one_time')),
  limits jsonb not null default '{}'::jsonb,
  features jsonb not null default '{}'::jsonb,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete restrict,
  plan_id uuid not null references public.plans(id) on delete restrict,
  status text not null check (status in ('trialing','active','past_due','cancelled','expired')),
  current_period_start timestamptz not null,
  current_period_end timestamptz not null,
  cancel_at_period_end boolean not null default false,
  provider text,
  provider_subscription_id text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint subscription_period_order check (current_period_end > current_period_start)
);

create unique index subscriptions_one_current_per_user
  on public.subscriptions(user_id)
  where status in ('active','trialing','past_due');

create table public.payments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete restrict,
  subscription_id uuid references public.subscriptions(id) on delete set null,
  amount_dzd integer not null check (amount_dzd > 0),
  currency text not null default 'DZD' check (currency = 'DZD'),
  provider text not null,
  provider_payment_id text,
  status text not null default 'pending'
    check (status in ('pending','processing','succeeded','failed','refunded')),
  idempotency_key text not null unique,
  verified_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.refunds (
  id uuid primary key default gen_random_uuid(),
  payment_id uuid not null references public.payments(id) on delete restrict,
  user_id uuid not null references public.profiles(id) on delete restrict,
  amount_dzd integer not null check (amount_dzd > 0),
  reason text not null,
  status text not null default 'requested'
    check (status in ('requested','approved','rejected','processed')),
  refund_method text not null check (refund_method in ('wallet_credit','bank_return')),
  approved_by uuid references public.profiles(id) on delete set null,
  bank_reference text,
  audit_log_id uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.platform_config (
  key text primary key,
  value jsonb not null,
  description text,
  updated_by uuid references public.profiles(id) on delete set null,
  updated_at timestamptz not null default now()
);

create table public.audit_logs (
  id uuid primary key default gen_random_uuid(),
  actor_id uuid references public.profiles(id) on delete set null,
  action text not null,
  entity_type text not null,
  entity_id uuid,
  before_data jsonb,
  after_data jsonb,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index audit_logs_entity_idx on public.audit_logs(entity_type, entity_id, created_at desc);

create table public.fraud_reviews (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete restrict,
  score smallint not null check (score between 0 and 100),
  signals jsonb not null default '[]'::jsonb,
  priority text not null default 'normal' check (priority in ('normal','high')),
  status text not null default 'queued' check (status in ('queued','in_review','resolved','dismissed')),
  review_due_at timestamptz,
  reviewed_by uuid references public.profiles(id) on delete set null,
  resolution text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.reports (
  id uuid primary key default gen_random_uuid(),
  reporter_id uuid not null references public.profiles(id) on delete restrict,
  reported_user_id uuid references public.profiles(id) on delete set null,
  assignment_id uuid references public.assignments(id) on delete set null,
  report_type text not null check (report_type in ('no_activity','fake_feedback','app_broken','harassment','payment_dispute','other')),
  description text not null,
  status text not null default 'open' check (status in ('open','under_review','resolved','rejected')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.disputes (
  id uuid primary key default gen_random_uuid(),
  opened_by uuid not null references public.profiles(id) on delete restrict,
  payment_id uuid references public.payments(id) on delete set null,
  report_id uuid references public.reports(id) on delete set null,
  status text not null default 'opened'
    check (status in ('opened','under_review','resolved_accepted','resolved_rejected','escalated')),
  resolution text,
  resolved_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  type text not null,
  title text not null,
  body text not null,
  data jsonb not null default '{}'::jsonb,
  read_at timestamptz,
  created_at timestamptz not null default now()
);

create index notifications_user_created_idx on public.notifications(user_id, created_at desc);

-- Updated-at triggers.
do $$
declare t text;
begin
  foreach t in array array[
    'profiles','apps','tests','cohorts','assignments','plans',
    'subscriptions','payments','refunds','fraud_reviews','reports','disputes'
  ] loop
    execute format(
      'create trigger %I before update on public.%I for each row execute function private.set_updated_at()',
      t || '_set_updated_at', t
    );
  end loop;
end;
$$;

-- Enable RLS on every public table.
do $$
declare t text;
begin
  foreach t in array array[
    'profiles','user_roles','apps','tests','cohorts','assignments','checkins',
    'feedback','play_opt_in_events','wallets','points_ledger','plans',
    'subscriptions','payments','refunds','platform_config','audit_logs',
    'fraud_reviews','reports','disputes','notifications'
  ] loop
    execute format('alter table public.%I enable row level security', t);
  end loop;
end;
$$;

-- Remove broad defaults. Access is granted only table-by-table below.
revoke all on all tables in schema public from anon, authenticated;
revoke all on all sequences in schema public from anon, authenticated;

-- Profile: clients can read their own profile and update only non-privileged columns.
grant select on public.profiles to authenticated;
grant update (display_name, avatar_url, bio, locale) on public.profiles to authenticated;
create policy profiles_select_self_or_admin on public.profiles
  for select to authenticated
  using (id = (select auth.uid()) or (select private.is_admin()));
create policy profiles_update_self on public.profiles
  for update to authenticated
  using (id = (select auth.uid()))
  with check (id = (select auth.uid()));

-- User roles are intentionally not client-readable or writable.
-- Apps: owner manages own app; published apps are visible to signed-in users.
grant select, insert, update on public.apps to authenticated;
create policy apps_select_published_or_owner on public.apps
  for select to authenticated
  using (status = 'published' or developer_id = (select auth.uid()) or (select private.is_admin()));
create policy apps_insert_owner on public.apps
  for insert to authenticated
  with check (developer_id = (select auth.uid()) and not (select private.is_admin()) or (select private.is_admin()));
create policy apps_update_owner_or_admin on public.apps
  for update to authenticated
  using (developer_id = (select auth.uid()) or (select private.is_admin()))
  with check (developer_id = (select auth.uid()) or (select private.is_admin()));

-- Tests: developers may create/update their own test cycles.
grant select, insert, update on public.tests to authenticated;
create policy tests_select_owner_or_published_app on public.tests
  for select to authenticated
  using (
    developer_id = (select auth.uid())
    or (select private.is_admin())
    or exists (select 1 from public.apps a where a.id = app_id and a.status = 'published')
  );
create policy tests_insert_owner on public.tests
  for insert to authenticated
  with check (developer_id = (select auth.uid()) or (select private.is_admin()));
create policy tests_update_owner on public.tests
  for update to authenticated
  using (developer_id = (select auth.uid()) or (select private.is_admin()))
  with check (developer_id = (select auth.uid()) or (select private.is_admin()));

-- Cohorts and assignments: readable by the tester assigned or owning developer/admin.
grant select on public.cohorts, public.assignments to authenticated;
create policy cohorts_select_participants on public.cohorts
  for select to authenticated
  using (
    (select private.is_admin())
    or exists (
      select 1 from public.tests t
      where t.id = test_id and t.developer_id = (select auth.uid())
    )
    or exists (
      select 1 from public.assignments a
      where a.cohort_id = id and a.tester_id = (select auth.uid())
    )
  );
create policy assignments_select_participants on public.assignments
  for select to authenticated
  using (
    tester_id = (select auth.uid())
    or (select private.is_admin())
    or exists (
      select 1 from public.tests t
      where t.id = test_id and t.developer_id = (select auth.uid())
    )
  );

-- Check-ins and feedback are visible only to the tester, owning developer, or admin.
grant select, insert on public.checkins to authenticated;
create policy checkins_select_participants on public.checkins
  for select to authenticated
  using (
    tester_id = (select auth.uid())
    or (select private.is_admin())
    or exists (
      select 1 from public.assignments a
      join public.tests t on t.id = a.test_id
      where a.id = assignment_id and t.developer_id = (select auth.uid())
    )
  );
create policy checkins_insert_tester on public.checkins
  for insert to authenticated
  with check (
    tester_id = (select auth.uid())
    and exists (
      select 1 from public.assignments a
      where a.id = assignment_id and a.tester_id = (select auth.uid()) and a.status = 'active'
    )
  );

grant select, insert on public.feedback to authenticated;
create policy feedback_select_participants on public.feedback
  for select to authenticated
  using (
    tester_id = (select auth.uid())
    or (select private.is_admin())
    or exists (
      select 1 from public.assignments a
      join public.tests t on t.id = a.test_id
      where a.id = assignment_id and t.developer_id = (select auth.uid())
    )
  );
create policy feedback_insert_tester on public.feedback
  for insert to authenticated
  with check (
    tester_id = (select auth.uid())
    and exists (
      select 1 from public.assignments a
      where a.id = assignment_id and a.tester_id = (select auth.uid())
    )
  );

grant select on public.play_opt_in_events to authenticated;
create policy play_opt_in_events_select_participants on public.play_opt_in_events
  for select to authenticated
  using (
    tester_id = (select auth.uid())
    or (select private.is_admin())
    or exists (
      select 1 from public.assignments a
      join public.tests t on t.id = a.test_id
      where a.id = assignment_id and t.developer_id = (select auth.uid())
    )
  );

-- Wallet balances and ledger are read-only to their owner. Writes will be private RPC only.
grant select on public.wallets, public.points_ledger to authenticated;
create policy wallets_select_self_or_admin on public.wallets
  for select to authenticated
  using (user_id = (select auth.uid()) or (select private.is_admin()));
create policy points_ledger_select_self_or_admin on public.points_ledger
  for select to authenticated
  using (user_id = (select auth.uid()) or (select private.is_admin()));

-- Public plan catalog is read-only; admin management is server-side.
grant select on public.plans to authenticated;
create policy plans_select_active_or_admin on public.plans
  for select to authenticated
  using (is_active or (select private.is_admin()));

-- Financial/subscription records are owner-readable only; no client writes.
grant select on public.subscriptions, public.payments, public.refunds to authenticated;
create policy subscriptions_select_owner_or_admin on public.subscriptions
  for select to authenticated
  using (user_id = (select auth.uid()) or (select private.is_admin()));
create policy payments_select_owner_or_admin on public.payments
  for select to authenticated
  using (user_id = (select auth.uid()) or (select private.is_admin()));
create policy refunds_select_owner_or_admin on public.refunds
  for select to authenticated
  using (user_id = (select auth.uid()) or (select private.is_admin()));

-- Notifications are owner-readable and owner-updatable only for read_at.
grant select, update (read_at) on public.notifications to authenticated;
create policy notifications_select_owner on public.notifications
  for select to authenticated
  using (user_id = (select auth.uid()));
create policy notifications_update_read_at on public.notifications
  for update to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

-- Reports: reporter may create and read own reports. Admins can review.
grant select, insert on public.reports to authenticated;
create policy reports_select_reporter_or_admin on public.reports
  for select to authenticated
  using (reporter_id = (select auth.uid()) or (select private.is_admin()));
create policy reports_insert_reporter on public.reports
  for insert to authenticated
  with check (reporter_id = (select auth.uid()));

-- Disputes are owner-readable and may be opened by the authenticated user.
grant select, insert on public.disputes to authenticated;
create policy disputes_select_opener_or_admin on public.disputes
  for select to authenticated
  using (opened_by = (select auth.uid()) or (select private.is_admin()));
create policy disputes_insert_opener on public.disputes
  for insert to authenticated
  with check (opened_by = (select auth.uid()));

-- Admin-only tables deliberately have no authenticated grants or policies:
-- user_roles, platform_config, audit_logs, fraud_reviews.
-- Service-side code will access them through narrowly scoped server operations.

commit;
