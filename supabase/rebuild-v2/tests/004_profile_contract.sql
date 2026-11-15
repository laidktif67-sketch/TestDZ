-- Profile V2 runtime contract for the shared profile API.
-- Run ONLY against isolated TestDZ-FixLab after 001_schema.sql through 006_storage_policies.sql.
-- Synthetic Auth users and profile rows are transaction-scoped and rolled back.

BEGIN;

INSERT INTO auth.users
  (id,aud,role,email,encrypted_password,email_confirmed_at,
   raw_app_meta_data,raw_user_meta_data,created_at,updated_at)
VALUES
  ('40000000-0000-4000-8000-000000000001','authenticated','authenticated','v2-profile-001@example.invalid','',now(),'{"provider":"email","providers":["email"]}'::jsonb,'{"name":"V2 Profile One"}'::jsonb,now(),now()),
  ('40000000-0000-4000-8000-000000000002','authenticated','authenticated','v2-profile-002@example.invalid','',now(),'{"provider":"email","providers":["email"]}'::jsonb,'{"name":"V2 Profile Two"}'::jsonb,now(),now());

SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub','40000000-0000-4000-8000-000000000001',true);
SELECT set_config(
  'request.jwt.claims',
  '{"sub":"40000000-0000-4000-8000-000000000001","role":"authenticated"}',
  true
);

DO $test$
DECLARE
  v_count integer;
  v_rows integer;
BEGIN
  SELECT count(*) INTO v_count
  FROM rebuild_v2.profiles
  WHERE id='40000000-0000-4000-8000-000000000001';
  IF v_count<>1 THEN RAISE EXCEPTION 'FAIL: user cannot read own V2 profile'; END IF;

  SELECT count(*) INTO v_count
  FROM rebuild_v2.profiles
  WHERE id='40000000-0000-4000-8000-000000000002';
  IF v_count<>0 THEN RAISE EXCEPTION 'FAIL: user can read another V2 profile'; END IF;

  UPDATE rebuild_v2.profiles
  SET display_name='Updated V2 Profile',
      phone='+213555000001',
      bio='Synthetic profile biography for the V2 contract.',
      locale='ar',
      interests='["accessibility","security"]'::jsonb,
      avatar_url='https://example.invalid/storage/v1/object/public/avatars/40000000-0000-4000-8000-000000000001/avatar-test.png'
  WHERE id='40000000-0000-4000-8000-000000000001';
  GET DIAGNOSTICS v_rows = ROW_COUNT;
  IF v_rows<>1 THEN RAISE EXCEPTION 'FAIL: owner profile update affected no row'; END IF;

  IF NOT EXISTS (
    SELECT 1 FROM rebuild_v2.profiles
    WHERE id='40000000-0000-4000-8000-000000000001'
      AND display_name='Updated V2 Profile'
      AND phone='+213555000001'
      AND locale='ar'
      AND interests='["accessibility","security"]'::jsonb
      AND avatar_url LIKE '%avatar-test.png'
  ) THEN RAISE EXCEPTION 'FAIL: allowed profile fields did not persist'; END IF;

  IF has_column_privilege('authenticated','rebuild_v2.profiles','is_verified','UPDATE')
     OR has_column_privilege('authenticated','rebuild_v2.profiles','is_banned','UPDATE') THEN
    RAISE EXCEPTION 'FAIL: authenticated can update privileged profile flags';
  END IF;

  PERFORM set_config('request.jwt.claim.sub','40000000-0000-4000-8000-000000000002',true);
  PERFORM set_config(
    'request.jwt.claims',
    '{"sub":"40000000-0000-4000-8000-000000000002","role":"authenticated"}',
    true
  );

  SELECT count(*) INTO v_count
  FROM rebuild_v2.profiles
  WHERE id='40000000-0000-4000-8000-000000000001';
  IF v_count<>0 THEN RAISE EXCEPTION 'FAIL: second user can read first user profile'; END IF;

  UPDATE rebuild_v2.profiles
  SET display_name='Unauthorized Profile Edit'
  WHERE id='40000000-0000-4000-8000-000000000001';
  GET DIAGNOSTICS v_rows = ROW_COUNT;
  IF v_rows<>0 THEN RAISE EXCEPTION 'FAIL: second user changed another profile'; END IF;
END;
$test$;

RESET ROLE;
ROLLBACK;

SELECT jsonb_build_object(
  'auth_users_after_rollback',(
    SELECT count(*) FROM auth.users
    WHERE id IN (
      '40000000-0000-4000-8000-000000000001',
      '40000000-0000-4000-8000-000000000002'
    )
  ),
  'profiles_after_rollback',(
    SELECT count(*) FROM rebuild_v2.profiles
    WHERE id IN (
      '40000000-0000-4000-8000-000000000001',
      '40000000-0000-4000-8000-000000000002'
    )
  )
) AS rollback_cleanup_check;
