import { Route } from "react-router-dom";
import TesterDashboardPage from "../modules/tester/pages/TesterDashboardPage";
import AssignmentDetailsPage from "../modules/tester/pages/AssignmentDetailsPage";
import ActiveAssignmentProgressPage from "../modules/tester/pages/ActiveAssignmentProgressPage";
import AssignmentSubmissionPage from "../modules/tester/pages/AssignmentSubmissionPage";
import TestCompletionSummaryPage from "../modules/tester/pages/TestCompletionSummaryPage";
import FeedbackHistoryPage from "../modules/tester/pages/FeedbackHistoryPage";
import SubmitFeedbackPage from "../modules/tester/pages/SubmitFeedbackPage";
import ReportProblemPage from "../modules/tester/pages/ReportProblemPage";
import WalletRewardsPage from "../modules/tester/pages/WalletRewardsPage";
import WithdrawalRequestPage from "../modules/tester/pages/WithdrawalRequestPage";
import WithdrawalStatusPage from "../modules/tester/pages/WithdrawalStatusPage";
import MyTestsPage from "../modules/tester/pages/MyTestsPage";
import DiscoverTestsPage from "../modules/tester/pages/DiscoverTestsPage";
import TestPreviewPage from "../modules/tester/pages/TestPreviewPage";
import LanguageAppearancePage from "../modules/tester/pages/LanguageAppearancePage";
import PrivacyDataManagementPage from "../modules/tester/pages/PrivacyDataManagementPage";
import LoginActivitySecurityPage from "../modules/tester/pages/LoginActivitySecurityPage";
import TestCompletionRewardPage from "../modules/tester/pages/TestCompletionRewardPage";
import TesterLeaderboardPage from "../modules/tester/pages/TesterLeaderboardPage";
import CheckInHistoryPage from "../modules/tester/pages/CheckInHistoryPage";
import ActivityHistoryPage from "../modules/tester/pages/ActivityHistoryPage";
import ReferralProgramPage from "../modules/tester/pages/ReferralProgramPage";
import ReferralHistoryPage from "../modules/tester/pages/ReferralHistoryPage";

// Tester role-protected routes; parent guards stay in AppRoutes.
export const testerSecurityRouteElements = [
<Route key="tester-security-1" path="/tester/security-history" element={<LoginActivitySecurityPage />} />,
];

export const testerWorkspaceRouteElements = [
<Route key="tester-workspace-moved-1" path="/assignments/:id" element={<AssignmentDetailsPage />} />,
<Route key="tester-workspace-moved-2" path="/assignments/:id/progress" element={<ActiveAssignmentProgressPage />} />,
<Route key="tester-workspace-moved-3" path="/assignments/:id/submit" element={<AssignmentSubmissionPage />} />,
<Route key="tester-workspace-moved-4" path="/assignments/:id/summary" element={<TestCompletionSummaryPage />} />,
<Route key="tester-workspace-moved-5" path="/feedback-history" element={<FeedbackHistoryPage />} />,
<Route key="tester-workspace-moved-6" path="/submit-feedback" element={<SubmitFeedbackPage />} />,
<Route key="tester-workspace-moved-7" path="/report-problem" element={<ReportProblemPage />} />,
<Route key="tester-workspace-moved-8" path="/wallet-rewards" element={<WalletRewardsPage />} />,
<Route key="tester-workspace-moved-9" path="/withdrawal-request" element={<WithdrawalRequestPage />} />,
<Route key="tester-workspace-moved-10" path="/withdrawal-status" element={<WithdrawalStatusPage />} />,
<Route key="tester-workspace-1" path="/tester-dashboard" element={<TesterDashboardPage />} />,
<Route key="tester-workspace-2" path="/my-tests" element={<MyTestsPage />} />,
<Route key="tester-workspace-3" path="/assignments/:id/reward" element={<TestCompletionRewardPage />} />,
<Route key="tester-workspace-4" path="/leaderboard" element={<TesterLeaderboardPage />} />,
<Route key="tester-workspace-5" path="/tester/language-appearance" element={<LanguageAppearancePage />} />,
<Route key="tester-workspace-6" path="/tester/privacy" element={<PrivacyDataManagementPage />} />,
<Route key="tester-workspace-7" path="/check-in-history" element={<CheckInHistoryPage />} />,
<Route key="tester-workspace-8" path="/activity-history" element={<ActivityHistoryPage />} />,
<Route key="tester-workspace-9" path="/referral-program" element={<ReferralProgramPage />} />,
<Route key="tester-workspace-10" path="/referral-history" element={<ReferralHistoryPage />} />,
<Route key="tester-workspace-11" path="/discover-tests" element={<DiscoverTestsPage />} />,
<Route key="tester-workspace-12" path="/tests/:id" element={<TestPreviewPage />} />,
];
