import { useCallback, useEffect, useState } from "react";
import { Navigate, Outlet, useLocation } from "react-router-dom";
import { useIdentity } from "../auth/hooks/useIdentity";
import { profilesApi } from "../../features/profiles/profiles-api";
import { getHomePath } from "./RoleGuard";
import "./route-guards.css";

type GuardState =
  | { userId: string; status: "loading" }
  | { userId: string; status: "ready"; completed: boolean }
  | { userId: string; status: "error" };

const ONBOARDING_PATHS = new Set(["/onboarding", "/interests"]);

function GuardLoading({ message }: { message: string }) {
  return (
    <main className="route-guard-screen" aria-live="polite" aria-busy="true">
      <span className="route-guard-spinner" aria-hidden="true" />
      <p>{message}</p>
    </main>
  );
}

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
    return <GuardLoading message="Checking your onboarding progress…" />;
  }

  if (state.status === "error") {
    return (
      <main className="route-guard-screen" role="alert">
        <div className="route-guard-message">
          <strong>We couldn’t load your onboarding progress.</strong>
          <p>Access is paused until your account setup can be verified. Check your connection and retry.</p>
          <button type="button" onClick={retry}>Retry</button>
        </div>
      </main>
    );
  }

  const isOnboardingRoute = ONBOARDING_PATHS.has(location.pathname);
  const isProfileCompletion = location.pathname === "/complete-profile";

  // New accounts may visit only the onboarding steps until the server confirms completion.
  if (!state.completed) {
    if (isOnboardingRoute) return <Outlet />;
    return <Navigate to="/onboarding" replace state={{ from: location.pathname }} />;
  }

  // Onboarding is complete. Keep the optional profile-details page available,
  // but send attempts to restart onboarding to the account's correct workspace.
  if (isOnboardingRoute) {
    if (rolesLoading) return <GuardLoading message="Preparing your workspace…" />;

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

  if (isProfileCompletion) return <Outlet />;

  return <Outlet />;
}
