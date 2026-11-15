-- Developer app -> test -> cohort -> tester join runtime contract.
-- Run ONLY against isolated TestDZ-FixLab after candidate SQL 001..008.
-- Synthetic Auth/profile/app/test/cohort/assignment rows are rolled back.

BEGIN;
INSERT INTO auth.users
 (id,aud,role,email,encrypted_password,email_confirmed_at,raw_app_meta_data,raw_user_meta_data,created_at,updated_at)
VALUES
 ('50000000-0000-4000-8000-000000000001','authenticated','authenticated','v2-lifecycle-dev@example.invalid','',now(),'{"provider":"email","providers":["email"]}'::jsonb,'{"name":"Lifecycle Developer"}'::jsonb,now(),now()),
 ('50000000-0000-4000-8000-000000000002','authenticated','authenticated','v2-lifecycle-admin@example.invalid','',now(),'{"provider":"email","providers":["email"]}'::jsonb,'{"name":"Lifecycle Admin"}'::jsonb,now(),now()),
 ('50000000-0000-4000-8000-000000000003','authenticated','authenticated','v2-lifecycle-tester@example.invalid','',now(),'{"provider":"email","providers":["email"]}'::jsonb,'{"name":"Lifecycle Tester"}'::jsonb,now(),now());

INSERT INTO rebuild_v2.user_roles(user_id,role)
VALUES
 ('50000000-0000-4000-8000-000000000001','developer'),
 ('50000000-0000-4000-8000-000000000002','admin'),
 ('50000000-0000-4000-8000-000000000003','tester')
ON CONFLICT(user_id,role) DO NOTHING;

SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub','50000000-0000-4000-8000-000000000001',true);
SELECT set_config('request.jwt.claims','{"sub":"50000000-0000-4000-8000-000000000001","role":"authenticated"}',true);

DO $test$
DECLARE v_app uuid; v_test uuid; v_cohort uuid; v_assignment uuid; v_count integer;
BEGIN
  v_app:=rebuild_v2.create_app('Lifecycle Demo App','dz.testdz.lifecycle','A synthetic application used only for a rolled-back developer lifecycle contract.','tools');
  PERFORM rebuild_v2.submit_app_for_review(v_app);
  BEGIN
    PERFORM rebuild_v2.update_app(v_app,'Attempted Review Edit','This attempted update must be blocked while the app is pending moderation.','tools',NULL);
    RAISE EXCEPTION 'FAIL: developer edited an app during review';
  EXCEPTION WHEN SQLSTATE 'P0002' THEN NULL;
  END;
  IF NOT EXISTS(SELECT 1 FROM rebuild_v2.apps WHERE id=v_app AND status='submitted') THEN RAISE EXCEPTION 'FAIL: app submission'; END IF;

  PERFORM set_config('request.jwt.claim.sub','50000000-0000-4000-8000-000000000003',true);
  PERFORM set_config('request.jwt.claims','{"sub":"50000000-0000-4000-8000-000000000003","role":"authenticated"}',true);
  BEGIN
    PERFORM rebuild_v2.review_app(v_app,'approved','Tester must not approve app');
    RAISE EXCEPTION 'FAIL: non-admin approved app';
  EXCEPTION WHEN SQLSTATE '42501' THEN NULL;
  END;

  PERFORM set_config('request.jwt.claim.sub','50000000-0000-4000-8000-000000000002',true);
  PERFORM set_config('request.jwt.claims','{"sub":"50000000-0000-4000-8000-000000000002","role":"authenticated"}',true);
  PERFORM rebuild_v2.review_app(v_app,'approved','App meets the synthetic review checklist');
  IF NOT EXISTS(SELECT 1 FROM rebuild_v2.apps WHERE id=v_app AND status='published') THEN RAISE EXCEPTION 'FAIL: app approval did not publish'; END IF;

  PERFORM set_config('request.jwt.claim.sub','50000000-0000-4000-8000-000000000001',true);
  PERFORM set_config('request.jwt.claims','{"sub":"50000000-0000-4000-8000-000000000001","role":"authenticated"}',true);
  BEGIN
    PERFORM rebuild_v2.update_app(v_app,'Attempted Published Edit','A published app must use a future re-review workflow before changing metadata.','tools',NULL);
    RAISE EXCEPTION 'FAIL: developer edited a published app';
  EXCEPTION WHEN SQLSTATE 'P0002' THEN NULL;
  END;
  PERFORM set_config('request.jwt.claims','{"sub":"50000000-0000-4000-8000-000000000001","role":"authenticated"}',true);
  v_test:=rebuild_v2.create_test(v_app,'Lifecycle Test','A synthetic test description that is long enough to satisfy the V2 contract validation.','Lifecycle contract','usability',3,NULL,NULL,30,'Complete the synthetic test steps carefully.');
  PERFORM rebuild_v2.submit_test_for_review(v_test);
  IF NOT EXISTS(SELECT 1 FROM rebuild_v2.tests WHERE id=v_test AND status='submitted') THEN RAISE EXCEPTION 'FAIL: test submission'; END IF;

  BEGIN
    PERFORM rebuild_v2.review_test(v_test,'approved','Developer cannot approve own test');
    RAISE EXCEPTION 'FAIL: developer approved own test';
  EXCEPTION WHEN SQLSTATE '42501' THEN NULL;
  END;

  PERFORM set_config('request.jwt.claim.sub','50000000-0000-4000-8000-000000000002',true);
  PERFORM set_config('request.jwt.claims','{"sub":"50000000-0000-4000-8000-000000000002","role":"authenticated"}',true);
  PERFORM rebuild_v2.review_test(v_test,'approved','Test meets the synthetic review checklist');
  IF NOT EXISTS(SELECT 1 FROM rebuild_v2.tests WHERE id=v_test AND status='recruiting') THEN RAISE EXCEPTION 'FAIL: test approval did not open recruitment'; END IF;

  PERFORM set_config('request.jwt.claim.sub','50000000-0000-4000-8000-000000000001',true);
  PERFORM set_config('request.jwt.claims','{"sub":"50000000-0000-4000-8000-000000000001","role":"authenticated"}',true);
  v_cohort:=rebuild_v2.create_test_cohort(v_test,'Lifecycle Cohort',5,NULL,NULL);
  IF NOT EXISTS(SELECT 1 FROM rebuild_v2.cohort_tests WHERE cohort_id=v_cohort AND test_id=v_test AND developer_id='50000000-0000-4000-8000-000000000001') THEN
    RAISE EXCEPTION 'FAIL: cohort not linked to test';
  END IF;

  PERFORM set_config('request.jwt.claim.sub','50000000-0000-4000-8000-000000000003',true);
  PERFORM set_config('request.jwt.claims','{"sub":"50000000-0000-4000-8000-000000000003","role":"authenticated"}',true);
  v_assignment:=rebuild_v2.join_test(v_test);
  IF NOT EXISTS(SELECT 1 FROM rebuild_v2.assignments WHERE id=v_assignment AND tester_id='50000000-0000-4000-8000-000000000003' AND cohort_id=v_cohort) THEN
    RAISE EXCEPTION 'FAIL: tester could not join approved test cohort';
  END IF;

  PERFORM set_config('request.jwt.claim.sub','50000000-0000-4000-8000-000000000002',true);
  PERFORM set_config('request.jwt.claims','{"sub":"50000000-0000-4000-8000-000000000002","role":"authenticated"}',true);
  SELECT count(*) INTO v_count FROM rebuild_v2.audit_events
  WHERE target_id IN (v_app,v_test,v_cohort)
    AND action IN ('app.submitted','app.review.approved','test.created','test.submitted','test.review.approved','cohort.created');
  IF v_count<>6 THEN RAISE EXCEPTION 'FAIL: expected audit events missing; got %',v_count; END IF;
END;
$test$;

RESET ROLE;
ROLLBACK;

SELECT jsonb_build_object(
 'auth_users_after_rollback',(SELECT count(*) FROM auth.users WHERE id IN ('50000000-0000-4000-8000-000000000001','50000000-0000-4000-8000-000000000002','50000000-0000-4000-8000-000000000003')),
 'profiles_after_rollback',(SELECT count(*) FROM rebuild_v2.profiles WHERE id IN ('50000000-0000-4000-8000-000000000001','50000000-0000-4000-8000-000000000002','50000000-0000-4000-8000-000000000003')),
 'apps_after_rollback',(SELECT count(*) FROM rebuild_v2.apps WHERE package_name='dz.testdz.lifecycle'),
 'tests_after_rollback',(SELECT count(*) FROM rebuild_v2.tests WHERE title='Lifecycle Test'),
 'cohorts_after_rollback',(SELECT count(*) FROM rebuild_v2.cohorts WHERE name='Lifecycle Cohort'),
 'assignments_after_rollback',(SELECT count(*) FROM rebuild_v2.assignments WHERE tester_id='50000000-0000-4000-8000-000000000003')
) AS rollback_cleanup_check;
