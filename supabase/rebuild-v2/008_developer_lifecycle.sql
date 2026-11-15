-- TestDZ rebuild V2: developer submission, moderation, test authoring, and cohort setup.
-- Candidate-only SQL. Apply only to isolated TestDZ-FixLab after 001..007.
-- Do not add to supabase/migrations or apply to Production before explicit cutover approval.

CREATE OR REPLACE FUNCTION rebuild_v2_private.submit_app_for_review_impl(p_app_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
SET row_security TO 'off'
AS $function$
DECLARE v_user uuid := auth.uid();
BEGIN
  IF v_user IS NULL THEN RAISE EXCEPTION 'AUTH_REQUIRED' USING errcode='28000'; END IF;
  IF NOT rebuild_v2_private.has_role(v_user,ARRAY['developer','admin']) THEN
    RAISE EXCEPTION 'DEVELOPER_ROLE_REQUIRED' USING errcode='42501';
  END IF;
  UPDATE rebuild_v2.apps
  SET status='submitted',updated_at=now()
  WHERE id=p_app_id AND developer_id=v_user AND status IN ('draft','rejected');
  IF NOT FOUND THEN RAISE EXCEPTION 'APP_NOT_FOUND_OR_NOT_SUBMITTABLE' USING errcode='P0002'; END IF;
  INSERT INTO rebuild_v2.audit_events(actor_id,action,target_type,target_id,reason,metadata)
  VALUES(v_user,'app.submitted','app',p_app_id,'Developer submitted app for review','{}'::jsonb);
END;
$function$;

CREATE OR REPLACE FUNCTION rebuild_v2_private.review_app_impl(
  p_app_id uuid,p_decision text,p_reason text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
SET row_security TO 'off'
AS $function$
DECLARE v_actor uuid := auth.uid();
BEGIN
  IF v_actor IS NULL THEN RAISE EXCEPTION 'AUTH_REQUIRED' USING errcode='28000'; END IF;
  IF NOT rebuild_v2_private.has_role(v_actor,ARRAY['admin']) THEN
    RAISE EXCEPTION 'ADMIN_REQUIRED' USING errcode='42501';
  END IF;
  IF p_decision NOT IN ('approved','rejected') OR p_reason IS NULL OR char_length(btrim(p_reason)) NOT BETWEEN 5 AND 2000 THEN
    RAISE EXCEPTION 'REVIEW_INPUT_INVALID' USING errcode='22023';
  END IF;
  UPDATE rebuild_v2.apps
  SET status=CASE WHEN p_decision='approved' THEN 'published' ELSE 'rejected' END,
      updated_at=now()
  WHERE id=p_app_id AND status='submitted';
  IF NOT FOUND THEN RAISE EXCEPTION 'APP_NOT_PENDING_REVIEW' USING errcode='P0002'; END IF;
  INSERT INTO rebuild_v2.audit_events(actor_id,action,target_type,target_id,reason,metadata)
  VALUES(v_actor,'app.review.'||p_decision,'app',p_app_id,btrim(p_reason),jsonb_build_object('decision',p_decision));
END;
$function$;

CREATE OR REPLACE FUNCTION rebuild_v2_private.create_test_impl(
  p_app_id uuid,p_title text,p_description text,p_short_summary text,
  p_test_type text,p_min_testers integer,p_start_date date,p_end_date date,
  p_duration integer,p_instructions text
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
SET row_security TO 'off'
AS $function$
DECLARE v_user uuid := auth.uid(); v_test_id uuid;
BEGIN
  IF v_user IS NULL THEN RAISE EXCEPTION 'AUTH_REQUIRED' USING errcode='28000'; END IF;
  IF NOT rebuild_v2_private.has_role(v_user,ARRAY['developer','admin']) THEN
    RAISE EXCEPTION 'DEVELOPER_ROLE_REQUIRED' USING errcode='42501';
  END IF;
  IF p_title IS NULL OR char_length(btrim(p_title)) NOT BETWEEN 3 AND 160
     OR p_description IS NULL OR char_length(btrim(p_description)) NOT BETWEEN 20 AND 12000
     OR p_test_type NOT IN ('google_play_closed','apk_testing','bug_discovery','usability','compatibility','custom')
     OR p_min_testers NOT BETWEEN 1 AND 500
     OR (p_start_date IS NOT NULL AND p_end_date IS NOT NULL AND p_end_date<p_start_date)
     OR (p_duration IS NOT NULL AND p_duration NOT BETWEEN 1 AND 1440)
     OR (p_instructions IS NOT NULL AND char_length(p_instructions)>12000) THEN
    RAISE EXCEPTION 'TEST_INPUT_INVALID' USING errcode='22023';
  END IF;
  IF NOT EXISTS(SELECT 1 FROM rebuild_v2.apps a WHERE a.id=p_app_id AND a.developer_id=v_user AND a.status='published') THEN
    RAISE EXCEPTION 'PUBLISHED_OWNED_APP_REQUIRED' USING errcode='42501';
  END IF;
  INSERT INTO rebuild_v2.tests(app_id,developer_id,title,description,short_summary,test_type,status,min_testers,start_date,end_date,estimated_duration_minutes,tester_instructions)
  VALUES(p_app_id,v_user,btrim(p_title),btrim(p_description),NULLIF(btrim(p_short_summary),''),p_test_type,'draft',p_min_testers,p_start_date,p_end_date,p_duration,NULLIF(btrim(p_instructions),''))
  RETURNING id INTO v_test_id;
  INSERT INTO rebuild_v2.audit_events(actor_id,action,target_type,target_id,reason,metadata)
  VALUES(v_user,'test.created','test',v_test_id,'Developer created test',jsonb_build_object('app_id',p_app_id));
  RETURN v_test_id;
END;
$function$;

CREATE OR REPLACE FUNCTION rebuild_v2_private.update_test_impl(
  p_test_id uuid,p_title text,p_description text,p_short_summary text,
  p_test_type text,p_min_testers integer,p_start_date date,p_end_date date,
  p_duration integer,p_instructions text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
SET row_security TO 'off'
AS $function$
DECLARE v_user uuid := auth.uid();
BEGIN
  IF v_user IS NULL THEN RAISE EXCEPTION 'AUTH_REQUIRED' USING errcode='28000'; END IF;
  IF NOT rebuild_v2_private.has_role(v_user,ARRAY['developer','admin']) THEN
    RAISE EXCEPTION 'DEVELOPER_ROLE_REQUIRED' USING errcode='42501';
  END IF;
  IF p_title IS NULL OR char_length(btrim(p_title)) NOT BETWEEN 3 AND 160
     OR p_description IS NULL OR char_length(btrim(p_description)) NOT BETWEEN 20 AND 12000
     OR p_test_type NOT IN ('google_play_closed','apk_testing','bug_discovery','usability','compatibility','custom')
     OR p_min_testers NOT BETWEEN 1 AND 500
     OR (p_start_date IS NOT NULL AND p_end_date IS NOT NULL AND p_end_date<p_start_date)
     OR (p_duration IS NOT NULL AND p_duration NOT BETWEEN 1 AND 1440)
     OR (p_instructions IS NOT NULL AND char_length(p_instructions)>12000) THEN
    RAISE EXCEPTION 'TEST_INPUT_INVALID' USING errcode='22023';
  END IF;
  UPDATE rebuild_v2.tests
  SET title=btrim(p_title),description=btrim(p_description),
      short_summary=NULLIF(btrim(p_short_summary),''),test_type=p_test_type,
      min_testers=p_min_testers,start_date=p_start_date,end_date=p_end_date,
      estimated_duration_minutes=p_duration,tester_instructions=NULLIF(btrim(p_instructions),''),
      updated_at=now()
  WHERE id=p_test_id AND developer_id=v_user AND status IN ('draft','failed','cancelled');
  IF NOT FOUND THEN RAISE EXCEPTION 'TEST_NOT_FOUND_OR_NOT_EDITABLE' USING errcode='P0002'; END IF;
  INSERT INTO rebuild_v2.audit_events(actor_id,action,target_type,target_id,reason,metadata)
  VALUES(v_user,'test.updated','test',p_test_id,'Developer updated test','{}'::jsonb);
END;
$function$;

CREATE OR REPLACE FUNCTION rebuild_v2_private.submit_test_for_review_impl(p_test_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
SET row_security TO 'off'
AS $function$
DECLARE v_user uuid := auth.uid();
BEGIN
  IF v_user IS NULL THEN RAISE EXCEPTION 'AUTH_REQUIRED' USING errcode='28000'; END IF;
  UPDATE rebuild_v2.tests t
  SET status='submitted',updated_at=now()
  WHERE t.id=p_test_id AND t.developer_id=v_user AND t.status IN ('draft','failed','cancelled')
    AND EXISTS(SELECT 1 FROM rebuild_v2.apps a WHERE a.id=t.app_id AND a.developer_id=v_user AND a.status='published');
  IF NOT FOUND THEN RAISE EXCEPTION 'TEST_NOT_FOUND_OR_NOT_SUBMITTABLE' USING errcode='P0002'; END IF;
  INSERT INTO rebuild_v2.audit_events(actor_id,action,target_type,target_id,reason,metadata)
  VALUES(v_user,'test.submitted','test',p_test_id,'Developer submitted test for review','{}'::jsonb);
END;
$function$;

CREATE OR REPLACE FUNCTION rebuild_v2_private.review_test_impl(p_test_id uuid,p_decision text,p_reason text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
SET row_security TO 'off'
AS $function$
DECLARE v_actor uuid := auth.uid();
BEGIN
  IF v_actor IS NULL THEN RAISE EXCEPTION 'AUTH_REQUIRED' USING errcode='28000'; END IF;
  IF NOT rebuild_v2_private.has_role(v_actor,ARRAY['admin']) THEN
    RAISE EXCEPTION 'ADMIN_REQUIRED' USING errcode='42501';
  END IF;
  IF p_decision NOT IN ('approved','rejected') OR p_reason IS NULL OR char_length(btrim(p_reason)) NOT BETWEEN 5 AND 2000 THEN
    RAISE EXCEPTION 'REVIEW_INPUT_INVALID' USING errcode='22023';
  END IF;
  UPDATE rebuild_v2.tests
  SET status=CASE WHEN p_decision='approved' THEN 'recruiting' ELSE 'failed' END,
      updated_at=now()
  WHERE id=p_test_id AND status='submitted';
  IF NOT FOUND THEN RAISE EXCEPTION 'TEST_NOT_PENDING_REVIEW' USING errcode='P0002'; END IF;
  INSERT INTO rebuild_v2.audit_events(actor_id,action,target_type,target_id,reason,metadata)
  VALUES(v_actor,'test.review.'||p_decision,'test',p_test_id,btrim(p_reason),jsonb_build_object('decision',p_decision));
END;
$function$;

CREATE OR REPLACE FUNCTION rebuild_v2_private.create_test_cohort_impl(
  p_test_id uuid,p_name text,p_capacity integer,p_starts_at timestamptz,p_ends_at timestamptz
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
SET row_security TO 'off'
AS $function$
DECLARE v_user uuid := auth.uid(); v_cohort_id uuid;
BEGIN
  IF v_user IS NULL THEN RAISE EXCEPTION 'AUTH_REQUIRED' USING errcode='28000'; END IF;
  IF p_name IS NULL OR char_length(btrim(p_name)) NOT BETWEEN 2 AND 120
     OR p_capacity NOT BETWEEN 1 AND 500
     OR (p_starts_at IS NOT NULL AND p_ends_at IS NOT NULL AND p_ends_at<=p_starts_at) THEN
    RAISE EXCEPTION 'COHORT_INPUT_INVALID' USING errcode='22023';
  END IF;
  IF NOT EXISTS(SELECT 1 FROM rebuild_v2.tests t WHERE t.id=p_test_id AND t.developer_id=v_user AND t.status IN ('recruiting','ready')) THEN
    RAISE EXCEPTION 'OWNED_RECRUITING_TEST_REQUIRED' USING errcode='42501';
  END IF;
  INSERT INTO rebuild_v2.cohorts(name,capacity,status,created_by,starts_at,ends_at)
  VALUES(btrim(p_name),p_capacity,'forming',v_user,p_starts_at,p_ends_at)
  RETURNING id INTO v_cohort_id;
  INSERT INTO rebuild_v2.cohort_tests(cohort_id,test_id,developer_id)
  VALUES(v_cohort_id,p_test_id,v_user);
  INSERT INTO rebuild_v2.audit_events(actor_id,action,target_type,target_id,reason,metadata)
  VALUES(v_user,'cohort.created','cohort',v_cohort_id,'Developer created test cohort',jsonb_build_object('test_id',p_test_id,'capacity',p_capacity));
  RETURN v_cohort_id;
END;
$function$;

CREATE OR REPLACE FUNCTION rebuild_v2.submit_app_for_review(p_app_id uuid)
RETURNS void LANGUAGE sql SECURITY INVOKER SET search_path TO ''
AS $function$ SELECT rebuild_v2_private.submit_app_for_review_impl(p_app_id); $function$;
CREATE OR REPLACE FUNCTION rebuild_v2.review_app(p_app_id uuid,p_decision text,p_reason text)
RETURNS void LANGUAGE sql SECURITY INVOKER SET search_path TO ''
AS $function$ SELECT rebuild_v2_private.review_app_impl(p_app_id,p_decision,p_reason); $function$;
CREATE OR REPLACE FUNCTION rebuild_v2.create_test(p_app_id uuid,p_title text,p_description text,p_short_summary text,p_test_type text,p_min_testers integer,p_start_date date,p_end_date date,p_duration integer,p_instructions text)
RETURNS uuid LANGUAGE sql SECURITY INVOKER SET search_path TO ''
AS $function$ SELECT rebuild_v2_private.create_test_impl(p_app_id,p_title,p_description,p_short_summary,p_test_type,p_min_testers,p_start_date,p_end_date,p_duration,p_instructions); $function$;
CREATE OR REPLACE FUNCTION rebuild_v2.update_test(p_test_id uuid,p_title text,p_description text,p_short_summary text,p_test_type text,p_min_testers integer,p_start_date date,p_end_date date,p_duration integer,p_instructions text)
RETURNS void LANGUAGE sql SECURITY INVOKER SET search_path TO ''
AS $function$ SELECT rebuild_v2_private.update_test_impl(p_test_id,p_title,p_description,p_short_summary,p_test_type,p_min_testers,p_start_date,p_end_date,p_duration,p_instructions); $function$;
CREATE OR REPLACE FUNCTION rebuild_v2.submit_test_for_review(p_test_id uuid)
RETURNS void LANGUAGE sql SECURITY INVOKER SET search_path TO ''
AS $function$ SELECT rebuild_v2_private.submit_test_for_review_impl(p_test_id); $function$;
CREATE OR REPLACE FUNCTION rebuild_v2.review_test(p_test_id uuid,p_decision text,p_reason text)
RETURNS void LANGUAGE sql SECURITY INVOKER SET search_path TO ''
AS $function$ SELECT rebuild_v2_private.review_test_impl(p_test_id,p_decision,p_reason); $function$;
CREATE OR REPLACE FUNCTION rebuild_v2.create_test_cohort(p_test_id uuid,p_name text,p_capacity integer,p_starts_at timestamptz,p_ends_at timestamptz)
RETURNS uuid LANGUAGE sql SECURITY INVOKER SET search_path TO ''
AS $function$ SELECT rebuild_v2_private.create_test_cohort_impl(p_test_id,p_name,p_capacity,p_starts_at,p_ends_at); $function$;

REVOKE ALL ON FUNCTION rebuild_v2_private.submit_app_for_review_impl(uuid) FROM PUBLIC,anon;
REVOKE ALL ON FUNCTION rebuild_v2_private.review_app_impl(uuid,text,text) FROM PUBLIC,anon;
REVOKE ALL ON FUNCTION rebuild_v2_private.create_test_impl(uuid,text,text,text,text,integer,date,date,integer,text) FROM PUBLIC,anon;
REVOKE ALL ON FUNCTION rebuild_v2_private.update_test_impl(uuid,text,text,text,text,integer,date,date,integer,text) FROM PUBLIC,anon;
REVOKE ALL ON FUNCTION rebuild_v2_private.submit_test_for_review_impl(uuid) FROM PUBLIC,anon;
REVOKE ALL ON FUNCTION rebuild_v2_private.review_test_impl(uuid,text,text) FROM PUBLIC,anon;
REVOKE ALL ON FUNCTION rebuild_v2_private.create_test_cohort_impl(uuid,text,integer,timestamptz,timestamptz) FROM PUBLIC,anon;

REVOKE ALL ON FUNCTION rebuild_v2.submit_app_for_review(uuid) FROM PUBLIC,anon;
REVOKE ALL ON FUNCTION rebuild_v2.review_app(uuid,text,text) FROM PUBLIC,anon;
REVOKE ALL ON FUNCTION rebuild_v2.create_test(uuid,text,text,text,text,integer,date,date,integer,text) FROM PUBLIC,anon;
REVOKE ALL ON FUNCTION rebuild_v2.update_test(uuid,text,text,text,text,integer,date,date,integer,text) FROM PUBLIC,anon;
REVOKE ALL ON FUNCTION rebuild_v2.submit_test_for_review(uuid) FROM PUBLIC,anon;
REVOKE ALL ON FUNCTION rebuild_v2.review_test(uuid,text,text) FROM PUBLIC,anon;
REVOKE ALL ON FUNCTION rebuild_v2.create_test_cohort(uuid,text,integer,timestamptz,timestamptz) FROM PUBLIC,anon;

GRANT EXECUTE ON FUNCTION rebuild_v2_private.submit_app_for_review_impl(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION rebuild_v2_private.review_app_impl(uuid,text,text) TO authenticated;
GRANT EXECUTE ON FUNCTION rebuild_v2_private.create_test_impl(uuid,text,text,text,text,integer,date,date,integer,text) TO authenticated;
GRANT EXECUTE ON FUNCTION rebuild_v2_private.update_test_impl(uuid,text,text,text,text,integer,date,date,integer,text) TO authenticated;
GRANT EXECUTE ON FUNCTION rebuild_v2_private.submit_test_for_review_impl(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION rebuild_v2_private.review_test_impl(uuid,text,text) TO authenticated;
GRANT EXECUTE ON FUNCTION rebuild_v2_private.create_test_cohort_impl(uuid,text,integer,timestamptz,timestamptz) TO authenticated;

GRANT EXECUTE ON FUNCTION rebuild_v2.submit_app_for_review(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION rebuild_v2.review_app(uuid,text,text) TO authenticated;
GRANT EXECUTE ON FUNCTION rebuild_v2.create_test(uuid,text,text,text,text,integer,date,date,integer,text) TO authenticated;
GRANT EXECUTE ON FUNCTION rebuild_v2.update_test(uuid,text,text,text,text,integer,date,date,integer,text) TO authenticated;
GRANT EXECUTE ON FUNCTION rebuild_v2.submit_test_for_review(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION rebuild_v2.review_test(uuid,text,text) TO authenticated;
GRANT EXECUTE ON FUNCTION rebuild_v2.create_test_cohort(uuid,text,integer,timestamptz,timestamptz) TO authenticated;
