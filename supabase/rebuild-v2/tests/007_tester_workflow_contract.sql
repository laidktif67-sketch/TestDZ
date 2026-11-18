-- Tester workflow V2 contract smoke test.
-- Run only against an isolated disposable database after the complete candidate replay through 021. The checks below cover tester workflow, evidence protection, and role-scoped notification producers/dispatch.
-- All synthetic Auth users, rows, and Storage metadata are created inside one
-- transaction and rolled back at the end. Never run against Production.

BEGIN;

-- Regression: UTC 23:30 is already the next calendar day in Algeria (UTC+1).
-- A UTC session CURRENT_DATE would incorrectly remain on the previous date.
DO $date_boundary$
DECLARE
  v_checkin_default text;
  v_original_timezone text := current_setting('TimeZone');
BEGIN
  -- Pin both sides of Algeria's UTC+1 midnight boundary.
  IF rebuild_v2_private.algeria_local_date('2026-11-15 22:59:59.999999+00'::timestamptz)
     IS DISTINCT FROM DATE '2026-11-15' THEN
    RAISE EXCEPTION 'FAIL: Algeria date must not roll over before UTC 23:00';
  END IF;
  IF rebuild_v2_private.algeria_local_date('2026-11-15 23:00:00+00'::timestamptz)
     IS DISTINCT FROM DATE '2026-11-16' THEN
    RAISE EXCEPTION 'FAIL: Algeria date must roll over exactly at UTC 23:00';
  END IF;
  IF rebuild_v2_private.algeria_local_date('2026-11-16 00:30:00+00'::timestamptz)
     IS DISTINCT FROM DATE '2026-11-16' THEN
    RAISE EXCEPTION 'FAIL: Algeria date must remain on the new local day';
  END IF;
  IF rebuild_v2_private.algeria_local_date('2026-11-16 22:30:00+00'::timestamptz)
     IS DISTINCT FROM DATE '2026-11-16' THEN
    RAISE EXCEPTION 'FAIL: Algeria date must remain on the current local day';
  END IF;

  -- The helper must not depend on the session TimeZone.
  PERFORM set_config('TimeZone','Pacific/Honolulu',true);
  IF rebuild_v2_private.algeria_local_date('2026-11-15 23:00:00+00'::timestamptz)
     IS DISTINCT FROM DATE '2026-11-16' THEN
    RAISE EXCEPTION 'FAIL: Algeria date must not depend on session TimeZone';
  END IF;
  PERFORM set_config('TimeZone',v_original_timezone,true);

  SELECT pg_get_expr(d.adbin, d.adrelid)
  INTO v_checkin_default
  FROM pg_attrdef d
  JOIN pg_attribute a
    ON a.attrelid = d.adrelid
   AND a.attnum = d.adnum
  WHERE d.adrelid = 'rebuild_v2.checkins'::regclass
    AND a.attname = 'checkin_date';

  IF v_checkin_default IS NULL
     OR position('Africa/Algiers' IN v_checkin_default) = 0 THEN
    RAISE EXCEPTION 'FAIL: check-in date default must use Algeria local time; got %',
      v_checkin_default;
  END IF;
END;
$date_boundary$;

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
  v_join_event_id uuid;
  v_feedback_created_event_id uuid;
  v_feedback_status_event_id uuid;
  v_feedback_reply_event_id uuid;
  v_submit_event_id uuid;
  v_processed integer;
  v_path text;
  v_capacity_error text;
  v_start_error text;
  v_started_at timestamptz;
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

  IF NOT EXISTS (
    SELECT 1 FROM rebuild_v2.events e
    WHERE e.event_type='notification.requested'
      AND e.aggregate_type='assignment'
      AND e.aggregate_id=v_assignment
      AND e.payload->>'user_id'='10000000-0000-4000-8000-000000000001'
      AND e.payload->>'recipient_role'='developer'
      AND e.payload->>'type'='assignment.joined'
      AND e.payload->'data'->>'test_id'=v_test::text
  ) THEN
    RAISE EXCEPTION 'FAIL: joining a test must enqueue one developer notification event';
  END IF;
  SELECT e.id INTO v_join_event_id
  FROM rebuild_v2.events e
  WHERE e.event_type='notification.requested' AND e.aggregate_type='assignment'
    AND e.aggregate_id=v_assignment AND e.payload->>'type'='assignment.joined';

  UPDATE rebuild_v2.tests SET status='ready' WHERE id=v_test;
  UPDATE rebuild_v2.cohorts SET status='ready' WHERE name='V2 Synthetic Cohort';

  UPDATE rebuild_v2.cohorts
  SET starts_at=now()+interval '1 day',ends_at=now()+interval '3 days'
  WHERE id=(SELECT cohort_id FROM rebuild_v2.assignments WHERE id=v_assignment);
  BEGIN
    PERFORM rebuild_v2.start_assignment(v_assignment);
    RAISE EXCEPTION 'FAIL: assignment started before cohort start time';
  EXCEPTION WHEN SQLSTATE '55000' THEN
    GET STACKED DIAGNOSTICS v_start_error = MESSAGE_TEXT;
    IF v_start_error <> 'ASSIGNMENT_OUTSIDE_TEST_WINDOW' THEN
      RAISE EXCEPTION 'FAIL: unexpected early-start rejection: %',v_start_error;
    END IF;
  END;

  UPDATE rebuild_v2.cohorts
  SET starts_at=now()-interval '1 minute',ends_at=now()-interval '1 second'
  WHERE id=(SELECT cohort_id FROM rebuild_v2.assignments WHERE id=v_assignment);
  BEGIN
    PERFORM rebuild_v2.start_assignment(v_assignment);
    RAISE EXCEPTION 'FAIL: assignment started after cohort end time';
  EXCEPTION WHEN SQLSTATE '55000' THEN
    GET STACKED DIAGNOSTICS v_start_error = MESSAGE_TEXT;
    IF v_start_error <> 'ASSIGNMENT_OUTSIDE_TEST_WINDOW' THEN
      RAISE EXCEPTION 'FAIL: unexpected late-start rejection: %',v_start_error;
    END IF;
  END;

  UPDATE rebuild_v2.cohorts SET ends_at=now()+interval '3 days'
  WHERE id=(SELECT cohort_id FROM rebuild_v2.assignments WHERE id=v_assignment);
  v_started_at:=rebuild_v2.start_assignment(v_assignment);
  IF v_started_at IS NULL THEN
    RAISE EXCEPTION 'FAIL: start assignment';
  END IF;
  UPDATE rebuild_v2.cohorts SET ends_at=now()-interval '1 second'
  WHERE id=(SELECT cohort_id FROM rebuild_v2.assignments WHERE id=v_assignment);
  IF rebuild_v2.start_assignment(v_assignment) IS DISTINCT FROM v_started_at THEN
    RAISE EXCEPTION 'FAIL: started assignment retry must preserve original timestamp';
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

  SELECT e.id INTO v_feedback_created_event_id
  FROM rebuild_v2.events e
  WHERE e.event_type='notification.requested'
    AND e.aggregate_type='feedback'
    AND e.aggregate_id=v_feedback
    AND e.payload->>'type'='feedback.created'
    AND e.payload->>'user_id'='10000000-0000-4000-8000-000000000001'
    AND e.payload->>'recipient_role'='developer';
  IF v_feedback_created_event_id IS NULL THEN
    RAISE EXCEPTION 'FAIL: tester feedback must notify its owning developer';
  END IF;

  -- The owning developer reviews the feedback and replies; both events target the tester.
  PERFORM set_config('request.jwt.claim.sub','10000000-0000-4000-8000-000000000001',true);
  PERFORM set_config(
    'request.jwt.claims',
    jsonb_build_object('sub','10000000-0000-4000-8000-000000000001','role','authenticated')::text,true
  );
  PERFORM rebuild_v2.update_developer_feedback_review(v_feedback,'under_review','normal',NULL);
  PERFORM rebuild_v2.send_developer_feedback_message(
    v_feedback,'Synthetic developer reply for the notification contract.'
  );
  PERFORM set_config('request.jwt.claim.sub',v_tester::text,true);
  PERFORM set_config(
    'request.jwt.claims',
    jsonb_build_object('sub',v_tester,'role','authenticated')::text,true
  );

  SELECT e.id INTO v_feedback_status_event_id
  FROM rebuild_v2.events e
  WHERE e.event_type='notification.requested'
    AND e.aggregate_type='feedback'
    AND e.aggregate_id=v_feedback
    AND e.payload->>'type'='feedback.status_updated'
    AND e.payload->>'user_id'=v_tester::text
    AND e.payload->>'recipient_role'='tester';
  SELECT e.id INTO v_feedback_reply_event_id
  FROM rebuild_v2.events e
  WHERE e.event_type='notification.requested'
    AND e.aggregate_type='feedback'
    AND e.aggregate_id=v_feedback
    AND e.payload->>'type'='feedback.developer_replied'
    AND e.payload->>'user_id'=v_tester::text
    AND e.payload->>'recipient_role'='tester';
  IF v_feedback_status_event_id IS NULL OR v_feedback_reply_event_id IS NULL THEN
    RAISE EXCEPTION 'FAIL: developer review and reply must notify the tester';
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

  -- Exercise the real Storage INSERT RLS policy as authenticated, not only its helper.
  PERFORM set_config('role','authenticated',true);
  INSERT INTO storage.objects(bucket_id,name,owner,owner_id,metadata)
  VALUES (
    'test-evidence',v_path,v_tester,v_tester::text,
    jsonb_build_object('mimetype','application/pdf','size',1024)
  );
  IF (SELECT count(*) FROM storage.objects
      WHERE bucket_id='test-evidence' AND name=v_path) <> 1 THEN
    RAISE EXCEPTION 'FAIL: owner could not read evidence through Storage SELECT RLS';
  END IF;

  -- An unrelated authenticated user must neither read nor upload the object.
  PERFORM set_config('request.jwt.claim.sub',v_other::text,true);
  PERFORM set_config(
    'request.jwt.claims',
    jsonb_build_object('sub',v_other,'role','authenticated')::text,true
  );
  IF (SELECT count(*) FROM storage.objects
      WHERE bucket_id='test-evidence' AND name=v_path) <> 0 THEN
    RAISE EXCEPTION 'FAIL: unrelated user read private evidence through Storage SELECT RLS';
  END IF;
  BEGIN
    INSERT INTO storage.objects(bucket_id,name,owner,owner_id,metadata)
    VALUES (
      'test-evidence',
      replace(v_path,'/' || v_tester::text || '/','/' || v_other::text || '/'),
      v_other,v_other::text,
      jsonb_build_object('mimetype','application/pdf','size',1024)
    );
    RAISE EXCEPTION 'FAIL: unrelated user passed Storage INSERT RLS policy';
  EXCEPTION WHEN insufficient_privilege THEN
    NULL;
  END;

  -- Restore the test harness role for controlled metadata assertions below.
  PERFORM set_config('role','postgres',true);
  PERFORM set_config('request.jwt.claim.sub',v_tester::text,true);
  PERFORM set_config(
    'request.jwt.claims',
    jsonb_build_object('sub',v_tester,'role','authenticated')::text,true
  );

  -- An object at the right path is not enough: owner, size and MIME must match metadata.
  UPDATE storage.objects
  SET metadata=jsonb_build_object('mimetype','application/pdf','size',1023)
  WHERE bucket_id='test-evidence' AND name=v_path;
  BEGIN
    PERFORM rebuild_v2.finalize_assignment_submission(v_submission);
    RAISE EXCEPTION 'FAIL: submission finalized with mismatched evidence size';
  EXCEPTION WHEN SQLSTATE '55000' THEN
    IF SQLERRM <> 'ATTACHMENT_UPLOAD_INCOMPLETE' THEN
      RAISE EXCEPTION 'FAIL: unexpected metadata rejection: %',SQLERRM;
    END IF;
  END;

  UPDATE storage.objects
  SET metadata=jsonb_build_object('mimetype','image/jpeg','size',1024),
      owner_id=v_tester::text
  WHERE bucket_id='test-evidence' AND name=v_path;
  BEGIN
    PERFORM rebuild_v2.finalize_assignment_submission(v_submission);
    RAISE EXCEPTION 'FAIL: submission finalized with mismatched evidence MIME';
  EXCEPTION WHEN SQLSTATE '55000' THEN
    IF SQLERRM <> 'ATTACHMENT_UPLOAD_INCOMPLETE' THEN
      RAISE EXCEPTION 'FAIL: unexpected MIME rejection: %',SQLERRM;
    END IF;
  END;

  UPDATE storage.objects
  SET metadata=jsonb_build_object('mimetype','application/pdf','size',1024),
      owner_id=v_other::text
  WHERE bucket_id='test-evidence' AND name=v_path;
  BEGIN
    PERFORM rebuild_v2.finalize_assignment_submission(v_submission);
    RAISE EXCEPTION 'FAIL: submission finalized with another uploader owner';
  EXCEPTION WHEN SQLSTATE '55000' THEN
    IF SQLERRM <> 'ATTACHMENT_UPLOAD_INCOMPLETE' THEN
      RAISE EXCEPTION 'FAIL: unexpected owner rejection: %',SQLERRM;
    END IF;
  END;

  UPDATE storage.objects
  SET metadata=jsonb_build_object('mimetype','application/pdf','size',1024),
      owner_id=v_tester::text
  WHERE bucket_id='test-evidence' AND name=v_path;
  IF NOT rebuild_v2.finalize_assignment_submission(v_submission) THEN
    RAISE EXCEPTION 'FAIL: finalize submission';
  END IF;
  IF NOT rebuild_v2.finalize_assignment_submission(v_submission) THEN
    RAISE EXCEPTION 'FAIL: finalization idempotency';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM rebuild_v2.events e
    WHERE e.event_type='notification.requested'
      AND e.aggregate_type='assignment_submission'
      AND e.aggregate_id=v_submission
      AND e.payload->>'user_id'='10000000-0000-4000-8000-000000000001'
      AND e.payload->>'recipient_role'='developer'
      AND e.payload->>'type'='assignment.submitted'
      AND e.payload->'data'->>'assignment_id'=v_assignment::text
  ) THEN
    RAISE EXCEPTION
      'FAIL: final submission event missing; submission=%, assignment=%, matching_events=%',
      v_submission, v_assignment,
      COALESCE((
        SELECT jsonb_agg(jsonb_build_object(
          'event_type',e.event_type,'aggregate_type',e.aggregate_type,
          'aggregate_id',e.aggregate_id,'payload',e.payload
        ))
        FROM rebuild_v2.events e
        WHERE e.event_type='notification.requested'
          AND e.payload->>'type'='assignment.submitted'
      ),'[]'::jsonb);
  END IF;
  SELECT e.id INTO v_submit_event_id
  FROM rebuild_v2.events e
  WHERE e.event_type='notification.requested'
    AND e.aggregate_type='assignment_submission'
    AND e.aggregate_id=v_submission
    AND e.payload->>'type'='assignment.submitted';

  -- Only a service-role JWT may drain the outbox. Delivery is idempotent.
  IF has_function_privilege('authenticated','rebuild_v2.process_notification_outbox(integer)','EXECUTE') THEN
    RAISE EXCEPTION 'FAIL: authenticated must not execute the outbox dispatcher';
  END IF;
  PERFORM set_config('request.jwt.claims',jsonb_build_object('role','service_role')::text,true);
  v_processed := rebuild_v2.process_notification_outbox(20);
  IF v_processed <> 5 THEN
    RAISE EXCEPTION 'FAIL: expected five outbox events delivered, got %',v_processed;
  END IF;
  IF (SELECT count(*) FROM rebuild_v2.notifications n
      WHERE n.source_event_id IN (v_join_event_id,v_feedback_created_event_id)
        AND n.user_id='10000000-0000-4000-8000-000000000001'
        AND n.recipient_role='developer') <> 2 THEN
    RAISE EXCEPTION 'FAIL: dispatcher must create two developer inbox rows';
  END IF;
  IF (SELECT count(*) FROM rebuild_v2.notifications n
      WHERE n.source_event_id IN (v_feedback_status_event_id,v_feedback_reply_event_id)
        AND n.user_id=v_tester AND n.recipient_role='tester') <> 2 THEN
    RAISE EXCEPTION 'FAIL: dispatcher must create two tester inbox rows';
  END IF;
  IF rebuild_v2.process_notification_outbox(20) <> 0 THEN
    RAISE EXCEPTION 'FAIL: dispatcher retry must not redeliver completed events';
  END IF;
  IF (SELECT count(*) FROM rebuild_v2.notifications n
      WHERE n.source_event_id IN (
        v_join_event_id,v_feedback_created_event_id,
        v_feedback_status_event_id,v_feedback_reply_event_id,v_submit_event_id
      )) <> 5 THEN
    RAISE EXCEPTION 'FAIL: dispatcher retry created duplicate inbox rows';
  END IF;
  PERFORM set_config(
    'request.jwt.claims',
    jsonb_build_object('sub',v_other,'role','authenticated')::text,true
  );
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
