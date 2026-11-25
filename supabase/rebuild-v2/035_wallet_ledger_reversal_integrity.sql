-- V2 wallet reversal integrity hardening.
-- Apply only after 001..034 on a clean, disposable database.
-- Existing reversal rows without an explicit original are rejected; no linkage is guessed.

ALTER TABLE rebuild_v2.wallet_ledger
  ADD COLUMN reversal_of uuid;

ALTER TABLE rebuild_v2.wallet_ledger
  ADD CONSTRAINT wallet_ledger_reversal_of_fkey
  FOREIGN KEY (reversal_of)
  REFERENCES rebuild_v2.wallet_ledger(id)
  ON DELETE RESTRICT;

ALTER TABLE rebuild_v2.wallet_ledger
  ADD CONSTRAINT wallet_ledger_reversal_shape_check
  CHECK (
    (entry_type = 'reversal' AND reversal_of IS NOT NULL)
    OR
    (entry_type <> 'reversal' AND reversal_of IS NULL)
  ) NOT VALID;

-- Fail closed if historical reversal rows cannot be linked explicitly.
ALTER TABLE rebuild_v2.wallet_ledger
  VALIDATE CONSTRAINT wallet_ledger_reversal_shape_check;

CREATE UNIQUE INDEX wallet_ledger_one_reversal_per_original_idx
  ON rebuild_v2.wallet_ledger(reversal_of)
  WHERE reversal_of IS NOT NULL;

CREATE INDEX wallet_ledger_reversal_of_idx
  ON rebuild_v2.wallet_ledger(reversal_of)
  WHERE reversal_of IS NOT NULL;

CREATE OR REPLACE FUNCTION rebuild_v2_private.enforce_wallet_reversal_integrity()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path TO 'pg_catalog', 'rebuild_v2'
AS $function$
DECLARE
  v_original rebuild_v2.wallet_ledger%ROWTYPE;
BEGIN
  IF NEW.entry_type <> 'reversal' THEN
    IF NEW.reversal_of IS NOT NULL THEN
      RAISE EXCEPTION 'reversal_of is only valid for reversal entries'
        USING ERRCODE = '23514';
    END IF;
    RETURN NEW;
  END IF;

  IF NEW.reversal_of IS NULL THEN
    RAISE EXCEPTION 'reversal requires an original ledger entry'
      USING ERRCODE = '23514';
  END IF;

  SELECT *
    INTO v_original
    FROM rebuild_v2.wallet_ledger
   WHERE id = NEW.reversal_of
   FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'original ledger entry not found'
      USING ERRCODE = '23503';
  END IF;

  IF v_original.entry_type = 'reversal' THEN
    RAISE EXCEPTION 'a reversal cannot reverse another reversal'
      USING ERRCODE = '23514';
  END IF;

  IF NEW.user_id IS DISTINCT FROM v_original.user_id THEN
    RAISE EXCEPTION 'reversal user must match original ledger user'
      USING ERRCODE = '23514';
  END IF;

  IF NEW.wallet_type IS DISTINCT FROM v_original.wallet_type THEN
    RAISE EXCEPTION 'reversal wallet type must match original ledger wallet type'
      USING ERRCODE = '23514';
  END IF;

  IF NEW.amount::numeric IS DISTINCT FROM (-v_original.amount::numeric) THEN
    RAISE EXCEPTION 'reversal amount must be the exact opposite of original amount'
      USING ERRCODE = '23514';
  END IF;

  RETURN NEW;
END;
$function$;

CREATE TRIGGER wallet_ledger_reversal_integrity_v2
BEFORE INSERT ON rebuild_v2.wallet_ledger
FOR EACH ROW
EXECUTE FUNCTION rebuild_v2_private.enforce_wallet_reversal_integrity();

-- Replace the old 8-argument function. Keeping both overloads would make
-- calls with defaults ambiguous and could preserve the unsafe reversal path.
DROP FUNCTION rebuild_v2_private.post_wallet_entry(uuid,text,bigint,text,text,text,text,uuid);

CREATE FUNCTION rebuild_v2_private.post_wallet_entry(
  p_user_id uuid,
  p_wallet_type text,
  p_amount bigint,
  p_entry_type text,
  p_idempotency_key text,
  p_reason text,
  p_reference_type text DEFAULT NULL::text,
  p_reference_id uuid DEFAULT NULL::uuid,
  p_reversal_of uuid DEFAULT NULL::uuid
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'pg_catalog', 'rebuild_v2', 'rebuild_v2_private'
SET row_security TO 'off'
AS $function$
DECLARE
  v_actor uuid := auth.uid();
  v_entry_id uuid;
  v_existing rebuild_v2.wallet_ledger%ROWTYPE;
  v_original rebuild_v2.wallet_ledger%ROWTYPE;
  v_already_reversed uuid;
  v_current bigint;
BEGIN
  -- This authorization check is always enforced, including for Admin.
  IF v_actor IS NULL
     OR NOT rebuild_v2_private.has_role(v_actor, ARRAY['admin','financial']) THEN
    RAISE EXCEPTION 'forbidden: financial role required' USING ERRCODE = '42501';
  END IF;

  IF p_user_id IS NULL
     OR p_wallet_type IS NULL
     OR p_wallet_type NOT IN ('earned_points','purchased_credits')
     OR p_amount IS NULL
     OR p_amount = 0
     OR p_entry_type IS NULL
     OR p_entry_type NOT IN ('reward','purchase','refund','adjustment','reversal','payout') THEN
    RAISE EXCEPTION 'invalid wallet entry';
  END IF;

  IF p_idempotency_key IS NULL OR char_length(p_idempotency_key) NOT BETWEEN 10 AND 160 THEN
    RAISE EXCEPTION 'invalid idempotency key';
  END IF;

  IF p_reason IS NULL OR char_length(btrim(p_reason)) < 10 OR char_length(p_reason) > 1000 THEN
    RAISE EXCEPTION 'a reason between 10 and 1000 characters is required';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM rebuild_v2.profiles WHERE id = p_user_id) THEN
    RAISE EXCEPTION 'target profile does not exist';
  END IF;

  IF (p_entry_type = 'reversal') IS DISTINCT FROM (p_reversal_of IS NOT NULL) THEN
    RAISE EXCEPTION 'reversal entries require reversal_of; other entries must not set it'
      USING ERRCODE = '23514';
  END IF;

  -- Idempotent retry is checked before current reversal state. Exact retries
  -- return the original result even though that original is now reversed.
  SELECT *
    INTO v_existing
    FROM rebuild_v2.wallet_ledger
   WHERE idempotency_key = p_idempotency_key;

  IF FOUND THEN
    IF v_existing.user_id IS DISTINCT FROM p_user_id
       OR v_existing.wallet_type IS DISTINCT FROM p_wallet_type
       OR v_existing.amount IS DISTINCT FROM p_amount
       OR v_existing.entry_type IS DISTINCT FROM p_entry_type
       OR v_existing.reference_type IS DISTINCT FROM p_reference_type
       OR v_existing.reference_id IS DISTINCT FROM p_reference_id
       OR v_existing.reversal_of IS DISTINCT FROM p_reversal_of
       OR v_existing.actor_id IS DISTINCT FROM v_actor
       OR v_existing.reason IS DISTINCT FROM p_reason THEN
      RAISE EXCEPTION 'idempotency key already used for a different operation';
    END IF;
    RETURN v_existing.id;
  END IF;

  -- Lock and validate the original before locking the wallet. Every caller,
  -- including Admin, follows the same checks. The row lock serializes
  -- different idempotency keys attempting to reverse the same movement.
  IF p_entry_type = 'reversal' THEN
    SELECT *
      INTO v_original
      FROM rebuild_v2.wallet_ledger
     WHERE id = p_reversal_of
     FOR UPDATE;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'original ledger entry not found';
    END IF;

    IF v_original.entry_type = 'reversal' THEN
      RAISE EXCEPTION 'a reversal cannot reverse another reversal';
    END IF;

    IF v_original.user_id IS DISTINCT FROM p_user_id THEN
      RAISE EXCEPTION 'reversal user does not match original ledger user';
    END IF;

    IF v_original.wallet_type IS DISTINCT FROM p_wallet_type THEN
      RAISE EXCEPTION 'reversal wallet type does not match original ledger wallet type';
    END IF;

    IF p_amount::numeric IS DISTINCT FROM (-v_original.amount::numeric) THEN
      RAISE EXCEPTION 'reversal amount must be the exact opposite of original amount';
    END IF;

    SELECT id
      INTO v_already_reversed
      FROM rebuild_v2.wallet_ledger
     WHERE reversal_of = p_reversal_of
     LIMIT 1;

    IF FOUND THEN
      RAISE EXCEPTION 'original ledger entry has already been reversed';
    END IF;
  END IF;

  INSERT INTO rebuild_v2.wallets(user_id)
  VALUES (p_user_id)
  ON CONFLICT (user_id) DO NOTHING;

  SELECT CASE
           WHEN p_wallet_type = 'earned_points' THEN earned_points
           ELSE purchased_credits
         END
    INTO v_current
    FROM rebuild_v2.wallets
   WHERE user_id = p_user_id
   FOR UPDATE;

  IF v_current::numeric + p_amount::numeric < 0 THEN
    RAISE EXCEPTION 'insufficient wallet balance';
  END IF;

  INSERT INTO rebuild_v2.wallet_ledger(
    user_id, wallet_type, amount, entry_type, reference_type, reference_id,
    idempotency_key, actor_id, reason, reversal_of
  )
  VALUES (
    p_user_id, p_wallet_type, p_amount, p_entry_type, p_reference_type, p_reference_id,
    p_idempotency_key, v_actor, p_reason, p_reversal_of
  )
  ON CONFLICT (idempotency_key) DO NOTHING
  RETURNING id INTO v_entry_id;

  IF v_entry_id IS NULL THEN
    SELECT *
      INTO v_existing
      FROM rebuild_v2.wallet_ledger
     WHERE idempotency_key = p_idempotency_key;

    IF v_existing.user_id IS DISTINCT FROM p_user_id
       OR v_existing.wallet_type IS DISTINCT FROM p_wallet_type
       OR v_existing.amount IS DISTINCT FROM p_amount
       OR v_existing.entry_type IS DISTINCT FROM p_entry_type
       OR v_existing.reference_type IS DISTINCT FROM p_reference_type
       OR v_existing.reference_id IS DISTINCT FROM p_reference_id
       OR v_existing.reversal_of IS DISTINCT FROM p_reversal_of
       OR v_existing.actor_id IS DISTINCT FROM v_actor
       OR v_existing.reason IS DISTINCT FROM p_reason THEN
      RAISE EXCEPTION 'idempotency key already used for a different operation';
    END IF;
    RETURN v_existing.id;
  END IF;

  IF p_wallet_type = 'earned_points' THEN
    UPDATE rebuild_v2.wallets
       SET earned_points = earned_points + p_amount,
           updated_at = now()
     WHERE user_id = p_user_id;
  ELSE
    UPDATE rebuild_v2.wallets
       SET purchased_credits = purchased_credits + p_amount,
           updated_at = now()
     WHERE user_id = p_user_id;
  END IF;

  -- Ledger, balance and audit remain in the same transaction.
  INSERT INTO rebuild_v2.audit_events(
    actor_id, action, target_type, target_id, reason, request_id, metadata
  )
  VALUES (
    v_actor,
    CASE WHEN p_entry_type = 'reversal' THEN 'wallet.entry.reversed' ELSE 'wallet.entry.posted' END,
    'wallet',
    p_user_id,
    p_reason,
    p_idempotency_key,
    jsonb_build_object(
      'entry_id', v_entry_id,
      'wallet_type', p_wallet_type,
      'amount', p_amount,
      'entry_type', p_entry_type,
      'reversal_of', p_reversal_of
    )
  );

  RETURN v_entry_id;
END;
$function$;

REVOKE ALL ON FUNCTION rebuild_v2_private.enforce_wallet_reversal_integrity() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION rebuild_v2_private.post_wallet_entry(uuid,text,bigint,text,text,text,text,uuid,uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION rebuild_v2_private.post_wallet_entry(uuid,text,bigint,text,text,text,text,uuid,uuid) TO authenticated;
