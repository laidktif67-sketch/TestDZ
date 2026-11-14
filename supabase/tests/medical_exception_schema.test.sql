begin;

select plan(11);

select ok(
  exists (
    select 1 from information_schema.columns
    where table_schema = 'public'
      and table_name = 'medical_exception_requests'
      and column_name = 'requested_dates'
      and data_type = 'ARRAY'
      and udt_name = '_date'
  ),
  'medical exception requests store explicit date arrays'
);

select ok(
  exists (
    select 1 from information_schema.columns
    where table_schema = 'public'
      and table_name = 'medical_exception_requests'
      and column_name = 'evidence_storage_path'
      and data_type = 'text'
  ),
  'medical exception requests expose the typed evidence path column'
);

select ok(
  exists (
    select 1 from information_schema.columns
    where table_schema = 'public'
      and table_name = 'medical_exception_requests'
      and column_name = 'requested_days'
      and is_nullable = 'NO'
  ),
  'legacy requested day counts remain preserved and required'
);

select ok(
  exists (
    select 1 from pg_constraint
    where conrelid = 'public.medical_exception_requests'::regclass
      and conname = 'medical_exception_requested_dates_consistency'
  ),
  'requested dates are constrained to a one-dimensional matching day count'
);

select ok(
  exists (
    select 1 from pg_constraint
    where conrelid = 'public.medical_exception_requests'::regclass
      and conname = 'medical_exception_evidence_storage_path_check'
  ),
  'evidence storage paths reject empty, absolute, and parent traversal paths'
);

select ok(
  exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'medical_exception_requests'
      and policyname = 'medical_exception_requests_insert_owner'
      and with_check like '%requested_dates%'
      and with_check like '%Africa/Algiers%'
      and with_check like '%active%'
  ),
  'new medical requests require explicit valid dates on an active assignment'
);

select ok(
  pg_get_functiondef(
    'private.review_medical_exception(uuid,text,text)'::regprocedure
  ) like '%REQUESTED_DATES_REQUIRED%',
  'legacy count-only requests cannot be approved without supplied dates'
);

select ok(
  pg_get_functiondef(
    'private.review_medical_exception(uuid,text,text)'::regprocedure
  ) like '%Africa/Algiers%',
  'medical date validation uses the TestDZ operating timezone'
);

select ok(
  has_function_privilege(
    'authenticated',
    'public.review_medical_exception(uuid,text,text)',
    'EXECUTE'
  )
  and not has_function_privilege(
    'anon',
    'public.review_medical_exception(uuid,text,text)',
    'EXECUTE'
  ),
  'only authenticated callers can reach the admin-guarded review RPC'
);

select ok(
  pg_get_functiondef(
    'private.review_medical_exception(uuid,text,text)'::regprocedure
  ) like '%audit_logs%'
  and pg_get_functiondef(
    'private.review_medical_exception(uuid,text,text)'::regprocedure
  ) like '%notifications%',
  'medical review decisions retain audit logging and tester notifications'
);

select ok(
  pg_get_functiondef(
    'private.review_medical_exception(uuid,text,text)'::regprocedure
  ) like '%recipient_role%'
  and pg_get_functiondef(
    'private.review_medical_exception(uuid,text,text)'::regprocedure
  ) like '%tester%',
  'medical review notifications explicitly target the tester feed'
);

select * from finish();
rollback;
