import { useCallback, useEffect, useState } from "react";
import type {
  AvatarUploadInput,
  AvatarUploadResult,
  ProfileCompletionUpdate,
  ProfileRecord,
  ProfileSettingsUpdate,
} from "@testdz/types";
import { profilesApi } from "../profiles-api";

export interface UseProfileResult {
  profile: ProfileRecord | null;
  loading: boolean;
  error: Error | null;
  reload: () => Promise<ProfileRecord | null>;
  updateSettings: (input: ProfileSettingsUpdate) => Promise<void>;
  updateCompletion: (input: ProfileCompletionUpdate) => Promise<void>;
  uploadAvatar: (input: AvatarUploadInput) => Promise<AvatarUploadResult>;
}

function asError(value: unknown): Error {
  return value instanceof Error ? value : new Error("PROFILE_REQUEST_FAILED");
}

export function useProfile(userId: string | null | undefined): UseProfileResult {
  const [profile, setProfile] = useState<ProfileRecord | null>(null);
  const [loading, setLoading] = useState(Boolean(userId));
  const [error, setError] = useState<Error | null>(null);

  const reload = useCallback(async () => {
    if (!userId) {
      setProfile(null);
      setLoading(false);
      setError(null);
      return null;
    }

    setLoading(true);
    try {
      const { data, error: profileError } = await profilesApi.getProfile(userId);
      if (profileError) throw profileError;
      setProfile(data as ProfileRecord);
      setError(null);
      return data as ProfileRecord;
    } catch (reason) {
      const nextError = asError(reason);
      setError(nextError);
      return null;
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    let active = true;
    if (!userId) {
      setProfile(null);
      setLoading(false);
      setError(null);
      return;
    }

    setLoading(true);
    void Promise.resolve(profilesApi.getProfile(userId))
      .then(({ data, error: profileError }) => {
        if (!active) return;
        if (profileError) throw profileError;
        setProfile(data as ProfileRecord);
        setError(null);
      })
      .catch((reason: unknown) => {
        if (active) setError(asError(reason));
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => { active = false; };
  }, [userId]);

  const updateSettings = useCallback(async (input: ProfileSettingsUpdate) => {
    if (!userId) throw new Error("PROFILE_USER_REQUIRED");
    const { error: updateError } = await profilesApi.updateSettings(userId, input);
    if (updateError) throw updateError;
    await reload();
  }, [userId, reload]);

  const updateCompletion = useCallback(async (input: ProfileCompletionUpdate) => {
    if (!userId) throw new Error("PROFILE_USER_REQUIRED");
    const { data: updatedProfile, error: updateError } = await profilesApi.updateCompletion(userId, input);
    if (updateError) throw updateError;
    if (!updatedProfile) throw new Error("PROFILE_UPDATE_NO_ROW");
    await reload();
  }, [userId, reload]);

  const uploadAvatar = useCallback(async (input: AvatarUploadInput) => {
    if (!userId) throw new Error("PROFILE_USER_REQUIRED");
    const result = await profilesApi.uploadAvatar(userId, input);
    if (result.ok) {
      setProfile((current) => current ? { ...current, avatar_url: result.url } : current);
    }
    return result;
  }, [userId]);

  return { profile, loading, error, reload, updateSettings, updateCompletion, uploadAvatar };
}
