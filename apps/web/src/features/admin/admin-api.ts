import { getAppDataClient } from "../../lib/supabase-data";

export type AdminDeveloperRoleRequest = {
  request_id: string;
  user_id: string;
  requested_role: string;
  request_reason: string | null;
  created_at: string;
  display_name: string | null;
};

export function listPendingDeveloperRoleRequests() {
  return getAppDataClient().rpc("admin_list_pending_role_requests");
}

export function reviewDeveloperRoleRequest(
  requestId: string,
  decision: "approved" | "rejected",
  reason: string,
) {
  return getAppDataClient().rpc("admin_review_role_request", {
    p_request_id: requestId,
    p_decision: decision,
    p_review_note: reason,
  });
}


/** Grant one supported non-Admin role through the audited Admin RPC. */
export function grantAdminRole(userId: string, role: "tester" | "developer" | "financial" | "support", reason: string) {
  return getAppDataClient().rpc("admin_grant_role", {
    p_user_id: userId,
    p_role: role,
    p_reason: reason,
  });
}
