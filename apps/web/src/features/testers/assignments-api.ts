import { supabase } from "../../lib/supabase";

function getClient() {
  if (!supabase) throw new Error("SUPABASE_NOT_CONFIGURED");
  return supabase;
}

/** Fetch only the signed-in tester's assignment details; existing RLS remains authoritative. */
export function getTesterAssignmentDetails(assignmentId: string, testerId: string) {
  return getClient().from("assignments")
    .select("id,status,start_date,points_awarded,test:tests(id,title,description,short_summary,start_date,end_date,app:apps(name,icon_url,category))")
    .eq("id", assignmentId)
    .eq("tester_id", testerId)
    .maybeSingle();
}


/** Submission page data; keep the tester ownership filter in every query. */
export function getTesterSubmissionAssignment(assignmentId: string, testerId: string) {
  return getClient().from("assignments")
    .select("id,status,start_date,completed_at,created_at,test:tests(id,title,status,start_date,end_date,app:apps(name,icon_url))")
    .eq("id", assignmentId).eq("tester_id", testerId).maybeSingle();
}

export function listTesterSubmissionCheckIns(assignmentId: string, testerId: string) {
  return getClient().from("checkins").select("id,checkin_date")
    .eq("assignment_id", assignmentId).eq("tester_id", testerId)
    .order("checkin_date", { ascending: true });
}

export function countTesterSubmissionFeedback(assignmentId: string, testerId: string) {
  return getClient().from("feedback").select("id", { count: "exact", head: true })
    .eq("assignment_id", assignmentId).eq("tester_id", testerId);
}
