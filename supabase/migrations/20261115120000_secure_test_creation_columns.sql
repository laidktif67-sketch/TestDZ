-- C1: Keep test creation limited to developer-authored fields.
--
-- The `tests` table already narrows INSERT to business-input columns and
-- `tests_insert_owner` enforces that `developer_id = auth.uid()` and that the
-- referenced app belongs to the same developer. Two gaps remain:
--   1. The six-step wizard writes `test_type`/`test_config`, which were never
--      added to the INSERT allowlist, so draft creation fails.
--   2. Test lifecycle starts at 'recruiting' when `status` is omitted, so a
--      client that stops sending status would silently create a live campaign.
--
-- This migration completes the allowlist without granting lifecycle, identity,
-- or system columns, and makes 'draft' the only implicit starting state.
begin;

alter table public.tests
  alter column status set default 'draft';

revoke insert on table public.tests from anon, authenticated;

grant insert (
  app_id,
  developer_id,
  title,
  description,
  min_testers,
  start_date,
  end_date,
  test_type,
  test_config
) on table public.tests to authenticated;

-- Fail closed if the insert or update allowlists regress.
do $verify$
begin
  if has_table_privilege('authenticated', 'public.tests', 'INSERT')
     or has_table_privilege('authenticated', 'public.tests', 'UPDATE') then
    raise exception 'authenticated must not hold table-level INSERT/UPDATE on public.tests';
  end if;

  if has_column_privilege('authenticated', 'public.tests', 'id', 'INSERT')
     or has_column_privilege('authenticated', 'public.tests', 'status', 'INSERT')
     or has_column_privilege('authenticated', 'public.tests', 'created_at', 'INSERT')
     or has_column_privilege('authenticated', 'public.tests', 'updated_at', 'INSERT') then
    raise exception 'lifecycle/system columns must not be client-insertable on public.tests';
  end if;

  if not has_column_privilege('authenticated', 'public.tests', 'app_id', 'INSERT')
     or not has_column_privilege('authenticated', 'public.tests', 'developer_id', 'INSERT')
     or not has_column_privilege('authenticated', 'public.tests', 'title', 'INSERT')
     or not has_column_privilege('authenticated', 'public.tests', 'test_type', 'INSERT')
     or not has_column_privilege('authenticated', 'public.tests', 'test_config', 'INSERT') then
    raise exception 'developer-authored test columns must remain client-insertable';
  end if;

  if has_column_privilege('authenticated', 'public.tests', 'status', 'UPDATE')
     or has_column_privilege('authenticated', 'public.tests', 'app_id', 'UPDATE')
     or has_column_privilege('authenticated', 'public.tests', 'developer_id', 'UPDATE')
     or has_column_privilege('authenticated', 'public.tests', 'created_at', 'UPDATE')
     or has_column_privilege('authenticated', 'public.tests', 'updated_at', 'UPDATE') then
    raise exception 'lifecycle/ownership/system columns must not be client-updatable on public.tests';
  end if;
end;
$verify$;

commit;
