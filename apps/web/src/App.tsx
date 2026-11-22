import { lazy, Suspense } from "react";
import { Navigate, Route, Routes, useLocation } from "react-router-dom";
const AppsPage = lazy(() => import("./pages/AppsPage"));
const AppDetailPage = lazy(() => import("./pages/AppDetailPage"));
const AuthPage = lazy(() => import("./pages/AuthPage"));
const SignupSuccessPage = lazy(() => import("./pages/SignupSuccessPage"));
const ForgotPasswordPage = lazy(() => import("./pages/ForgotPasswordPage"));
const ResetPasswordPage = lazy(() => import("./pages/ResetPasswordPage"));
const PasswordResetSuccessPage = lazy(() => import("./pages/PasswordResetSuccessPage"));
const InvalidOtpPage = lazy(() => import("./pages/InvalidOtpPage"));
const OnboardingPage = lazy(() => import("./pages/OnboardingPage"));
const InterestsPage = lazy(() => import("./pages/InterestsPage"));
const LandingPage = lazy(() => import("./pages/LandingPage"));
const LegalPage = lazy(() => import("./pages/LegalPage"));
const VerifyEmailPage = lazy(() => import("./pages/VerifyEmailPage"));
const AuthCallbackPage = lazy(() => import("./pages/AuthCallbackPage"));
const TesterDashboardPage = lazy(() => import("./modules/tester/pages/TesterDashboardPage"));
const MyTestsPage = lazy(() => import("./modules/tester/pages/MyTestsPage"));
const DiscoverTestsPage = lazy(() => import("./modules/tester/pages/DiscoverTestsPage"));
const TestPreviewPage = lazy(() => import("./modules/tester/pages/TestPreviewPage"));
const DeveloperDashboardPage = lazy(() => import("./modules/developer/pages/DeveloperDashboardPage"));
const DeveloperAnalyticsPage = lazy(() => import("./modules/developer/pages/DeveloperAnalyticsPage"));
const DeveloperAddAppPage = lazy(() => import("./modules/developer/pages/DeveloperAddAppPage"));
const DeveloperCreateTestSixStepPage = lazy(() => import("./modules/developer/pages/DeveloperCreateTestSixStepPage"));
const DeveloperTestMonitoringPage = lazy(() => import("./modules/developer/pages/DeveloperTestMonitoringPage"));
const DeveloperTestersPage = lazy(() => import("./modules/developer/pages/DeveloperTestersPage"));
const DeveloperTestResultsPage = lazy(() => import("./modules/developer/pages/DeveloperTestResultsPage"));
const DeveloperHelpPage = lazy(() => import("./modules/developer/pages/DeveloperHelpPage"));
const DeveloperWorkspaceSettingsPage = lazy(() => import("./modules/developer/pages/DeveloperWorkspaceSettingsPage"));
const DeveloperTestsPage = lazy(() => import("./modules/developer/pages/DeveloperTestsPage"));
const DeveloperFeedbackPage = lazy(() => import("./modules/developer/pages/DeveloperFeedbackPage"));
const DeveloperNotificationsPage = lazy(() => import("./modules/developer/pages/DeveloperNotificationsPage"));
const DeveloperReviewQueuePage = lazy(() => import("./modules/developer/pages/DeveloperReviewQueuePage"));
const TesterProfilePage = lazy(() => import("./modules/tester/pages/TesterProfilePage"));
const SettingsSecurityPage = lazy(() => import("./modules/tester/pages/SettingsSecurityPage"));
const NotificationPreferencesPage = lazy(() => import("./modules/tester/pages/NotificationPreferencesPage"));
const LanguageAppearancePage = lazy(() => import("./modules/tester/pages/LanguageAppearancePage"));
const PrivacyDataManagementPage = lazy(() => import("./modules/tester/pages/PrivacyDataManagementPage"));
const ActiveSessionsPage = lazy(() => import("./modules/tester/pages/ActiveSessionsPage"));
const LoginActivitySecurityPage = lazy(() => import("./modules/tester/pages/LoginActivitySecurityPage"));
const NotificationsCenterPage = lazy(() => import("./modules/tester/pages/NotificationsCenterPage"));
const AssignmentSubmissionPage = lazy(() => import("./modules/tester/pages/AssignmentSubmissionPage"));
const AssignmentDetailsPage = lazy(() => import("./modules/tester/pages/AssignmentDetailsPage"));
const ActiveAssignmentProgressPage = lazy(() => import("./modules/tester/pages/ActiveAssignmentProgressPage"));
const TestCompletionSummaryPage = lazy(() => import("./modules/tester/pages/TestCompletionSummaryPage"));
const TestCompletionRewardPage = lazy(() => import("./modules/tester/pages/TestCompletionRewardPage"));
const TesterLeaderboardPage = lazy(() => import("./modules/tester/pages/TesterLeaderboardPage"));
const AdminDashboardPage = lazy(() => import("./modules/admin/pages/AdminDashboardPage"));
const AdminRoleRequestsPage = lazy(() => import("./modules/admin/pages/AdminRoleRequestsPage"));
const AdminUsersPage = lazy(() => import("./modules/admin/pages/AdminUsersPage"));
const AdminAuditLogPage = lazy(() => import("./modules/admin/pages/AdminAuditLogPage"));
const AdminFraudReviewsPage = lazy(() => import("./modules/admin/pages/AdminFraudReviewsPage"));
const CaseQueuesPage = lazy(() => import("./modules/admin/pages/CaseQueuesPage"));
const FinancialOperationsPage = lazy(() => import("./modules/admin/pages/FinancialOperationsPage"));
const SupportQueuePage = lazy(() => import("./modules/support/pages/SupportQueuePage"));
const SupportTicketDetailPage = lazy(() => import("./modules/support/pages/SupportTicketDetailPage"));
const WalletRewardsPage = lazy(() => import("./modules/tester/pages/WalletRewardsPage"));
const WithdrawalRequestPage = lazy(() => import("./modules/tester/pages/WithdrawalRequestPage"));
const WithdrawalStatusPage = lazy(() => import("./modules/tester/pages/WithdrawalStatusPage"));
const SubmitFeedbackPage = lazy(() => import("./modules/tester/pages/SubmitFeedbackPage"));
const ReportProblemPage = lazy(() => import("./modules/tester/pages/ReportProblemPage"));
const FeedbackHistoryPage = lazy(() => import("./modules/tester/pages/FeedbackHistoryPage"));
const CheckInHistoryPage = lazy(() => import("./modules/tester/pages/CheckInHistoryPage"));
const ActivityHistoryPage = lazy(() => import("./modules/tester/pages/ActivityHistoryPage"));
const ReferralProgramPage = lazy(() => import("./modules/tester/pages/ReferralProgramPage"));
const ReferralHistoryPage = lazy(() => import("./modules/tester/pages/ReferralHistoryPage"));
const HelpSupportPage = lazy(() => import("./modules/tester/pages/HelpSupportPage"));
const SupportCenterPage = lazy(() => import("./modules/tester/pages/SupportCenterPage"));
const SupportTicketDetailsPage = lazy(() => import("./modules/tester/pages/SupportTicketDetailsPage"));
const LiveChatPage = lazy(() => import("./modules/tester/pages/LiveChatPage"));
const ProfileCompletionPage = lazy(() => import("./pages/ProfileCompletionPage"));
const IdentityProvider = lazy(() => import("./shared/auth/identity-provider").then(({ IdentityProvider: Component }) => ({ default: Component })));
const AuthGuard = lazy(() => import("./shared/guards/AuthGuard"));
const OnboardingGuard = lazy(() => import("./shared/guards/OnboardingGuard"));
const RoleGuard = lazy(() => import("./shared/guards/RoleGuard").then(({ default: Component }) => ({ default: Component })));
const RoleHomeRedirect = lazy(() => import("./shared/guards/RoleGuard").then(({ RoleHomeRedirect: Component }) => ({ default: Component })));

export default function App() {
  const location = useLocation();
  const routes = (
    <Suspense fallback={<div role="status" className="route-loading" aria-live="polite">Loading TestDZ…</div>}>
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
            <Route path="/financial-operations/disputes" element={<CaseQueuesPage view="disputes" />} />
          </Route>
          <Route element={<RoleGuard requiredRole="support" />}>
            <Route path="/support-workspace" element={<SupportQueuePage />} />
            <Route path="/support-workspace/reports" element={<CaseQueuesPage view="reports" />} />
            <Route path="/support-workspace/:id" element={<SupportTicketDetailPage />} />
          </Route>
          <Route element={<RoleGuard requiredRole="admin" />}>
            <Route path="/admin" element={<AdminDashboardPage />} />
            <Route path="/admin/role-requests" element={<AdminRoleRequestsPage />} />
            <Route path="/admin/users" element={<AdminUsersPage />} />
            <Route path="/admin/audit-log" element={<AdminAuditLogPage />} />
            <Route path="/admin/fraud-reviews" element={<AdminFraudReviewsPage />} />
            <Route path="/admin/cases" element={<CaseQueuesPage view="all" />} />
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
            <Route path="/developer-notifications" element={<DeveloperNotificationsPage />} />
            <Route path="/developer-tests" element={<DeveloperTestsPage />} />
            <Route path="/developer/tests/new" element={<DeveloperCreateTestSixStepPage />} />
            <Route path="/developer/tests/:id/monitoring" element={<DeveloperTestMonitoringPage />} />
            <Route path="/developer/testers" element={<DeveloperTestersPage />} />
            <Route path="/developer-test-results" element={<DeveloperTestResultsPage />} />
            <Route path="/developer-analytics" element={<DeveloperAnalyticsPage />} />
            <Route path="/developer-help" element={<DeveloperHelpPage />} />
            <Route path="/developer-support" element={<SupportCenterPage workspaceRole="developer" />} />
            <Route path="/developer-settings" element={<DeveloperWorkspaceSettingsPage />} />
            <Route path="/developer-feedback" element={<DeveloperFeedbackPage />} />
            <Route path="/apps" element={<AppsPage />} />
            <Route path="/apps/new" element={<DeveloperAddAppPage />} />
            <Route path="/apps/:id" element={<AppDetailPage />} />
          </Route>
        </Route>

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Suspense>
  );

  // The public landing page does not consume identity state. Keep the auth client
  // and session provider out of its initial dependency graph.
  if (location.pathname === "/") return routes;

  return (
    <Suspense fallback={<div role="status" className="route-loading" aria-live="polite">Loading account…</div>}>
      <IdentityProvider>{routes}</IdentityProvider>
    </Suspense>
  );
}
