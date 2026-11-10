import { supabase } from "../../lib/supabase";
import type {
  AvatarUploadInput,
  AvatarUploadResult,
  IdentityUserMetadataUpdate,
  ProfileCompletionUpdate,
  ProfileSettingsUpdate,
} from "@testdz/types";

function getClient() {
  if (!supabase) throw new Error("SUPABASE_NOT_CONFIGURED");
  return supabase;
}

const AVATAR_EXTENSIONS = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
} as const;

const LEGACY_AVATAR_NAME = /^avatar(?:-[0-9]+)?\.(?:jpe?g|png|webp)$/i;

export const profilesApi = {
  isConfigured() {
    return Boolean(supabase);
  },

  getCurrentUser() {
    return getClient().auth.getUser();
  },

  getOnboardingStatus(userId: string) {
    return getClient()
      .from("profiles")
      .select("onboarding_completed_at")
      .eq("id", userId)
      .maybeSingle();
  },

  completeOnboarding(roles: string[], interests: string[]) {
    return getClient().rpc("complete_onboarding", {
      p_roles: roles,
      p_interests: interests,
    });
  },

  getProfile(userId: string) {
    return getClient()
      .from("profiles")
      .select("display_name, phone, bio, avatar_url, is_verified, locale")
      .eq("id", userId)
      .single();
  },

  updateSettings(userId: string, input: ProfileSettingsUpdate) {
    return getClient().from("profiles").update(input).eq("id", userId);
  },

  updateCompletion(userId: string, input: ProfileCompletionUpdate) {
    return getClient().from("profiles").update(input).eq("id", userId);
  },

  updateUserMetadata(data: IdentityUserMetadataUpdate) {
    return getClient().auth.updateUser({ data });
  },

  async uploadAvatar(userId: string, input: AvatarUploadInput): Promise<AvatarUploadResult> {
    const client = getClient();
    const extension = AVATAR_EXTENSIONS[input.contentType];

    if (!extension || input.body.byteLength === 0) {
      return {
        ok: false,
        stage: "upload",
        errorCode: "AVATAR_UPLOAD_FAILED",
        cleanupPending: false,
      };
    }

    // Versioned names avoid CDN stale-content issues and do not require Storage upsert permissions.
    const path = `${userId}/avatar-${Date.now()}.${extension}`;
    const bucket = client.storage.from("avatars");
    const { error: uploadError } = await bucket.upload(path, input.body, {
      upsert: false,
      contentType: input.contentType,
      cacheControl: "3600",
    });

    if (uploadError) {
      return {
        ok: false,
        stage: "upload",
        errorCode: "AVATAR_UPLOAD_FAILED",
        cleanupPending: false,
      };
    }

    const { data } = bucket.getPublicUrl(path);
    const url = `${data.publicUrl}?v=${Date.now()}`;
    const { error: profileError } = await client
      .from("profiles")
      .update({ avatar_url: url })
      .eq("id", userId);

    if (profileError) {
      // Keep the previously saved avatar intact; remove only this newly uploaded object.
      const { error: rollbackError } = await bucket.remove([path]);
      return {
        ok: false,
        stage: "profile-update",
        errorCode: "PROFILE_UPDATE_FAILED",
        cleanupPending: Boolean(rollbackError),
      };
    }

    // Cleanup is deliberately best-effort and happens only after the profile points to the new image.
    // RLS may deny listing/deleting; in that case the new avatar remains valid and cleanup is reported as pending.
    const { data: objects, error: listError } = await bucket.list(userId, {
      limit: 1000,
      search: "avatar",
    });

    if (listError) return { ok: true, url, cleanupPending: true };

    const obsoletePaths = (objects ?? [])
      .filter((object) => object.name !== path.split("/").pop() && LEGACY_AVATAR_NAME.test(object.name))
      .map((object) => `${userId}/${object.name}`);

    if (obsoletePaths.length === 0) return { ok: true, url, cleanupPending: false };

    const { error: cleanupError } = await bucket.remove(obsoletePaths);
    return { ok: true, url, cleanupPending: Boolean(cleanupError) };
  },
};
