begin;

select plan(5);

select ok(
  not has_table_privilege('authenticated','public.tests','INSERT')
  and not has_table_privilege('authenticated','public.tests','UPDATE'),
  'authenticated has no broad table-level INSERT or UPDATE grants on tests'
);

select ok(
  has_column_privilege('authenticated','public.tests','app_id','INSERT')
  and has_column_privilege('authenticated','public.tests','developer_id','INSERT')
  and has_column_privilege('authenticated','public.tests','title','INSERT')
  and has_column_privilege('authenticated','public.tests','min_testers','INSERT'),
  'authenticated can insert allowed test fields'
);

select ok(
  not has_column_privilege('authenticated','public.tests','status','INSERT')
  and not has_column_privilege('authenticated','public.tests','id','INSERT')
  and not has_column_privilege('authenticated','public.tests','created_at','INSERT')
  and not has_column_privilege('authenticated','public.tests','updated_at','INSERT'),
  'authenticated cannot set lifecycle status or system-managed fields on insert'
);

select ok(
  has_column_privilege('authenticated','public.tests','title','UPDATE')
  and has_column_privilege('authenticated','public.tests','description','UPDATE')
  and has_column_privilege('authenticated','public.tests','tester_instructions','UPDATE'),
  'authenticated can update allowed developer-authored fields'
);

select ok(
  not has_column_privilege('authenticated','public.tests','status','UPDATE')
  and not has_column_privilege('authenticated','public.tests','app_id','UPDATE')
  and not has_column_privilege('authenticated','public.tests','developer_id','UPDATE')
  and not has_column_privilege('authenticated','public.tests','created_at','UPDATE')
  and not has_column_privilege('authenticated','public.tests','updated_at','UPDATE'),
  'authenticated cannot change lifecycle, ownership, or system-managed fields'
);

select * from finish();

rollback;
