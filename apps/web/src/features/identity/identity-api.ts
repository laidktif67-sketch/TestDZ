import { supabase } from "../../lib/supabase";
import type { AuthChangeEvent, Session } from "@supabase/supabase-js";
import type { IdentityOAuthProvider, IdentitySignUpInput, IdentityUserMetadataUpdate } from "@testdz/types";

export type { IdentityOAuthProvider } from "@testdz/types";

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
