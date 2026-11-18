-- TestDZ V2: transactional notification outbox producer contract.
-- Candidate only; apply after 019_notification_recipient_roles.sql.
-- Adds transactional event producers plus a service-role-only batch dispatcher.
-- The Edge Function source lives at supabase/functions/dispatch-notifications.

BEGIN;

-- Stable source linkage lets a future dispatcher safely retry without creating
-- duplicate inbox rows for the same outbox event.
ALTER TABLE rebuild_v2.notifications
  ADD COLUMN source_event_id uuid
    REFERENCES rebuild_v2.events(id) ON DELETE RESTRICT;
CREATE UNIQUE INDEX notifications_source_event_id_uidx
  ON rebuild_v2.notifications(source_event_id)
  WHERE source_event_id IS NOT NULL;

CREATE OR REPLACE FUNCTION rebuild_v2_private.enqueue_notification_event(
  p_recipient_id uuid,
  p_recipient_role text,
  p_notification_type text,
  p_title text,
  p_body text,
  p_aggregate_type text,
  p_aggregate_id uuid,
  p_data jsonb DEFAULT '{}'::jsonb
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
SET row_security TO 'off'
AS $function$
DECLARE
  v_event_id uuid;
BEGIN
  IF p_recipient_id IS NULL OR p_aggregate_id IS NULL
     OR p_notification_type IS NULL
     OR p_notification_type !~ '^[a-z][a-z0-9_.-]{1,79}$'
     OR p_title IS NULL OR char_length(btrim(p_title)) NOT BETWEEN 1 AND 160
     OR p_body IS NULL OR char_length(btrim(p_body)) NOT BETWEEN 1 AND 1000
     OR p_aggregate_type IS NULL
     OR p_aggregate_type !~ '^[a-z][a-z0-9_]{1,39}$'
     OR p_data IS NULL OR jsonb_typeof(p_data) <> 'object' THEN
    RAISE EXCEPTION 'NOTIFICATION_EVENT_INPUT_INVALID' USING errcode='22023';
  END IF;

  -- This helper is invoked from trusted lifecycle RPCs on behalf of another
  -- user. Do not call has_role(user_id, ...) here: that helper intentionally
  -- binds its subject to auth.uid() and is designed for self-authorization.
  IF p_recipient_role = 'developer' THEN
    IF NOT EXISTS (
      SELECT 1 FROM rebuild_v2.user_roles ur
      WHERE ur.user_id = p_recipient_id AND ur.role IN ('developer','admin')
    ) THEN
      RETURN NULL;
    END IF;
  ELSIF p_recipient_role = 'tester' THEN
    IF NOT EXISTS (
      SELECT 1 FROM rebuild_v2.user_roles ur
      WHERE ur.user_id = p_recipient_id AND ur.role = 'tester'
    ) THEN
      RETURN NULL;
    END IF;
  ELSE
    RAISE EXCEPTION 'NOTIFICATION_RECIPIENT_ROLE_INVALID' USING errcode='22023';
  END IF;

  INSERT INTO rebuild_v2.events(event_type,aggregate_type,aggregate_id,payload)
  VALUES (
    'notification.requested',
    p_aggregate_type,
    p_aggregate_id,
    jsonb_build_object(
      'user_id', p_recipient_id,
      'recipient_role', p_recipient_role,
      'type', p_notification_type,
      'title', btrim(p_title),
      'body', btrim(p_body),
      'data', p_data
    )
  )
  RETURNING id INTO v_event_id;

  RETURN v_event_id;
END;
$function$;

REVOKE ALL ON FUNCTION rebuild_v2_private.enqueue_notification_event(
  uuid,text,text,text,text,text,uuid,jsonb
) FROM PUBLIC,anon,authenticated;

CREATE OR REPLACE FUNCTION rebuild_v2.process_notification_outbox(p_limit integer DEFAULT 50)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
SET row_security TO 'off'
AS $function$
DECLARE
  v_event record;
  v_user_id uuid;
  v_recipient_role text;
  v_processed integer := 0;
BEGIN
  IF COALESCE(auth.jwt()->>'role','') <> 'service_role' THEN
    RAISE EXCEPTION 'SERVICE_ROLE_REQUIRED' USING errcode='42501';
  END IF;
  IF p_limit IS NULL OR p_limit NOT BETWEEN 1 AND 100 THEN
    RAISE EXCEPTION 'OUTBOX_BATCH_SIZE_INVALID' USING errcode='22023';
  END IF;

  FOR v_event IN
    SELECT e.*
    FROM rebuild_v2.events e
    WHERE e.event_type='notification.requested'
      AND e.status='pending'
      AND e.available_at <= now()
    ORDER BY e.created_at,e.id
    LIMIT p_limit
    FOR UPDATE SKIP LOCKED
  LOOP
    BEGIN
      IF jsonb_typeof(v_event.payload) <> 'object'
         OR jsonb_typeof(v_event.payload->'data') <> 'object'
         OR v_event.payload->>'title' IS NULL
         OR char_length(btrim(v_event.payload->>'title')) NOT BETWEEN 1 AND 160
         OR v_event.payload->>'body' IS NULL
         OR char_length(btrim(v_event.payload->>'body')) NOT BETWEEN 1 AND 1000
         OR v_event.payload->>'type' IS NULL
         OR v_event.payload->>'recipient_role' NOT IN ('tester','developer') THEN
        RAISE EXCEPTION 'NOTIFICATION_EVENT_PAYLOAD_INVALID';
      END IF;

      v_user_id := (v_event.payload->>'user_id')::uuid;
      v_recipient_role := v_event.payload->>'recipient_role';
      IF NOT EXISTS (
        SELECT 1 FROM rebuild_v2.user_roles ur
        WHERE ur.user_id=v_user_id AND (
          (v_recipient_role='tester' AND ur.role='tester')
          OR (v_recipient_role='developer' AND ur.role IN ('developer','admin'))
        )
      ) THEN
        RAISE EXCEPTION 'NOTIFICATION_RECIPIENT_ROLE_REVOKED';
      END IF;

      INSERT INTO rebuild_v2.notifications(
        user_id,type,title,body,data,recipient_role,source_event_id
      ) VALUES (
        v_user_id,
        v_event.payload->>'type',
        btrim(v_event.payload->>'title'),
        btrim(v_event.payload->>'body'),
        v_event.payload->'data',
        v_recipient_role,
        v_event.id
      )
      ON CONFLICT (source_event_id) WHERE source_event_id IS NOT NULL DO NOTHING;

      UPDATE rebuild_v2.events
      SET status='delivered',processed_at=now(),last_error=NULL
      WHERE id=v_event.id;
      v_processed := v_processed + 1;
    EXCEPTION WHEN OTHERS THEN
      UPDATE rebuild_v2.events
      SET attempts=attempts+1,
          status=CASE WHEN attempts+1 >= 5 THEN 'failed' ELSE 'pending' END,
          available_at=CASE
            WHEN attempts+1 >= 5 THEN available_at
            ELSE now() + interval '1 minute' * power(2,LEAST(attempts,4))
          END,
          last_error=left(SQLERRM,1000)
      WHERE id=v_event.id;
    END;
  END LOOP;

  RETURN v_processed;
END;
$function$;

-- The server-side worker uses PostgREST with the service role. Grant schema
-- visibility only to that role; no client role gains access from this grant.
GRANT USAGE ON SCHEMA rebuild_v2 TO service_role;
REVOKE ALL ON FUNCTION rebuild_v2.process_notification_outbox(integer)
  FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION rebuild_v2.process_notification_outbox(integer)
  TO service_role;

COMMENT ON FUNCTION rebuild_v2.process_notification_outbox(integer) IS
  'Service-role-only transactional outbox dispatcher with SKIP LOCKED, idempotent inbox insertion, exponential retry, and terminal failure after five attempts.';

COMMENT ON COLUMN rebuild_v2.notifications.source_event_id IS
  'Trusted outbox event that created this inbox item; unique for idempotent dispatch.';

COMMIT;
