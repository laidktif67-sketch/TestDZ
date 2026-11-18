-- Secure, email-bound Developer invitations for V2 tester enrollment.
-- Candidate only: apply after 031_role_explicit_support_ticket_creation.sql
-- in a disposable local Supabase stack. Never apply to Production without approval.
--
-- The Edge Function generates a random token and supplies only its SHA-256 hash.
-- This SQL never stores or returns the raw token. Email delivery is intentionally
-- outside this migration; the first UI stage is copy-link only.

BEGIN;

CREATE TABLE IF NOT EXISTS rebuild_v2.test_invitations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  test_id uuid NOT NULL,
  developer_id uuid NOT NULL,
  recipient_email text NOT NULL,
  token_hash bytea NOT NULL,
  status text NOT NULL DEFAULT 'pending',
  expires_at timestamptz NOT NULL,
  idempotency_key uuid NOT NULL,
  accepted_by uuid REFERENCES auth.users(id) ON DELETE RESTRICT,
  accepted_at timestamptz,
  revoked_by uuid REFERENCES auth.users(id) ON DELETE RESTRICT,
  revoked_at timestamptz,
  revocation_reason text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT test_invitations_test_owner_fkey
    FOREIGN KEY (test_id, developer_id)
    REFERENCES rebuild_v2.tests(id, developer_id) ON DELETE RESTRICT,
  CONSTRAINT test_invitations_token_hash_key UNIQUE (token_hash),
  CONSTRAINT test_invitations_idempotency_key UNIQUE (developer_id, idempotency_key),
  CONSTRAINT test_invitations_email_check CHECK (
    recipient_email = lower(btrim(recipient_email))
    AND char_length(recipient_email) BETWEEN 6 AND 254
    AND recipient_email ~ '^[^[:space:]@]+@[^[:space:]@]+[.][^[:space:]@]+$'
  ),
  CONSTRAINT test_invitations_token_hash_check CHECK (octet_length(token_hash) = 32),
  CONSTRAINT test_invitations_status_check CHECK (
    (status = 'pending' AND accepted_by IS NULL AND accepted_at IS NULL
      AND revoked_by IS NULL AND revoked_at IS NULL)
    OR (status = 'accepted' AND accepted_by IS NOT NULL AND accepted_at IS NOT NULL
      AND revoked_by IS NULL AND revoked_at IS NULL)
    OR (status = 'revoked' AND accepted_by IS NULL AND accepted_at IS NULL
      AND revoked_by IS NOT NULL AND revoked_at IS NOT NULL
      AND revocation_reason IS NOT NULL)
    OR (status = 'expired' AND accepted_by IS NULL AND accepted_at IS NULL
      AND revoked_by IS NULL AND revoked_at IS NULL)
  ),
  CONSTRAINT test_invitations_revocation_reason_check CHECK (
    revocation_reason IS NULL OR char_length(revocation_reason) BETWEEN 5 AND 500
  )
);

CREATE UNIQUE INDEX IF NOT EXISTS test_invitations_one_pending_per_test_email
  ON rebuild_v2.test_invitations(test_id, recipient_email)
  WHERE status = 'pending';
CREATE INDEX IF NOT EXISTS test_invitations_owner_recent_idx
  ON rebuild_v2.test_invitations(developer_id, created_at DESC);
CREATE INDEX IF NOT EXISTS test_invitations_expiry_idx
  ON rebuild_v2.test_invitations(expires_at)
  WHERE status = 'pending';

ALTER TABLE rebuild_v2.test_invitations ENABLE ROW LEVEL SECURITY;
ALTER TABLE rebuild_v2.test_invitations FORCE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE rebuild_v2.test_invitations FROM PUBLIC, anon, authenticated;

-- Create: authenticated Developer, owned recruiting test, bounded expiry,
-- per-test active-invitation cap, and an idempotency key. No direct table writes.
CREATE OR REPLACE FUNCTION rebuild_v2_private.create_test_invitation_impl(
  p_test_id uuid,
  p_recipient_email text,
  p_token_hash bytea,
  p_expires_at timestamptz,
  p_idempotency_key uuid
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
SET row_security TO 'off'
AS $function$
DECLARE
  v_actor uuid := (SELECT auth.uid());
  v_email text := lower(btrim(p_recipient_email));
  v_existing rebuild_v2.test_invitations%ROWTYPE;
  v_invitation_id uuid;
  v_active_count integer;
BEGIN
  IF v_actor IS NULL THEN
    RAISE EXCEPTION 'AUTH_REQUIRED' USING errcode = '28000';
  END IF;
  IF NOT rebuild_v2_private.has_role(v_actor, ARRAY['developer']) THEN
    RAISE EXCEPTION 'DEVELOPER_ROLE_REQUIRED' USING errcode = '42501';
  END IF;
  IF p_test_id IS NULL OR p_idempotency_key IS NULL
     OR p_token_hash IS NULL OR octet_length(p_token_hash) <> 32
     OR v_email IS NULL OR char_length(v_email) NOT BETWEEN 6 AND 254
     OR v_email !~ '^[^[:space:]@]+@[^[:space:]@]+[.][^[:space:]@]+$'
     OR p_expires_at IS NULL
     OR p_expires_at < now() + interval '1 hour'
     OR p_expires_at > now() + interval '30 days' THEN
    RAISE EXCEPTION 'INVITATION_INPUT_INVALID' USING errcode = '22023';
  END IF;

  PERFORM pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(v_actor::text || ':' || p_test_id::text, 0)
  );

  SELECT * INTO v_existing
  FROM rebuild_v2.test_invitations i
  WHERE i.developer_id = v_actor AND i.idempotency_key = p_idempotency_key
  FOR UPDATE;
  IF FOUND THEN
    IF v_existing.test_id <> p_test_id
       OR v_existing.recipient_email <> v_email
       OR v_existing.token_hash <> p_token_hash THEN
      RAISE EXCEPTION 'INVITATION_IDEMPOTENCY_CONFLICT' USING errcode = '23505';
    END IF;
    RETURN v_existing.id;
  END IF;

  -- Retire expired pending rows before inserting a fresh invitation for the
  -- same test/email; otherwise the partial unique index would block re-invites.
  UPDATE rebuild_v2.test_invitations
  SET status = 'expired', updated_at = now()
  WHERE test_id = p_test_id AND recipient_email = v_email
    AND status = 'pending' AND expires_at <= now();

  IF NOT EXISTS (
    SELECT 1
    FROM rebuild_v2.tests t
    JOIN rebuild_v2.apps a ON a.id = t.app_id AND a.developer_id = t.developer_id
    WHERE t.id = p_test_id AND t.developer_id = v_actor
      AND t.status IN ('recruiting','ready','running')
      AND a.status = 'published'
  ) THEN
    RAISE EXCEPTION 'OWNED_OPEN_TEST_REQUIRED' USING errcode = '42501';
  END IF;

  SELECT count(*)::integer INTO v_active_count
  FROM rebuild_v2.test_invitations i
  WHERE i.test_id = p_test_id AND i.status = 'pending'
    AND i.expires_at > now();
  IF v_active_count >= 50 THEN
    RAISE EXCEPTION 'INVITATION_LIMIT_REACHED' USING errcode = '54000';
  END IF;

  INSERT INTO rebuild_v2.test_invitations(
    test_id, developer_id, recipient_email, token_hash,
    status, expires_at, idempotency_key
  ) VALUES (
    p_test_id, v_actor, v_email, p_token_hash,
    'pending', p_expires_at, p_idempotency_key
  )
  RETURNING id INTO v_invitation_id;

  INSERT INTO rebuild_v2.audit_events(actor_id, action, target_type, target_id, reason, metadata)
  VALUES (
    v_actor, 'test.invitation.created', 'test_invitation', v_invitation_id,
    'Developer created a tester invitation',
    jsonb_build_object('test_id', p_test_id, 'expires_at', p_expires_at)
  );
  RETURN v_invitation_id;
EXCEPTION
  WHEN unique_violation THEN
    RAISE EXCEPTION 'INVITATION_ALREADY_EXISTS_OR_IDEMPOTENCY_CONFLICT'
      USING errcode = '23505';
END;
$function$;

-- Owner-scoped listing returns a masked email only; neither token hash nor
-- full recipient address is exposed to the browser.
CREATE OR REPLACE FUNCTION rebuild_v2_private.list_test_invitations_impl(p_test_id uuid)
RETURNS TABLE (
  invitation_id uuid,
  test_id uuid,
  recipient_email_masked text,
  status text,
  expires_at timestamptz,
  created_at timestamptz
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO ''
SET row_security TO 'off'
AS $function$
DECLARE v_actor uuid := (SELECT auth.uid());
BEGIN
  IF v_actor IS NULL OR NOT rebuild_v2_private.has_role(v_actor, ARRAY['developer']) THEN
    RAISE EXCEPTION 'DEVELOPER_ROLE_REQUIRED' USING errcode = '42501';
  END IF;
  IF p_test_id IS NULL OR NOT EXISTS (
    SELECT 1 FROM rebuild_v2.tests t
    WHERE t.id = p_test_id AND t.developer_id = v_actor
  ) THEN
    RAISE EXCEPTION 'TEST_NOT_FOUND_OR_NOT_OWNED' USING errcode = '42501';
  END IF;

  RETURN QUERY
  SELECT i.id, i.test_id,
    left(split_part(i.recipient_email, '@', 1), 1)
      || '***@' || split_part(i.recipient_email, '@', 2),
    CASE WHEN i.status = 'pending' AND i.expires_at <= now()
      THEN 'expired' ELSE i.status END,
    i.expires_at, i.created_at
  FROM rebuild_v2.test_invitations i
  WHERE i.test_id = p_test_id AND i.developer_id = v_actor
  ORDER BY i.created_at DESC;
END;
$function$;

CREATE OR REPLACE FUNCTION rebuild_v2_private.revoke_test_invitation_impl(
  p_invitation_id uuid,
  p_reason text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
SET row_security TO 'off'
AS $function$
DECLARE
  v_actor uuid := (SELECT auth.uid());
  v_invitation rebuild_v2.test_invitations%ROWTYPE;
BEGIN
  IF v_actor IS NULL THEN
    RAISE EXCEPTION 'AUTH_REQUIRED' USING errcode = '28000';
  END IF;
  IF p_reason IS NULL OR char_length(btrim(p_reason)) NOT BETWEEN 5 AND 500 THEN
    RAISE EXCEPTION 'REVOCATION_REASON_REQUIRED' USING errcode = '22023';
  END IF;

  SELECT * INTO v_invitation
  FROM rebuild_v2.test_invitations i
  WHERE i.id = p_invitation_id
  FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'INVITATION_NOT_FOUND' USING errcode = 'P0002';
  END IF;
  IF v_invitation.developer_id <> v_actor
     AND NOT rebuild_v2_private.has_role(v_actor, ARRAY['admin']) THEN
    RAISE EXCEPTION 'INVITATION_FORBIDDEN' USING errcode = '42501';
  END IF;
  IF v_invitation.status <> 'pending' THEN
    RAISE EXCEPTION 'INVITATION_NOT_PENDING' USING errcode = '55000';
  END IF;

  UPDATE rebuild_v2.test_invitations
  SET status = 'revoked', revoked_by = v_actor, revoked_at = now(),
      revocation_reason = btrim(p_reason), updated_at = now()
  WHERE id = p_invitation_id;

  INSERT INTO rebuild_v2.audit_events(actor_id, action, target_type, target_id, reason, metadata)
  VALUES (
    v_actor, 'test.invitation.revoked', 'test_invitation', p_invitation_id,
    btrim(p_reason), jsonb_build_object('test_id', v_invitation.test_id)
  );
END;
$function$;

-- Redemption uses the authenticated account's confirmed Auth email and calls
-- the exact existing private join implementation in the same transaction.
CREATE OR REPLACE FUNCTION rebuild_v2_private.redeem_test_invitation_impl(p_token_hash bytea)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
SET row_security TO 'off'
AS $function$
DECLARE
  v_actor uuid := (SELECT auth.uid());
  v_auth_email text;
  v_invitation rebuild_v2.test_invitations%ROWTYPE;
  v_assignment_id uuid;
BEGIN
  IF v_actor IS NULL THEN
    RAISE EXCEPTION 'AUTH_REQUIRED' USING errcode = '28000';
  END IF;
  IF p_token_hash IS NULL OR octet_length(p_token_hash) <> 32 THEN
    RAISE EXCEPTION 'INVITATION_INVALID' USING errcode = '22023';
  END IF;
  IF NOT rebuild_v2_private.has_role(v_actor, ARRAY['tester']) THEN
    RAISE EXCEPTION 'TESTER_ROLE_REQUIRED' USING errcode = '42501';
  END IF;

  SELECT lower(u.email) INTO v_auth_email
  FROM auth.users u
  WHERE u.id = v_actor AND u.email_confirmed_at IS NOT NULL
    AND u.email IS NOT NULL;
  IF v_auth_email IS NULL THEN
    RAISE EXCEPTION 'CONFIRMED_EMAIL_REQUIRED' USING errcode = '42501';
  END IF;

  SELECT * INTO v_invitation
  FROM rebuild_v2.test_invitations i
  WHERE i.token_hash = p_token_hash
  FOR UPDATE;
  IF NOT FOUND OR v_invitation.status <> 'pending'
     OR v_invitation.expires_at <= now()
     OR v_invitation.recipient_email <> v_auth_email THEN
    RAISE EXCEPTION 'INVITATION_INVALID_OR_UNAVAILABLE' USING errcode = '42501';
  END IF;

  v_assignment_id := rebuild_v2_private.join_test_impl(v_invitation.test_id);

  UPDATE rebuild_v2.test_invitations
  SET status = 'accepted', accepted_by = v_actor, accepted_at = now(),
      updated_at = now()
  WHERE id = v_invitation.id AND status = 'pending';
  IF NOT FOUND THEN
    RAISE EXCEPTION 'INVITATION_STATE_CHANGED' USING errcode = '40001';
  END IF;

  INSERT INTO rebuild_v2.audit_events(actor_id, action, target_type, target_id, reason, metadata)
  VALUES (
    v_actor, 'test.invitation.accepted', 'test_invitation', v_invitation.id,
    'Tester redeemed an email-bound invitation',
    jsonb_build_object('test_id', v_invitation.test_id, 'assignment_id', v_assignment_id)
  );
  RETURN v_assignment_id;
END;
$function$;

-- Narrow public-schema wrappers. All authorization and mutation remain private.
CREATE OR REPLACE FUNCTION rebuild_v2.create_test_invitation(
  p_test_id uuid, p_recipient_email text, p_token_hash bytea,
  p_expires_at timestamptz, p_idempotency_key uuid
)
RETURNS uuid LANGUAGE sql SECURITY INVOKER SET search_path TO ''
AS $function$
  SELECT rebuild_v2_private.create_test_invitation_impl(
    p_test_id, p_recipient_email, p_token_hash, p_expires_at, p_idempotency_key
  );
$function$;

CREATE OR REPLACE FUNCTION rebuild_v2.list_test_invitations(p_test_id uuid)
RETURNS TABLE (
  invitation_id uuid, test_id uuid, recipient_email_masked text,
  status text, expires_at timestamptz, created_at timestamptz
)
LANGUAGE sql STABLE SECURITY INVOKER SET search_path TO ''
AS $function$
  SELECT * FROM rebuild_v2_private.list_test_invitations_impl(p_test_id);
$function$;

CREATE OR REPLACE FUNCTION rebuild_v2.revoke_test_invitation(p_invitation_id uuid, p_reason text)
RETURNS void LANGUAGE sql SECURITY INVOKER SET search_path TO ''
AS $function$
  SELECT rebuild_v2_private.revoke_test_invitation_impl(p_invitation_id, p_reason);
$function$;

CREATE OR REPLACE FUNCTION rebuild_v2.redeem_test_invitation(p_token_hash bytea)
RETURNS uuid LANGUAGE sql SECURITY INVOKER SET search_path TO ''
AS $function$
  SELECT rebuild_v2_private.redeem_test_invitation_impl(p_token_hash);
$function$;

REVOKE ALL ON FUNCTION rebuild_v2_private.create_test_invitation_impl(uuid,text,bytea,timestamptz,uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION rebuild_v2_private.list_test_invitations_impl(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION rebuild_v2_private.revoke_test_invitation_impl(uuid,text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION rebuild_v2_private.redeem_test_invitation_impl(bytea) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION rebuild_v2.create_test_invitation(uuid,text,bytea,timestamptz,uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION rebuild_v2.list_test_invitations(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION rebuild_v2.revoke_test_invitation(uuid,text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION rebuild_v2.redeem_test_invitation(bytea) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION rebuild_v2_private.create_test_invitation_impl(uuid,text,bytea,timestamptz,uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION rebuild_v2_private.list_test_invitations_impl(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION rebuild_v2_private.revoke_test_invitation_impl(uuid,text) TO authenticated;
GRANT EXECUTE ON FUNCTION rebuild_v2_private.redeem_test_invitation_impl(bytea) TO authenticated;
GRANT EXECUTE ON FUNCTION rebuild_v2.create_test_invitation(uuid,text,bytea,timestamptz,uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION rebuild_v2.list_test_invitations(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION rebuild_v2.revoke_test_invitation(uuid,text) TO authenticated;
GRANT EXECUTE ON FUNCTION rebuild_v2.redeem_test_invitation(bytea) TO authenticated;

COMMIT;
