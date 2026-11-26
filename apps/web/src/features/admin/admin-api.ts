import { getAppDataClient } from "../../lib/supabase-data";

export type AdminRoleRequest = {
  request_id: string;
  user_id: string;
  requested_role: "tester" | "developer";
  request_reason: string | null;
  created_at: string;
  display_name: string | null;
};

export function listPendingRoleRequests() {
  return getAppDataClient().rpc("admin_list_pending_role_requests");
}

export function reviewRoleRequest(
  requestId: string,
  decision: "approved" | "rejected",
  reviewNote: string,
) {
  return getAppDataClient().rpc("admin_review_role_request", {
    p_request_id: requestId,
    p_decision: decision,
    p_review_note: reviewNote,
  });
}
