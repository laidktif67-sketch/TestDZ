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
