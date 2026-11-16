-- Verify final-submission evidence ownership and object metadata before completion.
CREATE OR REPLACE FUNCTION rebuild_v2_private.finalize_assignment_submission_impl(
  p_submission_id uuid
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
SET row_security TO 'off'
AS $function$
DECLARE
  v_user_id uuid := (SELECT auth.uid());
  v_submission rebuild_v2.assignment_submissions%ROWTYPE;
  v_assignment rebuild_v2.assignments%ROWTYPE;
  v_count integer;
  v_verified integer;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'AUTH_REQUIRED' USING errcode = '28000';
  END IF;

  SELECT * INTO v_submission
  FROM rebuild_v2.assignment_submissions s
  WHERE s.id = p_submission_id
  FOR UPDATE;
  IF NOT FOUND OR v_submission.tester_id <> v_user_id THEN
    RAISE EXCEPTION 'SUBMISSION_NOT_FOUND' USING errcode = '42501';
  END IF;
  IF v_submission.status = 'submitted' THEN
    RETURN true;
  END IF;

  SELECT * INTO v_assignment
  FROM rebuild_v2.assignments a
  WHERE a.id = v_submission.assignment_id
  FOR UPDATE;
  IF v_assignment.tester_id <> v_user_id OR v_assignment.status <> 'active' THEN
    RAISE EXCEPTION 'ASSIGNMENT_NOT_ACTIVE' USING errcode = '55000';
  END IF;

  SELECT count(*)::integer INTO v_count
  FROM rebuild_v2.assignment_submission_attachments a
  WHERE a.submission_id = p_submission_id;

  SELECT count(*)::integer INTO v_verified
  FROM rebuild_v2.assignment_submission_attachments a
  JOIN storage.objects o
    ON o.bucket_id = 'test-evidence'
   AND o.name = a.storage_path
   AND o.owner_id = a.tester_id::text
   AND o.metadata->>'size' = a.size_bytes::text
   AND o.metadata->>'mimetype' = a.mime_type
  WHERE a.submission_id = p_submission_id;

  IF v_count <> v_verified THEN
    RAISE EXCEPTION 'ATTACHMENT_UPLOAD_INCOMPLETE' USING errcode = '55000';
  END IF;

  UPDATE rebuild_v2.assignment_submissions
  SET status = 'submitted', submitted_at = now(), updated_at = now()
  WHERE id = p_submission_id;

  UPDATE rebuild_v2.assignments
  SET status = 'completed', completed_at = COALESCE(completed_at, now())
  WHERE id = v_submission.assignment_id;

  RETURN true;
END;
$function$;
