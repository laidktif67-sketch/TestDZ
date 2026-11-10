import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { ReactNode } from "react";
import type { Session } from "@supabase/supabase-js";
import type { AccountRole } from "@testdz/types";
import { identityApi } from "./identity-api";
import { IdentityContext } from "./identity-context";

function asError(value: unknown): Error {
  return value instanceof Error ? value : new Error("IDENTITY_SESSION_FAILED");
}

export function IdentityProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const [roles, setRoles] = useState<AccountRole[]>([]);
  const [rolesLoading, setRolesLoading] = useState(false);
  const [rolesError, setRolesError] = useState<Error | null>(null);
  const rolesRequestId = useRef(0);

  const loadRoles = useCallback(async (targetUserId: string) => {
    const requestId = ++rolesRequestId.current;
    setRoles([]);
    setRolesLoading(true);
    setRolesError(null);

    try {
      const nextRoles = await identityApi.getUserRoles(targetUserId);
      if (requestId === rolesRequestId.current) setRoles(nextRoles);
    } catch (reason) {
      if (requestId === rolesRequestId.current) {
        setRoles([]);
        setRolesError(asError(reason));
      }
    } finally {
      if (requestId === rolesRequestId.current) setRolesLoading(false);
    }
  }, []);

  const userId = session?.user.id ?? null;

  useEffect(() => {
    if (!userId) {
      rolesRequestId.current += 1;
      setRoles([]);
      setRolesLoading(false);
      setRolesError(null);
      return;
    }

    void loadRoles(userId);
    return () => {
      rolesRequestId.current += 1;
    };
  }, [userId, loadRoles]);

  useEffect(() => {
    if (!identityApi.isConfigured()) {
      setLoading(false);
      return;
    }

    let active = true;
    let receivedAuthEvent = false;

    const { data: { subscription } } = identityApi.onAuthStateChange((_event, nextSession) => {
      receivedAuthEvent = true;
      if (!active) return;
      rolesRequestId.current += 1;
      setRoles([]);
      setRolesLoading(Boolean(nextSession));
      setRolesError(null);
      setSession(nextSession);
      setError(null);
      setLoading(false);
    });

    void identityApi.getSession()
      .then(({ data, error: sessionError }) => {
        if (!active || receivedAuthEvent) return;
        if (sessionError) {
          setError(asError(sessionError));
          return;
        }
        rolesRequestId.current += 1;
        setRoles([]);
        setRolesLoading(Boolean(data.session));
        setRolesError(null);
        setSession(data.session);
        setError(null);
      })
      .catch((reason: unknown) => {
        if (active && !receivedAuthEvent) setError(asError(reason));
      })
      .finally(() => {
        if (active && !receivedAuthEvent) setLoading(false);
      });

    return () => {
      active = false;
      subscription.unsubscribe();
    };
  }, []);

  const refreshSession = useCallback(async () => {
    if (!identityApi.isConfigured()) {
      setSession(null);
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      const { data, error: sessionError } = await identityApi.getSession();
      if (sessionError) throw sessionError;
      rolesRequestId.current += 1;
      setRoles([]);
      setRolesLoading(Boolean(data.session));
      setRolesError(null);
      setSession(data.session);
      setError(null);
    } catch (reason) {
      setError(asError(reason));
      throw asError(reason);
    } finally {
      setLoading(false);
    }
  }, []);

  const refreshRoles = useCallback(async () => {
    if (!userId) {
      rolesRequestId.current += 1;
      setRoles([]);
      setRolesLoading(false);
      setRolesError(null);
      return;
    }
    await loadRoles(userId);
  }, [userId, loadRoles]);

  const hasRole = useCallback((role: AccountRole) => roles.includes(role), [roles]);

  const signOut = useCallback(async () => {
    const { error: signOutError } = await identityApi.signOut();
    if (signOutError) throw signOutError;
    rolesRequestId.current += 1;
    setSession(null);
    setRoles([]);
    setRolesLoading(false);
    setRolesError(null);
    setError(null);
  }, []);

  const value = useMemo(() => ({
    session,
    user: session?.user ?? null,
    loading,
    error,
    roles,
    rolesLoading,
    rolesError,
    refreshSession,
    refreshRoles,
    hasRole,
    signOut,
  }), [
    session,
    loading,
    error,
    roles,
    rolesLoading,
    rolesError,
    refreshSession,
    refreshRoles,
    hasRole,
    signOut,
  ]);

  return <IdentityContext.Provider value={value}>{children}</IdentityContext.Provider>;
}
