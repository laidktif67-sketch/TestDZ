begin;

select plan(16);

insert into auth.users (
  id, instance_id, aud, role, email, encrypted_password,
  email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at
) values
(
  '26000000-0000-4000-8000-000000000001',
  '00000000-0000-0000-0000-000000000000',
  'authenticated', 'authenticated', 'safety-admin@example.test', '',
  now(), '{}', '{}', now(), now()
),
(
  '26000000-0000-4000-8000-000000000002',
  '00000000-0000-0000-0000-000000000000',
  'authenticated', 'authenticated', 'safety-user@example.test', '',
  now(), '{}', '{}', now(), now()
)
on conflict (id) do nothing;

insert into public.profiles (id, display_name, is_banned)
values
  ('26000000-0000-4000-8000-000000000001', 'Safety Admin', false),
  ('26000000-0000-4000-8000-000000000002', 'Safety User', false)
on conflict (id) do nothing;

insert into public.user_roles (user_id, role)
values
  ('26000000-0000-4000-8000-000000000001', 'admin'),
  ('26000000-0000-4000-8000-000000000002', 'tester')
on conflict (user_id, role) do nothing;

select ok(
  to_regclass('public.account_suspensions') is not null
  and to_regclass('public.account_suspension_appeals') is not null,
  'suspension and appeal records are stored in dedicated tables'
);

select ok(
  (select relrowsecurity from pg_class where oid = 'public.account_suspensions'::regclass)
  and (select relrowsecurity from pg_class where oid = 'public.account_suspension_appeals'::regclass)
  and not has_table_privilege('authenticated', 'public.account_suspensions', 'SELECT')
  and not has_table_privilege('authenticated', 'public.account_suspension_appeals', 'INSERT'),
  'safety records enforce RLS and deny direct authenticated table access'
);

select ok(
  has_function_privilege('authenticated', 'public.admin_suspend_user(uuid,text)', 'EXECUTE')
  and has_function_privilege('authenticated', 'public.submit_account_suspension_appeal(uuid,text)', 'EXECUTE')
  and has_function_privilege('authenticated', 'public.admin_review_account_suspension_appeal(uuid,text,text)', 'EXECUTE')
  and not has_function_privilege('anon', 'public.admin_suspend_user(uuid,text)', 'EXECUTE'),
  'only authenticated sessions can invoke the controlled safety RPCs'
);

set local role authenticated;
select set_config('request.jwt.claim.sub', '26000000-0000-4000-8000-000000000001', true);
select set_config('request.jwt.claims', '{"sub":"26000000-0000-4000-8000-000000000001","role":"authenticated"}', true);

select lives_ok(
  $$select public.admin_suspend_user(
    '26000000-0000-4000-8000-000000000002',
    'Repeated verified abuse reports'
  )$$,
  'an administrator can suspend a non-admin account through the RPC'
);

select throws_ok(
  $$select public.admin_suspend_user(
    '26000000-0000-4000-8000-000000000001',
    'Attempted self suspension'
  )$$,
  '22023', 'INVALID_SUSPENSION_TARGET',
  'an administrator cannot suspend their own account'
);

reset role;

select is(
  (select is_banned from public.profiles where id = '26000000-0000-4000-8000-000000000002'),
  true,
  'administrator suspension updates the protected profile status'
);

select ok(
  exists (
    select 1 from public.account_suspensions
    where user_id = '26000000-0000-4000-8000-000000000002'
      and status = 'active'
      and appeal_deadline between suspended_at + interval '6 days 23 hours'
                              and suspended_at + interval '7 days 1 minute'
  ),
  'suspension creates a seven-day appeal window'
);

select ok(
  exists (
    select 1 from public.audit_logs
    where actor_id = '26000000-0000-4000-8000-000000000001'
      and action = 'account.suspended'
      and entity_id = '26000000-0000-4000-8000-000000000002'
  ),
  'suspension writes an immutable audit event'
);

select ok(
  exists (
    select 1 from public.notifications
    where user_id = '26000000-0000-4000-8000-000000000002'
      and type = 'account_suspended'
  ),
  'suspension notifies the affected user'
);

set local role authenticated;
select set_config('request.jwt.claim.sub', '26000000-0000-4000-8000-000000000002', true);
select set_config('request.jwt.claims', '{"sub":"26000000-0000-4000-8000-000000000002","role":"authenticated"}', true);

select ok(
  exists (
    select 1 from public.get_my_account_suspension()
    where suspension_id is not null
      and appeal_deadline > now()
      and reason = 'Repeated verified abuse reports'
  ),
  'a banned user can securely retrieve only their own suspension and appeal deadline'
);

select lives_ok(
  $$select public.submit_account_suspension_appeal(
    (select suspension_id from public.get_my_account_suspension()),
    'I believe this suspension was applied in error and request a review.'
  )$$,
  'the suspended user can submit an appeal within the seven-day window'
);

reset role;

select ok(
  exists (
    select 1 from public.account_suspension_appeals
    where user_id = '26000000-0000-4000-8000-000000000002'
      and status = 'pending'
  ),
  'appeal is recorded as pending and awaits administrator review'
);

set local role authenticated;
select set_config('request.jwt.claim.sub', '26000000-0000-4000-8000-000000000001', true);
select set_config('request.jwt.claims', '{"sub":"26000000-0000-4000-8000-000000000001","role":"authenticated"}', true);

select ok(
  exists (
    select 1 from public.admin_list_account_suspension_appeals('pending')
    where user_id = '26000000-0000-4000-8000-000000000002'
      and appeal_status = 'pending'
  ),
  'administrators can retrieve the pending appeal queue through a scoped RPC'
);


set local role authenticated;
select set_config('request.jwt.claim.sub', '26000000-0000-4000-8000-000000000001', true);
select set_config('request.jwt.claims', '{"sub":"26000000-0000-4000-8000-000000000001","role":"authenticated"}', true);

select lives_ok(
  $$select public.admin_review_account_suspension_appeal(
    (select id from public.account_suspension_appeals
      where user_id = '26000000-0000-4000-8000-000000000002'),
    'accepted',
    'The evidence review confirmed the suspension was mistaken.'
  )$$,
  'an administrator can accept and resolve the appeal'
);

reset role;

select is(
  (select is_banned from public.profiles where id = '26000000-0000-4000-8000-000000000002'),
  false,
  'an accepted appeal restores the account'
);

select ok(
  exists (
    select 1 from public.account_suspensions
    where user_id = '26000000-0000-4000-8000-000000000002'
      and status = 'lifted' and lifted_by = '26000000-0000-4000-8000-000000000001'
  )
  and exists (
    select 1 from public.notifications
    where user_id = '26000000-0000-4000-8000-000000000002'
      and type = 'account_reinstated'
  )
  and exists (
    select 1 from public.audit_logs
    where actor_id = '26000000-0000-4000-8000-000000000001'
      and action = 'account.suspension_appeal_reviewed'
  ),
  'appeal acceptance records reinstatement, audit history, and user notification'
);

select * from finish();
rollback;
