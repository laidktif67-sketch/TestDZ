import { supabase } from "../../lib/supabase";

function getClient() {
  if (!supabase) throw new Error("SUPABASE_NOT_CONFIGURED");
  return supabase;
}

/** Data access for the developer notification inbox; existing RLS remains authoritative. */
export function listDeveloperNotifications(userId: string) {
  return getClient().from("notifications")
    .select("id,user_id,type,title,body,data,read_at,archived_at,created_at")
    .eq("user_id", userId).eq("recipient_role", "developer")
    .order("created_at", { ascending: false }).limit(500);
}

export function markDeveloperNotificationRead(notificationId: string, userId: string, readAt: string) {
  return getClient().from("notifications").update({ read_at: readAt })
    .eq("id", notificationId).eq("user_id", userId).eq("recipient_role", "developer");
}

export function markAllDeveloperNotificationsRead(userId: string, readAt: string) {
  return getClient().from("notifications").update({ read_at: readAt })
    .eq("user_id", userId).eq("recipient_role", "developer")
    .is("read_at", null).is("archived_at", null);
}

export function setDeveloperNotificationArchived(notificationId: string, userId: string, archivedAt: string | null) {
  return getClient().from("notifications").update({ archived_at: archivedAt })
    .eq("id", notificationId).eq("user_id", userId);
}

/** Data access for the tester notification inbox; existing RLS remains authoritative. */
export function listTesterNotifications(userId: string) {
  return getClient().from("notifications")
    .select("id,type,title,body,data,read_at,created_at")
    .eq("user_id", userId).eq("recipient_role", "tester")
    .order("created_at", { ascending: false }).limit(100);
}

export function markTesterNotificationRead(notificationId: string, userId: string, readAt: string) {
  return getClient().from("notifications").update({ read_at: readAt })
    .eq("id", notificationId).eq("user_id", userId);
}

export function markAllTesterNotificationsRead(userId: string, readAt: string) {
  return getClient().from("notifications").update({ read_at: readAt })
    .eq("user_id", userId).is("read_at", null);
}
