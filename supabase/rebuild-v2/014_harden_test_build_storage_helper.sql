-- Simplify APK upload authorization to trust only the exact server-registered path.
CREATE OR REPLACE FUNCTION rebuild_v2_private.can_upload_test_build(p_object_name text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO ''
SET row_security TO 'off'
AS $function$
  SELECT (SELECT auth.uid()) IS NOT NULL AND EXISTS(
    SELECT 1
    FROM rebuild_v2.test_builds b
    JOIN rebuild_v2.tests t ON t.id=b.test_id AND t.developer_id=b.developer_id
    WHERE b.storage_path=p_object_name
      AND b.developer_id=(SELECT auth.uid())
      AND b.status='pending'
      AND t.test_type='apk_testing'
      AND t.status IN ('draft','failed','cancelled')
  );
$function$;
REVOKE ALL ON FUNCTION rebuild_v2_private.can_upload_test_build(text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION rebuild_v2_private.can_upload_test_build(text) TO authenticated;
