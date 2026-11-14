import { supabase } from "../../lib/supabase";

function getClient() {
  if (!supabase) throw new Error("SUPABASE_NOT_CONFIGURED");
  return supabase;
}

/** Dashboard-only profile fields; profile visibility remains controlled by RLS. */
export function getDeveloperDashboardProfile(userId: string) {
  return getClient().from("profiles")
    .select("display_name,avatar_url")
    .eq("id", userId).maybeSingle();
}

/** Recent developer tests, preserving dashboard ordering and result limit. */
export function listDeveloperDashboardTests(developerId: string) {
  return getClient().from("tests")
    .select("id,title,status,created_at,app:apps(name,icon_url)", { count: "exact" })
    .eq("developer_id", developerId)
    .order("created_at", { ascending: false })
    .limit(100);
}

/** Exact count of completed tests for the dashboard KPI. */
export function countDeveloperCompletedTests(developerId: string) {
  return getClient().from("tests")
    .select("id", { count: "exact", head: true })
    .eq("developer_id", developerId)
    .eq("status", "completed");
}

/** Assignment rows used to derive unique tester counts. */
export function listDeveloperDashboardAssignments(developerId: string) {
  return getClient().from("assignments")
    .select("id,tester_id,tests!inner(developer_id)")
    .eq("tests.developer_id", developerId);
}

/** Ratings for the dashboard average; callers skip this query for empty IDs. */
export function listDeveloperDashboardFeedback(assignmentIds: string[]) {
  if (!assignmentIds.length) return Promise.resolve({ data: [], error: null });
  return getClient().from("feedback")
    .select("rating")
    .in("assignment_id", assignmentIds)
    .not("rating", "is", null);
}
