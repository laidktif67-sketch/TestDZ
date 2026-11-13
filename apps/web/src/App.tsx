import { Navigate, Route, Routes } from "react-router-dom";
import AppsPage from "./modules/developer/pages/DeveloperAppsPage";
import AppDetailPage from "./modules/developer/pages/DeveloperAppDetailPage";
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
import DeveloperMyTestsPage from "./modules/developer/pages/DeveloperMyTestsPage";
import DeveloperTestCampaignDetailsPage from "./modules/developer/pages/DeveloperTestCampaignDetailsPage";
import DeveloperCreateTestPage from "./modules/developer/pages/DeveloperCreateTestPage";
import DeveloperSettingsPage from "./modules/developer/pages/DeveloperSettingsPage";
import DeveloperTestMonitoringPage from "./modules/developer/pages/DeveloperTestMonitoringPage";
import DeveloperSubscriptionPage from "./modules/developer/pages/DeveloperSubscriptionPage";
import DeveloperTestersPage from "./modules/developer/pages/DeveloperTestersPage";
import DeveloperAnalyticsPage from "./modules/developer/pages/DeveloperAnalyticsPage";
import DeveloperTestResultsPage from "./modules/developer/pages/DeveloperTestResultsPage";
import DeveloperFeedbackPage from "./modules/developer/pages/DeveloperFeedbackPage";
import DeveloperFeedbackDetailsPage from "./modules/developer/pages/DeveloperFeedbackDetailsPage";
import DeveloperNotificationsPage from "./modules/developer/pages/DeveloperNotificationsPage";
import DeveloperHelpCenterPage from "./modules/developer/pages/DeveloperHelpCenterPage";
import DeveloperSupportCenterPage from "./modules/developer/pages/DeveloperSupportCenterPage";
import DeveloperSupportTicketDetailsPage from "./modules/developer/pages/DeveloperSupportTicketDetailsPage";
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
import AdminDashboardPage from "./modules/admin/pages/AdminDashboardPage";
import AdminDevelopersPage from "./modules/admin/pages/AdminDevelopersPage";
import AdminTestsPage from "./modules/admin/pages/AdminTestsPage";
import AdminCohortDetailsPage from "./modules/admin/pages/AdminCohortDetailsPage";
import AdminSettingsPage from "./modules/admin/pages/AdminSettingsPage";
import AdminAuditTrailPage from "./modules/admin/pages/AdminAuditTrailPage";
import AdminMedicalExceptionsPage from "./modules/admin/pages/AdminMedicalExceptionsPage";
import AdminSupportCenterPage from "./modules/admin/pages/AdminSupportCenterPage";
import AdminUserManagementPage from "./modules/admin/pages/AdminUserManagementPage";
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

        <Route element={<AuthGuard />}>
          <Route element={<OnboardingGuard />}>
            <Route path="/onboarding" element={<OnboardingPage />} />
            <Route path="/interests" element={<InterestsPage />} />
            <Route path="/complete-profile" element={<ProfileCompletionPage />} />

            <Route path="/assignments/:id" element={<AssignmentDetailsPage />} />
            <Route path="/assignments/:id/progress" element={<ActiveAssignmentProgressPage />} />
            <Route path="/assignments/:id/submit" element={<AssignmentSubmissionPage />} />
            <Route path="/assignments/:id/summary" element={<TestCompletionSummaryPage />} />

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
            <Route element={<RoleGuard requiredRole="admin" />}>
              <Route path="/admin" element={<AdminDashboardPage />} />
              <Route path="/admin/medical-exceptions" element={<AdminMedicalExceptionsPage />} />
              <Route path="/admin/support" element={<AdminSupportCenterPage />} />
              <Route path="/admin/users" element={<AdminUserManagementPage />} />
              <Route path="/admin/developers" element={<AdminDevelopersPage />} />
              <Route path="/admin/tests" element={<AdminTestsPage />} />
              <Route path="/admin/cohorts" element={<AdminCohortDetailsPage />} />
              <Route path="/admin/settings" element={<AdminSettingsPage />} />
              <Route path="/admin/audit-trail" element={<AdminAuditTrailPage />} />
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
              <Route path="/developer/tests" element={<DeveloperMyTestsPage />} />
              <Route path="/developer/tests/:id" element={<DeveloperTestCampaignDetailsPage />} />
              <Route path="/developer/tests/:id/monitoring" element={<DeveloperTestMonitoringPage />} />
              <Route path="/developer/tests/new" element={<DeveloperCreateTestPage />} />
              <Route path="/developer/settings" element={<DeveloperSettingsPage />} />
              <Route path="/developer/subscription" element={<DeveloperSubscriptionPage />} />
              <Route path="/developer/testers" element={<DeveloperTestersPage />} />
              <Route path="/developer/analytics" element={<DeveloperAnalyticsPage />} />
              <Route path="/developer/results" element={<DeveloperTestResultsPage />} />
              <Route path="/developer/feedback" element={<DeveloperFeedbackPage />} />
              <Route path="/developer/feedback/:id" element={<DeveloperFeedbackDetailsPage />} />
              <Route path="/developer/notifications" element={<DeveloperNotificationsPage />} />
              <Route path="/developer/help" element={<DeveloperHelpCenterPage />} />
              <Route path="/developer/support" element={<DeveloperSupportCenterPage />} />
              <Route path="/developer/support/:id" element={<DeveloperSupportTicketDetailsPage />} />
              <Route path="/apps" element={<AppsPage />} />
              <Route path="/apps/:id" element={<AppDetailPage />} />
            </Route>
          </Route>
        </Route>

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </IdentityProvider>
  );
}
