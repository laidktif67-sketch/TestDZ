-- Migration 004: private report evidence storage and immutable attachment metadata.
-- Staging only. This file is prepared for review; do not apply until separately approved.
BEGIN;

DO $preflight$
BEGIN
  IF to_regclass('public.report_attachments') IS NOT NULL THEN
    RAISE EXCEPTION 'PREFLIGHT_FAILED: public.report_attachments already exists';
  END IF;
  IF EXISTS (SELECT 1 FROM storage.buckets WHERE id = 'test-evidence') THEN
    RAISE EXCEPTION 'PREFLIGHT_FAILED: storage bucket test-evidence already exists';
  END IF;
  IF EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.reports'::regclass
      AND conname = 'reports_id_assignment_id_key'
  ) OR EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.assignments'::regclass
      AND conname = 'assignments_id_test_id_tester_id_key'
  ) THEN
    RAISE EXCEPTION 'PREFLIGHT_FAILED: expected composite unique constraint name already exists';
  END IF;
  IF EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'storage' AND tablename = 'objects'
      AND policyname IN (
        'report_evidence_insert_active_assignment',
        'report_evidence_select_authorized_participants'
      )
  ) THEN
    RAISE EXCEPTION 'PREFLIGHT_FAILED: report evidence storage policy name already exists';
  END IF;
  IF to_regprocedure('private.can_upload_report_evidence(text)') IS NOT NULL
     OR to_regprocedure('private.can_read_report_evidence(text)') IS NOT NULL THEN
    RAISE EXCEPTION 'PREFLIGHT_FAILED: report evidence helper already exists';
  END IF;
END
$preflight$;

-- Composite keys make the report -> assignment -> test/tester chain enforceable
-- by the database, not merely by client-supplied metadata.
ALTER TABLE public.reports
  ADD CONSTRAINT reports_id_assignment_id_key UNIQUE (id, assignment_id);

ALTER TABLE public.assignments
  ADD CONSTRAINT assignments_id_test_id_tester_id_key UNIQUE (id, test_id, tester_id);

CREATE TABLE public.report_attachments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  report_id uuid NOT NULL,
  assignment_id uuid NOT NULL,
  test_id uuid NOT NULL,
  tester_id uuid NOT NULL,
  file_id uuid NOT NULL,
  file_extension text NOT NULL
    CHECK (file_extension IN ('png', 'jpg', 'jpeg', 'webp', 'txt', 'pdf', 'zip')),
  original_filename text NOT NULL
    CHECK (
      char_length(original_filename) BETWEEN 1 AND 255
      AND original_filename !~ '[[:cntrl:]]'
    ),
  storage_path text GENERATED ALWAYS AS (
    test_id::text || '/' || tester_id::text || '/' ||
    report_id::text || '/' || file_id::text || '.' || file_extension
  ) STORED,
  created_at timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT report_attachments_report_assignment_fk
    FOREIGN KEY (report_id, assignment_id)
    REFERENCES public.reports(id, assignment_id)
    ON DELETE RESTRICT,

  CONSTRAINT report_attachments_assignment_test_tester_fk
    FOREIGN KEY (assignment_id, test_id, tester_id)
    REFERENCES public.assignments(id, test_id, tester_id)
    ON DELETE RESTRICT,

  CONSTRAINT report_attachments_tester_profile_fk
    FOREIGN KEY (tester_id)
    REFERENCES public.profiles(id)
    ON DELETE RESTRICT,

  CONSTRAINT report_attachments_file_id_unique UNIQUE (file_id),
  CONSTRAINT report_attachments_storage_path_unique UNIQUE (storage_path)
);

ALTER TABLE public.report_attachments ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.report_attachments FROM anon, authenticated;
GRANT SELECT, INSERT ON TABLE public.report_attachments TO authenticated;

-- Only the reporting tester may upload while the underlying assignment is active
-- and the report remains open. The object key is parsed and cross-checked against
-- the actual report/assignment/test rows; folder names alone never grant access.
CREATE OR REPLACE FUNCTION private.can_upload_report_evidence(p_object_name text)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $function$
DECLARE
  v_test_id uuid;
  v_tester_id uuid;
  v_report_id uuid;
BEGIN
  IF (SELECT auth.uid()) IS NULL OR p_object_name IS NULL
     OR p_object_name !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.(png|jpg|jpeg|webp|txt|pdf|zip)$'
  THEN
    RETURN false;
  END IF;

  v_test_id := split_part(p_object_name, '/', 1)::uuid;
  v_tester_id := split_part(p_object_name, '/', 2)::uuid;
  v_report_id := split_part(p_object_name, '/', 3)::uuid;

  RETURN EXISTS (
    SELECT 1
    FROM public.reports AS r
    JOIN public.assignments AS a ON a.id = r.assignment_id
    JOIN public.tests AS t ON t.id = a.test_id
    WHERE r.id = v_report_id
      AND r.assignment_id = a.id
      AND r.reporter_id = (SELECT auth.uid())
      AND a.tester_id = (SELECT auth.uid())
      AND a.tester_id = v_tester_id
      AND a.test_id = v_test_id
      AND a.status = 'active'
      AND r.status = 'open'
      AND t.id = v_test_id
  );
EXCEPTION
  WHEN invalid_text_representation THEN
    RETURN false;
END;
$function$;

-- Evidence remains readable for the report's reporter, the developer who owns
-- the tested app, and an Admin. Reported users and Support do not gain access.
CREATE OR REPLACE FUNCTION private.can_read_report_evidence(p_object_name text)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $function$
DECLARE
  v_test_id uuid;
  v_tester_id uuid;
  v_report_id uuid;
BEGIN
  IF (SELECT auth.uid()) IS NULL OR p_object_name IS NULL
     OR p_object_name !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.(png|jpg|jpeg|webp|txt|pdf|zip)$'
  THEN
    RETURN false;
  END IF;

  v_test_id := split_part(p_object_name, '/', 1)::uuid;
  v_tester_id := split_part(p_object_name, '/', 2)::uuid;
  v_report_id := split_part(p_object_name, '/', 3)::uuid;

  RETURN EXISTS (
    SELECT 1
    FROM public.reports AS r
    JOIN public.assignments AS a ON a.id = r.assignment_id
    JOIN public.tests AS t ON t.id = a.test_id
    WHERE r.id = v_report_id
      AND r.assignment_id = a.id
      AND a.test_id = v_test_id
      AND a.tester_id = v_tester_id
      AND (
        r.reporter_id = (SELECT auth.uid())
        OR t.developer_id = (SELECT auth.uid())
        OR (SELECT private.is_admin())
      )
  );
EXCEPTION
  WHEN invalid_text_representation THEN
    RETURN false;
END;
$function$;

REVOKE ALL ON FUNCTION private.can_upload_report_evidence(text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION private.can_read_report_evidence(text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION private.can_upload_report_evidence(text) TO authenticated;
GRANT EXECUTE ON FUNCTION private.can_read_report_evidence(text) TO authenticated;

CREATE POLICY report_attachments_select_authorized
ON public.report_attachments
FOR SELECT
TO authenticated
USING (private.can_read_report_evidence(storage_path));

CREATE POLICY report_attachments_insert_reporter
ON public.report_attachments
FOR INSERT
TO authenticated
WITH CHECK (
  tester_id = (SELECT auth.uid())
  AND private.can_upload_report_evidence(storage_path)
  AND EXISTS (
    SELECT 1
    FROM storage.objects AS o
    WHERE o.bucket_id = 'test-evidence'
      AND o.name = report_attachments.storage_path
  )
);

-- Private bucket: 10 MiB maximum; allow only the explicitly approved MIME types.
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'test-evidence',
  'test-evidence',
  false,
  10485760,
  ARRAY[
    'image/png',
    'image/jpeg',
    'image/webp',
    'text/plain',
    'application/pdf',
    'application/zip'
  ]::text[]
);

CREATE POLICY report_evidence_insert_active_assignment
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'test-evidence'
  AND private.can_upload_report_evidence(name)
);

CREATE POLICY report_evidence_select_authorized_participants
ON storage.objects
FOR SELECT
TO authenticated
USING (
  bucket_id = 'test-evidence'
  AND private.can_read_report_evidence(name)
);

-- Deliberately no UPDATE or DELETE policy and no UPDATE/DELETE table grants.
-- The current reports model has no draft state; user deletion is therefore
-- disabled until a separately designed draft/finalization lifecycle exists.

DO $postflight$
DECLARE
  v_bucket_public boolean;
  v_bucket_limit bigint;
BEGIN
  SELECT public, file_size_limit
  INTO v_bucket_public, v_bucket_limit
  FROM storage.buckets
  WHERE id = 'test-evidence';

  IF NOT FOUND OR v_bucket_public IS DISTINCT FROM false OR v_bucket_limit <> 10485760 THEN
    RAISE EXCEPTION 'POSTFLIGHT_FAILED: private bucket configuration mismatch';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public' AND c.relname = 'report_attachments'
      AND c.relrowsecurity
  ) THEN
    RAISE EXCEPTION 'POSTFLIGHT_FAILED: report_attachments RLS is not enabled';
  END IF;

  IF has_table_privilege('anon', 'public.report_attachments', 'SELECT')
     OR has_table_privilege('authenticated', 'public.report_attachments', 'UPDATE')
     OR has_table_privilege('authenticated', 'public.report_attachments', 'DELETE') THEN
    RAISE EXCEPTION 'POSTFLIGHT_FAILED: unexpected table privileges';
  END IF;

  IF has_function_privilege('anon', 'private.can_upload_report_evidence(text)', 'EXECUTE')
     OR has_function_privilege('anon', 'private.can_read_report_evidence(text)', 'EXECUTE')
     OR EXISTS (
       SELECT 1
       FROM pg_proc AS p
       CROSS JOIN LATERAL aclexplode(
         coalesce(p.proacl, acldefault('f', p.proowner))
       ) AS acl
       WHERE p.oid IN (
         'private.can_upload_report_evidence(text)'::regprocedure,
         'private.can_read_report_evidence(text)'::regprocedure
       )
       AND acl.grantee = 0
       AND acl.privilege_type = 'EXECUTE'
     ) THEN
    RAISE EXCEPTION 'POSTFLIGHT_FAILED: evidence helper execution grants are too broad';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'storage' AND tablename = 'objects'
      AND policyname = 'report_evidence_insert_active_assignment'
      AND cmd = 'INSERT'
  ) OR NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'storage' AND tablename = 'objects'
      AND policyname = 'report_evidence_select_authorized_participants'
      AND cmd = 'SELECT'
  ) THEN
    RAISE EXCEPTION 'POSTFLIGHT_FAILED: expected Storage policies missing';
  END IF;

  IF EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'storage' AND tablename = 'objects'
      AND policyname IN (
        'report_evidence_update_any',
        'report_evidence_delete_any'
      )
  ) THEN
    RAISE EXCEPTION 'POSTFLIGHT_FAILED: unexpected evidence mutation policy';
  END IF;
END
$postflight$;

COMMIT;
