begin;

select plan(3);

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

select * from finish();

rollback;
