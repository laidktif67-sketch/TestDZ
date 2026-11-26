-- Require a pre-registered report attachment row before allowing an incident-report
-- object upload. Assignment-submission evidence remains unchanged.
-- Candidate-only migration; replayed only on disposable local Supabase.
BEGIN;

CREATE OR REPLACE FUNCTION rebuild_v2_private.can_upload_test_evidence(p_object_name text)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO ''
SET row_security TO 'off'
AS $function$
DECLARE
  v_test_id uuid;
  v_tester_id uuid;
  v_parent_id uuid;
  v_file_id uuid;
  v_file_extension text;
BEGIN
  -- Report evidence uses the v2/ prefix; submission evidence retains the
  -- original four-segment path emitted by register_assignment_submission_attachment.
  IF (SELECT auth.uid()) IS NULL OR p_object_name IS NULL
     OR p_object_name !~* '^(v2/)?[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}[.](png|jpg|jpeg|webp|txt|pdf|zip)

  -- Incident-report evidence is uploadable only after a trusted intake RPC has
  -- registered the exact file ID, extension, owner, assignment and object path.
  RETURN EXISTS (
    SELECT 1
    FROM rebuild_v2.report_attachments ra
    JOIN rebuild_v2.reports r ON r.id = ra.report_id
    JOIN rebuild_v2.assignments a ON a.id = ra.assignment_id
    WHERE split_part(p_object_name,'/',1) = 'v2'
      AND ra.storage_path = p_object_name
      AND ra.report_id = v_parent_id
      AND ra.assignment_id = a.id
      AND ra.test_id = v_test_id
      AND ra.tester_id = v_tester_id
      AND ra.file_id = v_file_id
      AND ra.file_extension = v_file_extension
      AND r.id = v_parent_id
      AND r.reporter_id = (SELECT auth.uid())
      AND r.assignment_id = a.id
      AND r.status = 'open'
      AND a.tester_id = (SELECT auth.uid())
      AND a.tester_id = v_tester_id
      AND a.test_id = v_test_id
      AND a.status = 'active'
  ) OR EXISTS (
    -- Keep the already-implemented V2 assignment-submission upload contract.
    SELECT 1
    FROM rebuild_v2.assignment_submission_attachments sa
    JOIN rebuild_v2.assignment_submissions s ON s.id = sa.submission_id
    JOIN rebuild_v2.assignments a ON a.id = s.assignment_id
    WHERE split_part(p_object_name,'/',1) <> 'v2'
      AND sa.storage_path = p_object_name
      AND sa.test_id = v_test_id
      AND sa.tester_id = v_tester_id
      AND sa.submission_id = v_parent_id
      AND s.status = 'draft'
      AND a.status = 'active'
      AND a.tester_id = (SELECT auth.uid())
  );
EXCEPTION WHEN invalid_text_representation THEN
  RETURN false;
END;
$function$;

REVOKE ALL ON FUNCTION rebuild_v2_private.can_upload_test_evidence(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION rebuild_v2_private.can_upload_test_evidence(text) TO authenticated;

COMMIT;
 THEN
    RETURN false;
  END IF;

  IF split_part(p_object_name,'/',1) = 'v2' THEN
    v_test_id := split_part(p_object_name,'/',2)::uuid;
    v_tester_id := split_part(p_object_name,'/',3)::uuid;
    v_parent_id := split_part(p_object_name,'/',4)::uuid;
    v_file_id := split_part(split_part(p_object_name,'/',5),'.',1)::uuid;
    v_file_extension := split_part(split_part(p_object_name,'/',5),'.',2);
  ELSE
    v_test_id := split_part(p_object_name,'/',1)::uuid;
    v_tester_id := split_part(p_object_name,'/',2)::uuid;
    v_parent_id := split_part(p_object_name,'/',3)::uuid;
    v_file_id := split_part(split_part(p_object_name,'/',4),'.',1)::uuid;
    v_file_extension := split_part(split_part(p_object_name,'/',4),'.',2);
  END IF;

  -- Incident-report evidence is uploadable only after a trusted intake RPC has
  -- registered the exact file ID, extension, owner, assignment and object path.
  RETURN EXISTS (
    SELECT 1
    FROM rebuild_v2.report_attachments ra
    JOIN rebuild_v2.reports r ON r.id = ra.report_id
    JOIN rebuild_v2.assignments a ON a.id = ra.assignment_id
    WHERE ra.storage_path = p_object_name
      AND ra.report_id = v_parent_id
      AND ra.assignment_id = a.id
      AND ra.test_id = v_test_id
      AND ra.tester_id = v_tester_id
      AND ra.file_id = v_file_id
      AND ra.file_extension = v_file_extension
      AND r.id = v_parent_id
      AND r.reporter_id = (SELECT auth.uid())
      AND r.assignment_id = a.id
      AND r.status = 'open'
      AND a.tester_id = (SELECT auth.uid())
      AND a.tester_id = v_tester_id
      AND a.test_id = v_test_id
      AND a.status = 'active'
  ) OR EXISTS (
    -- Keep the already-implemented V2 assignment-submission upload contract.
    SELECT 1
    FROM rebuild_v2.assignment_submission_attachments sa
    JOIN rebuild_v2.assignment_submissions s ON s.id = sa.submission_id
    JOIN rebuild_v2.assignments a ON a.id = s.assignment_id
    WHERE sa.storage_path = p_object_name
      AND sa.test_id = v_test_id
      AND sa.tester_id = v_tester_id
      AND sa.submission_id = v_parent_id
      AND s.status = 'draft'
      AND a.status = 'active'
      AND a.tester_id = (SELECT auth.uid())
  );
EXCEPTION WHEN invalid_text_representation THEN
  RETURN false;
END;
$function$;

REVOKE ALL ON FUNCTION rebuild_v2_private.can_upload_test_evidence(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION rebuild_v2_private.can_upload_test_evidence(text) TO authenticated;

COMMIT;
