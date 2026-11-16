import { getAppDataClient } from "../../lib/supabase-data";

/** Load the signed-in account's profile summary for the privacy screen. */
export function getPrivacyAccountProfile(userId: string) {
  return getAppDataClient().from("profiles")
    .select("display_name,avatar_url,created_at,updated_at")
    .eq("id", userId).maybeSingle();
}

/** Fetch all user-owned records included in the account data export. */
export async function getPrivacyDataExport(userId: string, isV2: boolean) {
  const client = getAppDataClient();
  const [profile, assignments, checkins, feedback, notifications, ledger, wallet] = await Promise.all([
    isV2
      ? client.from("profiles").select("display_name,avatar_url,bio,locale,phone,interests,created_at,updated_at").eq("id", userId).maybeSingle()
      : client.from("profiles").select("display_name,avatar_url,bio,locale,phone,interests,subscription_tier,created_at,updated_at").eq("id", userId).maybeSingle(),
    isV2
      ? client.from("assignments").select("id,test_id,status,assigned_at,started_at,completed_at,due_at").eq("tester_id", userId)
      : client.from("assignments").select("id,test_id,status,start_date,completed_at,created_at,updated_at").eq("tester_id", userId),
    client.from("checkins").select("id,assignment_id,checkin_date,note,created_at").eq("tester_id", userId),
    isV2
      ? client.from("feedback").select("id,assignment_id,rating,body,category,created_at").eq("tester_id", userId)
      : client.from("feedback").select("id,assignment_id,rating,body,category,quality_status,created_at").eq("tester_id", userId),
    isV2
      ? client.from("notifications").select("id,type,title,body,data,read_at,archived_at,created_at").eq("user_id", userId)
      : client.from("notifications").select("id,type,title,body,read_at,created_at").eq("user_id", userId),
    isV2
      ? client.from("wallet_ledger").select("id,wallet_type,amount,entry_type,reference_type,reference_id,reason,created_at").eq("user_id", userId)
      : client.from("points_ledger").select("id,wallet_type,amount,reason,reference_type,created_at").eq("user_id", userId),
    isV2
      ? client.from("wallets").select("earned_points,purchased_credits,updated_at").eq("user_id", userId).maybeSingle()
      : Promise.resolve({ data: null, error: null }),
  ]);
  return { profile, assignments, checkins, feedback, notifications, ledger, wallet };
}

/** Fetch user-owned activity records for CSV export. */
export async function getPrivacyActivityExport(userId: string, isV2: boolean) {
  const client = getAppDataClient();
  const [assignments, checkins, feedback, ledger] = await Promise.all([
    isV2
      ? client.from("assignments").select("id,test_id,status,assigned_at,started_at,completed_at,due_at").eq("tester_id", userId)
      : client.from("assignments").select("id,test_id,status,start_date,completed_at,created_at").eq("tester_id", userId),
    client.from("checkins").select("id,assignment_id,checkin_date,note,created_at").eq("tester_id", userId),
    isV2
      ? client.from("feedback").select("id,assignment_id,rating,category,created_at").eq("tester_id", userId)
      : client.from("feedback").select("id,assignment_id,rating,category,quality_status,created_at").eq("tester_id", userId),
    isV2
      ? client.from("wallet_ledger").select("id,wallet_type,amount,entry_type,reason,created_at").eq("user_id", userId)
      : client.from("points_ledger").select("id,wallet_type,amount,reason,created_at").eq("user_id", userId),
  ]);
  return { assignments, checkins, feedback, ledger };
}
