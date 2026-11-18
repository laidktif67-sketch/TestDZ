-- Notification outbox retry/backoff and terminal-failure contract.
-- Run only against an isolated disposable database after candidate replay through 021.
-- The deliberately invalid recipient has no tester role, so dispatch must retry
-- and eventually dead-letter the event without creating an inbox notification.

BEGIN;

DO $setup$
DECLARE
  v_event_id uuid := '93000000-0000-4000-8000-000000000001';
  v_processed integer;
  v_attempts integer;
  v_status text;
  v_available_at timestamptz;
  v_last_error text;
  v_notifications integer;
  v_attempt integer;
BEGIN
  INSERT INTO rebuild_v2.events(
    id,event_type,aggregate_type,aggregate_id,payload,status,attempts,available_at
  ) VALUES (
    v_event_id,
    'notification.requested',
    'contract_test',
    '93000000-0000-4000-8000-000000000002',
    jsonb_build_object(
      'user_id','93000000-0000-4000-8000-000000000003',
      'recipient_role','tester',
      'type','contract.retry',
      'title','Retry contract',
      'body','This event intentionally targets a user without the required role.',
      'data','{}'::jsonb
    ),
    'pending',0,now()
  );

  -- An authenticated client must not be able to drain the queue.
  PERFORM set_config(
    'request.jwt.claims',
    jsonb_build_object(
      'sub','93000000-0000-4000-8000-000000000004',
      'role','authenticated'
    )::text,
    true
  );
  BEGIN
    PERFORM rebuild_v2.process_notification_outbox(1);
    RAISE EXCEPTION 'FAIL: authenticated user unexpectedly drained the outbox';
  EXCEPTION WHEN SQLSTATE '42501' THEN
    NULL;
  END;

  PERFORM set_config(
    'request.jwt.claims',
    jsonb_build_object('role','service_role')::text,
    true
  );

  FOR v_attempt IN 1..5 LOOP
    v_processed := rebuild_v2.process_notification_outbox(1);
    IF v_processed <> 0 THEN
      RAISE EXCEPTION 'FAIL: invalid recipient event was unexpectedly delivered';
    END IF;

    SELECT attempts,status,available_at,last_error
      INTO v_attempts,v_status,v_available_at,v_last_error
    FROM rebuild_v2.events WHERE id=v_event_id;

    IF v_attempts <> v_attempt THEN
      RAISE EXCEPTION 'FAIL: expected attempt %, got %',v_attempt,v_attempts;
    END IF;
    IF v_last_error IS NULL OR char_length(v_last_error)=0 THEN
      RAISE EXCEPTION 'FAIL: failed attempt did not record an error';
    END IF;

    IF v_attempt < 5 THEN
      IF v_status <> 'pending' THEN
        RAISE EXCEPTION 'FAIL: event should remain pending before attempt five; got %',v_status;
      END IF;
      IF v_available_at <= now() THEN
        RAISE EXCEPTION 'FAIL: retry backoff did not move available_at into the future';
      END IF;
      -- Advance the retry clock in this isolated transaction; no wall-clock wait.
      UPDATE rebuild_v2.events SET available_at=now() WHERE id=v_event_id;
    ELSE
      IF v_status <> 'failed' THEN
        RAISE EXCEPTION 'FAIL: fifth failure should dead-letter event; got %',v_status;
      END IF;
    END IF;
  END LOOP;

  SELECT count(*) INTO v_notifications
  FROM rebuild_v2.notifications WHERE source_event_id=v_event_id;
  IF v_notifications <> 0 THEN
    RAISE EXCEPTION 'FAIL: invalid event created an inbox notification';
  END IF;
END;
$setup$;

ROLLBACK;

SELECT 'rebuild_v2_notification_outbox_retry_contract: PASS' AS result;
