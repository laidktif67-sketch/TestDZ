import { getAppDataClient } from "../../lib/supabase-data";
import { isTesterWorkflowV2Enabled } from "../../lib/supabase-v2";

/**
 * Database queries for tester-facing discovery and dashboard screens.
 * Authentication/session listeners stay in the pages and use the base client.
 */
export async function getTesterDashboardData(userId: string) {
  const client = getAppDataClient();

  if (isTesterWorkflowV2Enabled) {
    const [profileRes, walletRes, assignmentRes, testRes, notificationRes] = await Promise.all([
      client.from("profiles").select("display_name,avatar_url").eq("id", userId).maybeSingle(),
      client.from("wallets").select("earned_points").eq("user_id", userId).maybeSingle(),
      client.from("assignments").select("id,status,started_at,assigned_at,created_at,completed_at,checkins(id,checkin_date),test:tests(title,end_date,app:apps(name))").eq("tester_id", userId),
      client.rpc("get_discoverable_tests"),
      client.from("notifications").select("id", { count: "exact", head: true }).eq("user_id", userId).is("read_at", null),
    ]);
    return { isV2: true as const, profileRes, walletRes, assignmentRes, testRes, notificationRes };
  }

  const [profileRes, walletRes, assignmentRes, testRes, notificationRes] = await Promise.all([
    client.from("profiles").select("display_name,avatar_url").eq("id", userId).maybeSingle(),
    client.from("wallets").select("earned_points").eq("user_id", userId).maybeSingle(),
    client.from("assignments").select("id,status,start_date,created_at,completed_at,checkins(id,checkin_date),test:tests(title,end_date,app:apps(name))").eq("tester_id", userId),
    client.from("tests").select("id,title,status,min_testers,app:apps(name,icon_url)", { count: "exact" }).in("status", ["recruiting", "ready", "running"]).order("created_at", { ascending: false }).limit(4),
    client.from("notifications").select("id", { count: "exact", head: true }).eq("user_id", userId).is("read_at", null),
  ]);
  return { isV2: false as const, profileRes, walletRes, assignmentRes, testRes, notificationRes };
}

export async function getDiscoverTestsPageData(userId: string) {
  const client = getAppDataClient();
  const [profile, wallet, assignments, notifications, testRows] = isTesterWorkflowV2Enabled
    ? await Promise.all([
        client.from("profiles").select("display_name,avatar_url").eq("id", userId).maybeSingle(),
        client.from("wallets").select("earned_points").eq("user_id", userId).maybeSingle(),
        client.from("assignments").select("id,status").eq("tester_id", userId),
        client.from("notifications").select("id", { count: "exact", head: true }).eq("user_id", userId).is("read_at", null),
        client.rpc("get_discoverable_tests"),
      ])
    : await Promise.all([
        client.from("profiles").select("display_name,avatar_url").eq("id", userId).maybeSingle(),
        client.from("wallets").select("earned_points").eq("user_id", userId).maybeSingle(),
        client.from("assignments").select("id,status").eq("tester_id", userId),
        client.from("notifications").select("id", { count: "exact", head: true }).eq("user_id", userId).is("read_at", null),
        client.from("tests").select("id,title,description,short_summary,status,min_testers,start_date,end_date,app:apps(name,icon_url,category)").in("status", ["recruiting", "ready"]).order("created_at", { ascending: false }).limit(60),
      ]);

  const tests = isTesterWorkflowV2Enabled
    ? ((testRows.data ?? []) as any[]).map((row) => ({
        id: row.test_id,
        title: row.title,
        description: row.description,
        short_summary: row.short_summary,
        status: row.test_status,
        min_testers: row.min_testers,
        start_date: row.start_date,
        end_date: row.end_date,
        app: { name: row.app_name, icon_url: row.app_icon_url, category: row.app_category },
      }))
    : ((testRows.data ?? []) as any[]);

  return {
    displayName: profile.data?.display_name?.trim() ?? "",
    avatarUrl: profile.data?.avatar_url ?? "",
    points: Number(wallet.data?.earned_points ?? 0),
    completed: (assignments.data ?? []).filter((assignment: { status: string }) => assignment.status === "completed").length,
    unread: notifications.count ?? 0,
    tests,
    hasError: Boolean(profile.error || wallet.error || assignments.error || notifications.error || testRows.error),
  };
}

export async function getMyTestsPageData(userId: string) {
  const client = getAppDataClient();
  const [roleRes, profileRes, walletRes, assignmentRes, feedbackRes, noticeRes] = await Promise.all([
    client.from("user_roles").select("role").eq("user_id", userId),
    client.from("profiles").select("display_name,avatar_url").eq("id", userId).maybeSingle(),
    client.from("wallets").select("earned_points").eq("user_id", userId).maybeSingle(),
    isTesterWorkflowV2Enabled
      ? client.from("assignments").select("id,status,started_at,assigned_at,completed_at,created_at,test:tests(id,title,status,end_date,app:apps(name,icon_url)),checkins(id,checkin_date,created_at)").eq("tester_id", userId).order("assigned_at", { ascending: false })
      : client.from("assignments").select("id,status,start_date,completed_at,created_at,test:tests(id,title,status,end_date,app:apps(name,icon_url)),checkins(id,checkin_date,created_at)").eq("tester_id", userId).order("created_at", { ascending: false }),
    client.from("feedback").select("id,quality_status,created_at,assignment_id").eq("tester_id", userId).order("created_at", { ascending: false }),
    client.from("notifications").select("id", { count: "exact", head: true }).eq("user_id", userId).is("read_at", null),
  ]);

  const assignments = isTesterWorkflowV2Enabled
    ? ((assignmentRes.data ?? []) as any[]).map((assignment) => ({
        id: assignment.id,
        status: assignment.status,
        start_date: assignment.started_at || assignment.assigned_at,
        completed_at: assignment.completed_at,
        created_at: assignment.created_at || assignment.assigned_at,
        points_awarded: null,
        test: assignment.test || null,
        checkins: assignment.checkins || [],
      }))
    : ((assignmentRes.data ?? []) as any[]);

  const feedback = (feedbackRes.data ?? []) as any[];
  const activities: { id: string; kind: "checkin" | "feedback" | "completed"; title: string; detail: string; date: string }[] = [];
  assignments.forEach((assignment: any) => {
    if (assignment.completed_at) activities.push({
      id: "done-" + assignment.id,
      kind: "completed",
      title: "You completed a test",
      detail: assignment.test?.title || "Test",
      date: assignment.completed_at,
    });
    (assignment.checkins ?? []).forEach((checkin: any) => activities.push({
      id: "check-" + checkin.id,
      kind: "checkin",
      title: "You completed a check-in",
      detail: assignment.test?.title || "Test",
      date: checkin.created_at || checkin.checkin_date,
    }));
  });
  feedback.forEach((item: any) => {
    const assignment = assignments.find((row: any) => row.id === item.assignment_id);
    activities.push({
      id: "feedback-" + item.id,
      kind: "feedback",
      title: "You submitted feedback",
      detail: assignment?.test?.title || "Test feedback",
      date: item.created_at,
    });
  });

  return {
    roles: ((roleRes.data ?? []) as { role: string }[]).map((row) => row.role),
    displayName: profileRes.data?.display_name?.trim() ?? "",
    avatarUrl: profileRes.data?.avatar_url ?? "",
    assignments,
    points: Number(walletRes.data?.earned_points ?? 0),
    acceptedFeedback: feedback.filter((item) => item.quality_status === "accepted").length,
    notifications: noticeRes.count ?? 0,
    activities: activities.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()).slice(0, 4),
    hasError: Boolean(roleRes.error || profileRes.error || walletRes.error || assignmentRes.error || feedbackRes.error || noticeRes.error),
  };
}

export async function getActivityHistoryPageData(userId: string) {
  const client = getAppDataClient();
  const [profile, assignmentResult, feedbackResult, ledgerResult, notice] = await Promise.all([
    client.from("profiles").select("display_name,avatar_url").eq("id", userId).maybeSingle(),
    isTesterWorkflowV2Enabled
      ? client.from("assignments").select("id,status,started_at,assigned_at,completed_at,created_at,test:tests(id,title,status,app:apps(name,icon_url)),checkins(id,checkin_date,created_at)").eq("tester_id", userId).order("assigned_at", { ascending: false })
      : client.from("assignments").select("id,status,start_date,completed_at,created_at,test:tests(id,title,status,app:apps(name,icon_url)),checkins(id,checkin_date,created_at)").eq("tester_id", userId).order("created_at", { ascending: false }),
    client.from("feedback").select("id,assignment_id,rating,quality_status,created_at").eq("tester_id", userId).order("created_at", { ascending: false }),
    isTesterWorkflowV2Enabled
      ? client.from("wallet_ledger").select("amount,reference_id,wallet_type").eq("user_id", userId).eq("wallet_type", "earned_points")
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
