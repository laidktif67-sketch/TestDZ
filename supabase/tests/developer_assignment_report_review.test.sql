begin;
select plan(12);
select ok(to_regprocedure('public.review_assignment_submission(uuid,text,text)') is not null,
  'developer report review RPC exists');
select ok((select prosecdef from pg_proc where oid='public.review_assignment_submission(uuid,text,text)'::regprocedure),
  'review RPC uses SECURITY DEFINER');
select ok((select proconfig @> array['search_path=""'] from pg_proc where oid='public.review_assignment_submission(uuid,text,text)'::regprocedure),
  'review RPC fixes search_path');
select ok(has_function_privilege('authenticated','public.review_assignment_submission(uuid,text,text)','EXECUTE')
  and not has_function_privilege('anon','public.review_assignment_submission(uuid,text,text)','EXECUTE')
  and not has_function_privilege('public','public.review_assignment_submission(uuid,text,text)','EXECUTE'),
  'only authenticated role can execute review RPC');
select ok(pg_get_functiondef('public.review_assignment_submission(uuid,text,text)'::regprocedure) like '%DEVELOPER_NOT_AUTHORIZED%'
  and pg_get_functiondef('public.review_assignment_submission(uuid,text,text)'::regprocedure) like '%private.has_role%',
  'review RPC enforces assigned developer or admin');
select ok(pg_get_functiondef('public.review_assignment_submission(uuid,text,text)'::regprocedure) like '%SUBMISSION_ALREADY_REVIEWED%',
  'review RPC prevents repeat decisions');
select ok(pg_get_functiondef('public.review_assignment_submission(uuid,text,text)'::regprocedure) like '%REJECTION_REASON_REQUIRED%',
  'rejection requires a reason');
select ok(pg_get_functiondef('public.review_assignment_submission(uuid,text,text)'::regprocedure) like '%ASSIGNMENT_FEEDBACK_REQUIRED%',
  'approval requires assignment feedback');
select ok(pg_get_functiondef('public.review_assignment_submission(uuid,text,text)'::regprocedure) like '%ASSIGNMENT_CHECKINS_INCOMPLETE%'
  and pg_get_functiondef('public.review_assignment_submission(uuid,text,text)'::regprocedure) like '%medical_exception_requests%',
  'approval checks 14 required check-ins and approved medical excusals');
select ok(pg_get_functiondef('public.review_assignment_submission(uuid,text,text)'::regprocedure) like '%bonus.assignment_completed%',
  'completion reward is read from platform configuration');
select ok(pg_get_functiondef('public.review_assignment_submission(uuid,text,text)'::regprocedure) like '%assignment_completed:%'
  and pg_get_functiondef('public.review_assignment_submission(uuid,text,text)'::regprocedure) like '%points_ledger%',
  'completion reward uses an idempotent append-only ledger entry');
select ok(pg_get_functiondef('public.review_assignment_submission(uuid,text,text)'::regprocedure) like '%audit_logs%'
  and pg_get_functiondef('public.review_assignment_submission(uuid,text,text)'::regprocedure) like '%notifications%',
  'review decision is audited and notifies the tester');
select * from finish();
rollback;
