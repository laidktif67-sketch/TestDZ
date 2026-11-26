-- Admin role grant boundary contract. Disposable local database only; all fixtures roll back.
BEGIN;

INSERT INTO auth.users
  (id,aud,role,email,encrypted_password,email_confirmed_at,raw_app_meta_data,raw_user_meta_data,created_at,updated_at)
VALUES
  ('91600000-0000-4000-8000-000000000001','authenticated','authenticated','v2-role-grant-admin@example.invalid','',now(),'{"provider":"email","providers":["email"]}'::jsonb,'{"name":"Role Grant Admin"}'::jsonb,now(),now()),
  ('91600000-0000-4000-8000-000000000002','authenticated','authenticated','v2-role-grant-target@example.invalid','',now(),'{"provider":"email","providers":["email"]}'::jsonb,'{"name":"Role Grant Target"}'::jsonb,now(),now()),
  ('91600000-0000-4000-8000-000000000003','authenticated','authenticated','v2-role-grant-tester@example.invalid','',now(),'{"provider":"email","providers":["email"]}'::jsonb,'{"name":"Role Grant Tester"}'::jsonb,now(),now());

INSERT INTO rebuild_v2.user_roles(user_id,role)
VALUES ('91600000-0000-4000-8000-000000000001','admin');

SET LOCAL ROLE authenticated;

DO $test$
DECLARE
  v_count integer;
  v_granted_by uuid;
BEGIN
  IF has_function_privilege('authenticated','rebuild_v2_private.grant_role(uuid,text,text)','EXECUTE') THEN
    RAISE EXCEPTION 'FAIL: private grant helper is executable by authenticated clients';
  END IF;
  IF NOT has_function_privilege('authenticated','rebuild_v2.admin_grant_role(uuid,text,text)','EXECUTE') THEN
    RAISE EXCEPTION 'FAIL: authenticated role cannot execute the guarded Admin grant wrapper';
  END IF;
  IF has_table_privilege('authenticated','rebuild_v2.user_roles','INSERT')
     OR has_table_privilege('authenticated','rebuild_v2.user_roles','UPDATE')
     OR has_table_privilege('authenticated','rebuild_v2.user_roles','DELETE') THEN
    RAISE EXCEPTION 'FAIL: authenticated role has direct role-table write privileges';
  END IF;

  PERFORM set_config('request.jwt.claim.sub','91600000-0000-4000-8000-000000000003',true);
  PERFORM set_config('request.jwt.claims','{"sub":"91600000-0000-4000-8000-000000000003","role":"authenticated"}',true);
  BEGIN
    PERFORM rebuild_v2.admin_grant_role('91600000-0000-4000-8000-000000000002','financial','Unauthorized role grant attempt');
    RAISE EXCEPTION 'FAIL: Tester unexpectedly granted a role';
  EXCEPTION WHEN SQLSTATE '42501' THEN NULL;
  END;

  PERFORM set_config('request.jwt.claim.sub','91600000-0000-4000-8000-000000000001',true);
  PERFORM set_config('request.jwt.claims','{"sub":"91600000-0000-4000-8000-000000000001","role":"authenticated"}',true);

  BEGIN
    PERFORM rebuild_v2.admin_grant_role('91600000-0000-4000-8000-000000000002','admin','Attempt to grant Admin role');
    RAISE EXCEPTION 'FAIL: Admin role assignment was accepted';
  EXCEPTION WHEN SQLSTATE '22023' THEN NULL;
  END;

  BEGIN
    PERFORM rebuild_v2.admin_grant_role('91600000-0000-4000-8000-000000000001','financial','Attempt to grant own role');
    RAISE EXCEPTION 'FAIL: self role grant was accepted';
  EXCEPTION WHEN SQLSTATE '42501' THEN NULL;
  END;

  BEGIN
    PERFORM rebuild_v2.admin_grant_role('91600000-0000-4000-8000-000000000002','financial','short');
    RAISE EXCEPTION 'FAIL: short audit reason was accepted';
  EXCEPTION WHEN SQLSTATE '22023' THEN NULL;
  END;

  PERFORM rebuild_v2.admin_grant_role(
    '91600000-0000-4000-8000-000000000002',
    'financial',
    'Approved finance staff onboarding after access review'
  );

  SELECT granted_by INTO v_granted_by
  FROM rebuild_v2.user_roles
  WHERE user_id='91600000-0000-4000-8000-000000000002' AND role='financial';
  IF v_granted_by IS DISTINCT FROM '91600000-0000-4000-8000-000000000001'::uuid THEN
    RAISE EXCEPTION 'FAIL: role grant actor was not recorded';
  END IF;

  SELECT count(*) INTO v_count
  FROM rebuild_v2.audit_events
  WHERE actor_id='91600000-0000-4000-8000-000000000001'
    AND action='role.grant'
    AND target_id='91600000-0000-4000-8000-000000000002'
    AND metadata->>'role'='financial';
  IF v_count <> 1 THEN
    RAISE EXCEPTION 'FAIL: expected one audit event for role grant, got %',v_count;
  END IF;

  -- An exact duplicate grant is harmless and must not create a second audit event.
  PERFORM rebuild_v2.admin_grant_role(
    '91600000-0000-4000-8000-000000000002',
    'financial',
    'Duplicate role grant should be a no-op'
  );
  SELECT count(*) INTO v_count
  FROM rebuild_v2.audit_events
  WHERE actor_id='91600000-0000-4000-8000-000000000001'
    AND action='role.grant'
    AND target_id='91600000-0000-4000-8000-000000000002'
    AND metadata->>'role'='financial';
  IF v_count <> 1 THEN
    RAISE EXCEPTION 'FAIL: duplicate role grant created an extra audit event';
  END IF;
END;
$test$;

RESET ROLE;
ROLLBACK;
SELECT 'rebuild_v2_admin_role_grant_contract: PASS' AS result;
