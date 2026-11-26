import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { listDeveloperTests } from "../../../features/apps/apps-api";
import { useIdentity } from "../../../shared/auth/hooks/useIdentity";
import "../styles/developer-analytics-v2.css";

type Language = "en" | "fr" | "ar";
type TestRow = { id: string; title: string; status: string; created_at: string | null };

const copy = {
  en: {
    back: "Developer workspace", eyebrow: "WORKSPACE ANALYTICS", title: "Test activity overview",
    intro: "A privacy-safe view of your test portfolio and lifecycle status.",
    total: "Total tests", active: "In progress", completed: "Completed", attention: "Needs attention",
    distribution: "Test lifecycle", recent: "Recent tests", noTests: "No tests yet",
    noTestsText: "Create your first test to start tracking its lifecycle here.",
    create: "Create a test", loading: "Loading analytics…", failed: "Analytics could not be loaded.",
    retry: "Try again", signIn: "Sign in to view your workspace analytics.",
    draft: "Draft", submitted: "Submitted", recruiting: "Recruiting", ready: "Ready",
    running: "Running", at_risk: "Needs attention", completedStatus: "Completed",
    failedStatus: "Failed", cancelled: "Cancelled", other: "Other",
    privacy: "Privacy by design", privacyText: "This overview uses only your own test records and their lifecycle statuses. It does not combine tester-level activity, feedback, ratings, or suppressed metrics across tests.",
    open: "Open monitoring", created: "Created", status: "Status"
  },
  fr: {
    back: "Espace développeur", eyebrow: "ANALYSE DE L’ESPACE", title: "Aperçu de l’activité des tests",
    intro: "Une vue respectueuse de la vie privée de vos tests et de leur état.",
    total: "Total des tests", active: "En cours", completed: "Terminés", attention: "À surveiller",
    distribution: "Cycle de vie des tests", recent: "Tests récents", noTests: "Aucun test pour le moment",
    noTestsText: "Créez votre premier test pour suivre son évolution ici.",
    create: "Créer un test", loading: "Chargement des analyses…", failed: "Impossible de charger les analyses.",
    retry: "Réessayer", signIn: "Connectez-vous pour consulter les analyses.",
    draft: "Brouillon", submitted: "Soumis", recruiting: "Recrutement", ready: "Prêt",
    running: "En cours", at_risk: "À surveiller", completedStatus: "Terminé",
    failedStatus: "Échoué", cancelled: "Annulé", other: "Autre",
    privacy: "Confidentialité intégrée", privacyText: "Cet aperçu utilise uniquement vos propres tests et leur état. Il ne regroupe pas l’activité, les retours, les notes des testeurs ni les indicateurs masqués entre plusieurs tests.",
    open: "Ouvrir le suivi", created: "Créé", status: "État"
  },
  ar: {
    back: "مساحة المطوّر", eyebrow: "تحليلات مساحة العمل", title: "نظرة عامة على نشاط الاختبارات",
    intro: "عرض يحترم الخصوصية لاختباراتك وحالات سير عملها.",
    total: "إجمالي الاختبارات", active: "قيد التنفيذ", completed: "مكتملة", attention: "تحتاج متابعة",
    distribution: "مراحل الاختبارات", recent: "أحدث الاختبارات", noTests: "لا توجد اختبارات بعد",
    noTestsText: "أنشئ اختبارك الأول لتتابع حالته هنا.",
    create: "إنشاء اختبار", loading: "جارٍ تحميل التحليلات…", failed: "تعذر تحميل التحليلات.",
    retry: "إعادة المحاولة", signIn: "سجّل الدخول لعرض تحليلات مساحة العمل.",
    draft: "مسودة", submitted: "مرسلة", recruiting: "تستقبل المختبرين", ready: "جاهزة",
    running: "قيد التنفيذ", at_risk: "تحتاج متابعة", completedStatus: "مكتملة",
    failedStatus: "فشلت", cancelled: "ملغاة", other: "أخرى",
    privacy: "الخصوصية أولاً", privacyText: "يعتمد هذا الملخص على اختباراتك وحالاتها فقط. لا نجمع نشاط المختبرين أو الملاحظات أو التقييمات أو المؤشرات المخفية من اختبارات متعددة في إحصائية واحدة.",
    open: "فتح المراقبة", created: "تاريخ الإنشاء", status: "الحالة"
  }
} as const;

const statusKeys = ["draft", "submitted", "recruiting", "ready", "running", "at_risk", "completed", "failed", "cancelled"] as const;
const activeStatuses = new Set(["submitted", "recruiting", "ready", "running", "at_risk"]);

function readLanguage(): Language {
  const saved = window.localStorage.getItem("testdz-developer-dashboard-language");
  return saved === "ar" || saved === "fr" ? saved : "en";
}

export default function DeveloperAnalyticsPage() {
  const { user, rolesLoading } = useIdentity();
  const [language, setLanguage] = useState<Language>(readLanguage);
  const [tests, setTests] = useState<TestRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const t = copy[language];
  const direction = language === "ar" ? "rtl" : "ltr";

  useEffect(() => {
    const sync = () => setLanguage(readLanguage());
    window.addEventListener("storage", sync);
    return () => window.removeEventListener("storage", sync);
  }, []);

  const load = useCallback(async () => {
    if (!user?.id) {
      setTests([]);
      setError(true);
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(false);
    try {
      const result = await listDeveloperTests(user.id);
      if (result.error) {
        setTests([]);
        setError(true);
      } else {
        setTests((result.data ?? []) as unknown as TestRow[]);
      }
    } catch {
      setTests([]);
      setError(true);
    } finally {
      setLoading(false);
    }
  }, [user?.id]);

  useEffect(() => {
    if (!rolesLoading) void load();
  }, [rolesLoading, load]);

  const counts = useMemo(() => {
    const byStatus = new Map<string, number>();
    for (const test of tests) byStatus.set(test.status, (byStatus.get(test.status) ?? 0) + 1);
    return {
      byStatus,
      active: tests.filter(test => activeStatuses.has(test.status)).length,
      completed: tests.filter(test => test.status === "completed").length,
      attention: tests.filter(test => test.status === "at_risk" || test.status === "failed").length
    };
  }, [tests]);

  const labelFor = (status: string) => {
    const labels: Record<string, string> = {
      draft: t.draft, submitted: t.submitted, recruiting: t.recruiting, ready: t.ready,
      running: t.running, at_risk: t.at_risk, completed: t.completedStatus,
      failed: t.failedStatus, cancelled: t.cancelled
    };
    return labels[status] ?? t.other;
  };

  return <main className="da2-page" dir={direction}>
    <header className="da2-header">
      <div>
        <Link to="/developer-dashboard" className="da2-back">← {t.back}</Link>
        <span className="da2-eyebrow">{t.eyebrow}</span>
        <h1>{t.title}</h1>
        <p>{t.intro}</p>
      </div>
      <Link to="/developer-dashboard" className="da2-brand">TestDZ · Developer</Link>
    </header>

    {loading || rolesLoading ? <div className="da2-state">{t.loading}</div> : error ? <div className="da2-state">
      <p>{user ? t.failed : t.signIn}</p>
      {user && <button type="button" onClick={() => void load()}>{t.retry}</button>}
    </div> : <>
      <section className="da2-kpis">
        <article><small>{t.total}</small><strong>{tests.length}</strong></article>
        <article><small>{t.active}</small><strong>{counts.active}</strong></article>
        <article><small>{t.completed}</small><strong>{counts.completed}</strong></article>
        <article><small>{t.attention}</small><strong>{counts.attention}</strong></article>
      </section>

      <section className="da2-card">
        <div className="da2-section-head"><div><span className="da2-eyebrow">{t.eyebrow}</span><h2>{t.distribution}</h2></div></div>
        <div className="da2-status-list">
          {statusKeys.map(status => {
            const count = counts.byStatus.get(status) ?? 0;
            const width = tests.length ? count / tests.length * 100 : 0;
            return <div className="da2-status-row" key={status}>
              <div><span>{labelFor(status)}</span><strong>{count}</strong></div>
              <div className="da2-track"><span style={{ width: width + "%" }} /></div>
            </div>;
          })}
        </div>
      </section>

      <section className="da2-card">
        <div className="da2-section-head"><div><span className="da2-eyebrow">{t.eyebrow}</span><h2>{t.recent}</h2></div>
          <Link to="/developer/tests/new" className="da2-create">{t.create}</Link>
        </div>
        {tests.length === 0 ? <div className="da2-empty"><strong>{t.noTests}</strong><p>{t.noTestsText}</p><Link to="/developer/tests/new">{t.create}</Link></div> :
          <div className="da2-table-wrap"><table><thead><tr><th>{t.recent}</th><th>{t.created}</th><th>{t.status}</th></tr></thead>
            <tbody>{tests.slice(0, 8).map(test => <tr key={test.id}>
              <td><strong>{test.title}</strong></td>
              <td>{test.created_at ? new Date(test.created_at).toLocaleDateString(language === "ar" ? "ar-DZ" : language === "fr" ? "fr-FR" : "en-US", { timeZone: "Africa/Algiers" }) : "—"}</td>
              <td><span className={"da2-status-pill status-" + test.status}>{labelFor(test.status)}</span> <Link to={"/developer/tests/" + test.id + "/monitoring"}>{t.open}</Link></td>
            </tr>)}</tbody></table></div>}
      </section>

      <aside className="da2-privacy"><strong>{t.privacy}</strong><p>{t.privacyText}</p></aside>
    </>}
  </main>;
}
