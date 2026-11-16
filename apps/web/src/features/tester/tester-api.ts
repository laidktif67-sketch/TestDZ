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
