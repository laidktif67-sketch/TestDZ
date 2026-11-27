-- End-to-end assignment completion contracts: 14 valid days, medical skips,
-- feedback quality, evidence, tester finalization, developer confirmation and interruption.
-- Disposable local rebuild_v2 database only; all fixtures are rolled back.
BEGIN;

INSERT INTO auth.users
  (id,aud,role,email,encrypted_password,email_confirmed_at,
   raw_app_meta_data,raw_user_meta_data,created_at,updated_at)
VALUES
  ('38000000-0000-4000-8000-000000000001','authenticated','authenticated','completion-tester@example.invalid','',now(),'{ "provider":"email","providers":["email"] }'::jsonb,'{"name":"Completion Tester"}'::jsonb,now(),now()),
  ('38000000-0000-4000-8000-000000000002','authenticated','authenticated','completion-developer@example.invalid','',now(),'{ "provider":"email","providers":["email"] }'::jsonb,'{"name":"Completion Developer"}'::jsonb,now(),now()),
  ('38000000-0000-4000-8000-000000000003','authenticated','authenticated','completion-admin@example.invalid','',now(),'{ "provider":"email","providers":["email"] }'::jsonb,'{"name":"Completion Admin"}'::jsonb,now(),now()),
  ('38000000-0000-4000-8000-000000000004','authenticated','authenticated','interrupted-tester@example.invalid','',now(),'{ "provider":"email","providers":["email"] }'::jsonb,'{"name":"Interrupted Tester"}'::jsonb,now(),now());

INSERT INTO rebuild_v2.user_roles(user_id,role)
VALUES
  ('38000000-0000-4000-8000-000000000002','developer'),
  ('38000000-0000-4000-8000-000000000003','admin')
ON CONFLICT (user_id,role) DO NOTHING;

INSERT INTO rebuild_v2.apps(developer_id,name,package_name,description,category,status)
VALUES (
  '38000000-0000-4000-8000-000000000002',
  '14 Day Completion Contract App','com.testdz.completion.contract',
  'Synthetic app for the 14-day completion contract.','tools','published'
);

INSERT INTO rebuild_v2.tests(
  app_id,developer_id,title,description,status,min_testers,start_date,end_date
)
SELECT a.id,'38000000-0000-4000-8000-000000000002',
  '14 Day Completion Contract Test','Synthetic assignment completion contract',
  'running',2,CURRENT_DATE-30,CURRENT_DATE+30
FROM rebuild_v2.apps a
WHERE a.package_name='com.testdz.completion.contract';

INSERT INTO rebuild_v2.cohorts(name,capacity,status,created_by,starts_at,ends_at)
VALUES (
  '14 Day Completion Contract Cohort',2,'running',
  '38000000-0000-4000-8000-000000000002',now()-interval '30 days',now()+interval '30 days'
);

INSERT INTO rebuild_v2.cohort_tests(cohort_id,test_id,developer_id)
SELECT c.id,t.id,t.developer_id
FROM rebuild_v2.cohorts c
CROSS JOIN rebuild_v2.tests t
WHERE c.name='14 Day Completion Contract Cohort'
  AND t.title='14 Day Completion Contract Test';

DO $completion_contract$
DECLARE
  v_tester constant uuid := '38000000-0000-4000-8000-000000000001';
  v_developer constant uuid := '38000000-0000-4000-8000-000000000002';
  v_admin constant uuid := '38000000-0000-4000-8000-000000000003';
  v_interrupted_tester constant uuid := '38000000-0000-4000-8000-000000000004';
  v_test uuid;
  v_cohort uuid;
  v_assignment uuid;
  v_interrupted_assignment uuid;
  v_feedback uuid;
  v_submission uuid;
  v_today date := rebuild_v2_private.algeria_local_date();
  v_start_date date;
  v_excused_date date;
  v_finalized boolean;
  v_checkin_id uuid;
  v_due_at timestamptz;
BEGIN
  SELECT t.id INTO v_test
  FROM rebuild_v2.tests t WHERE t.title='14 Day Completion Contract Test';
  SELECT c.id INTO v_cohort
  FROM rebuild_v2.cohorts c WHERE c.name='14 Day Completion Contract Cohort';

  -- 15 calendar dates, with one Admin-approved medical date skipped, produce
  -- exactly 14 required check-ins. The excused date is not a check-in.
  v_start_date := v_today-14;
  v_excused_date := v_today-7;

  INSERT INTO rebuild_v2.assignments(
    cohort_id,test_id,tester_id,status,started_at,due_at
  )
  VALUES(
    v_cohort,v_test,v_tester,'active',
    v_start_date::timestamp AT TIME ZONE 'Africa/Algiers',
    now()+interval '2 days'
  )
  RETURNING id INTO v_assignment;

  INSERT INTO rebuild_v2.medical_exception_requests(
    assignment_id,tester_id,reason,requested_dates,status,reviewed_by,reviewed_at,review_note
  )
  VALUES(
    v_assignment,v_tester,
    'Synthetic approved medical date for completion contract.',
    ARRAY[v_excused_date]::date[],'approved',v_admin,now(),
    'Approved for deterministic completion contract.'
  );
  UPDATE rebuild_v2.assignments
  SET medical_extension_days=1,
      medical_exception_approved_at=now(),
      medical_exception_approved_by=v_admin,
      medical_exception_note='Synthetic approved medical date.'
  WHERE id=v_assignment;

  INSERT INTO rebuild_v2.checkins(assignment_id,tester_id,checkin_date,note)
  SELECT v_assignment,v_tester,g.day::date,'Synthetic valid required-day check-in'
  FROM generate_series(v_start_date::timestamp,v_today::timestamp,interval '1 day') g(day)
  WHERE g.day::date<>v_excused_date;

  IF (SELECT count(*) FROM rebuild_v2.checkins WHERE assignment_id=v_assignment)<>14 THEN
    RAISE EXCEPTION 'FAIL: fixture must contain exactly 14 check-ins';
  END IF;
  IF EXISTS (
    SELECT 1 FROM rebuild_v2.checkins
    WHERE assignment_id=v_assignment AND checkin_date=v_excused_date
  ) THEN
    RAISE EXCEPTION 'FAIL: an approved medical date must not receive a check-in';
  END IF;
  IF NOT rebuild_v2_private.assignment_has_14_valid_checkins(v_assignment) THEN
    RAISE EXCEPTION 'FAIL: 14 valid required dates with one approved medical skip were not recognized';
  END IF;

  INSERT INTO rebuild_v2.feedback(assignment_id,tester_id,category,body,rating)
  VALUES(
    v_assignment,v_tester,'usability',
    'Synthetic feedback awaiting the separate Admin quality decision.',5
  )
  RETURNING id INTO v_feedback;

  PERFORM set_config('request.jwt.claim.sub',v_tester::text,true);
  PERFORM set_config('request.jwt.claims',
    jsonb_build_object('sub',v_tester,'role','authenticated')::text,true);
  v_submission := rebuild_v2.create_assignment_submission(
    v_assignment,
    'A complete synthetic report that satisfies the assignment submission summary requirements.',
    'Completion contract'
  );

  BEGIN
    PERFORM rebuild_v2.finalize_assignment_submission(v_submission);
    RAISE EXCEPTION 'FAIL: pending feedback quality bypassed the finalization gate';
  EXCEPTION WHEN SQLSTATE '55000' THEN
    IF SQLERRM<>'SUBMISSION_PREREQUISITES_NOT_MET' THEN
      RAISE EXCEPTION 'FAIL: unexpected pending-feedback gate response: %',SQLERRM;
    END IF;
  END;

  -- Admin accepts feedback quality. This is separate from developer feedback triage.
  PERFORM set_config('request.jwt.claim.sub',v_admin::text,true);
  PERFORM set_config('request.jwt.claims',
    jsonb_build_object('sub',v_admin,'role','authenticated')::text,true);
  IF NOT rebuild_v2.review_feedback_quality(
    v_feedback,'accepted','Detailed, relevant and actionable synthetic feedback.'
  ) THEN
    RAISE EXCEPTION 'FAIL: feedback quality could not be accepted';
  END IF;

  PERFORM set_config('request.jwt.claim.sub',v_tester::text,true);
  PERFORM set_config('request.jwt.claims',
    jsonb_build_object('sub',v_tester,'role','authenticated')::text,true);
  v_finalized := rebuild_v2.finalize_assignment_submission(v_submission);
  IF NOT v_finalized THEN
    RAISE EXCEPTION 'FAIL: complete 14-day assignment could not be finalized';
  END IF;
  IF (SELECT status FROM rebuild_v2.assignment_submissions WHERE id=v_submission)<>'submitted'
     OR (SELECT review_due_at FROM rebuild_v2.assignment_submissions WHERE id=v_submission)
        IS DISTINCT FROM (SELECT submitted_at+interval '72 hours' FROM rebuild_v2.assignment_submissions WHERE id=v_submission) THEN
    RAISE EXCEPTION 'FAIL: final report state or 72-hour review deadline missing';
  END IF;
  IF (SELECT status FROM rebuild_v2.assignments WHERE id=v_assignment)<>'active' THEN
    RAISE EXCEPTION 'FAIL: tester finalization must not complete the assignment before developer review';
  END IF;

  -- Approval rechecks the same prerequisite evaluator. If the feedback gate
  -- changes, approval must fail without writing a review decision.
  UPDATE rebuild_v2.feedback
  SET quality_status='rejected',reviewed_by=v_admin,reviewed_at=now()
  WHERE id=v_feedback;
  PERFORM set_config('request.jwt.claim.sub',v_developer::text,true);
  PERFORM set_config('request.jwt.claims',
    jsonb_build_object('sub',v_developer,'role','authenticated')::text,true);
  BEGIN
    PERFORM rebuild_v2.review_assignment_submission(v_submission,'approved',NULL);
    RAISE EXCEPTION 'FAIL: developer approval bypassed a failed quality prerequisite';
  EXCEPTION WHEN SQLSTATE '55000' THEN
    IF SQLERRM<>'SUBMISSION_PREREQUISITES_NOT_MET' THEN
      RAISE EXCEPTION 'FAIL: unexpected developer approval gate response: %',SQLERRM;
    END IF;
  END;
  IF (SELECT count(*) FROM rebuild_v2.assignment_submission_reviews
      WHERE submission_id=v_submission)<>0 THEN
    RAISE EXCEPTION 'FAIL: blocked approval must not append review history';
  END IF;

  UPDATE rebuild_v2.feedback
  SET quality_status='accepted',reviewed_by=v_admin,reviewed_at=now()
  WHERE id=v_feedback;
  IF NOT rebuild_v2.review_assignment_submission(v_submission,'approved',NULL) THEN
    RAISE EXCEPTION 'FAIL: owning developer could not approve a fully eligible submission';
  END IF;
  IF (SELECT status FROM rebuild_v2.assignments WHERE id=v_assignment)<>'completed'
     OR (SELECT status FROM rebuild_v2.assignment_submissions WHERE id=v_submission)<>'approved' THEN
    RAISE EXCEPTION 'FAIL: developer approval did not complete the assignment/report';
  END IF;
  IF (SELECT count(*) FROM rebuild_v2.assignment_submission_reviews
      WHERE submission_id=v_submission AND decision='approved')<>1 THEN
    RAISE EXCEPTION 'FAIL: developer approval decision history missing';
  END IF;

  -- A missed non-excused prior day marks the assignment failed atomically and
  -- does not insert a catch-up check-in for today.
  INSERT INTO rebuild_v2.assignments(
    cohort_id,test_id,tester_id,status,started_at,due_at
  )
  VALUES(
    v_cohort,v_test,v_interrupted_tester,'active',
    (v_today-3)::timestamp AT TIME ZONE 'Africa/Algiers',
    now()+interval '5 days'
  )
  RETURNING id INTO v_interrupted_assignment;

  INSERT INTO rebuild_v2.checkins(assignment_id,tester_id,checkin_date,note)
  VALUES
    (v_interrupted_assignment,v_interrupted_tester,v_today-3,'First required day'),
    (v_interrupted_assignment,v_interrupted_tester,v_today-1,'Later day after missed date');

  PERFORM set_config('request.jwt.claim.sub',v_interrupted_tester::text,true);
  PERFORM set_config('request.jwt.claims',
    jsonb_build_object('sub',v_interrupted_tester,'role','authenticated')::text,true);
  v_checkin_id := rebuild_v2.submit_checkin(v_interrupted_assignment,'Attempt after interruption');
  IF v_checkin_id IS NOT NULL THEN
    RAISE EXCEPTION 'FAIL: check-in after an unexcused missed day must not be accepted';
  END IF;
  IF (SELECT status FROM rebuild_v2.assignments WHERE id=v_interrupted_assignment)<>'failed' THEN
    RAISE EXCEPTION 'FAIL: missed required day did not fail the assignment';
  END IF;
  IF EXISTS (
    SELECT 1 FROM rebuild_v2.checkins
    WHERE assignment_id=v_interrupted_assignment AND checkin_date=v_today
  ) THEN
    RAISE EXCEPTION 'FAIL: a catch-up check-in was inserted after interruption';
  END IF;
  IF (SELECT count(*) FROM rebuild_v2.audit_events
      WHERE action='assignment.interrupted' AND target_id=v_interrupted_assignment)<>1 THEN
    RAISE EXCEPTION 'FAIL: assignment interruption audit missing';
  END IF;
  IF (SELECT count(*) FROM rebuild_v2.events
      WHERE event_type='notification.requested'
        AND aggregate_type='assignment'
        AND aggregate_id=v_interrupted_assignment
        AND payload->>'type'='assignment.interrupted')<>1 THEN
    RAISE EXCEPTION 'FAIL: assignment interruption did not notify tester';
  END IF;
END;
$completion_contract$;

ROLLBACK;
SELECT 'rebuild_v2_14_day_assignment_completion_contract: PASS' AS result;
