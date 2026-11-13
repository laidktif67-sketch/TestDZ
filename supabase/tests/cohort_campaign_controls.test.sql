begin;

select plan(6);

select ok(
  has_column_privilege('authenticated', 'public.cohort_tests', 'is_active', 'UPDATE'),
  'authenticated users can update the recruitment active flag'
);

select ok(
  not has_column_privilege('authenticated', 'public.cohort_tests', 'developer_id', 'UPDATE')
  and not has_column_privilege('authenticated', 'public.cohort_tests', 'test_id', 'UPDATE')
  and not has_column_privilege('authenticated', 'public.cohort_tests', 'cohort_id', 'UPDATE'),
  'authenticated users cannot change cohort ownership or membership keys'
);

select ok(
  exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'cohort_tests'
      and policyname = 'cohort_tests_update_developer_recruitment'
      and cmd = 'UPDATE'
      and qual like '%developer_id%'
      and qual like '%auth.uid%'
      and with_check like '%developer_id%'
      and with_check like '%auth.uid%'
      and with_check like '%private.is_admin%'
  ),
  'only the owning developer or an admin can pause or resume recruitment'
);

select ok(
  exists (
    select 1 from pg_trigger
    where tgrelid = 'public.cohort_tests'::regclass
      and tgname = 'trg_cohort_tests_validate_is_active_update'
      and not tgisinternal
      and (tgtype & 2) = 2
      and (tgtype & 16) = 16
  ),
  'cohort test active-state changes are checked by a BEFORE UPDATE trigger'
);

select ok(
  pg_get_functiondef('private.cohort_tests_validate_is_active_update()'::regprocedure)
    like '%completed%' and
  pg_get_functiondef('private.cohort_tests_validate_is_active_update()'::regprocedure)
    like '%cancelled%' and
  pg_get_functiondef('private.cohort_tests_validate_is_active_update()'::regprocedure)
    like '%new.is_active%',
  'a test cannot be resumed after its cohort is completed or cancelled'
);

select ok(
  pg_get_functiondef('private.cohorts_sync_is_active()'::regprocedure)
    like '%set is_active = false%' and
  pg_get_functiondef('private.cohorts_sync_is_active()'::regprocedure)
    like '%completed%' and
  pg_get_functiondef('private.cohorts_sync_is_active()'::regprocedure)
    like '%cancelled%',
  'cohort closure disables tests without undoing individual pauses during active transitions'
);

select * from finish();

rollback;
