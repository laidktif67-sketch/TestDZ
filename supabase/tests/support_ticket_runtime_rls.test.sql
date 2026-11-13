begin;

select plan(12);

-- Two requesters and one support agent; all fixtures are transaction-scoped.
insert into auth.users (
  id, instance_id, aud, role, email, encrypted_password,
  email_confirmed_at, raw_app_meta_data, raw_user_meta_data,
  created_at, updated_at
) values
  ('21000000-0000-4000-8000-000000000001','00000000-0000-0000-0000-000000000000','authenticated','authenticated','support-rls-a@example.test','',now(),'{}','{}',now(),now()),
  ('21000000-0000-4000-8000-000000000002','00000000-0000-0000-0000-000000000000','authenticated','authenticated','support-rls-b@example.test','',now(),'{}','{}',now(),now()),
  ('21000000-0000-4000-8000-000000000003','00000000-0000-0000-0000-000000000000','authenticated','authenticated','support-rls-agent@example.test','',now(),'{}','{}',now(),now())
on conflict (id) do nothing;

insert into public.profiles (id, display_name)
values
  ('21000000-0000-4000-8000-000000000001','Support RLS Tester A'),
  ('21000000-0000-4000-8000-000000000002','Support RLS Tester B'),
  ('21000000-0000-4000-8000-000000000003','Support RLS Agent')
on conflict (id) do nothing;

insert into public.user_roles (user_id, role)
values
  ('21000000-0000-4000-8000-000000000001','tester'),
  ('21000000-0000-4000-8000-000000000002','tester'),
  ('21000000-0000-4000-8000-000000000003','support')
on conflict (user_id, role) do nothing;

insert into public.support_tickets (id, user_id, requester_role, subject, category, description)
values
  ('22000000-0000-4000-8000-000000000001','21000000-0000-4000-8000-000000000001','tester','RLS private ticket A','technical','Private support ticket belonging to requester A.'),
  ('22000000-0000-4000-8000-000000000002','21000000-0000-4000-8000-000000000002','tester','RLS private ticket B','technical','Private support ticket belonging to requester B.');

set local role authenticated;
select set_config('request.jwt.claim.sub','21000000-0000-4000-8000-000000000001',true);
select set_config('request.jwt.claims','{"sub":"21000000-0000-4000-8000-000000000001","role":"authenticated"}',true);

insert into public.support_ticket_messages (id, ticket_id, sender_id, body)
values (
  '23000000-0000-4000-8000-000000000001',
  '22000000-0000-4000-8000-000000000001',
  '21000000-0000-4000-8000-000000000001',
  'Requester A private support conversation.'
);

select is(
  (select count(*)::int from public.support_ticket_messages where id = '23000000-0000-4000-8000-000000000001'),
  1,
  'requester A can read their own support conversation'
);

select throws_ok(
  $$insert into public.support_ticket_messages (ticket_id, sender_id, body)
    values ('22000000-0000-4000-8000-000000000001','21000000-0000-4000-8000-000000000002','Forged support sender')$$,
  '42501', null,
  'requester A cannot forge requester B as support message sender'
);

select is(
  (select count(*)::int from public.support_ticket_events where ticket_id = '22000000-0000-4000-8000-000000000001'),
  1,
  'requester A can read the database-authored ticket creation event'
);

insert into storage.objects (bucket_id, name)
values (
  'support-attachments',
  '22000000-0000-4000-8000-000000000001/21000000-0000-4000-8000-000000000001/support-a.txt'
);

select is(
  (select count(*)::int from storage.objects
   where bucket_id = 'support-attachments'
     and name = '22000000-0000-4000-8000-000000000001/21000000-0000-4000-8000-000000000001/support-a.txt'),
  1,
  'requester A can create a support attachment under their own ticket path'
);

select throws_ok(
  $$insert into public.support_tickets (user_id, requester_role, subject, category, description)
    values ('21000000-0000-4000-8000-000000000001','developer','Forged developer role','technical','Requester A cannot create a ticket as a role they do not hold.')$$,
  '42501', null,
  'tester A cannot create a support ticket under the developer requester role'
);

select set_config('request.jwt.claim.sub','21000000-0000-4000-8000-000000000002',true);
select set_config('request.jwt.claims','{"sub":"21000000-0000-4000-8000-000000000002","role":"authenticated"}',true);

select is(
  (select count(*)::int from public.support_ticket_messages where id = '23000000-0000-4000-8000-000000000001'),
  0,
  'requester B cannot read requester A support conversation'
);

select is(
  (select count(*)::int from public.support_ticket_events where ticket_id = '22000000-0000-4000-8000-000000000001'),
  0,
  'requester B cannot read requester A support audit history'
);

select is(
  (select count(*)::int from storage.objects
   where bucket_id = 'support-attachments'
     and name = '22000000-0000-4000-8000-000000000001/21000000-0000-4000-8000-000000000001/support-a.txt'),
  0,
  'requester B cannot read requester A support attachment'
);

select throws_ok(
  $$insert into public.support_ticket_messages (ticket_id, sender_id, body)
    values ('22000000-0000-4000-8000-000000000001','21000000-0000-4000-8000-000000000002','Cross-ticket write must fail')$$,
  '42501', null,
  'requester B cannot append a message to requester A ticket'
);

select throws_ok(
  $$insert into storage.objects (bucket_id, name)
    values ('support-attachments','22000000-0000-4000-8000-000000000001/21000000-0000-4000-8000-000000000002/forged.txt')$$,
  '42501', null,
  'requester B cannot upload into requester A ticket folder'
);

select set_config('request.jwt.claim.sub','21000000-0000-4000-8000-000000000003',true);
select set_config('request.jwt.claims','{"sub":"21000000-0000-4000-8000-000000000003","role":"authenticated"}',true);

select is(
  (select count(*)::int from public.support_ticket_messages where id = '23000000-0000-4000-8000-000000000001'),
  1,
  'authorized support staff can read requester conversation'
);

select is(
  (select count(*)::int from storage.objects
   where bucket_id = 'support-attachments'
     and name = '22000000-0000-4000-8000-000000000001/21000000-0000-4000-8000-000000000001/support-a.txt'),
  1,
  'authorized support staff can read support attachment'
);

reset role;

select * from finish();
rollback;
