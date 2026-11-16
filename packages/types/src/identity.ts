export type IdentityOAuthProvider = "google" | "github" | "azure";
export type IdentityAccountType = "tester" | "developer";

// Keep this union aligned with the roles accepted by rebuild_v2.user_roles.
export type AccountRole = "tester" | "developer" | "admin" | "financial" | "support";

export interface IdentitySignUpInput {
  email: string;
  password: string;
  metadata: {
    full_name: string;
    phone: string | null;
    account_type: IdentityAccountType;
  };
  emailRedirectTo: string;
}

export interface IdentityUserMetadataUpdate {
  username: string;
  country: string;
  portfolio_url: string;
}
