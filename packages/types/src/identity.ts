export type IdentityOAuthProvider = "google" | "github" | "azure";
export type IdentityAccountType = "tester" | "developer";

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
