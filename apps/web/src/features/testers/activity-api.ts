import { supabase } from "../../lib/supabase";

function getClient() {
  if (!supabase) throw new Error("SUPABASE_NOT_CONFIGURED");
  return supabase;
}

export function listTesterActivityAssignments(testerId: string) {
  return getClient().from("assignments")
    .select("id,status,start_date,completed_at,created_at,test:tests(id,title,status,app:apps(name,icon_url)),checkins(id,checkin_date,created_at)")
    .eq("tester_id", testerId).order("created_at", { ascending: false });
}

export function listTesterActivityFeedback(testerId: string) {
  return getClient().from("feedback")
    .select("id,assignment_id,rating,quality_status,created_at")
    .eq("tester_id", testerId).order("created_at", { ascending: false });
}

export function listTesterActivityPoints(userId: string) {
  return getClient().from("points_ledger")
    .select("amount,reference_id,wallet_type")
    .eq("user_id", userId).eq("wallet_type", "earned_points");
}

export function countTesterActivityUnreadNotifications(userId: string) {
  return getClient().from("notifications")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId).is("read_at", null);
}
