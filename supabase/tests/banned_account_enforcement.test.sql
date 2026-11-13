begin;

select plan(8);

insert into auth.users (
  id, instance_id, aud, role, email, encrypted_password,
  email_confirmed_at, raw_app_meta_data, raw_user_meta_data,
  created_at, updated_at
) values (
  '24000000-0000-4000-8000-000000000001',
  '00000000-0000-0000-0000-000000000000',
  'authenticated', 'authenticated',
  'banned-account@example.test', '',
  now(), '{}', '{}', now(), now()
)
on conflict (id) do nothing;

insert into public.profiles (id, display_name, is_banned)
values (
  '24000000-0000-4000-8000-000000000001',
  'Banned Account',
  true
)
on conflict (id) do update set is_banned = true;

insert into public.user_roles (user_id, role)
values ('24000000-0000-4000-8000-000000000001', 'tester')
on conflict (user_id, role) do nothing;

insert into public.support_tickets (
  id, user_id, requester_role, subject, category, description
) values (
  '25000000-0000-4000-8000-000000000001',
  '24000000-0000-4000-8000-000000000001',
  'tester',
  'Banned account fixture',
  'technical',
  'A pre-existing ticket used to verify suspended-account access.'
);

select ok(
  to_regprocedure('private.is_current_user_banned()') is not null,
  'database exposes a private current-account suspension predicate'
);

select ok(
  exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'support_tickets'
      and policyname = 'account_not_banned'
      and permissive = 'RESTRICTIVE'
      and roles @> array['authenticated']::name[]
  ),
  'suspension policy is restrictive and composes with existing ticket policies'
);

select ok(
  exists (
    select 1 from pg_trigger
    where tgrelid = 'public.support_tickets'::regclass
      and tgname = 'reject_banned_account_writes'
      and not tgisinternal
  ),
  'write guard is attached to the support ticket table'
);

set local role authenticated;
select set_config(
  'request.jwt.claim.sub',
  '24000000-0000-4000-8000-000000000001',
  true
);
select set_config(
  'request.jwt.claims',
  '{"sub":"24000000-0000-4000-8000-000000000001","role":"authenticated"}',
  true
);

select is(
  (select is_banned from public.profiles
   where id = '24000000-0000-4000-8000-000000000001'),
  true,
  'suspended user can read their own suspension status'
);

select is(
  (select count(*)::int from public.support_tickets
   where id = '25000000-0000-4000-8000-000000000001'),
  0,
  'suspended user cannot read their own support ticket'
);

select throws_ok(
  $$insert into public.support_tickets (
      user_id, requester_role, subject, category, description
    ) values (
      '24000000-0000-4000-8000-000000000001',
      'tester',
      'Blocked while suspended',
      'technical',
      'Suspended accounts must not create support tickets.'
    )$$,
  '42501', null,
  'suspended user cannot create new support tickets'
);

select throws_ok(
  $$update public.profiles
    set display_name = 'Attempted self reactivation'
    where id = '24000000-0000-4000-8000-000000000001'$$,
  '42501', null,
  'suspended user cannot update their own profile to bypass suspension'
);

select ok(
  not has_function_privilege(
    'anon',
    'private.is_current_user_banned()',
    'EXECUTE'
  ),
  'anonymous clients cannot call the suspension predicate'
);

reset role;
select * from finish();
rollback;
