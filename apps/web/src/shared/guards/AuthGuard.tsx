import { useEffect, useState } from "react";
import { Navigate, Outlet, useLocation } from "react-router-dom";
import { identityApi } from "../auth/identity-api";
import { useIdentity } from "../auth/hooks/useIdentity";
import "./route-guards.css";

type AccountStatus = "loading" | "active" | "banned" | "error";

export default function AuthGuard() {
  const { session, user, loading, error, refreshSession, signOut } = useIdentity();
  const location = useLocation();
  const [accountStatus, setAccountStatus] = useState<{ userId: string | null; status: AccountStatus }>({ userId: null, status: "loading" });
  const currentAccountStatus = accountStatus.userId === user?.id ? accountStatus.status : "loading";
  const [statusRevision, setStatusRevision] = useState(0);

  useEffect(() => {
    if (!user?.id) {
      setAccountStatus({ userId: user?.id ?? null, status: "loading" });
      return;
    }

    let active = true;
    setAccountStatus("loading");

    void identityApi.getAccountStatus(user.id)
      .then(({ data, error: statusError }) => {
        if (statusError) throw statusError;
        if (!data) throw new Error("PROFILE_NOT_FOUND");
        if (active) setAccountStatus({ userId: user.id, status: data.is_banned ? "banned" : "active" });
      })
      .catch(() => {
        if (active) setAccountStatus({ userId: user.id, status: "error" });
      });

    return () => {
      active = false;
    };
  }, [user?.id, statusRevision]);

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

  if (currentAccountStatus === "loading") {
    return (
      <main className="route-guard-screen" aria-live="polite" aria-busy="true">
        <span className="route-guard-spinner" aria-hidden="true" />
        <p>Verifying your account status…</p>
      </main>
    );
  }

  if (currentAccountStatus === "error") {
    return (
      <main className="route-guard-screen" role="alert">
        <div className="route-guard-message">
          <strong>We couldn’t verify your account status.</strong>
          <p>Access remains blocked until your account status can be confirmed.</p>
          <button type="button" onClick={() => setStatusRevision((revision) => revision + 1)}>
            Retry
          </button>
        </div>
      </main>
    );
  }

  if (currentAccountStatus === "banned") {
    return (
      <main className="route-guard-screen" role="alert">
        <div className="route-guard-message">
          <strong>Account suspended</strong>
          <p>Your account is currently suspended. Contact TestDZ support if you believe this is a mistake.</p>
          <button type="button" onClick={() => { void signOut().catch(() => undefined); }}>
            Sign out
          </button>
        </div>
      </main>
    );
  }

  return <Outlet />;
}
