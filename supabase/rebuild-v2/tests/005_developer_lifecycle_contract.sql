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
DECLARE v_app uuid; v_test uuid; v_cohort uuid; v_assignment uuid; v_apk_test uuid; v_apk_path text; v_apk_build uuid; v_apk_file uuid; v_count integer;
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
  -- Only the owning developer can author steps and requirements while the test is editable.
  PERFORM set_config('request.jwt.claim.sub','50000000-0000-4000-8000-000000000003',true);
  PERFORM set_config('request.jwt.claims','{"sub":"50000000-0000-4000-8000-000000000003","role":"authenticated"}',true);
  BEGIN
    PERFORM rebuild_v2.save_test_content(v_test,'[{"title":"Forged step","description":"A non-owner must not add this step."}]'::jsonb,'[]'::jsonb);
    RAISE EXCEPTION 'FAIL: non-owner edited test content';
  EXCEPTION WHEN SQLSTATE '42501' THEN NULL;
  END;

  PERFORM set_config('request.jwt.claim.sub','50000000-0000-4000-8000-000000000001',true);
  PERFORM set_config('request.jwt.claims','{"sub":"50000000-0000-4000-8000-000000000001","role":"authenticated"}',true);
  PERFORM rebuild_v2.save_test_content(
    v_test,
    '[{"title":"Install the app","description":"Install the supplied build and open it once.","isRequired":true},{"title":"Explore settings","description":"Review the settings screen and record any usability issue.","isRequired":false}]'::jsonb,
    '[{"type":"device","title":"Android device","description":"Use a physical Android device for this test.","isMandatory":true}]'::jsonb
  );
  SELECT count(*) INTO v_count FROM rebuild_v2.test_steps WHERE test_id=v_test;
  IF v_count<>2 THEN RAISE EXCEPTION 'FAIL: expected two saved test steps, got %',v_count; END IF;
  SELECT count(*) INTO v_count FROM rebuild_v2.test_requirements WHERE test_id=v_test;
  IF v_count<>1 THEN RAISE EXCEPTION 'FAIL: expected one saved test requirement, got %',v_count; END IF;

  BEGIN
    PERFORM rebuild_v2.save_test_content(v_test,'[{"title":"x","description":"bad"}]'::jsonb,'[]'::jsonb);
    RAISE EXCEPTION 'FAIL: malformed test content accepted';
  EXCEPTION WHEN SQLSTATE '22023' THEN NULL;
  END;

  PERFORM rebuild_v2.submit_test_for_review(v_test);
  BEGIN
    PERFORM rebuild_v2.save_test_content(v_test,'[]'::jsonb,'[]'::jsonb);
    RAISE EXCEPTION 'FAIL: submitted test content remained editable';
  EXCEPTION WHEN SQLSTATE '55000' THEN NULL;
  END;
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
  BEGIN
    PERFORM rebuild_v2.create_test_cohort(v_test,'Too Small Cohort',2,NULL,NULL);
    RAISE EXCEPTION 'FAIL: cohort capacity below minimum was accepted';
  EXCEPTION WHEN SQLSTATE '22023' THEN NULL;
  END;
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
  SELECT count(*) INTO v_count FROM rebuild_v2.test_steps WHERE test_id=v_test;
  IF v_count<>2 THEN RAISE EXCEPTION 'FAIL: assigned tester cannot read test steps under RLS'; END IF;
  SELECT count(*) INTO v_count FROM rebuild_v2.test_requirements WHERE test_id=v_test;
  IF v_count<>1 THEN RAISE EXCEPTION 'FAIL: assigned tester cannot read test requirements under RLS'; END IF;

  -- Cohort updates remain owner-only and cannot shrink below the test minimum.
  PERFORM set_config('request.jwt.claim.sub','50000000-0000-4000-8000-000000000003',true);
  PERFORM set_config('request.jwt.claims','{"sub":"50000000-0000-4000-8000-000000000003","role":"authenticated"}',true);
  BEGIN
    PERFORM rebuild_v2.update_test_cohort(v_cohort,'Forged Cohort',6,NULL,NULL,'Non-owner must not edit');
    RAISE EXCEPTION 'FAIL: non-owner edited cohort';
  EXCEPTION WHEN SQLSTATE '42501' THEN NULL;
  END;

  PERFORM set_config('request.jwt.claim.sub','50000000-0000-4000-8000-000000000001',true);
  PERFORM set_config('request.jwt.claims','{"sub":"50000000-0000-4000-8000-000000000001","role":"authenticated"}',true);
  PERFORM rebuild_v2.update_test_cohort(v_cohort,'Updated Lifecycle Cohort',6,NULL,NULL,'Adjusting capacity before recruitment starts');
  IF NOT EXISTS(SELECT 1 FROM rebuild_v2.cohorts WHERE id=v_cohort AND name='Updated Lifecycle Cohort' AND capacity=6) THEN
    RAISE EXCEPTION 'FAIL: cohort update was not persisted';
  END IF;
  BEGIN
    PERFORM rebuild_v2.update_test_cohort(v_cohort,'Too Small Cohort',2,NULL,NULL,'Must not go below test minimum');
    RAISE EXCEPTION 'FAIL: cohort capacity below test minimum was accepted during update';
  EXCEPTION WHEN SQLSTATE '22023' THEN NULL;
  END;
  BEGIN
    PERFORM rebuild_v2.transition_test_cohort(v_cohort,'ready','Not enough enrolled testers yet');
    RAISE EXCEPTION 'FAIL: cohort became ready below tester minimum';
  EXCEPTION WHEN SQLSTATE '55000' THEN NULL;
  END;
  PERFORM rebuild_v2.transition_test_cohort(v_cohort,'cancelled','Developer cancelled before cohort launch');
  IF NOT EXISTS(SELECT 1 FROM rebuild_v2.cohorts WHERE id=v_cohort AND status='cancelled') THEN
    RAISE EXCEPTION 'FAIL: cohort cancellation did not persist';
  END IF;
  IF NOT EXISTS(SELECT 1 FROM rebuild_v2.assignments WHERE id=v_assignment AND status='withdrawn') THEN
    RAISE EXCEPTION 'FAIL: pending assignment was not withdrawn on cancellation';
  END IF;

  -- APK tests cannot be submitted until a private build is registered and verified.
  PERFORM set_config('request.jwt.claim.sub','50000000-0000-4000-8000-000000000001',true);
  PERFORM set_config('request.jwt.claims','{"sub":"50000000-0000-4000-8000-000000000001","role":"authenticated"}',true);
  v_apk_test:=rebuild_v2.create_test(v_app,'APK Build Contract','A synthetic APK test used to verify private artifact upload and participant-only download.','APK contract','apk_testing',1,NULL,NULL,30,'Install and verify this private test build.');
  BEGIN
    PERFORM rebuild_v2.submit_test_for_review(v_apk_test);
    RAISE EXCEPTION 'FAIL: APK test submitted without verified build';
  EXCEPTION WHEN SQLSTATE '55000' THEN NULL;
  END;
  v_apk_file:='50000000-0000-4000-8000-000000000004';
  v_apk_path:=rebuild_v2.register_test_build(v_apk_test,v_apk_file,'1.0.0','lifecycle.apk',2048,repeat('a',64));
  SELECT id INTO v_apk_build FROM rebuild_v2.test_builds WHERE test_id=v_apk_test AND file_id=v_apk_file;
  IF NOT rebuild_v2_private.can_upload_test_build(v_apk_path) THEN
    RAISE EXCEPTION 'FAIL: owner cannot upload registered APK build';
  END IF;
  PERFORM set_config('request.jwt.claim.sub','50000000-0000-4000-8000-000000000003',true);
  PERFORM set_config('request.jwt.claims','{"sub":"50000000-0000-4000-8000-000000000003","role":"authenticated"}',true);
  IF rebuild_v2_private.can_upload_test_build(v_apk_path) THEN
    RAISE EXCEPTION 'FAIL: non-owner can upload APK build';
  END IF;
  SELECT count(*) INTO v_count FROM rebuild_v2.test_builds WHERE test_id=v_apk_test;
  IF v_count<>0 THEN RAISE EXCEPTION 'FAIL: tester can read pending APK metadata'; END IF;
  PERFORM set_config('request.jwt.claim.sub','50000000-0000-4000-8000-000000000001',true);
  PERFORM set_config('request.jwt.claims','{"sub":"50000000-0000-4000-8000-000000000001","role":"authenticated"}',true);
  PERFORM set_config('testdz.apk_test_id',v_apk_test::text,true);
  PERFORM set_config('testdz.apk_build_id',v_apk_build::text,true);
  PERFORM set_config('testdz.apk_path',v_apk_path,true);

  PERFORM set_config('request.jwt.claim.sub','50000000-0000-4000-8000-000000000002',true);
  PERFORM set_config('request.jwt.claims','{"sub":"50000000-0000-4000-8000-000000000002","role":"authenticated"}',true);
  SELECT count(*) INTO v_count FROM rebuild_v2.audit_events
  WHERE target_id IN (v_app,v_test,v_cohort)
    AND action IN ('app.submitted','app.review.approved','test.created','test.content.saved','test.submitted','test.review.approved','cohort.created','cohort.updated','cohort.status.cancelled');
  IF v_count<>9 THEN RAISE EXCEPTION 'FAIL: expected audit events missing; got %',v_count; END IF;
END;
$test$;

-- Simulate the Storage upload through the authenticated role and its INSERT policy.
INSERT INTO storage.objects(bucket_id,name,metadata,owner,owner_id)
VALUES(
  'test-builds',
  current_setting('testdz.apk_path'),
  jsonb_build_object('size','2048','mimetype','application/vnd.android.package-archive'),
  '50000000-0000-4000-8000-000000000001'::uuid,
  '50000000-0000-4000-8000-000000000001'
);
SET LOCAL ROLE authenticated;

DO $apk_test$
DECLARE v_test uuid:=current_setting('testdz.apk_test_id')::uuid;
        v_build uuid:=current_setting('testdz.apk_build_id')::uuid;
        v_path text:=current_setting('testdz.apk_path');
        v_cohort uuid;
        v_assignment uuid;
        v_count integer;
BEGIN
  PERFORM set_config('request.jwt.claim.sub','50000000-0000-4000-8000-000000000001',true);
  PERFORM set_config('request.jwt.claims','{"sub":"50000000-0000-4000-8000-000000000001","role":"authenticated"}',true);
  IF NOT rebuild_v2.finalize_test_build(v_build) THEN RAISE EXCEPTION 'FAIL: private APK finalization failed'; END IF;
  IF NOT EXISTS(SELECT 1 FROM rebuild_v2.test_builds WHERE id=v_build AND status='uploaded') THEN
    RAISE EXCEPTION 'FAIL: APK build not marked uploaded';
  END IF;
  PERFORM rebuild_v2.submit_test_for_review(v_test);

  PERFORM set_config('request.jwt.claim.sub','50000000-0000-4000-8000-000000000002',true);
  PERFORM set_config('request.jwt.claims','{"sub":"50000000-0000-4000-8000-000000000002","role":"authenticated"}',true);
  PERFORM rebuild_v2.review_test(v_test,'approved','Private APK build verified for tester distribution');

  PERFORM set_config('request.jwt.claim.sub','50000000-0000-4000-8000-000000000001',true);
  PERFORM set_config('request.jwt.claims','{"sub":"50000000-0000-4000-8000-000000000001","role":"authenticated"}',true);
  v_cohort:=rebuild_v2.create_test_cohort(v_test,'APK Private Cohort',1,NULL,NULL);

  PERFORM set_config('request.jwt.claim.sub','50000000-0000-4000-8000-000000000003',true);
  PERFORM set_config('request.jwt.claims','{"sub":"50000000-0000-4000-8000-000000000003","role":"authenticated"}',true);
  v_assignment:=rebuild_v2.join_test(v_test);
  SELECT count(*) INTO v_count FROM rebuild_v2.test_builds WHERE id=v_build AND status='uploaded';
  IF v_count<>1 THEN RAISE EXCEPTION 'FAIL: assigned tester cannot read uploaded APK metadata'; END IF;
  IF NOT rebuild_v2_private.can_read_test_build(v_path) THEN
    RAISE EXCEPTION 'FAIL: assigned tester cannot read private APK object';
  END IF;
  SELECT count(*) INTO v_count FROM storage.objects WHERE bucket_id='test-builds' AND name=v_path;
  IF v_count<>1 THEN RAISE EXCEPTION 'FAIL: assigned tester cannot select private APK object'; END IF;
END;
$apk_test$;

RESET ROLE;
ROLLBACK;

SELECT jsonb_build_object(
 'auth_users_after_rollback',(SELECT count(*) FROM auth.users WHERE id IN ('50000000-0000-4000-8000-000000000001','50000000-0000-4000-8000-000000000002','50000000-0000-4000-8000-000000000003')),
 'profiles_after_rollback',(SELECT count(*) FROM rebuild_v2.profiles WHERE id IN ('50000000-0000-4000-8000-000000000001','50000000-0000-4000-8000-000000000002','50000000-0000-4000-8000-000000000003')),
 'apps_after_rollback',(SELECT count(*) FROM rebuild_v2.apps WHERE package_name='dz.testdz.lifecycle'),
 'tests_after_rollback',(SELECT count(*) FROM rebuild_v2.tests WHERE title='Lifecycle Test'),
 'test_steps_after_rollback',(SELECT count(*) FROM rebuild_v2.test_steps WHERE test_id IN (SELECT id FROM rebuild_v2.tests WHERE title='Lifecycle Test')),
 'test_requirements_after_rollback',(SELECT count(*) FROM rebuild_v2.test_requirements WHERE test_id IN (SELECT id FROM rebuild_v2.tests WHERE title='Lifecycle Test')),
 'test_builds_after_rollback',(SELECT count(*) FROM rebuild_v2.test_builds WHERE original_filename='lifecycle.apk'),
 'storage_apk_objects_after_rollback',(SELECT count(*) FROM storage.objects WHERE bucket_id='test-builds' AND name LIKE '%lifecycle.apk'),
 'cohorts_after_rollback',(SELECT count(*) FROM rebuild_v2.cohorts WHERE name IN ('Lifecycle Cohort','Updated Lifecycle Cohort')),
 'assignments_after_rollback',(SELECT count(*) FROM rebuild_v2.assignments WHERE tester_id='50000000-0000-4000-8000-000000000003')
) AS rollback_cleanup_check;
