-- Medical exception and feedback-quality review contracts.
-- Disposable local rebuild_v2 replay only; all synthetic rows are rolled back.
BEGIN;

INSERT INTO auth.users
  (id,aud,role,email,encrypted_password,email_confirmed_at,
   raw_app_meta_data,raw_user_meta_data,created_at,updated_at)
VALUES
  ('37000000-0000-4000-8000-000000000001','authenticated','authenticated','medical-tester@example.invalid','',now(),'{ "provider":"email","providers":["email"] }'::jsonb,'{"name":"Medical Tester"}'::jsonb,now(),now()),
  ('37000000-0000-4000-8000-000000000002','authenticated','authenticated','medical-admin@example.invalid','',now(),'{ "provider":"email","providers":["email"] }'::jsonb,'{"name":"Medical Admin"}'::jsonb,now(),now()),
  ('37000000-0000-4000-8000-000000000003','authenticated','authenticated','medical-support@example.invalid','',now(),'{ "provider":"email","providers":["email"] }'::jsonb,'{"name":"Medical Support"}'::jsonb,now(),now());

INSERT INTO rebuild_v2.user_roles(user_id,role)
VALUES
  ('37000000-0000-4000-8000-000000000002','admin'),
  ('37000000-0000-4000-8000-000000000003','support')
ON CONFLICT (user_id,role) DO NOTHING;

INSERT INTO rebuild_v2.apps(developer_id,name,package_name,description,category,status)
VALUES (
  '37000000-0000-4000-8000-000000000002',
  'Medical Review Contract App','com.testdz.medical.review',
  'Synthetic app for medical exception and feedback review contracts.','tools','published'
);

INSERT INTO rebuild_v2.tests(
  app_id,developer_id,title,description,status,min_testers,start_date,end_date
)
SELECT a.id,'37000000-0000-4000-8000-000000000002',
  'Medical Review Contract Test','Synthetic medical review contract',
  'running',1,CURRENT_DATE-20,CURRENT_DATE+20
FROM rebuild_v2.apps a
WHERE a.package_name='com.testdz.medical.review';

INSERT INTO rebuild_v2.cohorts(name,capacity,status,created_by,starts_at,ends_at)
VALUES (
  'Medical Review Contract Cohort',1,'running',
  '37000000-0000-4000-8000-000000000002',now()-interval '20 days',now()+interval '20 days'
);

INSERT INTO rebuild_v2.cohort_tests(cohort_id,test_id,developer_id)
SELECT c.id,t.id,t.developer_id
FROM rebuild_v2.cohorts c
CROSS JOIN rebuild_v2.tests t
WHERE c.name='Medical Review Contract Cohort'
  AND t.title='Medical Review Contract Test';

INSERT INTO rebuild_v2.assignments(
  cohort_id,test_id,tester_id,status,started_at,due_at
)
SELECT ct.cohort_id,ct.test_id,
  '37000000-0000-4000-8000-000000000001','active',
  (rebuild_v2_private.algeria_local_date()-10)::timestamp AT TIME ZONE 'Africa/Algiers',
  now()+interval '10 days'
FROM rebuild_v2.cohort_tests ct
JOIN rebuild_v2.tests t ON t.id=ct.test_id
WHERE t.title='Medical Review Contract Test';

INSERT INTO rebuild_v2.checkins(assignment_id,tester_id,checkin_date,note)
SELECT a.id,a.tester_id,g.day::date,'Existing valid check-in'
FROM rebuild_v2.assignments a
JOIN rebuild_v2.tests t ON t.id=a.test_id
CROSS JOIN LATERAL generate_series(
  rebuild_v2_private.algeria_local_date()-10,
  rebuild_v2_private.algeria_local_date()-1,
  interval '1 day'
) g(day)
WHERE t.title='Medical Review Contract Test'
  AND g.day::date NOT IN (
    rebuild_v2_private.algeria_local_date()-5,
    rebuild_v2_private.algeria_local_date()-4,
    rebuild_v2_private.algeria_local_date()-3
  );

INSERT INTO rebuild_v2.feedback(assignment_id,tester_id,category,body,rating)
SELECT a.id,a.tester_id,'usability',
  'Synthetic feedback with enough detail for quality review contract testing.',5
FROM rebuild_v2.assignments a
JOIN rebuild_v2.tests t ON t.id=a.test_id
WHERE t.title='Medical Review Contract Test';

DO $medical_quality_contract$
DECLARE
  v_tester constant uuid := '37000000-0000-4000-8000-000000000001';
  v_admin constant uuid := '37000000-0000-4000-8000-000000000002';
  v_support constant uuid := '37000000-0000-4000-8000-000000000003';
  v_assignment uuid;
  v_feedback uuid;
  v_request uuid;
  v_rejected_request uuid;
  v_partial_assignment uuid;
  v_partial_request uuid;
  v_after_failure_request uuid;
  v_today date := rebuild_v2_private.algeria_local_date();
  v_due_before timestamptz;
  v_due_after timestamptz;
  v_extension_before integer;
  v_extension_after integer;
  v_path text;
  v_checkin uuid;
  v_file constant uuid := '37000000-0000-4000-8000-000000000099';
  v_error text;
BEGIN
  SELECT a.id,a.due_at,a.medical_extension_days
  INTO v_assignment,v_due_before,v_extension_before
  FROM rebuild_v2.assignments a
  JOIN rebuild_v2.tests t ON t.id=a.test_id
  WHERE t.title='Medical Review Contract Test';

  SELECT f.id INTO v_feedback
  FROM rebuild_v2.feedback f WHERE f.assignment_id=v_assignment;

  -- Tester can create a request, but duplicate dates and check-in dates are rejected.
  PERFORM set_config('request.jwt.claim.sub',v_tester::text,true);
  PERFORM set_config('request.jwt.claims',
    jsonb_build_object('sub',v_tester,'role','authenticated')::text,true);

  BEGIN
    PERFORM rebuild_v2.create_medical_exception_request(
      v_assignment,'A sufficiently detailed synthetic medical reason for this test.',
      ARRAY[v_today-2]::date[]
    );
    RAISE EXCEPTION 'FAIL: medical exception overlapped an existing check-in';
  EXCEPTION WHEN SQLSTATE '23514' THEN NULL;
  END;

  BEGIN
    PERFORM rebuild_v2.create_medical_exception_request(
      v_assignment,'A sufficiently detailed synthetic medical reason for this test.',
      ARRAY[v_today-4,v_today-4]::date[]
    );
    RAISE EXCEPTION 'FAIL: duplicate dates were accepted';
  EXCEPTION WHEN SQLSTATE '22023' THEN NULL;
  END;

  v_request := rebuild_v2.create_medical_exception_request(
    v_assignment,
    'A sufficiently detailed synthetic medical reason for this test.',
    ARRAY[v_today-4,v_today-3]::date[]
  );
  IF v_request IS NULL THEN
    RAISE EXCEPTION 'FAIL: tester could not create a valid medical exception request';
  END IF;

  -- Evidence upload is isolated, private, and bound to this tester/request.
  v_path := v_assignment::text||'/'||v_tester::text||'/'||v_request::text||'/'||v_file::text||'.pdf';
  IF NOT rebuild_v2_private.can_upload_medical_exception_evidence(v_path) THEN
    RAISE EXCEPTION 'FAIL: valid pending request did not authorize its evidence path';
  END IF;
  PERFORM set_config('role','authenticated',true);
  INSERT INTO storage.objects(bucket_id,name,owner,owner_id,metadata)
  VALUES(
    'medical-exception-evidence',v_path,v_tester,v_tester::text,
    jsonb_build_object('mimetype','application/pdf','size',2048)
  );
  IF NOT rebuild_v2.attach_medical_exception_evidence(v_request,v_path) THEN
    RAISE EXCEPTION 'FAIL: evidence could not be registered after Storage verification';
  END IF;
  PERFORM set_config('role','none',true);

  -- Support must not approve medical exceptions or read medical evidence.
  PERFORM set_config('request.jwt.claim.sub',v_support::text,true);
  PERFORM set_config('request.jwt.claims',
    jsonb_build_object('sub',v_support,'role','authenticated')::text,true);
  IF rebuild_v2_private.can_read_medical_exception_evidence(v_path) THEN
    RAISE EXCEPTION 'FAIL: Support can read sensitive medical evidence';
  END IF;
  BEGIN
    PERFORM rebuild_v2.review_medical_exception(v_request,'approved','A valid administrative decision note.');
    RAISE EXCEPTION 'FAIL: Support approved a medical exception';
  EXCEPTION WHEN SQLSTATE '42501' THEN NULL;
  END;

  -- Admin review extends due_at by exactly one day per approved requested date.
  PERFORM set_config('request.jwt.claim.sub',v_admin::text,true);
  PERFORM set_config('request.jwt.claims',
    jsonb_build_object('sub',v_admin,'role','authenticated')::text,true);
  IF NOT rebuild_v2_private.can_read_medical_exception_evidence(v_path) THEN
    RAISE EXCEPTION 'FAIL: Admin cannot read attached medical evidence';
  END IF;
  IF NOT rebuild_v2.review_medical_exception(
    v_request,'approved','Approved after review of the submitted request and evidence.'
  ) THEN
    RAISE EXCEPTION 'FAIL: Admin could not approve a valid medical exception';
  END IF;

  SELECT due_at,medical_extension_days
  INTO v_due_after,v_extension_after
  FROM rebuild_v2.assignments WHERE id=v_assignment;
  IF v_due_after IS DISTINCT FROM v_due_before+interval '2 days'
     OR v_extension_after<>v_extension_before+2 THEN
    RAISE EXCEPTION 'FAIL: approved exception must extend due_at and extension counter by exactly two days';
  END IF;
  IF (SELECT status FROM rebuild_v2.medical_exception_requests WHERE id=v_request)<>'approved'
     OR (SELECT reviewed_by FROM rebuild_v2.medical_exception_requests WHERE id=v_request)<>v_admin THEN
    RAISE EXCEPTION 'FAIL: medical review decision metadata missing';
  END IF;
  IF (SELECT count(*) FROM rebuild_v2.checkins
      WHERE assignment_id=v_assignment AND checkin_date IN (v_today-4,v_today-3))<>0 THEN
    RAISE EXCEPTION 'FAIL: approved medical dates must not become check-ins';
  END IF;
  IF (SELECT count(*) FROM rebuild_v2.audit_events
      WHERE action='medical_exception.approved' AND target_id=v_request
        AND metadata->'before'->>'medical_extension_days'=v_extension_before::text
        AND metadata->'after'->>'medical_extension_days'=v_extension_after::text)<>1 THEN
    RAISE EXCEPTION 'FAIL: medical approval audit before/after state missing';
  END IF;
  IF (SELECT count(*) FROM rebuild_v2.events
      WHERE event_type='notification.requested'
        AND aggregate_type='medical_exception_request'
        AND aggregate_id=v_request
        AND payload->>'type'='assignment.medical_exception_approved')<>1 THEN
    RAISE EXCEPTION 'FAIL: medical approval did not enqueue exactly one tester notification';
  END IF;

  BEGIN
    PERFORM rebuild_v2.review_medical_exception(v_request,'approved','Repeated decision attempt.');
    RAISE EXCEPTION 'FAIL: medical request was reviewed more than once';
  EXCEPTION WHEN SQLSTATE '55000' THEN NULL;
  END;

  -- A pending request does not pause the schedule. The missed date fails the
  -- assignment, but Admin can still review the pending request afterward.
  PERFORM set_config('request.jwt.claim.sub',v_tester::text,true);
  PERFORM set_config('request.jwt.claims',
    jsonb_build_object('sub',v_tester,'role','authenticated')::text,true);
  v_rejected_request := rebuild_v2.create_medical_exception_request(
    v_assignment,
    'Another sufficiently detailed synthetic reason for a late approval test.',
    ARRAY[v_today-5]::date[]
  );

  v_checkin:=rebuild_v2.submit_checkin(
    v_assignment,'Current-day check-in after an earlier date was missed.'
  );
  IF v_checkin IS NOT NULL
     OR (SELECT status FROM rebuild_v2.assignments WHERE id=v_assignment)<>'failed' THEN
    RAISE EXCEPTION 'FAIL: pending medical request incorrectly paused the missed-day interruption';
  END IF;
  IF (SELECT due_at FROM rebuild_v2.assignments WHERE id=v_assignment)<>v_due_after THEN
    RAISE EXCEPTION 'FAIL: pending medical request changed the assignment due date';
  END IF;

  PERFORM set_config('request.jwt.claim.sub',v_admin::text,true);
  PERFORM set_config('request.jwt.claims',
    jsonb_build_object('sub',v_admin,'role','authenticated')::text,true);
  IF NOT rebuild_v2.review_medical_exception(
    v_rejected_request,'approved','Approved after the assignment was interrupted.'
  ) THEN
    RAISE EXCEPTION 'FAIL: Admin could not approve a pending request after assignment failure';
  END IF;
  IF (SELECT status FROM rebuild_v2.assignments WHERE id=v_assignment)<>'active'
     OR (SELECT medical_extension_days FROM rebuild_v2.assignments WHERE id=v_assignment)<>v_extension_before+3
     OR (SELECT due_at FROM rebuild_v2.assignments WHERE id=v_assignment)<>v_due_after+interval '1 day'
     OR (SELECT count(*) FROM rebuild_v2.audit_events
         WHERE action='assignment.reactivated_after_medical_approval' AND target_id=v_assignment)<>1 THEN
    RAISE EXCEPTION 'FAIL: valid late medical approval did not extend and safely reactivate the assignment';
  END IF;

  -- Rejection still adds no extension and fails an active assignment when the
  -- requested current required date remains unchecked.
  v_rejected_request := rebuild_v2.create_medical_exception_request(
    v_assignment,
    'A separate sufficiently detailed reason for a rejection contract.',
    ARRAY[v_today]::date[]
  );
  IF NOT rebuild_v2.review_medical_exception(
    v_rejected_request,'rejected','Rejected after administrative review.'
  ) THEN
    RAISE EXCEPTION 'FAIL: Admin could not reject a valid medical request';
  END IF;
  IF (SELECT medical_extension_days FROM rebuild_v2.assignments WHERE id=v_assignment)<>v_extension_before+3
     OR (SELECT status FROM rebuild_v2.assignments WHERE id=v_assignment)<>'failed' THEN
    RAISE EXCEPTION 'FAIL: rejected request changed extension days or failed to interrupt the assignment';
  END IF;

  -- A late approval must not revive an assignment if another elapsed required
  -- day remains unexcused.
  INSERT INTO rebuild_v2.assignments(
    cohort_id,test_id,tester_id,status,started_at,due_at
  )
  SELECT cohort_id,test_id,v_tester,'active',
    (v_today-5)::timestamp AT TIME ZONE 'Africa/Algiers',
    now()+interval '10 days'
  FROM rebuild_v2.assignments WHERE id=v_assignment
  RETURNING id INTO v_partial_assignment;

  INSERT INTO rebuild_v2.checkins(assignment_id,tester_id,checkin_date,note)
  SELECT v_partial_assignment,v_tester,g.day::date,'Partial recovery fixture check-in'
  FROM generate_series(v_today-5,v_today-3,interval '1 day') g(day);

  PERFORM set_config('request.jwt.claim.sub',v_tester::text,true);
  PERFORM set_config('request.jwt.claims',
    jsonb_build_object('sub',v_tester,'role','authenticated')::text,true);
  v_partial_request := rebuild_v2.create_medical_exception_request(
    v_partial_assignment,
    'A detailed medical reason for one of two missed dates in the partial recovery test.',
    ARRAY[v_today-1]::date[]
  );
  v_checkin := rebuild_v2.submit_checkin(
    v_partial_assignment,'Attempt after two prior dates were missed.'
  );
  IF v_checkin IS NOT NULL
     OR (SELECT status FROM rebuild_v2.assignments WHERE id=v_partial_assignment)<>'failed' THEN
    RAISE EXCEPTION 'FAIL: partial-recovery fixture did not fail on the unexcused date';
  END IF;

  PERFORM set_config('request.jwt.claim.sub',v_admin::text,true);
  PERFORM set_config('request.jwt.claims',
    jsonb_build_object('sub',v_admin,'role','authenticated')::text,true);
  IF NOT rebuild_v2.review_medical_exception(
    v_partial_request,'approved','Approved only the requested date; another missed day remains.'
  ) THEN
    RAISE EXCEPTION 'FAIL: Admin could not adjudicate the partial recovery request';
  END IF;
  IF (SELECT status FROM rebuild_v2.assignments WHERE id=v_partial_assignment)<>'failed'
     OR (SELECT count(*) FROM rebuild_v2.audit_events
         WHERE action='medical_exception.approved'
           AND target_id=v_partial_request
           AND (metadata->>'remaining_unexcused_missed_days')::integer=1)<>1 THEN
    RAISE EXCEPTION 'FAIL: approval revived an assignment with another unexcused missed date';
  END IF;

  -- The tester can submit a second request after failure. Once every missed
  -- date is explicitly approved, the assignment can be reactivated.
  PERFORM set_config('request.jwt.claim.sub',v_tester::text,true);
  PERFORM set_config('request.jwt.claims',
    jsonb_build_object('sub',v_tester,'role','authenticated')::text,true);
  v_after_failure_request := rebuild_v2.create_medical_exception_request(
    v_partial_assignment,
    'A detailed reason for the remaining missed date submitted after failure.',
    ARRAY[v_today-2]::date[]
  );
  PERFORM set_config('request.jwt.claim.sub',v_admin::text,true);
  PERFORM set_config('request.jwt.claims',
    jsonb_build_object('sub',v_admin,'role','authenticated')::text,true);
  IF NOT rebuild_v2.review_medical_exception(
    v_after_failure_request,'approved','Approved the remaining missed date after failure.'
  ) THEN
    RAISE EXCEPTION 'FAIL: Admin could not review a request created after assignment failure';
  END IF;
  IF (SELECT status FROM rebuild_v2.assignments WHERE id=v_partial_assignment)<>'active'
     OR (SELECT medical_extension_days FROM rebuild_v2.assignments WHERE id=v_partial_assignment)<>2 THEN
    RAISE EXCEPTION 'FAIL: final valid late approval did not reactivate the assignment';
  END IF;

  -- Feedback quality is an Admin-only gate, separate from developer triage.
  PERFORM set_config('request.jwt.claim.sub',v_support::text,true);
  PERFORM set_config('request.jwt.claims',
    jsonb_build_object('sub',v_support,'role','authenticated')::text,true);
  BEGIN
    PERFORM rebuild_v2.review_feedback_quality(
      v_feedback,'accepted','A valid synthetic feedback quality review note.'
    );
    RAISE EXCEPTION 'FAIL: Support reviewed feedback quality';
  EXCEPTION WHEN SQLSTATE '42501' THEN NULL;
  END;

  PERFORM set_config('request.jwt.claim.sub',v_admin::text,true);
  PERFORM set_config('request.jwt.claims',
    jsonb_build_object('sub',v_admin,'role','authenticated')::text,true);
  IF NOT rebuild_v2.review_feedback_quality(
    v_feedback,'accepted','The feedback is detailed, relevant, and actionable.'
  ) THEN
    RAISE EXCEPTION 'FAIL: Admin could not accept feedback quality';
  END IF;
  IF (SELECT quality_status FROM rebuild_v2.feedback WHERE id=v_feedback)<>'accepted'
     OR (SELECT reviewed_by FROM rebuild_v2.feedback WHERE id=v_feedback)<>v_admin
     OR (SELECT reviewed_at FROM rebuild_v2.feedback WHERE id=v_feedback) IS NULL THEN
    RAISE EXCEPTION 'FAIL: feedback quality review metadata missing';
  END IF;
  IF (SELECT count(*) FROM rebuild_v2.audit_events
      WHERE action='feedback.quality_accepted' AND target_id=v_feedback)<>1 THEN
    RAISE EXCEPTION 'FAIL: feedback quality review audit missing';
  END IF;
  IF (SELECT count(*) FROM rebuild_v2.events
      WHERE event_type='notification.requested'
        AND aggregate_type='feedback' AND aggregate_id=v_feedback
        AND payload->>'type'='feedback.quality_accepted')<>1 THEN
    RAISE EXCEPTION 'FAIL: feedback quality decision did not notify tester';
  END IF;
  BEGIN
    PERFORM rebuild_v2.review_feedback_quality(
      v_feedback,'rejected','A second decision must not overwrite the first.'
    );
    RAISE EXCEPTION 'FAIL: feedback quality decision was overwritten';
  EXCEPTION WHEN SQLSTATE '55000' THEN NULL;
  END;
END;
$medical_quality_contract$;

ROLLBACK;
SELECT 'rebuild_v2_medical_exception_and_feedback_quality_contract: PASS' AS result;
