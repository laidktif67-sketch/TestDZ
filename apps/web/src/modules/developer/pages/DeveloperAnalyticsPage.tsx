import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  getDeveloperTestMonitoringSummary,
  listDeveloperTests,
  type DeveloperTestMonitoringSummary,
} from "../../../features/apps/apps-api";
import { isTesterWorkflowV2Enabled } from "../../../lib/supabase-v2";
import { useIdentity } from "../../../shared/auth/hooks/useIdentity";
import { Brand } from "../../../shared/components/Brand";
import "../styles/developer-analytics-v2.css";

type Summary = DeveloperTestMonitoringSummary;

const dateKey = (date: Date) => [
  date.getFullYear(),
  String(date.getMonth() + 1).padStart(2, "0"),
  String(date.getDate()).padStart(2, "0"),
].join("-");
const number = (value: number) => new Intl.NumberFormat("en").format(value);

export default function DeveloperAnalyticsPage() {
  const { user, rolesLoading } = useIdentity();
  const [rows, setRows] = useState<Summary[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");

  async function load(refresh = false) {
    if (refresh) setRefreshing(true);
    else setLoading(true);
    setError("");
    try {
      if (!isTesterWorkflowV2Enabled) throw new Error("التحليلات متاحة عند تفعيل مساحة V2 فقط.");
      if (!user?.id) throw new Error("سجّل الدخول للوصول إلى تحليلات المطوّر.");
      const { data: tests, error: testsError } = await listDeveloperTests(user.id);
      if (testsError) throw testsError;
      const owned = (tests ?? []) as Array<{ id: string }>;
      const summaries: Summary[] = [];
      for (let index = 0; index < owned.length; index += 4) {
        const batch = await Promise.all(owned.slice(index, index + 4).map(async test => {
          const result = await getDeveloperTestMonitoringSummary(test.id);
          if (result.error) throw result.error;
          return result.data as Summary | null;
        }));
        summaries.push(...batch.filter((item): item is Summary => Boolean(item)));
      }
      setRows(summaries);
    } catch (reason) {
      setRows([]);
      setError(reason instanceof Error ? reason.message : "تعذر تحميل التحليلات.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  useEffect(() => {
    if (rolesLoading) return;
    if (!user) {
      setLoading(false);
      setError("سجّل الدخول للوصول إلى تحليلات المطوّر.");
      return;
    }
    void load();
  }, [user?.id, rolesLoading]);

  const totals = useMemo(() => rows.reduce((value, row) => ({
    tests: value.tests + 1,
    assignments: value.assignments + row.metrics.totalAssignments,
    completed: value.completed + row.metrics.completed,
    active: value.active + row.metrics.active,
    pending: value.pending + row.metrics.pending,
    feedback: value.feedback + row.metrics.feedbackCount,
    ratingCount: value.ratingCount + row.metrics.ratingCount,
    ratingPoints: value.ratingPoints + (row.metrics.averageRating ?? 0) * row.metrics.ratingCount,
  }), { tests: 0, assignments: 0, completed: 0, active: 0, pending: 0, feedback: 0, ratingCount: 0, ratingPoints: 0 }), [rows]);

  const chart = useMemo(() => {
    const days = 7;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const start = new Date(today);
    start.setDate(start.getDate() - days + 1);
    const counts = new Map<string, number>();
    for (const row of rows) {
      for (const item of row.dailyActivity ?? []) {
        if (item.date >= dateKey(start) && item.date <= dateKey(today)) {
          counts.set(item.date, (counts.get(item.date) ?? 0) + item.count);
        }
      }
    }
    return Array.from({ length: days }, (_, index) => {
      const day = new Date(start);
      day.setDate(start.getDate() + index);
      const key = dateKey(day);
      return { key, label: day.toLocaleDateString("en", { month: "short", day: "numeric" }), count: counts.get(key) ?? 0 };
    });
  }, [rows]);

  const apps = useMemo(() => {
    const grouped = new Map<string, { name: string; tests: number; assignments: number; completed: number }>();
    for (const row of rows) {
      const name = row.test.appName || "تطبيق بدون اسم";
      const current = grouped.get(name) ?? { name, tests: 0, assignments: 0, completed: 0 };
      current.tests += 1;
      current.assignments += row.metrics.totalAssignments;
      current.completed += row.metrics.completed;
      grouped.set(name, current);
    }
    return [...grouped.values()].sort((a, b) => b.assignments - a.assignments).slice(0, 6);
  }, [rows]);

  const maxActivity = Math.max(1, ...chart.map(item => item.count));
  const completion = totals.assignments ? Math.round(totals.completed / totals.assignments * 100) : 0;
  const averageRating = totals.ratingCount ? totals.ratingPoints / totals.ratingCount : 0;

  function exportCsv() {
    const lines = [
      ["Application", "Tests", "Assignments", "Completed", "Completion rate"],
      ...apps.map(app => [app.name, app.tests, app.assignments, app.completed, app.assignments ? Math.round(app.completed / app.assignments * 100) + "%" : "0%"]),
    ];
    const csv = lines.map(line => line.map(value => '"' + String(value).replaceAll('"', '""') + '"').join(",")).join("\n");
    const url = URL.createObjectURL(new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8" }));
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = "testdz-developer-analytics.csv";
    anchor.click();
    URL.revokeObjectURL(url);
  }

  return <main className="dan2-shell" dir="rtl">
    <header className="dan2-header"><Brand /><nav><Link to="/developer-dashboard">لوحة المطوّر</Link><Link to="/developer-tests">اختباراتي</Link><Link to="/developer-test-results">نتائج الاختبارات</Link></nav></header>
    <section className="dan2-content">
      <div className="dan2-heading"><div><span>مساحة المطوّر · الأداء</span><h1>التحليلات</h1><p>نظرة مجمّعة على أداء اختباراتك وتفاعل المختبرين وجودة النتائج.</p></div>
        <div className="dan2-actions"><button onClick={() => void load(true)} disabled={loading || refreshing}>{refreshing ? "جارٍ التحديث…" : "↻ تحديث"}</button><button className="primary" onClick={exportCsv} disabled={!apps.length}>تصدير CSV</button></div>
      </div>
      {error && <div className="dan2-error" role="alert">{error}</div>}
      {loading || rolesLoading ? <div className="dan2-empty">جارٍ تحميل التحليلات…</div> : <>
        <section className="dan2-kpis">
          <article><small>الاختبارات</small><strong>{number(totals.tests)}</strong><span>اختباراتك المسجلة</span></article>
          <article><small>المشاركات</small><strong>{number(totals.assignments)}</strong><span>{number(totals.active)} نشطة · {number(totals.pending)} معلّقة</span></article>
          <article><small>نسبة الإكمال</small><strong>{completion}%</strong><span>{number(totals.completed)} مشاركة مكتملة</span></article>
          <article><small>متوسط التقييم</small><strong>{totals.ratingCount ? averageRating.toFixed(2) + "/5" : "—"}</strong><span>{number(totals.feedback)} ملاحظات مستلمة</span></article>
        </section>
        <section className="dan2-panel">
          <div className="dan2-panel-head"><div><h2>نشاط المختبرين · آخر 7 أيام</h2><p>عدد المشاركات اليومية التي اجتازت حد الخصوصية.</p></div></div>
          <div className="dan2-chart" role="img" aria-label="مخطط النشاط اليومي">
            {chart.map(item => <div className="dan2-bar" key={item.key} title={item.label + ": " + item.count}>
              <span>{item.count || ""}</span><i style={{ height: (item.count / maxActivity * 100) + "%" }} /><small>{item.label}</small>
            </div>)}
          </div>
          <p className="dan2-privacy">لحماية هوية المختبرين، لا تظهر تفاصيل اليوم إلا عندما يساهم ثلاثة مختبرين مختلفين على الأقل. قد تكون بعض الأيام بلا بيانات ظاهرة.</p>
        </section>
        <section className="dan2-panel"><div className="dan2-panel-head"><div><h2>أداء التطبيقات</h2><p>مقارنة مجمّعة حسب التطبيق.</p></div></div>
          {apps.length ? <div className="dan2-apps">{apps.map(app => <article key={app.name}><div><b>{app.name}</b><span>{number(app.tests)} اختبار · {number(app.assignments)} مشاركة</span></div><strong>{app.assignments ? Math.round(app.completed / app.assignments * 100) : 0}%</strong><div className="dan2-track"><i style={{ width: (app.assignments ? app.completed / app.assignments * 100 : 0) + "%" }} /></div></article>)}</div> : <div className="dan2-empty">أنشئ اختباراتك الأولى لعرض أداء التطبيقات هنا.</div>}
        </section>
      </>}
    </section>
  </main>;
}
