-- Secure developer cohort management for the V2 candidate.
-- Only the cohort owner may edit a forming cohort or advance its lifecycle.
-- Tester assignment remains exclusively through join_test (capacity-locked).

CREATE OR REPLACE FUNCTION rebuild_v2_private.update_test_cohort_impl(
  p_cohort_id uuid,p_name text,p_capacity integer,p_starts_at timestamptz,p_ends_at timestamptz,p_reason text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
SET row_security TO 'off'
AS $function$
DECLARE
  v_user uuid := auth.uid();
  v_cohort rebuild_v2.cohorts%ROWTYPE;
  v_test rebuild_v2.tests%ROWTYPE;
  v_assigned integer;
BEGIN
  IF v_user IS NULL THEN RAISE EXCEPTION 'AUTH_REQUIRED' USING errcode='28000'; END IF;
  IF NOT rebuild_v2_private.has_role(v_user,ARRAY['developer','admin']) THEN
    RAISE EXCEPTION 'DEVELOPER_ROLE_REQUIRED' USING errcode='42501';
  END IF;
  IF p_cohort_id IS NULL OR p_name IS NULL OR char_length(btrim(p_name)) NOT BETWEEN 2 AND 120
     OR p_capacity NOT BETWEEN 1 AND 500
     OR (p_starts_at IS NOT NULL AND p_ends_at IS NOT NULL AND p_ends_at<=p_starts_at)
     OR p_reason IS NULL OR char_length(btrim(p_reason)) NOT BETWEEN 5 AND 1000 THEN
    RAISE EXCEPTION 'COHORT_UPDATE_INPUT_INVALID' USING errcode='22023';
  END IF;

  SELECT c.* INTO v_cohort
  FROM rebuild_v2.cohorts c
  WHERE c.id=p_cohort_id AND c.created_by=v_user
  FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'COHORT_NOT_FOUND_OR_NOT_OWNED' USING errcode='42501'; END IF;
  IF v_cohort.status<>'forming' THEN
    RAISE EXCEPTION 'COHORT_NOT_EDITABLE' USING errcode='55000';
  END IF;

  SELECT t.* INTO v_test
  FROM rebuild_v2.cohort_tests ct
  JOIN rebuild_v2.tests t ON t.id=ct.test_id AND t.developer_id=ct.developer_id
  WHERE ct.cohort_id=p_cohort_id AND ct.developer_id=v_user
  FOR UPDATE OF t;
  IF NOT FOUND OR v_test.status NOT IN ('recruiting','ready') THEN
    RAISE EXCEPTION 'COHORT_TEST_NOT_EDITABLE' USING errcode='55000';
  END IF;
  IF p_capacity<v_test.min_testers THEN
    RAISE EXCEPTION 'COHORT_CAPACITY_BELOW_TEST_MINIMUM' USING errcode='22023';
  END IF;
  SELECT count(*)::integer INTO v_assigned
  FROM rebuild_v2.assignments a
  WHERE a.cohort_id=p_cohort_id AND a.status NOT IN ('withdrawn','rejected');
  IF p_capacity<v_assigned THEN
    RAISE EXCEPTION 'COHORT_CAPACITY_BELOW_ASSIGNED_COUNT' USING errcode='22023';
  END IF;

  UPDATE rebuild_v2.cohorts
  SET name=btrim(p_name),capacity=p_capacity,starts_at=p_starts_at,ends_at=p_ends_at,updated_at=now()
  WHERE id=p_cohort_id;

  INSERT INTO rebuild_v2.audit_events(actor_id,action,target_type,target_id,reason,metadata)
  VALUES(v_user,'cohort.updated','cohort',p_cohort_id,btrim(p_reason),
    jsonb_build_object('old_capacity',v_cohort.capacity,'new_capacity',p_capacity,'assigned_count',v_assigned));
END;
$function$;

CREATE OR REPLACE FUNCTION rebuild_v2_private.transition_test_cohort_impl(
  p_cohort_id uuid,p_new_status text,p_reason text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
SET row_security TO 'off'
AS $function$
DECLARE
  v_user uuid := auth.uid();
  v_cohort rebuild_v2.cohorts%ROWTYPE;
  v_test rebuild_v2.tests%ROWTYPE;
  v_assigned integer;
  v_active integer;
  v_unfinished integer;
BEGIN
  IF v_user IS NULL THEN RAISE EXCEPTION 'AUTH_REQUIRED' USING errcode='28000'; END IF;
  IF NOT rebuild_v2_private.has_role(v_user,ARRAY['developer','admin']) THEN
    RAISE EXCEPTION 'DEVELOPER_ROLE_REQUIRED' USING errcode='42501';
  END IF;
  IF p_new_status NOT IN ('ready','running','completed','cancelled')
     OR p_reason IS NULL OR char_length(btrim(p_reason)) NOT BETWEEN 5 AND 1000 THEN
    RAISE EXCEPTION 'COHORT_TRANSITION_INPUT_INVALID' USING errcode='22023';
  END IF;

  SELECT c.* INTO v_cohort
  FROM rebuild_v2.cohorts c
  WHERE c.id=p_cohort_id AND c.created_by=v_user
  FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'COHORT_NOT_FOUND_OR_NOT_OWNED' USING errcode='42501'; END IF;

  SELECT t.* INTO v_test
  FROM rebuild_v2.cohort_tests ct
  JOIN rebuild_v2.tests t ON t.id=ct.test_id AND t.developer_id=ct.developer_id
  WHERE ct.cohort_id=p_cohort_id AND ct.developer_id=v_user
  FOR UPDATE OF t;
  IF NOT FOUND THEN RAISE EXCEPTION 'COHORT_TEST_NOT_FOUND' USING errcode='P0002'; END IF;

  PERFORM 1 FROM rebuild_v2.assignments a WHERE a.cohort_id=p_cohort_id FOR UPDATE;

  SELECT count(*) FILTER (WHERE a.status NOT IN ('withdrawn','rejected'))::integer,
         count(*) FILTER (WHERE a.status='active')::integer,
         count(*) FILTER (WHERE a.status IN ('pending','active'))::integer
  INTO v_assigned,v_active,v_unfinished
  FROM rebuild_v2.assignments a
  WHERE a.cohort_id=p_cohort_id;

  IF v_cohort.status='forming' AND p_new_status='ready' THEN
    IF v_test.status NOT IN ('recruiting','ready') OR NOT EXISTS(
      SELECT 1 FROM rebuild_v2.apps a WHERE a.id=v_test.app_id AND a.developer_id=v_test.developer_id AND a.status='published'
    ) THEN RAISE EXCEPTION 'APPROVED_RECRUITING_TEST_REQUIRED' USING errcode='55000'; END IF;
    IF v_assigned<v_test.min_testers THEN
      RAISE EXCEPTION 'COHORT_MINIMUM_TESTERS_NOT_REACHED' USING errcode='55000';
    END IF;
    UPDATE rebuild_v2.cohorts SET status='ready',updated_at=now() WHERE id=p_cohort_id;
    IF v_test.status='recruiting' THEN
      UPDATE rebuild_v2.tests SET status='ready',updated_at=now() WHERE id=v_test.id AND status='recruiting';
    END IF;
  ELSIF v_cohort.status='ready' AND p_new_status='running' THEN
    UPDATE rebuild_v2.cohorts SET status='running',updated_at=now() WHERE id=p_cohort_id;
    IF v_test.status='ready' THEN
      UPDATE rebuild_v2.tests SET status='running',updated_at=now() WHERE id=v_test.id AND status='ready';
    END IF;
  ELSIF v_cohort.status='running' AND p_new_status='completed' THEN
    IF v_unfinished>0 THEN RAISE EXCEPTION 'COHORT_HAS_UNFINISHED_ASSIGNMENTS' USING errcode='55000'; END IF;
    UPDATE rebuild_v2.cohorts SET status='completed',updated_at=now() WHERE id=p_cohort_id;
    IF v_test.status='running' AND NOT EXISTS(
      SELECT 1 FROM rebuild_v2.cohort_tests ct
      JOIN rebuild_v2.cohorts c ON c.id=ct.cohort_id
      WHERE ct.test_id=v_test.id AND c.id<>p_cohort_id
        AND c.status IN ('forming','ready','running')
    ) THEN
      UPDATE rebuild_v2.tests SET status='completed',updated_at=now() WHERE id=v_test.id AND status='running';
    END IF;
  ELSIF v_cohort.status IN ('forming','ready') AND p_new_status='cancelled' THEN
    IF v_active>0 THEN RAISE EXCEPTION 'COHORT_HAS_ACTIVE_ASSIGNMENTS' USING errcode='55000'; END IF;
    UPDATE rebuild_v2.assignments SET status='withdrawn'
    WHERE cohort_id=p_cohort_id AND status='pending';
    UPDATE rebuild_v2.cohorts SET status='cancelled',updated_at=now() WHERE id=p_cohort_id;
  ELSE
    RAISE EXCEPTION 'COHORT_TRANSITION_NOT_ALLOWED' USING errcode='55000';
  END IF;

  INSERT INTO rebuild_v2.audit_events(actor_id,action,target_type,target_id,reason,metadata)
  VALUES(v_user,'cohort.status.'||p_new_status,'cohort',p_cohort_id,btrim(p_reason),
    jsonb_build_object('old_status',v_cohort.status,'new_status',p_new_status,'assigned_count',v_assigned,'active_count',v_active));
END;
$function$;

CREATE OR REPLACE FUNCTION rebuild_v2.update_test_cohort(
  p_cohort_id uuid,p_name text,p_capacity integer,p_starts_at timestamptz,p_ends_at timestamptz,p_reason text
)
RETURNS void LANGUAGE sql SECURITY INVOKER SET search_path TO ''
AS $function$ SELECT rebuild_v2_private.update_test_cohort_impl(p_cohort_id,p_name,p_capacity,p_starts_at,p_ends_at,p_reason); $function$;

CREATE OR REPLACE FUNCTION rebuild_v2.transition_test_cohort(
  p_cohort_id uuid,p_new_status text,p_reason text
)
RETURNS void LANGUAGE sql SECURITY INVOKER SET search_path TO ''
AS $function$ SELECT rebuild_v2_private.transition_test_cohort_impl(p_cohort_id,p_new_status,p_reason); $function$;

REVOKE ALL ON FUNCTION rebuild_v2_private.update_test_cohort_impl(uuid,text,integer,timestamptz,timestamptz,text) FROM PUBLIC,anon;
REVOKE ALL ON FUNCTION rebuild_v2_private.transition_test_cohort_impl(uuid,text,text) FROM PUBLIC,anon;
REVOKE ALL ON FUNCTION rebuild_v2.update_test_cohort(uuid,text,integer,timestamptz,timestamptz,text) FROM PUBLIC,anon;
REVOKE ALL ON FUNCTION rebuild_v2.transition_test_cohort(uuid,text,text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION rebuild_v2_private.update_test_cohort_impl(uuid,text,integer,timestamptz,timestamptz,text) TO authenticated;
GRANT EXECUTE ON FUNCTION rebuild_v2_private.transition_test_cohort_impl(uuid,text,text) TO authenticated;
GRANT EXECUTE ON FUNCTION rebuild_v2.update_test_cohort(uuid,text,integer,timestamptz,timestamptz,text) TO authenticated;
GRANT EXECUTE ON FUNCTION rebuild_v2.transition_test_cohort(uuid,text,text) TO authenticated;
