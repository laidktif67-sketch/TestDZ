begin;

select plan(8);

select ok(
  to_regprocedure('public.submit_assignment_checkin(uuid,text)') is not null,
  'the server-authoritative check-in RPC exists'
);

select ok(
  has_function_privilege('authenticated', 'public.submit_assignment_checkin(uuid,text)', 'EXECUTE')
  and not has_function_privilege('anon', 'public.submit_assignment_checkin(uuid,text)', 'EXECUTE')
  and not has_function_privilege('public', 'public.submit_assignment_checkin(uuid,text)', 'EXECUTE'),
  'only authenticated sessions can execute the check-in RPC'
);

select ok(
  not has_table_privilege('authenticated', 'public.checkins', 'INSERT')
  and not has_table_privilege('anon', 'public.checkins', 'INSERT'),
  'direct client inserts into checkins are revoked'
);

select ok(
  not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'checkins'
      and cmd = 'INSERT'
      and roles @> array['authenticated']::name[]
  ),
  'the old direct tester insert policy is removed'
);

select ok(
  (select prosecdef from pg_proc where oid = 'public.submit_assignment_checkin(uuid,text)'::regprocedure)
  and (select proconfig @> array['search_path=""'] from pg_proc
       where oid = 'public.submit_assignment_checkin(uuid,text)'::regprocedure),
  'the RPC is SECURITY DEFINER with an empty fixed search_path'
);

select ok(
  pg_get_functiondef('public.submit_assignment_checkin(uuid,text)'::regprocedure)
    like '%Africa/Algiers%'
  and pg_get_functiondef('public.submit_assignment_checkin(uuid,text)'::regprocedure)
    like '%clock_timestamp%',
  'the check-in date comes from the database clock in Algeria timezone'
);

select ok(
  pg_get_functiondef('public.submit_assignment_checkin(uuid,text)'::regprocedure)
    like '%ASSIGNMENT_NOT_ACTIVE%'
  and pg_get_functiondef('public.submit_assignment_checkin(uuid,text)'::regprocedure)
    like '%ASSIGNMENT_NOT_FOUND%',
  'the RPC validates assignment ownership and active status'
);

select ok(
  pg_get_functiondef('public.submit_assignment_checkin(uuid,text)'::regprocedure)
    like '%CHECKIN_ALREADY_RECORDED%'
  and pg_get_functiondef('public.submit_assignment_checkin(uuid,text)'::regprocedure)
    like '%checkin:%'
  and pg_get_functiondef('public.submit_assignment_checkin(uuid,text)'::regprocedure)
    like '%earned_points%',
  'duplicate check-ins are rejected and the reward is ledger-backed'
);

select * from finish();
rollback;
