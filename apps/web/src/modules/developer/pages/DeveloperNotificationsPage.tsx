import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useIdentity } from "../../../shared/auth/hooks/useIdentity";
import {
  getNotificationsCenterPageData,
  markAllTesterNotificationsRead,
  markTesterNotificationRead,
} from "../../../features/notifications/notifications-api";
import { isTesterWorkflowV2Enabled } from "../../../lib/supabase-v2";
import "./developer-notifications.css";

type Language = "en" | "fr" | "ar";
type NotificationRow = {
  id: string;
  type: string;
  title: string;
  body: string;
  data: Record<string, unknown> | null;
  read_at: string | null;
  created_at: string;
};

const copy = {
  en: {
    eyebrow: "DEVELOPER WORKSPACE", title: "Notifications",
    subtitle: "Updates about your apps, tests, reviews and developer account.",
    unread: "Unread developer notifications", markAll: "Mark all as read",
    saving: "Saving…", dashboard: "← Dashboard", loading: "Loading your notifications…",
    emptyTitle: "You're all caught up.", emptyBody: "New developer updates will appear here when an event is generated.",
    markRead: "Mark read", read: "Read", errorLoad: "We couldn't load your developer notifications. Please refresh and try again.",
    errorOne: "This notification could not be marked as read. Please try again.",
    errorAll: "Your notifications could not be updated. Please try again.",
    successAll: "All developer notifications are marked as read.",
    unavailable: "Role-separated notification feeds are available with the V2 data workflow. This workspace is not showing the legacy shared feed, so tester and developer messages are never mixed here.",
    back: "Back to developer dashboard", language: "Language", unknownDate: "Unknown date"
  },
  fr: {
    eyebrow: "ESPACE DÉVELOPPEUR", title: "Notifications",
    subtitle: "Actualités concernant vos applications, tests, évaluations et votre compte développeur.",
    unread: "Notifications développeur non lues", markAll: "Tout marquer comme lu",
    saving: "Enregistrement…", dashboard: "← Tableau de bord", loading: "Chargement des notifications…",
    emptyTitle: "Vous êtes à jour.", emptyBody: "Les nouvelles actualités développeur apparaîtront ici lorsqu'un événement sera généré.",
    markRead: "Marquer comme lu", read: "Lu", errorLoad: "Impossible de charger vos notifications. Actualisez la page et réessayez.",
    errorOne: "Impossible de marquer cette notification comme lue. Réessayez.",
    errorAll: "Impossible de mettre à jour vos notifications. Réessayez.",
    successAll: "Toutes les notifications développeur sont marquées comme lues.",
    unavailable: "Les flux séparés par rôle sont disponibles avec le workflow de données V2. Le flux partagé historique n'est pas affiché ici afin de ne jamais mélanger les messages des testeurs et des développeurs.",
    back: "Retour à l'espace développeur", language: "Langue", unknownDate: "Date inconnue"
  },
  ar: {
    eyebrow: "مساحة المطوّر", title: "الإشعارات",
    subtitle: "تحديثات تطبيقاتك واختباراتك ومراجعاتك وحساب المطوّر.",
    unread: "إشعارات المطوّر غير المقروءة", markAll: "تحديد الكل كمقروء",
    saving: "جارٍ الحفظ…", dashboard: "← لوحة التحكم", loading: "جارٍ تحميل الإشعارات…",
    emptyTitle: "أنت على اطلاع بكل جديد.", emptyBody: "ستظهر هنا تحديثات المطوّر الجديدة عند إنشاء الأحداث.",
    markRead: "تحديد كمقروء", read: "مقروء", errorLoad: "تعذّر تحميل إشعارات المطوّر. حدّث الصفحة وحاول مجدداً.",
    errorOne: "تعذّر تحديد هذا الإشعار كمقروء. حاول مجدداً.",
    errorAll: "تعذّر تحديث الإشعارات. حاول مجدداً.",
    successAll: "تم تحديد جميع إشعارات المطوّر كمقروءة.",
    unavailable: "تتوفر الإشعارات المنفصلة حسب الدور مع نظام البيانات V2. لن نعرض موجز الإشعارات القديم المشترك هنا حتى لا تختلط رسائل المختبِرين والمطوّرين.",
    back: "العودة إلى مساحة المطوّر", language: "اللغة", unknownDate: "تاريخ غير معروف"
  }
} as const;

function formatDate(value: string, language: Language, unknown: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return unknown;
  const locale = language === "ar" ? "ar-DZ" : language === "fr" ? "fr-FR" : "en-GB";
  return date.toLocaleString(locale, { dateStyle: "medium", timeStyle: "short" });
}

export default function DeveloperNotificationsPage() {
  const { user } = useIdentity();
  const [language, setLanguage] = useState<Language>(() => {
    const saved = window.localStorage.getItem("testdz-developer-dashboard-language");
    return saved === "fr" || saved === "ar" ? saved : "en";
  });
  const t = copy[language];
  const [rows, setRows] = useState<NotificationRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState("");
  const [savingAll, setSavingAll] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  useEffect(() => {
    const previousLanguage = document.documentElement.lang;
    const previousDirection = document.documentElement.dir;

    document.documentElement.lang = language;
    document.documentElement.dir = language === "ar" ? "rtl" : "ltr";
    window.localStorage.setItem("testdz-developer-dashboard-language", language);

    return () => {
      document.documentElement.lang = previousLanguage;
      document.documentElement.dir = previousDirection;
    };
  }, [language]);

  useEffect(() => {
    let active = true;
    async function load() {
      if (!user?.id || !isTesterWorkflowV2Enabled) {
        setLoading(false);
        return;
      }
      setLoading(true);
      setError("");
      try {
        const result = await getNotificationsCenterPageData(user.id, "developer");
        if (!active) return;
        if (result.notificationResult.error) {
          setError(t.errorLoad);
        } else {
          setRows((result.notificationResult.data ?? []) as NotificationRow[]);
        }
      } catch {
        if (active) setError(t.errorLoad);
      } finally {
        if (active) setLoading(false);
      }
    }
    void load();
    return () => { active = false; };
  }, [user?.id, language]);

  const unread = useMemo(() => rows.filter(row => !row.read_at).length, [rows]);

  async function markRead(row: NotificationRow) {
    if (!user?.id || row.read_at || busyId) return;
    setBusyId(row.id);
    setError("");
    setNotice("");
    const readAt = new Date().toISOString();
    try {
      const result = await markTesterNotificationRead(user.id, row.id, readAt, "developer");
      if (result.error) {
        setError(t.errorOne);
        return;
      }
      setRows(current => current.map(item => item.id === row.id ? { ...item, read_at: readAt } : item));
    } catch {
      setError(t.errorOne);
    } finally {
      setBusyId("");
    }
  }

  async function markAllRead() {
    if (!user?.id || unread === 0 || savingAll) return;
    setSavingAll(true);
    setError("");
    setNotice("");
    const readAt = new Date().toISOString();
    try {
      const result = await markAllTesterNotificationsRead(user.id, readAt, "developer");
      if (result.error) {
        setError(t.errorAll);
        return;
      }
      setRows(current => current.map(row => row.read_at ? row : { ...row, read_at: readAt }));
      setNotice(t.successAll);
    } catch {
      setError(t.errorAll);
    } finally {
      setSavingAll(false);
    }
  }

  if (!isTesterWorkflowV2Enabled) {
    return <main className="dn-page" dir={language === "ar" ? "rtl" : "ltr"}>
      <section className="dn-panel dn-unavailable">
        <span className="dn-eyebrow">{t.eyebrow}</span>
        <h1>{t.title}</h1>
        <p>{t.unavailable}</p>
        <Link className="dn-back" to="/developer-dashboard">{t.back}</Link>
      </section>
    </main>;
  }

  return <main className="dn-page" dir={language === "ar" ? "rtl" : "ltr"}>
    <header className="dn-header">
      <div>
        <span className="dn-eyebrow">{t.eyebrow}</span>
        <h1>{t.title}</h1>
        <p>{t.subtitle}</p>
      </div>
      <div className="dn-header-actions">
        <label className="dn-language"><span>{t.language}</span>
          <select aria-label={t.language} value={language} onChange={event => setLanguage(event.target.value as Language)}>
            <option value="en">EN</option><option value="fr">FR</option><option value="ar">AR</option>
          </select>
        </label>
        <Link className="dn-back" to="/developer-dashboard">{t.dashboard}</Link>
      </div>
    </header>

    <section className="dn-summary" aria-live="polite">
      <div><strong>{unread}</strong><span>{t.unread}</span></div>
      <button type="button" onClick={() => void markAllRead()} disabled={!unread || savingAll || Boolean(busyId) || loading}>
        {savingAll ? t.saving : t.markAll}
      </button>
    </section>

    {(error || notice) && <p className={error ? "dn-message dn-error" : "dn-message"} role={error ? "alert" : "status"}>{error || notice}</p>}

    <section className="dn-panel" aria-label={t.title}>
      {loading ? <div className="dn-empty">{t.loading}</div> :
        rows.length === 0 ? <div className="dn-empty"><strong>{t.emptyTitle}</strong><span>{t.emptyBody}</span></div> :
        <ul className="dn-list">{rows.map(row => <li key={row.id} className={row.read_at ? "" : "dn-unread"}>
          <button type="button" className="dn-item" onClick={() => void markRead(row)} disabled={Boolean(busyId)}>
            <span className="dn-indicator" aria-hidden="true"/>
            <span className="dn-copy"><strong>{row.title}</strong><span>{row.body}</span><small>{row.type.replace(/[_-]+/g, " ")} · {formatDate(row.created_at, language, t.unknownDate)}</small></span>
            <span className="dn-action">{busyId === row.id ? t.saving : row.read_at ? t.read : t.markRead}</span>
          </button>
        </li>)}</ul>}
    </section>
  </main>;
}
