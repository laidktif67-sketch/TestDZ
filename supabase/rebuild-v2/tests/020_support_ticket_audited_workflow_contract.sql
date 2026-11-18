-- Support ticket event and audited state-transition contract. Disposable local DB only.
BEGIN;

INSERT INTO auth.users
  (id,aud,role,email,encrypted_password,email_confirmed_at,raw_app_meta_data,raw_user_meta_data,created_at,updated_at)
VALUES
  ('92000000-0000-4000-8000-000000000001','authenticated','authenticated','v2-support-workflow-agent@example.invalid','',now(),'{"provider":"email","providers":["email"]}'::jsonb,'{"name":"Support Agent"}'::jsonb,now(),now()),
  ('92000000-0000-4000-8000-000000000002','authenticated','authenticated','v2-support-workflow-admin@example.invalid','',now(),'{"provider":"email","providers":["email"]}'::jsonb,'{"name":"Admin"}'::jsonb,now(),now()),
  ('92000000-0000-4000-8000-000000000003','authenticated','authenticated','v2-support-workflow-owner@example.invalid','',now(),'{"provider":"email","providers":["email"]}'::jsonb,'{"name":"Ticket Owner"}'::jsonb,now(),now());

INSERT INTO rebuild_v2.user_roles(user_id,role)
VALUES
  ('92000000-0000-4000-8000-000000000001','support'),
  ('92000000-0000-4000-8000-000000000002','admin');

INSERT INTO rebuild_v2.support_tickets
  (id,user_id,requester_role,subject,category,priority,description,status)
VALUES
  ('92000000-0000-4000-8000-000000000101','92000000-0000-4000-8000-000000000003','tester','Cannot submit test','technical','normal','A sufficiently detailed support ticket for the audited workflow contract.','open'),
  ('92000000-0000-4000-8000-000000000102','92000000-0000-4000-8000-000000000003','tester','Closed account ticket','account','normal','A sufficiently detailed closed ticket for the audited workflow contract.','closed'),
  ('92000000-0000-4000-8000-000000000103','92000000-0000-4000-8000-000000000003','tester','Resolved account ticket','account','normal','A sufficiently detailed resolved ticket for the audited workflow contract.','resolved');

INSERT INTO rebuild_v2.support_ticket_events(ticket_id,actor_id,event_type)
VALUES
  ('92000000-0000-4000-8000-000000000101','92000000-0000-4000-8000-000000000003','created'),
  ('92000000-0000-4000-8000-000000000102','92000000-0000-4000-8000-000000000003','created'),
  ('92000000-0000-4000-8000-000000000103','92000000-0000-4000-8000-000000000003','created');

SET LOCAL ROLE authenticated;

-- Support can update status and priority atomically with a reason.
DO $support_update$
DECLARE v_count integer; v_status text; v_priority text;
BEGIN
  PERFORM set_config('request.jwt.claim.sub','92000000-0000-4000-8000-000000000001',true);
  PERFORM set_config('request.jwt.claims','{"sub":"92000000-0000-4000-8000-000000000001","role":"authenticated"}',true);

  SELECT new_status,new_priority INTO v_status,v_priority
  FROM rebuild_v2.update_support_ticket(
    '92000000-0000-4000-8000-000000000101',
    'in_progress','high','Assigned to the active support work queue'
  );
  IF v_status <> 'in_progress' OR v_priority <> 'high' THEN
    RAISE EXCEPTION 'FAIL: Support update returned unexpected state';
  END IF;

  SELECT count(*) INTO v_count FROM rebuild_v2.support_ticket_events
  WHERE ticket_id='92000000-0000-4000-8000-000000000101'
    AND actor_id='92000000-0000-4000-8000-000000000001'
    AND event_type IN ('status_changed','priority_changed');
  IF v_count <> 2 THEN RAISE EXCEPTION 'FAIL: status/priority event history missing'; END IF;

  -- A Support agent cannot reopen a resolved ticket.
  BEGIN
    PERFORM 1 FROM rebuild_v2.update_support_ticket(
      '92000000-0000-4000-8000-000000000103',
      'in_progress',NULL,'Attempted unsupported resolved ticket reopening'
    );
    RAISE EXCEPTION 'FAIL: Support reopened a resolved ticket';
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;

  -- A Support agent cannot reopen a closed ticket or change its priority.
  BEGIN
    PERFORM 1 FROM rebuild_v2.update_support_ticket(
      '92000000-0000-4000-8000-000000000102',
      'open','urgent','Attempted unsupported closed ticket reopening'
    );
    RAISE EXCEPTION 'FAIL: Support changed a closed ticket';
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;
END;
$support_update$;

-- A requester without staff roles cannot call the staff update RPC.
DO $requester_denied$
DECLARE v_count integer;
BEGIN
  PERFORM set_config('request.jwt.claim.sub','92000000-0000-4000-8000-000000000003',true);
  PERFORM set_config('request.jwt.claims','{"sub":"92000000-0000-4000-8000-000000000003","role":"authenticated"}',true);
  BEGIN
    PERFORM 1 FROM rebuild_v2.update_support_ticket(
      '92000000-0000-4000-8000-000000000101',
      'resolved',NULL,'Requester must not operate staff ticket controls'
    );
    RAISE EXCEPTION 'FAIL: requester changed support ticket status';
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;
END;
$requester_denied$;

-- Admin may reopen a closed ticket; the operation remains reason-required and audited.
DO $admin_reopen$
DECLARE v_status text;
BEGIN
  PERFORM set_config('request.jwt.claim.sub','92000000-0000-4000-8000-000000000002',true);
  PERFORM set_config('request.jwt.claims','{"sub":"92000000-0000-4000-8000-000000000002","role":"authenticated"}',true);
  SELECT new_status INTO v_status
  FROM rebuild_v2.update_support_ticket(
    '92000000-0000-4000-8000-000000000102',
    'open',NULL,'Admin approved reopening after additional customer evidence'
  );
  IF v_status <> 'open' THEN RAISE EXCEPTION 'FAIL: Admin could not reopen closed ticket'; END IF;
END;
$admin_reopen$;

-- Both user and staff messages create ticket events; only staff replies create staff audit events.
DO $message_events$
DECLARE v_message_id uuid; v_count integer;
BEGIN
  PERFORM set_config('request.jwt.claim.sub','92000000-0000-4000-8000-000000000001',true);
  PERFORM set_config('request.jwt.claims','{"sub":"92000000-0000-4000-8000-000000000001","role":"authenticated"}',true);
  v_message_id := rebuild_v2.send_support_message(
    '92000000-0000-4000-8000-000000000101','We are reviewing the issue and will update you shortly.'
  );
  SELECT count(*) INTO v_count FROM rebuild_v2.support_ticket_events
  WHERE ticket_id='92000000-0000-4000-8000-000000000101'
    AND actor_id='92000000-0000-4000-8000-000000000001'
    AND event_type='message_sent';
  IF v_count <> 1 THEN RAISE EXCEPTION 'FAIL: staff reply event missing'; END IF;

  PERFORM set_config('request.jwt.claim.sub','92000000-0000-4000-8000-000000000003',true);
  PERFORM set_config('request.jwt.claims','{"sub":"92000000-0000-4000-8000-000000000003","role":"authenticated"}',true);
  PERFORM rebuild_v2.send_support_message(
    '92000000-0000-4000-8000-000000000101','Thank you, I have added the requested details.'
  );
  SELECT count(*) INTO v_count FROM rebuild_v2.support_ticket_events
  WHERE ticket_id='92000000-0000-4000-8000-000000000101'
    AND actor_id='92000000-0000-4000-8000-000000000003'
    AND event_type='message_sent';
  IF v_count <> 1 THEN RAISE EXCEPTION 'FAIL: requester reply event missing'; END IF;
END;
$message_events$;

RESET ROLE;

DO $audit_assertions$
DECLARE v_count integer; v_reason text;
BEGIN
  SELECT count(*) INTO v_count FROM rebuild_v2.audit_events
  WHERE actor_id='92000000-0000-4000-8000-000000000001'
    AND action='support.ticket_updated'
    AND target_id='92000000-0000-4000-8000-000000000101'
    AND reason='Assigned to the active support work queue'
    AND metadata->>'old_status'='open'
    AND metadata->>'new_status'='in_progress'
    AND metadata->>'old_priority'='normal'
    AND metadata->>'new_priority'='high';
  IF v_count <> 1 THEN RAISE EXCEPTION 'FAIL: status/priority audit record missing'; END IF;

  SELECT count(*) INTO v_count FROM rebuild_v2.audit_events
  WHERE actor_id='92000000-0000-4000-8000-000000000002'
    AND action='support.ticket_updated'
    AND target_id='92000000-0000-4000-8000-000000000102'
    AND reason='Admin approved reopening after additional customer evidence';
  IF v_count <> 1 THEN RAISE EXCEPTION 'FAIL: Admin reopen audit record missing'; END IF;

  SELECT count(*) INTO v_count FROM rebuild_v2.audit_events
  WHERE actor_id='92000000-0000-4000-8000-000000000001'
    AND action='support.reply_sent'
    AND target_id='92000000-0000-4000-8000-000000000101'
    AND metadata ? 'message_id';
  IF v_count <> 1 THEN RAISE EXCEPTION 'FAIL: staff reply audit record missing'; END IF;

  SELECT count(*) INTO v_count FROM rebuild_v2.audit_events
  WHERE action='support.reply_sent'
    AND actor_id='92000000-0000-4000-8000-000000000003';
  IF v_count <> 0 THEN RAISE EXCEPTION 'FAIL: requester reply incorrectly recorded as staff action'; END IF;

  -- The audit trail records message identity, never message body text.
  IF EXISTS (
    SELECT 1 FROM rebuild_v2.audit_events
    WHERE action='support.reply_sent'
      AND metadata::text ILIKE '%reviewing the issue%'
  ) THEN
    RAISE EXCEPTION 'FAIL: message body leaked into audit metadata';
  END IF;
END;
$audit_assertions$;

-- Invalid reason and no-op changes must not create new audit rows.
RESET ROLE;
DO $invalid_changes$
DECLARE v_before integer; v_after integer;
BEGIN
  PERFORM set_config('request.jwt.claim.sub','92000000-0000-4000-8000-000000000001',true);
  PERFORM set_config('request.jwt.claims','{"sub":"92000000-0000-4000-8000-000000000001","role":"authenticated"}',true);
  SELECT count(*) INTO v_before FROM rebuild_v2.audit_events;
  BEGIN
    PERFORM 1 FROM rebuild_v2.update_support_ticket(
      '92000000-0000-4000-8000-000000000101',
      NULL,'high','too short'
    );
    RAISE EXCEPTION 'FAIL: short reason accepted';
  EXCEPTION WHEN invalid_parameter_value THEN NULL;
  END;
  BEGIN
    PERFORM 1 FROM rebuild_v2.update_support_ticket(
      '92000000-0000-4000-8000-000000000101',
      'in_progress','high','Reason is valid but no change is required'
    );
    RAISE EXCEPTION 'FAIL: no-op update accepted';
  EXCEPTION WHEN invalid_parameter_value THEN NULL;
  END;
  SELECT count(*) INTO v_after FROM rebuild_v2.audit_events;
  IF v_after <> v_before THEN RAISE EXCEPTION 'FAIL: invalid update created audit event'; END IF;
END;
$invalid_changes$;
RESET ROLE;

-- Verify event stream immutability as the disposable local migration owner.
DO $event_immutability$
BEGIN
  BEGIN
    UPDATE rebuild_v2.support_ticket_events
    SET event_type='created'
    WHERE ticket_id='92000000-0000-4000-8000-000000000101'
      AND event_type='message_sent';
    RAISE EXCEPTION 'FAIL: support event UPDATE unexpectedly succeeded';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM NOT LIKE 'immutable_record:%' THEN RAISE; END IF;
  END;
END;
$event_immutability$;

ROLLBACK;
SELECT 'rebuild_v2_support_ticket_audited_workflow_contract: PASS' AS result;
