import { supabase } from "../../lib/supabase";
import type { TablesUpdate } from "@testdz/types";

function getClient() {
  if (!supabase) throw new Error("SUPABASE_NOT_CONFIGURED");
  return supabase;
}

export type ProfileSettingsUpdate = Pick<
  TablesUpdate<"profiles">,
  "display_name" | "phone" | "bio"
>;

export type ProfileCompletionUpdate = Pick<
  TablesUpdate<"profiles">,
  "display_name" | "bio" | "locale"
>;

export const profilesApi = {
  getCurrentUser() {
    return getClient().auth.getUser();
  },

  getProfile(userId: string) {
    return getClient().from("profiles").select("*").eq("id", userId).single();
  },

  updateSettings(userId: string, input: ProfileSettingsUpdate) {
    return getClient().from("profiles").update(input).eq("id", userId);
  },

  updateCompletion(userId: string, input: ProfileCompletionUpdate) {
    return getClient().from("profiles").update(input).eq("id", userId);
  },

  updateUserMetadata(data: {
    username: string;
    country: string;
    portfolio_url: string;
  }) {
    return getClient().auth.updateUser({ data });
  },

  async uploadAvatar(userId: string, file: File) {
    const client = getClient();
    const extension =
      file.type === "image/png" ? "png" : file.type === "image/webp" ? "webp" : "jpg";
    const path = userId + "/avatar." + extension;

    const { error: uploadError } = await client.storage
      .from("avatars")
      .upload(path, file, {
        upsert: true,
        contentType: file.type,
        cacheControl: "3600",
      });

    if (uploadError) {
      return { url: null, stage: "upload" as const, error: uploadError };
    }

    const { data } = client.storage.from("avatars").getPublicUrl(path);
    const url = data.publicUrl + "?v=" + Date.now();
    const { error: profileError } = await client
      .from("profiles")
      .update({ avatar_url: url })
      .eq("id", userId);

    if (profileError) {
      return { url: null, stage: "profile-update" as const, error: profileError };
    }

    return { url, stage: null, error: null };
  },
};
