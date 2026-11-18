import { getAppDataClient } from "../../lib/supabase-data";

export type AdminDeveloperRoleRequest = {
  request_id: string;
  user_id: string;
  requested_role: string;
  request_reason: string | null;
  created_at: string;
  display_name: string | null;
};

function dataClient(): any { return getAppDataClient(); }

export function listPendingDeveloperRoleRequests() { return dataClient().rpc("admin_list_pending_role_requests"); }
export function reviewDeveloperRoleRequest(requestId: string, decision: "approved" | "rejected", reason: string) {
  return dataClient().rpc("admin_review_role_request", { p_request_id: requestId, p_decision: decision, p_review_note: reason });
}

export type FinancialPayment = { id: string; user_id: string; subscription_id: string | null; amount_dzd: number; currency: string; status: string; provider: string | null; verified_at: string | null; created_at: string; updated_at: string; };
export type FinancialRefund = { id: string; payment_id: string; user_id: string; amount_dzd: number; status: string; refund_method: string; approved_by: string | null; created_at: string; updated_at: string; };
export type FinancialLedgerEntry = { id: string; user_id: string; wallet_type: string; amount: number; entry_type: string; reference_type: string | null; reference_id: string | null; actor_id: string | null; reason: string | null; created_at: string; };

/** Read-only financial data. Database RLS limits this to Admin/Financial roles. */
export async function getFinancialOperationsPageData() {
  const client = dataClient();
  const [payments, refunds, ledger] = await Promise.all([
    client.from("payments").select("id,user_id,subscription_id,amount_dzd,currency,status,provider,verified_at,created_at,updated_at").order("created_at", { ascending: false }).limit(100),
    client.from("refunds").select("id,payment_id,user_id,amount_dzd,status,refund_method,approved_by,created_at,updated_at").order("created_at", { ascending: false }).limit(100),
    client.from("wallet_ledger").select("id,user_id,wallet_type,amount,entry_type,reference_type,reference_id,actor_id,reason,created_at").order("created_at", { ascending: false }).limit(100),
  ]);
  return { payments, refunds, ledger };
}

export type AdminUserRecord = { id: string; display_name: string | null; locale: string; is_verified: boolean; is_banned: boolean; created_at: string; user_roles: Array<{ role: string }>; };
/** Admin-only read. RLS on profiles and user_roles enforces the boundary. */
export function listAdminUsers() {
  return dataClient().from("profiles").select("id,display_name,locale,is_verified,is_banned,created_at,user_roles(role)").order("created_at", { ascending: false }).limit(100);
}
export type AdminGrantableRole = "tester" | "developer" | "financial" | "support";
export function grantAdminUserRole(userId: string, role: AdminGrantableRole, reason: string) {
  return dataClient().rpc("admin_grant_role", { p_user_id: userId, p_role: role, p_reason: reason });
}

export type AdminAuditEvent = { id: string; actor_id: string | null; action: string; target_type: string; target_id: string | null; reason: string | null; created_at: string; };
/** Admin-only, read-only audit history. The database policy is the authorization boundary. */
export function listAdminAuditEvents() {
  return dataClient().from("audit_events").select("id,actor_id,action,target_type,target_id,reason,created_at").order("created_at", { ascending: false }).limit(100);
}

 
export type AdminFraudReview = {
  id: string;
  user_id: string;
  score: number;
  priority: "normal" | "high";
  status: "queued" | "in_review" | "resolved" | "dismissed";
  review_due_at: string | null;
  reviewed_by: string | null;
  resolution: string | null;
  created_at: string;
  updated_at: string;
};

/** Read-only risk-review queue. RLS permits Admin/Support; the route is Admin-only. */
export function listAdminFraudReviews() {
  return dataClient()
    .from("fraud_reviews")
    .select("id,user_id,score,priority,status,review_due_at,reviewed_by,resolution,created_at,updated_at")
    .order("created_at", { ascending: false })
    .limit(100);
}


export type AdminCaseReport = {
  id: string;
  reporter_id: string;
  reported_user_id: string | null;
  assignment_id: string | null;
  report_type: string;
  status: "open" | "under_review" | "resolved" | "rejected";
  reviewed_by: string | null;
  reviewed_at: string | null;
  created_at: string;
};

/** Support/Admin report queue. RLS is the authorization boundary; content and attachments are not selected. */
export function listCaseReports() {
  return dataClient().from("reports")
    .select("id,reporter_id,reported_user_id,assignment_id,report_type,status,reviewed_by,reviewed_at,created_at")
    .order("created_at", { ascending: false })
    .limit(100);
}

export type AdminCaseDispute = {
  id: string;
  opened_by: string;
  payment_id: string | null;
  report_id: string | null;
  status: "opened" | "under_review" | "resolved_accepted" | "resolved_rejected" | "escalated";
  resolved_by: string | null;
  created_at: string;
  updated_at: string;
};

/** Financial/Admin dispute queue. No payment amounts, report descriptions or resolution text are selected. */
export function listCaseDisputes() {
  return dataClient().from("disputes")
    .select("id,opened_by,payment_id,report_id,status,resolved_by,created_at,updated_at")
    .order("created_at", { ascending: false })
    .limit(100);
}
