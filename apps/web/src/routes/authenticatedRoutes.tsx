import { Navigate, Route } from "react-router-dom";
import OnboardingPage from "../pages/OnboardingPage";
import InterestsPage from "../pages/InterestsPage";
import TesterProfilePage from "../modules/tester/pages/TesterProfilePage";
import HelpSupportPage from "../modules/tester/pages/HelpSupportPage";
import SupportCenterPage from "../modules/tester/pages/SupportCenterPage";
import SupportTicketDetailsPage from "../modules/tester/pages/SupportTicketDetailsPage";
import LiveChatPage from "../modules/tester/pages/LiveChatPage";
import ProfileCompletionPage from "../pages/ProfileCompletionPage";
import RoleGuard from "../shared/guards/RoleGuard";
import { testerSecurityRouteElements } from "./testerRoutes";

// Shared authenticated routes; AuthGuard and OnboardingGuard remain in AppRoutes.
export const authenticatedRouteElements = (
  <>

            <Route path="/onboarding" element={<OnboardingPage />} />
            <Route path="/interests" element={<InterestsPage />} />
            <Route path="/complete-profile" element={<ProfileCompletionPage />} />


            <Route path="/profile" element={<TesterProfilePage />} />
            <Route path="/help" element={<HelpSupportPage />} />
            <Route path="/support" element={<SupportCenterPage />} />
            <Route path="/support/:id" element={<SupportTicketDetailsPage />} />
            <Route path="/live-chat" element={<LiveChatPage />} />
            <Route path="/help-support" element={<Navigate to="/help" replace />} />
            <Route element={<RoleGuard requiredRole="tester" />}>
              {testerSecurityRouteElements}
            </Route>
            
  </>
);
