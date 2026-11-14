import { supabase } from "../../lib/supabase";

function getClient() {
  if (!supabase) throw new Error("SUPABASE_NOT_CONFIGURED");
  return supabase;
}

export function listAppMetricTests(appIds: string[]) {
  if (!appIds.length) return Promise.resolve({ data: [], error: null });
  return getClient().from("tests").select("id,app_id").in("app_id", appIds);
}

export function listAppMetricAssignments(testIds: string[]) {
  if (!testIds.length) return Promise.resolve({ data: [], error: null });
  return getClient().from("assignments").select("id,test_id,tester_id").in("test_id", testIds);
}

export function listAppMetricFeedback(assignmentIds: string[]) {
  if (!assignmentIds.length) return Promise.resolve({ data: [], error: null });
  return getClient().from("feedback").select("assignment_id,rating")
    .in("assignment_id", assignmentIds).not("rating", "is", null);
}
