-- Reports and disputes remain intake/read-only records until a dedicated,
-- reason-required review workflow and (where relevant) provider-backed refund
-- processing are implemented. Disposable local DB only.
BEGIN;

INSERT INTO auth.users
  (id,aud,role,email,encrypted_password,email_confirmed_at,raw_app_meta_data,raw_user_meta_data,created_at,updated_at)
VALUES
  ('92200000-0000-4000-8000-000000000001','authenticated','authenticated','v2-case-admin@example.invalid','',now(),'{ "provider":"email","providers":["email"] }'::jsonb,'{"name":"Case Admin"}'::jsonb,now(),now()),
  ('92200000-0000-4000-8000-000000000002','authenticated','authenticated','v2-case-support@example.invalid','',now(),'{ "provider":"email","providers":["email"] }'::jsonb,'{"name":"Case Support"}'::jsonb,now(),now()),
  ('92200000-0000-4000-8000-000000000003','authenticated','authenticated','v2-case-financial@example.invalid','',now(),'{ "provider":"email","providers":["email"] }'::jsonb,'{"name":"Case Financial"}'::jsonb,now(),now()),
  ('92200000-0000-4000-8000-000000000004','authenticated','authenticated','v2-case-reporter@example.invalid','',now(),'{ "provider":"email","providers":["email"] }'::jsonb,'{"name":"Case Reporter"}'::jsonb,now(),now()),
  ('92200000-0000-4000-8000-000000000005','authenticated','authenticated','v2-case-outsider@example.invalid','',now(),'{ "provider":"email","providers":["email"] }'::jsonb,'{"name":"Case Outsider"}'::jsonb,now(),now());

INSERT INTO rebuild_v2.user_roles(user_id,role)
VALUES
  ('92200000-0000-4000-8000-000000000001','admin'),
  ('92200000-0000-4000-8000-000000000002','support'),
  ('92200000-0000-4000-8000-000000000003','financial');

INSERT INTO rebuild_v2.reports
  (id,reporter_id,reported_user_id,report_type,description,status)
VALUES
  ('92200000-0000-4000-8000-000000000101',
   '92200000-0000-4000-8000-000000000004',
   '92200000-0000-4000-8000-000000000005',
   'other',
   'Synthetic report fixture for validating scoped case visibility and write boundaries.',
   'open');

INSERT INTO rebuild_v2.disputes
  (id,opened_by,report_id,status)
VALUES
  ('92200000-0000-4000-8000-000000000201',
   '92200000-0000-4000-8000-000000000004',
   '92200000-0000-4000-8000-000000000101',
   'opened');

SET LOCAL ROLE authenticated;
DO $case_visibility_and_write_boundary$
DECLARE v_count integer;
BEGIN
  IF has_table_privilege('authenticated','rebuild_v2.reports','INSERT')
     OR has_table_privilege('authenticated','rebuild_v2.reports','UPDATE')
     OR has_table_privilege('authenticated','rebuild_v2.reports','DELETE')
     OR has_table_privilege('authenticated','rebuild_v2.disputes','INSERT')
     OR has_table_privilege('authenticated','rebuild_v2.disputes','UPDATE')
     OR has_table_privilege('authenticated','rebuild_v2.disputes','DELETE')
     OR has_table_privilege('authenticated','rebuild_v2.report_attachments','INSERT')
     OR has_table_privilege('authenticated','rebuild_v2.report_attachments','UPDATE')
     OR has_table_privilege('authenticated','rebuild_v2.report_attachments','DELETE')
     OR has_table_privilege('anon','rebuild_v2.reports','INSERT')
     OR has_table_privilege('anon','rebuild_v2.disputes','INSERT') THEN
    RAISE EXCEPTION 'FAIL: direct client case/attachment writes are granted';
  END IF;

  -- Reporter sees own report and dispute.
  PERFORM set_config('request.jwt.claim.sub','92200000-0000-4000-8000-000000000004',true);
  PERFORM set_config('request.jwt.claims','{"sub":"92200000-0000-4000-8000-000000000004","role":"authenticated"}',true);
  SELECT count(*) INTO v_count FROM rebuild_v2.reports WHERE id='92200000-0000-4000-8000-000000000101';
  IF v_count <> 1 THEN RAISE EXCEPTION 'FAIL: reporter cannot read own report'; END IF;
  SELECT count(*) INTO v_count FROM rebuild_v2.disputes WHERE id='92200000-0000-4000-8000-000000000201';
  IF v_count <> 1 THEN RAISE EXCEPTION 'FAIL: dispute opener cannot read own dispute'; END IF;

  -- Unrelated user sees neither report nor dispute.
  PERFORM set_config('request.jwt.claim.sub','92200000-0000-4000-8000-000000000005',true);
  PERFORM set_config('request.jwt.claims','{"sub":"92200000-0000-4000-8000-000000000005","role":"authenticated"}',true);
  SELECT count(*) INTO v_count FROM rebuild_v2.reports WHERE id='92200000-0000-4000-8000-000000000101';
  IF v_count <> 0 THEN RAISE EXCEPTION 'FAIL: unrelated user can read report'; END IF;
  SELECT count(*) INTO v_count FROM rebuild_v2.disputes WHERE id='92200000-0000-4000-8000-000000000201';
  IF v_count <> 0 THEN RAISE EXCEPTION 'FAIL: unrelated user can read dispute'; END IF;

  -- Support may triage reports/disputes, but has no direct write grants.
  PERFORM set_config('request.jwt.claim.sub','92200000-0000-4000-8000-000000000002',true);
  PERFORM set_config('request.jwt.claims','{"sub":"92200000-0000-4000-8000-000000000002","role":"authenticated"}',true);
  SELECT count(*) INTO v_count FROM rebuild_v2.reports WHERE id='92200000-0000-4000-8000-000000000101';
  IF v_count <> 1 THEN RAISE EXCEPTION 'FAIL: Support cannot read report queue'; END IF;
  SELECT count(*) INTO v_count FROM rebuild_v2.disputes WHERE id='92200000-0000-4000-8000-000000000201';
  IF v_count <> 1 THEN RAISE EXCEPTION 'FAIL: Support cannot read dispute queue'; END IF;

  -- Financial may inspect disputes, but report contents remain outside its role.
  PERFORM set_config('request.jwt.claim.sub','92200000-0000-4000-8000-000000000003',true);
  PERFORM set_config('request.jwt.claims','{"sub":"92200000-0000-4000-8000-000000000003","role":"authenticated"}',true);
  SELECT count(*) INTO v_count FROM rebuild_v2.reports WHERE id='92200000-0000-4000-8000-000000000101';
  IF v_count <> 0 THEN RAISE EXCEPTION 'FAIL: Financial can read report content'; END IF;
  SELECT count(*) INTO v_count FROM rebuild_v2.disputes WHERE id='92200000-0000-4000-8000-000000000201';
  IF v_count <> 1 THEN RAISE EXCEPTION 'FAIL: Financial cannot read dispute queue'; END IF;

  -- Admin retains oversight.
  PERFORM set_config('request.jwt.claim.sub','92200000-0000-4000-8000-000000000001',true);
  PERFORM set_config('request.jwt.claims','{"sub":"92200000-0000-4000-8000-000000000001","role":"authenticated"}',true);
  SELECT count(*) INTO v_count FROM rebuild_v2.reports WHERE id='92200000-0000-4000-8000-000000000101';
  IF v_count <> 1 THEN RAISE EXCEPTION 'FAIL: Admin cannot read report'; END IF;
  SELECT count(*) INTO v_count FROM rebuild_v2.disputes WHERE id='92200000-0000-4000-8000-000000000201';
  IF v_count <> 1 THEN RAISE EXCEPTION 'FAIL: Admin cannot read dispute'; END IF;
END;
$case_visibility_and_write_boundary$;
RESET ROLE;

ROLLBACK;
SELECT 'rebuild_v2_reports_disputes_fail_closed_contract: PASS' AS result;
