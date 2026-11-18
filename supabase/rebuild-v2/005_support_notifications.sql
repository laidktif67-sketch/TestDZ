-- TestDZ rebuild v2 support and notification write RPCs.
-- Apply after 001_schema.sql through 004_identity_sessions.sql in an isolated test database.
-- All customer writes are constrained server-side; no direct table write grants are added.

CREATE OR REPLACE FUNCTION rebuild_v2_private.create_support_ticket_impl(
  p_subject text,
  p_category text,
  p_priority text,
  p_description text
)
RETURNS TABLE(
  id uuid,
  ticket_number bigint,
  subject text,
  category text,
  priority text,
  status text,
  created_at timestamptz
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'pg_catalog', 'rebuild_v2', 'rebuild_v2_private', 'auth'
SET row_security TO 'off'
AS $function$
DECLARE
  v_user_id uuid := auth.uid();
  v_requester_role text;
  v_ticket_id uuid;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'authentication required' USING errcode = '42501';
  END IF;

  IF p_subject IS NULL OR char_length(btrim(p_subject)) NOT BETWEEN 5 AND 120 THEN
    RAISE EXCEPTION 'invalid support subject' USING errcode = '22023';
  END IF;
  IF p_category IS NULL OR p_category NOT IN ('technical', 'account', 'testing', 'rewards', 'payments', 'other') THEN
    RAISE EXCEPTION 'invalid support category' USING errcode = '22023';
  END IF;
  IF p_priority IS NULL OR p_priority NOT IN ('normal', 'high', 'urgent') THEN
    RAISE EXCEPTION 'invalid support priority' USING errcode = '22023';
  END IF;
  IF p_description IS NULL OR char_length(btrim(p_description)) NOT BETWEEN 10 AND 5000 THEN
    RAISE EXCEPTION 'invalid support description' USING errcode = '22023';
  END IF;

  SELECT ur.role INTO v_requester_role
  FROM rebuild_v2.user_roles ur
  WHERE ur.user_id = v_user_id AND ur.role IN ('tester', 'developer')
  ORDER BY CASE ur.role WHEN 'tester' THEN 0 ELSE 1 END
  LIMIT 1;

  IF v_requester_role IS NULL THEN
    RAISE EXCEPTION 'support requester role required' USING errcode = '42501';
  END IF;

  INSERT INTO rebuild_v2.support_tickets(
    user_id, requester_role, subject, category, priority, description, status
  )
  VALUES (
    v_user_id, v_requester_role, btrim(p_subject), p_category, p_priority, btrim(p_description), 'open'
  )
  RETURNING support_tickets.id INTO v_ticket_id;

  INSERT INTO rebuild_v2.support_ticket_events(ticket_id, actor_id, event_type)
  VALUES (v_ticket_id, v_user_id, 'created');

  RETURN QUERY
  SELECT st.id, st.ticket_number, st.subject, st.category, st.priority, st.status, st.created_at
  FROM rebuild_v2.support_tickets st
  WHERE st.id = v_ticket_id;
END;
$function$;

CREATE OR REPLACE FUNCTION rebuild_v2_private.send_support_message_impl(
  p_ticket_id uuid,
  p_body text
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'pg_catalog', 'rebuild_v2', 'rebuild_v2_private', 'auth'
SET row_security TO 'off'
AS $function$
DECLARE
  v_user_id uuid := auth.uid();
  v_ticket rebuild_v2.support_tickets%rowtype;
  v_message_id uuid;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'authentication required' USING errcode = '42501';
  END IF;
  IF p_ticket_id IS NULL OR p_body IS NULL OR char_length(btrim(p_body)) NOT BETWEEN 1 AND 5000 THEN
    RAISE EXCEPTION 'invalid support message' USING errcode = '22023';
  END IF;

  SELECT * INTO v_ticket
  FROM rebuild_v2.support_tickets st
  WHERE st.id = p_ticket_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'support ticket not found' USING errcode = 'P0002';
  END IF;

  IF v_ticket.status = 'closed' THEN
    RAISE EXCEPTION 'support ticket is closed' USING errcode = '42501';
  END IF;

  IF v_ticket.user_id <> v_user_id
     AND NOT rebuild_v2_private.has_role(v_user_id, ARRAY['support', 'admin']) THEN
    RAISE EXCEPTION 'not a support ticket participant' USING errcode = '42501';
  END IF;

  INSERT INTO rebuild_v2.support_ticket_messages(ticket_id, sender_id, body, internal_note)
  VALUES (p_ticket_id, v_user_id, btrim(p_body), false)
  RETURNING id INTO v_message_id;

  UPDATE rebuild_v2.support_tickets
  SET updated_at = now()
  WHERE id = p_ticket_id;

  RETURN v_message_id;
END;
$function$;

CREATE OR REPLACE FUNCTION rebuild_v2_private.mark_notification_read_impl(p_notification_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'pg_catalog', 'rebuild_v2', 'auth'
SET row_security TO 'off'
AS $function$
DECLARE
  v_user_id uuid := auth.uid();
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'authentication required' USING errcode = '42501';
  END IF;
  IF p_notification_id IS NULL THEN
    RAISE EXCEPTION 'notification id required' USING errcode = '22023';
  END IF;

  UPDATE rebuild_v2.notifications
  SET read_at = coalesce(read_at, now())
  WHERE id = p_notification_id AND user_id = v_user_id;

  RETURN FOUND;
END;
$function$;

CREATE OR REPLACE FUNCTION rebuild_v2_private.mark_all_notifications_read_impl()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'pg_catalog', 'rebuild_v2', 'auth'
SET row_security TO 'off'
AS $function$
DECLARE
  v_user_id uuid := auth.uid();
  v_count integer;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'authentication required' USING errcode = '42501';
  END IF;

  UPDATE rebuild_v2.notifications
  SET read_at = now()
  WHERE user_id = v_user_id AND read_at IS NULL;

  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$function$;

-- Exposed-schema wrappers are invoker functions; private implementations enforce ownership and roles.
CREATE OR REPLACE FUNCTION rebuild_v2.create_support_ticket(
  p_subject text, p_category text, p_priority text, p_description text
)
RETURNS TABLE(id uuid, ticket_number bigint, subject text, category text, priority text, status text, created_at timestamptz)
LANGUAGE sql
SECURITY INVOKER
SET search_path TO ''
AS $function$
  SELECT * FROM rebuild_v2_private.create_support_ticket_impl(p_subject, p_category, p_priority, p_description);
$function$;

CREATE OR REPLACE FUNCTION rebuild_v2.send_support_message(p_ticket_id uuid, p_body text)
RETURNS uuid
LANGUAGE sql
SECURITY INVOKER
SET search_path TO ''
AS $function$
  SELECT rebuild_v2_private.send_support_message_impl(p_ticket_id, p_body);
$function$;

CREATE OR REPLACE FUNCTION rebuild_v2.mark_notification_read(p_notification_id uuid)
RETURNS boolean
LANGUAGE sql
SECURITY INVOKER
SET search_path TO ''
AS $function$
  SELECT rebuild_v2_private.mark_notification_read_impl(p_notification_id);
$function$;

CREATE OR REPLACE FUNCTION rebuild_v2.mark_all_notifications_read()
RETURNS integer
LANGUAGE sql
SECURITY INVOKER
SET search_path TO ''
AS $function$
  SELECT rebuild_v2_private.mark_all_notifications_read_impl();
$function$;

REVOKE ALL ON FUNCTION rebuild_v2_private.create_support_ticket_impl(text, text, text, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION rebuild_v2_private.send_support_message_impl(uuid, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION rebuild_v2_private.mark_notification_read_impl(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION rebuild_v2_private.mark_all_notifications_read_impl() FROM PUBLIC, anon;

REVOKE ALL ON FUNCTION rebuild_v2.create_support_ticket(text, text, text, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION rebuild_v2.send_support_message(uuid, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION rebuild_v2.mark_notification_read(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION rebuild_v2.mark_all_notifications_read() FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION rebuild_v2_private.create_support_ticket_impl(text, text, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION rebuild_v2_private.send_support_message_impl(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION rebuild_v2_private.mark_notification_read_impl(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION rebuild_v2_private.mark_all_notifications_read_impl() TO authenticated;

GRANT EXECUTE ON FUNCTION rebuild_v2.create_support_ticket(text, text, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION rebuild_v2.send_support_message(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION rebuild_v2.mark_notification_read(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION rebuild_v2.mark_all_notifications_read() TO authenticated;


-- Attachment metadata is accepted only after the object exists in the private bucket.
CREATE OR REPLACE FUNCTION rebuild_v2_private.add_support_attachment_impl(
  p_ticket_id uuid,
  p_message_id uuid,
  p_storage_path text,
  p_original_filename text,
  p_mime_type text,
  p_size_bytes bigint
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'pg_catalog', 'rebuild_v2', 'rebuild_v2_private', 'auth', 'storage'
SET row_security TO 'off'
AS $function$
DECLARE
  v_user_id uuid := auth.uid();
  v_ticket rebuild_v2.support_tickets%rowtype;
  v_message rebuild_v2.support_ticket_messages%rowtype;
  v_attachment_id uuid;
  v_folders text[];
  v_object_owner text;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'authentication required' USING errcode = '42501';
  END IF;

  IF p_ticket_id IS NULL OR p_message_id IS NULL
     OR p_storage_path IS NULL OR p_original_filename IS NULL
     OR char_length(p_original_filename) NOT BETWEEN 1 AND 255
     OR position('/' in p_original_filename) > 0
     OR p_mime_type NOT IN ('image/png','image/jpeg','image/webp','text/plain','application/pdf','application/zip')
     OR p_size_bytes NOT BETWEEN 1 AND 10485760 THEN
    RAISE EXCEPTION 'invalid support attachment metadata' USING errcode = '22023';
  END IF;

  v_folders := storage.foldername(p_storage_path);
  IF coalesce(array_length(v_folders,1),0) <> 3
     OR v_folders[1] <> 'v2'
     OR v_folders[2] <> p_ticket_id::text
     OR v_folders[3] <> v_user_id::text
     OR length(split_part(p_storage_path,'/',4)) NOT BETWEEN 38 AND 256
     OR substring(split_part(p_storage_path,'/',4) from 37 for 1) <> '-' THEN
    RAISE EXCEPTION 'support attachment path is not bound to ticket and uploader' USING errcode = '42501';
  END IF;

  -- Validate the UUID prefix embedded in the V2 object filename.
  PERFORM substring(split_part(p_storage_path,'/',4) from 1 for 36)::uuid;

  SELECT * INTO v_ticket
  FROM rebuild_v2.support_tickets
  WHERE id = p_ticket_id
  FOR UPDATE;

  IF NOT FOUND OR v_ticket.status = 'closed' THEN
    RAISE EXCEPTION 'support ticket unavailable' USING errcode = 'P0002';
  END IF;

  IF v_ticket.user_id = v_user_id THEN
    -- Re-check the requester's role at the metadata-registration boundary too.
    -- Storage policies may be OR-combined with legacy policies, so this RPC
    -- must not rely on the object-upload policy as its only authorization gate.
    IF NOT rebuild_v2_private.has_role(v_user_id, ARRAY[v_ticket.requester_role]) THEN
      RAISE EXCEPTION 'requester role is not authorized for this ticket' USING errcode = '42501';
    END IF;
  ELSIF NOT rebuild_v2_private.has_role(v_user_id, ARRAY['support','admin']) THEN
    RAISE EXCEPTION 'not a support ticket participant' USING errcode = '42501';
  END IF;

  SELECT * INTO v_message
  FROM rebuild_v2.support_ticket_messages
  WHERE id = p_message_id AND ticket_id = p_ticket_id;

  IF NOT FOUND OR v_message.sender_id <> v_user_id OR v_message.internal_note THEN
    RAISE EXCEPTION 'attachment must belong to the caller public message' USING errcode = '42501';
  END IF;

  SELECT coalesce(o.owner_id,o.owner::text) INTO v_object_owner
  FROM storage.objects o
  WHERE o.bucket_id='support-attachments' AND o.name=p_storage_path;

  IF NOT FOUND OR v_object_owner IS DISTINCT FROM v_user_id::text THEN
    RAISE EXCEPTION 'uploaded support object not found or not owned by caller' USING errcode = '42501';
  END IF;

  INSERT INTO rebuild_v2.support_ticket_attachments(
    ticket_id,message_id,uploaded_by,storage_path,original_filename,mime_type,size_bytes
  )
  VALUES (
    p_ticket_id,p_message_id,v_user_id,p_storage_path,btrim(p_original_filename),p_mime_type,p_size_bytes
  )
  RETURNING id INTO v_attachment_id;

  RETURN v_attachment_id;
END;
$function$;

CREATE OR REPLACE FUNCTION rebuild_v2.add_support_attachment(
  p_ticket_id uuid,
  p_message_id uuid,
  p_storage_path text,
  p_original_filename text,
  p_mime_type text,
  p_size_bytes bigint
)
RETURNS uuid
LANGUAGE sql
SECURITY INVOKER
SET search_path TO ''
AS $function$
  SELECT rebuild_v2_private.add_support_attachment_impl(
    p_ticket_id,p_message_id,p_storage_path,p_original_filename,p_mime_type,p_size_bytes
  );
$function$;

REVOKE ALL ON FUNCTION rebuild_v2_private.add_support_attachment_impl(uuid,uuid,text,text,text,bigint) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION rebuild_v2.add_support_attachment(uuid,uuid,text,text,text,bigint) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION rebuild_v2_private.add_support_attachment_impl(uuid,uuid,text,text,text,bigint) TO authenticated;
GRANT EXECUTE ON FUNCTION rebuild_v2.add_support_attachment(uuid,uuid,text,text,text,bigint) TO authenticated;
