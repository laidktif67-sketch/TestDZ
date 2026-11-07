begin;

select plan(21);

select ok(to_regclass('auth.users') is not null, 'Supabase Auth users table exists');
select has_table('storage', 'buckets', 'Supabase Storage buckets table exists');
select has_table('storage', 'objects', 'Supabase Storage objects table exists');

select has_table('public', 'profiles', 'profiles table exists');
select has_table('public', 'apps', 'apps table exists');
select has_table('public', 'tests', 'tests table exists');
select has_table('public', 'cohorts', 'cohorts table exists');
select has_table('public', 'assignments', 'assignments table exists');
select has_table('public', 'feedback', 'feedback table exists');

select ok(to_regprocedure('private.is_admin()') is not null, 'private.is_admin() exists');
select ok(to_regprocedure('private.handle_new_auth_user()') is not null, 'Auth profile trigger function exists');
select ok(to_regprocedure('public.create_app(text,text,text,text)') is not null, 'public.create_app RPC exists');

select ok((select relrowsecurity from pg_class where oid = 'public.profiles'::regclass), 'RLS enabled on profiles');
select ok((select relrowsecurity from pg_class where oid = 'public.apps'::regclass), 'RLS enabled on apps');
select ok((select relrowsecurity from pg_class where oid = 'public.tests'::regclass), 'RLS enabled on tests');
select ok((select relrowsecurity from pg_class where oid = 'public.cohorts'::regclass), 'RLS enabled on cohorts');
select ok((select relrowsecurity from pg_class where oid = 'public.assignments'::regclass), 'RLS enabled on assignments');
select ok((select relrowsecurity from pg_class where oid = 'public.feedback'::regclass), 'RLS enabled on feedback');

select ok(has_table_privilege('authenticated', 'public.cohorts', 'SELECT'), 'authenticated can SELECT cohorts');
select ok(not has_table_privilege('authenticated', 'public.cohorts', 'INSERT'), 'authenticated cannot INSERT cohorts directly');
select ok(has_table_privilege('authenticated', 'public.assignments', 'SELECT'), 'authenticated can SELECT assignments');

select * from finish();

rollback;
