-- Refund records are visibility-only until a provider-backed, audited
-- financial execution workflow is approved. Disposable local DB only.
BEGIN;

INSERT INTO auth.users
  (id,aud,role,email,encrypted_password,email_confirmed_at,raw_app_meta_data,raw_user_meta_data,created_at,updated_at)
VALUES
  ('92300000-0000-4000-8000-000000000001','authenticated','authenticated','v2-refund-admin@example.invalid','',now(),'{ "provider":"email","providers":["email"] }'::jsonb,'{"name":"Refund Admin"}'::jsonb,now(),now()),
  ('92300000-0000-4000-8000-000000000002','authenticated','authenticated','v2-refund-financial@example.invalid','',now(),'{ "provider":"email","providers":["email"] }'::jsonb,'{"name":"Refund Financial"}'::jsonb,now(),now()),
  ('92300000-0000-4000-8000-000000000003','authenticated','authenticated','v2-refund-support@example.invalid','',now(),'{ "provider":"email","providers":["email"] }'::jsonb,'{"name":"Refund Support"}'::jsonb,now(),now()),
  ('92300000-0000-4000-8000-000000000004','authenticated','authenticated','v2-refund-owner@example.invalid','',now(),'{ "provider":"email","providers":["email"] }'::jsonb,'{"name":"Refund Owner"}'::jsonb,now(),now()),
  ('92300000-0000-4000-8000-000000000005','authenticated','authenticated','v2-refund-outsider@example.invalid','',now(),'{ "provider":"email","providers":["email"] }'::jsonb,'{"name":"Refund Outsider"}'::jsonb,now(),now());

INSERT INTO rebuild_v2.user_roles(user_id,role)
VALUES
  ('92300000-0000-4000-8000-000000000001','admin'),
  ('92300000-0000-4000-8000-000000000002','financial'),
  ('92300000-0000-4000-8000-000000000003','support');

INSERT INTO rebuild_v2.payments
  (id,user_id,amount_dzd,currency,status,idempotency_key)
VALUES
  ('92300000-0000-4000-8000-000000000101',
   '92300000-0000-4000-8000-000000000004',2500,'DZD','succeeded','contract-refund-923000000000000001');

INSERT INTO rebuild_v2.refunds
  (id,payment_id,user_id,amount_dzd,reason,status,refund_method)
VALUES
  ('92300000-0000-4000-8000-000000000201',
   '92300000-0000-4000-8000-000000000101',
   '92300000-0000-4000-8000-000000000004',
   1000,'Synthetic refund visibility fixture for the financial role boundary.',
   'requested','bank_return');

SET LOCAL ROLE authenticated;
DO $refund_visibility_and_write_boundary$
DECLARE v_count integer;
BEGIN
  IF has_table_privilege('authenticated','rebuild_v2.refunds','INSERT')
     OR has_table_privilege('authenticated','rebuild_v2.refunds','UPDATE')
     OR has_table_privilege('authenticated','rebuild_v2.refunds','DELETE')
     OR has_table_privilege('anon','rebuild_v2.refunds','INSERT') THEN
    RAISE EXCEPTION 'FAIL: direct client refund writes are granted';
  END IF;

  PERFORM set_config('request.jwt.claim.sub','92300000-0000-4000-8000-000000000004',true);
  PERFORM set_config('request.jwt.claims','{"sub":"92300000-0000-4000-8000-000000000004","role":"authenticated"}',true);
  SELECT count(*) INTO v_count FROM rebuild_v2.refunds WHERE id='92300000-0000-4000-8000-000000000201';
  IF v_count <> 1 THEN RAISE EXCEPTION 'FAIL: refund owner cannot read own refund'; END IF;

  PERFORM set_config('request.jwt.claim.sub','92300000-0000-4000-8000-000000000005',true);
  PERFORM set_config('request.jwt.claims','{"sub":"92300000-0000-4000-8000-000000000005","role":"authenticated"}',true);
  SELECT count(*) INTO v_count FROM rebuild_v2.refunds WHERE id='92300000-0000-4000-8000-000000000201';
  IF v_count <> 0 THEN RAISE EXCEPTION 'FAIL: unrelated user can read refund'; END IF;

  PERFORM set_config('request.jwt.claim.sub','92300000-0000-4000-8000-000000000003',true);
  PERFORM set_config('request.jwt.claims','{"sub":"92300000-0000-4000-8000-000000000003","role":"authenticated"}',true);
  SELECT count(*) INTO v_count FROM rebuild_v2.refunds WHERE id='92300000-0000-4000-8000-000000000201';
  IF v_count <> 0 THEN RAISE EXCEPTION 'FAIL: Support can read financial refund records'; END IF;

  PERFORM set_config('request.jwt.claim.sub','92300000-0000-4000-8000-000000000002',true);
  PERFORM set_config('request.jwt.claims','{"sub":"92300000-0000-4000-8000-000000000002","role":"authenticated"}',true);
  SELECT count(*) INTO v_count FROM rebuild_v2.refunds WHERE id='92300000-0000-4000-8000-000000000201';
  IF v_count <> 1 THEN RAISE EXCEPTION 'FAIL: Financial cannot read refund queue'; END IF;

  PERFORM set_config('request.jwt.claim.sub','92300000-0000-4000-8000-000000000001',true);
  PERFORM set_config('request.jwt.claims','{"sub":"92300000-0000-4000-8000-000000000001","role":"authenticated"}',true);
  SELECT count(*) INTO v_count FROM rebuild_v2.refunds WHERE id='92300000-0000-4000-8000-000000000201';
  IF v_count <> 1 THEN RAISE EXCEPTION 'FAIL: Admin cannot read refund queue'; END IF;
END;
$refund_visibility_and_write_boundary$;
RESET ROLE;

ROLLBACK;
SELECT 'rebuild_v2_refunds_fail_closed_contract: PASS' AS result;
