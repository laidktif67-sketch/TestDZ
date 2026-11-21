-- Restrict Support to support-workflow data, not raw tester activity or feedback.
-- Candidate V2 only. Replayed exclusively against the disposable local database.

DROP POLICY IF EXISTS assignments_select_tester_staff_v2 ON rebuild_v2.assignments;
CREATE POLICY assignments_select_tester_admin_v2
ON rebuild_v2.assignments
FOR SELECT TO authenticated
USING (
  tester_id = (SELECT auth.uid())
  OR rebuild_v2_private.has_role((SELECT auth.uid()), ARRAY['admin'])
);

DROP POLICY IF EXISTS checkins_select_tester_staff_v2 ON rebuild_v2.checkins;
CREATE POLICY checkins_select_tester_admin_v2
ON rebuild_v2.checkins
FOR SELECT TO authenticated
USING (
  tester_id = (SELECT auth.uid())
  OR rebuild_v2_private.has_role((SELECT auth.uid()), ARRAY['admin'])
);

DROP POLICY IF EXISTS feedback_select_tester_staff_v2 ON rebuild_v2.feedback;
CREATE POLICY feedback_select_tester_admin_v2
ON rebuild_v2.feedback
FOR SELECT TO authenticated
USING (
  tester_id = (SELECT auth.uid())
  OR rebuild_v2_private.has_role((SELECT auth.uid()), ARRAY['admin'])
);
