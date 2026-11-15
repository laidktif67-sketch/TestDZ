import type { AppLimit, AppRecord } from "@testdz/types";
import { supabase } from "../../lib/supabase";
import { isTesterWorkflowV2Enabled, supabaseV2 } from "../../lib/supabase-v2";

const APP_SELECT = "id,developer_id,name,package_name,description,category,icon_url,status,created_at";

function client() {
  if (!supabase) throw new Error("SUPABASE_NOT_CONFIGURED");
  return supabase;
}

function dataClient() {
  const selected = isTesterWorkflowV2Enabled ? supabaseV2 : supabase;
  if (!selected) throw new Error("SUPABASE_NOT_CONFIGURED");
  return selected;
}

/** Read the current user's applications using the existing RLS policies. */
export function listApps() {
  return dataClient().from("apps").select(APP_SELECT).order("created_at", { ascending: false });
}

/** Read the current plan's application limit through the existing RPC. */
export function getAppLimit() {
  return dataClient().rpc("get_app_limit");
}

/** Read one application; access remains enforced by the existing RLS policies. */
export function getAppById(id: string) {
  return dataClient().from("apps").select(APP_SELECT).eq("id", id).single();
}

/** Create an application through the existing server-side RPC. */
export function createApp(input: {
  name: string;
  packageName: string;
  description: string;
  category: string;
}) {
  return dataClient().rpc("create_app", {
    p_name: input.name,
    p_package_name: input.packageName,
    p_description: input.description,
    p_category: input.category,
  });
}

/** Update application metadata through the existing server-side RPC. */
export function updateApp(input: {
  id: string;
  name: string;
  description: string;
  category: string;
  iconUrl?: string;
}) {
  return dataClient().rpc("update_app", {
    p_app_id: input.id,
    p_name: input.name,
    p_description: input.description,
    p_category: input.category,
    ...(input.iconUrl === undefined ? {} : { p_icon_url: input.iconUrl }),
  });
}

/** Upload an icon to the public bucket; Storage policies restrict writes to the app owner. */
export async function uploadAppIcon(userId: string, appId: string, file: File, metadata: { name: string; description: string; category: string }) {
  const storage = client().storage;
  const extension = file.type === "image/png" ? "png" : "jpg";
  const path = userId + "/" + appId + "/icon." + extension;
  const upload = await storage.from("app-icons").upload(path, file, {
    upsert: true,
    contentType: file.type,
    cacheControl: "3600",
  });
  if (upload.error) return { uploadError: upload.error, updateError: null };
  const { data } = storage.from("app-icons").getPublicUrl(path);
  const { error: updateError } = await updateApp({
    id: appId,
    name: metadata.name,
    description: metadata.description,
    category: metadata.category,
    iconUrl: data.publicUrl,
  });
  return { uploadError: null, updateError };
}

/** Archive an application through the existing server-side RPC. */
export function archiveApp(id: string) {
  return dataClient().rpc("archive_app", { p_app_id: id });
}

/** Restore an archived application through the existing server-side RPC. */
export function restoreApp(id: string) {
  return dataClient().rpc("restore_app", { p_app_id: id });
}

export type { AppLimit, AppRecord };
