import { Navigate, Outlet, useLocation } from "react-router-dom";
import type { AccountRole } from "@testdz/types";
import { useIdentity } from "../../features/identity/hooks/useIdentity";
import "./route-guards.css";

type WorkspaceRole = Extract<AccountRole, "tester" | "developer" | "admin">;

export function getHomePath(roles: AccountRole[]): string {
  if (roles.includes("admin") || roles.includes("tester")) return "/tester-dashboard";
  if (roles.includes("developer")) return "/developer-dashboard";
  return "/profile";
}

function LoadingRoles() {
  return (
    <main className="route-guard-screen" aria-live="polite" aria-busy="true">
      <span className="route-guard-spinner" aria-hidden="true" />
      <p>Checking your workspace permissions…</p>
    </main>
  );
}

function RoleLoadError({ retry }: { retry: () => void }) {
  return (
    <main className="route-guard-screen" role="alert">
      <div className="route-guard-message">
        <strong>We couldn’t verify your workspace permissions.</strong>
        <p>Your access has not been changed. Check your connection and retry.</p>
        <button type="button" onClick={retry}>Retry</button>
      </div>
    </main>
  );
}

export default function RoleGuard({ requiredRole }: { requiredRole: WorkspaceRole }) {
  const { user, roles, rolesLoading, rolesError, refreshRoles } = useIdentity();

  if (!user) return <Navigate to="/auth" replace />;
  if (rolesLoading) return <LoadingRoles />;
  if (rolesError) return <RoleLoadError retry={() => { void refreshRoles(); }} />;

  if (roles.includes(requiredRole) || roles.includes("admin")) return <Outlet />;

  const fallback = requiredRole === "tester" && roles.includes("developer")
    ? "/developer-dashboard"
    : requiredRole === "developer" && roles.includes("tester")
      ? "/tester-dashboard"
      : "/profile";

  return (
    <Navigate
      to={fallback}
      replace
      state={{
        accessNotice: requiredRole === "tester"
          ? "This workspace requires tester access. We opened a workspace available to your account."
          : "This workspace requires developer access. We opened a workspace available to your account.",
      }}
    />
  );
}

export function RoleHomeRedirect() {
  const { user, roles, rolesLoading, rolesError, refreshRoles } = useIdentity();

  if (!user) return <Navigate to="/auth" replace />;
  if (rolesLoading) return <LoadingRoles />;
  if (rolesError) return <RoleLoadError retry={() => { void refreshRoles(); }} />;

  return <Navigate to={getHomePath(roles)} replace />;
}

export function RoleAccessNotice() {
  const location = useLocation();
  const notice = (location.state as { accessNotice?: unknown } | null)?.accessNotice;

  if (typeof notice !== "string" || !notice) return null;
  return <div className="role-access-notice" role="status">{notice}</div>;
}
