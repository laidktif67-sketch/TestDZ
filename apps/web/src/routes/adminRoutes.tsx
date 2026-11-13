import { Route } from "react-router-dom";
import AdminDashboardPage from "../modules/admin/pages/AdminDashboardPage";
import AdminAnalyticsPage from "../modules/admin/pages/AdminAnalyticsPage";
import AdminLeaderboardPage from "../modules/admin/pages/AdminLeaderboardPage";
import AdminAppsManagementPage from "../modules/admin/pages/AdminAppsManagementPage";
import AdminReportsReviewsPage from "../modules/admin/pages/AdminReportsReviewsPage";
import AdminNotificationsPage from "../modules/admin/pages/AdminNotificationsPage";
import AdminSystemMonitoringPage from "../modules/admin/pages/AdminSystemMonitoringPage";
import AdminSystemLogsPage from "../modules/admin/pages/AdminSystemLogsPage";
import AdminFinancialPage from "../modules/admin/pages/AdminFinancialPage";
import AdminTesterWithdrawalsPage from "../modules/admin/pages/AdminTesterWithdrawalsPage";
import AdminWithdrawalDetailsPage from "../modules/admin/pages/AdminWithdrawalDetailsPage";
import AdminWithdrawalFailedPage from "../modules/admin/pages/AdminWithdrawalFailedPage";
import AdminRewardsPage from "../modules/admin/pages/AdminRewardsPage";
import AdminTransactionsLedgerPage from "../modules/admin/pages/AdminTransactionsLedgerPage";
import AdminDeveloperPaymentsPage from "../modules/admin/pages/AdminDeveloperPaymentsPage";
import AdminDeveloperPaymentDetailsPage from "../modules/admin/pages/AdminDeveloperPaymentDetailsPage";
import AdminInvoiceDetailsPage from "../modules/admin/pages/AdminInvoiceDetailsPage";
import AdminDevelopersPage from "../modules/admin/pages/AdminDevelopersPage";
import AdminDeveloperDetailsPage from "../modules/admin/pages/AdminDeveloperDetailsPage";
import AdminTestersPage from "../modules/admin/pages/AdminTestersPage";
import AdminTesterDetailsPage from "../modules/admin/pages/AdminTesterDetailsPage";
import AdminTestsPage from "../modules/admin/pages/AdminTestsPage";
import AdminAssignmentsPage from "../modules/admin/pages/AdminAssignmentsPage";
import AdminCohortDetailsPage from "../modules/admin/pages/AdminCohortDetailsPage";
import AdminSettingsPage from "../modules/admin/pages/AdminSettingsPage";
import AdminAuditTrailPage from "../modules/admin/pages/AdminAuditTrailPage";
import AdminMedicalExceptionsPage from "../modules/admin/pages/AdminMedicalExceptionsPage";
import AdminSupportCenterPage from "../modules/admin/pages/AdminSupportCenterPage";
import AdminUserManagementPage from "../modules/admin/pages/AdminUserManagementPage";

// Admin-only routes. The parent RoleGuard remains in AppRoutes.
export const adminRouteElements = [
<Route key="admin-1" path="/admin" element={<AdminDashboardPage />} />,
<Route key="admin-2" path="/admin/analytics" element={<AdminAnalyticsPage />} />,
<Route key="admin-3" path="/admin/leaderboard" element={<AdminLeaderboardPage />} />,
<Route key="admin-4" path="/admin/apps" element={<AdminAppsManagementPage />} />,
<Route key="admin-5" path="/admin/reports" element={<AdminReportsReviewsPage />} />,
<Route key="admin-6" path="/admin/notifications" element={<AdminNotificationsPage />} />,
<Route key="admin-7" path="/admin/monitoring" element={<AdminSystemMonitoringPage />} />,
<Route key="admin-8" path="/admin/logs" element={<AdminSystemLogsPage />} />,
<Route key="admin-9" path="/admin/financial" element={<AdminFinancialPage />} />,
<Route key="admin-10" path="/admin/tester-withdrawals" element={<AdminTesterWithdrawalsPage />} />,
<Route key="admin-11" path="/admin/tester-withdrawals/:id" element={<AdminWithdrawalDetailsPage />} />,
<Route key="admin-12" path="/admin/withdrawal-failed/:id" element={<AdminWithdrawalFailedPage />} />,
<Route key="admin-13" path="/admin/rewards" element={<AdminRewardsPage />} />,
<Route key="admin-14" path="/admin/transactions-ledger" element={<AdminTransactionsLedgerPage />} />,
<Route key="admin-15" path="/admin/developer-payments" element={<AdminDeveloperPaymentsPage />} />,
<Route key="admin-16" path="/admin/developer-payments/:id" element={<AdminDeveloperPaymentDetailsPage />} />,
<Route key="admin-17" path="/admin/invoices/:invoiceId" element={<AdminInvoiceDetailsPage />} />,
<Route key="admin-18" path="/admin/medical-exceptions" element={<AdminMedicalExceptionsPage />} />,
<Route key="admin-19" path="/admin/support" element={<AdminSupportCenterPage />} />,
<Route key="admin-20" path="/admin/users" element={<AdminUserManagementPage />} />,
<Route key="admin-21" path="/admin/developers" element={<AdminDevelopersPage />} />,
<Route key="admin-22" path="/admin/developers/:id" element={<AdminDeveloperDetailsPage />} />,
<Route key="admin-23" path="/admin/testers" element={<AdminTestersPage />} />,
<Route key="admin-24" path="/admin/testers/:id" element={<AdminTesterDetailsPage />} />,
<Route key="admin-25" path="/admin/tests" element={<AdminTestsPage />} />,
<Route key="admin-26" path="/admin/assignments" element={<AdminAssignmentsPage />} />,
<Route key="admin-27" path="/admin/cohorts" element={<AdminCohortDetailsPage />} />,
<Route key="admin-28" path="/admin/settings" element={<AdminSettingsPage />} />,
<Route key="admin-29" path="/admin/audit-trail" element={<AdminAuditTrailPage />} />,
];
