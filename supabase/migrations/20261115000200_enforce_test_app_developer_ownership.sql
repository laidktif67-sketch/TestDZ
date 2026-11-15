-- Ensure a test cycle always belongs to an app owned by the same developer.
-- Admins retain server/admin management capability.
begin;

drop policy if exists tests_insert_owner on public.tests;
create policy tests_insert_owner on public.tests
  for insert to authenticated
  with check (
    (select private.is_admin())
    or (
      developer_id = (select auth.uid())
      and exists (
        select 1
        from public.apps a
        where a.id = tests.app_id
          and a.developer_id = (select auth.uid())
      )
    )
  );

drop policy if exists tests_update_owner on public.tests;
create policy tests_update_owner on public.tests
  for update to authenticated
  using (developer_id = (select auth.uid()) or (select private.is_admin()))
  with check (
    (select private.is_admin())
    or (
      developer_id = (select auth.uid())
      and exists (
        select 1
        from public.apps a
        where a.id = tests.app_id
          and a.developer_id = (select auth.uid())
      )
    )
  );

commit;
