import { supabase } from "../../lib/supabase";
import { getTesterHeaderProfile } from "../profile/profile-api";

function getClient() {
  if (!supabase) throw new Error("SUPABASE_NOT_CONFIGURED");
  return supabase;
}

/** Read-only profile summary shown in the test preview header. */
export function getTestPreviewProfile(userId: string) {
  return getTesterHeaderProfile(userId);
}

export function countTestPreviewUnreadNotifications(userId: string) {
  return getClient().from("notifications").select("id", { count: "exact", head: true }).eq("user_id", userId).is("read_at", null);
}

/** Fetches one test preview with the same related app fields and id filter. */
export function getTestPreviewTest(testId: string) {
  return getClient().from("tests")
    .select("id,app_id,title,description,short_summary,status,min_testers,start_date,end_date,app:apps(name,icon_url,category,play_store_url,description)")
    .eq("id", testId).maybeSingle();
}

/** Checks whether this tester already has an assignment for the selected test. */
export function getTestPreviewAssignment(testId: string, testerId: string) {
  return getClient().from("assignments").select("id,status").eq("test_id", testId).eq("tester_id", testerId).maybeSingle();
}
