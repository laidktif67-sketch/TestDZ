-- TestDZ V2 tester workflow RPCs and final assignment submission model.
-- Candidate only: apply after 001_schema.sql through 006_storage_policies.sql
-- in TestDZ-FixLab or another disposable isolated database.
-- DO NOT place in supabase/migrations or apply to Production without a separate approval.
--
-- Security model:
--   * authenticated users receive EXECUTE only on narrow public RPC wrappers;
--   * private implementations derive actor identity from auth.uid();
--   * no direct client INSERT/UPDATE/DELETE grants are added;
--   * tester points/rewards and cash withdrawals are deliberately excluded.
--
-- Final submission evidence reuses the private test-evidence bucket and existing
-- storage INSERT/SELECT policies. Its object path is:
--   v2/<test_id>/<tester_id>/<submission_id>/<file_id>.<extension>
-- Legacy public incident-report paths remain unprefixed and are authorized only
-- by the legacy Storage policies; V2 helpers reject unprefixed paths.

BEGIN;

-- All user-facing calendar dates follow Algeria local time, not the database
-- session timezone (which may be UTC). Keep the instant injectable for
-- deterministic midnight-boundary regression tests.
CREATE OR REPLACE FUNCTION rebuild_v2_private.algeria_local_date(
  p_at timestamptz DEFAULT now()
)
RETURNS date
LANGUAGE sql
STABLE
SET search_path TO ''
AS $function$
  SELECT (p_at AT TIME ZONE 'Africa/Algiers')::date;
$function$;

-- ---------------------------------------------------------------------------
-- 1. Fix the tester participant branch in the cohort SELECT policy.
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS cohorts_select_participants_v2 ON rebuild_v2.cohorts;

CREATE POLICY cohorts_select_participants_v2
ON rebuild_v2.cohorts
AS PERMISSIVE
FOR SELECT
TO authenticated
USING (
  created_by = (SELECT auth.uid())
  OR rebuild_v2_private.has_role((SELECT auth.uid()), ARRAY['admin','support'])
  OR EXISTS (
    SELECT 1
    FROM rebuild_v2.assignments a
    WHERE a.cohort_id = cohorts.id
      AND a.tester_id = (SELECT auth.uid())
  )
  OR EXISTS (
    SELECT 1
    FROM rebuild_v2.cohort_tests ct
    WHERE ct.cohort_id = cohorts.id
      AND ct.developer_id = (SELECT auth.uid())
  )
);

-- ---------------------------------------------------------------------------
-- 2. Dedicated final-submission records. Do not overload incident reports.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS rebuild_v2.assignment_submissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  assignment_id uuid NOT NULL UNIQUE
    REFERENCES rebuild_v2.assignments(id) ON DELETE RESTRICT,
  test_id uuid NOT NULL,
  tester_id uuid NOT NULL REFERENCES rebuild_v2.profiles(id) ON DELETE RESTRICT,
  summary text NOT NULL,
  comments text,
  status text NOT NULL DEFAULT 'draft',
  submitted_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT assignment_submissions_identity_key
    UNIQUE (id, assignment_id, test_id, tester_id),
  CONSTRAINT assignment_submissions_assignment_identity_fkey
    FOREIGN KEY (assignment_id, test_id, tester_id)
    REFERENCES rebuild_v2.assignments(id, test_id, tester_id) ON DELETE RESTRICT,
  CONSTRAINT assignment_submissions_summary_check
    CHECK (char_length(btrim(summary)) BETWEEN 20 AND 2000),
  CONSTRAINT assignment_submissions_comments_check
    CHECK (comments IS NULL OR char_length(comments) <= 500),
  CONSTRAINT assignment_submissions_status_check
    CHECK (
      (status = 'draft' AND submitted_at IS NULL)
      OR (status = 'submitted' AND submitted_at IS NOT NULL)
    )
);

CREATE TABLE IF NOT EXISTS rebuild_v2.assignment_submission_attachments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  submission_id uuid NOT NULL
    REFERENCES rebuild_v2.assignment_submissions(id) ON DELETE RESTRICT,
  assignment_id uuid NOT NULL,
  test_id uuid NOT NULL,
  tester_id uuid NOT NULL REFERENCES rebuild_v2.profiles(id) ON DELETE RESTRICT,
  file_id uuid NOT NULL,
  file_extension text NOT NULL,
  original_filename text NOT NULL,
  mime_type text NOT NULL,
  size_bytes bigint NOT NULL,
  storage_path text NOT NULL UNIQUE,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT assignment_submission_attachments_submission_identity_fkey
    FOREIGN KEY (submission_id, assignment_id, test_id, tester_id)
    REFERENCES rebuild_v2.assignment_submissions(id, assignment_id, test_id, tester_id)
    ON DELETE RESTRICT,
  CONSTRAINT assignment_submission_attachments_file_key
    UNIQUE (submission_id, file_id),
  CONSTRAINT assignment_submission_attachments_extension_check
    CHECK (file_extension IN ('png','jpg','jpeg','webp','pdf')),
  CONSTRAINT assignment_submission_attachments_filename_check
    CHECK (char_length(original_filename) BETWEEN 1 AND 255),
  CONSTRAINT assignment_submission_attachments_mime_check
    CHECK (mime_type IN ('image/png','image/jpeg','image/webp','application/pdf')),
  CONSTRAINT assignment_submission_attachments_size_check
    CHECK (size_bytes BETWEEN 1 AND 10485760)
);

CREATE INDEX IF NOT EXISTS assignment_submissions_tester_created_idx
  ON rebuild_v2.assignment_submissions(tester_id, created_at DESC);
CREATE INDEX IF NOT EXISTS assignment_submission_attachments_assignment_idx
  ON rebuild_v2.assignment_submission_attachments(assignment_id);

ALTER TABLE rebuild_v2.assignment_submissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE rebuild_v2.assignment_submissions FORCE ROW LEVEL SECURITY;
ALTER TABLE rebuild_v2.assignment_submission_attachments ENABLE ROW LEVEL SECURITY;
ALTER TABLE rebuild_v2.assignment_submission_attachments FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS assignment_submissions_select_participants_v2
  ON rebuild_v2.assignment_submissions;
CREATE POLICY assignment_submissions_select_participants_v2
ON rebuild_v2.assignment_submissions
FOR SELECT TO authenticated
USING (
  tester_id = (SELECT auth.uid())
  OR rebuild_v2_private.has_role((SELECT auth.uid()), ARRAY['admin','support'])
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
  OR rebuild_v2_private.has_role((SELECT auth.uid()), ARRAY['admin','support'])
  OR EXISTS (
    SELECT 1 FROM rebuild_v2.tests t
    WHERE t.id = assignment_submission_attachments.test_id
      AND t.developer_id = (SELECT auth.uid())
  )
);

REVOKE ALL ON TABLE rebuild_v2.assignment_submissions
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON TABLE rebuild_v2.assignment_submission_attachments
  FROM PUBLIC, anon, authenticated;
GRANT SELECT ON TABLE rebuild_v2.assignment_submissions,
  rebuild_v2.assignment_submission_attachments TO authenticated;

-- ---------------------------------------------------------------------------
-- 3. Discovery and enrollment.
-- ---------------------------------------------------------------------------
DROP FUNCTION IF EXISTS rebuild_v2.get_discoverable_tests();
DROP FUNCTION IF EXISTS rebuild_v2_private.get_discoverable_tests_impl();

CREATE OR REPLACE FUNCTION rebuild_v2_private.get_discoverable_tests_impl()
RETURNS TABLE (
  test_id uuid,
  cohort_id uuid,
  app_id uuid,
  app_name text,
  app_icon_url text,
  app_category text,
  title text,
  short_summary text,
  description text,
  test_type text,
  test_status text,
  start_date date,
  end_date date,
  estimated_duration_minutes integer,
  min_testers integer,
  eligibility_criteria jsonb,
  device_requirements jsonb,
  tester_instructions text,
  cohort_name text,
  cohort_capacity integer,
  spots_remaining integer,
  cohort_starts_at timestamptz,
  cohort_ends_at timestamptz
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO ''
SET row_security TO 'off'
AS $function$
DECLARE
  v_user_id uuid := (SELECT auth.uid());
  v_business_date date := rebuild_v2_private.algeria_local_date();
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'AUTH_REQUIRED' USING errcode = '28000';
  END IF;
  IF NOT rebuild_v2_private.has_role(v_user_id, ARRAY['tester']) THEN
    RAISE EXCEPTION 'TESTER_ROLE_REQUIRED' USING errcode = '42501';
  END IF;
  IF EXISTS (
    SELECT 1 FROM rebuild_v2.profiles p
    WHERE p.id = v_user_id AND p.is_banned
  ) THEN
    RAISE EXCEPTION 'ACCOUNT_RESTRICTED' USING errcode = '42501';
  END IF;

  RETURN QUERY
  SELECT
    t.id, c.id, app.id, app.name, app.icon_url, app.category,
    t.title, t.short_summary, t.description, t.test_type, t.status,
    t.start_date, t.end_date, t.estimated_duration_minutes,
    t.min_testers, t.eligibility_criteria, t.device_requirements,
    t.tester_instructions, c.name, c.capacity,
    GREATEST(0, c.capacity - COALESCE((
      SELECT count(*)::integer
      FROM rebuild_v2.assignments a
      WHERE a.cohort_id = c.id
        AND a.status NOT IN ('withdrawn','rejected')
    ), 0)),
    c.starts_at, c.ends_at
  FROM rebuild_v2.tests t
  JOIN rebuild_v2.apps app ON app.id = t.app_id
  JOIN rebuild_v2.cohort_tests ct ON ct.test_id = t.id
  JOIN rebuild_v2.cohorts c ON c.id = ct.cohort_id
  WHERE t.status IN ('recruiting','ready','running')
    AND app.status = 'published'
    AND c.status IN ('forming','ready','running')
    AND (t.start_date IS NULL OR t.start_date <= v_business_date)
    AND (t.end_date IS NULL OR t.end_date >= v_business_date)
    AND (c.ends_at IS NULL OR c.ends_at > now())
    AND NOT EXISTS (
      SELECT 1 FROM rebuild_v2.assignments mine
      WHERE mine.test_id = t.id
        AND mine.tester_id = v_user_id
        AND mine.status NOT IN ('withdrawn','rejected')
    )
    AND c.capacity > (
      SELECT count(*)::integer
      FROM rebuild_v2.assignments a
      WHERE a.cohort_id = c.id
        AND a.status NOT IN ('withdrawn','rejected')
    )
  ORDER BY c.starts_at NULLS LAST, t.created_at DESC, t.id, c.id;
END;
$function$;

CREATE OR REPLACE FUNCTION rebuild_v2_private.join_test_impl(p_test_id uuid)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
SET row_security TO 'off'
AS $function$
DECLARE
  v_user_id uuid := (SELECT auth.uid());
  v_test rebuild_v2.tests%ROWTYPE;
  v_cohort rebuild_v2.cohorts%ROWTYPE;
  v_existing rebuild_v2.assignments%ROWTYPE;
  v_used integer;
  v_assignment_id uuid;
  v_business_date date := rebuild_v2_private.algeria_local_date();
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'AUTH_REQUIRED' USING errcode = '28000';
  END IF;
  IF p_test_id IS NULL THEN
    RAISE EXCEPTION 'TEST_ID_REQUIRED' USING errcode = '22023';
  END IF;
  IF NOT rebuild_v2_private.has_role(v_user_id, ARRAY['tester']) THEN
    RAISE EXCEPTION 'TESTER_ROLE_REQUIRED' USING errcode = '42501';
  END IF;
  IF EXISTS (
    SELECT 1 FROM rebuild_v2.profiles p
    WHERE p.id = v_user_id AND p.is_banned
  ) THEN
    RAISE EXCEPTION 'ACCOUNT_RESTRICTED' USING errcode = '42501';
  END IF;

  PERFORM pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(v_user_id::text || ':' || p_test_id::text, 0)
  );

  SELECT t.* INTO v_test
  FROM rebuild_v2.tests t
  JOIN rebuild_v2.apps app ON app.id = t.app_id
  WHERE t.id = p_test_id
    AND t.status IN ('recruiting','ready','running')
    AND app.status = 'published'
    AND (t.start_date IS NULL OR t.start_date <= v_business_date)
    AND (t.end_date IS NULL OR t.end_date >= v_business_date);

  IF NOT FOUND THEN
    RAISE EXCEPTION 'TEST_NOT_OPEN' USING errcode = 'P0002';
  END IF;

  SELECT * INTO v_existing
  FROM rebuild_v2.assignments a
  WHERE a.test_id = p_test_id AND a.tester_id = v_user_id;

  IF FOUND THEN
    IF v_existing.status IN ('pending','active') THEN
      RETURN v_existing.id;
    END IF;
    RAISE EXCEPTION 'TEST_ALREADY_JOINED' USING errcode = '23505';
  END IF;

  FOR v_cohort IN
    SELECT c.*
    FROM rebuild_v2.cohorts c
    JOIN rebuild_v2.cohort_tests ct ON ct.cohort_id = c.id
    WHERE ct.test_id = p_test_id
      AND c.status IN ('forming','ready','running')
      AND (c.ends_at IS NULL OR c.ends_at > now())
    ORDER BY c.starts_at NULLS LAST, c.created_at, c.id
    FOR UPDATE OF c
  LOOP
    SELECT count(*)::integer INTO v_used
    FROM rebuild_v2.assignments a
    WHERE a.cohort_id = v_cohort.id
      AND a.status NOT IN ('withdrawn','rejected');

    IF v_used < v_cohort.capacity THEN
      INSERT INTO rebuild_v2.assignments(
        cohort_id, test_id, tester_id, status, due_at
      )
      VALUES (
        v_cohort.id, p_test_id, v_user_id, 'pending', v_cohort.ends_at
      )
      RETURNING id INTO v_assignment_id;

      PERFORM rebuild_v2_private.enqueue_notification_event(
        v_test.developer_id,
        'developer',
        'assignment.joined',
        'New tester joined your test',
        'A tester joined ' || v_test.title || '.',
        'assignment',
        v_assignment_id,
        jsonb_build_object('test_id', p_test_id, 'assignment_id', v_assignment_id)
      );

      RETURN v_assignment_id;
    END IF;
  END LOOP;

  RAISE EXCEPTION 'TEST_CAPACITY_FULL' USING errcode = 'P0001';
EXCEPTION
  WHEN unique_violation THEN
    SELECT a.id INTO v_assignment_id
    FROM rebuild_v2.assignments a
    WHERE a.test_id = p_test_id AND a.tester_id = v_user_id;
    IF v_assignment_id IS NOT NULL THEN
      RETURN v_assignment_id;
    END IF;
    RAISE;
END;
$function$;

-- ---------------------------------------------------------------------------
-- 4. Assignment start, daily check-in, and tester feedback.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION rebuild_v2_private.start_assignment_impl(p_assignment_id uuid)
RETURNS timestamptz
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
SET row_security TO 'off'
AS $function$
DECLARE
  v_user_id uuid := (SELECT auth.uid());
  v_assignment rebuild_v2.assignments%ROWTYPE;
  v_test_status text;
  v_cohort_status text;
  v_started_at timestamptz;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'AUTH_REQUIRED' USING errcode = '28000';
  END IF;
  SELECT * INTO v_assignment
  FROM rebuild_v2.assignments a
  WHERE a.id = p_assignment_id
  FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'ASSIGNMENT_NOT_FOUND' USING errcode = 'P0002';
  END IF;
  IF v_assignment.tester_id <> v_user_id THEN
    RAISE EXCEPTION 'ASSIGNMENT_FORBIDDEN' USING errcode = '42501';
  END IF;
  IF v_assignment.status NOT IN ('pending','active') THEN
    RAISE EXCEPTION 'ASSIGNMENT_NOT_STARTABLE' USING errcode = '55000';
  END IF;

  SELECT t.status, c.status INTO v_test_status, v_cohort_status
  FROM rebuild_v2.tests t
  JOIN rebuild_v2.cohorts c ON c.id = v_assignment.cohort_id
  WHERE t.id = v_assignment.test_id;

  IF v_test_status NOT IN ('ready','running')
     OR v_cohort_status NOT IN ('ready','running') THEN
    RAISE EXCEPTION 'TEST_NOT_READY' USING errcode = '55000';
  END IF;

  UPDATE rebuild_v2.assignments
  SET status = 'active',
      started_at = COALESCE(started_at, now())
  WHERE id = p_assignment_id
  RETURNING started_at INTO v_started_at;

  RETURN v_started_at;
END;
$function$;

CREATE OR REPLACE FUNCTION rebuild_v2_private.submit_checkin_impl(
  p_assignment_id uuid,
  p_note text
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
SET row_security TO 'off'
AS $function$
DECLARE
  v_user_id uuid := (SELECT auth.uid());
  v_assignment rebuild_v2.assignments%ROWTYPE;
  v_checkin_id uuid;
  v_checkin_date date := rebuild_v2_private.algeria_local_date();
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'AUTH_REQUIRED' USING errcode = '28000';
  END IF;
  IF p_assignment_id IS NULL
     OR (p_note IS NOT NULL AND char_length(btrim(p_note)) NOT BETWEEN 1 AND 4000) THEN
    RAISE EXCEPTION 'CHECKIN_INPUT_INVALID' USING errcode = '22023';
  END IF;

  SELECT * INTO v_assignment
  FROM rebuild_v2.assignments a
  WHERE a.id = p_assignment_id
  FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'ASSIGNMENT_NOT_FOUND' USING errcode = 'P0002';
  END IF;
  IF v_assignment.tester_id <> v_user_id THEN
    RAISE EXCEPTION 'ASSIGNMENT_FORBIDDEN' USING errcode = '42501';
  END IF;
  IF v_assignment.status <> 'active' THEN
    RAISE EXCEPTION 'ASSIGNMENT_NOT_ACTIVE' USING errcode = '55000';
  END IF;

  SELECT c.id INTO v_checkin_id
  FROM rebuild_v2.checkins c
  WHERE c.assignment_id = p_assignment_id
    AND c.checkin_date = v_checkin_date;
  IF v_checkin_id IS NOT NULL THEN
    RETURN v_checkin_id;
  END IF;

  INSERT INTO rebuild_v2.checkins(assignment_id, tester_id, checkin_date, note)
  VALUES (p_assignment_id, v_user_id, v_checkin_date, NULLIF(btrim(p_note), ''))
  RETURNING id INTO v_checkin_id;

  RETURN v_checkin_id;
EXCEPTION
  WHEN unique_violation THEN
    SELECT c.id INTO v_checkin_id
    FROM rebuild_v2.checkins c
    WHERE c.assignment_id = p_assignment_id
      AND c.checkin_date = v_checkin_date;
    IF v_checkin_id IS NOT NULL THEN
      RETURN v_checkin_id;
    END IF;
    RAISE;
END;
$function$;

CREATE OR REPLACE FUNCTION rebuild_v2_private.submit_tester_feedback_impl(
  p_assignment_id uuid,
  p_category text,
  p_body text,
  p_rating smallint DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
SET row_security TO 'off'
AS $function$
DECLARE
  v_user_id uuid := (SELECT auth.uid());
  v_assignment rebuild_v2.assignments%ROWTYPE;
  v_feedback_id uuid;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'AUTH_REQUIRED' USING errcode = '28000';
  END IF;
  IF p_assignment_id IS NULL
     OR p_category IS NULL
     OR p_category NOT IN ('general','bug','usability','performance','compatibility')
     OR p_body IS NULL
     OR char_length(btrim(p_body)) NOT BETWEEN 20 AND 8000
     OR (p_rating IS NOT NULL AND p_rating NOT BETWEEN 1 AND 5) THEN
    RAISE EXCEPTION 'FEEDBACK_INPUT_INVALID' USING errcode = '22023';
  END IF;

  SELECT * INTO v_assignment
  FROM rebuild_v2.assignments a
  WHERE a.id = p_assignment_id
  FOR UPDATE;
  IF NOT FOUND OR v_assignment.tester_id <> v_user_id THEN
    RAISE EXCEPTION 'ASSIGNMENT_NOT_FOUND' USING errcode = '42501';
  END IF;
  IF v_assignment.status NOT IN ('active','completed') THEN
    RAISE EXCEPTION 'ASSIGNMENT_NOT_FEEDBACK_ELIGIBLE' USING errcode = '55000';
  END IF;

  INSERT INTO rebuild_v2.feedback(assignment_id, tester_id, category, body, rating)
  VALUES (p_assignment_id, v_user_id, p_category, btrim(p_body), p_rating)
  RETURNING id INTO v_feedback_id;

  RETURN v_feedback_id;
END;
$function$;

-- ---------------------------------------------------------------------------
-- 5. Final assignment submission: create draft, register evidence, finalize.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION rebuild_v2_private.create_assignment_submission_impl(
  p_assignment_id uuid,
  p_summary text,
  p_comments text DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
SET row_security TO 'off'
AS $function$
DECLARE
  v_user_id uuid := (SELECT auth.uid());
  v_assignment rebuild_v2.assignments%ROWTYPE;
  v_submission_id uuid;
  v_existing_status text;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'AUTH_REQUIRED' USING errcode = '28000';
  END IF;
  IF p_assignment_id IS NULL
     OR p_summary IS NULL
     OR char_length(btrim(p_summary)) NOT BETWEEN 20 AND 2000
     OR (p_comments IS NOT NULL AND char_length(p_comments) > 500) THEN
    RAISE EXCEPTION 'SUBMISSION_INPUT_INVALID' USING errcode = '22023';
  END IF;

  SELECT * INTO v_assignment
  FROM rebuild_v2.assignments a
  WHERE a.id = p_assignment_id
  FOR UPDATE;
  IF NOT FOUND OR v_assignment.tester_id <> v_user_id THEN
    RAISE EXCEPTION 'ASSIGNMENT_NOT_FOUND' USING errcode = '42501';
  END IF;
  IF v_assignment.status <> 'active' THEN
    RAISE EXCEPTION 'ASSIGNMENT_NOT_ACTIVE' USING errcode = '55000';
  END IF;

  SELECT s.id, s.status INTO v_submission_id, v_existing_status
  FROM rebuild_v2.assignment_submissions s
  WHERE s.assignment_id = p_assignment_id
  FOR UPDATE;

  IF v_submission_id IS NOT NULL THEN
    IF v_existing_status <> 'draft' THEN
      RAISE EXCEPTION 'SUBMISSION_ALREADY_FINALIZED' USING errcode = '55000';
    END IF;
    UPDATE rebuild_v2.assignment_submissions
    SET summary = btrim(p_summary),
        comments = NULLIF(btrim(p_comments), ''),
        updated_at = now()
    WHERE id = v_submission_id;
    RETURN v_submission_id;
  END IF;

  INSERT INTO rebuild_v2.assignment_submissions(
    assignment_id, test_id, tester_id, summary, comments
  )
  VALUES (
    p_assignment_id, v_assignment.test_id, v_user_id,
    btrim(p_summary), NULLIF(btrim(p_comments), '')
  )
  RETURNING id INTO v_submission_id;

  RETURN v_submission_id;
END;
$function$;

CREATE OR REPLACE FUNCTION rebuild_v2_private.register_assignment_submission_attachment_impl(
  p_submission_id uuid,
  p_file_id uuid,
  p_extension text,
  p_original_filename text,
  p_mime_type text,
  p_size_bytes bigint
)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
SET row_security TO 'off'
AS $function$
DECLARE
  v_user_id uuid := (SELECT auth.uid());
  v_submission rebuild_v2.assignment_submissions%ROWTYPE;
  v_count integer;
  v_path text;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'AUTH_REQUIRED' USING errcode = '28000';
  END IF;
  IF p_submission_id IS NULL OR p_file_id IS NULL
     OR p_extension IS NULL
     OR p_extension NOT IN ('png','jpg','jpeg','webp','pdf')
     OR p_original_filename IS NULL
     OR char_length(p_original_filename) NOT BETWEEN 1 AND 255
     OR p_size_bytes IS NULL
     OR p_size_bytes NOT BETWEEN 1 AND 10485760
     OR p_mime_type IS NULL
     OR NOT (
       (p_extension = 'png' AND p_mime_type = 'image/png')
       OR (p_extension IN ('jpg','jpeg') AND p_mime_type = 'image/jpeg')
       OR (p_extension = 'webp' AND p_mime_type = 'image/webp')
       OR (p_extension = 'pdf' AND p_mime_type = 'application/pdf')
     ) THEN
    RAISE EXCEPTION 'ATTACHMENT_INPUT_INVALID' USING errcode = '22023';
  END IF;

  SELECT * INTO v_submission
  FROM rebuild_v2.assignment_submissions s
  WHERE s.id = p_submission_id
  FOR UPDATE;
  IF NOT FOUND OR v_submission.tester_id <> v_user_id THEN
    RAISE EXCEPTION 'SUBMISSION_NOT_FOUND' USING errcode = '42501';
  END IF;
  IF v_submission.status <> 'draft' THEN
    RAISE EXCEPTION 'SUBMISSION_NOT_EDITABLE' USING errcode = '55000';
  END IF;

  SELECT count(*)::integer INTO v_count
  FROM rebuild_v2.assignment_submission_attachments a
  WHERE a.submission_id = p_submission_id;
  IF v_count >= 5 THEN
    RAISE EXCEPTION 'ATTACHMENT_LIMIT_REACHED' USING errcode = '22023';
  END IF;

  v_path := 'v2/' || v_submission.test_id::text || '/' ||
            v_submission.tester_id::text || '/' ||
            v_submission.id::text || '/' ||
            p_file_id::text || '.' || p_extension;

  INSERT INTO rebuild_v2.assignment_submission_attachments(
    submission_id, assignment_id, test_id, tester_id, file_id,
    file_extension, original_filename, mime_type, size_bytes, storage_path
  )
  VALUES (
    v_submission.id, v_submission.assignment_id, v_submission.test_id,
    v_submission.tester_id, p_file_id, p_extension,
    p_original_filename, p_mime_type, p_size_bytes, v_path
  );

  RETURN v_path;
END;
$function$;

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
  v_uploaded integer;
  v_developer_id uuid;
  v_test_title text;
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

  SELECT count(*)::integer INTO v_uploaded
  FROM rebuild_v2.assignment_submission_attachments a
  JOIN storage.objects o
    ON o.bucket_id = 'test-evidence'
   AND o.name = a.storage_path
  WHERE a.submission_id = p_submission_id;

  IF v_count <> v_uploaded THEN
    RAISE EXCEPTION 'ATTACHMENT_UPLOAD_INCOMPLETE' USING errcode = '55000';
  END IF;

  UPDATE rebuild_v2.assignment_submissions
  SET status = 'submitted', submitted_at = now(), updated_at = now()
  WHERE id = p_submission_id;

  UPDATE rebuild_v2.assignments
  SET status = 'completed', completed_at = COALESCE(completed_at, now())
  WHERE id = v_submission.assignment_id;

  SELECT t.developer_id, t.title
  INTO v_developer_id, v_test_title
  FROM rebuild_v2.tests t
  WHERE t.id = v_submission.test_id;

  PERFORM rebuild_v2_private.enqueue_notification_event(
    v_developer_id,
    'developer',
    'assignment.submitted',
    'Final report submitted',
    'A tester submitted the final report for ' || v_test_title || '.',
    'assignment_submission',
    v_submission.id,
    jsonb_build_object(
      'test_id', v_submission.test_id,
      'assignment_id', v_submission.assignment_id,
      'submission_id', v_submission.id
    )
  );

  RETURN true;
END;
$function$;

-- ---------------------------------------------------------------------------
-- 6. Extend private Storage path checks to support final-submission evidence.
--    Legacy incident-report paths remain valid.
-- ---------------------------------------------------------------------------
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
    FROM rebuild_v2.reports r
    JOIN rebuild_v2.assignments a ON a.id = r.assignment_id
    WHERE r.id = v_parent_id
      AND r.reporter_id = (SELECT auth.uid())
      AND a.tester_id = v_tester_id
      AND a.test_id = v_test_id
      AND a.status = 'active'
      AND r.status = 'open'
  ) OR EXISTS (
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
     OR p_object_name !~* '^v2/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}[.](png|jpg|jpeg|webp|txt|pdf|zip) THEN
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
    JOIN rebuild_v2.tests t ON t.id = a.test_id
    WHERE ra.storage_path = p_object_name
      AND ra.report_id = v_parent_id
      AND ra.test_id = v_test_id
      AND ra.tester_id = v_tester_id
      AND a.tester_id = v_tester_id
      AND (
        r.reporter_id = (SELECT auth.uid())
        OR t.developer_id = (SELECT auth.uid())
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

-- ---------------------------------------------------------------------------
-- 7. Public RPC wrappers. Only these wrappers are granted to authenticated.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION rebuild_v2.get_discoverable_tests()
RETURNS TABLE (
  test_id uuid, cohort_id uuid, app_id uuid, app_name text, app_icon_url text,
  app_category text, title text, short_summary text, description text,
  test_type text, test_status text, start_date date, end_date date,
  estimated_duration_minutes integer,
  min_testers integer, eligibility_criteria jsonb, device_requirements jsonb,
  tester_instructions text, cohort_name text, cohort_capacity integer,
  spots_remaining integer, cohort_starts_at timestamptz, cohort_ends_at timestamptz
)
LANGUAGE sql
SECURITY DEFINER
SET search_path TO ''
SET row_security TO 'off'
AS $function$
  SELECT * FROM rebuild_v2_private.get_discoverable_tests_impl();
$function$;

CREATE OR REPLACE FUNCTION rebuild_v2.join_test(p_test_id uuid)
RETURNS uuid
LANGUAGE sql
SECURITY DEFINER
SET search_path TO ''
SET row_security TO 'off'
AS $function$
  SELECT rebuild_v2_private.join_test_impl(p_test_id);
$function$;

CREATE OR REPLACE FUNCTION rebuild_v2.start_assignment(p_assignment_id uuid)
RETURNS timestamptz
LANGUAGE sql
SECURITY DEFINER
SET search_path TO ''
SET row_security TO 'off'
AS $function$
  SELECT rebuild_v2_private.start_assignment_impl(p_assignment_id);
$function$;

CREATE OR REPLACE FUNCTION rebuild_v2.submit_checkin(p_assignment_id uuid, p_note text DEFAULT NULL)
RETURNS uuid
LANGUAGE sql
SECURITY DEFINER
SET search_path TO ''
SET row_security TO 'off'
AS $function$
  SELECT rebuild_v2_private.submit_checkin_impl(p_assignment_id, p_note);
$function$;

CREATE OR REPLACE FUNCTION rebuild_v2.submit_tester_feedback(
  p_assignment_id uuid, p_category text, p_body text, p_rating smallint DEFAULT NULL
)
RETURNS uuid
LANGUAGE sql
SECURITY DEFINER
SET search_path TO ''
SET row_security TO 'off'
AS $function$
  SELECT rebuild_v2_private.submit_tester_feedback_impl(
    p_assignment_id, p_category, p_body, p_rating
  );
$function$;

CREATE OR REPLACE FUNCTION rebuild_v2.create_assignment_submission(
  p_assignment_id uuid, p_summary text, p_comments text DEFAULT NULL
)
RETURNS uuid
LANGUAGE sql
SECURITY DEFINER
SET search_path TO ''
SET row_security TO 'off'
AS $function$
  SELECT rebuild_v2_private.create_assignment_submission_impl(
    p_assignment_id, p_summary, p_comments
  );
$function$;

CREATE OR REPLACE FUNCTION rebuild_v2.register_assignment_submission_attachment(
  p_submission_id uuid, p_file_id uuid, p_extension text,
  p_original_filename text, p_mime_type text, p_size_bytes bigint
)
RETURNS text
LANGUAGE sql
SECURITY DEFINER
SET search_path TO ''
SET row_security TO 'off'
AS $function$
  SELECT rebuild_v2_private.register_assignment_submission_attachment_impl(
    p_submission_id, p_file_id, p_extension,
    p_original_filename, p_mime_type, p_size_bytes
  );
$function$;

CREATE OR REPLACE FUNCTION rebuild_v2.finalize_assignment_submission(p_submission_id uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path TO ''
SET row_security TO 'off'
AS $function$
  SELECT rebuild_v2_private.finalize_assignment_submission_impl(p_submission_id);
$function$;

-- Private implementations and Storage helpers are not directly callable by clients.
REVOKE ALL ON FUNCTION rebuild_v2_private.algeria_local_date(timestamptz) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION rebuild_v2_private.get_discoverable_tests_impl() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION rebuild_v2_private.join_test_impl(uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION rebuild_v2_private.start_assignment_impl(uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION rebuild_v2_private.submit_checkin_impl(uuid,text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION rebuild_v2_private.submit_tester_feedback_impl(uuid,text,text,smallint) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION rebuild_v2_private.create_assignment_submission_impl(uuid,text,text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION rebuild_v2_private.register_assignment_submission_attachment_impl(uuid,uuid,text,text,text,bigint) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION rebuild_v2_private.finalize_assignment_submission_impl(uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION rebuild_v2_private.can_upload_test_evidence(text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION rebuild_v2_private.can_read_test_evidence(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION rebuild_v2_private.can_upload_test_evidence(text) TO authenticated;
GRANT EXECUTE ON FUNCTION rebuild_v2_private.can_read_test_evidence(text) TO authenticated;

REVOKE ALL ON FUNCTION rebuild_v2.get_discoverable_tests() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION rebuild_v2.join_test(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION rebuild_v2.start_assignment(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION rebuild_v2.submit_checkin(uuid,text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION rebuild_v2.submit_tester_feedback(uuid,text,text,smallint) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION rebuild_v2.create_assignment_submission(uuid,text,text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION rebuild_v2.register_assignment_submission_attachment(uuid,uuid,text,text,text,bigint) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION rebuild_v2.finalize_assignment_submission(uuid) FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION rebuild_v2.get_discoverable_tests() TO authenticated;
GRANT EXECUTE ON FUNCTION rebuild_v2.join_test(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION rebuild_v2.start_assignment(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION rebuild_v2.submit_checkin(uuid,text) TO authenticated;
GRANT EXECUTE ON FUNCTION rebuild_v2.submit_tester_feedback(uuid,text,text,smallint) TO authenticated;
GRANT EXECUTE ON FUNCTION rebuild_v2.create_assignment_submission(uuid,text,text) TO authenticated;
GRANT EXECUTE ON FUNCTION rebuild_v2.register_assignment_submission_attachment(uuid,uuid,text,text,text,bigint) TO authenticated;
GRANT EXECUTE ON FUNCTION rebuild_v2.finalize_assignment_submission(uuid) TO authenticated;

COMMIT;
 THEN
    RETURN false;
  END IF;
  v_test_id := split_part(p_object_name,'/',2)::uuid;
  v_tester_id := split_part(p_object_name,'/',3)::uuid;
  v_parent_id := split_part(p_object_name,'/',4)::uuid;

  RETURN EXISTS (
    SELECT 1
    FROM rebuild_v2.reports r
    JOIN rebuild_v2.assignments a ON a.id = r.assignment_id
    WHERE r.id = v_parent_id
      AND r.reporter_id = (SELECT auth.uid())
      AND a.tester_id = v_tester_id
      AND a.test_id = v_test_id
      AND a.status = 'active'
      AND r.status = 'open'
  ) OR EXISTS (
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
    JOIN rebuild_v2.tests t ON t.id = a.test_id
    WHERE ra.storage_path = p_object_name
      AND ra.report_id = v_parent_id
      AND ra.test_id = v_test_id
      AND ra.tester_id = v_tester_id
      AND a.tester_id = v_tester_id
      AND (
        r.reporter_id = (SELECT auth.uid())
        OR t.developer_id = (SELECT auth.uid())
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

-- ---------------------------------------------------------------------------
-- 7. Public RPC wrappers. Only these wrappers are granted to authenticated.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION rebuild_v2.get_discoverable_tests()
RETURNS TABLE (
  test_id uuid, cohort_id uuid, app_id uuid, app_name text, app_icon_url text,
  app_category text, title text, short_summary text, description text,
  test_type text, test_status text, start_date date, end_date date,
  estimated_duration_minutes integer,
  min_testers integer, eligibility_criteria jsonb, device_requirements jsonb,
  tester_instructions text, cohort_name text, cohort_capacity integer,
  spots_remaining integer, cohort_starts_at timestamptz, cohort_ends_at timestamptz
)
LANGUAGE sql
SECURITY DEFINER
SET search_path TO ''
SET row_security TO 'off'
AS $function$
  SELECT * FROM rebuild_v2_private.get_discoverable_tests_impl();
$function$;

CREATE OR REPLACE FUNCTION rebuild_v2.join_test(p_test_id uuid)
RETURNS uuid
LANGUAGE sql
SECURITY DEFINER
SET search_path TO ''
SET row_security TO 'off'
AS $function$
  SELECT rebuild_v2_private.join_test_impl(p_test_id);
$function$;

CREATE OR REPLACE FUNCTION rebuild_v2.start_assignment(p_assignment_id uuid)
RETURNS timestamptz
LANGUAGE sql
SECURITY DEFINER
SET search_path TO ''
SET row_security TO 'off'
AS $function$
  SELECT rebuild_v2_private.start_assignment_impl(p_assignment_id);
$function$;

CREATE OR REPLACE FUNCTION rebuild_v2.submit_checkin(p_assignment_id uuid, p_note text DEFAULT NULL)
RETURNS uuid
LANGUAGE sql
SECURITY DEFINER
SET search_path TO ''
SET row_security TO 'off'
AS $function$
  SELECT rebuild_v2_private.submit_checkin_impl(p_assignment_id, p_note);
$function$;

CREATE OR REPLACE FUNCTION rebuild_v2.submit_tester_feedback(
  p_assignment_id uuid, p_category text, p_body text, p_rating smallint DEFAULT NULL
)
RETURNS uuid
LANGUAGE sql
SECURITY DEFINER
SET search_path TO ''
SET row_security TO 'off'
AS $function$
  SELECT rebuild_v2_private.submit_tester_feedback_impl(
    p_assignment_id, p_category, p_body, p_rating
  );
$function$;

CREATE OR REPLACE FUNCTION rebuild_v2.create_assignment_submission(
  p_assignment_id uuid, p_summary text, p_comments text DEFAULT NULL
)
RETURNS uuid
LANGUAGE sql
SECURITY DEFINER
SET search_path TO ''
SET row_security TO 'off'
AS $function$
  SELECT rebuild_v2_private.create_assignment_submission_impl(
    p_assignment_id, p_summary, p_comments
  );
$function$;

CREATE OR REPLACE FUNCTION rebuild_v2.register_assignment_submission_attachment(
  p_submission_id uuid, p_file_id uuid, p_extension text,
  p_original_filename text, p_mime_type text, p_size_bytes bigint
)
RETURNS text
LANGUAGE sql
SECURITY DEFINER
SET search_path TO ''
SET row_security TO 'off'
AS $function$
  SELECT rebuild_v2_private.register_assignment_submission_attachment_impl(
    p_submission_id, p_file_id, p_extension,
    p_original_filename, p_mime_type, p_size_bytes
  );
$function$;

CREATE OR REPLACE FUNCTION rebuild_v2.finalize_assignment_submission(p_submission_id uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path TO ''
SET row_security TO 'off'
AS $function$
  SELECT rebuild_v2_private.finalize_assignment_submission_impl(p_submission_id);
$function$;

-- Private implementations and Storage helpers are not directly callable by clients.
REVOKE ALL ON FUNCTION rebuild_v2_private.algeria_local_date(timestamptz) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION rebuild_v2_private.get_discoverable_tests_impl() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION rebuild_v2_private.join_test_impl(uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION rebuild_v2_private.start_assignment_impl(uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION rebuild_v2_private.submit_checkin_impl(uuid,text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION rebuild_v2_private.submit_tester_feedback_impl(uuid,text,text,smallint) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION rebuild_v2_private.create_assignment_submission_impl(uuid,text,text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION rebuild_v2_private.register_assignment_submission_attachment_impl(uuid,uuid,text,text,text,bigint) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION rebuild_v2_private.finalize_assignment_submission_impl(uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION rebuild_v2_private.can_upload_test_evidence(text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION rebuild_v2_private.can_read_test_evidence(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION rebuild_v2_private.can_upload_test_evidence(text) TO authenticated;
GRANT EXECUTE ON FUNCTION rebuild_v2_private.can_read_test_evidence(text) TO authenticated;

REVOKE ALL ON FUNCTION rebuild_v2.get_discoverable_tests() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION rebuild_v2.join_test(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION rebuild_v2.start_assignment(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION rebuild_v2.submit_checkin(uuid,text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION rebuild_v2.submit_tester_feedback(uuid,text,text,smallint) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION rebuild_v2.create_assignment_submission(uuid,text,text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION rebuild_v2.register_assignment_submission_attachment(uuid,uuid,text,text,text,bigint) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION rebuild_v2.finalize_assignment_submission(uuid) FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION rebuild_v2.get_discoverable_tests() TO authenticated;
GRANT EXECUTE ON FUNCTION rebuild_v2.join_test(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION rebuild_v2.start_assignment(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION rebuild_v2.submit_checkin(uuid,text) TO authenticated;
GRANT EXECUTE ON FUNCTION rebuild_v2.submit_tester_feedback(uuid,text,text,smallint) TO authenticated;
GRANT EXECUTE ON FUNCTION rebuild_v2.create_assignment_submission(uuid,text,text) TO authenticated;
GRANT EXECUTE ON FUNCTION rebuild_v2.register_assignment_submission_attachment(uuid,uuid,text,text,text,bigint) TO authenticated;
GRANT EXECUTE ON FUNCTION rebuild_v2.finalize_assignment_submission(uuid) TO authenticated;

COMMIT;
 THEN
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
    JOIN rebuild_v2.tests t ON t.id = a.test_id
    WHERE ra.storage_path = p_object_name
      AND ra.report_id = v_parent_id
      AND ra.test_id = v_test_id
      AND ra.tester_id = v_tester_id
      AND a.tester_id = v_tester_id
      AND (
        r.reporter_id = (SELECT auth.uid())
        OR t.developer_id = (SELECT auth.uid())
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

-- ---------------------------------------------------------------------------
-- 7. Public RPC wrappers. Only these wrappers are granted to authenticated.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION rebuild_v2.get_discoverable_tests()
RETURNS TABLE (
  test_id uuid, cohort_id uuid, app_id uuid, app_name text, app_icon_url text,
  app_category text, title text, short_summary text, description text,
  test_type text, test_status text, start_date date, end_date date,
  estimated_duration_minutes integer,
  min_testers integer, eligibility_criteria jsonb, device_requirements jsonb,
  tester_instructions text, cohort_name text, cohort_capacity integer,
  spots_remaining integer, cohort_starts_at timestamptz, cohort_ends_at timestamptz
)
LANGUAGE sql
SECURITY DEFINER
SET search_path TO ''
SET row_security TO 'off'
AS $function$
  SELECT * FROM rebuild_v2_private.get_discoverable_tests_impl();
$function$;

CREATE OR REPLACE FUNCTION rebuild_v2.join_test(p_test_id uuid)
RETURNS uuid
LANGUAGE sql
SECURITY DEFINER
SET search_path TO ''
SET row_security TO 'off'
AS $function$
  SELECT rebuild_v2_private.join_test_impl(p_test_id);
$function$;

CREATE OR REPLACE FUNCTION rebuild_v2.start_assignment(p_assignment_id uuid)
RETURNS timestamptz
LANGUAGE sql
SECURITY DEFINER
SET search_path TO ''
SET row_security TO 'off'
AS $function$
  SELECT rebuild_v2_private.start_assignment_impl(p_assignment_id);
$function$;

CREATE OR REPLACE FUNCTION rebuild_v2.submit_checkin(p_assignment_id uuid, p_note text DEFAULT NULL)
RETURNS uuid
LANGUAGE sql
SECURITY DEFINER
SET search_path TO ''
SET row_security TO 'off'
AS $function$
  SELECT rebuild_v2_private.submit_checkin_impl(p_assignment_id, p_note);
$function$;

CREATE OR REPLACE FUNCTION rebuild_v2.submit_tester_feedback(
  p_assignment_id uuid, p_category text, p_body text, p_rating smallint DEFAULT NULL
)
RETURNS uuid
LANGUAGE sql
SECURITY DEFINER
SET search_path TO ''
SET row_security TO 'off'
AS $function$
  SELECT rebuild_v2_private.submit_tester_feedback_impl(
    p_assignment_id, p_category, p_body, p_rating
  );
$function$;

CREATE OR REPLACE FUNCTION rebuild_v2.create_assignment_submission(
  p_assignment_id uuid, p_summary text, p_comments text DEFAULT NULL
)
RETURNS uuid
LANGUAGE sql
SECURITY DEFINER
SET search_path TO ''
SET row_security TO 'off'
AS $function$
  SELECT rebuild_v2_private.create_assignment_submission_impl(
    p_assignment_id, p_summary, p_comments
  );
$function$;

CREATE OR REPLACE FUNCTION rebuild_v2.register_assignment_submission_attachment(
  p_submission_id uuid, p_file_id uuid, p_extension text,
  p_original_filename text, p_mime_type text, p_size_bytes bigint
)
RETURNS text
LANGUAGE sql
SECURITY DEFINER
SET search_path TO ''
SET row_security TO 'off'
AS $function$
  SELECT rebuild_v2_private.register_assignment_submission_attachment_impl(
    p_submission_id, p_file_id, p_extension,
    p_original_filename, p_mime_type, p_size_bytes
  );
$function$;

CREATE OR REPLACE FUNCTION rebuild_v2.finalize_assignment_submission(p_submission_id uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path TO ''
SET row_security TO 'off'
AS $function$
  SELECT rebuild_v2_private.finalize_assignment_submission_impl(p_submission_id);
$function$;

-- Private implementations and Storage helpers are not directly callable by clients.
REVOKE ALL ON FUNCTION rebuild_v2_private.algeria_local_date(timestamptz) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION rebuild_v2_private.get_discoverable_tests_impl() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION rebuild_v2_private.join_test_impl(uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION rebuild_v2_private.start_assignment_impl(uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION rebuild_v2_private.submit_checkin_impl(uuid,text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION rebuild_v2_private.submit_tester_feedback_impl(uuid,text,text,smallint) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION rebuild_v2_private.create_assignment_submission_impl(uuid,text,text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION rebuild_v2_private.register_assignment_submission_attachment_impl(uuid,uuid,text,text,text,bigint) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION rebuild_v2_private.finalize_assignment_submission_impl(uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION rebuild_v2_private.can_upload_test_evidence(text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION rebuild_v2_private.can_read_test_evidence(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION rebuild_v2_private.can_upload_test_evidence(text) TO authenticated;
GRANT EXECUTE ON FUNCTION rebuild_v2_private.can_read_test_evidence(text) TO authenticated;

REVOKE ALL ON FUNCTION rebuild_v2.get_discoverable_tests() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION rebuild_v2.join_test(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION rebuild_v2.start_assignment(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION rebuild_v2.submit_checkin(uuid,text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION rebuild_v2.submit_tester_feedback(uuid,text,text,smallint) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION rebuild_v2.create_assignment_submission(uuid,text,text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION rebuild_v2.register_assignment_submission_attachment(uuid,uuid,text,text,text,bigint) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION rebuild_v2.finalize_assignment_submission(uuid) FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION rebuild_v2.get_discoverable_tests() TO authenticated;
GRANT EXECUTE ON FUNCTION rebuild_v2.join_test(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION rebuild_v2.start_assignment(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION rebuild_v2.submit_checkin(uuid,text) TO authenticated;
GRANT EXECUTE ON FUNCTION rebuild_v2.submit_tester_feedback(uuid,text,text,smallint) TO authenticated;
GRANT EXECUTE ON FUNCTION rebuild_v2.create_assignment_submission(uuid,text,text) TO authenticated;
GRANT EXECUTE ON FUNCTION rebuild_v2.register_assignment_submission_attachment(uuid,uuid,text,text,text,bigint) TO authenticated;
GRANT EXECUTE ON FUNCTION rebuild_v2.finalize_assignment_submission(uuid) TO authenticated;

COMMIT;
 THEN
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
    JOIN rebuild_v2.tests t ON t.id = a.test_id
    WHERE ra.storage_path = p_object_name
      AND ra.report_id = v_parent_id
      AND ra.test_id = v_test_id
      AND ra.tester_id = v_tester_id
      AND a.tester_id = v_tester_id
      AND (
        r.reporter_id = (SELECT auth.uid())
        OR t.developer_id = (SELECT auth.uid())
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

-- ---------------------------------------------------------------------------
-- 7. Public RPC wrappers. Only these wrappers are granted to authenticated.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION rebuild_v2.get_discoverable_tests()
RETURNS TABLE (
  test_id uuid, cohort_id uuid, app_id uuid, app_name text, app_icon_url text,
  app_category text, title text, short_summary text, description text,
  test_type text, test_status text, start_date date, end_date date,
  estimated_duration_minutes integer,
  min_testers integer, eligibility_criteria jsonb, device_requirements jsonb,
  tester_instructions text, cohort_name text, cohort_capacity integer,
  spots_remaining integer, cohort_starts_at timestamptz, cohort_ends_at timestamptz
)
LANGUAGE sql
SECURITY DEFINER
SET search_path TO ''
SET row_security TO 'off'
AS $function$
  SELECT * FROM rebuild_v2_private.get_discoverable_tests_impl();
$function$;

CREATE OR REPLACE FUNCTION rebuild_v2.join_test(p_test_id uuid)
RETURNS uuid
LANGUAGE sql
SECURITY DEFINER
SET search_path TO ''
SET row_security TO 'off'
AS $function$
  SELECT rebuild_v2_private.join_test_impl(p_test_id);
$function$;

CREATE OR REPLACE FUNCTION rebuild_v2.start_assignment(p_assignment_id uuid)
RETURNS timestamptz
LANGUAGE sql
SECURITY DEFINER
SET search_path TO ''
SET row_security TO 'off'
AS $function$
  SELECT rebuild_v2_private.start_assignment_impl(p_assignment_id);
$function$;

CREATE OR REPLACE FUNCTION rebuild_v2.submit_checkin(p_assignment_id uuid, p_note text DEFAULT NULL)
RETURNS uuid
LANGUAGE sql
SECURITY DEFINER
SET search_path TO ''
SET row_security TO 'off'
AS $function$
  SELECT rebuild_v2_private.submit_checkin_impl(p_assignment_id, p_note);
$function$;

CREATE OR REPLACE FUNCTION rebuild_v2.submit_tester_feedback(
  p_assignment_id uuid, p_category text, p_body text, p_rating smallint DEFAULT NULL
)
RETURNS uuid
LANGUAGE sql
SECURITY DEFINER
SET search_path TO ''
SET row_security TO 'off'
AS $function$
  SELECT rebuild_v2_private.submit_tester_feedback_impl(
    p_assignment_id, p_category, p_body, p_rating
  );
$function$;

CREATE OR REPLACE FUNCTION rebuild_v2.create_assignment_submission(
  p_assignment_id uuid, p_summary text, p_comments text DEFAULT NULL
)
RETURNS uuid
LANGUAGE sql
SECURITY DEFINER
SET search_path TO ''
SET row_security TO 'off'
AS $function$
  SELECT rebuild_v2_private.create_assignment_submission_impl(
    p_assignment_id, p_summary, p_comments
  );
$function$;

CREATE OR REPLACE FUNCTION rebuild_v2.register_assignment_submission_attachment(
  p_submission_id uuid, p_file_id uuid, p_extension text,
  p_original_filename text, p_mime_type text, p_size_bytes bigint
)
RETURNS text
LANGUAGE sql
SECURITY DEFINER
SET search_path TO ''
SET row_security TO 'off'
AS $function$
  SELECT rebuild_v2_private.register_assignment_submission_attachment_impl(
    p_submission_id, p_file_id, p_extension,
    p_original_filename, p_mime_type, p_size_bytes
  );
$function$;

CREATE OR REPLACE FUNCTION rebuild_v2.finalize_assignment_submission(p_submission_id uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path TO ''
SET row_security TO 'off'
AS $function$
  SELECT rebuild_v2_private.finalize_assignment_submission_impl(p_submission_id);
$function$;

-- Private implementations and Storage helpers are not directly callable by clients.
REVOKE ALL ON FUNCTION rebuild_v2_private.algeria_local_date(timestamptz) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION rebuild_v2_private.get_discoverable_tests_impl() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION rebuild_v2_private.join_test_impl(uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION rebuild_v2_private.start_assignment_impl(uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION rebuild_v2_private.submit_checkin_impl(uuid,text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION rebuild_v2_private.submit_tester_feedback_impl(uuid,text,text,smallint) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION rebuild_v2_private.create_assignment_submission_impl(uuid,text,text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION rebuild_v2_private.register_assignment_submission_attachment_impl(uuid,uuid,text,text,text,bigint) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION rebuild_v2_private.finalize_assignment_submission_impl(uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION rebuild_v2_private.can_upload_test_evidence(text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION rebuild_v2_private.can_read_test_evidence(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION rebuild_v2_private.can_upload_test_evidence(text) TO authenticated;
GRANT EXECUTE ON FUNCTION rebuild_v2_private.can_read_test_evidence(text) TO authenticated;

REVOKE ALL ON FUNCTION rebuild_v2.get_discoverable_tests() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION rebuild_v2.join_test(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION rebuild_v2.start_assignment(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION rebuild_v2.submit_checkin(uuid,text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION rebuild_v2.submit_tester_feedback(uuid,text,text,smallint) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION rebuild_v2.create_assignment_submission(uuid,text,text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION rebuild_v2.register_assignment_submission_attachment(uuid,uuid,text,text,text,bigint) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION rebuild_v2.finalize_assignment_submission(uuid) FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION rebuild_v2.get_discoverable_tests() TO authenticated;
GRANT EXECUTE ON FUNCTION rebuild_v2.join_test(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION rebuild_v2.start_assignment(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION rebuild_v2.submit_checkin(uuid,text) TO authenticated;
GRANT EXECUTE ON FUNCTION rebuild_v2.submit_tester_feedback(uuid,text,text,smallint) TO authenticated;
GRANT EXECUTE ON FUNCTION rebuild_v2.create_assignment_submission(uuid,text,text) TO authenticated;
GRANT EXECUTE ON FUNCTION rebuild_v2.register_assignment_submission_attachment(uuid,uuid,text,text,text,bigint) TO authenticated;
GRANT EXECUTE ON FUNCTION rebuild_v2.finalize_assignment_submission(uuid) TO authenticated;

COMMIT;
 THEN
    RETURN false;
  END IF;
  v_test_id := split_part(p_object_name,'/',2)::uuid;
  v_tester_id := split_part(p_object_name,'/',3)::uuid;
  v_parent_id := split_part(p_object_name,'/',4)::uuid;

  RETURN EXISTS (
    SELECT 1
    FROM rebuild_v2.reports r
    JOIN rebuild_v2.assignments a ON a.id = r.assignment_id
    WHERE r.id = v_parent_id
      AND r.reporter_id = (SELECT auth.uid())
      AND a.tester_id = v_tester_id
      AND a.test_id = v_test_id
      AND a.status = 'active'
      AND r.status = 'open'
  ) OR EXISTS (
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
    JOIN rebuild_v2.tests t ON t.id = a.test_id
    WHERE ra.storage_path = p_object_name
      AND ra.report_id = v_parent_id
      AND ra.test_id = v_test_id
      AND ra.tester_id = v_tester_id
      AND a.tester_id = v_tester_id
      AND (
        r.reporter_id = (SELECT auth.uid())
        OR t.developer_id = (SELECT auth.uid())
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

-- ---------------------------------------------------------------------------
-- 7. Public RPC wrappers. Only these wrappers are granted to authenticated.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION rebuild_v2.get_discoverable_tests()
RETURNS TABLE (
  test_id uuid, cohort_id uuid, app_id uuid, app_name text, app_icon_url text,
  app_category text, title text, short_summary text, description text,
  test_type text, test_status text, start_date date, end_date date,
  estimated_duration_minutes integer,
  min_testers integer, eligibility_criteria jsonb, device_requirements jsonb,
  tester_instructions text, cohort_name text, cohort_capacity integer,
  spots_remaining integer, cohort_starts_at timestamptz, cohort_ends_at timestamptz
)
LANGUAGE sql
SECURITY DEFINER
SET search_path TO ''
SET row_security TO 'off'
AS $function$
  SELECT * FROM rebuild_v2_private.get_discoverable_tests_impl();
$function$;

CREATE OR REPLACE FUNCTION rebuild_v2.join_test(p_test_id uuid)
RETURNS uuid
LANGUAGE sql
SECURITY DEFINER
SET search_path TO ''
SET row_security TO 'off'
AS $function$
  SELECT rebuild_v2_private.join_test_impl(p_test_id);
$function$;

CREATE OR REPLACE FUNCTION rebuild_v2.start_assignment(p_assignment_id uuid)
RETURNS timestamptz
LANGUAGE sql
SECURITY DEFINER
SET search_path TO ''
SET row_security TO 'off'
AS $function$
  SELECT rebuild_v2_private.start_assignment_impl(p_assignment_id);
$function$;

CREATE OR REPLACE FUNCTION rebuild_v2.submit_checkin(p_assignment_id uuid, p_note text DEFAULT NULL)
RETURNS uuid
LANGUAGE sql
SECURITY DEFINER
SET search_path TO ''
SET row_security TO 'off'
AS $function$
  SELECT rebuild_v2_private.submit_checkin_impl(p_assignment_id, p_note);
$function$;

CREATE OR REPLACE FUNCTION rebuild_v2.submit_tester_feedback(
  p_assignment_id uuid, p_category text, p_body text, p_rating smallint DEFAULT NULL
)
RETURNS uuid
LANGUAGE sql
SECURITY DEFINER
SET search_path TO ''
SET row_security TO 'off'
AS $function$
  SELECT rebuild_v2_private.submit_tester_feedback_impl(
    p_assignment_id, p_category, p_body, p_rating
  );
$function$;

CREATE OR REPLACE FUNCTION rebuild_v2.create_assignment_submission(
  p_assignment_id uuid, p_summary text, p_comments text DEFAULT NULL
)
RETURNS uuid
LANGUAGE sql
SECURITY DEFINER
SET search_path TO ''
SET row_security TO 'off'
AS $function$
  SELECT rebuild_v2_private.create_assignment_submission_impl(
    p_assignment_id, p_summary, p_comments
  );
$function$;

CREATE OR REPLACE FUNCTION rebuild_v2.register_assignment_submission_attachment(
  p_submission_id uuid, p_file_id uuid, p_extension text,
  p_original_filename text, p_mime_type text, p_size_bytes bigint
)
RETURNS text
LANGUAGE sql
SECURITY DEFINER
SET search_path TO ''
SET row_security TO 'off'
AS $function$
  SELECT rebuild_v2_private.register_assignment_submission_attachment_impl(
    p_submission_id, p_file_id, p_extension,
    p_original_filename, p_mime_type, p_size_bytes
  );
$function$;

CREATE OR REPLACE FUNCTION rebuild_v2.finalize_assignment_submission(p_submission_id uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path TO ''
SET row_security TO 'off'
AS $function$
  SELECT rebuild_v2_private.finalize_assignment_submission_impl(p_submission_id);
$function$;

-- Private implementations and Storage helpers are not directly callable by clients.
REVOKE ALL ON FUNCTION rebuild_v2_private.algeria_local_date(timestamptz) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION rebuild_v2_private.get_discoverable_tests_impl() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION rebuild_v2_private.join_test_impl(uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION rebuild_v2_private.start_assignment_impl(uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION rebuild_v2_private.submit_checkin_impl(uuid,text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION rebuild_v2_private.submit_tester_feedback_impl(uuid,text,text,smallint) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION rebuild_v2_private.create_assignment_submission_impl(uuid,text,text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION rebuild_v2_private.register_assignment_submission_attachment_impl(uuid,uuid,text,text,text,bigint) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION rebuild_v2_private.finalize_assignment_submission_impl(uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION rebuild_v2_private.can_upload_test_evidence(text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION rebuild_v2_private.can_read_test_evidence(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION rebuild_v2_private.can_upload_test_evidence(text) TO authenticated;
GRANT EXECUTE ON FUNCTION rebuild_v2_private.can_read_test_evidence(text) TO authenticated;

REVOKE ALL ON FUNCTION rebuild_v2.get_discoverable_tests() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION rebuild_v2.join_test(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION rebuild_v2.start_assignment(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION rebuild_v2.submit_checkin(uuid,text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION rebuild_v2.submit_tester_feedback(uuid,text,text,smallint) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION rebuild_v2.create_assignment_submission(uuid,text,text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION rebuild_v2.register_assignment_submission_attachment(uuid,uuid,text,text,text,bigint) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION rebuild_v2.finalize_assignment_submission(uuid) FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION rebuild_v2.get_discoverable_tests() TO authenticated;
GRANT EXECUTE ON FUNCTION rebuild_v2.join_test(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION rebuild_v2.start_assignment(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION rebuild_v2.submit_checkin(uuid,text) TO authenticated;
GRANT EXECUTE ON FUNCTION rebuild_v2.submit_tester_feedback(uuid,text,text,smallint) TO authenticated;
GRANT EXECUTE ON FUNCTION rebuild_v2.create_assignment_submission(uuid,text,text) TO authenticated;
GRANT EXECUTE ON FUNCTION rebuild_v2.register_assignment_submission_attachment(uuid,uuid,text,text,text,bigint) TO authenticated;
GRANT EXECUTE ON FUNCTION rebuild_v2.finalize_assignment_submission(uuid) TO authenticated;

COMMIT;
 THEN
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
    JOIN rebuild_v2.tests t ON t.id = a.test_id
    WHERE ra.storage_path = p_object_name
      AND ra.report_id = v_parent_id
      AND ra.test_id = v_test_id
      AND ra.tester_id = v_tester_id
      AND a.tester_id = v_tester_id
      AND (
        r.reporter_id = (SELECT auth.uid())
        OR t.developer_id = (SELECT auth.uid())
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

-- ---------------------------------------------------------------------------
-- 7. Public RPC wrappers. Only these wrappers are granted to authenticated.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION rebuild_v2.get_discoverable_tests()
RETURNS TABLE (
  test_id uuid, cohort_id uuid, app_id uuid, app_name text, app_icon_url text,
  app_category text, title text, short_summary text, description text,
  test_type text, test_status text, start_date date, end_date date,
  estimated_duration_minutes integer,
  min_testers integer, eligibility_criteria jsonb, device_requirements jsonb,
  tester_instructions text, cohort_name text, cohort_capacity integer,
  spots_remaining integer, cohort_starts_at timestamptz, cohort_ends_at timestamptz
)
LANGUAGE sql
SECURITY DEFINER
SET search_path TO ''
SET row_security TO 'off'
AS $function$
  SELECT * FROM rebuild_v2_private.get_discoverable_tests_impl();
$function$;

CREATE OR REPLACE FUNCTION rebuild_v2.join_test(p_test_id uuid)
RETURNS uuid
LANGUAGE sql
SECURITY DEFINER
SET search_path TO ''
SET row_security TO 'off'
AS $function$
  SELECT rebuild_v2_private.join_test_impl(p_test_id);
$function$;

CREATE OR REPLACE FUNCTION rebuild_v2.start_assignment(p_assignment_id uuid)
RETURNS timestamptz
LANGUAGE sql
SECURITY DEFINER
SET search_path TO ''
SET row_security TO 'off'
AS $function$
  SELECT rebuild_v2_private.start_assignment_impl(p_assignment_id);
$function$;

CREATE OR REPLACE FUNCTION rebuild_v2.submit_checkin(p_assignment_id uuid, p_note text DEFAULT NULL)
RETURNS uuid
LANGUAGE sql
SECURITY DEFINER
SET search_path TO ''
SET row_security TO 'off'
AS $function$
  SELECT rebuild_v2_private.submit_checkin_impl(p_assignment_id, p_note);
$function$;

CREATE OR REPLACE FUNCTION rebuild_v2.submit_tester_feedback(
  p_assignment_id uuid, p_category text, p_body text, p_rating smallint DEFAULT NULL
)
RETURNS uuid
LANGUAGE sql
SECURITY DEFINER
SET search_path TO ''
SET row_security TO 'off'
AS $function$
  SELECT rebuild_v2_private.submit_tester_feedback_impl(
    p_assignment_id, p_category, p_body, p_rating
  );
$function$;

CREATE OR REPLACE FUNCTION rebuild_v2.create_assignment_submission(
  p_assignment_id uuid, p_summary text, p_comments text DEFAULT NULL
)
RETURNS uuid
LANGUAGE sql
SECURITY DEFINER
SET search_path TO ''
SET row_security TO 'off'
AS $function$
  SELECT rebuild_v2_private.create_assignment_submission_impl(
    p_assignment_id, p_summary, p_comments
  );
$function$;

CREATE OR REPLACE FUNCTION rebuild_v2.register_assignment_submission_attachment(
  p_submission_id uuid, p_file_id uuid, p_extension text,
  p_original_filename text, p_mime_type text, p_size_bytes bigint
)
RETURNS text
LANGUAGE sql
SECURITY DEFINER
SET search_path TO ''
SET row_security TO 'off'
AS $function$
  SELECT rebuild_v2_private.register_assignment_submission_attachment_impl(
    p_submission_id, p_file_id, p_extension,
    p_original_filename, p_mime_type, p_size_bytes
  );
$function$;

CREATE OR REPLACE FUNCTION rebuild_v2.finalize_assignment_submission(p_submission_id uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path TO ''
SET row_security TO 'off'
AS $function$
  SELECT rebuild_v2_private.finalize_assignment_submission_impl(p_submission_id);
$function$;

-- Private implementations and Storage helpers are not directly callable by clients.
REVOKE ALL ON FUNCTION rebuild_v2_private.algeria_local_date(timestamptz) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION rebuild_v2_private.get_discoverable_tests_impl() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION rebuild_v2_private.join_test_impl(uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION rebuild_v2_private.start_assignment_impl(uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION rebuild_v2_private.submit_checkin_impl(uuid,text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION rebuild_v2_private.submit_tester_feedback_impl(uuid,text,text,smallint) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION rebuild_v2_private.create_assignment_submission_impl(uuid,text,text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION rebuild_v2_private.register_assignment_submission_attachment_impl(uuid,uuid,text,text,text,bigint) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION rebuild_v2_private.finalize_assignment_submission_impl(uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION rebuild_v2_private.can_upload_test_evidence(text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION rebuild_v2_private.can_read_test_evidence(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION rebuild_v2_private.can_upload_test_evidence(text) TO authenticated;
GRANT EXECUTE ON FUNCTION rebuild_v2_private.can_read_test_evidence(text) TO authenticated;

REVOKE ALL ON FUNCTION rebuild_v2.get_discoverable_tests() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION rebuild_v2.join_test(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION rebuild_v2.start_assignment(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION rebuild_v2.submit_checkin(uuid,text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION rebuild_v2.submit_tester_feedback(uuid,text,text,smallint) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION rebuild_v2.create_assignment_submission(uuid,text,text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION rebuild_v2.register_assignment_submission_attachment(uuid,uuid,text,text,text,bigint) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION rebuild_v2.finalize_assignment_submission(uuid) FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION rebuild_v2.get_discoverable_tests() TO authenticated;
GRANT EXECUTE ON FUNCTION rebuild_v2.join_test(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION rebuild_v2.start_assignment(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION rebuild_v2.submit_checkin(uuid,text) TO authenticated;
GRANT EXECUTE ON FUNCTION rebuild_v2.submit_tester_feedback(uuid,text,text,smallint) TO authenticated;
GRANT EXECUTE ON FUNCTION rebuild_v2.create_assignment_submission(uuid,text,text) TO authenticated;
GRANT EXECUTE ON FUNCTION rebuild_v2.register_assignment_submission_attachment(uuid,uuid,text,text,text,bigint) TO authenticated;
GRANT EXECUTE ON FUNCTION rebuild_v2.finalize_assignment_submission(uuid) TO authenticated;

COMMIT;
