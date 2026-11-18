-- Audit event append-only and visibility contract. Disposable local database only.
BEGIN;

INSERT INTO auth.users
  (id,aud,role,email,encrypted_password,email_confirmed_at,raw_app_meta_data,raw_user_meta_data,created_at,updated_at)
VALUES
  ('91800000-0000-4000-8000-000000000001','authenticated','authenticated','v2-audit-admin@example.invalid','',now(),'{"provider":"email","providers":["email"]}'::jsonb,'{"name":"Audit Admin"}'::jsonb,now(),now()),
  ('91800000-0000-4000-8000-000000000002','authenticated','authenticated','v2-audit-support@example.invalid','',now(),'{"provider":"email","providers":["email"]}'::jsonb,'{"name":"Audit Support"}'::jsonb,now(),now());

INSERT INTO rebuild_v2.user_roles(user_id,role)
VALUES
  ('91800000-0000-4000-8000-000000000001','admin'),
  ('91800000-0000-4000-8000-000000000002','support');

INSERT INTO rebuild_v2.audit_events(id,actor_id,action,target_type,target_id,reason,metadata)
VALUES ('91800000-0000-4000-8000-000000000101','91800000-0000-4000-8000-000000000001',
  'audit.append_only.contract','contract',NULL,'Verify append-only audit protection in disposable CI.',
  '{"contract":"018"}'::jsonb);

SET LOCAL ROLE authenticated;
DO $visibility$
DECLARE v_count integer;
BEGIN
  PERFORM set_config('request.jwt.claim.sub','91800000-0000-4000-8000-000000000001',true);
  PERFORM set_config('request.jwt.claims','{"sub":"91800000-0000-4000-8000-000000000001","role":"authenticated"}',true);
  SELECT count(*) INTO v_count FROM rebuild_v2.audit_events WHERE id='91800000-0000-4000-8000-000000000101';
  IF v_count <> 1 THEN RAISE EXCEPTION 'FAIL: Admin cannot read audit event'; END IF;

  PERFORM set_config('request.jwt.claim.sub','91800000-0000-4000-8000-000000000002',true);
  PERFORM set_config('request.jwt.claims','{"sub":"91800000-0000-4000-8000-000000000002","role":"authenticated"}',true);
  SELECT count(*) INTO v_count FROM rebuild_v2.audit_events WHERE id='91800000-0000-4000-8000-000000000101';
  IF v_count <> 0 THEN RAISE EXCEPTION 'FAIL: Support can read Admin audit events'; END IF;

  IF has_table_privilege('authenticated','rebuild_v2.audit_events','INSERT')
     OR has_table_privilege('authenticated','rebuild_v2.audit_events','UPDATE')
     OR has_table_privilege('authenticated','rebuild_v2.audit_events','DELETE') THEN
    RAISE EXCEPTION 'FAIL: authenticated clients have direct audit event write privileges';
  END IF;
END;
$visibility$;
RESET ROLE;

-- Exercise the immutable trigger as the local migration owner so RLS/GRANT
-- denial cannot mask a missing trigger.
DO $immutability$
BEGIN
  BEGIN
    UPDATE rebuild_v2.audit_events SET reason='tampered' WHERE id='91800000-0000-4000-8000-000000000101';
    RAISE EXCEPTION 'FAIL: audit event UPDATE unexpectedly succeeded';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM NOT LIKE 'immutable_record:%' THEN RAISE; END IF;
  END;

  BEGIN
    DELETE FROM rebuild_v2.audit_events WHERE id='91800000-0000-4000-8000-000000000101';
    RAISE EXCEPTION 'FAIL: audit event DELETE unexpectedly succeeded';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM NOT LIKE 'immutable_record:%' THEN RAISE; END IF;
  END;

  IF NOT EXISTS (SELECT 1 FROM rebuild_v2.audit_events WHERE id='91800000-0000-4000-8000-000000000101') THEN
    RAISE EXCEPTION 'FAIL: audit event disappeared after rejected mutation';
  END IF;
END;
$immutability$;

ROLLBACK;
SELECT 'rebuild_v2_audit_event_append_only_contract: PASS' AS result;
