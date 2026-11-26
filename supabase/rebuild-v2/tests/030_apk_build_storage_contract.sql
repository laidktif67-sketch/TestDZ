-- Private APK build Storage upload, finalization and participant access contract.
-- Disposable local Supabase only. Synthetic Auth rows and Storage objects are rolled back.
BEGIN;

INSERT INTO auth.users
 (id,aud,role,email,encrypted_password,email_confirmed_at,raw_app_meta_data,raw_user_meta_data,created_at,updated_at)
VALUES
 ('73000000-0000-4000-8000-000000000001','authenticated','authenticated','apk-owner@example.invalid','',now(),'{"provider":"email","providers":["email"]}'::jsonb,'{"name":"APK Owner"}'::jsonb,now(),now()),
 ('73000000-0000-4000-8000-000000000002','authenticated','authenticated','apk-admin@example.invalid','',now(),'{"provider":"email","providers":["email"]}'::jsonb,'{"name":"APK Admin"}'::jsonb,now(),now()),
 ('73000000-0000-4000-8000-000000000003','authenticated','authenticated','apk-tester@example.invalid','',now(),'{"provider":"email","providers":["email"]}'::jsonb,'{"name":"Assigned Tester"}'::jsonb,now(),now()),
 ('73000000-0000-4000-8000-000000000004','authenticated','authenticated','apk-other-dev@example.invalid','',now(),'{"provider":"email","providers":["email"]}'::jsonb,'{"name":"Other Developer"}'::jsonb,now(),now()),
 ('73000000-0000-4000-8000-000000000005','authenticated','authenticated','apk-outsider@example.invalid','',now(),'{"provider":"email","providers":["email"]}'::jsonb,'{"name":"Unassigned Tester"}'::jsonb,now(),now());

DELETE FROM rebuild_v2.user_roles
WHERE user_id IN (
 '73000000-0000-4000-8000-000000000001',
 '73000000-0000-4000-8000-000000000002',
 '73000000-0000-4000-8000-000000000004'
) AND role='tester';

INSERT INTO rebuild_v2.user_roles(user_id,role) VALUES
 ('73000000-0000-4000-8000-000000000001','developer'),
 ('73000000-0000-4000-8000-000000000002','admin'),
 ('73000000-0000-4000-8000-000000000003','tester'),
 ('73000000-0000-4000-8000-000000000004','developer'),
 ('73000000-0000-4000-8000-000000000005','tester')
ON CONFLICT(user_id,role) DO NOTHING;

SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub','73000000-0000-4000-8000-000000000001',true);
SELECT set_config('request.jwt.claims','{"sub":"73000000-0000-4000-8000-000000000001","role":"authenticated"}',true);

DO $setup$
DECLARE
 v_app uuid;
 v_test uuid;
 v_bad_size_path text;
 v_bad_mime_path text;
 v_valid_path text;
 v_build_id uuid;
BEGIN
 v_app:=rebuild_v2.create_app(
  'APK Build Contract App','dz.testdz.apk_build_contract',
  'Synthetic app used only by the rolled-back APK Storage contract.','tools'
 );
 PERFORM rebuild_v2.submit_app_for_review(v_app);

 PERFORM set_config('request.jwt.claim.sub','73000000-0000-4000-8000-000000000002',true);
 PERFORM set_config('request.jwt.claims','{"sub":"73000000-0000-4000-8000-000000000002","role":"authenticated"}',true);
 PERFORM rebuild_v2.review_app(v_app,'approved','Synthetic APK contract app approval');

 PERFORM set_config('request.jwt.claim.sub','73000000-0000-4000-8000-000000000001',true);
 PERFORM set_config('request.jwt.claims','{"sub":"73000000-0000-4000-8000-000000000001","role":"authenticated"}',true);
 v_test:=rebuild_v2.create_test(
  v_app,'Private APK Build Contract',
  'Synthetic APK test used to verify private build upload, finalization and tester access.',
  'APK build privacy','apk_testing',1,NULL,NULL,30,'Install and test the supplied APK build.'
 );
 PERFORM set_config('testdz.apk_test_id',v_test::text,true);

 -- Another developer cannot register a build against this developer's test.
 PERFORM set_config('request.jwt.claim.sub','73000000-0000-4000-8000-000000000004',true);
 PERFORM set_config('request.jwt.claims','{"sub":"73000000-0000-4000-8000-000000000004","role":"authenticated"}',true);
 BEGIN
  PERFORM rebuild_v2.register_test_build(
   v_test,'73000000-0000-4000-8000-000000000099','Forged','forged.apk',4096,NULL
  );
  RAISE EXCEPTION 'FAIL: foreign developer registered an APK build';
 EXCEPTION WHEN SQLSTATE '42501' THEN NULL;
 END;
 IF EXISTS(SELECT 1 FROM rebuild_v2.test_builds WHERE test_id=v_test) THEN
  RAISE EXCEPTION 'FAIL: foreign developer created build metadata';
 END IF;

 PERFORM set_config('request.jwt.claim.sub','73000000-0000-4000-8000-000000000001',true);
 PERFORM set_config('request.jwt.claims','{"sub":"73000000-0000-4000-8000-000000000001","role":"authenticated"}',true);

 -- Register a build whose Storage metadata has the wrong size; finalization must reject it.
 v_bad_size_path:=rebuild_v2.register_test_build(
  v_test,'73000000-0000-4000-8000-000000000011','1.0-size','bad-size.apk',4096,NULL
 );
 INSERT INTO storage.objects(bucket_id,name,metadata,owner,owner_id)
 VALUES('test-builds',v_bad_size_path,
  jsonb_build_object('size','4095','mimetype','application/vnd.android.package-archive'),
  '73000000-0000-4000-8000-000000000001'::uuid,'73000000-0000-4000-8000-000000000001');
 SELECT id INTO v_build_id FROM rebuild_v2.test_builds WHERE storage_path=v_bad_size_path;
 BEGIN
  PERFORM rebuild_v2.finalize_test_build(v_build_id);
  RAISE EXCEPTION 'FAIL: finalization accepted an APK with mismatched size';
 EXCEPTION WHEN SQLSTATE '55000' THEN NULL;
 END;

 -- Wrong MIME metadata must also fail finalization.
 v_bad_mime_path:=rebuild_v2.register_test_build(
  v_test,'73000000-0000-4000-8000-000000000012','1.0-mime','bad-mime.apk',4096,NULL
 );
 INSERT INTO storage.objects(bucket_id,name,metadata,owner,owner_id)
 VALUES('test-builds',v_bad_mime_path,
  jsonb_build_object('size','4096','mimetype','application/pdf'),
  '73000000-0000-4000-8000-000000000001'::uuid,'73000000-0000-4000-8000-000000000001');
 SELECT id INTO v_build_id FROM rebuild_v2.test_builds WHERE storage_path=v_bad_mime_path;
 BEGIN
  PERFORM rebuild_v2.finalize_test_build(v_build_id);
  RAISE EXCEPTION 'FAIL: finalization accepted a non-APK MIME type';
 EXCEPTION WHEN SQLSTATE '55000' THEN NULL;
 END;

 -- Register the valid APK. A different authenticated user cannot upload to its path.
 v_valid_path:=rebuild_v2.register_test_build(
  v_test,'73000000-0000-4000-8000-000000000013','1.0.0','release.apk',4096,
  'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa'
 );
 PERFORM set_config('testdz.apk_build_path',v_valid_path,true);
 SELECT id INTO v_build_id FROM rebuild_v2.test_builds WHERE storage_path=v_valid_path;
 PERFORM set_config('testdz.apk_build_id',v_build_id::text,true);
END;
$setup$;

SELECT set_config('request.jwt.claim.sub','73000000-0000-4000-8000-000000000005',true);
SELECT set_config('request.jwt.claims','{"sub":"73000000-0000-4000-8000-000000000005","role":"authenticated"}',true);
DO $blocked_upload$
BEGIN
 BEGIN
  INSERT INTO storage.objects(bucket_id,name,metadata,owner,owner_id)
  VALUES('test-builds',current_setting('testdz.apk_build_path'),
   jsonb_build_object('size','4096','mimetype','application/vnd.android.package-archive'),
   '73000000-0000-4000-8000-000000000005'::uuid,'73000000-0000-4000-8000-000000000005');
  RAISE EXCEPTION 'FAIL: unrelated tester uploaded a private APK build';
 EXCEPTION WHEN SQLSTATE '42501' THEN NULL;
 END;
END;
$blocked_upload$;

SELECT set_config('request.jwt.claim.sub','73000000-0000-4000-8000-000000000001',true);
SELECT set_config('request.jwt.claims','{"sub":"73000000-0000-4000-8000-000000000001","role":"authenticated"}',true);
INSERT INTO storage.objects(bucket_id,name,metadata,owner,owner_id)
VALUES('test-builds',current_setting('testdz.apk_build_path'),
 jsonb_build_object('size','4096','mimetype','application/vnd.android.package-archive'),
 '73000000-0000-4000-8000-000000000001'::uuid,'73000000-0000-4000-8000-000000000001');

DO $finalize$
BEGIN
 IF NOT rebuild_v2.finalize_test_build(current_setting('testdz.apk_build_id')::uuid) THEN
  RAISE EXCEPTION 'FAIL: valid APK finalization returned false';
 END IF;
 IF NOT EXISTS(
  SELECT 1 FROM rebuild_v2.test_builds
  WHERE id=current_setting('testdz.apk_build_id')::uuid
    AND status='uploaded' AND uploaded_at IS NOT NULL
 ) THEN RAISE EXCEPTION 'FAIL: APK build was not marked uploaded'; END IF;
END;
$finalize$;

-- A pending build is not readable by a tester. Once the test is approved and the
-- tester receives an assignment, the uploaded build becomes readable.
DO $publish$
DECLARE v_test uuid:=current_setting('testdz.apk_test_id')::uuid; v_cohort uuid;
BEGIN
 PERFORM rebuild_v2.submit_test_for_review(v_test);
 PERFORM set_config('request.jwt.claim.sub','73000000-0000-4000-8000-000000000002',true);
 PERFORM set_config('request.jwt.claims','{"sub":"73000000-0000-4000-8000-000000000002","role":"authenticated"}',true);
 PERFORM rebuild_v2.review_test(v_test,'approved','Verified private APK build contract');
 PERFORM set_config('request.jwt.claim.sub','73000000-0000-4000-8000-000000000001',true);
 PERFORM set_config('request.jwt.claims','{"sub":"73000000-0000-4000-8000-000000000001","role":"authenticated"}',true);
 v_cohort:=rebuild_v2.create_test_cohort(v_test,'APK Build Contract Cohort',1,NULL,NULL);
 PERFORM set_config('testdz.apk_cohort_id',v_cohort::text,true);
END;
$publish$;

SELECT set_config('request.jwt.claim.sub','73000000-0000-4000-8000-000000000003',true);
SELECT set_config('request.jwt.claims','{"sub":"73000000-0000-4000-8000-000000000003","role":"authenticated"}',true);
SELECT rebuild_v2.join_test(current_setting('testdz.apk_test_id')::uuid);

DO $participant_access$
DECLARE v_path text:=current_setting('testdz.apk_build_path');
BEGIN
 IF NOT rebuild_v2_private.can_read_test_build(v_path) THEN
  RAISE EXCEPTION 'FAIL: assigned tester cannot read uploaded APK build';
 END IF;
 IF (SELECT count(*) FROM storage.objects WHERE bucket_id='test-builds' AND name=v_path)<>1 THEN
  RAISE EXCEPTION 'FAIL: assigned tester cannot SELECT private APK object';
 END IF;
 IF (SELECT count(*) FROM rebuild_v2.test_builds
     WHERE id=current_setting('testdz.apk_build_id')::uuid AND status='uploaded')<>1 THEN
  RAISE EXCEPTION 'FAIL: assigned tester cannot read uploaded APK metadata';
 END IF;
END;
$participant_access$;

SELECT set_config('request.jwt.claim.sub','73000000-0000-4000-8000-000000000005',true);
SELECT set_config('request.jwt.claims','{"sub":"73000000-0000-4000-8000-000000000005","role":"authenticated"}',true);
DO $outsider_read$
BEGIN
 IF rebuild_v2_private.can_read_test_build(current_setting('testdz.apk_build_path')) THEN
  RAISE EXCEPTION 'FAIL: unassigned tester passed private APK read helper';
 END IF;
 IF (SELECT count(*) FROM storage.objects
     WHERE bucket_id='test-builds' AND name=current_setting('testdz.apk_build_path'))<>0 THEN
  RAISE EXCEPTION 'FAIL: unassigned tester can SELECT private APK object';
 END IF;
 IF (SELECT count(*) FROM rebuild_v2.test_builds
     WHERE id=current_setting('testdz.apk_build_id')::uuid)<>0 THEN
  RAISE EXCEPTION 'FAIL: unassigned tester can read private APK metadata';
 END IF;
END;
$outsider_read$;

RESET ROLE;
ROLLBACK;
SELECT 'rebuild_v2_apk_build_storage_contract: PASS' AS result;
