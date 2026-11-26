-- Keep the six-step JSON configuration consistent with editable test columns.
-- Candidate-only migration; applied only by the disposable Rebuild V2 CI workflow.
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
  SET title=btrim(p_title),
      description=btrim(p_description),
      short_summary=NULLIF(btrim(p_short_summary),''),
      test_type=p_test_type,
      min_testers=p_min_testers,
      start_date=p_start_date,
      end_date=p_end_date,
      estimated_duration_minutes=p_duration,
      tester_instructions=NULLIF(btrim(p_instructions),''),
      test_config=CASE
        WHEN test_config ?& ARRAY['cohort','rules'] THEN
          jsonb_set(
            jsonb_set(
              test_config,
              '{cohort,targetTesters}',
              to_jsonb(p_min_testers),
              true
            ),
            '{rules,instructions}',
            COALESCE(to_jsonb(NULLIF(btrim(p_instructions),'')), 'null'::jsonb),
            true
          )
        ELSE test_config
      END,
      updated_at=now()
  WHERE id=p_test_id
    AND developer_id=v_user
    AND status IN ('draft','failed','cancelled');

  IF NOT FOUND THEN
    RAISE EXCEPTION 'TEST_NOT_FOUND_OR_NOT_EDITABLE' USING errcode='P0002';
  END IF;

  INSERT INTO rebuild_v2.audit_events(actor_id,action,target_type,target_id,reason,metadata)
  VALUES(v_user,'test.updated','test',p_test_id,'Developer updated test','{}'::jsonb);
END;
$function$;
