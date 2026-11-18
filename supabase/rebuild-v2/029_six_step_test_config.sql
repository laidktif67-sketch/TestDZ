-- Candidate-only: preserve the legacy six-step test configuration without accepting arbitrary JSON or PII.
-- Apply only to the disposable rebuild_v2 test database; never to Production without cutover approval.

CREATE OR REPLACE FUNCTION rebuild_v2_private.validate_six_step_test_config(p_config jsonb)
RETURNS void
LANGUAGE plpgsql
IMMUTABLE
SET search_path TO ''
AS $function$
DECLARE v_key text; v_scope jsonb;
BEGIN
  IF p_config IS NULL OR jsonb_typeof(p_config) <> 'object'
     OR (p_config - ARRAY['cohort','rules','details','schedule','googlePlay']) <> '{}'::jsonb
     OR NOT (p_config ?& ARRAY['cohort','rules','details','schedule','googlePlay']) THEN
    RAISE EXCEPTION 'SIX_STEP_CONFIG_INVALID' USING errcode='22023';
  END IF;

  FOREACH v_key IN ARRAY ARRAY['cohort','rules','details','schedule','googlePlay'] LOOP
    IF jsonb_typeof(p_config->v_key) <> 'object' THEN
      RAISE EXCEPTION 'SIX_STEP_CONFIG_INVALID' USING errcode='22023';
    END IF;
  END LOOP;

  IF NOT (p_config->'cohort' ?& ARRAY['targetTesters','notes'])
     OR (p_config->'cohort' - ARRAY['targetTesters','notes']) <> '{}'::jsonb
     OR jsonb_typeof(p_config->'cohort'->'targetTesters') IS DISTINCT FROM 'number'
     OR (p_config->'cohort'->>'targetTesters')::integer NOT BETWEEN 1 AND 500
     OR (p_config->'cohort' ? 'notes' AND jsonb_typeof(p_config->'cohort'->'notes') NOT IN ('string','null'))
     OR char_length(coalesce(p_config->'cohort'->>'notes','')) > 2000 THEN
    RAISE EXCEPTION 'SIX_STEP_CONFIG_INVALID' USING errcode='22023';
  END IF;

  IF NOT (p_config->'rules' ?& ARRAY['androidVersion','instructions'])
     OR (p_config->'rules' - ARRAY['androidVersion','instructions']) <> '{}'::jsonb
     OR jsonb_typeof(p_config->'rules'->'androidVersion') IS DISTINCT FROM 'string'
     OR char_length(p_config->'rules'->>'androidVersion') NOT BETWEEN 1 AND 80
     OR (p_config->'rules' ? 'instructions' AND jsonb_typeof(p_config->'rules'->'instructions') NOT IN ('string','null'))
     OR char_length(coalesce(p_config->'rules'->>'instructions','')) > 12000 THEN
    RAISE EXCEPTION 'SIX_STEP_CONFIG_INVALID' USING errcode='22023';
  END IF;

  IF NOT (p_config->'details' ?& ARRAY['testingObjective','priority','testingScope','successCriteria','minimumCompletionRate'])
     OR (p_config->'details' - ARRAY['testingObjective','priority','testingScope','successCriteria','minimumCompletionRate']) <> '{}'::jsonb
     OR p_config->'details'->>'testingObjective' NOT IN ('stability_bugs','usability','compatibility','performance','release_readiness','custom')
     OR jsonb_typeof(p_config->'details'->'testingObjective') IS DISTINCT FROM 'string'
     OR jsonb_typeof(p_config->'details'->'priority') IS DISTINCT FROM 'string'
     OR p_config->'details'->>'priority' NOT IN ('low','medium','high')
     OR jsonb_typeof(p_config->'details'->'testingScope') IS DISTINCT FROM 'array'
     OR jsonb_array_length(p_config->'details'->'testingScope') NOT BETWEEN 1 AND 10
     OR jsonb_typeof(p_config->'details'->'minimumCompletionRate') IS DISTINCT FROM 'number'
     OR (p_config->'details'->>'minimumCompletionRate')::numeric NOT BETWEEN 1 AND 100
     OR (p_config->'details' ? 'successCriteria' AND jsonb_typeof(p_config->'details'->'successCriteria') NOT IN ('string','null'))
     OR char_length(coalesce(p_config->'details'->>'successCriteria','')) > 2000 THEN
    RAISE EXCEPTION 'SIX_STEP_CONFIG_INVALID' USING errcode='22023';
  END IF;
  v_scope := p_config->'details'->'testingScope';
  IF EXISTS (SELECT 1 FROM jsonb_array_elements(v_scope) AS scope(value) WHERE jsonb_typeof(scope.value) IS DISTINCT FROM 'string' OR scope.value#>>'{}' NOT IN ('core_flows','performance','compatibility','accessibility')) THEN
    RAISE EXCEPTION 'SIX_STEP_CONFIG_INVALID' USING errcode='22023';
  END IF;

  IF NOT (p_config->'schedule' ?& ARRAY['durationDays','allowMoreTesters','joiningMethod','collectFeedback','enableBugReports'])
     OR (p_config->'schedule' - ARRAY['durationDays','allowMoreTesters','joiningMethod','collectFeedback','enableBugReports']) <> '{}'::jsonb
     OR jsonb_typeof(p_config->'schedule'->'allowMoreTesters') IS DISTINCT FROM 'boolean'
     OR jsonb_typeof(p_config->'schedule'->'collectFeedback') IS DISTINCT FROM 'boolean'
     OR jsonb_typeof(p_config->'schedule'->'enableBugReports') IS DISTINCT FROM 'boolean'
     OR jsonb_typeof(p_config->'schedule'->'joiningMethod') IS DISTINCT FROM 'string'
     OR p_config->'schedule'->>'joiningMethod' NOT IN ('google_play_link','closed_group','upload_list','open_testing')
     OR (p_config->'schedule'->'durationDays' <> 'null'::jsonb AND
         (jsonb_typeof(p_config->'schedule'->'durationDays') <> 'number' OR (p_config->'schedule'->>'durationDays')::integer NOT BETWEEN 1 AND 365)) THEN
    RAISE EXCEPTION 'SIX_STEP_CONFIG_INVALID' USING errcode='22023';
  END IF;

  -- Deliberately no googleGroup/testerEmails fields: invitation identifiers and raw CSV addresses stay local.
  IF NOT (p_config->'googlePlay' ?& ARRAY['track','testerMethod','appVersion','releaseMode','releaseAt'])
     OR (p_config->'googlePlay' - ARRAY['track','testerMethod','appVersion','releaseMode','releaseAt']) <> '{}'::jsonb
     OR jsonb_typeof(p_config->'googlePlay'->'track') IS DISTINCT FROM 'string'
     OR p_config->'googlePlay'->>'track' NOT IN ('internal','closed','open')
     OR jsonb_typeof(p_config->'googlePlay'->'testerMethod') IS DISTINCT FROM 'string'
     OR p_config->'googlePlay'->>'testerMethod' NOT IN ('join_link','google_groups','upload_list')
     OR jsonb_typeof(p_config->'googlePlay'->'appVersion') IS DISTINCT FROM 'string'
     OR p_config->'googlePlay'->>'appVersion' NOT IN ('latest_available','to_be_uploaded')
     OR jsonb_typeof(p_config->'googlePlay'->'releaseMode') IS DISTINCT FROM 'string'
     OR p_config->'googlePlay'->>'releaseMode' NOT IN ('immediately','scheduled')
     OR (p_config->'googlePlay' ? 'releaseAt' AND jsonb_typeof(p_config->'googlePlay'->'releaseAt') NOT IN ('string','null'))
     OR char_length(coalesce(p_config->'googlePlay'->>'releaseAt','')) > 40
     OR (p_config->'googlePlay'->>'releaseMode'='scheduled' AND nullif(btrim(p_config->'googlePlay'->>'releaseAt'),'') IS NULL)
     OR (p_config->'googlePlay'->>'releaseMode'='immediately' AND p_config->'googlePlay'->'releaseAt' <> 'null'::jsonb) THEN
    RAISE EXCEPTION 'SIX_STEP_CONFIG_INVALID' USING errcode='22023';
  END IF;
END;
$function$;

CREATE OR REPLACE FUNCTION rebuild_v2_private.create_test_with_config_impl(
  p_app_id uuid,p_title text,p_description text,p_short_summary text,
  p_test_type text,p_min_testers integer,p_start_date date,p_end_date date,
  p_duration integer,p_instructions text,p_test_config jsonb
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
SET row_security TO 'off'
AS $function$
DECLARE v_test_id uuid; v_user uuid := auth.uid();
BEGIN
  IF v_user IS NULL THEN RAISE EXCEPTION 'AUTH_REQUIRED' USING errcode='28000'; END IF;
  IF NOT rebuild_v2_private.has_role(v_user,ARRAY['developer','admin']) THEN
    RAISE EXCEPTION 'DEVELOPER_ROLE_REQUIRED' USING errcode='42501';
  END IF;
  PERFORM rebuild_v2_private.validate_six_step_test_config(p_test_config);
  v_test_id := rebuild_v2_private.create_test_impl(
    p_app_id,p_title,p_description,p_short_summary,p_test_type,p_min_testers,
    p_start_date,p_end_date,p_duration,p_instructions
  );
  UPDATE rebuild_v2.tests SET test_config=p_test_config,updated_at=now()
  WHERE id=v_test_id AND developer_id=v_user AND status='draft';
  IF NOT FOUND THEN RAISE EXCEPTION 'TEST_CONFIG_SAVE_FAILED' USING errcode='55000'; END IF;
  INSERT INTO rebuild_v2.audit_events(actor_id,action,target_type,target_id,reason,metadata)
  VALUES(v_user,'test.six_step_config.saved','test',v_test_id,'Developer saved validated six-step configuration',
    jsonb_build_object('test_type',p_test_type,'config_version',1));
  RETURN v_test_id;
END;
$function$;

CREATE OR REPLACE FUNCTION rebuild_v2.create_test_with_config(
  p_app_id uuid,p_title text,p_description text,p_short_summary text,
  p_test_type text,p_min_testers integer,p_start_date date,p_end_date date,
  p_duration integer,p_instructions text,p_test_config jsonb
)
RETURNS uuid
LANGUAGE sql
SECURITY INVOKER
SET search_path TO ''
AS $function$
  SELECT rebuild_v2_private.create_test_with_config_impl(
    p_app_id,p_title,p_description,p_short_summary,p_test_type,p_min_testers,
    p_start_date,p_end_date,p_duration,p_instructions,p_test_config
  );
$function$;

REVOKE ALL ON FUNCTION rebuild_v2_private.validate_six_step_test_config(jsonb) FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION rebuild_v2_private.create_test_with_config_impl(uuid,text,text,text,text,integer,date,date,integer,text,jsonb) FROM PUBLIC,anon;
REVOKE ALL ON FUNCTION rebuild_v2.create_test_with_config(uuid,text,text,text,text,integer,date,date,integer,text,jsonb) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION rebuild_v2_private.create_test_with_config_impl(uuid,text,text,text,text,integer,date,date,integer,text,jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION rebuild_v2.create_test_with_config(uuid,text,text,text,text,integer,date,date,integer,text,jsonb) TO authenticated;
