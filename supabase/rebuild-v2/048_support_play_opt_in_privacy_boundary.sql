-- Keep Support inside the support-ticket workflow; Play opt-in history is
-- tester activity and may contain evidence URLs and private notes.
-- Candidate V2 migration only. Replayed only against the disposable local database.
BEGIN;

DROP POLICY IF EXISTS play_opt_in_select_participants_v2
  ON rebuild_v2.play_opt_in_events;

CREATE POLICY play_opt_in_select_participants_v2
ON rebuild_v2.play_opt_in_events
AS PERMISSIVE
FOR SELECT TO authenticated
USING (
  tester_id = (SELECT auth.uid())
  OR rebuild_v2_private.has_role((SELECT auth.uid()), ARRAY['admin'])
  OR EXISTS (
    SELECT 1
    FROM rebuild_v2.assignments a
    JOIN rebuild_v2.tests t ON t.id = a.test_id
    WHERE a.id = play_opt_in_events.assignment_id
      AND t.developer_id = (SELECT auth.uid())
  )
);

COMMENT ON POLICY play_opt_in_select_participants_v2
  ON rebuild_v2.play_opt_in_events IS
  'Tester, Admin, and the owning Developer only; Support must use the support-ticket workflow and cannot read raw Play opt-in activity.';

COMMIT;
