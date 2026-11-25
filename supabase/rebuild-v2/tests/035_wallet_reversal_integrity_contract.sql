-- Wallet reversal integrity contract.
-- Run after 001..035 on a clean, disposable Supabase database.
-- All synthetic users, wallet entries, audit rows and test triggers roll back.

BEGIN;

INSERT INTO auth.users
  (id,aud,role,email,encrypted_password,email_confirmed_at,
   raw_app_meta_data,raw_user_meta_data,created_at,updated_at)
VALUES
  ('93500000-0000-4000-8000-000000000001','authenticated','authenticated','v2-reversal-financial@example.invalid','',now(),'{"provider":"email","providers":["email"]}'::jsonb,'{"name":"Reversal Financial"}'::jsonb,now(),now()),
  ('93500000-0000-4000-8000-000000000002','authenticated','authenticated','v2-reversal-admin@example.invalid','',now(),'{"provider":"email","providers":["email"]}'::jsonb,'{"name":"Reversal Admin"}'::jsonb,now(),now()),
  ('93500000-0000-4000-8000-000000000003','authenticated','authenticated','v2-reversal-target@example.invalid','',now(),'{"name":"Reversal Target"}'::jsonb,now(),now()),
  ('93500000-0000-4000-8000-000000000004','authenticated','authenticated','v2-reversal-other@example.invalid','',now(),'{"provider":"email","providers":["email"]}'::jsonb,'{"name":"Other Target"}'::jsonb,now(),now());

INSERT INTO rebuild_v2.user_roles(user_id,role)
VALUES
  ('93500000-0000-4000-8000-000000000001','financial'),
  ('93500000-0000-4000-8000-000000000002','admin')
ON CONFLICT(user_id,role) DO NOTHING;

SET LOCAL ROLE authenticated;

DO $test$
DECLARE
  v_original uuid;
  v_reversal uuid;
  v_retry uuid;
  v_count integer;
  v_balance bigint;
BEGIN
  PERFORM set_config('request.jwt.claim.sub','93500000-0000-4000-8000-000000000001',true);
  PERFORM set_config('request.jwt.claims','{"sub":"93500000-0000-4000-8000-000000000001","role":"authenticated"}',true);

  -- REV-01: ordinary movement, followed by exact reversal.
  v_original := rebuild_v2_private.post_wallet_entry(
    '93500000-0000-4000-8000-000000000003',
    'earned_points',200,'reward','reversal-original-0001',
    'Original reward for reversal contract'
  );

  v_reversal := rebuild_v2_private.post_wallet_entry(
    '93500000-0000-4000-8000-000000000003',
    'earned_points',-200,'reversal','reversal-valid-0001',
    'Exact reversal of original reward',NULL,NULL,v_original
  );

  -- REV-03: same idempotency key and same complete payload returns same row.
  v_retry := rebuild_v2_private.post_wallet_entry(
    '93500000-0000-4000-8000-000000000003',
    'earned_points',-200,'reversal','reversal-valid-0001',
    'Exact reversal of original reward',NULL,NULL,v_original
  );
  IF v_retry IS DISTINCT FROM v_reversal THEN
    RAISE EXCEPTION 'FAIL REV-03: exact retry did not return the original reversal';
  END IF;

  -- Same idempotency key but a different original must be rejected.
  BEGIN
    PERFORM rebuild_v2_private.post_wallet_entry(
      '93500000-0000-4000-8000-000000000003',
      'earned_points',-200,'reversal','reversal-valid-0001',
      'Exact reversal of original reward',NULL,NULL,
      '93500000-0000-4000-8000-000000000099'
    );
    RAISE EXCEPTION 'FAIL REV-03: idempotency key accepted a different original';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM LIKE 'FAIL REV-03:%' THEN RAISE; END IF;
  END;

  -- REV-04: a second key cannot reverse the same original.
  BEGIN
    PERFORM rebuild_v2_private.post_wallet_entry(
      '93500000-0000-4000-8000-000000000003',
      'earned_points',-200,'reversal','reversal-duplicate-0001',
      'Second attempt to reverse same movement',NULL,NULL,v_original
    );
    RAISE EXCEPTION 'FAIL REV-04: second reversal with another key was accepted';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM LIKE 'FAIL REV-04:%' THEN RAISE; END IF;
  END;

  -- REV-05: wrong user.
  BEGIN
    PERFORM rebuild_v2_private.post_wallet_entry(
      '93500000-0000-4000-8000-000000000004',
      'earned_points',-200,'reversal','reversal-wrong-user-001',
      'Wrong user reversal attempt',NULL,NULL,v_original
    );
    RAISE EXCEPTION 'FAIL REV-05: reversal for another user was accepted';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM LIKE 'FAIL REV-05:%' THEN RAISE; END IF;
  END;

  -- REV-06: wrong wallet type.
  BEGIN
    PERFORM rebuild_v2_private.post_wallet_entry(
      '93500000-0000-4000-8000-000000000003',
      'purchased_credits',-200,'reversal','reversal-wrong-wallet-001',
      'Wrong wallet type reversal attempt',NULL,NULL,v_original
    );
    RAISE EXCEPTION 'FAIL REV-06: wallet type mismatch was accepted';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM LIKE 'FAIL REV-06:%' THEN RAISE; END IF;
  END;

  -- REV-07: wrong amount.
  BEGIN
    PERFORM rebuild_v2_private.post_wallet_entry(
      '93500000-0000-4000-8000-000000000003',
      'earned_points',-199,'reversal','reversal-wrong-amount-001',
      'Wrong amount reversal attempt',NULL,NULL,v_original
    );
    RAISE EXCEPTION 'FAIL REV-07: non-opposite amount was accepted';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM LIKE 'FAIL REV-07:%' THEN RAISE; END IF;
  END;

  -- REV-02: missing original.
  BEGIN
    PERFORM rebuild_v2_private.post_wallet_entry(
      '93500000-0000-4000-8000-000000000003',
      'earned_points',-10,'reversal','reversal-missing-original',
      'Missing original reversal attempt',NULL,NULL,
      '93500000-0000-4000-8000-000000000099'
    );
    RAISE EXCEPTION 'FAIL REV-02: missing original was accepted';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM LIKE 'FAIL REV-02:%' THEN RAISE; END IF;
  END;

  -- REV-08: a reversal cannot itself be reversed.
  BEGIN
    PERFORM rebuild_v2_private.post_wallet_entry(
      '93500000-0000-4000-8000-000000000003',
      'earned_points',200,'reversal','reversal-of-reversal-001',
      'Attempt to reverse a reversal',NULL,NULL,v_reversal
    );
    RAISE EXCEPTION 'FAIL REV-08: reversal of reversal was accepted';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM LIKE 'FAIL REV-08:%' THEN RAISE; END IF;
  END;

  -- Admin receives no exception to duplicate-reversal or reversal-of-reversal rules.
  PERFORM set_config('request.jwt.claim.sub','93500000-0000-4000-8000-000000000002',true);
  PERFORM set_config('request.jwt.claims','{"sub":"93500000-0000-4000-8000-000000000002","role":"authenticated"}',true);

  BEGIN
    PERFORM rebuild_v2_private.post_wallet_entry(
      '93500000-0000-4000-8000-000000000003',
      'earned_points',-200,'reversal','admin-duplicate-reversal-001',
      'Admin duplicate reversal attempt',NULL,NULL,v_original
    );
    RAISE EXCEPTION 'FAIL ADMIN: Admin bypassed one-reversal rule';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM LIKE 'FAIL ADMIN:%' THEN RAISE; END IF;
  END;

  BEGIN
    PERFORM rebuild_v2_private.post_wallet_entry(
      '93500000-0000-4000-8000-000000000003',
      'earned_points',200,'reversal','admin-reversal-of-reversal',
      'Admin reversal of reversal attempt',NULL,NULL,v_reversal
    );
    RAISE EXCEPTION 'FAIL ADMIN: Admin bypassed reversal-of-reversal rule';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM LIKE 'FAIL ADMIN:%' THEN RAISE; END IF;
  END;

  -- REV-11 / REV-12: ledger rows remain immutable.
  BEGIN
    UPDATE rebuild_v2.wallet_ledger SET reason='tampered' WHERE id=v_original;
    RAISE EXCEPTION 'FAIL REV-11: ledger UPDATE unexpectedly succeeded';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM LIKE 'FAIL REV-11:%' THEN RAISE; END IF;
  END;

  BEGIN
    DELETE FROM rebuild_v2.wallet_ledger WHERE id=v_original;
    RAISE EXCEPTION 'FAIL REV-12: ledger DELETE unexpectedly succeeded';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM LIKE 'FAIL REV-12:%' THEN RAISE; END IF;
  END;

  SELECT count(*) INTO v_count
    FROM rebuild_v2.wallet_ledger
   WHERE reversal_of=v_original;
  IF v_count <> 1 THEN
    RAISE EXCEPTION 'FAIL: expected exactly one reversal, found %',v_count;
  END IF;

  SELECT earned_points INTO v_balance
    FROM rebuild_v2.wallets
   WHERE user_id='93500000-0000-4000-8000-000000000003';
  IF v_balance <> 0 THEN
    RAISE EXCEPTION 'FAIL: expected zero balance after exact reversal, got %',v_balance;
  END IF;

  SELECT count(*) INTO v_count
    FROM rebuild_v2.audit_events
   WHERE action='wallet.entry.reversed'
     AND target_id='93500000-0000-4000-8000-000000000003'
     AND request_id='reversal-valid-0001';
  IF v_count <> 1 THEN
    RAISE EXCEPTION 'FAIL: expected exactly one reversal audit event, found %',v_count;
  END IF;
END;
$test$;

-- Owner-level mutation probes exercise the table trigger independently of
-- post_wallet_entry. They must fail before any invalid reversal row is stored.
RESET ROLE;

DO $mutation$
DECLARE
  v_original uuid;
  v_reversal uuid;
BEGIN
  SELECT id INTO v_original
    FROM rebuild_v2.wallet_ledger
   WHERE idempotency_key='reversal-original-0001';
  SELECT id INTO v_reversal
    FROM rebuild_v2.wallet_ledger
   WHERE idempotency_key='reversal-valid-0001';

  BEGIN
    INSERT INTO rebuild_v2.wallet_ledger(
      user_id,wallet_type,amount,entry_type,reversal_of,idempotency_key,reason
    ) VALUES (
      '93500000-0000-4000-8000-000000000004',
      'earned_points',-200,'reversal',v_original,
      'mutation-wrong-user-001','Mutation wrong user direct insert'
    );
    RAISE EXCEPTION 'FAIL MUTATION: trigger accepted a reversal for another user';
  EXCEPTION WHEN SQLSTATE '23514' THEN NULL;
  END;

  BEGIN
    INSERT INTO rebuild_v2.wallet_ledger(
      user_id,wallet_type,amount,entry_type,reversal_of,idempotency_key,reason
    ) VALUES (
      '93500000-0000-4000-8000-000000000003',
      'purchased_credits',-200,'reversal',v_original,
      'mutation-wrong-wallet-001','Mutation wrong wallet direct insert'
    );
    RAISE EXCEPTION 'FAIL MUTATION: trigger accepted a wallet-type mismatch';
  EXCEPTION WHEN SQLSTATE '23514' THEN NULL;
  END;

  BEGIN
    INSERT INTO rebuild_v2.wallet_ledger(
      user_id,wallet_type,amount,entry_type,reversal_of,idempotency_key,reason
    ) VALUES (
      '93500000-0000-4000-8000-000000000003',
      'earned_points',-199,'reversal',v_original,
      'mutation-wrong-amount-001','Mutation wrong amount direct insert'
    );
    RAISE EXCEPTION 'FAIL MUTATION: trigger accepted an inexact amount';
  EXCEPTION WHEN SQLSTATE '23514' THEN NULL;
  END;

  BEGIN
    INSERT INTO rebuild_v2.wallet_ledger(
      user_id,wallet_type,amount,entry_type,reversal_of,idempotency_key,reason
    ) VALUES (
      '93500000-0000-4000-8000-000000000003',
      'earned_points',200,'reversal',v_reversal,
      'mutation-reversal-chain-001','Mutation reversal chain direct insert'
    );
    RAISE EXCEPTION 'FAIL MUTATION: trigger accepted reversal of reversal';
  EXCEPTION WHEN SQLSTATE '23514' THEN NULL;
  END;

  -- The unique partial index is an independent final guard against a second
  -- valid-shaped reversal inserted outside the posting function.
  BEGIN
    INSERT INTO rebuild_v2.wallet_ledger(
      user_id,wallet_type,amount,entry_type,reversal_of,idempotency_key,reason
    ) VALUES (
      '93500000-0000-4000-8000-000000000003',
      'earned_points',-200,'reversal',v_original,
      'mutation-duplicate-reversal-001','Mutation duplicate reversal direct insert'
    );
    RAISE EXCEPTION 'FAIL MUTATION: partial unique index accepted a duplicate reversal';
  EXCEPTION WHEN SQLSTATE '23505' THEN NULL;
  END;
END;
$mutation$;

-- REV-10: an audit failure must roll back the ledger row and wallet balance.
CREATE FUNCTION pg_temp.reject_wallet_reversal_audit()
RETURNS trigger
LANGUAGE plpgsql
AS $function$
BEGIN
  IF NEW.action = 'wallet.entry.reversed' THEN
    RAISE EXCEPTION 'injected audit failure';
  END IF;
  RETURN NEW;
END;
$function$;

CREATE TRIGGER test_reject_wallet_reversal_audit
BEFORE INSERT ON rebuild_v2.audit_events
FOR EACH ROW EXECUTE FUNCTION pg_temp.reject_wallet_reversal_audit();

DO $atomicity$
DECLARE
  v_original uuid;
  v_before bigint;
  v_after bigint;
  v_count integer;
BEGIN
  PERFORM set_config('request.jwt.claim.sub','93500000-0000-4000-8000-000000000001',true);
  PERFORM set_config('request.jwt.claims','{"sub":"93500000-0000-4000-8000-000000000001","role":"authenticated"}',true);

  v_original := rebuild_v2_private.post_wallet_entry(
    '93500000-0000-4000-8000-000000000003',
    'earned_points',75,'reward','reversal-atomic-original',
    'Original movement for atomicity test'
  );
  SELECT earned_points INTO v_before FROM rebuild_v2.wallets
   WHERE user_id='93500000-0000-4000-8000-000000000003';

  BEGIN
    PERFORM rebuild_v2_private.post_wallet_entry(
      '93500000-0000-4000-8000-000000000003',
      'earned_points',-75,'reversal','reversal-atomic-fail',
      'Reversal whose audit insert fails',NULL,NULL,v_original
    );
    RAISE EXCEPTION 'FAIL REV-10: reversal succeeded despite audit failure';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM LIKE 'FAIL REV-10:%' THEN RAISE; END IF;
    IF SQLERRM <> 'injected audit failure' THEN RAISE; END IF;
  END;

  SELECT earned_points INTO v_after FROM rebuild_v2.wallets
   WHERE user_id='93500000-0000-4000-8000-000000000003';
  SELECT count(*) INTO v_count FROM rebuild_v2.wallet_ledger
   WHERE reversal_of=v_original OR idempotency_key='reversal-atomic-fail';

  IF v_after IS DISTINCT FROM v_before OR v_count <> 0 THEN
    RAISE EXCEPTION 'FAIL REV-10: audit failure left partial financial state';
  END IF;
END;
$atomicity$;

DROP TRIGGER test_reject_wallet_reversal_audit ON rebuild_v2.audit_events;

ROLLBACK;

SELECT 'rebuild_v2_wallet_reversal_integrity_contract: PASS' AS result;
