-- Role-separated notification feed and read-state contract.
-- Run after candidate scripts 001..019. All fixtures are rolled back.

BEGIN;

-- Notification/event rows are server-owned: clients may read their permitted
-- notification feed and use scoped read-state RPCs, but cannot write either
-- table directly. The events outbox is reserved for trusted producers/workers.
DO $privileges$
BEGIN
  IF has_table_privilege('authenticated','rebuild_v2.events','INSERT')
     OR has_table_privilege('authenticated','rebuild_v2.events','UPDATE')
     OR has_table_privilege('authenticated','rebuild_v2.events','DELETE') THEN
    RAISE EXCEPTION 'authenticated role must not write the events outbox directly';
  END IF;
  IF has_table_privilege('anon','rebuild_v2.events','INSERT')
     OR has_table_privilege('anon','rebuild_v2.events','UPDATE')
     OR has_table_privilege('anon','rebuild_v2.events','DELETE') THEN
    RAISE EXCEPTION 'anon role must not write the events outbox';
  END IF;
  IF has_table_privilege('authenticated','rebuild_v2.notifications','INSERT')
     OR has_table_privilege('authenticated','rebuild_v2.notifications','UPDATE')
     OR has_table_privilege('authenticated','rebuild_v2.notifications','DELETE') THEN
    RAISE EXCEPTION 'authenticated role must not write notification rows directly';
  END IF;
  IF has_table_privilege('anon','rebuild_v2.notifications','INSERT')
     OR has_table_privilege('anon','rebuild_v2.notifications','UPDATE')
     OR has_table_privilege('anon','rebuild_v2.notifications','DELETE') THEN
    RAISE EXCEPTION 'anon role must not write notification rows';
  END IF;
END;
$privileges$;

INSERT INTO auth.users
  (id,aud,role,email,encrypted_password,email_confirmed_at,
   raw_app_meta_data,raw_user_meta_data,created_at,updated_at)
VALUES
  ('91000000-0000-4000-8000-000000000001','authenticated','authenticated','v2-notify-multi@example.invalid','',now(),'{"provider":"email","providers":["email"]}'::jsonb,'{"name":"Multi Role"}'::jsonb,now(),now()),
  ('91000000-0000-4000-8000-000000000002','authenticated','authenticated','v2-notify-admin@example.invalid','',now(),'{"provider":"email","providers":["email"]}'::jsonb,'{"name":"Admin Role"}'::jsonb,now(),now()),
  ('91000000-0000-4000-8000-000000000003','authenticated','authenticated','v2-notify-tester@example.invalid','',now(),'{"provider":"email","providers":["email"]}'::jsonb,'{"name":"Tester Only"}'::jsonb,now(),now());

INSERT INTO rebuild_v2.user_roles(user_id,role)
VALUES
  ('91000000-0000-4000-8000-000000000001','developer'),
  ('91000000-0000-4000-8000-000000000002','admin')
ON CONFLICT(user_id,role) DO NOTHING;

INSERT INTO rebuild_v2.notifications(id,user_id,recipient_role,type,title,body)
VALUES
  ('92000000-0000-4000-8000-000000000001','91000000-0000-4000-8000-000000000001','tester','test.update','Tester feed','Tester notification'),
  ('92000000-0000-4000-8000-000000000002','91000000-0000-4000-8000-000000000001','developer','app.review','Developer feed','Developer notification'),
  ('92000000-0000-4000-8000-000000000003','91000000-0000-4000-8000-000000000002','developer','app.review','Admin developer feed','Developer notification for admin'),
  ('92000000-0000-4000-8000-000000000004','91000000-0000-4000-8000-000000000003','tester','test.update','Tester only feed','Tester notification'),
  ('92000000-0000-4000-8000-000000000005','91000000-0000-4000-8000-000000000003','developer','app.review','Forbidden developer feed','Developer notification');

SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub','91000000-0000-4000-8000-000000000001',true);
SELECT set_config('request.jwt.claims','{"sub":"91000000-0000-4000-8000-000000000001","role":"authenticated"}',true);

DO $test$
DECLARE
  v_visible integer;
  v_read_at timestamptz;
  v_marked integer;
BEGIN
  SELECT count(*) INTO v_visible
  FROM rebuild_v2.notifications
  WHERE user_id='91000000-0000-4000-8000-000000000001';
  IF v_visible <> 2 THEN
    RAISE EXCEPTION 'multi-role user should see only their two role-owned notifications; got %',v_visible;
  END IF;

  PERFORM rebuild_v2.mark_notification_read(
    '92000000-0000-4000-8000-000000000001','tester'
  );
  SELECT read_at INTO v_read_at FROM rebuild_v2.notifications
  WHERE id='92000000-0000-4000-8000-000000000001';
  IF v_read_at IS NULL THEN
    RAISE EXCEPTION 'tester feed read did not update tester notification';
  END IF;
  SELECT read_at INTO v_read_at FROM rebuild_v2.notifications
  WHERE id='92000000-0000-4000-8000-000000000002';
  IF v_read_at IS NOT NULL THEN
    RAISE EXCEPTION 'marking tester notification read changed developer notification';
  END IF;

  v_marked := rebuild_v2.mark_all_notifications_read('tester');
  IF v_marked <> 0 THEN
    RAISE EXCEPTION 'mark-all tester should not touch already-read or developer rows; got %',v_marked;
  END IF;

  PERFORM rebuild_v2.mark_notification_read(
    '92000000-0000-4000-8000-000000000002','developer'
  );
  SELECT read_at INTO v_read_at FROM rebuild_v2.notifications
  WHERE id='92000000-0000-4000-8000-000000000002';
  IF v_read_at IS NULL THEN
    RAISE EXCEPTION 'developer feed read did not update developer notification for multi-role user';
  END IF;

  PERFORM set_config('request.jwt.claim.sub','91000000-0000-4000-8000-000000000003',true);
  PERFORM set_config('request.jwt.claims','{"sub":"91000000-0000-4000-8000-000000000003","role":"authenticated"}',true);

  SELECT count(*) INTO v_visible
  FROM rebuild_v2.notifications
  WHERE user_id='91000000-0000-4000-8000-000000000003';
  IF v_visible <> 1 THEN
    RAISE EXCEPTION 'tester-only user must not see developer notification; got % rows',v_visible;
  END IF;

  BEGIN
    PERFORM rebuild_v2.mark_notification_read(
      '92000000-0000-4000-8000-000000000005','developer'
    );
    RAISE EXCEPTION 'tester-only user unexpectedly marked developer notification read';
  EXCEPTION WHEN SQLSTATE '42501' THEN
    NULL;
  END;

  PERFORM rebuild_v2.mark_all_notifications_read('tester');
  SELECT read_at INTO v_read_at FROM rebuild_v2.notifications
  WHERE id='92000000-0000-4000-8000-000000000004';
  IF v_read_at IS NULL THEN
    RAISE EXCEPTION 'tester-only user failed to mark tester feed read';
  END IF;
  SELECT read_at INTO v_read_at FROM rebuild_v2.notifications
  WHERE id='92000000-0000-4000-8000-000000000005';
  IF v_read_at IS NOT NULL THEN
    RAISE EXCEPTION 'tester-only mark-all changed developer feed';
  END IF;

  PERFORM set_config('request.jwt.claim.sub','91000000-0000-4000-8000-000000000002',true);
  PERFORM set_config('request.jwt.claims','{"sub":"91000000-0000-4000-8000-000000000002","role":"authenticated"}',true);

  SELECT count(*) INTO v_visible
  FROM rebuild_v2.notifications
  WHERE user_id='91000000-0000-4000-8000-000000000002';
  IF v_visible <> 1 THEN
    RAISE EXCEPTION 'admin should see developer feed even without developer role; got % rows',v_visible;
  END IF;

  PERFORM rebuild_v2.mark_notification_read(
    '92000000-0000-4000-8000-000000000003','developer'
  );
END;
$test$;

ROLLBACK;

SELECT 'rebuild_v2_notification_recipient_roles_contract: PASS' AS result;
