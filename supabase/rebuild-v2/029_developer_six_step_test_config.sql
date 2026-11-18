-- Preserve the legacy six-step developer test configuration in V2.
-- Candidate only: replay on a disposable local Supabase database.
-- This RPC creates the test and stores an allowlisted configuration atomically.
-- It intentionally excludes tester email lists, Google Group addresses, and
-- external release/invitation side effects.

BEGIN;

CREATE OR REPLACE FUNCTION rebuild_v2_private.create_test_with_config_impl(
  p_app_id uuid,
  p_title text,
  p_description text,
  p_short_summary text,
  p_test_type text,
  p_min_testers integer,
  p_start_date date,
  p_end_date date,
  p_duration integer,
  p_instructions text,
  p_test_config jsonb
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
SET row_security TO 'off'
AS $function$
DECLARE
  v_user uuid := auth.uid();
  v_test_id uuid;
  v_group jsonb;
  v_rules jsonb;
  v_details jsonb;
  v_schedule jsonb;
  v_google jsonb;
  v_scope_count integer;
  v_scope_distinct integer;
BEGIN
  IF v_user IS NULL THEN
    RAISE EXCEPTION 'AUTH_REQUIRED' USING errcode='28000';
  END IF;
  IF NOT rebuild_v2_private.has_role(v_user,ARRAY['developer','admin']) THEN
    RAISE EXCEPTION 'DEVELOPER_ROLE_REQUIRED' USING errcode='42501';
  END IF;

  IF p_test_config IS NULL OR jsonb_typeof(p_test_config) <> 'object'
     OR jsonb_object_length(p_test_config) <> 5
     OR NOT (p_test_config ?& ARRAY['cohort','rules','details','schedule','googlePlay'])
     OR (p_test_config - ARRAY['cohort','rules','details','schedule','googlePlay']::text[]) <> '{}'::jsonb THEN
    RAISE EXCEPTION 'TEST_CONFIG_SHAPE_INVALID' USING errcode='22023';
  END IF;

  v_group := p_test_config->'cohort';
  v_rules := p_test_config->'rules';
  v_details := p_test_config->'details';
  v_schedule := p_test_config->'schedule';
  v_google := p_test_config->'googlePlay';

  IF jsonb_typeof(v_group) <> 'object' OR jsonb_object_length(v_group) <> 2
     OR NOT (v_group ?& ARRAY['targetTesters','notes'])
     OR (v_group - ARRAY['targetTesters','notes']::text[]) <> '{}'::jsonb
     OR jsonb_typeof(v_group->'targetTesters') <> 'number'
     OR (v_group->>'targetTesters') !~ '^[0-9]{1,3}$'
     OR (v_group->>'targetTesters')::integer NOT BETWEEN 1 AND 500
     OR (v_group->>'targetTesters')::integer <> p_min_testers
     OR (v_group->'notes' <> 'null'::jsonb AND
         (jsonb_typeof(v_group->'notes') <> 'string' OR char_length(v_group->>'notes') > 1000)) THEN
    RAISE EXCEPTION 'TEST_CONFIG_COHORT_INVALID' USING errcode='22023';
  END IF;

  IF jsonb_typeof(v_rules) <> 'object' OR jsonb_object_length(v_rules) <> 2
     OR NOT (v_rules ?& ARRAY['androidVersion','instructions'])
     OR (v_rules - ARRAY['androidVersion','instructions']::text[]) <> '{}'::jsonb
     OR jsonb_typeof(v_rules->'androidVersion') <> 'string'
     OR char_length(v_rules->>'androidVersion') NOT BETWEEN 1 AND 80
     OR (v_rules->'instructions' <> 'null'::jsonb AND
         (jsonb_typeof(v_rules->'instructions') <> 'string' OR char_length(v_rules->>'instructions') > 12000)) THEN
    RAISE EXCEPTION 'TEST_CONFIG_RULES_INVALID' USING errcode='22023';
  END IF;

  IF jsonb_typeof(v_details) <> 'object' OR jsonb_object_length(v_details) <> 5
     OR NOT (v_details ?& ARRAY['testingObjective','priority','testingScope','successCriteria','minimumCompletionRate'])
     OR (v_details - ARRAY['testingObjective','priority','testingScope','successCriteria','minimumCompletionRate']::text[]) <> '{}'::jsonb
     OR v_details->>'testingObjective' NOT IN ('stability_bugs','usability','compatibility','performance','release_readiness','custom')
     OR v_details->>'priority' NOT IN ('low','medium','high')
     OR jsonb_typeof(v_details->'testingScope') <> 'array'
     OR jsonb_array_length(v_details->'testingScope') NOT BETWEEN 1 AND 4
     OR jsonb_typeof(v_details->'minimumCompletionRate') <> 'number'
     OR (v_details->>'minimumCompletionRate') !~ '^[0-9]{1,3}$'
     OR (v_details->>'minimumCompletionRate')::integer NOT BETWEEN 1 AND 100
     OR (v_details->'successCriteria' <> 'null'::jsonb AND
         (jsonb_typeof(v_details->'successCriteria') <> 'string' OR char_length(v_details->>'successCriteria') > 1000)) THEN
    RAISE EXCEPTION 'TEST_CONFIG_DETAILS_INVALID' USING errcode='22023';
  END IF;

  SELECT count(*), count(DISTINCT value)
    INTO v_scope_count, v_scope_distinct
  FROM jsonb_array_elements_text(v_details->'testingScope') AS scope(value);
  IF v_scope_count NOT BETWEEN 1 AND 4 OR v_scope_count <> v_scope_distinct
     OR EXISTS (
       SELECT 1 FROM jsonb_array_elements(v_details->'testingScope') AS scope(value)
       WHERE jsonb_typeof(value) <> 'string'
          OR value #>> '{}' NOT IN ('core_flows','performance','compatibility','accessibility')
     ) THEN
    RAISE EXCEPTION 'TEST_CONFIG_SCOPE_INVALID' USING errcode='22023';
  END IF;

  IF jsonb_typeof(v_schedule) <> 'object' OR jsonb_object_length(v_schedule) <> 5
     OR NOT (v_schedule ?& ARRAY['durationDays','allowMoreTesters','joiningMethod','collectFeedback','enableBugReports'])
     OR (v_schedule - ARRAY['durationDays','allowMoreTesters','joiningMethod','collectFeedback','enableBugReports']::text[]) <> '{}'::jsonb
     OR (v_schedule->'durationDays' <> 'null'::jsonb AND
         (jsonb_typeof(v_schedule->'durationDays') <> 'number'
          OR (v_schedule->>'durationDays') !~ '^[0-9]{1,3}$'
          OR (v_schedule->>'durationDays')::integer NOT BETWEEN 1 AND 365))
     OR jsonb_typeof(v_schedule->'allowMoreTesters') <> 'boolean'
     OR v_schedule->>'joiningMethod' NOT IN ('google_play_link','closed_group','upload_list','open_testing')
     OR jsonb_typeof(v_schedule->'collectFeedback') <> 'boolean'
     OR jsonb_typeof(v_schedule->'enableBugReports') <> 'boolean' THEN
    RAISE EXCEPTION 'TEST_CONFIG_SCHEDULE_INVALID' USING errcode='22023';
  END IF;

  IF jsonb_typeof(v_google) <> 'object' OR jsonb_object_length(v_google) <> 5
     OR NOT (v_google ?& ARRAY['track','testerMethod','appVersion','releaseMode','releaseAt'])
     OR (v_google - ARRAY['track','testerMethod','appVersion','releaseMode','releaseAt']::text[]) <> '{}'::jsonb
     OR v_google->>'track' NOT IN ('internal','closed','open')
     OR v_google->>'testerMethod' NOT IN ('join_link','google_groups','upload_list')
     OR v_google->>'appVersion' <> 'latest_available'
     OR v_google->>'releaseMode' NOT IN ('immediately','scheduled')
     OR (v_google->'releaseAt' <> 'null'::jsonb AND
         (jsonb_typeof(v_google->'releaseAt') <> 'string'
          OR (v_google->>'releaseAt') !~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9]{2}:[0-9]{2}
    RAISE EXCEPTION 'TEST_CONFIG_GOOGLE_PLAY_INVALID' USING errcode='22023';
  END IF;

  -- Reuse the existing owner-checked create boundary. Both this call and the
  -- config update run in the same PostgreSQL transaction.
  v_test_id := rebuild_v2_private.create_test_impl(
    p_app_id,p_title,p_description,p_short_summary,p_test_type,
    p_min_testers,p_start_date,p_end_date,p_duration,p_instructions
  );

  UPDATE rebuild_v2.tests
  SET test_config = p_test_config,
      updated_at = now()
  WHERE id = v_test_id AND developer_id = v_user AND status = 'draft';

  IF NOT FOUND THEN
    RAISE EXCEPTION 'TEST_CONFIG_SAVE_FAILED' USING errcode='P0002';
  END IF;

  INSERT INTO rebuild_v2.audit_events(actor_id,action,target_type,target_id,reason,metadata)
  VALUES (
    v_user,
    'test.configured',
    'test',
    v_test_id,
    'Developer saved allowlisted six-step draft configuration',
    jsonb_build_object(
      'configuration_version',1,
      'contains_tester_contact_data',false
    )
  );

  RETURN v_test_id;
END;
$function$;

CREATE OR REPLACE FUNCTION rebuild_v2.create_test_with_config(
  p_app_id uuid,
  p_title text,
  p_description text,
  p_short_summary text,
  p_test_type text,
  p_min_testers integer,
  p_start_date date,
  p_end_date date,
  p_duration integer,
  p_instructions text,
  p_test_config jsonb
)
RETURNS uuid
LANGUAGE sql
SECURITY INVOKER
SET search_path TO ''
AS $function$
  SELECT rebuild_v2_private.create_test_with_config_impl(
    p_app_id,p_title,p_description,p_short_summary,p_test_type,
    p_min_testers,p_start_date,p_end_date,p_duration,p_instructions,p_test_config
  );
$function$;

REVOKE ALL ON FUNCTION rebuild_v2_private.create_test_with_config_impl(uuid,text,text,text,text,integer,date,date,integer,text,jsonb) FROM PUBLIC,anon;
REVOKE ALL ON FUNCTION rebuild_v2.create_test_with_config(uuid,text,text,text,text,integer,date,date,integer,text,jsonb) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION rebuild_v2_private.create_test_with_config_impl(uuid,text,text,text,text,integer,date,date,integer,text,jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION rebuild_v2.create_test_with_config(uuid,text,text,text,text,integer,date,date,integer,text,jsonb) TO authenticated;

COMMIT;
))
     OR (v_google->>'releaseMode' = 'scheduled' AND v_google->'releaseAt' = 'null'::jsonb)
     OR (v_google->>'releaseMode' = 'immediately' AND v_google->'releaseAt' <> 'null'::jsonb) THEN
    RAISE EXCEPTION 'TEST_CONFIG_GOOGLE_PLAY_INVALID' USING errcode='22023';
  END IF;

  -- Reuse the existing owner-checked create boundary. Both this call and the
  -- config update run in the same PostgreSQL transaction.
  v_test_id := rebuild_v2_private.create_test_impl(
    p_app_id,p_title,p_description,p_short_summary,p_test_type,
    p_min_testers,p_start_date,p_end_date,p_duration,p_instructions
  );

  UPDATE rebuild_v2.tests
  SET test_config = p_test_config,
      updated_at = now()
  WHERE id = v_test_id AND developer_id = v_user AND status = 'draft';

  IF NOT FOUND THEN
    RAISE EXCEPTION 'TEST_CONFIG_SAVE_FAILED' USING errcode='P0002';
  END IF;

  INSERT INTO rebuild_v2.audit_events(actor_id,action,target_type,target_id,reason,metadata)
  VALUES (
    v_user,
    'test.configured',
    'test',
    v_test_id,
    'Developer saved allowlisted six-step draft configuration',
    jsonb_build_object(
      'configuration_version',1,
      'contains_tester_contact_data',false
    )
  );

  RETURN v_test_id;
END;
$function$;

CREATE OR REPLACE FUNCTION rebuild_v2.create_test_with_config(
  p_app_id uuid,
  p_title text,
  p_description text,
  p_short_summary text,
  p_test_type text,
  p_min_testers integer,
  p_start_date date,
  p_end_date date,
  p_duration integer,
  p_instructions text,
  p_test_config jsonb
)
RETURNS uuid
LANGUAGE sql
SECURITY INVOKER
SET search_path TO ''
AS $function$
  SELECT rebuild_v2_private.create_test_with_config_impl(
    p_app_id,p_title,p_description,p_short_summary,p_test_type,
    p_min_testers,p_start_date,p_end_date,p_duration,p_instructions,p_test_config
  );
$function$;

REVOKE ALL ON FUNCTION rebuild_v2_private.create_test_with_config_impl(uuid,text,text,text,text,integer,date,date,integer,text,jsonb) FROM PUBLIC,anon;
REVOKE ALL ON FUNCTION rebuild_v2.create_test_with_config(uuid,text,text,text,text,integer,date,date,integer,text,jsonb) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION rebuild_v2_private.create_test_with_config_impl(uuid,text,text,text,text,integer,date,date,integer,text,jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION rebuild_v2.create_test_with_config(uuid,text,text,text,text,integer,date,date,integer,text,jsonb) TO authenticated;

COMMIT;
