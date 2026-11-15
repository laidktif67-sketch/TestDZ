-- Developer app lifecycle V2 runtime contract.
-- Run ONLY against isolated TestDZ-FixLab after 001_schema.sql through 006_storage_policies.sql.
-- All Auth users and app rows are synthetic and rolled back. Never run against Production.

BEGIN;

INSERT INTO auth.users
  (id,aud,role,email,encrypted_password,email_confirmed_at,
   raw_app_meta_data,raw_user_meta_data,created_at,updated_at)
VALUES
  ('30000000-0000-4000-8000-000000000001','authenticated','authenticated','v2-app-dev-001@example.invalid','',now(),'{"provider":"email","providers":["email"]}'::jsonb,'{"name":"V2 App Developer"}'::jsonb,now(),now()),
  ('30000000-0000-4000-8000-000000000002','authenticated','authenticated','v2-app-dev-002@example.invalid','',now(),'{"provider":"email","providers":["email"]}'::jsonb,'{"name":"V2 Other Developer"}'::jsonb,now(),now());

INSERT INTO rebuild_v2.user_roles(user_id,role)
VALUES
  ('30000000-0000-4000-8000-000000000001','developer'),
  ('30000000-0000-4000-8000-000000000002','developer');

SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub','30000000-0000-4000-8000-000000000001',true);
SELECT set_config(
  'request.jwt.claims',
  '{"sub":"30000000-0000-4000-8000-000000000001","role":"authenticated"}',
  true
);

DO $test$
DECLARE
  v_app_id uuid;
  v_limit record;
  v_visible integer;
  v_icon_path text;
BEGIN
  SELECT * INTO v_limit FROM rebuild_v2.get_app_limit();
  IF v_limit.current_active_apps <> 0 OR NOT v_limit.can_create OR v_limit.max_active_apps < 1 THEN
    RAISE EXCEPTION 'FAIL: initial app quota is not available';
  END IF;

  v_app_id := rebuild_v2.create_app(
    'V2 Lifecycle App','dz.testdz.v2lifecycle',
    'Synthetic developer app for a rolled-back lifecycle contract test.','tools'
  );
  IF v_app_id IS NULL THEN RAISE EXCEPTION 'FAIL: create_app returned no id'; END IF;

  SELECT count(*) INTO v_visible FROM rebuild_v2.apps WHERE id=v_app_id;
  IF v_visible <> 1 THEN RAISE EXCEPTION 'FAIL: owner cannot read newly-created app'; END IF;

  PERFORM rebuild_v2.update_app(
    v_app_id,'V2 Lifecycle App Updated',
    'Updated synthetic developer app for the rolled-back lifecycle contract test.','education'
  );
  IF NOT EXISTS (
    SELECT 1 FROM rebuild_v2.apps
    WHERE id=v_app_id AND name='V2 Lifecycle App Updated' AND category='education'
  ) THEN RAISE EXCEPTION 'FAIL: update_app did not persist owner changes'; END IF;

  BEGIN
    PERFORM rebuild_v2.create_app(
      'V2 Quota Overflow','dz.testdz.v2quotaoverflow',
      'Synthetic second app should exceed the default free-plan app quota.','tools'
    );
    RAISE EXCEPTION 'FAIL: create_app exceeded the active app quota';
  EXCEPTION WHEN SQLSTATE 'P0001' THEN
    IF SQLERRM <> 'PLAN_LIMIT_REACHED' THEN RAISE; END IF;
  END;

  v_icon_path := '30000000-0000-4000-8000-000000000001/'||v_app_id::text||'/icon.png';
  IF NOT rebuild_v2_private.can_manage_app_icon(v_icon_path) THEN
    RAISE EXCEPTION 'FAIL: owner app-icon Storage policy helper denied the owner';
  END IF;

  PERFORM rebuild_v2.archive_app(v_app_id);
  SELECT * INTO v_limit FROM rebuild_v2.get_app_limit();
  IF v_limit.current_active_apps <> 0 OR NOT v_limit.can_create THEN
    RAISE EXCEPTION 'FAIL: archived app still consumes active quota';
  END IF;

  PERFORM rebuild_v2.restore_app(v_app_id);
  SELECT * INTO v_limit FROM rebuild_v2.get_app_limit();
  IF v_limit.current_active_apps <> 1 OR v_limit.can_create THEN
    RAISE EXCEPTION 'FAIL: restored app was not counted against active quota';
  END IF;

  PERFORM set_config('request.jwt.claim.sub','30000000-0000-4000-8000-000000000002',true);
  PERFORM set_config(
    'request.jwt.claims',
    '{"sub":"30000000-0000-4000-8000-000000000002","role":"authenticated"}',
    true
  );

  SELECT count(*) INTO v_visible FROM rebuild_v2.apps WHERE id=v_app_id;
  IF v_visible <> 0 THEN RAISE EXCEPTION 'FAIL: another developer can read a private draft app'; END IF;

  IF rebuild_v2_private.can_manage_app_icon(v_icon_path) THEN
    RAISE EXCEPTION 'FAIL: another developer can manage the owner's app icon';
  END IF;

  BEGIN
    PERFORM rebuild_v2.update_app(
      v_app_id,'Unauthorized Edit',
      'An unrelated developer must not be able to change this app record.','tools'
    );
    RAISE EXCEPTION 'FAIL: update_app accepted a non-owner';
  EXCEPTION WHEN SQLSTATE 'P0002' THEN
    NULL;
  END;

  BEGIN
    PERFORM rebuild_v2.archive_app(v_app_id);
    RAISE EXCEPTION 'FAIL: archive_app accepted a non-owner';
  EXCEPTION WHEN SQLSTATE 'P0002' THEN
    NULL;
  END;
END;
$test$;

RESET ROLE;
ROLLBACK;

-- Every value below must be zero after rollback.
SELECT jsonb_build_object(
  'auth_users_after_rollback',(
    SELECT count(*) FROM auth.users
    WHERE id IN (
      '30000000-0000-4000-8000-000000000001',
      '30000000-0000-4000-8000-000000000002'
    )
  ),
  'profiles_after_rollback',(
    SELECT count(*) FROM rebuild_v2.profiles
    WHERE id IN (
      '30000000-0000-4000-8000-000000000001',
      '30000000-0000-4000-8000-000000000002'
    )
  ),
  'apps_after_rollback',(
    SELECT count(*) FROM rebuild_v2.apps
    WHERE package_name IN ('dz.testdz.v2lifecycle','dz.testdz.v2quotaoverflow')
  )
) AS rollback_cleanup_check;
