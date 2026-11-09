import { supabase } from "./supabase";

export function translateAuthError(message: string) {
  const value = message.toLowerCase();
  if (value.includes("already registered") || value.includes("already been registered")) return "هذا البريد مسجل بالفعل. جرّب تسجيل الدخول.";
  if (value.includes("invalid login credentials")) return "البريد الإلكتروني أو كلمة المرور غير صحيحة.";
  if (value.includes("email not confirmed")) return "يجب تأكيد بريدك الإلكتروني قبل تسجيل الدخول.";
  if (value.includes("password") && value.includes("least")) return "كلمة المرور لا تستوفي الحد الأدنى المطلوب.";
  if (value.includes("too many requests") || value.includes("rate limit")) return "محاولات كثيرة خلال وقت قصير. انتظر قليلاً ثم أعد المحاولة.";
  return "تعذر إكمال العملية. تحقق من البيانات وحاول مرة أخرى.";
}

export async function getPostAuthRoute(userId: string): Promise<"/dashboard" | "/onboarding"> {
  if (!supabase) throw new Error("SUPABASE_NOT_CONFIGURED");
  const { data: profile, error } = await supabase
    .from("profiles")
    .select("onboarding_completed_at")
    .eq("id", userId)
    .maybeSingle();
  if (error) throw error;
  return profile?.onboarding_completed_at ? "/dashboard" : "/onboarding";
}
