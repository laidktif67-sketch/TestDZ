import { supabase } from "../../lib/supabase";

function getClient() {
  if (!supabase) throw new Error("SUPABASE_NOT_CONFIGURED");
  return supabase;
}

/** List active subscription plans ordered by their displayed price. */
export function listActivePlans() {
  return getClient().from("plans")
    .select("id,code,name,price_dzd,billing_period,limits,features")
    .eq("is_active", true)
    .order("price_dzd");
}

/** Read the signed-in developer's latest active, trialing, or past-due subscription. */
export function getCurrentDeveloperSubscription(userId: string) {
  return getClient().from("subscriptions")
    .select("id,status,current_period_end,cancel_at_period_end,plan:plans(id,code,name,price_dzd,billing_period,limits,features)")
    .eq("user_id", userId)
    .in("status", ["active", "trialing", "past_due"])
    .order("current_period_end", { ascending: false })
    .limit(1)
    .maybeSingle();
}

/** List the developer's eight most recent payments. */
export function listDeveloperPayments(userId: string) {
  return getClient().from("payments")
    .select("id,amount_dzd,provider,status,created_at")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(8);
}

/** Count non-archived apps belonging to the developer. */
export function countDeveloperApps(userId: string) {
  return getClient().from("apps")
    .select("id", { count: "exact", head: true })
    .eq("developer_id", userId)
    .neq("status", "archived");
}

/** Count tests belonging to the developer. */
export function countDeveloperTests(userId: string) {
  return getClient().from("tests")
    .select("id", { count: "exact", head: true })
    .eq("developer_id", userId);
}

/** List tester IDs on assignments for the developer's tests; caller deduplicates for usage display. */
export function listDeveloperAssignmentTesterIds(userId: string) {
  return getClient().from("assignments")
    .select("tester_id,tests!inner(developer_id)")
    .eq("tests.developer_id", userId)
    .limit(1000);
}
