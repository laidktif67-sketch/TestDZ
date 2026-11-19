-- Developer test editing authorization, validation and audit contract.
-- Run ONLY against the isolated TestDZ-FixLab database after candidate SQL 001..032.
-- Synthetic auth, role, app and test records are rolled back.
BEGIN;

INSERT INTO auth.users
 (id,aud,role,email,encrypted_password,email_confirmed_at,raw_app_meta_data,raw_user_meta_data,created_at,updated_at)
VALUES
 ('59000000-0000-4000-8000-000000000001','authenticated','authenticated','v2-test-edit-owner@example.invalid','',now(),'{"provider":"email","providers":["email"]}'::jsonb,'{"name":"Edit Owner"}'::jsonb,now(),now()),
 ('59000000-0000-4000-8000-000000000002','authenticated','authenticated','v2-test-edit-admin@example.invalid','',now(),'{"provider":"email","providers":["email"]}'::jsonb,'{"name":"Edit Admin"}'::jsonb,now(),now()),
 ('59000000-0000-4000-8000-000000000003','authenticated','authenticated','v2-test-edit-other@example.invalid','',now(),'{"provider":"email","providers":["email"]}'::jsonb,'{"name":"Other Developer"}'::jsonb,now(),now());

INSERT INTO rebuild_v2.user_roles(user_id,role)
VALUES
 ('59000000-0000-4000-8000-000000000001','developer'),
 ('59000000-0000-4000-8000-000000000002','admin'),
 ('59000000-0000-4000-8000-000000000003','developer')
ON CONFLICT(user_id,role) DO NOTHING;

SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub','59000000-0000-4000-8000-000000000001',true);
SELECT set_config('request.jwt.claims','{"sub":"59000000-0000-4000-8000-000000000001","role":"authenticated"}',true);

DO $test$
DECLARE
  v_app uuid;
  v_test uuid;
  v_audit_before integer;
  v_audit_after integer;
BEGIN
  v_app:=rebuild_v2.create_app(
    'Edit Contract App',
    'dz.testdz.editcontract',
    'A synthetic application for the isolated developer test edit contract.',
    'tools'
  );
  PERFORM rebuild_v2.submit_app_for_review(v_app);

  PERFORM set_config('request.jwt.claim.sub','59000000-0000-4000-8000-000000000002',true);
  PERFORM set_config('request.jwt.claims','{"sub":"59000000-0000-4000-8000-000000000002","role":"authenticated"}',true);
  PERFORM rebuild_v2.review_app(v_app,'approved','Synthetic app approved for the edit contract.');

  PERFORM set_config('request.jwt.claim.sub','59000000-0000-4000-8000-000000000001',true);
  PERFORM set_config('request.jwt.claims','{"sub":"59000000-0000-4000-8000-000000000001","role":"authenticated"}',true);
  v_test:=rebuild_v2.create_test(
    v_app,
    'Original edit contract title',
    'A sufficiently long synthetic test description for validating the edit lifecycle.',
    'Original summary',
    'usability',
    5,
    NULL,
    NULL,
    30,
    'Original tester instructions.'
  );

  SELECT count(*) INTO v_audit_before
  FROM rebuild_v2.audit_events
  WHERE target_id=v_test AND action='test.updated';

  -- Owner can edit the draft and all exposed base fields are persisted.
  PERFORM rebuild_v2.update_test(
    v_test,
    'Updated edit contract title',
    'Updated description remains long enough to satisfy the validation contract.',
    'Updated summary',
    'compatibility',
    7,
    DATE '2026-12-01',
    DATE '2026-12-15',
    45,
    'Updated tester instructions.'
  );

  IF NOT EXISTS(
    SELECT 1 FROM rebuild_v2.tests
    WHERE id=v_test
      AND developer_id='59000000-0000-4000-8000-000000000001'
      AND title='Updated edit contract title'
      AND description='Updated description remains long enough to satisfy the validation contract.'
      AND short_summary='Updated summary'
      AND test_type='compatibility'
      AND min_testers=7
      AND start_date=DATE '2026-12-01'
      AND end_date=DATE '2026-12-15'
      AND estimated_duration_minutes=45
      AND tester_instructions='Updated tester instructions.'
  ) THEN
    RAISE EXCEPTION 'FAIL: owner update did not persist every editable base field';
  END IF;

  SELECT count(*) INTO v_audit_after
  FROM rebuild_v2.audit_events
  WHERE target_id=v_test AND action='test.updated';
  IF v_audit_after<>v_audit_before+1 THEN
    RAISE EXCEPTION 'FAIL: successful edit must append exactly one test.updated event';
  END IF;

  -- Admin role alone does not override the function's developer_id = auth.uid() predicate.
  PERFORM set_config('request.jwt.claim.sub','59000000-0000-4000-8000-000000000002',true);
  PERFORM set_config('request.jwt.claims','{"sub":"59000000-0000-4000-8000-000000000002","role":"authenticated"}',true);
  BEGIN
    PERFORM rebuild_v2.update_test(
      v_test,'Admin cross-owner edit',
      'This attempted admin edit must not change another developer test.',
      NULL,'usability',5,NULL,NULL,30,NULL
    );
    RAISE EXCEPTION 'FAIL: Admin edited a test owned by another developer';
  EXCEPTION WHEN SQLSTATE 'P0002' THEN NULL;
  END;

  -- A different Developer is also denied.
  PERFORM set_config('request.jwt.claim.sub','59000000-0000-4000-8000-000000000003',true);
  PERFORM set_config('request.jwt.claims','{"sub":"59000000-0000-4000-8000-000000000003","role":"authenticated"}',true);
  BEGIN
    PERFORM rebuild_v2.update_test(
      v_test,'Non-owner edit',
      'This attempted non-owner edit must not change the original developer test.',
      NULL,'usability',5,NULL,NULL,30,NULL
    );
    RAISE EXCEPTION 'FAIL: another Developer edited the test';
  EXCEPTION WHEN SQLSTATE 'P0002' THEN NULL;
  END;


  -- Invalid input is rejected and cannot mutate the previously saved title or audit count.
  PERFORM set_config('request.jwt.claim.sub','59000000-0000-4000-8000-000000000001',true);
  PERFORM set_config('request.jwt.claims','{"sub":"59000000-0000-4000-8000-000000000001","role":"authenticated"}',true);
  BEGIN
    PERFORM rebuild_v2.update_test(
      v_test,'x',
      'This description is otherwise long enough but the title is invalid.',
      NULL,'usability',5,NULL,NULL,30,NULL
    );
    RAISE EXCEPTION 'FAIL: invalid short title was accepted';
  EXCEPTION WHEN SQLSTATE '22023' THEN NULL;
  END;

  IF NOT EXISTS(SELECT 1 FROM rebuild_v2.tests WHERE id=v_test AND title='Updated edit contract title') THEN
    RAISE EXCEPTION 'FAIL: invalid edit changed the persisted title';
  END IF;
  SELECT count(*) INTO v_audit_after
  FROM rebuild_v2.audit_events
  WHERE target_id=v_test AND action='test.updated';
  IF v_audit_after<>v_audit_before+1 THEN
    RAISE EXCEPTION 'FAIL: invalid or unauthorized edit appended an audit event';
  END IF;

  -- Once submitted, the test is no longer editable through update_test.
  PERFORM rebuild_v2.submit_test_for_review(v_test);
  BEGIN
    PERFORM rebuild_v2.update_test(
      v_test,'Submitted test edit',
      'A submitted test must not accept developer edits through update_test.',
      NULL,'usability',5,NULL,NULL,30,NULL
    );
    RAISE EXCEPTION 'FAIL: submitted test remained editable';
  EXCEPTION WHEN SQLSTATE 'P0002' THEN NULL;
  END;

  SELECT count(*) INTO v_audit_after
  FROM rebuild_v2.audit_events
  WHERE target_id=v_test AND action='test.updated';
  IF v_audit_after<>v_audit_before+1 THEN
    RAISE EXCEPTION 'FAIL: rejected submitted-test edit appended an audit event';
  END IF;
END;
$test$;

ROLLBACK;
