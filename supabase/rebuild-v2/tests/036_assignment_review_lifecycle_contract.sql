-- Assignment review lifecycle foundation contract.
-- Run only after the full V2 candidate SQL chain including migration 036.
-- Synthetic rows are rolled back; never run against Production.
BEGIN;

INSERT INTO auth.users
  (id,aud,role,email,encrypted_password,email_confirmed_at,
   raw_app_meta_data,raw_user_meta_data,created_at,updated_at)
VALUES
  ('36000000-0000-4000-8000-000000000001','authenticated','authenticated','review-owner@example.invalid','',now(),'{"provider":"email","providers":["email"]}'::jsonb,'{"name":"Review Owner"}'::jsonb,now(),now()),
  ('36000000-0000-4000-8000-000000000002','authenticated','authenticated','review-other@example.invalid','',now(),'{"provider":"email","providers":["email"]}'::jsonb,'{"name":"Other Developer"}'::jsonb,now(),now()),
  ('36000000-0000-4000-8000-000000000003','authenticated','authenticated','review-tester@example.invalid','',now(),'{"provider":"email","providers":["email"]}'::jsonb,'{"name":"Review Tester"}'::jsonb,now(),now());

INSERT INTO rebuild_v2.user_roles(user_id,role)
VALUES
  ('36000000-0000-4000-8000-000000000001','developer'),
  ('36000000-0000-4000-8000-000000000002','developer'),
  ('36000000-0000-4000-8000-000000000003','tester');

INSERT INTO rebuild_v2.apps(developer_id,name,package_name,description,category,status)
VALUES (
  '36000000-0000-4000-8000-000000000001',
  'Review Lifecycle Contract App','com.testdz.review.lifecycle',
  'Synthetic app for the assignment review contract.','tools','published'
);

INSERT INTO rebuild_v2.tests(
  app_id,developer_id,title,description,status,min_testers,start_date,end_date
)
SELECT a.id,'36000000-0000-4000-8000-000000000001',
  'Review Lifecycle Contract Test','Synthetic review lifecycle test',
  'running',1,CURRENT_DATE-20,CURRENT_DATE+20
FROM rebuild_v2.apps a
WHERE a.package_name='com.testdz.review.lifecycle';

INSERT INTO rebuild_v2.cohorts(name,capacity,status,created_by,starts_at,ends_at)
VALUES (
  'Review Lifecycle Contract Cohort',1,'running',
  '36000000-0000-4000-8000-000000000001',now()-interval '1 day',now()+interval '20 days'
);

INSERT INTO rebuild_v2.cohort_tests(cohort_id,test_id,developer_id)
SELECT c.id,t.id,t.developer_id
FROM rebuild_v2.cohorts c
CROSS JOIN rebuild_v2.tests t
WHERE c.name='Review Lifecycle Contract Cohort'
  AND t.title='Review Lifecycle Contract Test';

INSERT INTO rebuild_v2.assignments(cohort_id,test_id,tester_id,status,started_at)
SELECT ct.cohort_id,ct.test_id,
  '36000000-0000-4000-8000-000000000003','active',now()-interval '14 days'
FROM rebuild_v2.cohort_tests ct
JOIN rebuild_v2.tests t ON t.id=ct.test_id
WHERE t.title='Review Lifecycle Contract Test';

INSERT INTO rebuild_v2.assignment_submissions(
  assignment_id,test_id,tester_id,summary,status,submitted_at,attempt_number
)
SELECT a.id,a.test_id,a.tester_id,
  'Synthetic submitted report for review lifecycle contract.',
  'submitted',now(),1
FROM rebuild_v2.assignments a
JOIN rebuild_v2.tests t ON t.id=a.test_id
WHERE t.title='Review Lifecycle Contract Test';

DO $review_contract$
DECLARE
  v_assignment uuid;
  v_first_submission uuid;
  v_second_submission uuid;
  v_short_reason text;
  v_forbidden text;
BEGIN
  SELECT a.id INTO v_assignment
  FROM rebuild_v2.assignments a
  JOIN rebuild_v2.tests t ON t.id=a.test_id
  WHERE t.title='Review Lifecycle Contract Test';

  SELECT s.id INTO v_first_submission
  FROM rebuild_v2.assignment_submissions s
  WHERE s.assignment_id=v_assignment AND s.attempt_number=1;

  -- A different developer must not review this report.
  PERFORM set_config('request.jwt.claim.sub','36000000-0000-4000-8000-000000000002',true);
  PERFORM set_config('request.jwt.claims',
    jsonb_build_object('sub','36000000-0000-4000-8000-000000000002','role','authenticated')::text,true);
  BEGIN
    PERFORM rebuild_v2.review_assignment_submission(
      v_first_submission,'approved',NULL
    );
    RAISE EXCEPTION 'FAIL: non-owning developer reviewed another developer report';
  EXCEPTION WHEN SQLSTATE '42501' THEN
    NULL;
  END;

  -- The owning developer must supply a meaningful reason for requested changes.
  PERFORM set_config('request.jwt.claim.sub','36000000-0000-4000-8000-000000000001',true);
  PERFORM set_config('request.jwt.claims',
    jsonb_build_object('sub','36000000-0000-4000-8000-000000000001','role','authenticated')::text,true);
  BEGIN
    PERFORM rebuild_v2.review_assignment_submission(
      v_first_submission,'changes_requested','short'
    );
    RAISE EXCEPTION 'FAIL: changes_requested accepted an insufficient reason';
  EXCEPTION WHEN SQLSTATE '22023' THEN
    NULL;
  END;

  IF NOT rebuild_v2.review_assignment_submission(
    v_first_submission,'changes_requested',
    'Please add the missing reproduction steps and clarify the observed result.'
  ) THEN
    RAISE EXCEPTION 'FAIL: owning developer could not request changes';
  END IF;

  IF (SELECT status FROM rebuild_v2.assignments WHERE id=v_assignment) <> 'active' THEN
    RAISE EXCEPTION 'FAIL: requesting changes must keep assignment active';
  END IF;
  IF (SELECT status FROM rebuild_v2.assignment_submissions WHERE id=v_first_submission)
     <> 'changes_requested' THEN
    RAISE EXCEPTION 'FAIL: first attempt did not enter changes_requested';
  END IF;
  IF (SELECT count(*) FROM rebuild_v2.assignment_submission_reviews
      WHERE submission_id=v_first_submission) <> 1 THEN
    RAISE EXCEPTION 'FAIL: review history must contain exactly one decision';
  END IF;

  -- Tester creates a new attempt; the previous attempt remains immutable history.
  PERFORM set_config('request.jwt.claim.sub','36000000-0000-4000-8000-000000000003',true);
  PERFORM set_config('request.jwt.claims',
    jsonb_build_object('sub','36000000-0000-4000-8000-000000000003','role','authenticated')::text,true);
  v_second_submission := rebuild_v2.create_assignment_submission(
    v_assignment,
    'Revised synthetic report containing the requested reproduction details.',
    'Second attempt'
  );
  IF v_second_submission IS NULL OR v_second_submission=v_first_submission THEN
    RAISE EXCEPTION 'FAIL: resubmission must create a new attempt';
  END IF;
  IF (SELECT attempt_number FROM rebuild_v2.assignment_submissions
      WHERE id=v_second_submission) <> 2 THEN
    RAISE EXCEPTION 'FAIL: resubmission attempt number must increment';
  END IF;
  IF (SELECT status FROM rebuild_v2.assignment_submissions
      WHERE id=v_first_submission) <> 'changes_requested' THEN
    RAISE EXCEPTION 'FAIL: previous attempt history was overwritten';
  END IF;

  -- Final developer approval is the only user-driven path in this foundation
  -- that completes the assignment.
  UPDATE rebuild_v2.assignment_submissions
  SET status='submitted',submitted_at=now(),updated_at=now()
  WHERE id=v_second_submission;

  PERFORM set_config('request.jwt.claim.sub','36000000-0000-4000-8000-000000000001',true);
  PERFORM set_config('request.jwt.claims',
    jsonb_build_object('sub','36000000-0000-4000-8000-000000000001','role','authenticated')::text,true);
  IF NOT rebuild_v2.review_assignment_submission(v_second_submission,'approved',NULL) THEN
    RAISE EXCEPTION 'FAIL: owning developer approval failed';
  END IF;
  IF (SELECT status FROM rebuild_v2.assignments WHERE id=v_assignment) <> 'completed' THEN
    RAISE EXCEPTION 'FAIL: approved report must complete assignment';
  END IF;
  IF (SELECT status FROM rebuild_v2.assignment_submissions WHERE id=v_second_submission)
     <> 'approved' THEN
    RAISE EXCEPTION 'FAIL: approved attempt status incorrect';
  END IF;

  -- A second decision for the same attempt is not allowed.
  BEGIN
    PERFORM rebuild_v2.review_assignment_submission(v_second_submission,'approved',NULL);
    RAISE EXCEPTION 'FAIL: duplicate review decision unexpectedly succeeded';
  EXCEPTION WHEN SQLSTATE '55000' THEN
    NULL;
  END;

  IF (SELECT count(*) FROM rebuild_v2.assignment_submission_reviews
      WHERE assignment_id=v_assignment) <> 2 THEN
    RAISE EXCEPTION 'FAIL: expected one immutable decision per reviewed attempt';
  END IF;
  IF (SELECT count(*) FROM rebuild_v2.audit_events
      WHERE target_type='assignment_submission'
        AND target_id IN (v_first_submission,v_second_submission)
        AND action IN (
          'assignment_submission.approved',
          'assignment_submission.changes_requested'
        )) <> 2 THEN
    RAISE EXCEPTION 'FAIL: review decisions must produce audit events';
  END IF;
  IF (SELECT count(*) FROM rebuild_v2.events
      WHERE event_type='notification.requested'
        AND aggregate_type='assignment_submission'
        AND aggregate_id IN (v_first_submission,v_second_submission)
        AND payload->>'type' IN (
          'assignment.report_approved',
          'assignment.report_changes_requested'
        )) <> 2 THEN
    RAISE EXCEPTION 'FAIL: each decision must enqueue one notification event';
  END IF;
END;
$review_contract$;

ROLLBACK;
