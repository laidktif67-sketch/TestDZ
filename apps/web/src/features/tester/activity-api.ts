import { getAppDataClient } from "../../lib/supabase-data";
import { isTesterWorkflowV2Enabled } from "../../lib/supabase-v2";

export async function getActivityHistoryPageData(userId: string) {
  const client = getAppDataClient();
  const [profile, assignmentResult, feedbackResult, ledgerResult, notice] = await Promise.all([
    client.from("profiles").select("display_name,avatar_url").eq("id", userId).maybeSingle(),
    isTesterWorkflowV2Enabled
      ? client.from("assignments").select("id,status,started_at,assigned_at,completed_at,test:tests(id,title,status,app:apps(name,icon_url)),checkins(id,checkin_date,created_at)").eq("tester_id", userId).order("assigned_at", { ascending: false })
      : client.from("assignments").select("id,status,start_date,completed_at,created_at,test:tests(id,title,status,app:apps(name,icon_url)),checkins(id,checkin_date,created_at)").eq("tester_id", userId).order("created_at", { ascending: false }),
    client.from("feedback").select("id,assignment_id,rating,quality_status,created_at").eq("tester_id", userId).order("created_at", { ascending: false }),
    isTesterWorkflowV2Enabled
      ? Promise.resolve({ data: [], error: null })
      : client.from("points_ledger").select("amount,reference_id,wallet_type").eq("user_id", userId).eq("wallet_type", "earned_points"),
    client.from("notifications").select("id", { count: "exact", head: true }).eq("user_id", userId).is("read_at", null),
  ]);

  const assignments = isTesterWorkflowV2Enabled
    ? ((assignmentResult.data ?? []) as any[]).map((row) => ({
        id: row.id,
        status: row.status,
        start_date: row.started_at || row.assigned_at,
        completed_at: row.completed_at,
        created_at: row.created_at || row.assigned_at,
        test: row.test || null,
        checkins: row.checkins || [],
      }))
    : ((assignmentResult.data ?? []) as any[]);

  return {
    displayName: profile.data?.display_name?.trim() ?? "",
    avatarUrl: profile.data?.avatar_url ?? "",
    assignments,
    assignmentError: assignmentResult.error,
    feedback: feedbackResult.data ?? [],
    feedbackError: feedbackResult.error,
    ledger: ledgerResult.data ?? [],
    ledgerError: ledgerResult.error,
    notifications: notice.count ?? 0,
    profileError: profile.error,
    notificationError: notice.error,
  };
}

/** Read-only check-in history data; schema-specific fields stay inside the feature API. */
export async function getCheckInHistoryPageData(userId: string): Promise<any> {
  const client = getAppDataClient();
  if (isTesterWorkflowV2Enabled) {
    const [profile, checkins, notice] = await Promise.all([
      client.from("profiles").select("display_name,avatar_url").eq("id", userId).maybeSingle(),
      client.from("checkins")
        .select("id,assignment_id,checkin_date,created_at,note,evidence_path,assignment:assignments(id,status,test:tests(id,title,status,app:apps(name,icon_url)))")
        .eq("tester_id", userId).order("checkin_date", { ascending: false }),
      client.from("notifications").select("id", { count: "exact", head: true })
        .eq("user_id", userId).is("read_at", null),
    ]);
    return { profile, checkins, notice, ledger: null, isV2: true as const };
  }

  const [profile, checkins, notice] = await Promise.all([
    client.from("profiles").select("display_name,avatar_url").eq("id", userId).maybeSingle(),
    client.from("checkins")
      .select("id,assignment_id,checkin_date,created_at,note,evidence_url,assignment:assignments(id,status,test:tests(id,title,status,app:apps(name,icon_url)))")
      .eq("tester_id", userId).order("checkin_date", { ascending: false }),
    client.from("notifications").select("id", { count: "exact", head: true })
      .eq("user_id", userId).is("read_at", null),
  ]);
  let ledger: any = null;
  const ids = (checkins.data ?? []).map((row: { id: string }) => row.id);
  if (!checkins.error && ids.length) {
    ledger = await client.from("points_ledger").select("amount,reference_id")
      .eq("user_id", userId).eq("wallet_type", "earned_points").in("reference_id", ids);
  }
  return { profile, checkins, notice, ledger, isV2: false as const };
}

/** Read-only feedback history data; legacy points ledger is not queried in V2. */
export async function getFeedbackHistoryPageData(userId: string): Promise<any> {
  const client = getAppDataClient();
  const [profileResult, feedbackResult] = await Promise.all([
    client.from("profiles").select("display_name,avatar_url").eq("id", userId).maybeSingle(),
    client.from("feedback")
      .select("id,assignment_id,rating,body,category,quality_status,reviewed_at,created_at,assignment:assignments(id,test:tests(id,title,app:apps(name,icon_url)))")
      .eq("tester_id", userId).order("created_at", { ascending: false }),
  ]);
  if (isTesterWorkflowV2Enabled) {
    return { profileResult, feedbackResult, ledgerResult: null, isV2: true as const };
  }
  const ledgerResult = await client.from("points_ledger").select("amount,reference_id,reference_type")
    .eq("user_id", userId).eq("wallet_type", "earned_points");
  return { profileResult, feedbackResult, ledgerResult, isV2: false as const };
}
