import { supabase } from "../../lib/supabase";
import {
  listDeveloperAnalyticsAssignments,
  listDeveloperAnalyticsFeedback,
} from "./analytics-api";

function getClient() {
  if (!supabase) throw new Error("SUPABASE_NOT_CONFIGURED");
  return supabase;
}

export function listAppMetricTests(appIds: string[]) {
  if (!appIds.length) return Promise.resolve({ data: [], error: null });
  return getClient().from("tests").select("id,app_id").in("app_id", appIds).limit(5000);
}

export function listAppMetricAssignments(testIds: string[]) {
  return listDeveloperAnalyticsAssignments(testIds);
}

export function listAppMetricFeedback(assignmentIds: string[]) {
  return listDeveloperAnalyticsFeedback(assignmentIds);
}
