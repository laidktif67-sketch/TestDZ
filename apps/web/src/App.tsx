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
import DeveloperTestsPage from "./modules/developer/pages/DeveloperTestsPage";
import DeveloperFeedbackPage from "./modules/developer/pages/DeveloperFeedbackPage";
import DeveloperReviewQueuePage from "./modules/developer/pages/DeveloperReviewQueuePage";
import TesterProfilePage from "./modules/tester/pages/TesterProfilePage";
import SettingsSecurityPage from "./modules/tester/pages/SettingsSecurityPage";
import NotificationPreferencesPage from "./modules/tester/pages/NotificationPreferencesPage";
import LanguageAppearancePage from "./modules/tester/pages/LanguageAppearancePage";
import PrivacyDataManagementPage from "./modules/tester/pages/PrivacyDataManagementPage";
import ActiveSessionsPage from "./modules/tester/pages/ActiveSessionsPage";
import LoginActivitySecurityPage from "./modules/tester/pages/LoginActivitySecurityPage";
import NotificationsCenterPage from "./modules/tester/pages/NotificationsCenterPage";
import AssignmentSubmissionPage from "./modules/tester/pages/AssignmentSubmissionPage";
import AssignmentDetailsPage from "./modules/tester/pages/AssignmentDetailsPage";
import ActiveAssignmentProgressPage from "./modules/tester/pages/ActiveAssignmentProgressPage";
import TestCompletionSummaryPage from "./modules/tester/pages/TestCompletionSummaryPage";
import TestCompletionRewardPage from "./modules/tester/pages/TestCompletionRewardPage";
import TesterLeaderboardPage from "./modules/tester/pages/TesterLeaderboardPage";
import TesterSectionPage from "./modules/tester/pages/TesterSectionPage";
import AdminRoleRequestsPage from "./modules/admin/pages/AdminRoleRequestsPage";
import AdminUsersPage from "./modules/admin/pages/AdminUsersPage";
import AdminAuditLogPage from "./modules/admin/pages/AdminAuditLogPage";
import AdminFraudReviewsPage from "./modules/admin/pages/AdminFraudReviewsPage";
import FinancialOperationsPage from "./modules/admin/pages/FinancialOperationsPage";
import WalletRewardsPage from "./modules/tester/pages/WalletRewardsPage";
import WithdrawalRequestPage from "./modules/tester/pages/WithdrawalRequestPage";
import WithdrawalStatusPage from "./modules/tester/pages/WithdrawalStatusPage";
import SubmitFeedbackPage from "./modules/tester/pages/SubmitFeedbackPage";
import ReportProblemPage from "./modules/tester/pages/ReportProblemPage";
import FeedbackHistoryPage from "./modules/tester/pages/FeedbackHistoryPage";
import CheckInHistoryPage from "./modules/tester/pages/CheckInHistoryPage";
import ActivityHistoryPage from "./modules/tester/pages/ActivityHistoryPage";
import ReferralProgramPage from "./modules/tester/pages/ReferralProgramPage";
import ReferralHistoryPage from "./modules/tester/pages/ReferralHistoryPage";
import HelpSupportPage from "./modules/tester/pages/HelpSupportPage";
import SupportCenterPage from "./modules/tester/pages/SupportCenterPage";
import SupportTicketDetailsPage from "./modules/tester/pages/SupportTicketDetailsPage";
import LiveChatPage from "./modules/tester/pages/LiveChatPage";
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
        <Route path="/assignments/:id" element={<AssignmentDetailsPage />} />
        <Route path="/assignments/:id/progress" element={<ActiveAssignmentProgressPage />} />
        <Route path="/assignments/:id/submit" element={<AssignmentSubmissionPage />} />
        <Route path="/assignments/:id/summary" element={<TestCompletionSummaryPage />} />

        <Route element={<AuthGuard />}>
          <Route element={<OnboardingGuard />}>
            <Route path="/onboarding" element={<OnboardingPage />} />
            <Route path="/interests" element={<InterestsPage />} />
            <Route path="/complete-profile" element={<ProfileCompletionPage />} />
          </Route>
          <Route path="/profile" element={<TesterProfilePage />} />
          <Route path="/feedback-history" element={<FeedbackHistoryPage />} />
          <Route path="/submit-feedback" element={<SubmitFeedbackPage />} />
          <Route path="/report-problem" element={<ReportProblemPage />} />
          <Route path="/wallet-rewards" element={<WalletRewardsPage />} />
          <Route path="/withdrawal-request" element={<WithdrawalRequestPage />} />
          <Route path="/withdrawal-status" element={<WithdrawalStatusPage />} />
          <Route path="/help" element={<HelpSupportPage />} />
          <Route path="/support" element={<SupportCenterPage />} />
          <Route path="/support/:id" element={<SupportTicketDetailsPage />} />
          <Route path="/live-chat" element={<LiveChatPage />} />
          <Route path="/help-support" element={<Navigate to="/help" replace />} />
          <Route path="/settings" element={<SettingsSecurityPage />} />
          <Route path="/notification-preferences" element={<NotificationPreferencesPage />} />
          <Route path="/active-sessions" element={<ActiveSessionsPage />} />
          <Route element={<RoleGuard requiredRole="tester" />}>
            <Route path="/tester/security-history" element={<LoginActivitySecurityPage />} />
          </Route>
          <Route path="/notifications" element={<NotificationsCenterPage />} />
          <Route element={<RoleGuard requiredRole="financial" />}>
            <Route path="/financial-operations" element={<FinancialOperationsPage />} />
          </Route>
          <Route element={<RoleGuard requiredRole="admin" />}>
            <Route path="/admin" element={<TesterSectionPage />} />
            <Route path="/admin/role-requests" element={<AdminRoleRequestsPage />} />
            <Route path="/admin/users" element={<AdminUsersPage />} />
            <Route path="/admin/audit-log" element={<AdminAuditLogPage />} />
            <Route path="/admin/fraud-reviews" element={<AdminFraudReviewsPage />} />
            <Route path="/admin/developer-reviews" element={<DeveloperReviewQueuePage />} />
          </Route>
          <Route path="/dashboard" element={<RoleHomeRedirect />} />
          <Route element={<RoleGuard requiredRole="tester" />}>
            <Route path="/tester-dashboard" element={<TesterDashboardPage />} />
            <Route path="/my-tests" element={<MyTestsPage />} />
            <Route path="/assignments/:id/reward" element={<TestCompletionRewardPage />} />
            <Route path="/leaderboard" element={<TesterLeaderboardPage />} />
            <Route path="/tester/language-appearance" element={<LanguageAppearancePage />} />
            <Route path="/tester/privacy" element={<PrivacyDataManagementPage />} />
            <Route path="/check-in-history" element={<CheckInHistoryPage />} />
            <Route path="/activity-history" element={<ActivityHistoryPage />} />
            <Route path="/referral-program" element={<ReferralProgramPage />} />
            <Route path="/referral-history" element={<ReferralHistoryPage />} />
            <Route path="/discover-tests" element={<DiscoverTestsPage />} />
            <Route path="/tests/:id" element={<TestPreviewPage />} />
          </Route>
          <Route element={<RoleGuard requiredRole="developer" />}>
            <Route path="/developer-dashboard" element={<DeveloperDashboardPage />} />
            <Route path="/developer-tests" element={<DeveloperTestsPage />} />
            <Route path="/developer-feedback" element={<DeveloperFeedbackPage />} />
            <Route path="/apps" element={<AppsPage />} />
            <Route path="/apps/:id" element={<AppDetailPage />} />
          </Route>
        </Route>

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </IdentityProvider>
  );
}
