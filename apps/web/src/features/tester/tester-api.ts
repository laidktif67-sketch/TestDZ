/**
 * Backwards-compatible barrel for tester feature APIs.
 * New page code should import from the focused domain modules directly.
 */
export { getTesterDashboardData, getDiscoverTestsPageData, getMyTestsPageData, getTesterLeaderboardPageData } from "./dashboard-api";
export { getActivityHistoryPageData, getCheckInHistoryPageData, getFeedbackHistoryPageData } from "./activity-api";
export { getAssignmentSubmissionPageData, getActiveAssignmentProgressPageData, startTesterAssignment, submitTesterDailyCheckin, getTesterAssignmentSubmission, createTesterAssignmentSubmission, getTesterSubmissionAttachments, registerTesterSubmissionAttachment, finalizeTesterAssignmentSubmission } from "./assignments-api";
export { getNotificationsCenterPageData, markTesterNotificationRead, markAllTesterNotificationsRead } from "../notifications/notifications-api";
export { getTesterSupportTickets, createTesterSupportTicket, getTesterSupportTicketDetails, sendTesterSupportMessage, addTesterSupportAttachment } from "../support/support-api";
export { getWalletRewardsPageData } from "../wallet/wallet-api";
