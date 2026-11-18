import { getAppDataClient } from "../../lib/supabase-data";

export type AdminDeveloperRoleRequest = {
  request_id: string;
  user_id: string;
  requested_role: string;
  request_reason: string | null;
  created_at: string;
  display_name: string | null;
};

function dataClient(): any {
  return getAppDataClient();
}

export function listPendingDeveloperRoleRequests() {
  return dataClient().rpc("admin_list_pending_role_requests");
}

export function reviewDeveloperRoleRequest(
  requestId: string,
  decision: "approved" | "rejected",
  reason: string,
) {
  return dataClient().rpc("admin_review_role_request", {
    p_request_id: requestId,
    p_decision: decision,
    p_review_note: reason,
  });
}
