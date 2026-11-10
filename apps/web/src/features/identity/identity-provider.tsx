import { useCallback, useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import type { Session } from "@supabase/supabase-js";
import { identityApi } from "./identity-api";
import { IdentityContext } from "./identity-context";

function asError(value: unknown): Error {
  return value instanceof Error ? value : new Error("IDENTITY_SESSION_FAILED");
}

export function IdentityProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

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
      setSession(data.session);
      setError(null);
    } catch (reason) {
      setError(asError(reason));
      throw asError(reason);
    } finally {
      setLoading(false);
    }
  }, []);

  const signOut = useCallback(async () => {
    const { error: signOutError } = await identityApi.signOut();
    if (signOutError) throw signOutError;
    setSession(null);
    setError(null);
  }, []);

  const value = useMemo(() => ({
    session,
    user: session?.user ?? null,
    loading,
    error,
    refreshSession,
    signOut,
  }), [session, loading, error, refreshSession, signOut]);

  return <IdentityContext.Provider value={value}>{children}</IdentityContext.Provider>;
}
