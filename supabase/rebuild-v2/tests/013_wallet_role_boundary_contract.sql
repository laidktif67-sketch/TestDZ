-- Wallet posting and role-management authorization boundary contract.
-- Run after candidate scripts 001..021 on a disposable Supabase database.
-- All synthetic auth users, roles, wallet entries and audit rows are rolled back.

BEGIN;

INSERT INTO auth.users
  (id,aud,role,email,encrypted_password,email_confirmed_at,
   raw_app_meta_data,raw_user_meta_data,created_at,updated_at)
VALUES
  ('91300000-0000-4000-8000-000000000001','authenticated','authenticated','v2-wallet-boundary-tester@example.invalid','',now(),'{"provider":"email","providers":["email"]}'::jsonb,'{"name":"Wallet Boundary Tester"}'::jsonb,now(),now()),
  ('91300000-0000-4000-8000-000000000002','authenticated','authenticated','v2-wallet-boundary-support@example.invalid','',now(),'{"provider":"email","providers":["email"]}'::jsonb,'{"name":"Wallet Boundary Support"}'::jsonb,now(),now()),
  ('91300000-0000-4000-8000-000000000003','authenticated','authenticated','v2-wallet-boundary-financial@example.invalid','',now(),'{"provider":"email","providers":["email"]}'::jsonb,'{"name":"Wallet Boundary Financial"}'::jsonb,now(),now()),
  ('91300000-0000-4000-8000-000000000004','authenticated','authenticated','v2-wallet-boundary-admin@example.invalid','',now(),'{"provider":"email","providers":["email"]}'::jsonb,'{"name":"Wallet Boundary Admin"}'::jsonb,now(),now()),
  ('91300000-0000-4000-8000-000000000005','authenticated','authenticated','v2-wallet-boundary-target@example.invalid','',now(),'{"provider":"email","providers":["email"]}'::jsonb,'{"name":"Wallet Boundary Target"}'::jsonb,now(),now());

INSERT INTO rebuild_v2.user_roles(user_id,role)
VALUES
  ('91300000-0000-4000-8000-000000000002','support'),
  ('91300000-0000-4000-8000-000000000003','financial'),
  ('91300000-0000-4000-8000-000000000004','admin')
ON CONFLICT(user_id,role) DO NOTHING;

SET LOCAL ROLE authenticated;

DO $test$
DECLARE
  v_count integer;
  v_balance bigint;
BEGIN
  IF has_table_privilege('authenticated','rebuild_v2.wallets','INSERT')
     OR has_table_privilege('authenticated','rebuild_v2.wallets','UPDATE')
     OR has_table_privilege('authenticated','rebuild_v2.wallet_ledger','INSERT')
     OR has_table_privilege('authenticated','rebuild_v2.wallet_ledger','UPDATE')
     OR has_table_privilege('authenticated','rebuild_v2.wallet_ledger','DELETE') THEN
    RAISE EXCEPTION 'FAIL: authenticated role has direct wallet write privileges';
  END IF;

  PERFORM set_config('request.jwt.claim.sub','91300000-0000-4000-8000-000000000001',true);
  PERFORM set_config('request.jwt.claims','{"sub":"91300000-0000-4000-8000-000000000001","role":"authenticated"}',true);
  BEGIN
    PERFORM rebuild_v2_private.post_wallet_entry(
      '91300000-0000-4000-8000-000000000005','earned_points',100,'reward',
      'wallet-boundary-tester-001','Unauthorized tester wallet attempt'
    );
    RAISE EXCEPTION 'FAIL: tester unexpectedly posted a wallet entry';
  EXCEPTION WHEN SQLSTATE '42501' THEN
    NULL;
  END;

  PERFORM set_config('request.jwt.claim.sub','91300000-0000-4000-8000-000000000002',true);
  PERFORM set_config('request.jwt.claims','{"sub":"91300000-0000-4000-8000-000000000002","role":"authenticated"}',true);
  BEGIN
    PERFORM rebuild_v2_private.post_wallet_entry(
      '91300000-0000-4000-8000-000000000005','earned_points',100,'reward',
      'wallet-boundary-support-001','Unauthorized support wallet attempt'
    );
    RAISE EXCEPTION 'FAIL: support unexpectedly posted a wallet entry';
  EXCEPTION WHEN SQLSTATE '42501' THEN
    NULL;
  END;

  PERFORM set_config('request.jwt.claim.sub','91300000-0000-4000-8000-000000000003',true);
  PERFORM set_config('request.jwt.claims','{"sub":"91300000-0000-4000-8000-000000000003","role":"authenticated"}',true);
  PERFORM rebuild_v2_private.post_wallet_entry(
    '91300000-0000-4000-8000-000000000005','earned_points',100,'reward',
    'wallet-boundary-financial-001','Authorized financial wallet posting'
  );

  BEGIN
    PERFORM rebuild_v2_private.grant_role(
      '91300000-0000-4000-8000-000000000005','developer',
      'Financial staff cannot grant roles'
    );
    RAISE EXCEPTION 'FAIL: financial role unexpectedly granted a user role';
  EXCEPTION WHEN SQLSTATE '42501' THEN
    NULL;
  END;

  PERFORM set_config('request.jwt.claim.sub','91300000-0000-4000-8000-000000000004',true);
  PERFORM set_config('request.jwt.claims','{"sub":"91300000-0000-4000-8000-000000000004","role":"authenticated"}',true);
  PERFORM rebuild_v2_private.post_wallet_entry(
    '91300000-0000-4000-8000-000000000005','earned_points',50,'adjustment',
    'wallet-boundary-admin-001','Authorized admin wallet adjustment'
  );
  PERFORM rebuild_v2_private.grant_role(
    '91300000-0000-4000-8000-000000000005','developer',
    'Admin grants developer role for boundary contract'
  );

  SELECT count(*) INTO v_count
  FROM rebuild_v2.wallet_ledger
  WHERE idempotency_key IN ('wallet-boundary-financial-001','wallet-boundary-admin-001');
  IF v_count <> 2 THEN
    RAISE EXCEPTION 'FAIL: expected exactly two authorized wallet entries, got %',v_count;
  END IF;

  SELECT earned_points INTO v_balance
  FROM rebuild_v2.wallets
  WHERE user_id='91300000-0000-4000-8000-000000000005';
  IF v_balance <> 150 THEN
    RAISE EXCEPTION 'FAIL: expected target balance 150 after authorized postings, got %',v_balance;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM rebuild_v2.user_roles
    WHERE user_id='91300000-0000-4000-8000-000000000005' AND role='developer'
      AND granted_by='91300000-0000-4000-8000-000000000004'
  ) THEN
    RAISE EXCEPTION 'FAIL: admin role grant was not attributed to the admin actor';
  END IF;
END;
$test$;

ROLLBACK;

SELECT 'rebuild_v2_wallet_role_boundary_contract: PASS' AS result;
