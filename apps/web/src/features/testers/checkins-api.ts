import { supabase } from "../../lib/supabase";

function getClient() {
  if (!supabase) throw new Error("SUPABASE_NOT_CONFIGURED");
  return supabase;
}


export function listTesterCheckIns(testerId: string) {
  return getClient().from("checkins")
    .select("id,assignment_id,checkin_date,created_at,note,evidence_url,assignment:assignments(id,status,test:tests(id,title,status,app:apps(name,icon_url)))")
    .eq("tester_id", testerId)
    .order("checkin_date", { ascending: false });
}

export function listCheckInRewardLedger(userId: string, checkInIds: string[]) {
  if (!checkInIds.length) return Promise.resolve({ data: [], error: null });
  return getClient().from("points_ledger")
    .select("amount,reference_id")
    .eq("user_id", userId)
    .eq("wallet_type", "earned_points")
    .in("reference_id", checkInIds);
}
