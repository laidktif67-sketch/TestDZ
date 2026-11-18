-- Restrict support attachment metadata and object reads to public ticket messages.
-- Candidate rebuild script only; do not apply to hosted projects during this audit.
CREATE OR REPLACE FUNCTION rebuild_v2_private.can_read_support_attachment(p_object_name text)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO ''
SET row_security TO 'off'
AS $function$
DECLARE
  v_folders text[];
  v_ticket_id uuid;
BEGIN
  IF (SELECT auth.uid()) IS NULL OR p_object_name IS NULL THEN RETURN false; END IF;
  v_folders := storage.foldername(p_object_name);
  IF coalesce(array_length(v_folders,1),0) <> 3
     OR v_folders[1] <> 'v2'
     OR v_folders[2] !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
     OR v_folders[3] !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' THEN
    RETURN false;
  END IF;
  v_ticket_id := v_folders[2]::uuid;
  RETURN EXISTS (
    SELECT 1
    FROM rebuild_v2.support_ticket_attachments att
    JOIN rebuild_v2.support_ticket_messages m
      ON m.id=att.message_id AND m.ticket_id=att.ticket_id
    JOIN rebuild_v2.support_tickets st ON st.id=att.ticket_id
    WHERE att.storage_path=p_object_name
      AND st.id=v_ticket_id
      AND att.uploaded_by=v_folders[3]::uuid
      AND m.internal_note=false
      AND (
        (st.user_id=(SELECT auth.uid())
          AND EXISTS (
            SELECT 1 FROM rebuild_v2.user_roles ur
            WHERE ur.user_id=(SELECT auth.uid()) AND ur.role=st.requester_role
          ))
        OR rebuild_v2_private.has_role((SELECT auth.uid()),ARRAY['support','admin'])
      )
  );
EXCEPTION WHEN invalid_text_representation THEN
  RETURN false;
END;
$function$;

REVOKE ALL ON FUNCTION rebuild_v2_private.can_read_support_attachment(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION rebuild_v2_private.can_read_support_attachment(text) TO authenticated;

-- Existing permissive policy still decides which role/ticket may read the row.
-- This restrictive guard additionally prevents every role from seeing metadata
-- attached to an internal note, including through an alternate client query.
DROP POLICY IF EXISTS support_attachment_public_message_read_guard_v2
  ON rebuild_v2.support_ticket_attachments;
CREATE POLICY support_attachment_public_message_read_guard_v2
ON rebuild_v2.support_ticket_attachments
AS RESTRICTIVE
FOR SELECT TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM rebuild_v2.support_ticket_messages m
    WHERE m.id=support_ticket_attachments.message_id
      AND m.ticket_id=support_ticket_attachments.ticket_id
      AND m.internal_note=false
  )
);
