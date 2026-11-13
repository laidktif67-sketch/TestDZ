begin;

select plan(22);

-- Isolated fixture graph: four cohort developers and one non-member. Each
-- member owns one test; assignments only cross between different members.
insert into auth.users (
  id, instance_id, aud, role, email, encrypted_password,
  email_confirmed_at, raw_app_meta_data, raw_user_meta_data,
  created_at, updated_at
) values
  ('10000000-0000-4000-8000-000000000001','00000000-0000-0000-0000-000000000000','authenticated','authenticated','rls-dev-a@example.test','',now(),'{}','{}',now(),now()),
  ('10000000-0000-4000-8000-000000000002','00000000-0000-0000-0000-000000000000','authenticated','authenticated','rls-dev-b@example.test','',now(),'{}','{}',now(),now()),
  ('20000000-0000-4000-8000-000000000001','00000000-0000-0000-0000-000000000000','authenticated','authenticated','rls-tester-a@example.test','',now(),'{}','{}',now(),now()),
  ('20000000-0000-4000-8000-000000000002','00000000-0000-0000-0000-000000000000','authenticated','authenticated','rls-developer-d@example.test','',now(),'{}','{}',now(),now()),
  ('30000000-0000-4000-8000-000000000001','00000000-0000-0000-0000-000000000000','authenticated','authenticated','rls-outsider@example.test','',now(),'{}','{}',now(),now())
on conflict (id) do nothing;

insert into public.profiles (id, display_name)
values
  ('10000000-0000-4000-8000-000000000001','RLS Developer A'),
  ('10000000-0000-4000-8000-000000000002','RLS Developer B'),
  ('20000000-0000-4000-8000-000000000001','RLS Tester A'),
  ('20000000-0000-4000-8000-000000000002','RLS Developer D'),
  ('30000000-0000-4000-8000-000000000001','RLS Cohort Outsider')
on conflict (id) do nothing;

insert into public.user_roles (user_id, role)
values
  ('10000000-0000-4000-8000-000000000001','developer'),
  ('10000000-0000-4000-8000-000000000002','developer'),
  ('20000000-0000-4000-8000-000000000001','developer'),
  ('20000000-0000-4000-8000-000000000002','developer')
on conflict (user_id, role) do nothing;

insert into public.apps (id, developer_id, name, package_name)
values
  ('30000000-0000-4000-8000-000000000001','10000000-0000-4000-8000-000000000001','RLS App A','test.rls.app.a'),
  ('30000000-0000-4000-8000-000000000002','10000000-0000-4000-8000-000000000002','RLS App B','test.rls.app.b'),
  ('30000000-0000-4000-8000-000000000003','20000000-0000-4000-8000-000000000001','RLS App C','test.rls.app.c'),
  ('30000000-0000-4000-8000-000000000004','20000000-0000-4000-8000-000000000002','RLS App D','test.rls.app.d');

insert into public.tests (id, app_id, developer_id, title)
values
  ('40000000-0000-4000-8000-000000000001','30000000-0000-4000-8000-000000000001','10000000-0000-4000-8000-000000000001','RLS Test A'),
  ('40000000-0000-4000-8000-000000000002','30000000-0000-4000-8000-000000000002','10000000-0000-4000-8000-000000000002','RLS Test B'),
  ('40000000-0000-4000-8000-000000000003','30000000-0000-4000-8000-000000000003','20000000-0000-4000-8000-000000000001','RLS Test C'),
  ('40000000-0000-4000-8000-000000000004','30000000-0000-4000-8000-000000000004','20000000-0000-4000-8000-000000000002','RLS Test D');

-- cohorts.test_id was intentionally removed by the cohort normalization migration.
-- Ownership now lives in cohort_tests; assignments retain their own test_id.
insert into public.cohorts (id, name, capacity)
values ('50000000-0000-4000-8000-000000000001','RLS Cohort A',5);

-- The cohort is a developer cohort: each member owns one test and can test
-- every other member's test. This fixture preserves both composite FKs.
insert into public.cohort_tests (cohort_id, test_id, developer_id)
values
  ('50000000-0000-4000-8000-000000000001','40000000-0000-4000-8000-000000000001','10000000-0000-4000-8000-000000000001'),
  ('50000000-0000-4000-8000-000000000001','40000000-0000-4000-8000-000000000002','10000000-0000-4000-8000-000000000002'),
  ('50000000-0000-4000-8000-000000000001','40000000-0000-4000-8000-000000000003','20000000-0000-4000-8000-000000000001'),
  ('50000000-0000-4000-8000-000000000001','40000000-0000-4000-8000-000000000004','20000000-0000-4000-8000-000000000002');

insert into public.assignments (id, cohort_id, test_id, tester_id)
values
  ('60000000-0000-4000-8000-000000000001','50000000-0000-4000-8000-000000000001','40000000-0000-4000-8000-000000000001','10000000-0000-4000-8000-000000000002'),
  ('60000000-0000-4000-8000-000000000002','50000000-0000-4000-8000-000000000001','40000000-0000-4000-8000-000000000001','20000000-0000-4000-8000-000000000001'),
  ('60000000-0000-4000-8000-000000000003','50000000-0000-4000-8000-000000000001','40000000-0000-4000-8000-000000000002','10000000-0000-4000-8000-000000000001'),
  ('60000000-0000-4000-8000-000000000004','50000000-0000-4000-8000-000000000001','40000000-0000-4000-8000-000000000003','10000000-0000-4000-8000-000000000001'),
  ('60000000-0000-4000-8000-000000000005','50000000-0000-4000-8000-000000000001','40000000-0000-4000-8000-000000000004','10000000-0000-4000-8000-000000000001');

select throws_ok(
  $sql$insert into public.assignments (cohort_id, test_id, tester_id)
    values ('50000000-0000-4000-8000-000000000001','40000000-0000-4000-8000-000000000001','30000000-0000-4000-8000-000000000001')$sql$,
  '23503', null,
  'a user outside the cohort cannot be assigned as a tester'
);

select throws_ok(
  $sql$insert into public.assignments (cohort_id, test_id, tester_id)
    values ('50000000-0000-4000-8000-000000000001','40000000-0000-4000-8000-000000000001','10000000-0000-4000-8000-000000000001')$sql$,
  'P0001', 'SELF_TEST_FORBIDDEN',
  'a developer cannot be assigned to test their own test'
);

insert into public.feedback (id, assignment_id, tester_id, body)
values
  ('70000000-0000-4000-8000-000000000001','60000000-0000-4000-8000-000000000001','10000000-0000-4000-8000-000000000002','Private feedback record belonging to cohort tester B.');

set local role authenticated;
select set_config('request.jwt.claim.sub','10000000-0000-4000-8000-000000000002',true);
select set_config('request.jwt.claims','{"sub":"10000000-0000-4000-8000-000000000002","role":"authenticated"}',true);

insert into public.developer_feedback_messages (id, feedback_id, sender_id, body)
values (
  '80000000-0000-4000-8000-000000000001',
  '70000000-0000-4000-8000-000000000001',
  '10000000-0000-4000-8000-000000000002',
  'Cohort developer B private conversation message.'
);

select is(
  (select count(*)::int from public.developer_feedback_messages where id = '80000000-0000-4000-8000-000000000001'),
  1,
  'tester A can read their own feedback conversation'
);

select throws_ok(
  $$insert into public.developer_feedback_messages (feedback_id, sender_id, body)
    values ('70000000-0000-4000-8000-000000000001','20000000-0000-4000-8000-000000000001','Forged sender must be rejected')$$,
  '42501', null,
  'a cohort member cannot forge another member as the message sender'
);

select throws_ok(
  $$insert into public.developer_feedback_events (feedback_id, actor_id, event_type)
    values ('70000000-0000-4000-8000-000000000001','10000000-0000-4000-8000-000000000002','message_sent')$$,
  '42501', null,
  'authenticated clients cannot manufacture audit events'
);

select is(
  (select count(*)::int from public.developer_feedback_events
   where feedback_id = '70000000-0000-4000-8000-000000000001'
     and actor_id = '10000000-0000-4000-8000-000000000002'
     and event_type = 'message_sent'),
  1,
  'message insert creates exactly one database-authored audit event'
);

select throws_ok(
  $sql$update public.developer_feedback_events
    set new_value = 'forged audit edit'
    where feedback_id = '70000000-0000-4000-8000-000000000001'$sql$,
  '42501', null,
  'authenticated participants cannot update database-authored audit events'
);

select throws_ok(
  $sql$delete from public.developer_feedback_events
    where feedback_id = '70000000-0000-4000-8000-000000000001'$sql$,
  '42501', null,
  'authenticated participants cannot delete database-authored audit events'
);

insert into storage.objects (bucket_id, name)
values (
  'developer-feedback-attachments',
  '70000000-0000-4000-8000-000000000001/10000000-0000-4000-8000-000000000002/rls-a.txt'
);

select is(
  (select count(*)::int from storage.objects
   where bucket_id = 'developer-feedback-attachments'
     and name = '70000000-0000-4000-8000-000000000001/10000000-0000-4000-8000-000000000002/rls-a.txt'),
  1,
  'tester A can create a storage object under their own feedback and user path'
);

select set_config('request.jwt.claim.sub','10000000-0000-4000-8000-000000000001',true);
select set_config('request.jwt.claims','{"sub":"10000000-0000-4000-8000-000000000001","role":"authenticated"}',true);

select is(
  (select count(*)::int from public.developer_feedback_messages
   where id = '80000000-0000-4000-8000-000000000001'),
  1,
  'owning developer A can read the assigned tester conversation'
);

select is(
  (select count(*)::int from public.developer_feedback_events
   where feedback_id = '70000000-0000-4000-8000-000000000001'),
  1,
  'owning developer A can read the feedback audit trail'
);

select is(
  (select count(*)::int from storage.objects
   where bucket_id = 'developer-feedback-attachments'
     and name = '70000000-0000-4000-8000-000000000001/10000000-0000-4000-8000-000000000002/rls-a.txt'),
  1,
  'owning developer A can read a participant feedback attachment'
);

select set_config('request.jwt.claim.sub','20000000-0000-4000-8000-000000000001',true);
select set_config('request.jwt.claims','{"sub":"20000000-0000-4000-8000-000000000001","role":"authenticated"}',true);

select is(
  (select count(*)::int from public.developer_feedback_messages
   where id = '80000000-0000-4000-8000-000000000001'),
  0,
  'unassigned cohort developer C cannot read developer A feedback conversation'
);

select is(
  (select count(*)::int from public.developer_feedback_events
   where feedback_id = '70000000-0000-4000-8000-000000000001'),
  0,
  'unassigned cohort developer C cannot read developer A feedback audit trail'
);

select is(
  (select count(*)::int from storage.objects
   where bucket_id = 'developer-feedback-attachments'
     and name = '70000000-0000-4000-8000-000000000001/10000000-0000-4000-8000-000000000002/rls-a.txt'),
  0,
  'unassigned cohort developer C cannot read developer A feedback attachment'
);

select set_config('request.jwt.claim.sub','20000000-0000-4000-8000-000000000002',true);
select set_config('request.jwt.claims','{"sub":"20000000-0000-4000-8000-000000000002","role":"authenticated"}',true);

select is(
  (select count(*)::int from public.developer_feedback_messages
   where id = '80000000-0000-4000-8000-000000000001'),
  0,
  'cohort developer D without this assignment cannot read developer B feedback conversation'
);

select is(
  (select count(*)::int from storage.objects
   where bucket_id = 'developer-feedback-attachments'
     and name = '70000000-0000-4000-8000-000000000001/10000000-0000-4000-8000-000000000002/rls-a.txt'),
  0,
  'cohort developer D without this assignment cannot read developer B feedback attachment'
);

select throws_ok(
  $$insert into storage.objects (bucket_id, name)
    values ('developer-feedback-attachments',
      '70000000-0000-4000-8000-000000000001/20000000-0000-4000-8000-000000000002/forged.txt')$$,
  '42501', null,
  'a cohort member without feedback participation cannot upload into another member feedback folder'
);

-- Exercise the actual review triggers under the owning developer identity.
select set_config('request.jwt.claim.sub','10000000-0000-4000-8000-000000000001',true);
select set_config('request.jwt.claims','{"sub":"10000000-0000-4000-8000-000000000001","role":"authenticated"}',true);

insert into public.developer_feedback_reviews (feedback_id, developer_id)
values (
  '70000000-0000-4000-8000-000000000001',
  '10000000-0000-4000-8000-000000000001'
);

update public.developer_feedback_reviews
set status = 'resolved',
    priority = 'urgent'
where feedback_id = '70000000-0000-4000-8000-000000000001';

select is(
  (select count(*)::int from public.developer_feedback_events
   where feedback_id = '70000000-0000-4000-8000-000000000001'
     and actor_id = '10000000-0000-4000-8000-000000000001'
     and event_type = 'status_changed'
     and old_value = 'new'
     and new_value = 'resolved'),
  1,
  'review status update writes exactly one database-authored status event'
);

select is(
  (select count(*)::int from public.developer_feedback_events
   where feedback_id = '70000000-0000-4000-8000-000000000001'
     and actor_id = '10000000-0000-4000-8000-000000000001'
     and event_type = 'priority_changed'
     and old_value = 'normal'
     and new_value = 'urgent'),
  1,
  'review priority update writes exactly one database-authored priority event'
);

select ok(
  (select resolved_at is not null and updated_at >= created_at
   from public.developer_feedback_reviews
   where feedback_id = '70000000-0000-4000-8000-000000000001'),
  'review timestamps are populated and resolution time is server-owned'
);

select throws_ok(
  $sql$update public.developer_feedback_reviews
    set updated_at = '2000-01-01T00:00:00Z'
    where feedback_id = '70000000-0000-4000-8000-000000000001'$sql$,
  '42501', null,
  'authenticated developers cannot forge review update timestamps'
);

reset role;

select * from finish();
rollback;
