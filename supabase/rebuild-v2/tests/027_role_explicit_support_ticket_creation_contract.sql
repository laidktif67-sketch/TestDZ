-- Role-explicit support ticket creation contract. Disposable local DB only.
BEGIN;

INSERT INTO auth.users
  (id,aud,role,email,encrypted_password,email_confirmed_at,raw_app_meta_data,raw_user_meta_data,created_at,updated_at)
VALUES
  ('93100000-0000-4000-8000-000000000001','authenticated','authenticated','v2-support-dual-role@example.invalid','',now(),'{"provider":"email","providers":["email"]}'::jsonb,'{"name":"Dual Role"}'::jsonb,now(),now()),
  ('93100000-0000-4000-8000-000000000002','authenticated','authenticated','v2-support-tester-only@example.invalid','',now(),'{"provider":"email","providers":["email"]}'::jsonb,'{"name":"Tester Only"}'::jsonb,now(),now());

INSERT INTO rebuild_v2.user_roles(user_id,role)
VALUES ('93100000-0000-4000-8000-000000000001','developer');

SET LOCAL ROLE authenticated;

DO $developer_create$
DECLARE v_ticket record; v_events integer;
BEGIN
  PERFORM set_config('request.jwt.claim.sub','93100000-0000-4000-8000-000000000001',true);
  PERFORM set_config('request.jwt.claims','{"sub":"93100000-0000-4000-8000-000000000001","role":"authenticated"}',true);

  SELECT * INTO v_ticket
  FROM rebuild_v2.create_support_ticket_for_role(
    'developer','Developer workspace issue','technical','normal',
    'The developer workspace needs help with an application review.'
  );

  IF v_ticket.id IS NULL OR v_ticket.status <> 'open' THEN
    RAISE EXCEPTION 'FAIL: Developer ticket was not created';
  END IF;
  SELECT count(*) INTO v_events FROM rebuild_v2.support_ticket_events
  WHERE ticket_id=v_ticket.id AND actor_id='93100000-0000-4000-8000-000000000001'
    AND event_type='created';
  IF v_events <> 1 THEN RAISE EXCEPTION 'FAIL: Developer ticket created event missing'; END IF;
  IF NOT EXISTS (
    SELECT 1 FROM rebuild_v2.support_tickets
    WHERE id=v_ticket.id AND user_id='93100000-0000-4000-8000-000000000001'
      AND requester_role='developer'
  ) THEN RAISE EXCEPTION 'FAIL: ticket requester role was not preserved'; END IF;
END;
$developer_create$;

DO $role_spoof_denied$
BEGIN
  PERFORM set_config('request.jwt.claim.sub','93100000-0000-4000-8000-000000000002',true);
  PERFORM set_config('request.jwt.claims','{"sub":"93100000-0000-4000-8000-000000000002","role":"authenticated"}',true);
  BEGIN
    PERFORM 1 FROM rebuild_v2.create_support_ticket_for_role(
      'developer','Spoofed workspace request','technical','normal',
      'A tester must not create a ticket under the Developer role.'
    );
    RAISE EXCEPTION 'FAIL: Tester spoofed Developer requester role';
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;
  PERFORM 1 FROM rebuild_v2.create_support_ticket_for_role(
    'tester','Tester workspace issue','testing','normal',
    'The tester workspace needs help with an assigned test.'
  );
END;
$role_spoof_denied$;

RESET ROLE;

DO $privilege_boundary$
BEGIN
  IF has_table_privilege('authenticated','rebuild_v2.support_tickets','INSERT')
     OR has_table_privilege('authenticated','rebuild_v2.support_ticket_events','INSERT')
     OR has_function_privilege('anon','rebuild_v2.create_support_ticket_for_role(text,text,text,text,text)','EXECUTE')
     OR has_function_privilege('anon','rebuild_v2_private.create_support_ticket_for_role_impl(text,text,text,text,text)','EXECUTE') THEN
    RAISE EXCEPTION 'FAIL: direct ticket writes or anonymous RPC execution are available';
  END IF;
END;
$privilege_boundary$;

ROLLBACK;
SELECT 'rebuild_v2_role_explicit_support_ticket_creation_contract: PASS' AS result;
