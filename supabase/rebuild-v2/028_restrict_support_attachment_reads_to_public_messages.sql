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

CREATE OR REPLACE FUNCTION rebuild_v2_private.can_read_support_attachment_metadata(
  p_ticket_id uuid,
  p_message_id uuid
)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO ''
SET row_security TO 'off'
AS $function$
  SELECT (SELECT auth.uid()) IS NOT NULL
    AND EXISTS (
      SELECT 1
      FROM rebuild_v2.support_ticket_messages m
      JOIN rebuild_v2.support_tickets st ON st.id=m.ticket_id
      WHERE m.id=p_message_id
        AND m.ticket_id=p_ticket_id
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
$function$;

REVOKE ALL ON FUNCTION rebuild_v2_private.can_read_support_attachment_metadata(uuid,uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION rebuild_v2_private.can_read_support_attachment_metadata(uuid,uuid) TO authenticated;

-- Replace the former broad staff OR-policy. Every access path (requester,
-- Support and Admin) must be joined to a public message explicitly.
DROP POLICY IF EXISTS support_attachments_select_ticket_participants_v2
  ON rebuild_v2.support_ticket_attachments;
CREATE POLICY support_attachments_select_ticket_participants_v2
ON rebuild_v2.support_ticket_attachments
AS PERMISSIVE
FOR SELECT TO authenticated
USING (
  rebuild_v2_private.can_read_support_attachment_metadata(
    support_ticket_attachments.ticket_id,
    support_ticket_attachments.message_id
  )
);
