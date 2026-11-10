export const APP_CATEGORIES = [
  { value: "games", label: "ألعاب" },
  { value: "tools", label: "أدوات" },
  { value: "education", label: "تعليم" },
  { value: "social", label: "اجتماعي" },
  { value: "health", label: "صحة" },
  { value: "other", label: "أخرى" },
] as const;

export function appError(message: string) {
  if (message.includes("PLAN_LIMIT_REACHED")) return "وصلت إلى الحد الأقصى لتطبيقات خطتك. يمكنك أرشفة تطبيق أو ترقية خطتك.";
  if (message.includes("apps_package_name_global_unique") || message.includes("duplicate key")) return "اسم الحزمة مستخدم بالفعل في المنصة.";
  if (message.includes("DEVELOPER_ROLE_REQUIRED")) return "يلزم تفعيل دور المطوّر قبل إضافة تطبيق.";
  if (message.includes("PACKAGE_NAME_INVALID")) return "اسم الحزمة غير صالح. مثال: dz.testdz.myapp";
  return "تعذّر تنفيذ العملية. تحقق من البيانات وحاول مجدداً.";
}
