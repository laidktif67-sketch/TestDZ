import { supabase } from "../../lib/supabase";
import { listTesterSubmissionCheckIns } from "./assignments-api";

function getClient() {
  if (!supabase) throw new Error("SUPABASE_NOT_CONFIGURED");
  return supabase;
}

/** Read the assignment only within the signed-in tester's ownership scope. */
export function getCompletionSummaryAssignment(assignmentId: string, testerId: string) {
  return getClient().from("assignments")
    .select("id,status,start_date,completed_at,points_awarded,test:tests(title,start_date,end_date,app:apps(name,icon_url))")
    .eq("id", assignmentId).eq("tester_id", testerId).maybeSingle();
}

export function listCompletionSummaryCheckins(assignmentId: string, testerId: string) {
  return listTesterSubmissionCheckIns(assignmentId, testerId);
}

export function getCompletionSummaryFeedback(assignmentId: string, testerId: string) {
  return getClient().from("feedback")
    .select("id,body,quality_status,created_at,reviewed_at")
    .eq("assignment_id", assignmentId).eq("tester_id", testerId)
    .order("created_at", { ascending: false }).limit(1).maybeSingle();
}

/** Read only earned-points ledger records for this tester and assignment. */
export function listCompletionSummaryLedger(assignmentId: string, userId: string) {
  return getClient().from("points_ledger")
    .select("id,amount,reason,reference_id,reference_type,created_at")
    .eq("user_id", userId).eq("wallet_type", "earned_points")
    .eq("reference_id", assignmentId).order("created_at");
}

