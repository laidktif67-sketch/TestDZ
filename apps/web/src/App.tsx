import { Navigate, Route, Routes } from "react-router-dom";
import AppsPage from "./pages/AppsPage";
import AppDetailPage from "./pages/AppDetailPage";
import AuthPage from "./pages/AuthPage";
import ForgotPasswordPage from "./pages/ForgotPasswordPage";
import ResetPasswordPage from "./pages/ResetPasswordPage";
import OnboardingPage from "./pages/OnboardingPage";
import InterestsPage from "./pages/InterestsPage";
import LandingPage from "./pages/LandingPage";
import VerifyEmailPage from "./pages/VerifyEmailPage";
import AuthCallbackPage from "./pages/AuthCallbackPage";
import TesterDashboardPage from "./pages/TesterDashboardPage";
import MyTestsPage from "./pages/MyTestsPage";
import DeveloperDashboardPage from "./pages/DeveloperDashboardPage";
import ProfilePage from "./pages/ProfilePage";
import ProfileCompletionPage from "./pages/ProfileCompletionPage";
import { IdentityProvider } from "./features/identity/identity-provider";
import AuthGuard from "./features/identity/guards/AuthGuard";

export default function App() {
  return (
    <IdentityProvider>
      <Routes>
        <Route path="/" element={<LandingPage />} />
        <Route path="/auth" element={<AuthPage />} />
        <Route path="/auth/callback" element={<AuthCallbackPage />} />
        <Route path="/verify-email" element={<VerifyEmailPage />} />
        <Route path="/forgot-password" element={<ForgotPasswordPage />} />
        <Route path="/reset-password" element={<ResetPasswordPage />} />

        <Route element={<AuthGuard />}>
          <Route path="/onboarding" element={<OnboardingPage />} />
          <Route path="/interests" element={<InterestsPage />} />
          <Route path="/complete-profile" element={<ProfileCompletionPage />} />
          <Route path="/profile" element={<ProfilePage />} />
          <Route path="/tester-dashboard" element={<TesterDashboardPage />} />
          <Route path="/my-tests" element={<MyTestsPage />} />
          <Route path="/dashboard" element={<Navigate to="/tester-dashboard" replace />} />
          <Route path="/developer-dashboard" element={<DeveloperDashboardPage />} />
          <Route path="/apps" element={<AppsPage />} />
          <Route path="/apps/:id" element={<AppDetailPage />} />
        </Route>

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </IdentityProvider>
  );
}
