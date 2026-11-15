begin;

select plan(5);

select ok(
  (
    select bool_and(not has_table_privilege('anon', t.table_name, p.privilege))
    from unnest(array[
      'public.test_steps',
      'public.test_requirements',
      'public.test_media'
    ]) as t(table_name)
    cross join unnest(array[
      'SELECT','INSERT','UPDATE','DELETE','TRUNCATE','REFERENCES','TRIGGER'
    ]) as p(privilege)
  ),
  'anon has no table privileges on test detail tables'
);

select ok(
  has_table_privilege('authenticated','public.test_steps','SELECT')
  and has_table_privilege('authenticated','public.test_steps','INSERT')
  and has_table_privilege('authenticated','public.test_steps','UPDATE')
  and has_table_privilege('authenticated','public.test_steps','DELETE'),
  'authenticated has intended CRUD privileges on test_steps'
);

select ok(
  has_table_privilege('authenticated','public.test_requirements','SELECT')
  and has_table_privilege('authenticated','public.test_requirements','INSERT')
  and has_table_privilege('authenticated','public.test_requirements','UPDATE')
  and has_table_privilege('authenticated','public.test_requirements','DELETE'),
  'authenticated has intended CRUD privileges on test_requirements'
);

select ok(
  has_table_privilege('authenticated','public.test_media','SELECT')
  and has_table_privilege('authenticated','public.test_media','INSERT')
  and has_table_privilege('authenticated','public.test_media','UPDATE')
  and has_table_privilege('authenticated','public.test_media','DELETE'),
  'authenticated has intended CRUD privileges on test_media'
);

select ok(
  (
    select bool_and(not has_table_privilege('authenticated', t.table_name, p.privilege))
    from unnest(array[
      'public.test_steps',
      'public.test_requirements',
      'public.test_media'
    ]) as t(table_name)
    cross join unnest(array['TRUNCATE','REFERENCES','TRIGGER']) as p(privilege)
  ),
  'authenticated lacks elevated table privileges on test detail tables'
);

select * from finish();

rollback;
