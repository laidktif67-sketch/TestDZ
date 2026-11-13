import { Navigate, Route, Routes } from "react-router-dom";
import { publicRouteElements } from "./routes/publicRoutes";
import { adminRouteElements } from "./routes/adminRoutes";
import { developerRouteElements } from "./routes/developerRoutes";
import { testerWorkspaceRouteElements } from "./routes/testerRoutes";
import AuthGuard from "./shared/guards/AuthGuard";
import OnboardingGuard from "./shared/guards/OnboardingGuard";
import RoleGuard, { RoleHomeRedirect } from "./shared/guards/RoleGuard";

export default function AppRoutes() {
  return (
    <Routes>
        {publicRouteElements}

        <Route element={<AuthGuard />}>
          <Route element={<OnboardingGuard />}>
              {authenticatedRouteElements}
          <Route element={<RoleGuard requiredRole="admin" />}>
              {adminRouteElements}
            </Route>
            <Route path="/dashboard" element={<RoleHomeRedirect />} />
            <Route element={<RoleGuard requiredRole="tester" />}>
              {testerWorkspaceRouteElements}
            </Route>
            <Route element={<RoleGuard requiredRole="developer" />}>
              {developerRouteElements}
            </Route>
          </Route>
        </Route>

        <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
