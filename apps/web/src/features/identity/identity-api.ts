import { supabase } from "../../lib/supabase";
import type { AuthChangeEvent, Session } from "@supabase/supabase-js";
import type {
  AccountRole,
  IdentityOAuthProvider,
  IdentitySignUpInput,
  IdentityUserMetadataUpdate,
} from "@testdz/types";

export type { AccountRole, IdentityOAuthProvider } from "@testdz/types";

const ACCOUNT_ROLES = new Set<AccountRole>([
  "tester",
  "developer",
  "admin",
  "support",
]);

function getClient() {
  if (!supabase) throw new Error("SUPABASE_NOT_CONFIGURED");
  return supabase;
}

export const identityApi = {
  isConfigured() {
    return Boolean(supabase);
  },

  onAuthStateChange(callback: (event: AuthChangeEvent, session: Session | null) => void) {
    return getClient().auth.onAuthStateChange(callback);
  },

  signOut() {
    return getClient().auth.signOut();
  },

  getCurrentUser() {
    return getClient().auth.getUser();
  },

  getAccountStatus(userId: string) {
    return getClient()
      .from("profiles")
      .select("is_banned")
      .eq("id", userId)
      .maybeSingle();
  },

  getUserRoles(userId: string): Promise<AccountRole[]> {
    const query = getClient()
      .from("user_roles")
      .select("role")
      .eq("user_id", userId);

    return Promise.resolve(query).then(({ data, error }) => {
      if (error) throw error;
      return (data ?? [])
        .map((row) => row.role)
        .filter((role): role is AccountRole =>
          ACCOUNT_ROLES.has(role as AccountRole)
        );
    });
  },

  signUp({ email, password, metadata, emailRedirectTo }: IdentitySignUpInput) {
    return getClient().auth.signUp({
      email,
      password,
      options: { data: metadata, emailRedirectTo },
    });
  },

  signInWithPassword(email: string, password: string) {
    return getClient().auth.signInWithPassword({ email, password });
  },

  signInWithOAuth(provider: IdentityOAuthProvider, redirectTo: string) {
    return getClient().auth.signInWithOAuth({
      provider,
      options: { redirectTo },
    });
  },

  resendSignupVerification(email: string, emailRedirectTo: string) {
    return getClient().auth.resend({
      type: "signup",
      email,
      options: { emailRedirectTo },
    });
  },

  requestPasswordReset(email: string, redirectTo: string) {
    return getClient().auth.resetPasswordForEmail(email, { redirectTo });
  },

  updatePassword(password: string) {
    return getClient().auth.updateUser({ password });
  },

  updateUserEmail(email: string) {
    return getClient().auth.updateUser({ email });
  },

  updateUserMetadata(data: IdentityUserMetadataUpdate) {
    return getClient().auth.updateUser({ data });
  },

  getSession() {
    return getClient().auth.getSession();
  },

  listMfaFactors() {
    return getClient().auth.mfa.listFactors();
  },

  enrollTotp(friendlyName: string) {
    return getClient().auth.mfa.enroll({ factorType: "totp", friendlyName });
  },

  challengeMfaFactor(factorId: string) {
    return getClient().auth.mfa.challenge({ factorId });
  },

  verifyMfaFactor(factorId: string, challengeId: string, code: string) {
    return getClient().auth.mfa.verify({ factorId, challengeId, code });
  },

  removeMfaFactor(factorId: string) {
    return getClient().auth.mfa.unenroll({ factorId });
  },

  /** Calls the database-owned security activity RPC for the current authenticated user. */
  getMySecurityActivity(limit = 30) {
    return getClient().rpc("get_my_security_activity", { p_limit: limit });
  },
};
