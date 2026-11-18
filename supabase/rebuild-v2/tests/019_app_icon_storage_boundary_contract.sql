-- V2 app-icon Storage isolation contract.
-- Legacy app-icons policies authorize the first folder when it equals auth.uid().
-- V2 therefore uses a dedicated "v2/" prefix and a helper that verifies app ownership.
-- Synthetic auth users, app rows and Storage objects are rolled back.

BEGIN;

INSERT INTO auth.users
  (id,aud,role,email,encrypted_password,email_confirmed_at,
   raw_app_meta_data,raw_user_meta_data,created_at,updated_at)
VALUES
  ('91900000-0000-4000-8000-000000000001','authenticated','authenticated','v2-icon-owner@example.invalid','',now(),
   '{"provider":"email","providers":["email"]}'::jsonb,'{"name":"V2 Icon Owner"}'::jsonb,now(),now()),
  ('91900000-0000-4000-8000-000000000002','authenticated','authenticated','v2-icon-outsider@example.invalid','',now(),
   '{"provider":"email","providers":["email"]}'::jsonb,'{"name":"V2 Icon Outsider"}'::jsonb,now(),now());

INSERT INTO rebuild_v2.user_roles(user_id,role)
VALUES
  ('91900000-0000-4000-8000-000000000001','developer'),
  ('91900000-0000-4000-8000-000000000002','developer')
ON CONFLICT(user_id,role) DO NOTHING;

SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub','91900000-0000-4000-8000-000000000001',true);
SELECT set_config('request.jwt.claims','{"sub":"91900000-0000-4000-8000-000000000001","role":"authenticated"}',true);

DO $owner$
DECLARE
  v_app_id uuid;
  v_path text;
BEGIN
  v_app_id:=rebuild_v2.create_app(
    'V2 Icon Contract App',
    'dz.testdz.v2_icon_contract',
    'A synthetic app used only for the rolled-back V2 app-icon storage contract.',
    'tools'
  );
  v_path:='v2/91900000-0000-4000-8000-000000000001/'||v_app_id::text||'/icon.png';

  IF NOT rebuild_v2_private.can_manage_app_icon(v_path) THEN
    RAISE EXCEPTION 'FAIL: owner rejected for the V2-prefixed app icon path';
  END IF;
  IF rebuild_v2_private.can_manage_app_icon(
    '91900000-0000-4000-8000-000000000001/'||v_app_id::text||'/icon.png'
  ) THEN
    RAISE EXCEPTION 'FAIL: V2 helper accepted the legacy unprefixed path';
  END IF;

  INSERT INTO storage.objects(bucket_id,name,metadata,owner,owner_id)
  VALUES(
    'app-icons',v_path,
    jsonb_build_object('size','1024','mimetype','image/png'),
    '91900000-0000-4000-8000-000000000001'::uuid,
    '91900000-0000-4000-8000-000000000001'
  );

  PERFORM set_config('testdz.v2_icon_app_id',v_app_id::text,true);
  PERFORM set_config('testdz.v2_icon_path',v_path,true);
END;
$owner$;

-- A different authenticated developer cannot write to the owner's V2 icon path.
SELECT set_config('request.jwt.claim.sub','91900000-0000-4000-8000-000000000002',true);
SELECT set_config('request.jwt.claims','{"sub":"91900000-0000-4000-8000-000000000002","role":"authenticated"}',true);

DO $outsider$
DECLARE
  v_app_id uuid:=current_setting('testdz.v2_icon_app_id')::uuid;
  v_path text:=current_setting('testdz.v2_icon_path');
BEGIN
  IF rebuild_v2_private.can_manage_app_icon(v_path) THEN
    RAISE EXCEPTION 'FAIL: outsider passed V2 app-icon ownership helper';
  END IF;

  BEGIN
    INSERT INTO storage.objects(bucket_id,name,metadata,owner,owner_id)
    VALUES(
      'app-icons',v_path,
      jsonb_build_object('size','1024','mimetype','image/png'),
      '91900000-0000-4000-8000-000000000002'::uuid,
      '91900000-0000-4000-8000-000000000002'
    );
    RAISE EXCEPTION 'FAIL: outsider inserted another developer V2 app icon';
  EXCEPTION WHEN SQLSTATE '42501' THEN NULL;
  END;

  IF (SELECT count(*) FROM storage.objects WHERE bucket_id='app-icons' AND name=v_path) <> 1
     OR NOT EXISTS(
       SELECT 1 FROM storage.objects
       WHERE bucket_id='app-icons' AND name=v_path
         AND owner_id='91900000-0000-4000-8000-000000000001'
     ) THEN
    RAISE EXCEPTION 'FAIL: outsider changed or removed the owner's V2 app icon';
  END IF;
END;
$outsider$;

RESET ROLE;
ROLLBACK;

SELECT 'rebuild_v2_app_icon_storage_boundary_contract: PASS' AS result;
