import { Route } from "react-router-dom";
import AuthPage from "./pages/AuthPage";
import SignupSuccessPage from "./pages/SignupSuccessPage";
import ForgotPasswordPage from "./pages/ForgotPasswordPage";
import ResetPasswordPage from "./pages/ResetPasswordPage";
import PasswordResetSuccessPage from "./pages/PasswordResetSuccessPage";
import InvalidOtpPage from "./pages/InvalidOtpPage";
import LandingPage from "./pages/LandingPage";
import LegalPage from "./pages/LegalPage";
import VerifyEmailPage from "./pages/VerifyEmailPage";
import AuthCallbackPage from "./pages/AuthCallbackPage";

// Public and authentication-entry routes. Keep their declaration order stable.
export const publicRouteElements = [
        <Route key="public-1" path="/" element={<LandingPage />} />,
        <Route key="public-2" path="/terms" element={<LegalPage kind="terms" />} />,
        <Route key="public-3" path="/privacy" element={<LegalPage kind="privacy" />} />,
        <Route key="public-4" path="/auth" element={<AuthPage />} />,
        <Route key="public-5" path="/signup-success" element={<SignupSuccessPage />} />,
        <Route key="public-6" path="/auth/callback" element={<AuthCallbackPage />} />,
        <Route key="public-7" path="/verify-email" element={<VerifyEmailPage />} />,
        <Route key="public-8" path="/forgot-password" element={<ForgotPasswordPage />} />,
        <Route key="public-9" path="/reset-password" element={<ResetPasswordPage />} />,
        <Route key="public-10" path="/password-reset-success" element={<PasswordResetSuccessPage />} />,
        <Route key="public-11" path="/invalid-otp" element={<InvalidOtpPage />} />,
];
