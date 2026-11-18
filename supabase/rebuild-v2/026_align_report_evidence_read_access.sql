-- Align incident-report evidence reads with the report row visibility policy.
-- Reporters and Support/Admin staff may read report evidence; the related
-- Developer is not granted report access by the reports table policy.
-- Assignment-submission evidence retains its existing participant rules.
-- Candidate-only migration; replayed only on disposable local Supabase.
BEGIN;

CREATE OR REPLACE FUNCTION rebuild_v2_private.can_read_test_evidence(p_object_name text)
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
BEGIN
  IF (SELECT auth.uid()) IS NULL OR p_object_name IS NULL
     OR p_object_name !~* '^v2/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}[.](png|jpg|jpeg|webp|txt|pdf|zip)$' THEN
    RETURN false;
  END IF;

  v_test_id := split_part(p_object_name,'/',2)::uuid;
  v_tester_id := split_part(p_object_name,'/',3)::uuid;
  v_parent_id := split_part(p_object_name,'/',4)::uuid;

  RETURN EXISTS (
    SELECT 1
    FROM rebuild_v2.report_attachments ra
    JOIN rebuild_v2.reports r ON r.id = ra.report_id
    JOIN rebuild_v2.assignments a ON a.id = r.assignment_id
    WHERE ra.storage_path = p_object_name
      AND ra.report_id = v_parent_id
      AND ra.test_id = v_test_id
      AND ra.tester_id = v_tester_id
      AND a.tester_id = v_tester_id
      AND a.test_id = v_test_id
      AND (
        r.reporter_id = (SELECT auth.uid())
        OR rebuild_v2_private.has_role((SELECT auth.uid()), ARRAY['admin','support'])
      )
  ) OR EXISTS (
    SELECT 1
    FROM rebuild_v2.assignment_submission_attachments sa
    JOIN rebuild_v2.assignment_submissions s ON s.id = sa.submission_id
    JOIN rebuild_v2.assignments a ON a.id = s.assignment_id
    JOIN rebuild_v2.tests t ON t.id = s.test_id
    WHERE sa.storage_path = p_object_name
      AND sa.submission_id = v_parent_id
      AND sa.test_id = v_test_id
      AND sa.tester_id = v_tester_id
      AND (
        s.tester_id = (SELECT auth.uid())
        OR t.developer_id = (SELECT auth.uid())
        OR rebuild_v2_private.has_role((SELECT auth.uid()), ARRAY['admin','support'])
      )
  );
EXCEPTION WHEN invalid_text_representation THEN
  RETURN false;
END;
$function$;

COMMIT;
