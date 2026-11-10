import { Navigate, Route, Routes } from "react-router-dom";
import AppsPage from "./pages/AppsPage";
import AppDetailPage from "./pages/AppDetailPage";
import AuthPage from "./pages/AuthPage";
import SignupSuccessPage from "./pages/SignupSuccessPage";
import ForgotPasswordPage from "./pages/ForgotPasswordPage";
import ResetPasswordPage from "./pages/ResetPasswordPage";
import PasswordResetSuccessPage from "./pages/PasswordResetSuccessPage";
import InvalidOtpPage from "./pages/InvalidOtpPage";
import OnboardingPage from "./pages/OnboardingPage";
import InterestsPage from "./pages/InterestsPage";
import LandingPage from "./pages/LandingPage";
import LegalPage from "./pages/LegalPage";
import VerifyEmailPage from "./pages/VerifyEmailPage";
import AuthCallbackPage from "./pages/AuthCallbackPage";
import TesterDashboardPage from "./modules/tester/pages/TesterDashboardPage";
import MyTestsPage from "./modules/tester/pages/MyTestsPage";
import DeveloperDashboardPage from "./modules/developer/pages/DeveloperDashboardPage";
import TesterProfilePage from "./modules/tester/pages/TesterProfilePage";
import TesterSectionPage from "./modules/tester/pages/TesterSectionPage";
import WalletRewardsPage from "./modules/tester/pages/WalletRewardsPage";
import ProfileCompletionPage from "./pages/ProfileCompletionPage";
import { IdentityProvider } from "./shared/auth/identity-provider";
import AuthGuard from "./shared/guards/AuthGuard";
import OnboardingGuard from "./shared/guards/OnboardingGuard";
import RoleGuard, { RoleHomeRedirect } from "./shared/guards/RoleGuard";

export default function App() {
  return (
    <IdentityProvider>
      <Routes>
        <Route path="/" element={<LandingPage />} />
        <Route path="/terms" element={<LegalPage kind="terms" />} />
        <Route path="/privacy" element={<LegalPage kind="privacy" />} />
        <Route path="/auth" element={<AuthPage />} />
        <Route path="/signup-success" element={<SignupSuccessPage />} />
        <Route path="/auth/callback" element={<AuthCallbackPage />} />
        <Route path="/verify-email" element={<VerifyEmailPage />} />
        <Route path="/forgot-password" element={<ForgotPasswordPage />} />
        <Route path="/reset-password" element={<ResetPasswordPage />} />
        <Route path="/password-reset-success" element={<PasswordResetSuccessPage />} />
        <Route path="/invalid-otp" element={<InvalidOtpPage />} />

        <Route element={<AuthGuard />}>
          <Route element={<OnboardingGuard />}>
            <Route path="/onboarding" element={<OnboardingPage />} />
            <Route path="/interests" element={<InterestsPage />} />
            <Route path="/complete-profile" element={<ProfileCompletionPage />} />
          </Route>
          <Route path="/profile" element={<TesterProfilePage />} />
          <Route path="/feedback-history" element={<TesterSectionPage />} />
          <Route path="/wallet-rewards" element={<WalletRewardsPage />} />
          <Route path="/help-support" element={<TesterSectionPage />} />
          <Route path="/settings" element={<TesterSectionPage />} />
          <Route element={<RoleGuard requiredRole="admin" />}>
            <Route path="/admin" element={<TesterSectionPage />} />
          </Route>
          <Route path="/dashboard" element={<RoleHomeRedirect />} />
          <Route element={<RoleGuard requiredRole="tester" />}>
            <Route path="/tester-dashboard" element={<TesterDashboardPage />} />
            <Route path="/my-tests" element={<MyTestsPage />} />
          </Route>
          <Route element={<RoleGuard requiredRole="developer" />}>
            <Route path="/developer-dashboard" element={<DeveloperDashboardPage />} />
            <Route path="/apps" element={<AppsPage />} />
            <Route path="/apps/:id" element={<AppDetailPage />} />
          </Route>
        </Route>

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </IdentityProvider>
  );
}
