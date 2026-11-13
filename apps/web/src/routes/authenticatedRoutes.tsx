import { Navigate, Route } from "react-router-dom";
import OnboardingPage from "./pages/OnboardingPage";
import InterestsPage from "./pages/InterestsPage";
import TesterProfilePage from "./modules/tester/pages/TesterProfilePage";
import SettingsSecurityPage from "./modules/tester/pages/SettingsSecurityPage";
import NotificationPreferencesPage from "./modules/tester/pages/NotificationPreferencesPage";
import ActiveSessionsPage from "./modules/tester/pages/ActiveSessionsPage";
import NotificationsCenterPage from "./modules/tester/pages/NotificationsCenterPage";
import AssignmentSubmissionPage from "./modules/tester/pages/AssignmentSubmissionPage";
import AssignmentDetailsPage from "./modules/tester/pages/AssignmentDetailsPage";
import ActiveAssignmentProgressPage from "./modules/tester/pages/ActiveAssignmentProgressPage";
import TestCompletionSummaryPage from "./modules/tester/pages/TestCompletionSummaryPage";
import WalletRewardsPage from "./modules/tester/pages/WalletRewardsPage";
import WithdrawalRequestPage from "./modules/tester/pages/WithdrawalRequestPage";
import WithdrawalStatusPage from "./modules/tester/pages/WithdrawalStatusPage";
import SubmitFeedbackPage from "./modules/tester/pages/SubmitFeedbackPage";
import ReportProblemPage from "./modules/tester/pages/ReportProblemPage";
import FeedbackHistoryPage from "./modules/tester/pages/FeedbackHistoryPage";
import HelpSupportPage from "./modules/tester/pages/HelpSupportPage";
import SupportCenterPage from "./modules/tester/pages/SupportCenterPage";
import SupportTicketDetailsPage from "./modules/tester/pages/SupportTicketDetailsPage";
import LiveChatPage from "./modules/tester/pages/LiveChatPage";
import ProfileCompletionPage from "./pages/ProfileCompletionPage";
import RoleGuard from "../shared/guards/RoleGuard";

// Shared authenticated routes; AuthGuard and OnboardingGuard remain in AppRoutes.
export const authenticatedRouteElements = (
  <>

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
              {testerSecurityRouteElements}
            </Route>
            <Route path="/notifications" element={<NotificationsCenterPage />} />
            
  </>
);
