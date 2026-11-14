import { supabase } from "../../lib/supabase";

function getClient() {
  if (!supabase) throw new Error("SUPABASE_NOT_CONFIGURED");
  return supabase;
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

