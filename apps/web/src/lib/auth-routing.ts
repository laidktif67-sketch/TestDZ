import { profilesApi } from "../features/profiles/profiles-api";
import { identityApi } from "../features/identity/identity-api";

export function translateAuthError(message: string) {
  const value = message.toLowerCase();
  if (value.includes("already registered") || value.includes("already been registered")) return "هذا البريد مسجل بالفعل. جرّب تسجيل الدخول.";
  if (value.includes("invalid login credentials")) return "البريد الإلكتروني أو كلمة المرور غير صحيحة.";
  if (value.includes("email not confirmed")) return "يجب تأكيد بريدك الإلكتروني قبل تسجيل الدخول.";
  if (value.includes("password") && value.includes("least")) return "كلمة المرور لا تستوفي الحد الأدنى المطلوب.";
  if (value.includes("too many requests") || value.includes("rate limit")) return "محاولات كثيرة خلال وقت قصير. انتظر قليلاً ثم أعد المحاولة.";
  return "تعذر إكمال العملية. تحقق من البيانات وحاول مرة أخرى.";
}

export async function getPostAuthRoute(userId: string): Promise<"/admin" | "/tester-dashboard" | "/developer-dashboard" | "/onboarding"> {
  // Resolve server-assigned roles first so administrators are sent to their workspace.
  const roles = await identityApi.getUserRoles(userId);
  if (roles.includes("admin")) return "/admin";

  const { data: profile, error } = await profilesApi.getOnboardingStatus(userId);
  if (error) throw error;
  if (!profile?.onboarding_completed_at) return "/onboarding";

  if (roles.includes("tester")) return "/tester-dashboard";
  if (roles.includes("developer")) return "/developer-dashboard";
  return "/tester-dashboard";
}
