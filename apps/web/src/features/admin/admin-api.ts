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
  amount_dzd: number;
  status: string;
  provider: string | null;
  verified_at: string | null;
  created_at: string;
};

export type FinancialRefund = {
  id: string;
  payment_id: string;
  user_id: string;
  amount_dzd: number;
  reason: string;
  status: string;
  refund_method: string;
  created_at: string;
};

export type FinancialLedgerEntry = {
  id: string;
  user_id: string;
  wallet_type: string;
  amount: number;
  entry_type: string;
  reference_type: string | null;
  actor_id: string | null;
  reason: string | null;
  created_at: string;
};

/** Read-only financial data. Database RLS limits this to Admin/Financial roles. */
export async function getFinancialOperationsPageData() {
  const client = dataClient();
  const [payments, refunds, ledger] = await Promise.all([
    client.from("payments").select("id,user_id,amount_dzd,status,provider,verified_at,created_at").order("created_at", { ascending: false }).limit(100),
    client.from("refunds").select("id,payment_id,user_id,amount_dzd,reason,status,refund_method,created_at").order("created_at", { ascending: false }).limit(100),
    client.from("wallet_ledger").select("id,user_id,wallet_type,amount,entry_type,reference_type,actor_id,reason,created_at").order("created_at", { ascending: false }).limit(100),
  ]);
  return { payments, refunds, ledger };
}
