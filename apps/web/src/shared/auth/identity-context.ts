import { createContext } from "react";
import type { Session, User } from "@supabase/supabase-js";
import type { AccountRole } from "@testdz/types";

export interface IdentityContextValue {
  session: Session | null;
  user: User | null;
  loading: boolean;
  error: Error | null;
  roles: AccountRole[];
  rolesLoading: boolean;
  rolesError: Error | null;
  refreshSession: () => Promise<void>;
  refreshRoles: () => Promise<void>;
  hasRole: (role: AccountRole) => boolean;
  signOut: () => Promise<void>;
}

export const IdentityContext = createContext<IdentityContextValue | null>(null);
