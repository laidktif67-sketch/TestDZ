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

const statusLabels: Record<string, string> = {
  draft: "مسودة", submitted: "قيد المراجعة", recruiting: "يستقبل المختبرين",
  ready: "جاهز", running: "جارٍ التنفيذ", at_risk: "يحتاج متابعة",
  completed: "مكتمل", failed: "مرفوض", cancelled: "ملغى",
};

function isSuppressed(row: ResultRow) {
  return row.metrics.suppressed === true;
}

function metricValue(row: ResultRow, key: "totalAssignments" | "completionRate" | "averageRating") {
  if (isSuppressed(row)) return null;
  return row.metrics[key];
}

export default function DeveloperTestResultsPage() {
  const { user, rolesLoading } = useIdentity();
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
      if (!isTesterWorkflowV2Enabled) throw new Error("نتائج الاختبارات متاحة عند تفعيل مساحة V2 فقط.");
      if (!user?.id) throw new Error("سجّل الدخول للوصول إلى نتائج اختباراتك.");
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
      setError(reason instanceof Error ? reason.message : "تعذر تحميل نتائج الاختبارات.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [user?.id]);

  useEffect(() => {
    if (rolesLoading) return;
    if (!user) {
      setLoading(false);
      setError("سجّل الدخول للوصول إلى نتائج اختباراتك.");
      return;
    }
    void load();
  }, [user, rolesLoading, load]);

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

  const suppressedCount = visible.filter(isSuppressed).length;
  const exportCsv = () => {
    const exportable = visible.filter(row => !isSuppressed(row));
    if (!exportable.length) return;
    const data = [
      ["الاختبار", "التطبيق", "الحالة", "المشاركات", "مكتمل", "نشط", "فشل", "الملاحظات", "التقييمات ذات النجوم", "متوسط التقييم", "نسبة الإكمال"],
      ...exportable.map(row => {
        if (isSuppressed(row)) return [];
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

  return <main className="dres-shell" dir="rtl">
    <header className="dres-header"><Brand /><nav>
      <Link to="/developer-dashboard">لوحة المطوّر</Link>
      <Link to="/developer-tests">اختباراتي</Link>
      <Link to="/developer/testers">مجتمع المختبرين</Link>
    </nav></header>
    <section className="dres-content">
      <div className="dres-heading">
        <div><Link className="dres-back" to="/developer-tests">← العودة إلى الاختبارات</Link>
          <span className="dres-eyebrow">مساحة المطوّر · النتائج</span>
          <h1>نتائج الاختبارات</h1>
          <p>ملخصات مجمّعة لكل اختبار تملكه، دون عرض بيانات المشاركين الفردية.</p>
        </div>
        <div className="dres-actions">
          <button onClick={() => void load(true)} disabled={loading || refreshing}>{refreshing ? "جارٍ التحديث…" : "↻ تحديث"}</button>
          <button className="primary" onClick={exportCsv} disabled={!visible.some(row => !isSuppressed(row))}>تصدير CSV</button>
        </div>
      </div>
      {error && <div className="dres-error" role="alert">{error}</div>}
      {loading || rolesLoading ? <div className="dres-loading">جارٍ تحميل النتائج…</div> : <>
        <section className="dres-toolbar">
          <input value={query} onChange={event => setQuery(event.target.value)} placeholder="ابحث باسم الاختبار أو التطبيق…" aria-label="البحث" />
          <select value={status} onChange={event => setStatus(event.target.value)} aria-label="حالة الاختبار">
            <option value="all">كل الحالات</option>
            {Object.entries(statusLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
          </select>
          <select value={sort} onChange={event => setSort(event.target.value)} aria-label="ترتيب النتائج">
            <option value="assignments">الأكثر مشاركة</option><option value="completion">أعلى إكمال</option><option value="rating">أعلى تقييم</option>
          </select>
          <span>{visible.length} اختبار</span>
        </section>
        {suppressedCount > 0 && <p className="dres-privacy-note" role="status">{suppressedCount} اختبار مخفي المؤشرات حالياً لأن عدد المختبرين لا يحقق حد الخصوصية. لن تظهر أرقامه ولن تدخل في ملف التصدير.</p>}
        {visible.length ? <section className="dres-table-wrap"><table>
          <thead><tr><th>الاختبار</th><th>المشاركات</th><th>مكتمل</th><th>فشل</th><th>الملاحظات</th><th>التقييمات ذات النجوم</th><th>متوسط التقييم</th><th>الإكمال</th><th /></tr></thead>
          <tbody>{visible.map(row => <tr key={row.test.id}>
            <td><b>{row.test.title}</b><small>{row.test.appName} · {statusLabels[row.test.status] ?? row.test.status}</small></td>
            {isSuppressed(row) ? <td colSpan={7}><span className="dres-suppressed">مؤشرات مخفية لحماية خصوصية المختبرين</span></td> : <>
              <td>{row.metrics.totalAssignments}</td><td>{row.metrics.completed}</td><td>{row.metrics.failed}</td>
              <td>{row.metrics.feedbackCount}</td><td>{row.metrics.ratingCount}</td>
              <td>{row.metrics.averageRating === null ? "—" : row.metrics.averageRating.toFixed(2) + "/5"}</td>
              <td><div className="dres-progress"><i style={{ width: row.metrics.completionRate + "%" }} /></div><small>{row.metrics.completionRate}%</small></td>
            </>}
            <td><Link to={"/developer/tests/" + row.test.id + "/monitoring"}>عرض التفاصيل ←</Link></td>
          </tr>)}</tbody>
        </table></section> : <section className="dres-empty"><h2>لا توجد نتائج مطابقة</h2><p>{rows.length ? "جرّب تغيير البحث أو الفلاتر." : "ستظهر النتائج بعد بدء الاختبارات واستقبال المشاركات."}</p></section>}
        <section className="dres-privacy"><strong>🔒 بيانات مجمّعة فقط</strong><p>لا تعرض هذه الصفحة أسماء المختبرين أو معرّفاتهم أو تفاصيل مشاركاتهم الفردية أو محتوى الملاحظات. تُحترم حالة إخفاء المؤشرات لكل اختبار على حدة.</p></section>
      </>}
      <footer className="dres-footer">TestDZ · Build · Test · Improve</footer>
    </section>
  </main>;
}
