import { Route } from "react-router-dom";
import AppsPage from "../modules/developer/pages/DeveloperAppsPage";
import AppDetailPage from "../modules/developer/pages/DeveloperAppDetailPage";
import DeveloperDashboardPage from "../modules/developer/pages/DeveloperDashboardPage";
import DeveloperMyTestsPage from "../modules/developer/pages/DeveloperMyTestsPage";
import DeveloperTestCampaignDetailsPage from "../modules/developer/pages/DeveloperTestCampaignDetailsPage";
import DeveloperCreateTestPage from "../modules/developer/pages/DeveloperCreateTestPage";
import DeveloperSettingsPage from "../modules/developer/pages/DeveloperSettingsPage";
import DeveloperTestMonitoringPage from "../modules/developer/pages/DeveloperTestMonitoringPage";
import DeveloperSubscriptionPage from "../modules/developer/pages/DeveloperSubscriptionPage";
import DeveloperTestersPage from "../modules/developer/pages/DeveloperTestersPage";
import DeveloperAnalyticsPage from "../modules/developer/pages/DeveloperAnalyticsPage";
import DeveloperTestResultsPage from "../modules/developer/pages/DeveloperTestResultsPage";
import DeveloperFeedbackPage from "../modules/developer/pages/DeveloperFeedbackPage";
import DeveloperFeedbackDetailsPage from "../modules/developer/pages/DeveloperFeedbackDetailsPage";
import DeveloperNotificationsPage from "../modules/developer/pages/DeveloperNotificationsPage";
import DeveloperHelpCenterPage from "../modules/developer/pages/DeveloperHelpCenterPage";
import DeveloperSupportCenterPage from "../modules/developer/pages/DeveloperSupportCenterPage";
import DeveloperSupportTicketDetailsPage from "../modules/developer/pages/DeveloperSupportTicketDetailsPage";

// Developer workspace routes. The parent RoleGuard remains in AppRoutes.
export const developerRouteElements = [
<Route key="developer-1" path="/developer-dashboard" element={<DeveloperDashboardPage />} />,
<Route key="developer-2" path="/developer/tests" element={<DeveloperMyTestsPage />} />,
<Route key="developer-3" path="/developer/tests/:id" element={<DeveloperTestCampaignDetailsPage />} />,
<Route key="developer-4" path="/developer/tests/:id/monitoring" element={<DeveloperTestMonitoringPage />} />,
<Route key="developer-5" path="/developer/tests/new" element={<DeveloperCreateTestPage />} />,
<Route key="developer-6" path="/developer/settings" element={<DeveloperSettingsPage />} />,
<Route key="developer-7" path="/developer/subscription" element={<DeveloperSubscriptionPage />} />,
<Route key="developer-8" path="/developer/testers" element={<DeveloperTestersPage />} />,
<Route key="developer-9" path="/developer/analytics" element={<DeveloperAnalyticsPage />} />,
<Route key="developer-10" path="/developer/results" element={<DeveloperTestResultsPage />} />,
<Route key="developer-11" path="/developer/feedback" element={<DeveloperFeedbackPage />} />,
<Route key="developer-12" path="/developer/feedback/:id" element={<DeveloperFeedbackDetailsPage />} />,
<Route key="developer-13" path="/developer/notifications" element={<DeveloperNotificationsPage />} />,
<Route key="developer-14" path="/developer/help" element={<DeveloperHelpCenterPage />} />,
<Route key="developer-15" path="/developer/support" element={<DeveloperSupportCenterPage />} />,
<Route key="developer-16" path="/developer/support/:id" element={<DeveloperSupportTicketDetailsPage />} />,
<Route key="developer-17" path="/apps" element={<AppsPage />} />,
<Route key="developer-18" path="/apps/:id" element={<AppDetailPage />} />,
];
