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

 
export type FinancialPayment = {
  id: string;
  user_id: string;
  subscription_id: string | null;
  amount_dzd: number;
  currency: string;
  status: string;
  provider: string | null;
  verified_at: string | null;
  created_at: string;
  updated_at: string;
};

export type FinancialRefund = {
  id: string;
  payment_id: string;
  user_id: string;
  amount_dzd: number;
  reason: string;
  status: string;
  refund_method: string;
  approved_by: string | null;
  created_at: string;
  updated_at: string;
};

export type FinancialLedgerEntry = {
  id: string;
  user_id: string;
  wallet_type: string;
  amount: number;
  entry_type: string;
  reference_type: string | null;
  reference_id: string | null;
  actor_id: string | null;
  reason: string | null;
  created_at: string;
};

/** Read-only financial data. Database RLS limits this to Admin/Financial roles. */
export async function getFinancialOperationsPageData() {
  const client = dataClient();
  const [payments, refunds, ledger] = await Promise.all([
    client.from("payments").select("id,user_id,subscription_id,amount_dzd,currency,status,provider,verified_at,created_at,updated_at").order("created_at", { ascending: false }).limit(100),
    client.from("refunds").select("id,payment_id,user_id,amount_dzd,reason,status,refund_method,approved_by,created_at,updated_at").order("created_at", { ascending: false }).limit(100),
    client.from("wallet_ledger").select("id,user_id,wallet_type,amount,entry_type,reference_type,reference_id,actor_id,reason,created_at").order("created_at", { ascending: false }).limit(100),
  ]);
  return { payments, refunds, ledger };
}


export type AdminUserRecord = {
  id: string;
  display_name: string | null;
  locale: string;
  is_verified: boolean;
  is_banned: boolean;
  created_at: string;
  user_roles: Array<{ role: string }>;
};

/** Admin-only read. RLS on profiles and user_roles enforces the boundary. */
export function listAdminUsers() {
  return dataClient()
    .from("profiles")
    .select("id,display_name,locale,is_verified,is_banned,created_at,user_roles(role)")
    .order("created_at", { ascending: false })
    .limit(100);
}


export type AdminGrantableRole = "tester" | "developer" | "financial" | "support";

export function grantAdminUserRole(userId: string, role: AdminGrantableRole, reason: string) {
  return dataClient().rpc("admin_grant_role", {
    p_user_id: userId,
    p_role: role,
    p_reason: reason,
  });
}
