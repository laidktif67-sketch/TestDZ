import { getAppDataClient } from "../../lib/supabase-data";
import { isTesterWorkflowV2Enabled } from "../../lib/supabase-v2";

function scopeNotificationRole(query: any, recipientRole: NotificationRecipientRole) {
  return isTesterWorkflowV2Enabled ? query.eq("recipient_role", recipientRole) : query;
}

export type NotificationRecipientRole = "tester" | "developer";

/** Count unread notifications for shared feature-page headers. */
export function getUnreadNotificationCount(userId: string, recipientRole: NotificationRecipientRole = "tester") {
  const query = getAppDataClient().from("notifications").select("id", { count: "exact", head: true }).eq("user_id", userId);
  return scopeNotificationRole(query, recipientRole).is("read_at", null);
}

/** Read the notifications center through the central application data client. */
export async function getNotificationsCenterPageData(userId: string, recipientRole: NotificationRecipientRole = "tester") {
  const client = getAppDataClient();
  const [notificationResult, assignmentResult] = await Promise.all([
    scopeNotificationRole(client.from("notifications").select(isTesterWorkflowV2Enabled ? "id,recipient_role,type,title,body,data,read_at,created_at" : "id,type,title,body,data,read_at,created_at").eq("user_id", userId), recipientRole).order("created_at", { ascending: false }).limit(100),
    client.from("assignments").select("id,test:tests(end_date)").eq("tester_id", userId),
  ]);
  if (isTesterWorkflowV2Enabled) {
    return { isV2: true as const, notificationResult, assignmentResult, rewardPoints: 0 };
  }
  const since = new Date(Date.now() - 30 * 86400000).toISOString();
  const rewardsResult = await client.from("points_ledger").select("amount")
    .eq("user_id", userId).eq("wallet_type", "earned_points").gt("created_at", since);
  const rewardPoints = (rewardsResult.data ?? []).reduce(
    (sum: number, row: { amount: number | string }) => sum + Math.max(0, Number(row.amount) || 0), 0,
  );
  return { isV2: false as const, notificationResult, assignmentResult, rewardsResult, rewardPoints };
}

/** Mark one notification read through the V2 RPC or the isolated legacy fallback. */
export async function markTesterNotificationRead(userId: string, notificationId: string, readAt: string, recipientRole: NotificationRecipientRole = "tester") {
  const client = getAppDataClient();
  if (isTesterWorkflowV2Enabled) {
    return client.rpc("mark_notification_read", { p_notification_id: notificationId, p_recipient_role: recipientRole });
  }
  return scopeNotificationRole(client.from("notifications").update({ read_at: readAt }).eq("id", notificationId).eq("user_id", userId), recipientRole);
}

/** Mark all unread notifications read through the V2 RPC or isolated legacy fallback. */
export async function markAllTesterNotificationsRead(userId: string, readAt: string, recipientRole: NotificationRecipientRole = "tester") {
  const client = getAppDataClient();
  if (isTesterWorkflowV2Enabled) {
    return client.rpc("mark_all_notifications_read", { p_recipient_role: recipientRole });
  }
  return scopeNotificationRole(client.from("notifications").update({ read_at: readAt }).eq("user_id", userId), recipientRole).is("read_at", null);
}
