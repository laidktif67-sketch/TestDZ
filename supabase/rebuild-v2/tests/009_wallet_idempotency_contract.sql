-- Wallet posting idempotency regression contract.
-- Run after candidate scripts 001..021 on a disposable Supabase database.
-- Synthetic users, wallet rows, ledger entries and audit events are rolled back.

BEGIN;

INSERT INTO auth.users
  (id,aud,role,email,encrypted_password,email_confirmed_at,
   raw_app_meta_data,raw_user_meta_data,created_at,updated_at)
VALUES
  ('90000000-0000-4000-8000-000000000001','authenticated','authenticated','v2-wallet-financial-001@example.invalid','',now(),'{"provider":"email","providers":["email"]}'::jsonb,'{"name":"Wallet Financial One"}'::jsonb,now(),now()),
  ('90000000-0000-4000-8000-000000000002','authenticated','authenticated','v2-wallet-financial-002@example.invalid','',now(),'{"provider":"email","providers":["email"]}'::jsonb,'{"name":"Wallet Financial Two"}'::jsonb,now(),now()),
  ('90000000-0000-4000-8000-000000000003','authenticated','authenticated','v2-wallet-target@example.invalid','',now(),'{"provider":"email","providers":["email"]}'::jsonb,'{"name":"Wallet Target"}'::jsonb,now(),now());

INSERT INTO rebuild_v2.user_roles(user_id,role)
VALUES
  ('90000000-0000-4000-8000-000000000001','financial'),
  ('90000000-0000-4000-8000-000000000002','financial')
ON CONFLICT(user_id,role) DO NOTHING;

SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub','90000000-0000-4000-8000-000000000001',true);
SELECT set_config('request.jwt.claims','{"sub":"90000000-0000-4000-8000-000000000001","role":"authenticated"}',true);

DO $test$
DECLARE
  v_first_id uuid;
  v_retry_id uuid;
  v_reference_id uuid := '90000000-0000-4000-8000-000000000099';
  v_ledger_count integer;
  v_audit_count integer;
  v_balance bigint;
BEGIN
  v_first_id := rebuild_v2_private.post_wallet_entry(
    '90000000-0000-4000-8000-000000000003',
    'earned_points',100,'reward','wallet-idem-regression-001',
    'Regression reward reason','assignment',v_reference_id
  );

  v_retry_id := rebuild_v2_private.post_wallet_entry(
    '90000000-0000-4000-8000-000000000003',
    'earned_points',100,'reward','wallet-idem-regression-001',
    'Regression reward reason','assignment',v_reference_id
  );
  IF v_retry_id IS DISTINCT FROM v_first_id THEN
    RAISE EXCEPTION 'FAIL: identical retry did not return the original ledger entry';
  END IF;

  BEGIN
    PERFORM rebuild_v2_private.post_wallet_entry(
      '90000000-0000-4000-8000-000000000003',
      'earned_points',100,'refund','wallet-idem-regression-001',
      'Regression reward reason','assignment',v_reference_id
    );
    RAISE EXCEPTION 'FAIL: reused key accepted a different entry_type' USING ERRCODE='P0002';
  EXCEPTION WHEN SQLSTATE 'P0001' THEN
    IF SQLERRM <> 'idempotency key already used for a different operation' THEN RAISE; END IF;
  END;

  BEGIN
    PERFORM rebuild_v2_private.post_wallet_entry(
      '90000000-0000-4000-8000-000000000003',
      'earned_points',100,'reward','wallet-idem-regression-001',
      'Regression reward reason','refund',v_reference_id
    );
    RAISE EXCEPTION 'FAIL: reused key accepted a different reference_type' USING ERRCODE='P0002';
  EXCEPTION WHEN SQLSTATE 'P0001' THEN
    IF SQLERRM <> 'idempotency key already used for a different operation' THEN RAISE; END IF;
  END;

  BEGIN
    PERFORM rebuild_v2_private.post_wallet_entry(
      '90000000-0000-4000-8000-000000000003',
      'earned_points',100,'reward','wallet-idem-regression-001',
      'Regression reward reason','assignment','90000000-0000-4000-8000-000000000098'
    );
    RAISE EXCEPTION 'FAIL: reused key accepted a different reference_id' USING ERRCODE='P0002';
  EXCEPTION WHEN SQLSTATE 'P0001' THEN
    IF SQLERRM <> 'idempotency key already used for a different operation' THEN RAISE; END IF;
  END;

  BEGIN
    PERFORM rebuild_v2_private.post_wallet_entry(
      '90000000-0000-4000-8000-000000000003',
      'earned_points',100,'reward','wallet-idem-regression-001',
      'A different but valid reason','assignment',v_reference_id
    );
    RAISE EXCEPTION 'FAIL: reused key accepted a different reason' USING ERRCODE='P0002';
  EXCEPTION WHEN SQLSTATE 'P0001' THEN
    IF SQLERRM <> 'idempotency key already used for a different operation' THEN RAISE; END IF;
  END;

  PERFORM set_config('request.jwt.claim.sub','90000000-0000-4000-8000-000000000002',true);
  PERFORM set_config('request.jwt.claims','{"sub":"90000000-0000-4000-8000-000000000002","role":"authenticated"}',true);
  BEGIN
    PERFORM rebuild_v2_private.post_wallet_entry(
      '90000000-0000-4000-8000-000000000003',
      'earned_points',100,'reward','wallet-idem-regression-001',
      'Regression reward reason','assignment',v_reference_id
    );
    RAISE EXCEPTION 'FAIL: reused key accepted a different financial actor' USING ERRCODE='P0002';
  EXCEPTION WHEN SQLSTATE 'P0001' THEN
    IF SQLERRM <> 'idempotency key already used for a different operation' THEN RAISE; END IF;
  END;

  SELECT count(*) INTO v_ledger_count
  FROM rebuild_v2.wallet_ledger
  WHERE idempotency_key='wallet-idem-regression-001';
  IF v_ledger_count <> 1 THEN
    RAISE EXCEPTION 'FAIL: expected exactly one ledger row, got %',v_ledger_count;
  END IF;

  -- Audit log is Admin-only; inspect as the local migration owner. The retry
  -- and rejected key reuses must still produce exactly one financial audit row.
  PERFORM set_config('role','postgres',true);
  SELECT count(*) INTO v_audit_count
  FROM rebuild_v2.audit_events
  WHERE actor_id='90000000-0000-4000-8000-000000000001'
    AND action='wallet.entry.posted'
    AND target_id='90000000-0000-4000-8000-000000000003'
    AND request_id='wallet-idem-regression-001'
    AND metadata->>'entry_id'=v_first_id::text;
  IF v_audit_count <> 1 THEN
    RAISE EXCEPTION 'FAIL: expected exactly one audited wallet posting, got %',v_audit_count;
  END IF;
  PERFORM set_config('role','authenticated',true);

  SELECT earned_points INTO v_balance
  FROM rebuild_v2.wallets
  WHERE user_id='90000000-0000-4000-8000-000000000003';
  IF v_balance <> 100 THEN
    RAISE EXCEPTION 'FAIL: expected wallet balance 100 after retries/rejections, got %',v_balance;
  END IF;
END;
$test$;

ROLLBACK;

SELECT 'rebuild_v2_wallet_idempotency_contract: PASS' AS result;
