import { useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import { supabase } from "../../../lib/supabase";
import { getAppLimit, listApps, listDeveloperTests } from "../../../features/apps/apps-api";
import { useIdentity } from "../../../shared/auth/hooks/useIdentity";
import "../styles/developer-workspace-settings.css";

type Language = "en" | "fr" | "ar";
type PlanUsage = { plan_code?: string | null; max_active_apps?: number | null; current_active_apps?: number | null; can_create?: boolean | null };

const copy = {
  en: {
    eyebrow:"DEVELOPER WORKSPACE", title:"Workspace settings", intro:"Review your developer workspace, plan usage and account controls.",
    overview:"Workspace overview", apps:"Applications", tests:"Tests", plan:"Plan & usage", currentPlan:"Current plan", activeApps:"Active applications", limit:"Application limit", available:"Available slots", planNote:"Plan information is read-only here. Billing, upgrades and payments are not enabled in this V2 workspace.",
    preferences:"Workspace controls", language:"Dashboard language", languageNote:"The dashboard language is stored in this browser. Account language is managed separately in account settings.",
    account:"Account & security", accountText:"Update your profile, password, MFA and account preferences.", notifications:"Developer notifications", notificationsText:"Review notifications available to your developer workspace.", help:"Help center", helpText:"Read current workflow guidance and feature availability.",
    open:"Open", loading:"Loading workspace settings…", unavailable:"Workspace information is currently unavailable.", retry:"Refresh page", notConfigured:"Connect your account to view workspace settings.", noLimit:"Not available", readOnly:"Read-only", soon:"Not enabled yet", billingUnavailable:"Billing actions are not available yet."
  },
  fr: {
    eyebrow:"ESPACE DÉVELOPPEUR", title:"Paramètres de l’espace", intro:"Consultez votre espace développeur, l’utilisation du forfait et les contrôles du compte.",
    overview:"Aperçu de l’espace", apps:"Applications", tests:"Tests", plan:"Forfait et utilisation", currentPlan:"Forfait actuel", activeApps:"Applications actives", limit:"Limite d’applications", available:"Places disponibles", planNote:"Les informations du forfait sont en lecture seule. La facturation, les mises à niveau et les paiements ne sont pas activés dans cet espace V2.",
    preferences:"Contrôles de l’espace", language:"Langue du tableau de bord", languageNote:"La langue du tableau de bord est enregistrée dans ce navigateur. La langue du compte se règle séparément.",
    account:"Compte et sécurité", accountText:"Modifiez votre profil, mot de passe, MFA et préférences du compte.", notifications:"Notifications développeur", notificationsText:"Consultez les notifications de votre espace développeur.", help:"Centre d’aide", helpText:"Consultez les guides et la disponibilité actuelle des fonctions.",
    open:"Ouvrir", loading:"Chargement des paramètres…", unavailable:"Les informations de l’espace sont indisponibles.", retry:"Actualiser", notConfigured:"Connectez votre compte pour afficher les paramètres.", noLimit:"Indisponible", readOnly:"Lecture seule", soon:"Pas encore activé", billingUnavailable:"Les actions de facturation ne sont pas encore disponibles."
  },
  ar: {
    eyebrow:"مساحة المطوّر", title:"إعدادات مساحة العمل", intro:"راجع مساحة المطوّر واستخدام الخطة وإعدادات الحساب.",
    overview:"ملخص مساحة العمل", apps:"التطبيقات", tests:"الاختبارات", plan:"الخطة والاستخدام", currentPlan:"الخطة الحالية", activeApps:"التطبيقات النشطة", limit:"حد التطبيقات", available:"المقاعد المتاحة", planNote:"معلومات الخطة للعرض فقط. الفوترة والترقية والدفع غير مفعّلة حالياً في إصدار V2.",
    preferences:"إعدادات مساحة العمل", language:"لغة لوحة التحكم", languageNote:"يتم حفظ لغة لوحة التحكم في هذا المتصفح فقط. لغة الحساب تُدار بشكل منفصل من إعدادات الحساب.",
    account:"الحساب والأمان", accountText:"تعديل الملف الشخصي وكلمة المرور والمصادقة الثنائية وتفضيلات الحساب.", notifications:"إشعارات المطوّر", notificationsText:"راجع الإشعارات الخاصة بمساحة المطوّر.", help:"مركز المساعدة", helpText:"اطّلع على الشروحات وحالة توفر الميزات الحالية.",
    open:"فتح", loading:"جارٍ تحميل إعدادات مساحة العمل…", unavailable:"معلومات مساحة العمل غير متاحة حالياً.", retry:"تحديث الصفحة", notConfigured:"سجّل الدخول لعرض إعدادات مساحة العمل.", noLimit:"غير متاح", readOnly:"للقراءة فقط", soon:"غير مفعّل بعد", billingUnavailable:"إجراءات الفوترة غير متاحة بعد."
  }
} as const;

function Icon({ name }: { name: "grid" | "apps" | "tests" | "shield" | "bell" | "help" | "globe" | "arrow" | "refresh" }) {
  const paths: Record<string, ReactNode> = {
    grid:<><rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/></>,
    apps:<><rect x="4" y="4" width="16" height="16" rx="3"/><path d="M8 9h8M8 13h8M8 17h4"/></>,
    tests:<><path d="M8 3h8M9 3v5l-5 9a3 3 0 0 0 2.6 4.5h10.8A3 3 0 0 0 20 17l-5-9V3"/><path d="M8 14h8"/></>,
    shield:<><path d="M12 22s8-4 8-11V5l-8-3-8 3v6c0 7 8 11 8 11Z"/><path d="m9 12 2 2 4-4"/></>,
    bell:<><path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9"/><path d="M10 21h4"/></>,
    help:<><circle cx="12" cy="12" r="9"/><path d="M9.5 9a2.6 2.6 0 1 1 4.5 1.8c-1.2 1.1-2 1.4-2 3M12 17.5h.01"/></>,
    globe:<><circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3a15 15 0 0 1 0 18M12 3a15 15 0 0 0 0 18"/></>,
    arrow:<><path d="M5 12h14M13 6l6 6-6 6"/></>,
    refresh:<><path d="M20 7v5h-5M4 17v-5h5"/><path d="M5.5 9a7 7 0 0 1 11.7-2L20 12M4 12l2.8 5a7 7 0 0 0 11.7-2"/></>
  };
  return <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{paths[name]}</svg>;
}

export default function DeveloperWorkspaceSettingsPage() {
  const { user } = useIdentity();
  const [language, setLanguage] = useState<Language>("en");
  const [appCount, setAppCount] = useState<number | null>(null);
  const [testCount, setTestCount] = useState<number | null>(null);
  const [limit, setLimit] = useState<PlanUsage | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const t = copy[language];
  const direction = language === "ar" ? "rtl" : "ltr";
  const available = useMemo(() => limit?.max_active_apps == null || limit.current_active_apps == null
    ? null : Math.max(0, limit.max_active_apps - limit.current_active_apps), [limit]);

  useEffect(() => {
    const saved = window.localStorage.getItem("testdz-landing-language");
    if (saved === "ar" || saved === "fr" || saved === "en") setLanguage(saved);
  }, []);

  useEffect(() => {
    let alive = true;
    async function load() {
      setLoading(true); setError(false);
      if (!user?.id || !supabase) { setLoading(false); setError(true); return; }
      const [apps, tests, plan] = await Promise.all([
        listApps(user.id), listDeveloperTests(user.id), getAppLimit()
      ]);
      if (!alive) return;
      if (apps.error || tests.error) setError(true);
      else { setAppCount((apps.data ?? []).length); setTestCount((tests.data ?? []).length); }
      if (!plan.error) {
        const value = Array.isArray(plan.data) ? plan.data[0] : plan.data;
        setLimit(value ?? null);
      }
      setLoading(false);
    }
    void load();
    return () => { alive = false; };
  }, [user?.id]);

  function changeLanguage(next: Language) {
    setLanguage(next);
    window.localStorage.setItem("testdz-landing-language", next);
    document.documentElement.lang = next;
    document.documentElement.dir = next === "ar" ? "rtl" : "ltr";
  }

  return <div className="dws-page" dir={direction}>
    <aside className="dws-sidebar">
      <Link to="/developer-dashboard" className="dws-brand"><span>TD</span><strong>TestDZ</strong><small>Developer workspace</small></Link>
      <nav>
        <Link to="/developer-dashboard"><Icon name="grid"/>Dashboard</Link>
        <Link to="/apps"><Icon name="apps"/>{t.apps}</Link>
        <Link to="/developer-tests"><Icon name="tests"/>{t.tests}</Link>
        <Link to="/developer-notifications"><Icon name="bell"/>{t.notifications}</Link>
        <Link to="/developer-help"><Icon name="help"/>{t.help}</Link>
        <Link to="/developer-settings" className="active"><Icon name="shield"/>{t.title}</Link>
      </nav>
      <Link to="/developer-dashboard" className="dws-back">← {t.overview}</Link>
    </aside>
    <main className="dws-main">
      <header className="dws-header">
        <div><span className="dws-eyebrow">{t.eyebrow}</span><h1>{t.title}</h1><p>{t.intro}</p></div>
        <Link to="/developer-dashboard" className="dws-home">TestDZ · Developer</Link>
      </header>
      {loading ? <div className="dws-state">{t.loading}</div> : error ? <div className="dws-state"><p>{t.unavailable}</p><button onClick={() => window.location.reload()}><Icon name="refresh"/>{t.retry}</button></div> : <>
        <section className="dws-grid">
          <article className="dws-metric"><span className="dws-icon blue"><Icon name="apps"/></span><div><small>{t.apps}</small><strong>{appCount ?? "—"}</strong></div></article>
          <article className="dws-metric"><span className="dws-icon violet"><Icon name="tests"/></span><div><small>{t.tests}</small><strong>{testCount ?? "—"}</strong></div></article>
          <article className="dws-metric"><span className="dws-icon green"><Icon name="shield"/></span><div><small>{t.currentPlan}</small><strong className="dws-plan">{limit?.plan_code?.toUpperCase() || t.noLimit}</strong></div></article>
        </section>
        <section className="dws-card">
          <div className="dws-card-head"><div><span className="dws-eyebrow">{t.overview}</span><h2>{t.plan}</h2></div><span className="dws-readonly">{t.readOnly}</span></div>
          <div className="dws-usage">
            <div><small>{t.activeApps}</small><strong>{limit?.current_active_apps ?? "—"}</strong></div>
            <div><small>{t.limit}</small><strong>{limit?.max_active_apps ?? t.noLimit}</strong></div>
            <div><small>{t.available}</small><strong>{available ?? "—"}</strong></div>
          </div>
          {limit?.max_active_apps != null && <div className="dws-progress"><span style={{width: Math.min(100, ((limit.current_active_apps ?? 0) / Math.max(1, limit.max_active_apps)) * 100) + "%"}}/></div>}
          <p className="dws-note">{t.planNote}</p>
        </section>
        <section className="dws-card">
          <div className="dws-card-head"><div><span className="dws-eyebrow">{t.preferences}</span><h2>{t.language}</h2><p>{t.languageNote}</p></div></div>
          <div className="dws-language">
            <button className={language === "en" ? "selected" : ""} onClick={() => changeLanguage("en")}>English</button>
            <button className={language === "fr" ? "selected" : ""} onClick={() => changeLanguage("fr")}>Français</button>
            <button className={language === "ar" ? "selected" : ""} onClick={() => changeLanguage("ar")}>العربية</button>
          </div>
        </section>
        <section className="dws-links">
          <Link to="/settings"><span className="dws-link-icon"><Icon name="shield"/></span><span><strong>{t.account}</strong><small>{t.accountText}</small></span><Icon name="arrow"/></Link>
          <Link to="/developer-notifications"><span className="dws-link-icon"><Icon name="bell"/></span><span><strong>{t.notifications}</strong><small>{t.notificationsText}</small></span><Icon name="arrow"/></Link>
          <Link to="/developer-help"><span className="dws-link-icon"><Icon name="help"/></span><span><strong>{t.help}</strong><small>{t.helpText}</small></span><Icon name="arrow"/></Link>
        </section>
        <p className="dws-footnote">{t.billingUnavailable}</p>
      </>}
    </main>
  </div>;
}
