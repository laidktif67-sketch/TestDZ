import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { getAppLimit, listApps, listDeveloperTests } from "../../../features/apps/apps-api";
import { useIdentity } from "../../../shared/auth/hooks/useIdentity";
import "../styles/developer-workspace-settings-v2.css";

type Language = "en" | "fr" | "ar";
type PlanUsage = {
  plan_code?: string | null;
  max_active_apps?: number | null;
  current_active_apps?: number | null;
  can_create?: boolean | null;
};

const copy = {
  en: {
    eyebrow: "DEVELOPER WORKSPACE", title: "Workspace settings",
    intro: "Review your workspace usage and account controls.",
    overview: "Workspace overview", apps: "Applications", tests: "Tests",
    plan: "Plan and usage", currentPlan: "Current plan", activeApps: "Active applications",
    limit: "Application limit", available: "Available slots",
    planNote: "Plan details are read-only. Billing, upgrades, subscriptions and payments are not enabled in this V2 workspace.",
    account: "Account and security", accountText: "Manage your profile, password and account security.",
    notifications: "Developer notifications", notificationsText: "Review updates for your developer workspace.",
    help: "Help center", helpText: "Find guidance about the current workflows and features.",
    open: "Open", loading: "Loading workspace settings…", unavailable: "Workspace information could not be loaded.",
    retry: "Try again", signIn: "Sign in to view workspace settings.", noLimit: "Not available",
    readOnly: "READ ONLY", billing: "Billing is not available yet."
  },
  fr: {
    eyebrow: "ESPACE DÉVELOPPEUR", title: "Paramètres de l’espace",
    intro: "Consultez l’utilisation de votre espace et les paramètres du compte.",
    overview: "Aperçu de l’espace", apps: "Applications", tests: "Tests",
    plan: "Forfait et utilisation", currentPlan: "Forfait actuel", activeApps: "Applications actives",
    limit: "Limite d’applications", available: "Places disponibles",
    planNote: "Les informations du forfait sont en lecture seule. La facturation, les abonnements, les mises à niveau et les paiements ne sont pas activés dans cet espace V2.",
    account: "Compte et sécurité", accountText: "Gérez votre profil, votre mot de passe et la sécurité du compte.",
    notifications: "Notifications développeur", notificationsText: "Consultez les mises à jour de votre espace développeur.",
    help: "Centre d’aide", helpText: "Consultez les guides des fonctions et processus disponibles.",
    open: "Ouvrir", loading: "Chargement des paramètres…", unavailable: "Impossible de charger les informations de l’espace.",
    retry: "Réessayer", signIn: "Connectez-vous pour consulter les paramètres.", noLimit: "Indisponible",
    readOnly: "LECTURE SEULE", billing: "La facturation n’est pas encore disponible."
  },
  ar: {
    eyebrow: "مساحة المطوّر", title: "إعدادات مساحة العمل",
    intro: "راجع استخدام مساحة المطوّر وإعدادات الحساب.",
    overview: "ملخص مساحة العمل", apps: "التطبيقات", tests: "الاختبارات",
    plan: "الخطة والاستخدام", currentPlan: "الخطة الحالية", activeApps: "التطبيقات النشطة",
    limit: "حد التطبيقات", available: "المقاعد المتاحة",
    planNote: "معلومات الخطة للعرض فقط. الفوترة والاشتراكات والترقية والدفع غير مفعّلة في مساحة V2.",
    account: "الحساب والأمان", accountText: "إدارة الملف الشخصي وكلمة المرور وأمان الحساب.",
    notifications: "إشعارات المطوّر", notificationsText: "راجع التحديثات الخاصة بمساحة المطوّر.",
    help: "مركز المساعدة", helpText: "اطّلع على إرشادات سير العمل والميزات المتاحة.",
    open: "فتح", loading: "جارٍ تحميل إعدادات مساحة العمل…", unavailable: "تعذر تحميل معلومات مساحة العمل.",
    retry: "إعادة المحاولة", signIn: "سجّل الدخول لعرض إعدادات مساحة العمل.", noLimit: "غير متاح",
    readOnly: "للقراءة فقط", billing: "الفوترة غير متاحة حالياً."
  }
} as const;

function readLanguage(): Language {
  const saved = window.localStorage.getItem("testdz-developer-dashboard-language");
  return saved === "ar" || saved === "fr" ? saved : "en";
}

export default function DeveloperWorkspaceSettingsPage() {
  const { user, rolesLoading } = useIdentity();
  const [language, setLanguage] = useState<Language>(readLanguage);
  const [appCount, setAppCount] = useState<number | null>(null);
  const [testCount, setTestCount] = useState<number | null>(null);
  const [limit, setLimit] = useState<PlanUsage | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const t = copy[language];
  const direction = language === "ar" ? "rtl" : "ltr";
  const available = useMemo(() => {
    if (limit?.max_active_apps == null || limit.current_active_apps == null) return null;
    return Math.max(0, limit.max_active_apps - limit.current_active_apps);
  }, [limit]);

  useEffect(() => {
    const syncLanguage = () => setLanguage(readLanguage());
    window.addEventListener("storage", syncLanguage);
    return () => window.removeEventListener("storage", syncLanguage);
  }, []);

  const load = useCallback(async () => {
    if (!user?.id) {
      setLoading(false);
      setError(true);
      return;
    }
    setLoading(true);
    setError(false);
    try {
      const [apps, tests, plan] = await Promise.all([
        listApps(user.id),
        listDeveloperTests(user.id),
        getAppLimit()
      ]);
      if (apps.error || tests.error) {
        setError(true);
        setAppCount(null);
        setTestCount(null);
      } else {
        setAppCount((apps.data ?? []).length);
        setTestCount((tests.data ?? []).length);
      }
      if (!plan.error) {
        const value = Array.isArray(plan.data) ? plan.data[0] : plan.data;
        setLimit((value ?? null) as PlanUsage | null);
      } else {
        setLimit(null);
      }
    } catch {
      setError(true);
      setAppCount(null);
      setTestCount(null);
      setLimit(null);
    } finally {
      setLoading(false);
    }
  }, [user?.id]);

  useEffect(() => {
    if (!rolesLoading) void load();
  }, [rolesLoading, load]);

  return <main className="dws2-page" dir={direction}>
    <header className="dws2-header">
      <div>
        <Link to="/developer-dashboard" className="dws2-back">← {t.overview}</Link>
        <span className="dws2-eyebrow">{t.eyebrow}</span>
        <h1>{t.title}</h1>
        <p>{t.intro}</p>
      </div>
      <Link to="/developer-dashboard" className="dws2-home">TestDZ · Developer</Link>
    </header>

    {loading || rolesLoading ? <div className="dws2-state">{t.loading}</div> : error ? <div className="dws2-state">
      <p>{user ? t.unavailable : t.signIn}</p>
      {user && <button type="button" onClick={() => void load()}>{t.retry}</button>}
    </div> : <>
      <section className="dws2-metrics" aria-label={t.overview}>
        <article><span className="dws2-icon">▦</span><div><small>{t.apps}</small><strong>{appCount ?? "—"}</strong></div></article>
        <article><span className="dws2-icon violet">⌁</span><div><small>{t.tests}</small><strong>{testCount ?? "—"}</strong></div></article>
        <article><span className="dws2-icon green">◇</span><div><small>{t.currentPlan}</small><strong className="dws2-plan">{limit?.plan_code?.toUpperCase() || t.noLimit}</strong></div></article>
      </section>

      <section className="dws2-card">
        <div className="dws2-card-heading"><div><span className="dws2-eyebrow">{t.overview}</span><h2>{t.plan}</h2></div><span className="dws2-readonly">{t.readOnly}</span></div>
        <div className="dws2-usage">
          <div><small>{t.activeApps}</small><strong>{limit?.current_active_apps ?? "—"}</strong></div>
          <div><small>{t.limit}</small><strong>{limit?.max_active_apps ?? t.noLimit}</strong></div>
          <div><small>{t.available}</small><strong>{available ?? "—"}</strong></div>
        </div>
        {limit?.max_active_apps != null && <div className="dws2-progress"><span style={{ width: Math.min(100, ((limit.current_active_apps ?? 0) / Math.max(1, limit.max_active_apps)) * 100) + "%" }} /></div>}
        <p className="dws2-note">{t.planNote}</p>
      </section>

      <section className="dws2-links">
        <Link to="/settings"><span className="dws2-link-icon">◇</span><span><strong>{t.account}</strong><small>{t.accountText}</small></span><b>←</b></Link>
        <Link to="/developer-notifications"><span className="dws2-link-icon">♧</span><span><strong>{t.notifications}</strong><small>{t.notificationsText}</small></span><b>←</b></Link>
        <Link to="/help"><span className="dws2-link-icon">?</span><span><strong>{t.help}</strong><small>{t.helpText}</small></span><b>←</b></Link>
      </section>
      <p className="dws2-footnote">{t.billing}</p>
    </>}
  </main>;
}
