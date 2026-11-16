-- Private developer test-media upload and participant access contract.
-- Run ONLY against isolated TestDZ-FixLab after candidate SQL 001..015.
-- All synthetic rows and Storage objects are rolled back.

BEGIN;
INSERT INTO auth.users
 (id,aud,role,email,encrypted_password,email_confirmed_at,raw_app_meta_data,raw_user_meta_data,created_at,updated_at)
VALUES
 ('60000000-0000-4000-8000-000000000001','authenticated','authenticated','v2-media-dev@example.invalid','',now(),'{"provider":"email","providers":["email"]}'::jsonb,'{"name":"Media Developer"}'::jsonb,now(),now()),
 ('60000000-0000-4000-8000-000000000002','authenticated','authenticated','v2-media-admin@example.invalid','',now(),'{"provider":"email","providers":["email"]}'::jsonb,'{"name":"Media Admin"}'::jsonb,now(),now()),
 ('60000000-0000-4000-8000-000000000003','authenticated','authenticated','v2-media-tester@example.invalid','',now(),'{"provider":"email","providers":["email"]}'::jsonb,'{"name":"Media Tester"}'::jsonb,now(),now()),
 ('60000000-0000-4000-8000-000000000004','authenticated','authenticated','v2-media-outsider@example.invalid','',now(),'{"provider":"email","providers":["email"]}'::jsonb,'{"name":"Media Outsider"}'::jsonb,now(),now());

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

DO $setup$
DECLARE
  v_app uuid;
  v_test uuid;
  v_asset uuid;
  v_path text;
BEGIN
  v_app:=rebuild_v2.create_app(
    'Media Contract App','dz.testdz.media_contract',
    'A synthetic application used only for the rolled-back private media asset contract.','tools'
  );
  PERFORM rebuild_v2.submit_app_for_review(v_app);

  PERFORM set_config('request.jwt.claim.sub','60000000-0000-4000-8000-000000000002',true);
  PERFORM set_config('request.jwt.claims','{"sub":"60000000-0000-4000-8000-000000000002","role":"authenticated"}',true);
  PERFORM rebuild_v2.review_app(v_app,'approved','Synthetic media contract app approval');

  PERFORM set_config('request.jwt.claim.sub','60000000-0000-4000-8000-000000000001',true);
  PERFORM set_config('request.jwt.claims','{"sub":"60000000-0000-4000-8000-000000000001","role":"authenticated"}',true);
  v_test:=rebuild_v2.create_test(
    v_app,'Private Media Contract',
    'A synthetic test used to verify private developer-provided image, video and document attachments.',
    'Private media','usability',1,NULL,NULL,30,'Review the supplied private test materials.'
  );

  BEGIN
    PERFORM rebuild_v2.register_test_asset(
      v_test,'60000000-0000-4000-8000-000000000099',
      'Bad MIME','spoofed.png','application/pdf',1024
    );
    RAISE EXCEPTION 'FAIL: mismatched extension and MIME accepted';
  EXCEPTION WHEN SQLSTATE '22023' THEN NULL;
  END;

  BEGIN
    PERFORM rebuild_v2.register_test_asset(
      v_test,'60000000-0000-4000-8000-000000000098',
      'Oversized','large.mp4','video/mp4',52428801
    );
    RAISE EXCEPTION 'FAIL: oversized media accepted';
  EXCEPTION WHEN SQLSTATE '22023' THEN NULL;
  END;

  v_path:=rebuild_v2.register_test_asset(
    v_test,'60000000-0000-4000-8000-000000000005',
    'Getting started','getting-started.pdf','application/pdf',4096
  );
  SELECT id INTO v_asset FROM rebuild_v2.test_assets
  WHERE test_id=v_test AND file_id='60000000-0000-4000-8000-000000000005';

  IF NOT rebuild_v2_private.can_upload_test_asset(v_path) THEN
    RAISE EXCEPTION 'FAIL: owner cannot upload registered media asset';
  END IF;

  PERFORM set_config('testdz.media_test_id',v_test::text,true);
  PERFORM set_config('testdz.media_asset_id',v_asset::text,true);
  PERFORM set_config('testdz.media_path',v_path,true);
END;
$setup$;

-- A non-owner cannot register an asset or upload to the registered owner's path.
SELECT set_config('request.jwt.claim.sub','60000000-0000-4000-8000-000000000004',true);
SELECT set_config('request.jwt.claims','{"sub":"60000000-0000-4000-8000-000000000004","role":"authenticated"}',true);
DO $non_owner$
BEGIN
  BEGIN
    PERFORM rebuild_v2.register_test_asset(
      current_setting('testdz.media_test_id')::uuid,
      '60000000-0000-4000-8000-000000000006',
      'Forged','forged.pdf','application/pdf',1024
    );
    RAISE EXCEPTION 'FAIL: non-owner registered test asset';
  EXCEPTION WHEN SQLSTATE '42501' THEN NULL;
  END;
  IF rebuild_v2_private.can_upload_test_asset(current_setting('testdz.media_path')) THEN
    RAISE EXCEPTION 'FAIL: non-owner passed private asset upload helper';
  END IF;
  IF (SELECT count(*) FROM rebuild_v2.test_assets WHERE id=current_setting('testdz.media_asset_id')::uuid)<>0 THEN
    RAISE EXCEPTION 'FAIL: outsider can read pending asset metadata';
  END IF;
END;
$non_owner$;

-- Actual authenticated Storage INSERT policy must reject the outsider.
DO $blocked_upload$
BEGIN
  BEGIN
    INSERT INTO storage.objects(bucket_id,name,metadata,owner,owner_id)
    VALUES(
      'test-assets',current_setting('testdz.media_path'),
      jsonb_build_object('size','4096','mimetype','application/pdf'),
      '60000000-0000-4000-8000-000000000004'::uuid,'60000000-0000-4000-8000-000000000004'
    );
    RAISE EXCEPTION 'FAIL: outsider inserted private test asset';
  EXCEPTION WHEN SQLSTATE '42501' THEN NULL;
  END;
END;
$blocked_upload$;

-- Owner uploads through the real Storage INSERT RLS policy and finalizes metadata.
SELECT set_config('request.jwt.claim.sub','60000000-0000-4000-8000-000000000001',true);
SELECT set_config('request.jwt.claims','{"sub":"60000000-0000-4000-8000-000000000001","role":"authenticated"}',true);
INSERT INTO storage.objects(bucket_id,name,metadata,owner,owner_id)
VALUES(
  'test-assets',current_setting('testdz.media_path'),
  jsonb_build_object('size','4096','mimetype','application/pdf'),
  '60000000-0000-4000-8000-000000000001'::uuid,'60000000-0000-4000-8000-000000000001'
);

DO $finalize$
BEGIN
  IF NOT rebuild_v2.finalize_test_asset(current_setting('testdz.media_asset_id')::uuid) THEN
    RAISE EXCEPTION 'FAIL: media finalization returned false';
  END IF;
  IF NOT EXISTS(
    SELECT 1 FROM rebuild_v2.test_assets
    WHERE id=current_setting('testdz.media_asset_id')::uuid AND status='uploaded'
  ) THEN RAISE EXCEPTION 'FAIL: media asset not marked uploaded'; END IF;
END;
$finalize$;

-- Publish the test and assign one tester. The assigned tester can read the asset;
-- a different tester cannot read its metadata or Storage object.
DO $publish$
DECLARE v_test uuid:=current_setting('testdz.media_test_id')::uuid; v_app uuid;
BEGIN
  PERFORM rebuild_v2.submit_test_for_review(v_test);
  PERFORM set_config('request.jwt.claim.sub','60000000-0000-4000-8000-000000000002',true);
  PERFORM set_config('request.jwt.claims','{"sub":"60000000-0000-4000-8000-000000000002","role":"authenticated"}',true);
  PERFORM rebuild_v2.review_test(v_test,'approved','Private test assets verified for participant delivery');

  PERFORM set_config('request.jwt.claim.sub','60000000-0000-4000-8000-000000000001',true);
  PERFORM set_config('request.jwt.claims','{"sub":"60000000-0000-4000-8000-000000000001","role":"authenticated"}',true);
  PERFORM rebuild_v2.create_test_cohort(v_test,'Media Contract Cohort',1,NULL,NULL);
END;
$publish$;

SELECT set_config('request.jwt.claim.sub','60000000-0000-4000-8000-000000000003',true);
SELECT set_config('request.jwt.claims','{"sub":"60000000-0000-4000-8000-000000000003","role":"authenticated"}',true);
SELECT rebuild_v2.join_test(current_setting('testdz.media_test_id')::uuid);

DO $participant_access$
DECLARE v_path text:=current_setting('testdz.media_path'); v_asset uuid:=current_setting('testdz.media_asset_id')::uuid;
BEGIN
  IF (SELECT count(*) FROM rebuild_v2.test_assets WHERE id=v_asset AND status='uploaded')<>1 THEN
    RAISE EXCEPTION 'FAIL: assigned tester cannot read uploaded media metadata';
  END IF;
  IF NOT rebuild_v2_private.can_read_test_asset(v_path) THEN
    RAISE EXCEPTION 'FAIL: assigned tester cannot read private media helper';
  END IF;
  IF (SELECT count(*) FROM storage.objects WHERE bucket_id='test-assets' AND name=v_path)<>1 THEN
    RAISE EXCEPTION 'FAIL: assigned tester cannot SELECT private media object';
  END IF;
END;
$participant_access$;

SELECT set_config('request.jwt.claim.sub','60000000-0000-4000-8000-000000000004',true);
SELECT set_config('request.jwt.claims','{"sub":"60000000-0000-4000-8000-000000000004","role":"authenticated"}',true);
DO $outsider_read$
BEGIN
  IF (SELECT count(*) FROM rebuild_v2.test_assets WHERE id=current_setting('testdz.media_asset_id')::uuid)<>0 THEN
    RAISE EXCEPTION 'FAIL: unassigned tester can read private asset metadata';
  END IF;
  IF rebuild_v2_private.can_read_test_asset(current_setting('testdz.media_path')) THEN
    RAISE EXCEPTION 'FAIL: unassigned tester passed private asset read helper';
  END IF;
  IF (SELECT count(*) FROM storage.objects WHERE bucket_id='test-assets' AND name=current_setting('testdz.media_path'))<>0 THEN
    RAISE EXCEPTION 'FAIL: unassigned tester can SELECT private Storage object';
  END IF;
END;
$outsider_read$;

RESET ROLE;
ROLLBACK;

SELECT jsonb_build_object(
 'auth_users_after_rollback',(SELECT count(*) FROM auth.users WHERE id BETWEEN '60000000-0000-4000-8000-000000000001'::uuid AND '60000000-0000-4000-8000-000000000004'::uuid),
 'test_assets_after_rollback',(SELECT count(*) FROM rebuild_v2.test_assets WHERE original_filename='getting-started.pdf'),
 'storage_objects_after_rollback',(SELECT count(*) FROM storage.objects WHERE bucket_id='test-assets' AND name LIKE '%/60000000-0000-4000-8000-000000000005.pdf')
) AS rollback_cleanup_check;
