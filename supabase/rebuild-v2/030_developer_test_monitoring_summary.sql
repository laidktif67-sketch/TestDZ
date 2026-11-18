-- Privacy-preserving Developer test monitoring.
-- Developers receive aggregate campaign metrics only; individual tester assignments,
-- check-in notes/evidence paths, and raw feedback remain inaccessible under V2 RLS.
-- Candidate-only: replay on a disposable rebuild_v2 database. Never Production without cutover approval.

CREATE OR REPLACE FUNCTION rebuild_v2_private.get_developer_test_monitoring_impl(p_test_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO ''
SET row_security TO 'off'
AS $function$
DECLARE
  v_user uuid := auth.uid();
  v_result jsonb;
BEGIN
  IF v_user IS NULL OR NOT rebuild_v2_private.has_role(v_user,ARRAY['developer']) THEN
    RAISE EXCEPTION 'DEVELOPER_ROLE_REQUIRED' USING errcode='42501';
  END IF;
  IF p_test_id IS NULL THEN
    RAISE EXCEPTION 'TEST_ID_REQUIRED' USING errcode='22023';
  END IF;

  SELECT jsonb_build_object(
    'test',jsonb_build_object(
      'id',t.id,
      'title',t.title,
      'description',t.description,
      'shortSummary',t.short_summary,
      'testType',t.test_type,
      'status',t.status,
      'minTesters',t.min_testers,
      'startDate',t.start_date,
      'endDate',t.end_date,
      'durationMinutes',t.estimated_duration_minutes,
      'instructions',t.tester_instructions,
      'appName',a.name,
      'appIconUrl',a.icon_url
    ),
    'configuration',jsonb_build_object(
      'objective',t.test_config #>> '{details,testingObjective}',
      'priority',t.test_config #>> '{details,priority}',
      'scope',COALESCE(t.test_config #> '{details,testingScope}','[]'::jsonb),
      'successCriteria',t.test_config #>> '{details,successCriteria}',
      'minimumCompletionRate',t.test_config #> '{details,minimumCompletionRate}',
      'androidVersion',t.test_config #>> '{rules,androidVersion}',
      'cohortNotes',t.test_config #>> '{cohort,notes}',
      'durationDays',t.test_config #> '{schedule,durationDays}',
      'allowMoreTesters',t.test_config #> '{schedule,allowMoreTesters}',
      'joiningMethod',t.test_config #>> '{schedule,joiningMethod}',
      'collectFeedback',t.test_config #> '{schedule,collectFeedback}',
      'enableBugReports',t.test_config #> '{schedule,enableBugReports}',
      'playTrack',t.test_config #>> '{googlePlay,track}',
      'testerMethod',t.test_config #>> '{googlePlay,testerMethod}',
      'appVersion',t.test_config #>> '{googlePlay,appVersion}',
      'releaseMode',t.test_config #>> '{googlePlay,releaseMode}',
      'releaseAt',t.test_config #>> '{googlePlay,releaseAt}'
    ),
    'metrics',jsonb_build_object(
      'totalAssignments',m.total_assignments,
      'uniqueTesters',m.unique_testers,
      'pending',m.pending_count,
      'active',m.active_count,
      'completed',m.completed_count,
      'failed',m.failed_count,
      'withdrawn',m.withdrawn_count,
      'rejected',m.rejected_count,
      'completionRate',CASE WHEN m.total_assignments=0 THEN 0
        ELSE round((m.completed_count::numeric*100)/m.total_assignments,1) END,
      'checkins',m.checkin_count,
      'feedbackCount',m.feedback_count,
      'averageRating',m.average_rating,
      'feedbackPending',m.feedback_pending,
      'feedbackAccepted',m.feedback_accepted,
      'feedbackRejected',m.feedback_rejected
    ),
    'dailyActivity',COALESCE((
      WITH events AS (
        SELECT a.assigned_at AS occurred_at,a.tester_id
        FROM rebuild_v2.assignments a WHERE a.test_id=t.id
        UNION ALL
        SELECT a.started_at,a.tester_id FROM rebuild_v2.assignments a
        WHERE a.test_id=t.id AND a.started_at IS NOT NULL
        UNION ALL
        SELECT a.completed_at,a.tester_id FROM rebuild_v2.assignments a
        WHERE a.test_id=t.id AND a.completed_at IS NOT NULL
        UNION ALL
        SELECT c.created_at,c.tester_id FROM rebuild_v2.checkins c
        JOIN rebuild_v2.assignments a ON a.id=c.assignment_id
        WHERE a.test_id=t.id
        UNION ALL
        SELECT f.created_at,f.tester_id FROM rebuild_v2.feedback f
        JOIN rebuild_v2.assignments a ON a.id=f.assignment_id
        WHERE a.test_id=t.id
      ), daily AS (
        SELECT (e.occurred_at AT TIME ZONE 'Africa/Algiers')::date AS activity_date,
               count(*)::integer AS activity_count
        FROM events e
        WHERE e.occurred_at >= (((now() AT TIME ZONE 'Africa/Algiers')::date - 6)::timestamp
          AT TIME ZONE 'Africa/Algiers')
        GROUP BY (e.occurred_at AT TIME ZONE 'Africa/Algiers')::date
        HAVING count(DISTINCT e.tester_id) >= 3
      )
      SELECT jsonb_agg(jsonb_build_object('date',d.activity_date,'count',d.activity_count)
        ORDER BY d.activity_date)
      FROM daily d
    ),'[]'::jsonb)
  )
  INTO v_result
  FROM rebuild_v2.tests t
  JOIN rebuild_v2.apps a ON a.id=t.app_id AND a.developer_id=t.developer_id
  CROSS JOIN LATERAL (
    SELECT
      count(*)::integer AS total_assignments,
      count(DISTINCT x.tester_id)::integer AS unique_testers,
      count(*) FILTER (WHERE x.status='pending')::integer AS pending_count,
      count(*) FILTER (WHERE x.status='active')::integer AS active_count,
      count(*) FILTER (WHERE x.status='completed')::integer AS completed_count,
      count(*) FILTER (WHERE x.status='failed')::integer AS failed_count,
      count(*) FILTER (WHERE x.status='withdrawn')::integer AS withdrawn_count,
      count(*) FILTER (WHERE x.status='rejected')::integer AS rejected_count,
      (SELECT count(*)::integer
       FROM rebuild_v2.checkins c
       JOIN rebuild_v2.assignments ca ON ca.id=c.assignment_id
       WHERE ca.test_id=t.id) AS checkin_count,
      (SELECT count(*)::integer
       FROM rebuild_v2.feedback f
       JOIN rebuild_v2.assignments fa ON fa.id=f.assignment_id
       WHERE fa.test_id=t.id) AS feedback_count,
      (SELECT round(avg(f.rating)::numeric,2)
       FROM rebuild_v2.feedback f
       JOIN rebuild_v2.assignments fa ON fa.id=f.assignment_id
       WHERE fa.test_id=t.id AND f.rating IS NOT NULL) AS average_rating,
      (SELECT count(*)::integer
       FROM rebuild_v2.feedback f
       JOIN rebuild_v2.assignments fa ON fa.id=f.assignment_id
       WHERE fa.test_id=t.id AND f.quality_status='pending') AS feedback_pending,
      (SELECT count(*)::integer
       FROM rebuild_v2.feedback f
       JOIN rebuild_v2.assignments fa ON fa.id=f.assignment_id
       WHERE fa.test_id=t.id AND f.quality_status='accepted') AS feedback_accepted,
      (SELECT count(*)::integer
       FROM rebuild_v2.feedback f
       JOIN rebuild_v2.assignments fa ON fa.id=f.assignment_id
       WHERE fa.test_id=t.id AND f.quality_status='rejected') AS feedback_rejected
    FROM rebuild_v2.assignments x
    WHERE x.test_id=t.id
  ) m
  WHERE t.id=p_test_id AND t.developer_id=v_user;

  IF v_result IS NULL THEN
    RAISE EXCEPTION 'TEST_NOT_FOUND_OR_NOT_OWNED' USING errcode='42501';
  END IF;
  RETURN v_result;
END;
$function$;

CREATE OR REPLACE FUNCTION rebuild_v2.get_developer_test_monitoring(p_test_id uuid)
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path TO ''
AS $function$
  SELECT rebuild_v2_private.get_developer_test_monitoring_impl(p_test_id);
$function$;

REVOKE ALL ON FUNCTION rebuild_v2_private.get_developer_test_monitoring_impl(uuid) FROM PUBLIC,anon;
REVOKE ALL ON FUNCTION rebuild_v2.get_developer_test_monitoring(uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION rebuild_v2_private.get_developer_test_monitoring_impl(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION rebuild_v2.get_developer_test_monitoring(uuid) TO authenticated;
