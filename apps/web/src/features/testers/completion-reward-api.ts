import { supabase } from "../../lib/supabase";

function getClient() {
  if (!supabase) throw new Error("SUPABASE_NOT_CONFIGURED");
  return supabase;
}

/** Read assignment details only for the authenticated tester's completion reward view. */
export function getCompletionRewardAssignment(assignmentId: string, testerId: string) {
  return getClient().from("assignments")
    .select("id,status,completed_at,test:tests(title,app:apps(name))")
    .eq("id", assignmentId).eq("tester_id", testerId).maybeSingle();
}

export function listCompletionRewardCheckins(assignmentId: string, testerId: string) {
  return getClient().from("checkins")
    .select("checkin_date").eq("assignment_id", assignmentId).eq("tester_id", testerId);
}

export function getCompletionRewardFeedback(assignmentId: string, testerId: string) {
  return getClient().from("feedback")
    .select("quality_status").eq("assignment_id", assignmentId).eq("tester_id", testerId)
    .order("created_at", { ascending: false }).limit(1).maybeSingle();
}

/** Read-only earned-points ledger entries; no wallet or ledger mutations are exposed here. */
export function listCompletionRewardLedger(assignmentId: string, userId: string) {
  return getClient().from("points_ledger")
    .select("id,amount,reason,created_at").eq("user_id", userId)
    .eq("wallet_type", "earned_points").eq("reference_id", assignmentId)
    .order("created_at", { ascending: false });
}

export function getCompletionRewardProfile(userId: string) {
  return getClient().from("profiles").select("display_name,avatar_url").eq("id", userId).maybeSingle();
}
