-- Fraud tables intentionally remain fail-closed until trusted signal ingestion and
-- an audited Admin review workflow are implemented. Disposable local DB only.
BEGIN;

INSERT INTO auth.users
  (id,aud,role,email,encrypted_password,email_confirmed_at,raw_app_meta_data,raw_user_meta_data,created_at,updated_at)
VALUES
  ('92100000-0000-4000-8000-000000000001','authenticated','authenticated','v2-fraud-admin@example.invalid','',now(),'{ "provider":"email","providers":["email"] }'::jsonb,'{"name":"Fraud Admin"}'::jsonb,now(),now()),
  ('92100000-0000-4000-8000-000000000002','authenticated','authenticated','v2-fraud-support@example.invalid','',now(),'{ "provider":"email","providers":["email"] }'::jsonb,'{"name":"Fraud Support"}'::jsonb,now(),now()),
  ('92100000-0000-4000-8000-000000000003','authenticated','authenticated','v2-fraud-subject@example.invalid','',now(),'{ "provider":"email","providers":["email"] }'::jsonb,'{"name":"Fraud Subject"}'::jsonb,now(),now());

INSERT INTO rebuild_v2.user_roles(user_id,role)
VALUES
  ('92100000-0000-4000-8000-000000000001','admin'),
  ('92100000-0000-4000-8000-000000000002','support');

INSERT INTO rebuild_v2.fraud_events(id,user_id,signal_code,weight,evidence)
VALUES (
  '92100000-0000-4000-8000-000000000101',
  '92100000-0000-4000-8000-000000000003',
  'contract.synthetic_signal',
  10,
  '{"source":"contract_fixture","contains_personal_data":false}'::jsonb
);

INSERT INTO rebuild_v2.fraud_reviews(id,user_id,score,signals,priority,status,resolution)
VALUES (
  '92100000-0000-4000-8000-000000000102',
  '92100000-0000-4000-8000-000000000003',
  10,
  '[{"code":"contract.synthetic_signal","weight":10}]'::jsonb,
  'normal',
  'queued',
  NULL
);

SET LOCAL ROLE authenticated;
DO $fraud_visibility_and_write_boundary$
DECLARE
  v_count integer;
BEGIN
  IF has_table_privilege('authenticated','rebuild_v2.fraud_events','INSERT')
     OR has_table_privilege('authenticated','rebuild_v2.fraud_events','UPDATE')
     OR has_table_privilege('authenticated','rebuild_v2.fraud_events','DELETE')
     OR has_table_privilege('authenticated','rebuild_v2.fraud_reviews','INSERT')
     OR has_table_privilege('authenticated','rebuild_v2.fraud_reviews','UPDATE')
     OR has_table_privilege('authenticated','rebuild_v2.fraud_reviews','DELETE')
     OR has_table_privilege('anon','rebuild_v2.fraud_events','INSERT')
     OR has_table_privilege('anon','rebuild_v2.fraud_reviews','INSERT') THEN
    RAISE EXCEPTION 'FAIL: direct client writes are granted on fraud tables';
  END IF;

  PERFORM set_config('request.jwt.claim.sub','92100000-0000-4000-8000-000000000002',true);
  PERFORM set_config('request.jwt.claims','{"sub":"92100000-0000-4000-8000-000000000002","role":"authenticated"}',true);
  SELECT count(*) INTO v_count FROM rebuild_v2.fraud_events
  WHERE id='92100000-0000-4000-8000-000000000101';
  IF v_count <> 0 THEN RAISE EXCEPTION 'FAIL: Support can read raw fraud event evidence'; END IF;
  SELECT count(*) INTO v_count FROM rebuild_v2.fraud_reviews
  WHERE id='92100000-0000-4000-8000-000000000102';
  IF v_count <> 1 THEN RAISE EXCEPTION 'FAIL: Support summary visibility changed unexpectedly'; END IF;

  PERFORM set_config('request.jwt.claim.sub','92100000-0000-4000-8000-000000000001',true);
  PERFORM set_config('request.jwt.claims','{"sub":"92100000-0000-4000-8000-000000000001","role":"authenticated"}',true);
  SELECT count(*) INTO v_count FROM rebuild_v2.fraud_events
  WHERE id='92100000-0000-4000-8000-000000000101';
  IF v_count <> 1 THEN RAISE EXCEPTION 'FAIL: Admin cannot read fraud event evidence'; END IF;
  SELECT count(*) INTO v_count FROM rebuild_v2.fraud_reviews
  WHERE id='92100000-0000-4000-8000-000000000102';
  IF v_count <> 1 THEN RAISE EXCEPTION 'FAIL: Admin cannot read fraud review'; END IF;
END;
$fraud_visibility_and_write_boundary$;
RESET ROLE;

-- The raw signal ledger is immutable even for the disposable migration owner.
DO $fraud_event_immutability$
BEGIN
  BEGIN
    UPDATE rebuild_v2.fraud_events SET weight=99
    WHERE id='92100000-0000-4000-8000-000000000101';
    RAISE EXCEPTION 'FAIL: fraud event UPDATE unexpectedly succeeded';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM NOT LIKE 'immutable_record:%' THEN RAISE; END IF;
  END;

  BEGIN
    DELETE FROM rebuild_v2.fraud_events
    WHERE id='92100000-0000-4000-8000-000000000101';
    RAISE EXCEPTION 'FAIL: fraud event DELETE unexpectedly succeeded';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM NOT LIKE 'immutable_record:%' THEN RAISE; END IF;
  END;

  IF NOT EXISTS (
    SELECT 1 FROM rebuild_v2.fraud_events
    WHERE id='92100000-0000-4000-8000-000000000101' AND weight=10
  ) THEN
    RAISE EXCEPTION 'FAIL: fraud event changed after rejected mutation';
  END IF;
END;
$fraud_event_immutability$;

ROLLBACK;
SELECT 'rebuild_v2_fraud_fail_closed_contract: PASS' AS result;
