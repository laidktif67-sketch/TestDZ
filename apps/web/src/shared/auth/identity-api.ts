import { supabase } from "../../lib/supabase";
import { getAppDataClient } from "../../lib/supabase-data";
import type { AuthChangeEvent, Session } from "@supabase/supabase-js";
import type {
  AccountRole,
  IdentityOAuthProvider,
  IdentitySignUpInput,
} from "@testdz/types";

export type { AccountRole, IdentityOAuthProvider } from "@testdz/types";

const ACCOUNT_ROLES = new Set<AccountRole>([
  "tester",
  "developer",
  "admin",
  "financial",
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

  getUserRoles(userId: string): Promise<AccountRole[]> {
    const client = getAppDataClient();
    const query = client
      .from("user_roles")
      .select("role")
      .eq("user_id", userId);

    return Promise.resolve(query).then(({ data, error }) => {
      if (error) throw error;
      return (data ?? [])
        .map((row: { role: string }) => row.role)
        .filter((role: string): role is AccountRole =>
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

  updateUserMetadata(data: Record<string, unknown>) {
    return getClient().auth.updateUser({ data });
  },

  getMyActiveSessions() {
    return getAppDataClient().rpc("get_my_active_sessions");
  },

  getMySecurityActivity(limit = 30) {
    return getAppDataClient().rpc("get_my_security_activity", { p_limit: limit });
  },

  getSession() {
    return getClient().auth.getSession();
  },
};
