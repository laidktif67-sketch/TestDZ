export type ProfileLocale = "en" | "fr" | "ar";
export type AvatarMimeType = "image/jpeg" | "image/png" | "image/webp";

export interface ProfileRecord {
  id: string;
  display_name: string | null;
  phone: string | null;
  bio: string | null;
  avatar_url: string | null;
  is_verified: boolean;
  locale: string;
  onboarding_completed_at: string | null;
}

export interface ProfileSettingsUpdate {
  display_name: string;
  phone: string | null;
  bio: string | null;
}

export interface ProfileCompletionUpdate {
  display_name: string;
  bio: string | null;
  locale: ProfileLocale;
}

/**
 * Platform-neutral avatar payload.
 * Web and React Native adapters should convert their picked image to ArrayBuffer.
 */
export interface AvatarUploadInput {
  body: ArrayBuffer;
  contentType: AvatarMimeType;
}

export type AvatarUploadFailureStage = "upload" | "profile-update";

export type AvatarUploadResult =
  | {
      ok: false;
      stage: AvatarUploadFailureStage;
      errorCode: "AVATAR_UPLOAD_FAILED" | "PROFILE_UPDATE_FAILED";
      cleanupPending: boolean;
    }
  | {
      ok: true;
      url: string;
      cleanupPending: boolean;
    };
