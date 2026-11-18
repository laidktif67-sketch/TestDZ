-- TestDZ V2: transactional notification outbox producer contract.
-- Candidate only; apply after 019_notification_recipient_roles.sql.
-- This script does not deliver notifications. A trusted worker must consume
-- notification.requested events and insert role-scoped notification rows.

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

COMMENT ON COLUMN rebuild_v2.notifications.source_event_id IS
  'Trusted outbox event that created this inbox item; unique for idempotent dispatch.';

COMMIT;
