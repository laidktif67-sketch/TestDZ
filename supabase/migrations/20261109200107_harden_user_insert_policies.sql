-- ============================================================
-- Migration: 20261109000200_harden_user_insert_policies.sql
-- Purpose: Prevent client-supplied review/resolution states and
--          enforce ownership relationships on user INSERT paths.
-- Scope: feedback, reports, disputes, tests.
-- Safety: Existing rows are not updated or deleted.
-- ============================================================

BEGIN;

DO $preflight$
DECLARE
  v_required text[] := ARRAY[
    'feedback.assignment_id', 'feedback.tester_id',
    'feedback.quality_status', 'feedback.reviewed_by',
    'feedback.reviewed_at', 'feedback.body', 'feedback.category',
    'feedback.rating', 'feedback.id', 'feedback.created_at',
    'reports.id', 'reports.reporter_id', 'reports.reported_user_id',
    'reports.assignment_id', 'reports.report_type',
    'reports.description', 'reports.status',
    'reports.created_at', 'reports.updated_at',
    'disputes.id', 'disputes.opened_by', 'disputes.payment_id',
    'disputes.report_id', 'disputes.status', 'disputes.resolution',
    'disputes.resolved_by', 'disputes.created_at',
    'disputes.updated_at',
    'tests.id', 'tests.app_id', 'tests.developer_id',
    'tests.title', 'tests.description', 'tests.status',
    'tests.min_testers', 'tests.start_date', 'tests.end_date',
    'tests.created_at', 'tests.updated_at'
  ];
  v_missing text[];
  v_item text;
BEGIN
  IF to_regprocedure('private.is_admin()') IS NULL THEN
    RAISE EXCEPTION 'Required function private.is_admin() is missing';
  END IF;

  FOREACH v_item IN ARRAY v_required LOOP
    IF NOT EXISTS (
      SELECT 1
      FROM information_schema.columns c
      WHERE c.table_schema = 'public'
        AND c.table_name = split_part(v_item, '.', 1)
        AND c.column_name = split_part(v_item, '.', 2)
    ) THEN
      v_missing := array_append(v_missing, v_item);
    END IF;
  END LOOP;

  IF cardinality(v_missing) > 0 THEN
    RAISE EXCEPTION 'Required columns missing: %', array_to_string(v_missing, ', ');
  END IF;

  IF NOT (
    SELECT bool_and(c.relrowsecurity)
    FROM pg_catalog.pg_class c
    JOIN pg_catalog.pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public'
      AND c.relname = ANY (ARRAY['feedback','reports','disputes','tests'])
  ) THEN
    RAISE EXCEPTION 'RLS must be enabled on all four target tables';
  END IF;
END;
$preflight$;

-- Remove table-level and column-level INSERT grants first.
REVOKE INSERT ON TABLE
  public.feedback, public.reports, public.disputes, public.tests
FROM authenticated;

REVOKE INSERT (
  id, assignment_id, tester_id, rating, body, category,
  quality_status, reviewed_by, reviewed_at, created_at
) ON public.feedback FROM authenticated;

REVOKE INSERT (
  id, reporter_id, reported_user_id, assignment_id,
  report_type, description, status, created_at, updated_at
) ON public.reports FROM authenticated;

REVOKE INSERT (
  id, opened_by, payment_id, report_id, status,
  resolution, resolved_by, created_at, updated_at
) ON public.disputes FROM authenticated;

REVOKE INSERT (
  id, app_id, developer_id, title, description, status,
  min_testers, start_date, end_date, created_at, updated_at
) ON public.tests FROM authenticated;

-- Grant only business-input columns. IDs, timestamps, and moderation
-- fields remain database-controlled.
GRANT INSERT (
  assignment_id, tester_id, rating, body, category
) ON public.feedback TO authenticated;

GRANT INSERT (
  reporter_id, reported_user_id, assignment_id,
  report_type, description
) ON public.reports TO authenticated;

GRANT INSERT (
  opened_by, payment_id, report_id
) ON public.disputes TO authenticated;

GRANT INSERT (
  app_id, developer_id, title, description,
  min_testers, start_date, end_date
) ON public.tests TO authenticated;

-- Feedback can only be submitted by the assigned tester and starts pending.
DROP POLICY IF EXISTS feedback_insert_tester ON public.feedback;

CREATE POLICY feedback_insert_tester
ON public.feedback
FOR INSERT
TO authenticated
WITH CHECK (
  tester_id = (SELECT auth.uid())
  AND quality_status = 'pending'
  AND reviewed_by IS NULL
  AND reviewed_at IS NULL
  AND EXISTS (
    SELECT 1
    FROM public.assignments a
    WHERE a.id = feedback.assignment_id
      AND a.tester_id = (SELECT auth.uid())
  )
);

-- Reports start open. If tied to an assignment, the reporter must be
-- one of that assignment's participants (tester or owning developer).
DROP POLICY IF EXISTS reports_insert_reporter ON public.reports;

CREATE POLICY reports_insert_reporter
ON public.reports
FOR INSERT
TO authenticated
WITH CHECK (
  reporter_id = (SELECT auth.uid())
  AND status = 'open'
  AND (
    assignment_id IS NULL
    OR EXISTS (
      SELECT 1
      FROM public.assignments a
      JOIN public.tests t ON t.id = a.test_id
      WHERE a.id = reports.assignment_id
        AND (
          a.tester_id = (SELECT auth.uid())
          OR t.developer_id = (SELECT auth.uid())
        )
    )
  )
);

-- The reports SELECT policy intentionally hides reports from the reported
-- user. Use a narrowly scoped SECURITY DEFINER predicate so that the reported
-- participant can open a dispute without granting broad report visibility.
CREATE OR REPLACE FUNCTION private.is_report_participant(p_report_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $function$
  SELECT EXISTS (
    SELECT 1
    FROM public.reports r
    WHERE r.id = p_report_id
      AND (
        r.reporter_id = (SELECT auth.uid())
        OR r.reported_user_id = (SELECT auth.uid())
      )
  );
$function$;

REVOKE ALL ON FUNCTION private.is_report_participant(uuid)
FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION private.is_report_participant(uuid)
TO authenticated;

-- A dispute must refer to at least one owned/participated-in record.
-- If both references are supplied, both ownership checks must pass.
DROP POLICY IF EXISTS disputes_insert_opener ON public.disputes;

CREATE POLICY disputes_insert_opener
ON public.disputes
FOR INSERT
TO authenticated
WITH CHECK (
  opened_by = (SELECT auth.uid())
  AND status = 'opened'
  AND resolution IS NULL
  AND resolved_by IS NULL
  AND (payment_id IS NOT NULL OR report_id IS NOT NULL)
  AND (
    payment_id IS NULL
    OR EXISTS (
      SELECT 1
      FROM public.payments p
      WHERE p.id = disputes.payment_id
        AND p.user_id = (SELECT auth.uid())
    )
  )
  AND (
    report_id IS NULL
    OR private.is_report_participant(report_id)
  )
);

-- A developer can only create a test for an app owned by the same
-- developer. Admins retain the existing delegated-creation path.
DROP POLICY IF EXISTS tests_insert_owner ON public.tests;

CREATE POLICY tests_insert_owner
ON public.tests
FOR INSERT
TO authenticated
WITH CHECK (
  status = 'recruiting'
  AND EXISTS (
    SELECT 1
    FROM public.apps a
    WHERE a.id = tests.app_id
      AND a.developer_id = tests.developer_id
  )
  AND (
    developer_id = (SELECT auth.uid())
    OR (SELECT private.is_admin())
  )
);

-- Post-flight: verify moderation columns are no longer insertable
-- and permitted business-input columns remain insertable.
DO $verification$
BEGIN
  IF has_column_privilege('authenticated','public.feedback','quality_status','INSERT')
     OR has_column_privilege('authenticated','public.feedback','reviewed_by','INSERT')
     OR has_column_privilege('authenticated','public.feedback','reviewed_at','INSERT')
     OR has_column_privilege('authenticated','public.reports','status','INSERT')
     OR has_column_privilege('authenticated','public.disputes','status','INSERT')
     OR has_column_privilege('authenticated','public.disputes','resolution','INSERT')
     OR has_column_privilege('authenticated','public.disputes','resolved_by','INSERT')
     OR has_column_privilege('authenticated','public.tests','status','INSERT') THEN
    RAISE EXCEPTION 'Protected INSERT column privilege remains';
  END IF;

  IF NOT has_column_privilege('authenticated','public.feedback','body','INSERT')
     OR NOT has_column_privilege('authenticated','public.reports','description','INSERT')
     OR NOT has_column_privilege('authenticated','public.disputes','opened_by','INSERT')
     OR NOT has_column_privilege('authenticated','public.tests','app_id','INSERT') THEN
    RAISE EXCEPTION 'Expected business-input INSERT privilege is missing';
  END IF;
END;
$verification$;

COMMIT;
