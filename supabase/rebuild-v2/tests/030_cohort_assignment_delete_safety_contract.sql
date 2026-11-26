-- Cohort/assignment deletion and cancellation safety contract.
-- Run only on the disposable local Supabase database after all 34 candidate scripts.
-- Synthetic Auth and application rows are rolled back at the end.

BEGIN;

INSERT INTO auth.users
  (id,aud,role,email,encrypted_password,email_confirmed_at,
   raw_app_meta_data,raw_user_meta_data,created_at,updated_at)
VALUES
  ('30000000-0000-4000-8000-000000000001','authenticated','authenticated','v2-cohort-dev@example.invalid','',now(),
   '{"provider":"email","providers":["email"]}'::jsonb,'{"name":"V2 Cohort Developer"}'::jsonb,now(),now()),
  ('30000000-0000-4000-8000-000000000002','authenticated','authenticated','v2-cohort-tester@example.invalid','',now(),
   '{"provider":"email","providers":["email"]}'::jsonb,'{"name":"V2 Cohort Tester"}'::jsonb,now(),now());

INSERT INTO rebuild_v2.user_roles(user_id,role)
VALUES
  ('30000000-0000-4000-8000-000000000001','developer'),
  ('30000000-0000-4000-8000-000000000002','tester');

INSERT INTO rebuild_v2.apps(developer_id,name,package_name,description,category,status)
VALUES (
  '30000000-0000-4000-8000-000000000001',
  'V2 Delete Safety App','com.testdz.v2deletesafety',
  'Synthetic app for the cohort delete-safety contract.','tools','published'
);

INSERT INTO rebuild_v2.tests(app_id,developer_id,title,description,status,min_testers)
SELECT a.id,'30000000-0000-4000-8000-000000000001',
  'V2 Delete Safety Test','Synthetic test for deletion safety checks.','ready',1
FROM rebuild_v2.apps a
WHERE a.package_name='com.testdz.v2deletesafety';

INSERT INTO rebuild_v2.cohorts(name,capacity,status,created_by)
VALUES (
  'V2 Delete Safety Cohort',1,'ready',
  '30000000-0000-4000-8000-000000000001'
);

INSERT INTO rebuild_v2.cohort_tests(cohort_id,test_id,developer_id)
SELECT c.id,t.id,t.developer_id
FROM rebuild_v2.cohorts c
CROSS JOIN rebuild_v2.tests t
WHERE c.name='V2 Delete Safety Cohort'
  AND t.title='V2 Delete Safety Test';

INSERT INTO rebuild_v2.assignments(cohort_id,test_id,tester_id,status)
SELECT ct.cohort_id,ct.test_id,'30000000-0000-4000-8000-000000000002','active'
FROM rebuild_v2.cohort_tests ct
JOIN rebuild_v2.cohorts c ON c.id=ct.cohort_id
WHERE c.name='V2 Delete Safety Cohort';

INSERT INTO rebuild_v2.reports(reporter_id,assignment_id,report_type,description)
SELECT a.tester_id,a.id,'other',
  'Synthetic report retained to verify assignment deletion protection.'
FROM rebuild_v2.assignments a
JOIN rebuild_v2.cohorts c ON c.id=a.cohort_id
WHERE c.name='V2 Delete Safety Cohort';

DO $contract$
DECLARE
  v_cohort_id uuid;
  v_test_id uuid;
  v_assignment_id uuid;
  v_error text;
BEGIN
  SELECT c.id INTO v_cohort_id
  FROM rebuild_v2.cohorts c WHERE c.name='V2 Delete Safety Cohort';
  SELECT t.id INTO v_test_id
  FROM rebuild_v2.tests t WHERE t.title='V2 Delete Safety Test';
  SELECT a.id INTO v_assignment_id
  FROM rebuild_v2.assignments a WHERE a.cohort_id=v_cohort_id;

  -- A cohort with a cohort_tests membership must not be deleted.
  BEGIN
    DELETE FROM rebuild_v2.cohorts WHERE id=v_cohort_id;
    RAISE EXCEPTION 'FAIL: cohort deletion unexpectedly succeeded';
  EXCEPTION WHEN foreign_key_violation THEN
    NULL;
  END;
  IF NOT EXISTS (SELECT 1 FROM rebuild_v2.cohorts WHERE id=v_cohort_id) THEN
    RAISE EXCEPTION 'FAIL: blocked cohort deletion changed the row';
  END IF;

  -- A test referenced by cohort_tests must not be deleted.
  BEGIN
    DELETE FROM rebuild_v2.tests WHERE id=v_test_id;
    RAISE EXCEPTION 'FAIL: test deletion unexpectedly succeeded';
  EXCEPTION WHEN foreign_key_violation THEN
    NULL;
  END;
  IF NOT EXISTS (SELECT 1 FROM rebuild_v2.tests WHERE id=v_test_id) THEN
    RAISE EXCEPTION 'FAIL: blocked test deletion changed the row';
  END IF;

  -- Report history must prevent deletion of its assignment.
  BEGIN
    DELETE FROM rebuild_v2.assignments WHERE id=v_assignment_id;
    RAISE EXCEPTION 'FAIL: reported assignment deletion unexpectedly succeeded';
  EXCEPTION WHEN foreign_key_violation THEN
    NULL;
  END;
  IF NOT EXISTS (SELECT 1 FROM rebuild_v2.assignments WHERE id=v_assignment_id) THEN
    RAISE EXCEPTION 'FAIL: blocked assignment deletion changed the row';
  END IF;

  -- A cohort with active assignments cannot be cancelled.
  PERFORM set_config('request.jwt.claim.sub','30000000-0000-4000-8000-000000000001',true);
  PERFORM set_config(
    'request.jwt.claims',
    jsonb_build_object('sub','30000000-0000-4000-8000-000000000001','role','authenticated')::text,
    true
  );
  BEGIN
    PERFORM rebuild_v2.transition_test_cohort(v_cohort_id,'cancelled','Deletion safety contract');
    RAISE EXCEPTION 'FAIL: cohort with active assignments was cancelled';
  EXCEPTION WHEN SQLSTATE '55000' THEN
    GET STACKED DIAGNOSTICS v_error = MESSAGE_TEXT;
    IF v_error <> 'COHORT_HAS_ACTIVE_ASSIGNMENTS' THEN
      RAISE EXCEPTION 'FAIL: unexpected cancellation rejection: %',v_error;
    END IF;
  END;

  IF (SELECT status FROM rebuild_v2.cohorts WHERE id=v_cohort_id) <> 'ready' THEN
    RAISE EXCEPTION 'FAIL: blocked cancellation changed cohort status';
  END IF;
  IF (SELECT status FROM rebuild_v2.assignments WHERE id=v_assignment_id) <> 'active' THEN
    RAISE EXCEPTION 'FAIL: blocked cancellation changed assignment status';
  END IF;
END;
$contract$;

ROLLBACK;
