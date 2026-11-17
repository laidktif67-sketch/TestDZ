-- Preserve separate tester/developer notification feeds in Rebuild V2.
-- Apply after 018_verify_submission_evidence_metadata.sql.
-- Existing V2 notification rows cannot be assigned a role safely because the old
-- V2 schema did not store one; stop rather than silently classify historical rows.
DO $guard$
BEGIN
  IF EXISTS (SELECT 1 FROM rebuild_v2.notifications) THEN
    RAISE EXCEPTION 'V2 notifications require an explicit recipient_role backfill before applying 019';
  END IF;
END;
$guard$;

ALTER TABLE rebuild_v2.notifications
  ADD COLUMN recipient_role text NOT NULL,
  ADD CONSTRAINT notifications_recipient_role_check
    CHECK (recipient_role IN ('tester','developer'));

CREATE INDEX notifications_user_role_created_v2
  ON rebuild_v2.notifications(user_id, recipient_role, created_at DESC);

DROP POLICY IF EXISTS notifications_select_owner_v2 ON rebuild_v2.notifications;
CREATE POLICY notifications_select_owner_role_v2
ON rebuild_v2.notifications
AS PERMISSIVE
FOR SELECT
TO authenticated
USING (
  user_id = (SELECT auth.uid())
  AND (
    (recipient_role = 'tester'
      AND rebuild_v2_private.has_role((SELECT auth.uid()), ARRAY['tester']))
    OR
    (recipient_role = 'developer'
      AND rebuild_v2_private.has_role((SELECT auth.uid()), ARRAY['developer','admin']))
  )
);

-- Remove the old unscoped RPC signatures so callers cannot bypass feed-role checks.
DROP FUNCTION IF EXISTS rebuild_v2.mark_notification_read(uuid);
DROP FUNCTION IF EXISTS rebuild_v2_private.mark_notification_read_impl(uuid);
DROP FUNCTION IF EXISTS rebuild_v2.mark_all_notifications_read();
DROP FUNCTION IF EXISTS rebuild_v2_private.mark_all_notifications_read_impl();

CREATE OR REPLACE FUNCTION rebuild_v2_private.mark_notification_read_impl(
  p_notification_id uuid,
  p_recipient_role text
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'pg_catalog','rebuild_v2','rebuild_v2_private','auth'
SET row_security TO 'off'
AS $function$
DECLARE
  v_user_id uuid := auth.uid();
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'authentication required' USING errcode='42501';
  END IF;
  IF p_notification_id IS NULL THEN
    RAISE EXCEPTION 'notification id required' USING errcode='22023';
  END IF;
  IF p_recipient_role = 'tester' THEN
    IF NOT rebuild_v2_private.has_role(v_user_id, ARRAY['tester']) THEN
      RAISE EXCEPTION 'tester notification role required' USING errcode='42501';
    END IF;
  ELSIF p_recipient_role = 'developer' THEN
    IF NOT rebuild_v2_private.has_role(v_user_id, ARRAY['developer','admin']) THEN
      RAISE EXCEPTION 'developer notification role required' USING errcode='42501';
    END IF;
  ELSE
    RAISE EXCEPTION 'invalid notification recipient role' USING errcode='22023';
  END IF;

  UPDATE rebuild_v2.notifications
  SET read_at = coalesce(read_at, now())
  WHERE id = p_notification_id
    AND user_id = v_user_id
    AND recipient_role = p_recipient_role;

  RETURN FOUND;
END;
$function$;

CREATE OR REPLACE FUNCTION rebuild_v2_private.mark_all_notifications_read_impl(
  p_recipient_role text
)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'pg_catalog','rebuild_v2','rebuild_v2_private','auth'
SET row_security TO 'off'
AS $function$
DECLARE
  v_user_id uuid := auth.uid();
  v_count integer;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'authentication required' USING errcode='42501';
  END IF;
  IF p_recipient_role = 'tester' THEN
    IF NOT rebuild_v2_private.has_role(v_user_id, ARRAY['tester']) THEN
      RAISE EXCEPTION 'tester notification role required' USING errcode='42501';
    END IF;
  ELSIF p_recipient_role = 'developer' THEN
    IF NOT rebuild_v2_private.has_role(v_user_id, ARRAY['developer','admin']) THEN
      RAISE EXCEPTION 'developer notification role required' USING errcode='42501';
    END IF;
  ELSE
    RAISE EXCEPTION 'invalid notification recipient role' USING errcode='22023';
  END IF;

  UPDATE rebuild_v2.notifications
  SET read_at = now()
  WHERE user_id = v_user_id
    AND recipient_role = p_recipient_role
    AND read_at IS NULL;

  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$function$;

CREATE OR REPLACE FUNCTION rebuild_v2.mark_notification_read(
  p_notification_id uuid,
  p_recipient_role text
)
RETURNS boolean
LANGUAGE sql
SECURITY INVOKER
SET search_path TO ''
AS $function$
  SELECT rebuild_v2_private.mark_notification_read_impl(p_notification_id,p_recipient_role);
$function$;

CREATE OR REPLACE FUNCTION rebuild_v2.mark_all_notifications_read(
  p_recipient_role text
)
RETURNS integer
LANGUAGE sql
SECURITY INVOKER
SET search_path TO ''
AS $function$
  SELECT rebuild_v2_private.mark_all_notifications_read_impl(p_recipient_role);
$function$;

REVOKE ALL ON FUNCTION rebuild_v2_private.mark_notification_read_impl(uuid,text) FROM PUBLIC,anon;
REVOKE ALL ON FUNCTION rebuild_v2_private.mark_all_notifications_read_impl(text) FROM PUBLIC,anon;
REVOKE ALL ON FUNCTION rebuild_v2.mark_notification_read(uuid,text) FROM PUBLIC,anon;
REVOKE ALL ON FUNCTION rebuild_v2.mark_all_notifications_read(text) FROM PUBLIC,anon;

GRANT EXECUTE ON FUNCTION rebuild_v2_private.mark_notification_read_impl(uuid,text) TO authenticated;
GRANT EXECUTE ON FUNCTION rebuild_v2_private.mark_all_notifications_read_impl(text) TO authenticated;
GRANT EXECUTE ON FUNCTION rebuild_v2.mark_notification_read(uuid,text) TO authenticated;
GRANT EXECUTE ON FUNCTION rebuild_v2.mark_all_notifications_read(text) TO authenticated;
