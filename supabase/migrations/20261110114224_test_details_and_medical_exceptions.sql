-- TestDZ: structured Test Details metadata and auditable medical exceptions.
-- Approved policy: documented dates approved by an administrator pause required
-- testing days and extend the assignment deadline by the same number of days.
-- Approved dates do not count as check-ins and do not earn check-in points.

alter table public.tests
  add column if not exists short_summary text,
  add column if not exists estimated_duration_minutes integer,
  add column if not exists android_min_api integer,
  add column if not exists android_max_api integer,
  add column if not exists device_requirements jsonb not null default '{}'::jsonb,
  add column if not exists eligibility_criteria jsonb not null default '[]'::jsonb,
  add column if not exists tester_instructions text;

alter table public.tests
  add constraint tests_short_summary_length
    check (short_summary is null or char_length(short_summary) <= 240),
  add constraint tests_estimated_duration_range
    check (estimated_duration_minutes is null or estimated_duration_minutes between 1 and 1440),
  add constraint tests_android_api_range
    check ((android_min_api is null or android_min_api between 21 and 100)
      and (android_max_api is null or android_max_api between 21 and 100)
      and (android_min_api is null or android_max_api is null or android_max_api >= android_min_api)),
  add constraint tests_device_requirements_object
    check (jsonb_typeof(device_requirements) = 'object'),
  add constraint tests_eligibility_criteria_array
    check (jsonb_typeof(eligibility_criteria) = 'array'),
  add constraint tests_tester_instructions_length
    check (tester_instructions is null or char_length(tester_instructions) <= 12000);

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

create policy test_steps_select_visible_test on public.test_steps
for select to authenticated using (
  exists (select 1 from public.tests t join public.apps a on a.id=t.app_id
    where t.id=test_steps.test_id and
      (t.developer_id=(select auth.uid()) or a.status='published' or (select private.is_admin())))
);
create policy test_steps_manage_owner on public.test_steps
for all to authenticated using (
  exists (select 1 from public.tests t where t.id=test_steps.test_id
    and (t.developer_id=(select auth.uid()) or (select private.is_admin())))
) with check (
  exists (select 1 from public.tests t where t.id=test_steps.test_id
    and (t.developer_id=(select auth.uid()) or (select private.is_admin())))
);

create policy test_requirements_select_visible_test on public.test_requirements
for select to authenticated using (
  exists (select 1 from public.tests t join public.apps a on a.id=t.app_id
    where t.id=test_requirements.test_id and
      (t.developer_id=(select auth.uid()) or a.status='published' or (select private.is_admin())))
);
create policy test_requirements_manage_owner on public.test_requirements
for all to authenticated using (
  exists (select 1 from public.tests t where t.id=test_requirements.test_id
    and (t.developer_id=(select auth.uid()) or (select private.is_admin())))
) with check (
  exists (select 1 from public.tests t where t.id=test_requirements.test_id
    and (t.developer_id=(select auth.uid()) or (select private.is_admin())))
);

create policy test_media_select_visible_test on public.test_media
for select to authenticated using (
  exists (select 1 from public.tests t join public.apps a on a.id=t.app_id
    where t.id=test_media.test_id and
      (t.developer_id=(select auth.uid()) or a.status='published' or (select private.is_admin())))
);
create policy test_media_manage_owner on public.test_media
for all to authenticated using (
  exists (select 1 from public.tests t where t.id=test_media.test_id
    and (t.developer_id=(select auth.uid()) or (select private.is_admin())))
) with check (
  exists (select 1 from public.tests t where t.id=test_media.test_id
    and (t.developer_id=(select auth.uid()) or (select private.is_admin())))
);

create table if not exists public.medical_exception_requests (
  id uuid primary key default gen_random_uuid(),
  assignment_id uuid not null references public.assignments(id) on delete restrict,
  tester_id uuid not null references public.profiles(id) on delete restrict,
  requested_dates date[] not null,
  reason text not null check (char_length(reason) between 20 and 4000),
  evidence_storage_path text,
  status text not null default 'pending' check (status in ('pending','approved','rejected')),
  review_note text,
  reviewed_by uuid references public.profiles(id) on delete restrict,
  reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  check (cardinality(requested_dates) between 1 and 14),
  check (evidence_storage_path is null or char_length(evidence_storage_path) <= 1024),
  check (review_note is null or char_length(review_note) <= 2000),
  check ((status='pending' and reviewed_by is null and reviewed_at is null)
    or (status in ('approved','rejected') and reviewed_by is not null and reviewed_at is not null))
);

create unique index if not exists medical_exception_one_pending_per_assignment
  on public.medical_exception_requests(assignment_id) where status='pending';
create index if not exists medical_exception_tester_created_idx
  on public.medical_exception_requests(tester_id, created_at desc);

alter table public.medical_exception_requests enable row level security;
grant select, insert on public.medical_exception_requests to authenticated;

create policy medical_exception_select_participants on public.medical_exception_requests
for select to authenticated using (
  tester_id=(select auth.uid()) or (select private.is_admin()) or exists (
    select 1 from public.assignments a join public.tests t on t.id=a.test_id
    where a.id=medical_exception_requests.assignment_id and t.developer_id=(select auth.uid())
  )
);
create policy medical_exception_insert_own_active_assignment on public.medical_exception_requests
for insert to authenticated with check (
  tester_id=(select auth.uid()) and status='pending' and reviewed_by is null and reviewed_at is null
  and exists (select 1 from public.assignments a where a.id=medical_exception_requests.assignment_id
    and a.tester_id=(select auth.uid()) and a.status='active')
  and not exists (
    select 1
    from unnest(requested_dates) as requested_date
    where requested_date is null
  )
  and cardinality(requested_dates) = (
    select count(distinct d)
    from unnest(requested_dates) as d
  )
);

create or replace function private.review_medical_exception(
  p_request_id uuid, p_decision text, p_review_note text default null
) returns public.medical_exception_requests
language plpgsql security definer set search_path=pg_catalog, public, private
as $$
declare
  v_request public.medical_exception_requests%rowtype;
  v_assignment public.assignments%rowtype;
begin
  if auth.uid() is null or not private.is_admin() then
    raise exception 'ADMIN_ONLY' using errcode='42501';
  end if;
  if p_decision not in ('approved','rejected') then raise exception 'INVALID_DECISION'; end if;

  select * into v_request from public.medical_exception_requests
    where id=p_request_id for update;
  if not found then raise exception 'MEDICAL_EXCEPTION_NOT_FOUND'; end if;
  if v_request.status<>'pending' then raise exception 'MEDICAL_EXCEPTION_ALREADY_REVIEWED'; end if;

  select * into v_assignment
  from public.assignments
  where id = v_request.assignment_id
  for update;

  if not found or v_assignment.tester_id <> v_request.tester_id then
    raise exception 'ASSIGNMENT_MISMATCH';
  end if;

  if cardinality(v_request.requested_dates) <>
     (select count(distinct d) from unnest(v_request.requested_dates) as d) then
    raise exception 'DUPLICATE_EXCUSED_DATES';
  end if;

  update public.medical_exception_requests
    set status=p_decision, review_note=nullif(btrim(p_review_note),''),
        reviewed_by=auth.uid(), reviewed_at=now()
    where id=p_request_id returning * into v_request;

  if p_decision='approved' then
    update public.assignments
      set medical_extension_days=medical_extension_days+cardinality(v_request.requested_dates),
          medical_exception_note=concat_ws(E'\\n', nullif(medical_exception_note,''),
            'Approved medical exception request '||v_request.id::text||': '||
            array_to_string(v_request.requested_dates, ', ')),
          medical_exception_approved_by=auth.uid(),
          medical_exception_approved_at=now(),
          updated_at=now()
      where id=v_request.assignment_id;
  end if;
  return v_request;
end;
$$;

revoke all on function private.review_medical_exception(uuid,text,text) from public, anon;
grant usage on schema private to authenticated;
grant execute on function private.review_medical_exception(uuid,text,text) to authenticated;

create or replace function public.review_medical_exception(
  p_request_id uuid, p_decision text, p_review_note text default null
) returns public.medical_exception_requests
language sql security invoker set search_path=pg_catalog, public
as $$ select private.review_medical_exception(p_request_id,p_decision,p_review_note); $$;

revoke all on function public.review_medical_exception(uuid,text,text) from public, anon;
grant execute on function public.review_medical_exception(uuid,text,text) to authenticated;

comment on table public.medical_exception_requests is
  'Auditable medical exception workflow. Approved dates extend the assignment by the same number of days; no check-in reward is granted.';
