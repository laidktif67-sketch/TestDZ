-- Ensure each developer cohort is usable by the approved test and a currently published app.
-- Candidate-only patch; apply to isolated FixLab after 009. Never Production without cutover approval.

CREATE OR REPLACE FUNCTION rebuild_v2_private.create_test_cohort_impl(
  p_test_id uuid,p_name text,p_capacity integer,p_starts_at timestamptz,p_ends_at timestamptz
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
SET row_security TO 'off'
AS $function$
DECLARE v_user uuid := auth.uid(); v_cohort_id uuid; v_min_testers integer;
BEGIN
  IF v_user IS NULL THEN RAISE EXCEPTION 'AUTH_REQUIRED' USING errcode='28000'; END IF;
  IF NOT rebuild_v2_private.has_role(v_user,ARRAY['developer','admin']) THEN
    RAISE EXCEPTION 'DEVELOPER_ROLE_REQUIRED' USING errcode='42501';
  END IF;
  IF p_name IS NULL OR char_length(btrim(p_name)) NOT BETWEEN 2 AND 120
     OR p_capacity NOT BETWEEN 1 AND 500
     OR (p_starts_at IS NOT NULL AND p_ends_at IS NOT NULL AND p_ends_at<=p_starts_at) THEN
    RAISE EXCEPTION 'COHORT_INPUT_INVALID' USING errcode='22023';
  END IF;
  SELECT t.min_testers INTO v_min_testers
  FROM rebuild_v2.tests t
  JOIN rebuild_v2.apps a ON a.id=t.app_id AND a.developer_id=t.developer_id
  WHERE t.id=p_test_id AND t.developer_id=v_user
    AND t.status IN ('recruiting','ready') AND a.status='published';
  IF NOT FOUND THEN RAISE EXCEPTION 'OWNED_RECRUITING_TEST_WITH_PUBLISHED_APP_REQUIRED' USING errcode='42501'; END IF;
  IF p_capacity<v_min_testers THEN
    RAISE EXCEPTION 'COHORT_CAPACITY_BELOW_TEST_MINIMUM' USING errcode='22023';
  END IF;
  INSERT INTO rebuild_v2.cohorts(name,capacity,status,created_by,starts_at,ends_at)
  VALUES(btrim(p_name),p_capacity,'forming',v_user,p_starts_at,p_ends_at)
  RETURNING id INTO v_cohort_id;
  INSERT INTO rebuild_v2.cohort_tests(cohort_id,test_id,developer_id)
  VALUES(v_cohort_id,p_test_id,v_user);
  INSERT INTO rebuild_v2.audit_events(actor_id,action,target_type,target_id,reason,metadata)
  VALUES(v_user,'cohort.created','cohort',v_cohort_id,'Developer created test cohort',jsonb_build_object('test_id',p_test_id,'capacity',p_capacity,'minimum_testers',v_min_testers));
  RETURN v_cohort_id;
END;
$function$;

REVOKE ALL ON FUNCTION rebuild_v2_private.create_test_cohort_impl(uuid,text,integer,timestamptz,timestamptz) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION rebuild_v2_private.create_test_cohort_impl(uuid,text,integer,timestamptz,timestamptz) TO authenticated;
