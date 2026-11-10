begin;

select plan(7);

select ok(
  to_regprocedure('private.complete_onboarding(text[],jsonb)') is not null,
  'private onboarding function exists'
);

select ok(
  pg_get_functiondef('private.complete_onboarding(text[],jsonb)'::regprocedure)
    LIKE '%having count(*) > 1%',
  'duplicate role selections are rejected'
);

select ok(
  pg_get_functiondef('private.complete_onboarding(text[],jsonb)'::regprocedure)
    LIKE '%if not found%',
  'missing profile row causes an exception'
);

select ok(
  (select p.prosecdef
   from pg_proc p
   where p.oid = 'private.complete_onboarding(text[],jsonb)'::regprocedure),
  'private onboarding function remains SECURITY DEFINER'
);

select ok(
  has_function_privilege('authenticated', 'private.complete_onboarding(text[],jsonb)', 'EXECUTE'),
  'authenticated can execute private onboarding function'
);

select ok(
  not has_function_privilege('anon', 'private.complete_onboarding(text[],jsonb)', 'EXECUTE'),
  'anon cannot execute private onboarding function'
);

select ok(
  not (select p.prosecdef
       from pg_proc p
       where p.oid = 'public.complete_onboarding(text[],jsonb)'::regprocedure),
  'public wrapper remains SECURITY INVOKER'
);

select * from finish();

rollback;
