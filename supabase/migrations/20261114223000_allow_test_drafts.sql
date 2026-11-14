-- Allow a developer to save a draft without weakening app ownership or role checks.
begin;

drop policy if exists tests_insert_owner on public.tests;

create policy tests_insert_owner
  on public.tests
  for insert
  to authenticated
  with check (
    status in ('draft', 'recruiting')
    and exists (
      select 1
      from public.apps a
      where a.id = tests.app_id
        and a.developer_id = tests.developer_id
    )
    and (
      developer_id = (select auth.uid())
      or (select private.is_admin())
    )
  );

commit;
