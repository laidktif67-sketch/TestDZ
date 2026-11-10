import { supabase } from "../../lib/supabase";
import type { IdentityOAuthProvider, IdentitySignUpInput } from "@testdz/types";

export type { IdentityOAuthProvider } from "@testdz/types";

function getClient() {
  if (!supabase) throw new Error("SUPABASE_NOT_CONFIGURED");
  return supabase;
}

export const identityApi = {
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

  getSession() {
    return getClient().auth.getSession();
  },
};
