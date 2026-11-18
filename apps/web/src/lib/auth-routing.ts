import { profilesApi } from "../features/profiles/profiles-api";

export function translateAuthError(message: string) {
  const value = message.toLowerCase();
  if (value.includes("already registered") || value.includes("already been registered")) return "هذا البريد مسجل بالفعل. جرّب تسجيل الدخول.";
  if (value.includes("invalid login credentials")) return "البريد الإلكتروني أو كلمة المرور غير صحيحة.";
  if (value.includes("email not confirmed")) return "يجب تأكيد بريدك الإلكتروني قبل تسجيل الدخول.";
  if (value.includes("password") && value.includes("least")) return "كلمة المرور لا تستوفي الحد الأدنى المطلوب.";
  if (value.includes("too many requests") || value.includes("rate limit")) return "محاولات كثيرة خلال وقت قصير. انتظر قليلاً ثم أعد المحاولة.";
  return "تعذر إكمال العملية. تحقق من البيانات وحاول مرة أخرى.";
}

export async function getPostAuthRoute(userId: string): Promise<"/tester-dashboard" | "/onboarding"> {
  const { data: profile, error } = await profilesApi.getOnboardingStatus(userId);
  if (error) throw error;
  return profile?.onboarding_completed_at ? "/tester-dashboard" : "/onboarding";
}

/** Allow only same-app tester test-preview destinations after authentication. */
export function getSafeAuthRedirect(value: string | null | undefined): string | null {
  if (!value || !/^\/tests\/[A-Za-z0-9-]+$/.test(value)) return null;
  return value;
}
