-- Developer cohort lifecycle happy-path and fail-closed transition contract.
-- Run ONLY against isolated TestDZ-FixLab after candidate SQL 001..032.
-- All synthetic users, app, test, cohort, assignments, and audit events are rolled back.

BEGIN;

INSERT INTO auth.users
 (id,aud,role,email,encrypted_password,email_confirmed_at,raw_app_meta_data,raw_user_meta_data,created_at,updated_at)
VALUES
 ('60000000-0000-4000-8000-000000000001','authenticated','authenticated','cohort-dev@example.invalid','',now(),'{ "provider":"email","providers":["email"] }'::jsonb,'{"name":"Cohort Developer"}'::jsonb,now(),now()),
 ('60000000-0000-4000-8000-000000000002','authenticated','authenticated','cohort-admin@example.invalid','',now(),'{ "provider":"email","providers":["email"] }'::jsonb,'{"name":"Cohort Admin"}'::jsonb,now(),now()),
 ('60000000-0000-4000-8000-000000000003','authenticated','authenticated','cohort-tester-one@example.invalid','',now(),'{ "provider":"email","providers":["email"] }'::jsonb,'{"name":"Cohort Tester One"}'::jsonb,now(),now()),
 ('60000000-0000-4000-8000-000000000004','authenticated','authenticated','cohort-tester-two@example.invalid','',now(),'{ "provider":"email","providers":["email"] }'::jsonb,'{"name":"Cohort Tester Two"}'::jsonb,now(),now());

INSERT INTO rebuild_v2.user_roles(user_id,role)
VALUES
 ('60000000-0000-4000-8000-000000000001','developer'),
 ('60000000-0000-4000-8000-000000000002','admin'),
 ('60000000-0000-4000-8000-000000000003','tester'),
 ('60000000-0000-4000-8000-000000000004','tester')
ON CONFLICT(user_id,role) DO NOTHING;

SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub','60000000-0000-4000-8000-000000000001',true);
SELECT set_config('request.jwt.claims','{"sub":"60000000-0000-4000-8000-000000000001","role":"authenticated"}',true);

DO $test$
DECLARE
  v_app uuid;
  v_test uuid;
  v_cohort uuid;
  v_assignment_one uuid;
  v_assignment_two uuid;
  v_count integer;
BEGIN
  v_app:=rebuild_v2.create_app(
    'Cohort Transition Demo',
    'dz.testdz.cohort-transition',
    'A synthetic app used only to exercise the developer cohort lifecycle contract.',
    'tools'
  );
  PERFORM rebuild_v2.submit_app_for_review(v_app);

  PERFORM set_config('request.jwt.claim.sub','60000000-0000-4000-8000-000000000002',true);
  PERFORM set_config('request.jwt.claims','{"sub":"60000000-0000-4000-8000-000000000002","role":"authenticated"}',true);
  PERFORM rebuild_v2.review_app(v_app,'approved','Synthetic app passed the cohort contract review.');

  PERFORM set_config('request.jwt.claim.sub','60000000-0000-4000-8000-000000000001',true);
  PERFORM set_config('request.jwt.claims','{"sub":"60000000-0000-4000-8000-000000000001","role":"authenticated"}',true);
  v_test:=rebuild_v2.create_test(
    v_app,
    'Cohort Transition Test',
    'A synthetic test description long enough to satisfy all V2 validation requirements.',
    'Cohort lifecycle contract',
    'usability',
    2,
    NULL,
    NULL,
    30,
    'Complete the synthetic test tasks.'
  );
  PERFORM rebuild_v2.submit_test_for_review(v_test);

  PERFORM set_config('request.jwt.claim.sub','60000000-0000-4000-8000-000000000002',true);
  PERFORM set_config('request.jwt.claims','{"sub":"60000000-0000-4000-8000-000000000002","role":"authenticated"}',true);
  PERFORM rebuild_v2.review_test(v_test,'approved','Synthetic test passed the cohort contract review.');

  PERFORM set_config('request.jwt.claim.sub','60000000-0000-4000-8000-000000000001',true);
  PERFORM set_config('request.jwt.claims','{"sub":"60000000-0000-4000-8000-000000000001","role":"authenticated"}',true);
  v_cohort:=rebuild_v2.create_test_cohort(v_test,'Transition Cohort',2,NULL,NULL);

  -- Two distinct testers join the forming cohort through the public workflow.
  PERFORM set_config('request.jwt.claim.sub','60000000-0000-4000-8000-000000000003',true);
  PERFORM set_config('request.jwt.claims','{"sub":"60000000-0000-4000-8000-000000000003","role":"authenticated"}',true);
  v_assignment_one:=rebuild_v2.join_test(v_test);

  PERFORM set_config('request.jwt.claim.sub','60000000-0000-4000-8000-000000000004',true);
  PERFORM set_config('request.jwt.claims','{"sub":"60000000-0000-4000-8000-000000000004","role":"authenticated"}',true);
  v_assignment_two:=rebuild_v2.join_test(v_test);

  SELECT count(*) INTO v_count
  FROM rebuild_v2.assignments
  WHERE cohort_id=v_cohort AND status NOT IN ('withdrawn','rejected');
  IF v_count<>2 THEN
    RAISE EXCEPTION 'FAIL: expected two active cohort registrations before ready, got %',v_count;
  END IF;

  -- A tester cannot advance a developer-owned cohort.
  BEGIN
    PERFORM rebuild_v2.transition_test_cohort(v_cohort,'ready','Tester must not control developer cohort');
    RAISE EXCEPTION 'FAIL: tester transitioned a developer cohort';
  EXCEPTION WHEN SQLSTATE '42501' THEN NULL;
  END;

  -- Owner can move forming -> ready once the minimum tester count is reached.
  PERFORM set_config('request.jwt.claim.sub','60000000-0000-4000-8000-000000000001',true);
  PERFORM set_config('request.jwt.claims','{"sub":"60000000-0000-4000-8000-000000000001","role":"authenticated"}',true);
  PERFORM rebuild_v2.transition_test_cohort(v_cohort,'ready','Minimum tester capacity reached for contract test.');
  IF NOT EXISTS(SELECT 1 FROM rebuild_v2.cohorts WHERE id=v_cohort AND status='ready') THEN
    RAISE EXCEPTION 'FAIL: forming -> ready transition did not persist';
  END IF;
  IF NOT EXISTS(SELECT 1 FROM rebuild_v2.tests WHERE id=v_test AND status='ready') THEN
    RAISE EXCEPTION 'FAIL: linked test did not advance to ready';
  END IF;

  -- Owner can move ready -> running and the linked test follows.
  PERFORM rebuild_v2.transition_test_cohort(v_cohort,'running','Start synthetic cohort lifecycle contract.');
  IF NOT EXISTS(SELECT 1 FROM rebuild_v2.cohorts WHERE id=v_cohort AND status='running') THEN
    RAISE EXCEPTION 'FAIL: ready -> running transition did not persist';
  END IF;
  IF NOT EXISTS(SELECT 1 FROM rebuild_v2.tests WHERE id=v_test AND status='running') THEN
    RAISE EXCEPTION 'FAIL: linked test did not advance to running';
  END IF;

  -- Pending assignments prevent completion; a failed transition must not mutate either status.
  BEGIN
    PERFORM rebuild_v2.transition_test_cohort(v_cohort,'completed','Premature completion must be blocked.');
    RAISE EXCEPTION 'FAIL: cohort completed with unfinished assignments';
  EXCEPTION WHEN SQLSTATE '55000' THEN NULL;
  END;
  IF NOT EXISTS(SELECT 1 FROM rebuild_v2.cohorts WHERE id=v_cohort AND status='running') THEN
    RAISE EXCEPTION 'FAIL: rejected completion changed cohort status';
  END IF;
  IF NOT EXISTS(SELECT 1 FROM rebuild_v2.tests WHERE id=v_test AND status='running') THEN
    RAISE EXCEPTION 'FAIL: rejected completion changed test status';
  END IF;

  -- Running cohorts cannot be cancelled through the forming/ready cancellation path.
  BEGIN
    PERFORM rebuild_v2.transition_test_cohort(v_cohort,'cancelled','Running cohort cancellation must be blocked.');
    RAISE EXCEPTION 'FAIL: running cohort was cancelled';
  EXCEPTION WHEN SQLSTATE '55000' THEN NULL;
  END;
  IF NOT EXISTS(SELECT 1 FROM rebuild_v2.cohorts WHERE id=v_cohort AND status='running') THEN
    RAISE EXCEPTION 'FAIL: rejected cancellation changed cohort status';
  END;

  SELECT count(*) INTO v_count
  FROM rebuild_v2.audit_events
  WHERE target_id=v_cohort AND action IN ('cohort.status.ready','cohort.status.running');
  IF v_count<>2 THEN
    RAISE EXCEPTION 'FAIL: expected exactly two successful cohort transition audit events, got %',v_count;
  END IF;
END;
$test$;

RESET ROLE;
ROLLBACK;

SELECT jsonb_build_object(
  'synthetic_auth_users_after_rollback',(SELECT count(*) FROM auth.users WHERE id IN ('60000000-0000-4000-8000-000000000001','60000000-0000-4000-8000-000000000002','60000000-0000-4000-8000-000000000003','60000000-0000-4000-8000-000000000004')),
  'synthetic_app_after_rollback',(SELECT count(*) FROM rebuild_v2.apps WHERE package_name='dz.testdz.cohort-transition'),
  'synthetic_test_after_rollback',(SELECT count(*) FROM rebuild_v2.tests WHERE title='Cohort Transition Test'),
  'synthetic_cohort_after_rollback',(SELECT count(*) FROM rebuild_v2.cohorts WHERE name='Transition Cohort'),
  'synthetic_assignments_after_rollback',(SELECT count(*) FROM rebuild_v2.assignments WHERE id IN ('00000000-0000-0000-0000-000000000000'))
) AS rollback_cleanup_check;
