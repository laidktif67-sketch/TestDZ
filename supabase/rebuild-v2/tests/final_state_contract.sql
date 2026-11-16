-- Final-state contract for the complete 18-script rebuild_v2 candidate.
-- Run only after 001_schema.sql through 018_verify_submission_evidence_metadata.sql.
-- Read-only: this contract does not create or modify application data.

DO $contract$
DECLARE
  v_tables integer;
  v_rls_tables integer;
  v_policy_tables integer;
  v_buckets integer;
BEGIN
  SELECT count(*) INTO v_tables
  FROM pg_class c
  JOIN pg_namespace n ON n.oid = c.relnamespace
  WHERE n.nspname = 'rebuild_v2' AND c.relkind = 'r';

  IF v_tables <> 47 THEN
    RAISE EXCEPTION 'expected 47 rebuild_v2 tables, got %', v_tables;
  END IF;

  SELECT count(*) INTO v_rls_tables
  FROM pg_class c
  JOIN pg_namespace n ON n.oid = c.relnamespace
  WHERE n.nspname = 'rebuild_v2'
    AND c.relkind = 'r'
    AND c.relrowsecurity
    AND c.relforcerowsecurity;

  IF v_rls_tables <> 47 THEN
    RAISE EXCEPTION 'expected RLS and FORCE RLS on all 47 tables, got %', v_rls_tables;
  END IF;

  SELECT count(DISTINCT tablename) INTO v_policy_tables
  FROM pg_policies
  WHERE schemaname = 'rebuild_v2';

  IF v_policy_tables <> 47 THEN
    RAISE EXCEPTION 'expected policy coverage for all 47 tables, got %', v_policy_tables;
  END IF;

  SELECT count(*) INTO v_buckets
  FROM storage.buckets
  WHERE id IN (
    'avatars',
    'app-icons',
    'developer-feedback-attachments',
    'support-attachments',
    'test-evidence',
    'test-builds',
    'test-assets'
  );

  IF v_buckets <> 7 THEN
    RAISE EXCEPTION 'expected seven candidate Storage buckets, got %', v_buckets;
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conrelid = 'rebuild_v2.user_roles'::regclass
      AND conname = 'user_roles_role_check'
      AND pg_get_constraintdef(oid) LIKE '%financial%'
  ) THEN
    RAISE EXCEPTION 'Financial role is missing from the user_roles role constraint';
  END IF;

  IF to_regprocedure('rebuild_v2.start_assignment(uuid)') IS NULL
     OR to_regprocedure('rebuild_v2.finalize_assignment_submission(uuid)') IS NULL THEN
    RAISE EXCEPTION 'final assignment schedule/evidence RPC wrappers are missing';
  END IF;
END;
$contract$;

SELECT 'rebuild_v2_final_state_contract: PASS' AS result;
