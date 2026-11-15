begin;

select plan(5);

select ok(
  not has_table_privilege('anon','public.test_steps','SELECT')
  and not has_table_privilege('anon','public.test_steps','INSERT')
  and not has_table_privilege('anon','public.test_requirements','SELECT')
  and not has_table_privilege('anon','public.test_requirements','INSERT')
  and not has_table_privilege('anon','public.test_media','SELECT')
  and not has_table_privilege('anon','public.test_media','INSERT'),
  'anon has no read or write privileges on test detail tables'
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
  not has_table_privilege('authenticated','public.test_steps','TRUNCATE')
  and not has_table_privilege('authenticated','public.test_steps','TRIGGER')
  and not has_table_privilege('authenticated','public.test_steps','REFERENCES')
  and not has_table_privilege('authenticated','public.test_requirements','TRUNCATE')
  and not has_table_privilege('authenticated','public.test_requirements','TRIGGER')
  and not has_table_privilege('authenticated','public.test_requirements','REFERENCES')
  and not has_table_privilege('authenticated','public.test_media','TRUNCATE')
  and not has_table_privilege('authenticated','public.test_media','TRIGGER')
  and not has_table_privilege('authenticated','public.test_media','REFERENCES'),
  'authenticated lacks elevated table privileges on test detail tables'
);

select * from finish();

rollback;
