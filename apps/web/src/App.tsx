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
import DiscoverTestsPage from "./modules/tester/pages/DiscoverTestsPage";
import TestPreviewPage from "./modules/tester/pages/TestPreviewPage";
import DeveloperDashboardPage from "./modules/developer/pages/DeveloperDashboardPage";
import TesterProfilePage from "./modules/tester/pages/TesterProfilePage";
import SettingsSecurityPage from "./modules/tester/pages/SettingsSecurityPage";
import TesterSectionPage from "./modules/tester/pages/TesterSectionPage";
import WalletRewardsPage from "./modules/tester/pages/WalletRewardsPage";
import WithdrawalRequestPage from "./modules/tester/pages/WithdrawalRequestPage";
import WithdrawalStatusPage from "./modules/tester/pages/WithdrawalStatusPage";
import SubmitFeedbackPage from "./modules/tester/pages/SubmitFeedbackPage";
import FeedbackHistoryPage from "./modules/tester/pages/FeedbackHistoryPage";
import CheckInHistoryPage from "./modules/tester/pages/CheckInHistoryPage";
import ActivityHistoryPage from "./modules/tester/pages/ActivityHistoryPage";
import HelpSupportPage from "./modules/tester/pages/HelpSupportPage";
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
          <Route path="/feedback-history" element={<FeedbackHistoryPage />} />
          <Route path="/submit-feedback" element={<SubmitFeedbackPage />} />
          <Route path="/wallet-rewards" element={<WalletRewardsPage />} />
          <Route path="/withdrawal-request" element={<WithdrawalRequestPage />} />
          <Route path="/withdrawal-status" element={<WithdrawalStatusPage />} />
          <Route path="/help-support" element={<HelpSupportPage />} />
          <Route path="/settings" element={<SettingsSecurityPage />} />
          <Route element={<RoleGuard requiredRole="admin" />}>
            <Route path="/admin" element={<TesterSectionPage />} />
          </Route>
          <Route path="/dashboard" element={<RoleHomeRedirect />} />
          <Route element={<RoleGuard requiredRole="tester" />}>
            <Route path="/tester-dashboard" element={<TesterDashboardPage />} />
            <Route path="/my-tests" element={<MyTestsPage />} />
            <Route path="/check-in-history" element={<CheckInHistoryPage />} />
            <Route path="/activity-history" element={<ActivityHistoryPage />} />
            <Route path="/discover-tests" element={<DiscoverTestsPage />} />
            <Route path="/tests/:id" element={<TestPreviewPage />} />
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
