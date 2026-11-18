-- Onboarding must never self-grant Developer or revoke an approved role.
-- Run after candidate scripts 001..021 on a disposable Supabase database.
-- All fixtures and role-request rows are rolled back.

BEGIN;

INSERT INTO auth.users
  (id,aud,role,email,encrypted_password,email_confirmed_at,
   raw_app_meta_data,raw_user_meta_data,created_at,updated_at)
VALUES
  ('91400000-0000-4000-8000-000000000001','authenticated','authenticated','v2-onboarding-dev-request@example.invalid','',now(),'{"provider":"email","providers":["email"]}'::jsonb,'{"name":"Onboarding Developer Request"}'::jsonb,now(),now()),
  ('91400000-0000-4000-8000-000000000002','authenticated','authenticated','v2-onboarding-approved-dev@example.invalid','',now(),'{"provider":"email","providers":["email"]}'::jsonb,'{"name":"Onboarding Approved Developer"}'::jsonb,now(),now());

-- This account has already received Developer access through a trusted review.
INSERT INTO rebuild_v2.user_roles(user_id,role,granted_by)
VALUES ('91400000-0000-4000-8000-000000000002','developer',NULL)
ON CONFLICT(user_id,role) DO NOTHING;

SET LOCAL ROLE authenticated;

DO $test$
DECLARE
  v_count integer;
  v_roles text[];
  v_result jsonb;
BEGIN
  PERFORM set_config('request.jwt.claim.sub','91400000-0000-4000-8000-000000000001',true);
  PERFORM set_config('request.jwt.claims','{"sub":"91400000-0000-4000-8000-000000000001","role":"authenticated"}',true);

  v_result := rebuild_v2.complete_onboarding(
    ARRAY['tester','developer'],
    '["security","accessibility"]'::jsonb
  );

  IF EXISTS (
    SELECT 1 FROM rebuild_v2.user_roles
    WHERE user_id='91400000-0000-4000-8000-000000000001' AND role='developer'
  ) THEN
    RAISE EXCEPTION 'FAIL: onboarding self-granted Developer role';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM rebuild_v2.user_roles
    WHERE user_id='91400000-0000-4000-8000-000000000001' AND role='tester'
  ) THEN
    RAISE EXCEPTION 'FAIL: onboarding did not preserve baseline Tester role';
  END IF;

  SELECT count(*) INTO v_count
  FROM rebuild_v2.role_requests
  WHERE user_id='91400000-0000-4000-8000-000000000001'
    AND requested_role='developer' AND status='pending';
  IF v_count <> 1 OR v_result->>'developer_access' <> 'pending' THEN
    RAISE EXCEPTION 'FAIL: Developer selection did not create exactly one pending request';
  END IF;

  -- Retrying onboarding must be idempotent for the pending request.
  PERFORM rebuild_v2.complete_onboarding(
    ARRAY['tester','developer'],
    '["security"]'::jsonb
  );
  SELECT count(*) INTO v_count
  FROM rebuild_v2.role_requests
  WHERE user_id='91400000-0000-4000-8000-000000000001'
    AND requested_role='developer' AND status='pending';
  IF v_count <> 1 THEN
    RAISE EXCEPTION 'FAIL: repeated onboarding duplicated pending Developer requests';
  END IF;

  -- A user cannot request Financial, Support, or Admin through onboarding.
  BEGIN
    PERFORM rebuild_v2.complete_onboarding(ARRAY['admin'],'[]'::jsonb);
    RAISE EXCEPTION 'FAIL: onboarding accepted a privileged role';
  EXCEPTION WHEN SQLSTATE '22023' THEN
    NULL;
  END;

  -- Re-onboarding must not remove a Developer role granted by a trusted reviewer.
  PERFORM set_config('request.jwt.claim.sub','91400000-0000-4000-8000-000000000002',true);
  PERFORM set_config('request.jwt.claims','{"sub":"91400000-0000-4000-8000-000000000002","role":"authenticated"}',true);
  PERFORM rebuild_v2.complete_onboarding(ARRAY['tester'],'[]'::jsonb);

  IF NOT EXISTS (
    SELECT 1 FROM rebuild_v2.user_roles
    WHERE user_id='91400000-0000-4000-8000-000000000002' AND role='developer'
  ) THEN
    RAISE EXCEPTION 'FAIL: onboarding revoked an already-approved Developer role';
  END IF;
END;
$test$;

RESET ROLE;
ROLLBACK;

SELECT 'rebuild_v2_onboarding_developer_approval_contract: PASS' AS result;
