import { supabase } from "../../lib/supabase";

function getClient() {
  if (!supabase) throw new Error("SUPABASE_NOT_CONFIGURED");
  return supabase;
}


export function countActiveAssignmentUnreadNotifications(userId: string) {
  return getClient().from("notifications").select("id", { count: "exact", head: true }).eq("user_id", userId).is("read_at", null);
}

/** Ownership remains scoped to the authenticated tester ID. */
export function getActiveAssignmentRecord(assignmentId: string, testerId: string) {
  return getClient().from("assignments")
    .select("id,status,start_date,medical_extension_days,test:tests(id,title,description,short_summary,start_date,end_date,app:apps(name,icon_url,category,play_store_url))")
    .eq("id", assignmentId).eq("tester_id", testerId).maybeSingle();
}

export function listActiveAssignmentCheckIns(assignmentId: string, testerId: string) {
  return getClient().from("checkins").select("id,checkin_date,evidence_url")
    .eq("assignment_id", assignmentId).eq("tester_id", testerId).order("checkin_date");
}

export function countActiveAssignmentFeedback(assignmentId: string, testerId: string) {
  return getClient().from("feedback").select("id", { count: "exact", head: true })
    .eq("assignment_id", assignmentId).eq("tester_id", testerId);
}

export function getActiveAssignmentEarnedPoints(userId: string, assignmentId: string) {
  return getClient().from("points_ledger").select("amount")
    .eq("user_id", userId).eq("wallet_type", "earned_points").eq("reference_id", assignmentId);
}


export function listTesterLeaderboardLedger(userIds: string[]) {
  return getClient().from("points_ledger").select("user_id,amount")
    .eq("wallet_type", "earned_points").in("user_id", userIds).limit(20000);
}
