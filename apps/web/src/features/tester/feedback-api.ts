import { getAppDataClient } from "../../lib/supabase-data";

/** Submit tester feedback through the guarded V2 workflow RPC. */
export function submitTesterFeedback(input: {
  assignmentId: string;
  category: "bug" | "usability" | "general";
  body: string;
}) {
  return getAppDataClient().rpc("submit_tester_feedback", {
    p_assignment_id: input.assignmentId,
    p_category: input.category,
    p_body: input.body,
    p_rating: null,
  });
}


/** Read the current quality state so a tester can revise only rejected feedback. */
export function getTesterFeedbackForAssignment(assignmentId: string, testerId: string) {
  return getAppDataClient().from("feedback")
    .select("id,category,body,quality_status,reviewed_at")
    .eq("assignment_id", assignmentId)
    .eq("tester_id", testerId)
    .maybeSingle();
}

/** Revise the existing feedback row after Admin rejected its quality. */
export function reviseTesterFeedback(input: {
  assignmentId: string;
  category: "bug" | "usability" | "general";
  body: string;
}) {
  return getAppDataClient().rpc("revise_tester_feedback", {
    p_assignment_id: input.assignmentId,
    p_category: input.category,
    p_body: input.body,
    p_rating: null,
  });
}
