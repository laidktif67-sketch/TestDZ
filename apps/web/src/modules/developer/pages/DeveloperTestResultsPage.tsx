import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  getDeveloperTestMonitoringSummary,
  listDeveloperTests,
  type DeveloperTestMonitoringSummary,
} from "../../../features/apps/apps-api";
import { isTesterWorkflowV2Enabled } from "../../../lib/supabase-v2";
import { useIdentity } from "../../../shared/auth/hooks/useIdentity";
import { Brand } from "../../../shared/components/Brand";
import "../styles/developer-test-results-v2.css";

type ResultRow = DeveloperTestMonitoringSummary;
type SortKey = "assignments" | "completion" | "rating";

type Language = "en" | "fr" | "ar";
const copy = {
  en: {
    statuses: { draft: "Draft", submitted: "Under review", recruiting: "Recruiting", ready: "Ready", running: "Running", at_risk: "Needs attention", completed: "Completed", failed: "Rejected", cancelled: "Cancelled" },
    disabled: "Test results are available when the V2 workspace is enabled.", signIn: "Sign in to view your test results.", loadError: "Could not load test results.",
    dashboard: "Developer dashboard", tests: "My tests", testers: "Tester community", back: "← Back to tests",
    eyebrow: "Developer workspace · Results", title: "Test results", intro: "Aggregated summaries for every test you own, without exposing individual participant data.",
    refreshing: "Refreshing…", refresh: "↻ Refresh", export: "Export CSV", loading: "Loading results…",
    search: "Search by test or app name…", searchLabel: "Search", statusLabel: "Test status", sortLabel: "Sort results",
    all: "All statuses", assignments: "Most assignments", completion: "Highest completion", rating: "Highest rating",
    testCount: "tests", suppressed: "tests currently have hidden metrics because the tester count is below the privacy threshold. Their figures are not shown or included in exports.",
    test: "Test", participation: "Assignments", completed: "Completed", failed: "Failed", feedback: "Feedback", ratings: "Star ratings", average: "Average rating", completionCol: "Completion",
    hidden: "Metrics hidden to protect tester privacy", details: "View details →", noMatch: "No matching results", changeFilters: "Try changing your search or filters.", noResults: "Results will appear after tests begin receiving assignments.",
    privacyTitle: "🔒 Aggregated data only", privacy: "This page does not show tester names, IDs, individual assignments, or feedback content. Metric suppression is respected separately for each test.",
    footer: "{t.footer}"
  },
  fr: {
    statuses: { draft: "Brouillon", submitted: "En révision", recruiting: "Recrutement", ready: "Prêt", running: "En cours", at_risk: "À surveiller", completed: "Terminé", failed: "Rejeté", cancelled: "Annulé" },
    disabled: "Les résultats sont disponibles lorsque l’espace V2 est activé.", signIn: "Connectez-vous pour consulter vos résultats.", loadError: "Impossible de charger les résultats.",
    dashboard: "Espace développeur", tests: "Mes tests", testers: "Communauté des testeurs", back: "← Retour aux tests",
    eyebrow: "Espace développeur · Résultats", title: "Résultats des tests", intro: "Des résumés agrégés de vos tests, sans exposer les données individuelles des participants.",
    refreshing: "Actualisation…", refresh: "↻ Actualiser", export: "Exporter CSV", loading: "Chargement des résultats…",
    search: "Rechercher un test ou une application…", searchLabel: "Recherche", statusLabel: "État du test", sortLabel: "Trier les résultats",
    all: "Tous les états", assignments: "Plus de participations", completion: "Meilleur taux de complétion", rating: "Meilleure note",
    testCount: "tests", suppressed: "tests masquent actuellement leurs indicateurs car le nombre de testeurs est inférieur au seuil de confidentialité. Ces chiffres ne sont ni affichés ni exportés.",
    test: "Test", participation: "Participations", completed: "Terminés", failed: "Échecs", feedback: "Retours", ratings: "Notes étoilées", average: "Note moyenne", completionCol: "Complétion",
    hidden: "Indicateurs masqués pour protéger la vie privée", details: "Voir les détails →", noMatch: "Aucun résultat correspondant", changeFilters: "Modifiez votre recherche ou vos filtres.", noResults: "Les résultats apparaîtront lorsque les tests recevront des participations.",
    privacyTitle: "🔒 Données agrégées uniquement", privacy: "Cette page n’affiche ni noms ou identifiants de testeurs, ni participations individuelles, ni contenu des retours. Le masquage est appliqué séparément à chaque test.",
    footer: "TestDZ · Build · Test · Improve"
  },
  ar: {
    statuses: { draft: "مسودة", submitted: "قيد المراجعة", recruiting: "يستقبل المختبرين", ready: "جاهز", running: "جارٍ التنفيذ", at_risk: "يحتاج متابعة", completed: "مكتمل", failed: "مرفوض", cancelled: "ملغى" },
    disabled: "نتائج الاختبارات متاحة عند تفعيل مساحة V2 فقط.", signIn: "سجّل الدخول للوصول إلى نتائج اختباراتك.", loadError: "تعذر تحميل نتائج الاختبارات.",
    dashboard: "لوحة المطوّر", tests: "اختباراتي", testers: "مجتمع المختبرين", back: "{t.back}",
    eyebrow: "{t.eyebrow}", title: "نتائج الاختبارات", intro: "{t.intro}",
    refreshing: "جارٍ التحديث…", refresh: "↻ تحديث", export: "تصدير CSV", loading: "جارٍ تحميل النتائج…",
    search: "ابحث باسم الاختبار أو التطبيق…", searchLabel: "البحث", statusLabel: "حالة الاختبار", sortLabel: "ترتيب النتائج",
    all: "كل الحالات", assignments: "الأكثر مشاركة", completion: "أعلى إكمال", rating: "أعلى تقييم",
    testCount: "اختبار", suppressed: "اختبار مخفي المؤشرات حالياً لأن عدد المختبرين لا يحقق حد الخصوصية. لن تظهر أرقامه ولن تدخل في ملف التصدير.",
    test: "الاختبار", participation: "المشاركات", completed: "مكتمل", failed: "فشل", feedback: "الملاحظات", ratings: "التقييمات ذات النجوم", average: "متوسط التقييم", completionCol: "الإكمال",
    hidden: "{t.hidden}", details: "عرض التفاصيل ←", noMatch: "لا توجد نتائج مطابقة", changeFilters: "جرّب تغيير البحث أو الفلاتر.", noResults: "ستظهر النتائج بعد بدء الاختبارات واستقبال المشاركات.",
    privacyTitle: "🔒 بيانات مجمّعة فقط", privacy: "لا تعرض هذه الصفحة أسماء المختبرين أو معرّفاتهم أو تفاصيل مشاركاتهم الفردية أو محتوى الملاحظات. تُحترم حالة إخفاء المؤشرات لكل اختبار على حدة.",
    footer: "TestDZ · Build · Test · Improve"
  }
} as const;

type VisibleMetrics = Extract<ResultRow["metrics"], { totalAssignments: number }>;
type VisibleResultRow = Omit<ResultRow, "metrics"> & { metrics: VisibleMetrics };

function hasVisibleMetrics(row: ResultRow): row is VisibleResultRow {
  return "totalAssignments" in row.metrics;
}

function metricValue(row: ResultRow, key: "totalAssignments" | "completionRate" | "averageRating") {
  if (!hasVisibleMetrics(row)) return null;
  return row.metrics[key];
}

export default function DeveloperTestResultsPage() {
  const { user, rolesLoading } = useIdentity();
  const [language, setLanguage] = useState<Language>(() => {
    const saved = window.localStorage.getItem("testdz-developer-dashboard-language");
    return saved === "fr" || saved === "ar" ? saved : "en";
  });
  const t = copy[language];
  const direction = language === "ar" ? "rtl" : "ltr";
  const statusLabels = t.statuses;
  const [rows, setRows] = useState<ResultRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("all");
  const [sort, setSort] = useState<SortKey>("assignments");

  const load = useCallback(async (refresh = false) => {
    if (refresh) setRefreshing(true);
    else setLoading(true);
    setError("");
    try {
      if (!isTesterWorkflowV2Enabled) throw new Error(t.disabled);
      if (!user?.id) throw new Error(t.signIn);
      const { data: tests, error: testsError } = await listDeveloperTests(user.id);
      if (testsError) throw testsError;

      const owned = (tests ?? []) as Array<{ id: string }>;
      const summaries: ResultRow[] = [];
      for (let index = 0; index < owned.length; index += 4) {
        const batch = await Promise.all(owned.slice(index, index + 4).map(async test => {
          const response = await getDeveloperTestMonitoringSummary(test.id);
          if (response.error) throw response.error;
          return response.data as ResultRow | null;
        }));
        summaries.push(...batch.filter((item): item is ResultRow => Boolean(item)));
      }
      setRows(summaries);
    } catch (reason) {
      setRows([]);
      setError(reason instanceof Error ? reason.message : t.loadError);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [user?.id]);

  useEffect(() => {
    if (rolesLoading) return;
    if (!user) {
      setLoading(false);
      setError(t.signIn);
      return;
    }
    void load();
  }, [user?.id, rolesLoading, load]);

  const visible = useMemo(() => {
    const filtered = rows.filter(row =>
      (row.test.title + " " + row.test.appName).toLocaleLowerCase().includes(query.toLocaleLowerCase()) &&
      (status === "all" || row.test.status === status)
    );
    return filtered.sort((a, b) => {
      const av = metricValue(a, sort === "assignments" ? "totalAssignments" : sort === "completion" ? "completionRate" : "averageRating");
      const bv = metricValue(b, sort === "assignments" ? "totalAssignments" : sort === "completion" ? "completionRate" : "averageRating");
      if (av === null) return bv === null ? 0 : 1;
      if (bv === null) return -1;
      return bv - av;
    });
  }, [rows, query, status, sort]);

  const suppressedCount = visible.filter(row => !hasVisibleMetrics(row)).length;
  const exportCsv = () => {
    const exportable = visible.filter(hasVisibleMetrics);
    if (!exportable.length) return;
    const data = [
      [t.test, "App", t.statusLabel, t.participation, t.completed, "Active", t.failed, t.feedback, t.ratings, t.average, t.completionCol],
      ...exportable.map(row => {
        const metrics = row.metrics;
        return [
          row.test.title, row.test.appName, statusLabels[row.test.status] ?? row.test.status,
          metrics.totalAssignments, metrics.completed, metrics.active, metrics.failed,
          metrics.feedbackCount, metrics.ratingCount, metrics.averageRating ?? "",
          metrics.completionRate + "%",
        ];
      }),
    ];
    const csv = data.map(line => line.map(value => '"' + String(value ?? "").replaceAll('"', '""') + '"').join(",")).join("\n");
    const url = URL.createObjectURL(new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8" }));
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = "testdz-test-results-summary.csv";
    anchor.click();
    URL.revokeObjectURL(url);
  };

  return <main className="dres-shell" dir={direction}>
    <header className="dres-header"><Brand /><nav>
      <Link to="/developer-dashboard">{t.dashboard}</Link>
      <Link to="/developer-tests">{t.tests}</Link>
      <Link to="/developer/testers">{t.testers}</Link>
    </nav></header>
    <section className="dres-content">
      <div className="dres-heading">
        <div><Link className="dres-back" to="/developer-tests">← العودة إلى الاختبارات</Link>
          <span className="dres-eyebrow">مساحة المطوّر · النتائج</span>
          <h1>{t.title}</h1>
          <p>ملخصات مجمّعة لكل اختبار تملكه، دون عرض بيانات المشاركين الفردية.</p>
        </div>
        <div className="dres-actions">
          <button onClick={() => void load(true)} disabled={loading || refreshing}>{refreshing ? t.refreshing : t.refresh}</button>
          <button className="primary" onClick={exportCsv} disabled={!visible.some(hasVisibleMetrics)}>{t.export}</button>
        </div>
      </div>
      {error && <div className="dres-error" role="alert">{error}</div>}
      {loading || rolesLoading ? <div className="dres-loading">{t.loading}</div> : <>
        <section className="dres-toolbar">
          <input value={query} onChange={event => setQuery(event.target.value)} placeholder={t.search} aria-label={t.searchLabel} />
          <select value={status} onChange={event => setStatus(event.target.value)} aria-label={t.statusLabel}>
            <option value="all">{t.all}</option>
            {Object.entries(statusLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
          </select>
          <select value={sort} onChange={event => setSort(event.target.value as SortKey)} aria-label={t.sortLabel}>
            <option value="assignments">{t.assignments}</option><option value="completion">{t.completion}</option><option value="rating">{t.rating}</option>
          </select>
          <span>{visible.length} {t.testCount}</span>
        </section>
        {suppressedCount > 0 && <p className="dres-privacy-note" role="status">{suppressedCount} {t.suppressed}</p>}
        {visible.length ? <section className="dres-table-wrap"><table>
          <thead><tr><th>{t.test}</th><th>{t.participation}</th><th>{t.completed}</th><th>{t.failed}</th><th>{t.feedback}</th><th>{t.ratings}</th><th>{t.average}</th><th>{t.completionCol}</th><th /></tr></thead>
          <tbody>{visible.map(row => <tr key={row.test.id}>
            <td><b>{row.test.title}</b><small>{row.test.appName} · {statusLabels[row.test.status] ?? row.test.status}</small></td>
            {!hasVisibleMetrics(row) ? <td colSpan={7}><span className="dres-suppressed">مؤشرات مخفية لحماية خصوصية المختبرين</span></td> : <>
              <td>{row.metrics.totalAssignments}</td><td>{row.metrics.completed}</td><td>{row.metrics.failed}</td>
              <td>{row.metrics.feedbackCount}</td><td>{row.metrics.ratingCount}</td>
              <td>{row.metrics.averageRating === null ? "—" : row.metrics.averageRating.toFixed(2) + "/5"}</td>
              <td><div className="dres-progress"><i style={{ width: row.metrics.completionRate + "%" }} /></div><small>{row.metrics.completionRate}%</small></td>
            </>}
            <td><Link to={"/developer/tests/" + row.test.id + "/monitoring"}>{t.details}</Link></td>
          </tr>)}</tbody>
        </table></section> : <section className="dres-empty"><h2>{t.noMatch}</h2><p>{rows.length ? t.changeFilters : t.noResults}</p></section>}
        <section className="dres-privacy"><strong>{t.privacyTitle}</strong><p>{t.privacy}</p></section>
      </>}
      <footer className="dres-footer">TestDZ · Build · Test · Improve</footer>
    </section>
  </main>;
}
