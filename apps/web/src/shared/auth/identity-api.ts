import { supabase } from "../../lib/supabase";
import { isTesterWorkflowV2Enabled, supabaseV2 } from "../../lib/supabase-v2";
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
    const client: any = isTesterWorkflowV2Enabled ? supabaseV2 : getClient();
    if (!client) throw new Error("SUPABASE_V2_NOT_CONFIGURED");
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

  updateUserMetadata(data: IdentityUserMetadataUpdate) {
    return getClient().auth.updateUser({ data });
  },

  getSession() {
    return getClient().auth.getSession();
  },
};
