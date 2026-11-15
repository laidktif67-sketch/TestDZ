begin;

select plan(14);

-- Table-level writes must be closed; column grants are the only client write path.
select ok(
  not has_table_privilege('authenticated', 'public.tests', 'INSERT'),
  'authenticated has no table-level INSERT on tests'
);

select ok(
  not has_table_privilege('authenticated', 'public.tests', 'UPDATE'),
  'authenticated has no table-level UPDATE on tests'
);

-- Allowed creation columns.
select ok(
  has_column_privilege('authenticated', 'public.tests', 'app_id', 'INSERT')
  and has_column_privilege('authenticated', 'public.tests', 'developer_id', 'INSERT')
  and has_column_privilege('authenticated', 'public.tests', 'title', 'INSERT')
  and has_column_privilege('authenticated', 'public.tests', 'description', 'INSERT')
  and has_column_privilege('authenticated', 'public.tests', 'min_testers', 'INSERT')
  and has_column_privilege('authenticated', 'public.tests', 'start_date', 'INSERT')
  and has_column_privilege('authenticated', 'public.tests', 'end_date', 'INSERT'),
  'authenticated can insert developer-authored test fields'
);

-- Lifecycle and system-managed columns must not be client-writable on insert.
select ok(
  not has_column_privilege('authenticated', 'public.tests', 'status', 'INSERT')
  and not has_column_privilege('authenticated', 'public.tests', 'id', 'INSERT')
  and not has_column_privilege('authenticated', 'public.tests', 'created_at', 'INSERT')
  and not has_column_privilege('authenticated', 'public.tests', 'updated_at', 'INSERT'),
  'authenticated cannot insert status or system-managed test fields'
);

-- Allowed update columns.
select ok(
  has_column_privilege('authenticated', 'public.tests', 'title', 'UPDATE')
  and has_column_privilege('authenticated', 'public.tests', 'description', 'UPDATE')
  and has_column_privilege('authenticated', 'public.tests', 'min_testers', 'UPDATE')
  and has_column_privilege('authenticated', 'public.tests', 'start_date', 'UPDATE')
  and has_column_privilege('authenticated', 'public.tests', 'end_date', 'UPDATE'),
  'authenticated can update developer-authored test fields'
);

-- Ownership, lifecycle and system-managed columns must not be client-updatable.
select ok(
  not has_column_privilege('authenticated', 'public.tests', 'app_id', 'UPDATE')
  and not has_column_privilege('authenticated', 'public.tests', 'developer_id', 'UPDATE')
  and not has_column_privilege('authenticated', 'public.tests', 'status', 'UPDATE')
  and not has_column_privilege('authenticated', 'public.tests', 'id', 'UPDATE')
  and not has_column_privilege('authenticated', 'public.tests', 'created_at', 'UPDATE')
  and not has_column_privilege('authenticated', 'public.tests', 'updated_at', 'UPDATE'),
  'authenticated cannot update ownership, status or system-managed test fields'
);

-- The insert policy must enforce both app ownership and developer role.
select ok(
  exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'tests'
      and policyname = 'tests_insert_owner'
      and cmd = 'INSERT'
  ),
  'tests_insert_owner policy exists'
);

select like(
  (select with_check from pg_policies
   where schemaname = 'public'
     and tablename = 'tests'
     and policyname = 'tests_insert_owner'),
  '%a.developer_id%',
  'tests insert policy checks referenced app owner'
);

select like(
  (select with_check from pg_policies
   where schemaname = 'public'
     and tablename = 'tests'
     and policyname = 'tests_insert_owner'),
  '%ur.role%',
  'tests insert policy checks developer role'
);

-- The update policy must enforce the same invariants on the resulting row.
select ok(
  exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'tests'
      and policyname = 'tests_update_owner'
      and cmd = 'UPDATE'
  ),
  'tests_update_owner policy exists'
);

select like(
  (select with_check from pg_policies
   where schemaname = 'public'
     and tablename = 'tests'
     and policyname = 'tests_update_owner'),
  '%a.developer_id%',
  'tests update policy checks referenced app owner'
);

select like(
  (select with_check from pg_policies
   where schemaname = 'public'
     and tablename = 'tests'
     and policyname = 'tests_update_owner'),
  '%ur.role%',
  'tests update policy checks developer role'
);

-- Composite FK enforces the same ownership pair at the table layer.
select ok(
  exists (
    select 1
    from pg_constraint c
    where c.conrelid = 'public.tests'::regclass
      and c.conname = 'tests_app_developer_fk'
      and c.contype = 'f'
      and c.confrelid = 'public.apps'::regclass
      and (
        select array_agg(a.attname order by array_position(c.conkey, a.attnum))
        from pg_attribute a
        where a.attrelid = c.conrelid and a.attnum = any (c.conkey)
      ) = array['app_id', 'developer_id']::name[]
      and (
        select array_agg(a.attname order by array_position(c.confkey, a.attnum))
        from pg_attribute a
        where a.attrelid = c.confrelid and a.attnum = any (c.confkey)
      ) = array['id', 'developer_id']::name[]
  ),
  'composite tests(app_id, developer_id) foreign key exists'
);

select ok(
  exists (
    select 1
    from pg_constraint c
    where c.conrelid = 'public.apps'::regclass
      and c.conname = 'apps_id_developer_unique'
      and c.contype = 'u'
  ),
  'apps(id, developer_id) unique key exists for ownership FK'
);

select * from finish();
rollback;
