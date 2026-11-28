-- Remove Support access to raw tester assignment submissions and their evidence.
-- Support retains access to report evidence through the v2/<test>/<tester>/<report>/<file> path.
-- Candidate-only migration; validate on an isolated local database before merge.
BEGIN;

DROP POLICY IF EXISTS assignment_submissions_select_participants_v2
  ON rebuild_v2.assignment_submissions;
CREATE POLICY assignment_submissions_select_participants_v2
ON rebuild_v2.assignment_submissions
FOR SELECT TO authenticated
USING (
  tester_id = (SELECT auth.uid())
  OR rebuild_v2_private.has_role((SELECT auth.uid()), ARRAY['admin'])
  OR EXISTS (
    SELECT 1 FROM rebuild_v2.tests t
    WHERE t.id = assignment_submissions.test_id
      AND t.developer_id = (SELECT auth.uid())
  )
);

DROP POLICY IF EXISTS assignment_submission_attachments_select_participants_v2
  ON rebuild_v2.assignment_submission_attachments;
CREATE POLICY assignment_submission_attachments_select_participants_v2
ON rebuild_v2.assignment_submission_attachments
FOR SELECT TO authenticated
USING (
  tester_id = (SELECT auth.uid())
  OR rebuild_v2_private.has_role((SELECT auth.uid()), ARRAY['admin'])
  OR EXISTS (
    SELECT 1 FROM rebuild_v2.tests t
    WHERE t.id = assignment_submission_attachments.test_id
      AND t.developer_id = (SELECT auth.uid())
  )
);

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
     OR p_object_name !~* '^(v2/)?[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/[0-9a-f]{8}-[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}[.](png|jpg|jpeg|webp|txt|pdf|zip)$' THEN
    RETURN false;
  END IF;

  IF split_part(p_object_name,'/',1) = 'v2' THEN
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
    );
  END IF;

  v_test_id := split_part(p_object_name,'/',1)::uuid;
  v_tester_id := split_part(p_object_name,'/',2)::uuid;
  v_parent_id := split_part(p_object_name,'/',3)::uuid;

  RETURN EXISTS (
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
        OR rebuild_v2_private.has_role((SELECT auth.uid()), ARRAY['admin'])
      )
  );
EXCEPTION WHEN invalid_text_representation THEN
  RETURN false;
END;
$function$;

COMMIT;
