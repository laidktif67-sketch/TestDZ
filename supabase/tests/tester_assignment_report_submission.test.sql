begin;
select plan(12);
select ok(to_regclass('public.assignment_submissions') is not null,'assignment submissions table exists');
select ok(to_regclass('public.assignment_submission_attachments') is not null,'submission attachments table exists');
select ok((select relrowsecurity from pg_class where oid='public.assignment_submissions'::regclass),'submissions RLS enabled');
select ok((select relrowsecurity from pg_class where oid='public.assignment_submission_attachments'::regclass),'attachments RLS enabled');
select ok(exists(select 1 from pg_policies where schemaname='public' and tablename='assignment_submissions' and policyname='account_not_banned' and permissive='RESTRICTIVE')
  and exists(select 1 from pg_policies where schemaname='public' and tablename='assignment_submission_attachments' and policyname='account_not_banned' and permissive='RESTRICTIVE'),'both new tables enforce suspended-account RLS');
select ok(exists(select 1 from pg_trigger where tgrelid='public.assignment_submissions'::regclass and tgname='reject_banned_account_writes' and not tgisinternal)
  and exists(select 1 from pg_trigger where tgrelid='public.assignment_submission_attachments'::regclass and tgname='reject_banned_account_writes' and not tgisinternal),'both new tables enforce suspended-account write triggers');
select ok(not has_table_privilege('authenticated','public.assignment_submissions','INSERT')
  and not has_table_privilege('authenticated','public.assignment_submission_attachments','INSERT'),'clients cannot directly create submissions or attachment metadata');
select ok(has_function_privilege('authenticated','public.submit_assignment_report(uuid,text,text,jsonb)','EXECUTE')
  and not has_function_privilege('anon','public.submit_assignment_report(uuid,text,text,jsonb)','EXECUTE'),'only authenticated can call submit RPC');
select ok((select prosecdef from pg_proc where oid='public.submit_assignment_report(uuid,text,text,jsonb)'::regprocedure)
  and (select proconfig @> array['search_path=""'] from pg_proc where oid='public.submit_assignment_report(uuid,text,text,jsonb)'::regprocedure),'submit RPC is hardened SECURITY DEFINER');
select ok((select public from storage.buckets where id='assignment-evidence') is false,'evidence bucket is private');
select ok(exists(select 1 from pg_policies where schemaname='storage' and tablename='objects' and policyname='assignment_evidence_insert_owner' and cmd='INSERT')
  and exists(select 1 from pg_policies where schemaname='storage' and tablename='objects' and policyname='assignment_evidence_select_participants' and cmd='SELECT'),'storage upload and read policies exist');
select ok(pg_get_functiondef('public.submit_assignment_report(uuid,text,text,jsonb)'::regprocedure) like '%ACTIVE_ASSIGNMENT_NOT_FOUND%'
  and pg_get_functiondef('public.submit_assignment_report(uuid,text,text,jsonb)'::regprocedure) like '%ASSIGNMENT_REPORT_ALREADY_SUBMITTED%'
  and pg_get_functiondef('public.submit_assignment_report(uuid,text,text,jsonb)'::regprocedure) like '%REPORT_EVIDENCE_INVALID%','RPC checks assignment, duplicate submission and evidence');
select * from finish();
rollback;
