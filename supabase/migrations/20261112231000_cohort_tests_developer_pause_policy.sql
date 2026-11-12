-- Allow campaign owners to pause or resume recruitment without exposing other cohort fields.
begin;

grant update (is_active) on public.cohort_tests to authenticated;

drop policy if exists cohort_tests_update_developer_recruitment on public.cohort_tests;
create policy cohort_tests_update_developer_recruitment
  on public.cohort_tests
  for update
  to authenticated
  using (
    developer_id = (select auth.uid())
    or (select private.is_admin())
  )
  with check (
    developer_id = (select auth.uid())
    or (select private.is_admin())
  );

commit;
