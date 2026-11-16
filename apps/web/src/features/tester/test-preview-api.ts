import { getAppDataClient } from "../../lib/supabase-data";
import { isTesterWorkflowV2Enabled } from "../../lib/supabase-v2";
import { getUnreadNotificationCount } from "../notifications/notifications-api";
import { profilesApi } from "../profiles/profiles-api";

/** Fetch the test preview and the current tester's assignment state. */
export async function getTesterTestPreviewPageData(testId: string, userId: string) {
  const client = getAppDataClient();
  const [profile, notifications, testResult, assignmentResult] = await Promise.all([
    profilesApi.getHeaderProfile(userId),
    getUnreadNotificationCount(userId),
    isTesterWorkflowV2Enabled
      ? client.from("tests").select("id,app_id,title,description,short_summary,test_type,status,min_testers,start_date,end_date")
          .eq("id", testId).maybeSingle()
      : client.from("tests").select("id,app_id,title,description,short_summary,status,min_testers,start_date,end_date,app:apps(name,icon_url,category,play_store_url,description)")
          .eq("id", testId).maybeSingle(),
    client.from("assignments").select("id,status").eq("test_id", testId).eq("tester_id", userId).maybeSingle(),
  ]);
  if (!isTesterWorkflowV2Enabled) {
    return { isV2: false as const, profile, notifications, testResult, assignmentResult,
      appResult: null, stepsResult: null, requirementsResult: null, buildsResult: null, assetsResult: null };
  }
  if (testResult.error || !testResult.data) {
    return { isV2: true as const, profile, notifications, testResult, assignmentResult,
      appResult: null, stepsResult: null, requirementsResult: null, buildsResult: null, assetsResult: null };
  }
  const [appResult, stepsResult, requirementsResult, buildsResult, assetsResult] = await Promise.all([
    client.from("apps").select("name,icon_url,category,play_store_url,description").eq("id", testResult.data.app_id).maybeSingle(),
    client.from("test_steps").select("id,step_order,title,description,is_required").eq("test_id", testId).order("step_order"),
    client.from("test_requirements").select("id,requirement_type,title,description,is_mandatory,sort_order").eq("test_id", testId).order("sort_order"),
    client.from("test_builds").select("id,version_label,original_filename,size_bytes,storage_path").eq("test_id", testId).eq("status", "uploaded").order("created_at", { ascending: false }),
    client.from("test_assets").select("id,title,original_filename,file_extension,mime_type,size_bytes,storage_path").eq("test_id", testId).eq("status", "uploaded").order("created_at", { ascending: false }),
  ]);
  return { isV2: true as const, profile, notifications, testResult, assignmentResult,
    appResult, stepsResult, requirementsResult, buildsResult, assetsResult };
}

/** Join a test through its server-side, capacity-checked workflow. */
export function joinTesterTest(testId: string) {
  return getAppDataClient().rpc("join_test", { p_test_id: testId });
}
