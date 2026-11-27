-- Server-only 48h reminder and guarded 72h auto-approval contract.
-- No cron/scheduler is configured by this test or migration.
BEGIN;

INSERT INTO auth.users
  (id,aud,role,email,encrypted_password,email_confirmed_at,
   raw_app_meta_data,raw_user_meta_data,created_at,updated_at)
VALUES
  ('40000000-0000-4000-8000-000000000001','authenticated','authenticated','deadline-auto@example.invalid','',now(),'{ "provider":"email","providers":["email"] }'::jsonb,'{"name":"Deadline Auto Tester"}'::jsonb,now(),now()),
  ('40000000-0000-4000-8000-000000000002','authenticated','authenticated','deadline-reminder@example.invalid','',now(),'{ "provider":"email","providers":["email"] }'::jsonb,'{"name":"Deadline Reminder Tester"}'::jsonb,now(),now()),
  ('40000000-0000-4000-8000-000000000003','authenticated','authenticated','deadline-short@example.invalid','',now(),'{ "provider":"email","providers":["email"] }'::jsonb,'{"name":"Deadline Short Tester"}'::jsonb,now(),now()),
  ('40000000-0000-4000-8000-000000000004','authenticated','authenticated','deadline-blocked@example.invalid','',now(),'{ "provider":"email","providers":["email"] }'::jsonb,'{"name":"Deadline Blocked Tester"}'::jsonb,now(),now()),
  ('40000000-0000-4000-8000-000000000005','authenticated','authenticated','deadline-developer@example.invalid','',now(),'{ "provider":"email","providers":["email"] }'::jsonb,'{"name":"Deadline Developer"}'::jsonb,now(),now()),
  ('40000000-0000-4000-8000-000000000006','authenticated','authenticated','deadline-admin@example.invalid','',now(),'{ "provider":"email","providers":["email"] }'::jsonb,'{"name":"Deadline Admin"}'::jsonb,now(),now());

INSERT INTO rebuild_v2.user_roles(user_id,role)
VALUES
  ('40000000-0000-4000-8000-000000000005','developer'),
  ('40000000-0000-4000-8000-000000000006','admin')
ON CONFLICT (user_id,role) DO NOTHING;

INSERT INTO rebuild_v2.apps(developer_id,name,package_name,description,category,status)
VALUES (
  '40000000-0000-4000-8000-000000000005',
  'Deadline Processor Contract App','com.testdz.deadline.processor',
  'Synthetic app for the assignment review deadline processor.','tools','published'
);

INSERT INTO rebuild_v2.tests(
  app_id,developer_id,title,description,status,min_testers,start_date,end_date
)
SELECT a.id,'40000000-0000-4000-8000-000000000005',
  'Deadline Processor Contract Test','Synthetic deadline processor contract',
  'running',4,CURRENT_DATE-30,CURRENT_DATE+30
FROM rebuild_v2.apps a
WHERE a.package_name='com.testdz.deadline.processor';

INSERT INTO rebuild_v2.cohorts(name,capacity,status,created_by,starts_at,ends_at)
VALUES (
  'Deadline Processor Contract Cohort',4,'running',
  '40000000-0000-4000-8000-000000000005',now()-interval '30 days',now()+interval '30 days'
);

INSERT INTO rebuild_v2.cohort_tests(cohort_id,test_id,developer_id)
SELECT c.id,t.id,t.developer_id
FROM rebuild_v2.cohorts c
CROSS JOIN rebuild_v2.tests t
WHERE c.name='Deadline Processor Contract Cohort'
  AND t.title='Deadline Processor Contract Test';

DO $deadline_processor_contract$
DECLARE
  v_auto_tester constant uuid := '40000000-0000-4000-8000-000000000001';
  v_reminder_tester constant uuid := '40000000-0000-4000-8000-000000000002';
  v_short_tester constant uuid := '40000000-0000-4000-8000-000000000003';
  v_blocked_tester constant uuid := '40000000-0000-4000-8000-000000000004';
  v_developer constant uuid := '40000000-0000-4000-8000-000000000005';
  v_admin constant uuid := '40000000-0000-4000-8000-000000000006';
  v_test uuid;
  v_cohort uuid;
  v_today date := rebuild_v2_private.algeria_local_date();
  v_start date;
  v_auto_assignment uuid;
  v_reminder_assignment uuid;
  v_short_assignment uuid;
  v_blocked_assignment uuid;
  v_auto_feedback uuid;
  v_reminder_feedback uuid;
  v_short_feedback uuid;
  v_blocked_feedback uuid;
  v_auto_submission uuid;
  v_reminder_submission uuid;
  v_short_submission uuid;
  v_blocked_submission uuid;
  v_result jsonb;
  v_dispatch_count integer;
  v_error text;
BEGIN
  SELECT t.id INTO v_test FROM rebuild_v2.tests t
  WHERE t.title='Deadline Processor Contract Test';
  SELECT c.id INTO v_cohort FROM rebuild_v2.cohorts c
  WHERE c.name='Deadline Processor Contract Cohort';
  v_start:=v_today-13;

  INSERT INTO rebuild_v2.assignments(cohort_id,test_id,tester_id,status,started_at,due_at)
  VALUES
    (v_cohort,v_test,v_auto_tester,'active',v_start::timestamp AT TIME ZONE 'Africa/Algiers',now()+interval '2 days'),
    (v_cohort,v_test,v_reminder_tester,'active',v_start::timestamp AT TIME ZONE 'Africa/Algiers',now()+interval '2 days'),
    (v_cohort,v_test,v_short_tester,'active',v_start::timestamp AT TIME ZONE 'Africa/Algiers',now()+interval '2 days'),
    (v_cohort,v_test,v_blocked_tester,'active',v_start::timestamp AT TIME ZONE 'Africa/Algiers',now()+interval '2 days');

  SELECT id INTO v_auto_assignment FROM rebuild_v2.assignments
  WHERE tester_id=v_auto_tester AND test_id=v_test;
  SELECT id INTO v_reminder_assignment FROM rebuild_v2.assignments
  WHERE tester_id=v_reminder_tester AND test_id=v_test;
  SELECT id INTO v_short_assignment FROM rebuild_v2.assignments
  WHERE tester_id=v_short_tester AND test_id=v_test;
  SELECT id INTO v_blocked_assignment FROM rebuild_v2.assignments
  WHERE tester_id=v_blocked_tester AND test_id=v_test;

  INSERT INTO rebuild_v2.checkins(assignment_id,tester_id,checkin_date,note)
  SELECT a.id,a.tester_id,g.day::date,'Synthetic valid daily check-in'
  FROM rebuild_v2.assignments a
  CROSS JOIN LATERAL generate_series(v_start::timestamp,v_today::timestamp,interval '1 day') g(day)
  WHERE a.id IN (v_auto_assignment,v_reminder_assignment,v_short_assignment,v_blocked_assignment);

  INSERT INTO rebuild_v2.feedback(
    assignment_id,tester_id,category,body,rating,quality_status,reviewed_by,reviewed_at
  )
  VALUES
    (v_auto_assignment,v_auto_tester,'general','Accepted feedback for automatic approval contract.',5,'accepted',v_admin,now()),
    (v_reminder_assignment,v_reminder_tester,'general','Accepted feedback for reminder contract.',5,'accepted',v_admin,now()),
    (v_short_assignment,v_short_tester,'general','Accepted feedback for short reminder contract.',5,'accepted',v_admin,now()),
    (v_blocked_assignment,v_blocked_tester,'general','Pending feedback blocks automatic approval contract.',5,'pending',NULL,NULL);

  SELECT id INTO v_auto_feedback FROM rebuild_v2.feedback WHERE assignment_id=v_auto_assignment;
  SELECT id INTO v_reminder_feedback FROM rebuild_v2.feedback WHERE assignment_id=v_reminder_assignment;
  SELECT id INTO v_short_feedback FROM rebuild_v2.feedback WHERE assignment_id=v_short_assignment;
  SELECT id INTO v_blocked_feedback FROM rebuild_v2.feedback WHERE assignment_id=v_blocked_assignment;

  PERFORM set_config('request.jwt.claim.sub',v_auto_tester::text,true);
  PERFORM set_config('request.jwt.claims',jsonb_build_object('sub',v_auto_tester,'role','authenticated')::text,true);
  v_auto_submission:=rebuild_v2.create_assignment_submission(v_auto_assignment,
    'Complete report for the auto approval deadline contract.','Auto approval test');

  PERFORM set_config('request.jwt.claim.sub',v_reminder_tester::text,true);
  PERFORM set_config('request.jwt.claims',jsonb_build_object('sub',v_reminder_tester,'role','authenticated')::text,true);
  v_reminder_submission:=rebuild_v2.create_assignment_submission(v_reminder_assignment,
    'Complete report for the 48 hour reminder contract.','Reminder test');

  PERFORM set_config('request.jwt.claim.sub',v_short_tester::text,true);
  PERFORM set_config('request.jwt.claims',jsonb_build_object('sub',v_short_tester,'role','authenticated')::text,true);
  v_short_submission:=rebuild_v2.create_assignment_submission(v_short_assignment,
    'Complete report for the short reminder interval contract.','Short reminder test');

  PERFORM set_config('request.jwt.claim.sub',v_blocked_tester::text,true);
  PERFORM set_config('request.jwt.claims',jsonb_build_object('sub',v_blocked_tester,'role','authenticated')::text,true);
  v_blocked_submission:=rebuild_v2.create_assignment_submission(v_blocked_assignment,
    'Complete report for the blocked prerequisite contract.','Blocked test');

  UPDATE rebuild_v2.assignment_submissions
  SET status='submitted',submitted_at=now()-interval '73 hours',
      review_due_at=now()-interval '1 hour',reminder_sent_at=NULL,reminder_event_id=NULL
  WHERE id=v_auto_submission;

  UPDATE rebuild_v2.assignment_submissions
  SET status='submitted',submitted_at=now()-interval '50 hours',
      review_due_at=now()+interval '22 hours',reminder_sent_at=NULL,reminder_event_id=NULL
  WHERE id=v_reminder_submission;

  UPDATE rebuild_v2.assignment_submissions
  SET status='submitted',submitted_at=now()-interval '73 hours',
      review_due_at=now()-interval '1 hour',reminder_sent_at=NULL,reminder_event_id=NULL
  WHERE id=v_short_submission;

  UPDATE rebuild_v2.assignment_submissions
  SET status='submitted',submitted_at=now()-interval '73 hours',
      review_due_at=now()-interval '1 hour',reminder_sent_at=NULL,reminder_event_id=NULL
  WHERE id=v_blocked_submission;

  -- Browser/authenticated callers cannot execute the processor.
  PERFORM set_config('request.jwt.claim.sub',v_developer::text,true);
  PERFORM set_config('request.jwt.claims',jsonb_build_object('sub',v_developer,'role','authenticated')::text,true);
  BEGIN
    PERFORM rebuild_v2.process_assignment_review_deadlines(50);
    RAISE EXCEPTION 'FAIL: authenticated Developer invoked service deadline processor';
  EXCEPTION WHEN SQLSTATE '42501' THEN NULL;
  END;

  -- Only a service-role invocation can process reminders and auto-approvals.
  PERFORM set_config('request.jwt.claim.sub','',true);
  PERFORM set_config('request.jwt.claims',jsonb_build_object('role','service_role')::text,true);
  PERFORM set_config('request.jwt.claim.role','service_role',true);
  v_result:=rebuild_v2.process_assignment_review_deadlines(50);

  IF (v_result->>'reminders_queued')::integer<>4
     OR (v_result->>'auto_approved')::integer<>0
     OR (v_result->>'blocked_by_prerequisites')::integer<>0 THEN
    RAISE EXCEPTION 'FAIL: reminder enqueue must not count as delivery or auto-approve: %',v_result;
  END IF;
  IF EXISTS (
    SELECT 1 FROM rebuild_v2.assignment_submissions s
    WHERE s.id IN (v_auto_submission,v_reminder_submission,v_short_submission,v_blocked_submission)
      AND (s.reminder_event_id IS NULL OR s.reminder_sent_at IS NOT NULL)
  ) THEN
    RAISE EXCEPTION 'FAIL: queued reminder must have an event id but no delivered timestamp';
  END IF;

  -- A terminal delivery failure is retried with a fresh event, but does not
  -- count as delivery and does not permit automatic approval.
  UPDATE rebuild_v2.events
  SET status='failed',attempts=5,last_error='Synthetic terminal delivery failure'
  WHERE id=(SELECT reminder_event_id FROM rebuild_v2.assignment_submissions
            WHERE id=v_reminder_submission);
  v_result:=rebuild_v2.process_assignment_review_deadlines(50);
  IF (v_result->>'reminders_queued')::integer<>1
     OR (SELECT reminder_delivery_retries FROM rebuild_v2.assignment_submissions
         WHERE id=v_reminder_submission)<>1
     OR (SELECT status FROM rebuild_v2.assignment_submissions
         WHERE id=v_reminder_submission)<>'submitted'
     OR (SELECT status FROM rebuild_v2.events
         WHERE id=(SELECT reminder_event_id FROM rebuild_v2.assignment_submissions
                   WHERE id=v_reminder_submission))<>'pending' THEN
    RAISE EXCEPTION 'FAIL: terminal reminder delivery failure was not safely retried';
  END IF;

  -- Deliver the in-app notifications through the real outbox dispatcher.
  v_dispatch_count:=rebuild_v2.process_notification_outbox(100);
  IF NOT EXISTS (
    SELECT 1 FROM rebuild_v2.assignment_submissions s
    JOIN rebuild_v2.events e ON e.id=s.reminder_event_id
    WHERE s.id=v_auto_submission AND e.status='delivered' AND e.processed_at IS NOT NULL
  ) THEN
    RAISE EXCEPTION 'FAIL: reminder event was not delivered to the in-app notification queue';
  END IF;

  -- Model delivery timestamps for the 24h policy boundary after real dispatch.
  UPDATE rebuild_v2.events e
  SET processed_at=CASE
    WHEN s.id IN (v_auto_submission,v_blocked_submission) THEN now()-interval '25 hours'
    ELSE now()-interval '2 hours'
  END
  FROM rebuild_v2.assignment_submissions s
  WHERE s.reminder_event_id=e.id
    AND e.payload->>'type'='assignment.review_reminder';

  v_result:=rebuild_v2.process_assignment_review_deadlines(50);
  IF (v_result->>'reminders_queued')::integer<>0
     OR (v_result->>'auto_approved')::integer<>1
     OR (v_result->>'blocked_by_prerequisites')::integer<>1 THEN
    RAISE EXCEPTION 'FAIL: delivered reminder timing or prerequisite gate failed: %',v_result;
  END IF;

  IF (SELECT status FROM rebuild_v2.assignment_submissions WHERE id=v_auto_submission)<>'auto_approved'
     OR (SELECT auto_approved_at FROM rebuild_v2.assignment_submissions WHERE id=v_auto_submission) IS NULL
     OR (SELECT reviewed_at FROM rebuild_v2.assignment_submissions WHERE id=v_auto_submission) IS NULL
     OR (SELECT reviewed_by FROM rebuild_v2.assignment_submissions WHERE id=v_auto_submission) IS NOT NULL
     OR (SELECT status FROM rebuild_v2.assignments WHERE id=v_auto_assignment)<>'completed' THEN
    RAISE EXCEPTION 'FAIL: eligible 72-hour report was not auto-approved and completed';
  END IF;
  IF (SELECT decision FROM rebuild_v2.assignment_submission_reviews WHERE submission_id=v_auto_submission)<>'auto_approved'
     OR (SELECT actor_id FROM rebuild_v2.assignment_submission_reviews WHERE submission_id=v_auto_submission) IS NOT NULL THEN
    RAISE EXCEPTION 'FAIL: system approval history must be recorded with a null human actor';
  END IF;
  IF (SELECT count(*) FROM rebuild_v2.audit_events
      WHERE action='assignment_submission.auto_approved'
        AND target_id=v_auto_submission AND actor_id IS NULL)<>1 THEN
    RAISE EXCEPTION 'FAIL: system auto-approval audit event missing';
  END IF;
  IF (SELECT count(*) FROM rebuild_v2.events
      WHERE event_type='notification.requested'
        AND aggregate_type='assignment_submission'
        AND aggregate_id=v_auto_submission
        AND payload->>'type'='assignment.report_auto_approved')<>1 THEN
    RAISE EXCEPTION 'FAIL: auto-approval tester notification missing';
  END IF;

  IF (SELECT reminder_sent_at FROM rebuild_v2.assignment_submissions WHERE id=v_reminder_submission) IS NULL
     OR (SELECT status FROM rebuild_v2.assignment_submissions WHERE id=v_reminder_submission)<>'submitted' THEN
    RAISE EXCEPTION 'FAIL: delivered 48-hour reminder was not recorded without prematurely auto-approving';
  END IF;
  IF (SELECT count(*) FROM rebuild_v2.events
      WHERE event_type='notification.requested'
        AND aggregate_type='assignment_submission'
        AND aggregate_id=v_reminder_submission
        AND payload->>'type'='assignment.review_reminder')<>2 THEN
    RAISE EXCEPTION 'FAIL: original and replacement developer review reminder events missing';
  END IF;

  IF (SELECT status FROM rebuild_v2.assignment_submissions WHERE id=v_short_submission)<>'submitted'
     OR (SELECT status FROM rebuild_v2.assignment_submissions WHERE id=v_blocked_submission)<>'submitted' THEN
    RAISE EXCEPTION 'FAIL: auto-approval bypassed reminder interval or missing prerequisites';
  END IF;

  -- A medical request cannot be added after the report has been submitted.
  BEGIN
    INSERT INTO rebuild_v2.medical_exception_requests(
      assignment_id,tester_id,reason,requested_dates
    ) VALUES(
      v_auto_assignment,v_auto_tester,
      'A retroactive medical request must be blocked after report submission.',
      ARRAY[v_today-1]::date[]
    );
    RAISE EXCEPTION 'FAIL: medical request was created after report submission';
  EXCEPTION WHEN SQLSTATE '55000' THEN
    IF SQLERRM<>'MEDICAL_REQUEST_CLOSED_AFTER_SUBMISSION' THEN
      RAISE EXCEPTION 'FAIL: unexpected post-submission medical request response: %',SQLERRM;
    END IF;
  END;
END;
$deadline_processor_contract$;

ROLLBACK;
SELECT 'rebuild_v2_assignment_review_deadline_processor_contract: PASS' AS result;
