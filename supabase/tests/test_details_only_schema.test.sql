begin;

select plan(10);

select ok(
  (select count(*) = 7 from information_schema.columns
   where table_schema='public' and table_name='tests'
     and column_name = any(array[
       'short_summary','estimated_duration_minutes','android_min_api',
       'android_max_api','device_requirements','eligibility_criteria','tester_instructions'
     ])),
  'all seven structured Test Details columns exist'
);

select has_table('public', 'test_steps', 'test steps table exists');
select has_table('public', 'test_requirements', 'test requirements table exists');
select has_table('public', 'test_media', 'test media table exists');

select ok(
  (select count(*) = 6 from pg_constraint
   where conrelid='public.tests'::regclass
     and conname = any(array[
       'tests_short_summary_length','tests_estimated_duration_range',
       'tests_android_api_range','tests_device_requirements_object',
       'tests_eligibility_criteria_array','tests_tester_instructions_length'
     ])),
  'metadata validation constraints exist'
);

select ok(
  (select count(*) = 3 from pg_class c
   join pg_namespace n on n.oid=c.relnamespace
   where n.nspname='public' and c.relname = any(array['test_steps','test_requirements','test_media'])
     and c.relrowsecurity),
  'RLS is enabled on all three new public tables'
);

select ok(
  (select count(*) = 6 from pg_policies
   where schemaname='public'
     and tablename = any(array['test_steps','test_requirements','test_media'])
     and policyname = any(array[
       'test_steps_select_visible_test','test_steps_manage_owner',
       'test_requirements_select_visible_test','test_requirements_manage_owner',
       'test_media_select_visible_test','test_media_manage_owner'
     ])),
  'all six owner/admin and visible-test policies exist'
);

select ok(
  has_table_privilege('authenticated','public.test_steps','SELECT')
  and has_table_privilege('authenticated','public.test_steps','INSERT')
  and has_table_privilege('authenticated','public.test_requirements','UPDATE')
  and has_table_privilege('authenticated','public.test_media','DELETE'),
  'authenticated role has the intended table privileges, still restricted by RLS'
);

select ok(
  exists (select 1 from pg_constraint where conrelid='public.test_steps'::regclass and contype='f')
  and exists (select 1 from pg_constraint where conrelid='public.test_requirements'::regclass and contype='f')
  and exists (select 1 from pg_constraint where conrelid='public.test_media'::regclass and contype='f'),
  'each detail table references its parent test'
);

select ok(
  exists (select 1 from pg_indexes where schemaname='public' and indexname='test_steps_test_order_idx')
  and exists (select 1 from pg_indexes where schemaname='public' and indexname='test_requirements_test_order_idx')
  and exists (select 1 from pg_indexes where schemaname='public' and indexname='test_media_test_order_idx'),
  'ordered detail lookups have supporting indexes'
);

select * from finish();
rollback;
