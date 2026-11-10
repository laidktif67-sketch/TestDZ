import { createContext } from "react";
import type { Session, User } from "@supabase/supabase-js";

export interface IdentityContextValue {
  session: Session | null;
  user: User | null;
  loading: boolean;
  error: Error | null;
  refreshSession: () => Promise<void>;
  signOut: () => Promise<void>;
}

export const IdentityContext = createContext<IdentityContextValue | null>(null);
