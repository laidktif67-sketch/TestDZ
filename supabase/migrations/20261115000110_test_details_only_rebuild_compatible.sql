-- Add structured Test Details metadata without touching the existing
-- medical_exception_requests schema or its review RPC.
begin;

alter table public.tests
  add column if not exists short_summary text,
  add column if not exists estimated_duration_minutes integer,
  add column if not exists android_min_api integer,
  add column if not exists android_max_api integer,
  add column if not exists device_requirements jsonb not null default '{}'::jsonb,
  add column if not exists eligibility_criteria jsonb not null default '[]'::jsonb,
  add column if not exists tester_instructions text;

do $migration$
begin
  if not exists (select 1 from pg_constraint where conrelid='public.tests'::regclass and conname='tests_short_summary_length') then
    alter table public.tests add constraint tests_short_summary_length
      check (short_summary is null or char_length(short_summary) <= 240);
  end if;
  if not exists (select 1 from pg_constraint where conrelid='public.tests'::regclass and conname='tests_estimated_duration_range') then
    alter table public.tests add constraint tests_estimated_duration_range
      check (estimated_duration_minutes is null or estimated_duration_minutes between 1 and 1440);
  end if;
  if not exists (select 1 from pg_constraint where conrelid='public.tests'::regclass and conname='tests_android_api_range') then
    alter table public.tests add constraint tests_android_api_range
      check (
        (android_min_api is null or android_min_api between 21 and 100)
        and (android_max_api is null or android_max_api between 21 and 100)
        and (android_min_api is null or android_max_api is null or android_max_api >= android_min_api)
      );
  end if;
  if not exists (select 1 from pg_constraint where conrelid='public.tests'::regclass and conname='tests_device_requirements_object') then
    alter table public.tests add constraint tests_device_requirements_object
      check (jsonb_typeof(device_requirements) = 'object');
  end if;
  if not exists (select 1 from pg_constraint where conrelid='public.tests'::regclass and conname='tests_eligibility_criteria_array') then
    alter table public.tests add constraint tests_eligibility_criteria_array
      check (jsonb_typeof(eligibility_criteria) = 'array');
  end if;
  if not exists (select 1 from pg_constraint where conrelid='public.tests'::regclass and conname='tests_tester_instructions_length') then
    alter table public.tests add constraint tests_tester_instructions_length
      check (tester_instructions is null or char_length(tester_instructions) <= 12000);
  end if;
end
$migration$;

comment on column public.tests.device_requirements is
  'Structured device compatibility details for the Test Details screen.';
comment on column public.tests.eligibility_criteria is
  'Array of tester eligibility requirements shown before joining.';
comment on column public.tests.tester_instructions is
  'Developer-authored instructions visible to assigned testers.';

create table if not exists public.test_steps (
  id uuid primary key default gen_random_uuid(),
  test_id uuid not null references public.tests(id) on delete cascade,
  step_order integer not null check (step_order > 0),
  title text not null check (char_length(title) between 2 and 160),
  description text not null check (char_length(description) between 1 and 4000),
  is_required boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (test_id, step_order)
);

create table if not exists public.test_requirements (
  id uuid primary key default gen_random_uuid(),
  test_id uuid not null references public.tests(id) on delete cascade,
  requirement_type text not null default 'other'
    check (requirement_type in ('device','android_version','account','network','eligibility','other')),
  title text not null check (char_length(title) between 2 and 160),
  description text not null check (char_length(description) between 1 and 2000),
  is_mandatory boolean not null default true,
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);

create table if not exists public.test_media (
  id uuid primary key default gen_random_uuid(),
  test_id uuid not null references public.tests(id) on delete cascade,
  media_type text not null check (media_type in ('image','video','document')),
  storage_path text not null check (char_length(storage_path) between 1 and 1024),
  alt_text text,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  check (alt_text is null or char_length(alt_text) <= 300)
);

create index if not exists test_steps_test_order_idx on public.test_steps(test_id, step_order);
create index if not exists test_requirements_test_order_idx on public.test_requirements(test_id, sort_order);
create index if not exists test_media_test_order_idx on public.test_media(test_id, sort_order);

alter table public.test_steps enable row level security;
alter table public.test_requirements enable row level security;
alter table public.test_media enable row level security;

grant select, insert, update, delete on public.test_steps to authenticated;
grant select, insert, update, delete on public.test_requirements to authenticated;
grant select, insert, update, delete on public.test_media to authenticated;

drop policy if exists test_steps_select_visible_test on public.test_steps;
create policy test_steps_select_visible_test on public.test_steps
for select to authenticated using (
  exists (
    select 1 from public.tests t join public.apps a on a.id=t.app_id
    where t.id=test_steps.test_id
      and (t.developer_id=(select auth.uid()) or a.status='published' or (select private.is_admin()))
  )
);
drop policy if exists test_steps_manage_owner on public.test_steps;
create policy test_steps_manage_owner on public.test_steps
for all to authenticated using (
  exists (select 1 from public.tests t where t.id=test_steps.test_id
    and (t.developer_id=(select auth.uid()) or (select private.is_admin())))
) with check (
  exists (select 1 from public.tests t where t.id=test_steps.test_id
    and (t.developer_id=(select auth.uid()) or (select private.is_admin())))
);

drop policy if exists test_requirements_select_visible_test on public.test_requirements;
create policy test_requirements_select_visible_test on public.test_requirements
for select to authenticated using (
  exists (
    select 1 from public.tests t join public.apps a on a.id=t.app_id
    where t.id=test_requirements.test_id
      and (t.developer_id=(select auth.uid()) or a.status='published' or (select private.is_admin()))
  )
);
drop policy if exists test_requirements_manage_owner on public.test_requirements;
create policy test_requirements_manage_owner on public.test_requirements
for all to authenticated using (
  exists (select 1 from public.tests t where t.id=test_requirements.test_id
    and (t.developer_id=(select auth.uid()) or (select private.is_admin())))
) with check (
  exists (select 1 from public.tests t where t.id=test_requirements.test_id
    and (t.developer_id=(select auth.uid()) or (select private.is_admin())))
);

drop policy if exists test_media_select_visible_test on public.test_media;
create policy test_media_select_visible_test on public.test_media
for select to authenticated using (
  exists (
    select 1 from public.tests t join public.apps a on a.id=t.app_id
    where t.id=test_media.test_id
      and (t.developer_id=(select auth.uid()) or a.status='published' or (select private.is_admin()))
  )
);
drop policy if exists test_media_manage_owner on public.test_media;
create policy test_media_manage_owner on public.test_media
for all to authenticated using (
  exists (select 1 from public.tests t where t.id=test_media.test_id
    and (t.developer_id=(select auth.uid()) or (select private.is_admin())))
) with check (
  exists (select 1 from public.tests t where t.id=test_media.test_id
    and (t.developer_id=(select auth.uid()) or (select private.is_admin())))
);

commit;
