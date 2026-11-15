-- C1: Protect test creation and enforce app/developer ownership.
--
-- The original tests table granted broad INSERT/UPDATE to authenticated and
-- only checked developer_id = auth.uid(). A developer could therefore create a
-- test against another developer's app, and clients could write lifecycle
-- columns directly. This migration:
--   1. removes broad table writes;
--   2. grants only developer-authored columns;
--   3. requires the caller to own the referenced app and hold developer role;
--   4. adds a composite foreign key as defense in depth.
--
-- The FK is added NOT VALID so existing mismatched rows do not block rollout.
-- New writes are still checked by the FK immediately.

begin;

-- Existing data may contain the mismatch this migration prevents. Do not fail
-- the rollout; surface the count for follow-up reconciliation.
do $$
declare
  v_mismatch_count integer;
begin
  select count(*)::integer
    into v_mismatch_count
  from public.tests t
  join public.apps a on a.id = t.app_id
  where a.developer_id <> t.developer_id;

  if v_mismatch_count > 0 then
    raise warning
      'C1: % existing test row(s) have app/developer mismatch; FK will be added NOT VALID',
      v_mismatch_count;
  end if;
end $$;

-- Broad table-level INSERT/UPDATE allowed clients to set status, ownership,
-- primary keys and timestamps directly.
revoke insert, update on table public.tests from anon, authenticated;

-- Also revoke any pre-existing column-level grants on protected fields. This
-- keeps the boundary safe if an earlier branch granted columns separately.
revoke insert (id, status, created_at, updated_at)
  on table public.tests from anon, authenticated;
revoke update (id, app_id, developer_id, status, created_at, updated_at)
  on table public.tests from anon, authenticated;

-- Creation fields. status, id, created_at and updated_at are intentionally
-- excluded; lifecycle transitions remain trusted-server responsibilities.
grant insert (
  app_id,
  developer_id,
  title,
  description,
  min_testers,
  start_date,
  end_date
) on table public.tests to authenticated;

-- Editable developer-authored fields. app_id/developer_id are immutable
-- through the client API.
grant update (
  title,
  description,
  min_testers,
  start_date,
  end_date
) on table public.tests to authenticated;

-- RLS still applies on top of column privileges. A non-admin must own both
-- the test row and the referenced app, and must hold the developer role.
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
      and exists (
        select 1
        from public.user_roles ur
        where ur.user_id = (select auth.uid())
          and ur.role = 'developer'
      )
    )
  );

drop policy if exists tests_update_owner on public.tests;
create policy tests_update_owner on public.tests
  for update to authenticated
  using (
    (select private.is_admin())
    or (
      developer_id = (select auth.uid())
      and exists (
        select 1
        from public.apps a
        where a.id = tests.app_id
          and a.developer_id = (select auth.uid())
      )
      and exists (
        select 1
        from public.user_roles ur
        where ur.user_id = (select auth.uid())
          and ur.role = 'developer'
      )
    )
  )
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
      and exists (
        select 1
        from public.user_roles ur
        where ur.user_id = (select auth.uid())
          and ur.role = 'developer'
      )
    )
  );

-- Defense in depth: the pair (app_id, developer_id) must exist in apps.
-- id is already unique; this composite unique key lets the FK enforce the pair.
alter table public.apps
  add constraint apps_id_developer_unique unique (id, developer_id);

alter table public.tests
  add constraint tests_app_developer_fk
  foreign key (app_id, developer_id)
  references public.apps (id, developer_id)
  not valid;

commit;
