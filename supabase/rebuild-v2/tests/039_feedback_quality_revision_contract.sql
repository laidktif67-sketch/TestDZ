-- Feedback quality revision contract: only previously rejected feedback can be
-- revised by its owning tester, and every revision returns to pending.
BEGIN;

INSERT INTO auth.users
  (id,aud,role,email,encrypted_password,email_confirmed_at,
   raw_app_meta_data,raw_user_meta_data,created_at,updated_at)
VALUES
  ('39000000-0000-4000-8000-000000000001','authenticated','authenticated','revision-tester@example.invalid','',now(),'{ "provider":"email","providers":["email"] }'::jsonb,'{"name":"Revision Tester"}'::jsonb,now(),now()),
  ('39000000-0000-4000-8000-000000000002','authenticated','authenticated','revision-developer@example.invalid','',now(),'{ "provider":"email","providers":["email"] }'::jsonb,'{"name":"Revision Developer"}'::jsonb,now(),now()),
  ('39000000-0000-4000-8000-000000000003','authenticated','authenticated','revision-admin@example.invalid','',now(),'{ "provider":"email","providers":["email"] }'::jsonb,'{"name":"Revision Admin"}'::jsonb,now(),now()),
  ('39000000-0000-4000-8000-000000000004','authenticated','authenticated','revision-other-tester@example.invalid','',now(),'{ "provider":"email","providers":["email"] }'::jsonb,'{"name":"Other Tester"}'::jsonb,now(),now());

INSERT INTO rebuild_v2.user_roles(user_id,role)
VALUES
  ('39000000-0000-4000-8000-000000000002','developer'),
  ('39000000-0000-4000-8000-000000000003','admin')
ON CONFLICT (user_id,role) DO NOTHING;

INSERT INTO rebuild_v2.apps(developer_id,name,package_name,description,category,status)
VALUES (
  '39000000-0000-4000-8000-000000000002',
  'Feedback Revision Contract App','com.testdz.feedback.revision',
  'Synthetic app for feedback revision contract.','tools','published'
);

INSERT INTO rebuild_v2.tests(
  app_id,developer_id,title,description,status,min_testers,start_date,end_date
)
SELECT a.id,'39000000-0000-4000-8000-000000000002',
  'Feedback Revision Contract Test','Synthetic feedback revision contract',
  'running',1,CURRENT_DATE-5,CURRENT_DATE+20
FROM rebuild_v2.apps a
WHERE a.package_name='com.testdz.feedback.revision';

INSERT INTO rebuild_v2.cohorts(name,capacity,status,created_by,starts_at,ends_at)
VALUES (
  'Feedback Revision Contract Cohort',1,'running',
  '39000000-0000-4000-8000-000000000002',now()-interval '5 days',now()+interval '20 days'
);

INSERT INTO rebuild_v2.cohort_tests(cohort_id,test_id,developer_id)
SELECT c.id,t.id,t.developer_id
FROM rebuild_v2.cohorts c
CROSS JOIN rebuild_v2.tests t
WHERE c.name='Feedback Revision Contract Cohort'
  AND t.title='Feedback Revision Contract Test';

INSERT INTO rebuild_v2.assignments(
  cohort_id,test_id,tester_id,status,started_at,due_at
)
SELECT ct.cohort_id,ct.test_id,
  '39000000-0000-4000-8000-000000000001','active',now()-interval '4 days',now()+interval '10 days'
FROM rebuild_v2.cohort_tests ct
JOIN rebuild_v2.tests t ON t.id=ct.test_id
WHERE t.title='Feedback Revision Contract Test';

INSERT INTO rebuild_v2.feedback(
  assignment_id,tester_id,category,body,rating,quality_status,reviewed_by,reviewed_at
)
SELECT a.id,a.tester_id,'general',
  'Original feedback rejected for insufficient detail in this synthetic contract.',
  2,'rejected','39000000-0000-4000-8000-000000000003',now()
FROM rebuild_v2.assignments a
JOIN rebuild_v2.tests t ON t.id=a.test_id
WHERE t.title='Feedback Revision Contract Test';

DO $feedback_revision_contract$
DECLARE
  v_tester constant uuid := '39000000-0000-4000-8000-000000000001';
  v_other constant uuid := '39000000-0000-4000-8000-000000000004';
  v_admin constant uuid := '39000000-0000-4000-8000-000000000003';
  v_assignment uuid;
  v_feedback uuid;
  v_result uuid;
BEGIN
  SELECT a.id INTO v_assignment
  FROM rebuild_v2.assignments a
  JOIN rebuild_v2.tests t ON t.id=a.test_id
  WHERE t.title='Feedback Revision Contract Test';
  SELECT f.id INTO v_feedback FROM rebuild_v2.feedback f WHERE f.assignment_id=v_assignment;

  PERFORM set_config('request.jwt.claim.sub',v_other::text,true);
  PERFORM set_config('request.jwt.claims',
    jsonb_build_object('sub',v_other,'role','authenticated')::text,true);
  BEGIN
    PERFORM rebuild_v2.revise_tester_feedback(
      v_assignment,'bug','This is a sufficiently detailed revised feedback body.',4::smallint
    );
    RAISE EXCEPTION 'FAIL: another tester revised feedback they do not own';
  EXCEPTION WHEN SQLSTATE '42501' THEN NULL;
  END;

  PERFORM set_config('request.jwt.claim.sub',v_tester::text,true);
  PERFORM set_config('request.jwt.claims',
    jsonb_build_object('sub',v_tester,'role','authenticated')::text,true);
  v_result := rebuild_v2.revise_tester_feedback(
    v_assignment,'bug',
    'Revised feedback includes reproducible steps, expected behavior and observed results.',
    4::smallint
  );
  IF v_result<>v_feedback THEN
    RAISE EXCEPTION 'FAIL: feedback revision must preserve the original feedback id';
  END IF;
  IF (SELECT quality_status FROM rebuild_v2.feedback WHERE id=v_feedback)<>'pending'
     OR (SELECT reviewed_by FROM rebuild_v2.feedback WHERE id=v_feedback) IS NOT NULL
     OR (SELECT reviewed_at FROM rebuild_v2.feedback WHERE id=v_feedback) IS NOT NULL
     OR (SELECT category FROM rebuild_v2.feedback WHERE id=v_feedback)<>'bug'
     OR (SELECT rating FROM rebuild_v2.feedback WHERE id=v_feedback)<>4 THEN
    RAISE EXCEPTION 'FAIL: revised feedback did not return to pending with review metadata reset';
  END IF;
  IF (SELECT count(*) FROM rebuild_v2.audit_events
      WHERE action='feedback.quality_revised' AND target_id=v_feedback
        AND metadata->'before'->>'quality_status'='rejected'
        AND metadata->'after'->>'quality_status'='pending')<>1 THEN
    RAISE EXCEPTION 'FAIL: feedback revision audit before/after state missing';
  END IF;
  IF (SELECT count(*) FROM rebuild_v2.events
      WHERE event_type='notification.requested'
        AND aggregate_type='feedback' AND aggregate_id=v_feedback
        AND payload->>'type'='feedback.revised')<>1 THEN
    RAISE EXCEPTION 'FAIL: feedback revision did not enqueue developer notification';
  END IF;

  BEGIN
    PERFORM rebuild_v2.revise_tester_feedback(
      v_assignment,'general','Another revision while the quality decision is pending.',3::smallint
    );
    RAISE EXCEPTION 'FAIL: pending feedback was revised again before Admin review';
  EXCEPTION WHEN SQLSTATE '55000' THEN
    IF SQLERRM<>'FEEDBACK_QUALITY_NOT_REVISABLE' THEN
      RAISE EXCEPTION 'FAIL: unexpected pending revision response: %',SQLERRM;
    END IF;
  END;

  PERFORM set_config('request.jwt.claim.sub',v_admin::text,true);
  PERFORM set_config('request.jwt.claims',
    jsonb_build_object('sub',v_admin,'role','authenticated')::text,true);
  PERFORM rebuild_v2.review_feedback_quality(
    v_feedback,'accepted','Revised feedback now meets quality standards.'
  );

  PERFORM set_config('request.jwt.claim.sub',v_tester::text,true);
  PERFORM set_config('request.jwt.claims',
    jsonb_build_object('sub',v_tester,'role','authenticated')::text,true);
  BEGIN
    PERFORM rebuild_v2.revise_tester_feedback(
      v_assignment,'general','Accepted feedback cannot be edited through revision.',3::smallint
    );
    RAISE EXCEPTION 'FAIL: accepted feedback was revised';
  EXCEPTION WHEN SQLSTATE '55000' THEN
    IF SQLERRM<>'FEEDBACK_QUALITY_NOT_REVISABLE' THEN
      RAISE EXCEPTION 'FAIL: unexpected accepted revision response: %',SQLERRM;
    END IF;
  END;
END;
$feedback_revision_contract$;

ROLLBACK;
SELECT 'rebuild_v2_feedback_quality_revision_contract: PASS' AS result;
