begin;

select plan(21);

-- ---------------------------------------------------------------------------
-- Static privilege posture: client writes stay on an explicit allowlist.
-- ---------------------------------------------------------------------------
select ok(
  not has_table_privilege('authenticated', 'public.tests', 'INSERT')
  and not has_table_privilege('authenticated', 'public.tests', 'UPDATE'),
  'authenticated has no table-level INSERT or UPDATE grant on tests'
);

select ok(
  has_column_privilege('authenticated', 'public.tests', 'app_id', 'INSERT')
  and has_column_privilege('authenticated', 'public.tests', 'developer_id', 'INSERT')
  and has_column_privilege('authenticated', 'public.tests', 'title', 'INSERT')
  and has_column_privilege('authenticated', 'public.tests', 'description', 'INSERT')
  and has_column_privilege('authenticated', 'public.tests', 'min_testers', 'INSERT')
  and has_column_privilege('authenticated', 'public.tests', 'test_type', 'INSERT')
  and has_column_privilege('authenticated', 'public.tests', 'test_config', 'INSERT'),
  'developer-authored and wizard fields remain insertable'
);

select ok(
  not has_column_privilege('authenticated', 'public.tests', 'id', 'INSERT')
  and not has_column_privilege('authenticated', 'public.tests', 'status', 'INSERT')
  and not has_column_privilege('authenticated', 'public.tests', 'created_at', 'INSERT')
  and not has_column_privilege('authenticated', 'public.tests', 'updated_at', 'INSERT'),
  'identity, lifecycle, and system columns are not insertable'
);

select ok(
  not has_column_privilege('authenticated', 'public.tests', 'app_id', 'UPDATE')
  and not has_column_privilege('authenticated', 'public.tests', 'developer_id', 'UPDATE')
  and not has_column_privilege('authenticated', 'public.tests', 'status', 'UPDATE')
  and not has_column_privilege('authenticated', 'public.tests', 'id', 'UPDATE')
  and not has_column_privilege('authenticated', 'public.tests', 'created_at', 'UPDATE')
  and not has_column_privilege('authenticated', 'public.tests', 'updated_at', 'UPDATE'),
  'ownership, lifecycle, and system columns are not updatable'
);

select ok(
  has_column_privilege('authenticated', 'public.tests', 'title', 'UPDATE')
  and has_column_privilege('authenticated', 'public.tests', 'test_type', 'UPDATE')
  and has_column_privilege('authenticated', 'public.tests', 'test_config', 'UPDATE'),
  'developer-authored edit fields remain updatable'
);

select ok(
  (select relrowsecurity from pg_class where oid = 'public.tests'::regclass),
  'row level security is enabled on tests'
);

select ok(
  exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'tests'
      and policyname = 'tests_insert_owner'
      and cmd = 'INSERT'
      and with_check like '%auth.uid%'
      and with_check like '%a.developer_id%'
  ),
  'insert policy requires caller ownership of both the test and its app'
);

-- ---------------------------------------------------------------------------
-- Runtime RLS fixtures. Inserted before switching roles so they bypass RLS.
-- ---------------------------------------------------------------------------
insert into auth.users (
  id, instance_id, aud, role, email, encrypted_password,
  email_confirmed_at, raw_app_meta_data, raw_user_meta_data,
  created_at, updated_at
) values
  ('91000000-0000-4000-8000-000000000001','00000000-0000-0000-0000-000000000000','authenticated','authenticated','c1-dev-a@example.test','',now(),'{}','{}',now(),now()),
  ('91000000-0000-4000-8000-000000000002','00000000-0000-0000-0000-000000000000','authenticated','authenticated','c1-dev-b@example.test','',now(),'{}','{}',now(),now()),
  ('91000000-0000-4000-8000-000000000003','00000000-0000-0000-0000-000000000000','authenticated','authenticated','c1-admin@example.test','',now(),'{}','{}',now(),now())
on conflict (id) do nothing;

insert into public.profiles (id, display_name)
values
  ('91000000-0000-4000-8000-000000000001','C1 Developer A'),
  ('91000000-0000-4000-8000-000000000002','C1 Developer B'),
  ('91000000-0000-4000-8000-000000000003','C1 Admin')
on conflict (id) do nothing;

insert into public.user_roles (user_id, role)
values
  ('91000000-0000-4000-8000-000000000001','developer'),
  ('91000000-0000-4000-8000-000000000002','developer'),
  ('91000000-0000-4000-8000-000000000003','admin')
on conflict (user_id, role) do nothing;

-- App B is published so the cross-owner attempt cannot be dismissed as a
-- visibility artefact: the caller can read it, but must still be rejected.
insert into public.apps (id, developer_id, name, package_name, status)
values
  ('92000000-0000-4000-8000-000000000001','91000000-0000-4000-8000-000000000001','C1 App A','test.c1.app.a','draft'),
  ('92000000-0000-4000-8000-000000000002','91000000-0000-4000-8000-000000000002','C1 App B','test.c1.app.b','published')
on conflict (id) do nothing;

insert into public.tests (id, app_id, developer_id, title)
values (
  '93000000-0000-4000-8000-000000000001',
  '92000000-0000-4000-8000-000000000002',
  '91000000-0000-4000-8000-000000000002',
  'C1 Test B'
)
on conflict (id) do nothing;

-- ---------------------------------------------------------------------------
-- Developer A: normal draft creation and ownership boundaries.
-- ---------------------------------------------------------------------------
set local role authenticated;
select set_config('request.jwt.claim.sub', '91000000-0000-4000-8000-000000000001', true);
select set_config('request.jwt.claims', '{"sub":"91000000-0000-4000-8000-000000000001","role":"authenticated"}', true);

select lives_ok(
  $$insert into public.tests (app_id, developer_id, title, description, min_testers, test_type, test_config)
    values ('92000000-0000-4000-8000-000000000001','91000000-0000-4000-8000-000000000001','C1 Draft A','Created by the wizard',12,'usability','{"rules":{"androidVersion":"8"}}')$$,
  'developer can create a draft on their own app without sending status'
);

select is(
  (select status from public.tests where title = 'C1 Draft A'),
  'draft',
  'new tests without an explicit status start as draft'
);

select throws_ok(
  $$insert into public.tests (app_id, developer_id, title)
    values ('92000000-0000-4000-8000-000000000002','91000000-0000-4000-8000-000000000001','C1 Cross Owner')$$,
  '42501', null,
  'developer cannot create a test on another developer''s app'
);

select throws_ok(
  $$insert into public.tests (app_id, developer_id, title)
    values ('92000000-0000-4000-8000-000000000001','91000000-0000-4000-8000-000000000002','C1 Spoofed Developer')$$,
  '42501', null,
  'developer cannot forge another user as developer_id'
);

select throws_ok(
  $$insert into public.tests (app_id, developer_id, title, status)
    values ('92000000-0000-4000-8000-000000000001','91000000-0000-4000-8000-000000000001','C1 Live Status','completed')$$,
  '42501', null,
  'developer cannot choose the lifecycle status on insert'
);

select throws_ok(
  $$insert into public.tests (id, app_id, developer_id, title)
    values ('94000000-0000-4000-8000-000000000001','92000000-0000-4000-8000-000000000001','91000000-0000-4000-8000-000000000001','C1 Client Id')$$,
  '42501', null,
  'developer cannot choose the test primary key'
);

select throws_ok(
  $$insert into public.tests (app_id, developer_id, title, created_at)
    values ('92000000-0000-4000-8000-000000000001','91000000-0000-4000-8000-000000000001','C1 Spoofed Date','2000-01-01T00:00:00Z')$$,
  '42501', null,
  'developer cannot backdate created_at'
);

with changed as (
  update public.tests
     set title = 'C1 Hijacked'
   where id = '93000000-0000-4000-8000-000000000001'
   returning 1
)
select is(
  (select count(*)::int from changed),
  0,
  'developer cannot update another developer''s test'
);

select throws_ok(
  $$update public.tests set status = 'completed'
     where id = '93000000-0000-4000-8000-000000000001'$$,
  '42501', null,
  'developer cannot change test status directly'
);

select throws_ok(
  $$update public.tests set app_id = '92000000-0000-4000-8000-000000000002'
     where app_id = '92000000-0000-4000-8000-000000000001'$$,
  '42501', null,
  'developer cannot move a test to another app'
);

select throws_ok(
  $$update public.tests set developer_id = '91000000-0000-4000-8000-000000000002'
     where app_id = '92000000-0000-4000-8000-000000000001'$$,
  '42501', null,
  'developer cannot transfer test ownership'
);

with changed as (
  update public.tests
     set title = 'C1 Draft A Updated'
   where title = 'C1 Draft A'
   returning 1
)
select is(
  (select count(*)::int from changed),
  1,
  'developer can update developer-authored fields on their own test'
);

-- ---------------------------------------------------------------------------
-- Admin path: delegated creation remains possible but still requires the app
-- to belong to the named developer.
-- ---------------------------------------------------------------------------
select set_config('request.jwt.claim.sub', '91000000-0000-4000-8000-000000000003', true);
select set_config('request.jwt.claims', '{"sub":"91000000-0000-4000-8000-000000000003","role":"authenticated"}', true);

select lives_ok(
  $$insert into public.tests (app_id, developer_id, title)
    values ('92000000-0000-4000-8000-000000000002','91000000-0000-4000-8000-000000000002','C1 Admin Delegated')$$,
  'admin can create a test for a developer who owns the referenced app'
);

select throws_ok(
  $$insert into public.tests (app_id, developer_id, title)
    values ('92000000-0000-4000-8000-000000000001','91000000-0000-4000-8000-000000000002','C1 Admin Mismatch')$$,
  '42501', null,
  'admin cannot attach a developer to an app owned by a different developer'
);

select * from finish();

rollback;
