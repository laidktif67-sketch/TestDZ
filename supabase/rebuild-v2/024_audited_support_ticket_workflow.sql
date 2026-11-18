-- Audited Support ticket actions for the isolated V2 candidate.
-- Candidate-only script: never apply to hosted Production before cutover approval.

ALTER TABLE rebuild_v2.support_ticket_events
  DROP CONSTRAINT IF EXISTS support_ticket_events_event_type_check;

ALTER TABLE rebuild_v2.support_ticket_events
  ADD CONSTRAINT support_ticket_events_event_type_check
  CHECK (event_type = ANY (ARRAY[
    'created'::text,
    'message_sent'::text,
    'status_changed'::text,
    'priority_changed'::text
  ]));

-- Record every public conversation reply in the immutable ticket event stream.
-- Staff replies additionally create an immutable Admin-visible audit event.
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
  v_is_staff boolean;
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

  v_is_staff := rebuild_v2_private.has_role(v_user_id, ARRAY['support', 'admin']);
  IF v_ticket.user_id <> v_user_id AND NOT v_is_staff THEN
    RAISE EXCEPTION 'not a support ticket participant' USING errcode = '42501';
  END IF;

  INSERT INTO rebuild_v2.support_ticket_messages(ticket_id, sender_id, body, internal_note)
  VALUES (p_ticket_id, v_user_id, btrim(p_body), false)
  RETURNING id INTO v_message_id;

  INSERT INTO rebuild_v2.support_ticket_events(ticket_id, actor_id, event_type)
  VALUES (p_ticket_id, v_user_id, 'message_sent');

  UPDATE rebuild_v2.support_tickets
  SET updated_at = now()
  WHERE id = p_ticket_id;

  IF v_is_staff THEN
    INSERT INTO rebuild_v2.audit_events(
      actor_id, action, target_type, target_id, metadata
    )
    VALUES (
      v_user_id,
      'support.reply_sent',
      'support_ticket',
      p_ticket_id,
      jsonb_build_object('message_id', v_message_id, 'internal_note', false)
    );
  END IF;

  RETURN v_message_id;
END;
$function$;

-- Staff status/priority changes are performed atomically, reason-required,
-- role-checked, and written to both the ticket event stream and Admin audit log.
CREATE OR REPLACE FUNCTION rebuild_v2_private.update_support_ticket_impl(
  p_ticket_id uuid,
  p_status text,
  p_priority text,
  p_reason text
)
RETURNS TABLE(
  ticket_id uuid,
  new_status text,
  new_priority text,
  updated_at timestamptz
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'pg_catalog', 'rebuild_v2', 'rebuild_v2_private', 'auth'
SET row_security TO 'off'
AS $function$
DECLARE
  v_user_id uuid := auth.uid();
  v_is_admin boolean;
  v_ticket rebuild_v2.support_tickets%rowtype;
  v_status_changed boolean;
  v_priority_changed boolean;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'authentication required' USING errcode = '42501';
  END IF;
  IF NOT rebuild_v2_private.has_role(v_user_id, ARRAY['support', 'admin']) THEN
    RAISE EXCEPTION 'Support or Admin role required' USING errcode = '42501';
  END IF;
  IF p_ticket_id IS NULL OR (p_status IS NULL AND p_priority IS NULL)
     OR p_reason IS NULL OR char_length(btrim(p_reason)) NOT BETWEEN 10 AND 1000 THEN
    RAISE EXCEPTION 'ticket id, at least one change, and a 10-1000 character reason are required' USING errcode = '22023';
  END IF;
  IF p_status IS NOT NULL AND p_status NOT IN ('open','in_progress','waiting_for_user','resolved','closed') THEN
    RAISE EXCEPTION 'invalid support ticket status' USING errcode = '22023';
  END IF;
  IF p_priority IS NOT NULL AND p_priority NOT IN ('normal','high','urgent') THEN
    RAISE EXCEPTION 'invalid support ticket priority' USING errcode = '22023';
  END IF;

  v_is_admin := rebuild_v2_private.has_role(v_user_id, ARRAY['admin']);

  SELECT * INTO v_ticket
  FROM rebuild_v2.support_tickets st
  WHERE st.id = p_ticket_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'support ticket not found' USING errcode = 'P0002';
  END IF;

  v_status_changed := p_status IS NOT NULL AND p_status <> v_ticket.status;
  v_priority_changed := p_priority IS NOT NULL AND p_priority <> v_ticket.priority;

  IF NOT v_status_changed AND NOT v_priority_changed THEN
    RAISE EXCEPTION 'no effective support ticket change requested' USING errcode = '22023';
  END IF;

  IF v_ticket.status = 'closed' AND NOT v_is_admin THEN
    RAISE EXCEPTION 'only Admin can change a closed ticket' USING errcode = '42501';
  END IF;

  IF v_status_changed THEN
    IF v_ticket.status = 'open' AND p_status NOT IN ('in_progress','waiting_for_user','resolved','closed') THEN
      RAISE EXCEPTION 'invalid ticket status transition' USING errcode = '22023';
    ELSIF v_ticket.status = 'in_progress' AND p_status NOT IN ('open','waiting_for_user','resolved','closed') THEN
      RAISE EXCEPTION 'invalid ticket status transition' USING errcode = '22023';
    ELSIF v_ticket.status = 'waiting_for_user' AND p_status NOT IN ('in_progress','resolved','closed') THEN
      RAISE EXCEPTION 'invalid ticket status transition' USING errcode = '22023';
    ELSIF v_ticket.status = 'resolved' AND p_status NOT IN ('closed','open','in_progress') THEN
      RAISE EXCEPTION 'invalid resolved ticket transition' USING errcode = '22023';
    ELSIF v_ticket.status = 'resolved' AND p_status IN ('open','in_progress') AND NOT v_is_admin THEN
      RAISE EXCEPTION 'only Admin can reopen a resolved ticket' USING errcode = '42501';
    ELSIF v_ticket.status = 'closed'
      AND (NOT v_is_admin OR p_status <> 'open') THEN
      RAISE EXCEPTION 'only Admin can reopen a closed ticket to open' USING errcode = '42501';
    END IF;
  END IF;

  UPDATE rebuild_v2.support_tickets st
  SET status = CASE WHEN p_status IS NULL THEN st.status ELSE p_status END,
      priority = CASE WHEN p_priority IS NULL THEN st.priority ELSE p_priority END,
      resolved_at = CASE
        WHEN v_status_changed AND p_status IN ('resolved','closed') THEN now()
        WHEN v_status_changed THEN NULL
        ELSE st.resolved_at
      END,
      resolved_by = CASE
        WHEN v_status_changed AND p_status IN ('resolved','closed') THEN v_user_id
        WHEN v_status_changed THEN NULL
        ELSE st.resolved_by
      END,
      updated_at = now()
  WHERE st.id = p_ticket_id;

  IF v_status_changed THEN
    INSERT INTO rebuild_v2.support_ticket_events(
      ticket_id, actor_id, event_type, old_status, new_status
    ) VALUES (
      p_ticket_id, v_user_id, 'status_changed', v_ticket.status, p_status
    );
  END IF;

  IF v_priority_changed THEN
    INSERT INTO rebuild_v2.support_ticket_events(
      ticket_id, actor_id, event_type, old_priority, new_priority
    ) VALUES (
      p_ticket_id, v_user_id, 'priority_changed', v_ticket.priority, p_priority
    );
  END IF;

  INSERT INTO rebuild_v2.audit_events(
    actor_id, action, target_type, target_id, reason, metadata
  )
  VALUES (
    v_user_id,
    'support.ticket_updated',
    'support_ticket',
    p_ticket_id,
    btrim(p_reason),
    jsonb_build_object(
      'old_status', v_ticket.status,
      'new_status', CASE WHEN v_status_changed THEN p_status ELSE v_ticket.status END,
      'old_priority', v_ticket.priority,
      'new_priority', CASE WHEN v_priority_changed THEN p_priority ELSE v_ticket.priority END
    )
  );

  RETURN QUERY
  SELECT st.id, st.status, st.priority, st.updated_at
  FROM rebuild_v2.support_tickets st
  WHERE st.id = p_ticket_id;
END;
$function$;

CREATE OR REPLACE FUNCTION rebuild_v2.update_support_ticket(
  p_ticket_id uuid,
  p_status text,
  p_priority text,
  p_reason text
)
RETURNS TABLE(
  ticket_id uuid,
  new_status text,
  new_priority text,
  updated_at timestamptz
)
LANGUAGE sql
SECURITY INVOKER
SET search_path TO ''
AS $function$
  SELECT * FROM rebuild_v2_private.update_support_ticket_impl(
    p_ticket_id, p_status, p_priority, p_reason
  );
$function$;

REVOKE ALL ON FUNCTION rebuild_v2_private.send_support_message_impl(uuid, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION rebuild_v2_private.update_support_ticket_impl(uuid, text, text, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION rebuild_v2.send_support_message(uuid, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION rebuild_v2.update_support_ticket(uuid, text, text, text) FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION rebuild_v2_private.send_support_message_impl(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION rebuild_v2_private.update_support_ticket_impl(uuid, text, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION rebuild_v2.send_support_message(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION rebuild_v2.update_support_ticket(uuid, text, text, text) TO authenticated;
