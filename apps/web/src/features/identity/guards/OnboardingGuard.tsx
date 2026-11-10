import { useCallback, useEffect, useState } from "react";
import { Navigate, Outlet, useLocation } from "react-router-dom";
import { useIdentity } from "../hooks/useIdentity";
import { profilesApi } from "../../profiles/profiles-api";
import { getHomePath } from "./RoleGuard";
import "./route-guards.css";

type GuardState =
  | { userId: string; status: "loading" }
  | { userId: string; status: "ready"; completed: boolean }
  | { userId: string; status: "error" };

export default function OnboardingGuard() {
  const { user, roles, rolesLoading, rolesError, refreshRoles } = useIdentity();
  const location = useLocation();
  const userId = user?.id ?? "";
  const [attempt, setAttempt] = useState(0);
  const [state, setState] = useState<GuardState>({
    userId,
    status: "loading",
  });

  useEffect(() => {
    let active = true;

    if (!userId) {
      setState({ userId, status: "loading" });
      return () => {
        active = false;
      };
    }

    setState({ userId, status: "loading" });

    Promise.resolve(profilesApi.getOnboardingStatus(userId))
      .then(({ data, error }) => {
        if (!active) return;
        if (error) throw error;
        setState({
          userId,
          status: "ready",
          completed: Boolean(data?.onboarding_completed_at),
        });
      })
      .catch(() => {
        if (active) setState({ userId, status: "error" });
      });

    return () => {
      active = false;
    };
  }, [userId, attempt]);

  const retry = useCallback(() => {
    setAttempt((current) => current + 1);
  }, []);

  if (!userId) return <Navigate to="/auth" replace />;

  if (state.userId !== userId || state.status === "loading") {
    return (
      <main className="route-guard-screen" aria-live="polite" aria-busy="true">
        <span className="route-guard-spinner" aria-hidden="true" />
        <p>Checking your onboarding progress…</p>
      </main>
    );
  }

  if (state.status === "error") {
    return (
      <main className="route-guard-screen" role="alert">
        <div className="route-guard-message">
          <strong>We couldn’t load your onboarding progress.</strong>
          <p>Check your connection and try again.</p>
          <button type="button" onClick={retry}>Retry</button>
        </div>
      </main>
    );
  }

  const isProfileCompletion = location.pathname === "/complete-profile";

  // The completion timestamp is written by complete_onboarding after interests are saved.
  // Profile completion remains optional, so this guard never forces users to fill it in.
  if (isProfileCompletion && !state.completed) {
    return <Navigate to="/onboarding" replace />;
  }

  if (!isProfileCompletion && state.completed) {
    if (rolesLoading) {
      return (
        <main className="route-guard-screen" aria-live="polite" aria-busy="true">
          <span className="route-guard-spinner" aria-hidden="true" />
          <p>Preparing your workspace…</p>
        </main>
      );
    }

    if (rolesError) {
      return (
        <main className="route-guard-screen" role="alert">
          <div className="route-guard-message">
            <strong>We couldn’t verify your account roles.</strong>
            <p>Check your connection and try again.</p>
            <button type="button" onClick={() => { void refreshRoles(); }}>Retry</button>
          </div>
        </main>
      );
    }

    return <Navigate to={getHomePath(roles)} replace />;
  }

  return <Outlet />;
}
