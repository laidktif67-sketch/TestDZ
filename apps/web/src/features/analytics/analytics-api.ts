import { supabase } from "../../lib/supabase";

function getClient() {
  if (!supabase) throw new Error("SUPABASE_NOT_CONFIGURED");
  return supabase;
}

export function getDeveloperAnalyticsTests(developerId: string) {
  return getClient().from("tests").select("id,app_id,title,status,created_at").eq("developer_id", developerId);
}

export function getDeveloperAnalyticsApps(developerId: string) {
  return getClient().from("apps").select("id,name,icon_url").eq("developer_id", developerId);
}

export function listDeveloperAnalyticsAssignments(testIds: string[]) {
  if (!testIds.length) return Promise.resolve({ data: [], error: null });
  return getClient().from("assignments").select("id,test_id,tester_id,status,created_at,updated_at").in("test_id", testIds).limit(5000);
}

export function listDeveloperAnalyticsFeedback(assignmentIds: string[]) {
  if (!assignmentIds.length) return Promise.resolve({ data: [], error: null });
  return getClient().from("feedback").select("id,assignment_id,rating,created_at").in("assignment_id", assignmentIds).limit(5000);
}
