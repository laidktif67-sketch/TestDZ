import { supabase } from "../../lib/supabase";

function getClient() {
  if (!supabase) throw new Error("SUPABASE_NOT_CONFIGURED");
  return supabase;
}

/** Dashboard profile data for the signed-in tester. */
export function getTesterDashboardProfile(userId: string) {
  return getClient().from("profiles").select("display_name,avatar_url").eq("id", userId).maybeSingle();
}

export function getTesterDashboardWallet(userId: string) {
  return getClient().from("wallets").select("earned_points").eq("user_id", userId).maybeSingle();
}

/** Assignment/check-in data used to derive tester dashboard progress. */
export function listTesterDashboardAssignments(userId: string) {
  return getClient().from("assignments")
    .select("id,status,start_date,created_at,completed_at,checkins(id,checkin_date),test:tests(title,end_date,app:apps(name))")
    .eq("tester_id", userId);
}

/** Recent available test cycles; preserves the dashboard's status filter, ordering and limit. */
export function listTesterDashboardAvailableTests() {
  return getClient().from("tests")
    .select("id,title,status,min_testers,app:apps(name,icon_url)", { count: "exact" })
    .in("status", ["recruiting", "ready", "running"])
    .order("created_at", { ascending: false }).limit(4);
}

export function countTesterDashboardUnreadNotifications(userId: string) {
  return getClient().from("notifications").select("id", { count: "exact", head: true })
    .eq("user_id", userId).is("read_at", null);
}
