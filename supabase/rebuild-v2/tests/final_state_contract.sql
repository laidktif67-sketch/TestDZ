-- Final-state contract for the curated rebuild_v2 candidate.
-- Run after all numbered candidate scripts.
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

  IF v_tables <> 49 THEN
    RAISE EXCEPTION 'expected 49 rebuild_v2 tables, got %', v_tables;
  END IF;

  SELECT count(*) INTO v_rls_tables
  FROM pg_class c
  JOIN pg_namespace n ON n.oid = c.relnamespace
  WHERE n.nspname = 'rebuild_v2'
    AND c.relkind = 'r'
    AND c.relrowsecurity
    AND c.relforcerowsecurity;

  IF v_rls_tables <> 49 THEN
    RAISE EXCEPTION 'expected RLS and FORCE RLS on all 49 tables, got %', v_rls_tables;
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
    'test-assets',
    'medical-exception-evidence'
  );

  IF v_buckets <> 8 THEN
    RAISE EXCEPTION 'expected eight candidate Storage buckets, got %', v_buckets;
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema='rebuild_v2'
      AND table_name='notifications'
      AND column_name='recipient_role'
      AND is_nullable='NO'
  ) OR NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conrelid='rebuild_v2.notifications'::regclass
      AND conname='notifications_recipient_role_check'
  ) THEN
    RAISE EXCEPTION 'role-separated notification recipient contract is missing';
  END IF;

  IF to_regprocedure('rebuild_v2.mark_notification_read(uuid,text)') IS NULL
     OR to_regprocedure('rebuild_v2.mark_all_notifications_read(text)') IS NULL THEN
    RAISE EXCEPTION 'role-scoped notification read RPCs are missing';
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

  IF to_regprocedure('rebuild_v2.process_assignment_review_deadlines(integer)') IS NULL THEN
    RAISE EXCEPTION 'service-only assignment review deadline processor is missing';
  END IF;

  IF to_regprocedure('rebuild_v2.revise_tester_feedback(uuid,text,text,smallint)') IS NULL THEN
    RAISE EXCEPTION 'tester feedback quality revision RPC is missing';
  END IF;

  IF to_regprocedure('rebuild_v2_private.assignment_has_14_valid_checkins(uuid)') IS NULL
     OR to_regprocedure('rebuild_v2_private.assignment_submission_prerequisites_met(uuid)') IS NULL THEN
    RAISE EXCEPTION '14-day check-in or shared submission prerequisite evaluator is missing';
  END IF;

  IF to_regprocedure('rebuild_v2.create_medical_exception_request(uuid,text,date[])') IS NULL
     OR to_regprocedure('rebuild_v2.attach_medical_exception_evidence(uuid,text)') IS NULL
     OR to_regprocedure('rebuild_v2.review_medical_exception(uuid,text,text)') IS NULL
     OR to_regprocedure('rebuild_v2.review_feedback_quality(uuid,text,text)') IS NULL THEN
    RAISE EXCEPTION 'medical exception or feedback quality review RPCs are missing';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid='rebuild_v2.feedback'::regclass
      AND conname='feedback_quality_review_metadata_check'
  ) THEN
    RAISE EXCEPTION 'feedback quality review metadata invariant is missing';
  END IF;
END;
$contract$;

SELECT 'rebuild_v2_final_state_contract: PASS' AS result;
