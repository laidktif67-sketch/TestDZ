begin;

select plan(4);

select ok(
  exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'tests'
      and policyname = 'tests_insert_owner'
      and cmd = 'INSERT'
  ),
  'tests INSERT policy exists'
);

select like(
  (select with_check from pg_policies
   where schemaname = 'public'
     and tablename = 'tests'
     and policyname = 'tests_insert_owner'),
  '%a.developer_id%',
  'tests INSERT policy verifies app developer ownership'
);

select ok(
  exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'tests'
      and policyname = 'tests_update_owner'
      and cmd = 'UPDATE'
  ),
  'tests UPDATE policy exists'
);

select like(
  (select with_check from pg_policies
   where schemaname = 'public'
     and tablename = 'tests'
     and policyname = 'tests_update_owner'),
  '%a.developer_id%',
  'tests UPDATE policy verifies app developer ownership'
);

select * from finish();

rollback;
