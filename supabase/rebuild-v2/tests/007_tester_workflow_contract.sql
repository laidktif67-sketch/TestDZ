-- Tester workflow V2 contract smoke test.
-- Run ONLY against an isolated disposable FixLab database after 007_tester_workflow.sql.
-- All synthetic Auth users, rows, and Storage metadata are created inside one
-- transaction and rolled back at the end. Never run against Production.

BEGIN;

INSERT INTO auth.users
  (id,aud,role,email,encrypted_password,email_confirmed_at,
   raw_app_meta_data,raw_user_meta_data,created_at,updated_at)
VALUES
  ('10000000-0000-4000-8000-000000000001','authenticated','authenticated','v2-dev-001@example.invalid','',now(),'{"provider":"email","providers":["email"]}'::jsonb,'{"name":"V2 Dev"}'::jsonb,now(),now()),
  ('10000000-0000-4000-8000-000000000002','authenticated','authenticated','v2-tester-001@example.invalid','',now(),'{"provider":"email","providers":["email"]}'::jsonb,'{"name":"V2 Tester"}'::jsonb,now(),now()),
  ('10000000-0000-4000-8000-000000000003','authenticated','authenticated','v2-tester-002@example.invalid','',now(),'{"provider":"email","providers":["email"]}'::jsonb,'{"name":"V2 Tester 2"}'::jsonb,now(),now());

INSERT INTO rebuild_v2.user_roles(user_id,role)
VALUES ('10000000-0000-4000-8000-000000000001','developer');

INSERT INTO rebuild_v2.apps(developer_id,name,package_name,description,category,status)
VALUES (
  '10000000-0000-4000-8000-000000000001',
  'V2 Workflow Test App','com.testdz.v2workflowtest',
  'Synthetic app used only inside a rolled-back FixLab test.','tools','published'
);

INSERT INTO rebuild_v2.tests(
  app_id,developer_id,title,description,status,min_testers,start_date,end_date
)
SELECT a.id,'10000000-0000-4000-8000-000000000001',
  'V2 Workflow Test','Synthetic workflow test','recruiting',1,
  CURRENT_DATE,CURRENT_DATE+3
FROM rebuild_v2.apps a
WHERE a.package_name='com.testdz.v2workflowtest';

INSERT INTO rebuild_v2.cohorts(name,capacity,status,created_by,starts_at,ends_at)
VALUES (
  'V2 Synthetic Cohort',1,'forming',
  '10000000-0000-4000-8000-000000000001',now(),now()+interval '3 days'
);

INSERT INTO rebuild_v2.cohort_tests(cohort_id,test_id,developer_id)
SELECT c.id,t.id,t.developer_id
FROM rebuild_v2.cohorts c
CROSS JOIN rebuild_v2.tests t
WHERE c.name='V2 Synthetic Cohort' AND t.title='V2 Workflow Test';

DO $test$
DECLARE
  v_tester constant uuid := '10000000-0000-4000-8000-000000000002';
  v_other constant uuid := '10000000-0000-4000-8000-000000000003';
  v_test uuid;
  v_assignment uuid;
  v_assignment_again uuid;
  v_checkin uuid;
  v_checkin_again uuid;
  v_feedback uuid;
  v_submission uuid;
  v_submission_again uuid;
  v_path text;
  v_capacity_error text;
  v_file constant uuid := '20000000-0000-4000-8000-000000000001';
BEGIN
  PERFORM set_config('request.jwt.claim.sub',v_tester::text,true);
  PERFORM set_config(
    'request.jwt.claims',
    jsonb_build_object('sub',v_tester,'role','authenticated')::text,true
  );

  SELECT t.id INTO v_test
  FROM rebuild_v2.tests t
  WHERE t.title='V2 Workflow Test';

  IF (SELECT count(*) FROM rebuild_v2.get_discoverable_tests() d
      WHERE d.test_id=v_test) <> 1 THEN
    RAISE EXCEPTION 'FAIL: discover open test';
  END IF;

  v_assignment := rebuild_v2.join_test(v_test);
  v_assignment_again := rebuild_v2.join_test(v_test);
  IF v_assignment IS NULL OR v_assignment_again <> v_assignment THEN
    RAISE EXCEPTION 'FAIL: join idempotency';
  END IF;

  UPDATE rebuild_v2.tests SET status='ready' WHERE id=v_test;
  UPDATE rebuild_v2.cohorts SET status='ready' WHERE name='V2 Synthetic Cohort';

  IF rebuild_v2.start_assignment(v_assignment) IS NULL THEN
    RAISE EXCEPTION 'FAIL: start assignment';
  END IF;

  v_checkin := rebuild_v2.submit_checkin(v_assignment,'Synthetic daily check-in');
  v_checkin_again := rebuild_v2.submit_checkin(v_assignment,'Duplicate check-in');
  IF v_checkin IS NULL OR v_checkin_again <> v_checkin THEN
    RAISE EXCEPTION 'FAIL: daily check-in idempotency';
  END IF;

  v_feedback := rebuild_v2.submit_tester_feedback(
    v_assignment,'usability',
    'Synthetic feedback body with enough characters for the minimum required length.',
    5::smallint
  );
  IF v_feedback IS NULL THEN
    RAISE EXCEPTION 'FAIL: tester feedback';
  END IF;

  v_submission := rebuild_v2.create_assignment_submission(
    v_assignment,
    'Synthetic final report summary that satisfies the required minimum length.',
    'Synthetic optional comment'
  );
  v_submission_again := rebuild_v2.create_assignment_submission(
    v_assignment,
    'Updated synthetic final report summary that still satisfies the minimum length.',
    'Updated synthetic comment'
  );
  IF v_submission_again <> v_submission THEN
    RAISE EXCEPTION 'FAIL: draft update must reuse the same submission';
  END IF;

  v_path := rebuild_v2.register_assignment_submission_attachment(
    v_submission,v_file,'pdf','synthetic-proof.pdf','application/pdf',1024
  );

  IF NOT rebuild_v2_private.can_upload_test_evidence(v_path) THEN
    RAISE EXCEPTION 'FAIL: upload policy helper';
  END IF;

  -- Simulate the uploaded private object; this is rolled back with the test.
  INSERT INTO storage.objects(bucket_id,name,owner,owner_id,metadata)
  VALUES (
    'test-evidence',v_path,v_tester,v_tester::text,
    jsonb_build_object('mimetype','application/pdf','size',1024)
  );

  IF NOT rebuild_v2.finalize_assignment_submission(v_submission) THEN
    RAISE EXCEPTION 'FAIL: finalize submission';
  END IF;
  IF NOT rebuild_v2.finalize_assignment_submission(v_submission) THEN
    RAISE EXCEPTION 'FAIL: finalization idempotency';
  END IF;
  IF (SELECT status FROM rebuild_v2.assignments WHERE id=v_assignment) <> 'completed' THEN
    RAISE EXCEPTION 'FAIL: assignment completion transition';
  END IF;
  IF (SELECT status FROM rebuild_v2.assignment_submissions WHERE id=v_submission) <> 'submitted' THEN
    RAISE EXCEPTION 'FAIL: final submission state';
  END IF;
  IF NOT rebuild_v2_private.can_read_test_evidence(v_path) THEN
    RAISE EXCEPTION 'FAIL: evidence read policy helper';
  END IF;
  IF rebuild_v2_private.can_upload_test_evidence(v_path) THEN
    RAISE EXCEPTION 'FAIL: upload must close after finalization';
  END IF;

  PERFORM set_config('request.jwt.claim.sub',v_other::text,true);
  PERFORM set_config(
    'request.jwt.claims',
    jsonb_build_object('sub',v_other,'role','authenticated')::text,true
  );

  IF rebuild_v2_private.can_read_test_evidence(v_path) THEN
    RAISE EXCEPTION 'FAIL: unrelated user must not read private submission evidence';
  END IF;
  IF rebuild_v2_private.can_upload_test_evidence(v_path) THEN
    RAISE EXCEPTION 'FAIL: unrelated user must not upload to another tester submission';
  END IF;

  BEGIN
    PERFORM rebuild_v2.start_assignment(v_assignment);
    RAISE EXCEPTION 'FAIL: cross-user assignment start unexpectedly allowed';
  EXCEPTION WHEN insufficient_privilege THEN
    NULL;
  END;

  BEGIN
    PERFORM rebuild_v2.submit_tester_feedback(
      v_assignment,'general',
      'Another user should not submit feedback for this assignment.',
      3::smallint
    );
    RAISE EXCEPTION 'FAIL: cross-user feedback unexpectedly allowed';
  EXCEPTION WHEN insufficient_privilege THEN
    NULL;
  END;

  BEGIN
    PERFORM rebuild_v2.join_test(v_test);
    RAISE EXCEPTION 'FAIL: server allowed a second tester into a full cohort';
  EXCEPTION WHEN SQLSTATE 'P0001' THEN
    GET STACKED DIAGNOSTICS v_capacity_error = MESSAGE_TEXT;
    IF v_capacity_error <> 'TEST_CAPACITY_FULL' THEN
      RAISE EXCEPTION 'FAIL: unexpected full-capacity rejection: %',v_capacity_error;
    END IF;
  END;

  IF (SELECT count(*) FROM rebuild_v2.assignments a
      WHERE a.test_id=v_test AND a.status NOT IN ('withdrawn','rejected')) <> 1 THEN
    RAISE EXCEPTION 'FAIL: full cohort assignment count changed';
  END IF;

  IF (SELECT count(*) FROM rebuild_v2.get_discoverable_tests() d
      WHERE d.test_id=v_test) <> 0 THEN
    RAISE EXCEPTION 'FAIL: full cohort must not appear in discovery';
  END IF;
END;
$test$;

ROLLBACK;

-- Every value below must be zero after rollback.
SELECT jsonb_build_object(
  'auth_users_after_rollback',(SELECT count(*) FROM auth.users),
  'profiles_after_rollback',(SELECT count(*) FROM rebuild_v2.profiles),
  'apps_after_rollback',(SELECT count(*) FROM rebuild_v2.apps WHERE package_name='com.testdz.v2workflowtest'),
  'tests_after_rollback',(SELECT count(*) FROM rebuild_v2.tests WHERE title='V2 Workflow Test'),
  'assignments_after_rollback',(SELECT count(*) FROM rebuild_v2.assignments),
  'checkins_after_rollback',(SELECT count(*) FROM rebuild_v2.checkins),
  'feedback_after_rollback',(SELECT count(*) FROM rebuild_v2.feedback),
  'submissions_after_rollback',(SELECT count(*) FROM rebuild_v2.assignment_submissions),
  'attachments_after_rollback',(SELECT count(*) FROM rebuild_v2.assignment_submission_attachments),
  'storage_objects_after_rollback',(
    SELECT count(*) FROM storage.objects
    WHERE name LIKE '%/20000000-0000-4000-8000-000000000001.pdf'
  )
) AS rollback_cleanup_check;
