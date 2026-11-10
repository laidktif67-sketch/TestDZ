import { Navigate, Outlet, useLocation } from "react-router-dom";
import { useIdentity } from "../auth/hooks/useIdentity";
import "./route-guards.css";

export default function AuthGuard() {
  const { session, user, loading, error, refreshSession } = useIdentity();
  const location = useLocation();

  if (loading) {
    return (
      <main className="route-guard-screen" aria-live="polite" aria-busy="true">
        <span className="route-guard-spinner" aria-hidden="true" />
        <p>Checking your session…</p>
      </main>
    );
  }

  if (error && (!session || !user)) {
    return (
      <main className="route-guard-screen" role="alert">
        <div className="route-guard-message">
          <strong>We couldn’t verify your session.</strong>
          <p>Check your connection and try again.</p>
          <button type="button" onClick={() => { void refreshSession().catch(() => undefined); }}>
            Retry
          </button>
        </div>
      </main>
    );
  }

  if (!session || !user) {
    return (
      <Navigate
        to="/auth"
        replace
        state={{ from: location.pathname + location.search + location.hash }}
      />
    );
  }

  return <Outlet />;
}
