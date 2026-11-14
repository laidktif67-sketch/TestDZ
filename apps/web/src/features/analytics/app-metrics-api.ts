import { supabase } from "../../lib/supabase";

function getClient() {
  if (!supabase) throw new Error("SUPABASE_NOT_CONFIGURED");
  return supabase;
}

export function listAppMetricTests(appIds: string[]) {
  if (!appIds.length) return Promise.resolve({ data: [], error: null });
  return getClient().from("tests").select("id,app_id").in("app_id", appIds).limit(5000);
}

export function listAppMetricAssignments(testIds: string[]) {
  if (!testIds.length) return Promise.resolve({ data: [], error: null });
  return getClient().from("assignments").select("id,test_id,tester_id,status,created_at,updated_at").in("test_id", testIds).limit(5000);
}

export function listAppMetricFeedback(assignmentIds: string[]) {
  if (!assignmentIds.length) return Promise.resolve({ data: [], error: null });
  return getClient().from("feedback").select("id,assignment_id,rating,created_at").in("assignment_id", assignmentIds).limit(5000);
}
