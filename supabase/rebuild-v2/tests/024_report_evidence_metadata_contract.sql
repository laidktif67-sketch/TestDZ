-- Report evidence must have a trusted, exact metadata registration before
-- Storage upload. Assignment-submission evidence remains covered by contract 007.
-- Disposable local database only; all fixtures are rolled back.
BEGIN;

INSERT INTO auth.users
  (id,aud,role,email,encrypted_password,email_confirmed_at,raw_app_meta_data,raw_user_meta_data,created_at,updated_at)
VALUES
  ('92400000-0000-4000-8000-000000000001','authenticated','authenticated','v2-report-evidence-dev@example.invalid','',now(),'{ "provider":"email","providers":["email"] }'::jsonb,'{"name":"Evidence Developer"}'::jsonb,now(),now()),
  ('92400000-0000-4000-8000-000000000002','authenticated','authenticated','v2-report-evidence-tester@example.invalid','',now(),'{ "provider":"email","providers":["email"] }'::jsonb,'{"name":"Evidence Tester"}'::jsonb,now(),now()),
  ('92400000-0000-4000-8000-000000000003','authenticated','authenticated','v2-report-evidence-outsider@example.invalid','',now(),'{ "provider":"email","providers":["email"] }'::jsonb,'{"name":"Evidence Outsider"}'::jsonb,now(),now()),
  ('92400000-0000-4000-8000-000000000004','authenticated','authenticated','v2-report-evidence-support@example.invalid','',now(),'{ "provider":"email","providers":["email"] }'::jsonb,'{"name":"Evidence Support"}'::jsonb,now(),now()),
  ('92400000-0000-4000-8000-000000000005','authenticated','authenticated','v2-report-evidence-financial@example.invalid','',now(),'{ "provider":"email","providers":["email"] }'::jsonb,'{"name":"Evidence Financial"}'::jsonb,now(),now());

INSERT INTO rebuild_v2.user_roles(user_id,role)
VALUES
  ('92400000-0000-4000-8000-000000000001','developer'),
  ('92400000-0000-4000-8000-000000000004','support'),
  ('92400000-0000-4000-8000-000000000005','financial');

INSERT INTO rebuild_v2.apps(developer_id,name,package_name,description,category,status)
VALUES (
  '92400000-0000-4000-8000-000000000001',
  'Report Evidence Contract App','com.testdz.report.evidence.contract',
  'Synthetic app used only inside a rolled-back contract.','tools','published'
);

INSERT INTO rebuild_v2.tests(app_id,developer_id,title,description,status,min_testers,start_date,end_date)
SELECT a.id,a.developer_id,'Report Evidence Contract Test','Synthetic report evidence test.',
  'running',1,CURRENT_DATE,CURRENT_DATE+3
FROM rebuild_v2.apps a
WHERE a.package_name='com.testdz.report.evidence.contract';

INSERT INTO rebuild_v2.cohorts(name,capacity,status,created_by,starts_at,ends_at)
VALUES (
  'Report Evidence Contract Cohort',1,'running',
  '92400000-0000-4000-8000-000000000001',now()-interval '1 hour',now()+interval '3 days'
);

INSERT INTO rebuild_v2.cohort_tests(cohort_id,test_id,developer_id)
SELECT c.id,t.id,t.developer_id
FROM rebuild_v2.cohorts c
CROSS JOIN rebuild_v2.tests t
WHERE c.name='Report Evidence Contract Cohort'
  AND t.title='Report Evidence Contract Test';

INSERT INTO rebuild_v2.assignments(id,cohort_id,test_id,tester_id,status,started_at)
SELECT
  '92400000-0000-4000-8000-000000000101',ct.cohort_id,ct.test_id,
  '92400000-0000-4000-8000-000000000002','active',now()-interval '1 hour'
FROM rebuild_v2.cohort_tests ct
JOIN rebuild_v2.tests t ON t.id=ct.test_id
WHERE t.title='Report Evidence Contract Test';

INSERT INTO rebuild_v2.reports
  (id,reporter_id,reported_user_id,assignment_id,report_type,description,status)
VALUES (
  '92400000-0000-4000-8000-000000000201',
  '92400000-0000-4000-8000-000000000002',
  '92400000-0000-4000-8000-000000000001',
  '92400000-0000-4000-8000-000000000101',
  'other',
  'Synthetic report used to verify pre-registered evidence upload boundaries.',
  'open'
);

DO $assert_no_direct_metadata_write$
BEGIN
  IF has_table_privilege('authenticated','rebuild_v2.report_attachments','INSERT')
     OR has_table_privilege('authenticated','rebuild_v2.report_attachments','UPDATE')
     OR has_table_privilege('authenticated','rebuild_v2.report_attachments','DELETE') THEN
    RAISE EXCEPTION 'FAIL: authenticated clients can write report attachment metadata directly';
  END IF;
END;
$assert_no_direct_metadata_write$;

-- Before trusted metadata registration, neither the helper nor Storage INSERT
-- policy may permit an incident-report evidence object.
SET LOCAL ROLE authenticated;
DO $before_registration$
DECLARE
  v_test uuid := (SELECT id FROM rebuild_v2.tests WHERE title='Report Evidence Contract Test');
  v_path text;
BEGIN
  PERFORM set_config('request.jwt.claim.sub','92400000-0000-4000-8000-000000000002',true);
  PERFORM set_config('request.jwt.claims','{"sub":"92400000-0000-4000-8000-000000000002","role":"authenticated"}',true);
  v_path := 'v2/' || v_test::text || '/92400000-0000-4000-8000-000000000002/92400000-0000-4000-8000-000000000201/92400000-0000-4000-8000-000000000301.pdf';

  IF rebuild_v2_private.can_upload_test_evidence(v_path) THEN
    RAISE EXCEPTION 'FAIL: report evidence upload accepted without metadata registration';
  END IF;

  BEGIN
    INSERT INTO storage.objects(bucket_id,name,owner,owner_id,metadata)
    VALUES ('test-evidence',v_path,'92400000-0000-4000-8000-000000000002',
      '92400000-0000-4000-8000-000000000002',
      jsonb_build_object('mimetype','application/pdf','size',1024));
    RAISE EXCEPTION 'FAIL: Storage accepted report evidence before metadata registration';
  EXCEPTION WHEN insufficient_privilege THEN
    NULL;
  END;
END;
$before_registration$;
RESET ROLE;

-- A trusted backend may register metadata. The exact path, file UUID,
-- extension, assignment and reporter must then match before Storage upload.
INSERT INTO rebuild_v2.report_attachments
  (report_id,assignment_id,test_id,tester_id,file_id,file_extension,original_filename,storage_path)
VALUES (
  '92400000-0000-4000-8000-000000000201',
  '92400000-0000-4000-8000-000000000101',
  (SELECT id FROM rebuild_v2.tests WHERE title='Report Evidence Contract Test'),
  '92400000-0000-4000-8000-000000000002',
  '92400000-0000-4000-8000-000000000301',
  'pdf','contract-proof.pdf',
  'v2/' ||
  (SELECT id::text FROM rebuild_v2.tests WHERE title='Report Evidence Contract Test') ||
  '/92400000-0000-4000-8000-000000000002/92400000-0000-4000-8000-000000000201/92400000-0000-4000-8000-000000000301.pdf'
);

SET LOCAL ROLE authenticated;
DO $after_registration$
DECLARE
  v_test uuid := (SELECT id FROM rebuild_v2.tests WHERE title='Report Evidence Contract Test');
  v_path text;
BEGIN
  PERFORM set_config('request.jwt.claim.sub','92400000-0000-4000-8000-000000000002',true);
  PERFORM set_config('request.jwt.claims','{"sub":"92400000-0000-4000-8000-000000000002","role":"authenticated"}',true);
  v_path := 'v2/' || v_test::text || '/92400000-0000-4000-8000-000000000002/92400000-0000-4000-8000-000000000201/92400000-0000-4000-8000-000000000301.pdf';

  IF NOT rebuild_v2_private.can_upload_test_evidence(v_path) THEN
    RAISE EXCEPTION 'FAIL: exact registered report attachment was rejected';
  END IF;
  IF rebuild_v2_private.can_upload_test_evidence(replace(v_path,'000000000301.pdf','000000000302.pdf')) THEN
    RAISE EXCEPTION 'FAIL: helper accepted a file UUID not present in metadata';
  END IF;
  IF rebuild_v2_private.can_upload_test_evidence(replace(v_path,'.pdf','.png')) THEN
    RAISE EXCEPTION 'FAIL: helper accepted an extension that differs from metadata';
  END IF;

  INSERT INTO storage.objects(bucket_id,name,owner,owner_id,metadata)
  VALUES ('test-evidence',v_path,'92400000-0000-4000-8000-000000000002',
    '92400000-0000-4000-8000-000000000002',
    jsonb_build_object('mimetype','application/pdf','size',1024));
  IF (SELECT count(*) FROM storage.objects WHERE bucket_id='test-evidence' AND name=v_path) <> 1 THEN
    RAISE EXCEPTION 'FAIL: registered report evidence object is not visible to its reporter';
  END IF;
END;
$after_registration$;
RESET ROLE;

SET LOCAL ROLE authenticated;
DO $read_role_boundaries$
DECLARE
  v_test uuid := (SELECT id FROM rebuild_v2.tests WHERE title='Report Evidence Contract Test');
  v_path text;
BEGIN
  v_path := 'v2/' || v_test::text || '/92400000-0000-4000-8000-000000000002/92400000-0000-4000-8000-000000000201/92400000-0000-4000-8000-000000000301.pdf';

  PERFORM set_config('request.jwt.claim.sub','92400000-0000-4000-8000-000000000004',true);
  PERFORM set_config('request.jwt.claims','{"sub":"92400000-0000-4000-8000-000000000004","role":"authenticated"}',true);
  IF NOT rebuild_v2_private.can_read_test_evidence(v_path)
     OR (SELECT count(*) FROM storage.objects WHERE bucket_id='test-evidence' AND name=v_path) <> 1 THEN
    RAISE EXCEPTION 'FAIL: Support cannot read report evidence';
  END IF;

  PERFORM set_config('request.jwt.claim.sub','92400000-0000-4000-8000-000000000005',true);
  PERFORM set_config('request.jwt.claims','{"sub":"92400000-0000-4000-8000-000000000005","role":"authenticated"}',true);
  IF rebuild_v2_private.can_read_test_evidence(v_path)
     OR (SELECT count(*) FROM storage.objects WHERE bucket_id='test-evidence' AND name=v_path) <> 0 THEN
    RAISE EXCEPTION 'FAIL: Financial can read Support-only report evidence';
  END IF;

  PERFORM set_config('request.jwt.claim.sub','92400000-0000-4000-8000-000000000003',true);
  PERFORM set_config('request.jwt.claims','{"sub":"92400000-0000-4000-8000-000000000003","role":"authenticated"}',true);
  IF rebuild_v2_private.can_read_test_evidence(v_path)
     OR (SELECT count(*) FROM storage.objects WHERE bucket_id='test-evidence' AND name=v_path) <> 0 THEN
    RAISE EXCEPTION 'FAIL: unrelated user can read report evidence';
  END IF;
END;
$read_role_boundaries$;
RESET ROLE;

ROLLBACK;
SELECT 'rebuild_v2_report_evidence_metadata_contract: PASS' AS result;
