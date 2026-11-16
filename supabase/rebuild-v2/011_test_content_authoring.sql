-- Developer-owned test steps and requirements authoring.
-- Candidate-only patch; apply to isolated TestDZ-FixLab after 010. Never Production before cutover approval.

CREATE OR REPLACE FUNCTION rebuild_v2_private.save_test_content_impl(
  p_test_id uuid,
  p_steps jsonb,
  p_requirements jsonb
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
SET row_security TO 'off'
AS $function$
DECLARE
  v_user uuid := auth.uid();
  v_test_status text;
  v_item jsonb;
  v_order integer;
  v_type text;
BEGIN
  IF v_user IS NULL THEN
    RAISE EXCEPTION 'AUTH_REQUIRED' USING errcode='28000';
  END IF;
  IF NOT rebuild_v2_private.has_role(v_user,ARRAY['developer','admin']) THEN
    RAISE EXCEPTION 'DEVELOPER_ROLE_REQUIRED' USING errcode='42501';
  END IF;
  IF p_steps IS NULL OR jsonb_typeof(p_steps)<>'array'
     OR p_requirements IS NULL OR jsonb_typeof(p_requirements)<>'array'
     OR jsonb_array_length(p_steps)>50 OR jsonb_array_length(p_requirements)>50 THEN
    RAISE EXCEPTION 'TEST_CONTENT_INVALID' USING errcode='22023';
  END IF;

  SELECT t.status INTO v_test_status
  FROM rebuild_v2.tests t
  WHERE t.id=p_test_id AND t.developer_id=v_user
  FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'TEST_NOT_FOUND_OR_NOT_OWNED' USING errcode='42501';
  END IF;
  IF v_test_status NOT IN ('draft','failed','cancelled') THEN
    RAISE EXCEPTION 'TEST_CONTENT_LOCKED' USING errcode='55000';
  END IF;

  FOR v_item IN SELECT value FROM jsonb_array_elements(p_steps)
  LOOP
    IF jsonb_typeof(v_item)<>'object'
       OR jsonb_typeof(v_item->'title') IS DISTINCT FROM 'string'
       OR jsonb_typeof(v_item->'description') IS DISTINCT FROM 'string'
       OR (v_item ? 'isRequired' AND jsonb_typeof(v_item->'isRequired') IS DISTINCT FROM 'boolean')
       OR char_length(btrim(v_item->>'title')) NOT BETWEEN 2 AND 160
       OR char_length(btrim(v_item->>'description')) NOT BETWEEN 1 AND 4000 THEN
      RAISE EXCEPTION 'TEST_STEP_INVALID' USING errcode='22023';
    END IF;
  END LOOP;

  FOR v_item IN SELECT value FROM jsonb_array_elements(p_requirements)
  LOOP
    IF jsonb_typeof(v_item)<>'object'
       OR jsonb_typeof(v_item->'type') IS DISTINCT FROM 'string'
       OR jsonb_typeof(v_item->'title') IS DISTINCT FROM 'string'
       OR jsonb_typeof(v_item->'description') IS DISTINCT FROM 'string'
       OR (v_item ? 'isMandatory' AND jsonb_typeof(v_item->'isMandatory') IS DISTINCT FROM 'boolean')
       OR (v_item->>'type') NOT IN ('device','android_version','account','network','eligibility','other')
       OR char_length(btrim(v_item->>'title')) NOT BETWEEN 2 AND 160
       OR char_length(btrim(v_item->>'description')) NOT BETWEEN 1 AND 2000 THEN
      RAISE EXCEPTION 'TEST_REQUIREMENT_INVALID' USING errcode='22023';
    END IF;
  END LOOP;

  DELETE FROM rebuild_v2.test_steps WHERE test_id=p_test_id;
  DELETE FROM rebuild_v2.test_requirements WHERE test_id=p_test_id;

  v_order:=0;
  FOR v_item IN SELECT value FROM jsonb_array_elements(p_steps)
  LOOP
    v_order:=v_order+1;
    INSERT INTO rebuild_v2.test_steps(test_id,step_order,title,description,is_required)
    VALUES(p_test_id,v_order,btrim(v_item->>'title'),btrim(v_item->>'description'),coalesce((v_item->>'isRequired')::boolean,true));
  END LOOP;

  v_order:=0;
  FOR v_item IN SELECT value FROM jsonb_array_elements(p_requirements)
  LOOP
    v_order:=v_order+1;
    v_type:=v_item->>'type';
    INSERT INTO rebuild_v2.test_requirements(test_id,requirement_type,title,description,is_mandatory,sort_order)
    VALUES(p_test_id,v_type,btrim(v_item->>'title'),btrim(v_item->>'description'),coalesce((v_item->>'isMandatory')::boolean,true),v_order);
  END LOOP;

  INSERT INTO rebuild_v2.audit_events(actor_id,action,target_type,target_id,reason,metadata)
  VALUES(v_user,'test.content.saved','test',p_test_id,'Developer saved test steps and requirements',
    jsonb_build_object('steps_count',jsonb_array_length(p_steps),'requirements_count',jsonb_array_length(p_requirements)));
END;
$function$;

CREATE OR REPLACE FUNCTION rebuild_v2.save_test_content(
  p_test_id uuid,p_steps jsonb,p_requirements jsonb
)
RETURNS void
LANGUAGE sql
SECURITY INVOKER
SET search_path TO ''
AS $function$
  SELECT rebuild_v2_private.save_test_content_impl(p_test_id,p_steps,p_requirements);
$function$;

REVOKE ALL ON FUNCTION rebuild_v2_private.save_test_content_impl(uuid,jsonb,jsonb) FROM PUBLIC,anon;
REVOKE ALL ON FUNCTION rebuild_v2.save_test_content(uuid,jsonb,jsonb) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION rebuild_v2_private.save_test_content_impl(uuid,jsonb,jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION rebuild_v2.save_test_content(uuid,jsonb,jsonb) TO authenticated;
