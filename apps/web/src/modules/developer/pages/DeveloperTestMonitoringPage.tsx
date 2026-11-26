import { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import {
  getDeveloperTestMonitoringSummary,
  type DeveloperTestMonitoringSummary,
} from "../../../features/apps/apps-api";
import { Brand } from "../../../shared/components/Brand";
import { isTesterWorkflowV2Enabled } from "../../../lib/supabase-v2";
import "../styles/developer-test-monitoring-v2.css";

const statusLabels: Record<string, string> = {
  draft: "مسودة",
  submitted: "قيد المراجعة",
  recruiting: "يستقبل المختبرين",
  ready: "جاهز للبدء",
  running: "جارٍ التنفيذ",
  at_risk: "يحتاج متابعة",
  completed: "مكتمل",
  failed: "مرفوض",
  cancelled: "ملغى",
};

const dateLabel = (value: string | null | undefined) => {
  if (!value) return "غير محدد";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "غير محدد" : date.toLocaleDateString("ar-DZ", { year: "numeric", month: "short", day: "numeric" });
};

function MetricCard({ label, value, detail, symbol }: { label: string; value: string | number; detail: string; symbol: string }) {
  return <article className="dtm2-metric">
    <span className="dtm2-metric-icon" aria-hidden="true">{symbol}</span>
    <small>{label}</small>
    <strong>{value}</strong>
    <span>{detail}</span>
  </article>;
}

export default function DeveloperTestMonitoringPage() {
  const { id = "" } = useParams();
  const [summary, setSummary] = useState<DeveloperTestMonitoringSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");

  async function load(isRefresh = false) {
    if (isRefresh) setRefreshing(true);
    else setLoading(true);
    setError("");
    try {
      const { data, error: requestError } = await getDeveloperTestMonitoringSummary(id);
      if (requestError || !data) {
        setSummary(null);
        setError(requestError?.message === "TEST_NOT_FOUND_OR_NOT_OWNED"
          ? "الاختبار غير موجود أو لا تملك صلاحية الوصول إليه."
          : "تعذر تحميل بيانات المراقبة. حاول تحديث الصفحة.");
      } else {
        setSummary(data as unknown as DeveloperTestMonitoringSummary);
      }
    } catch {
      setError("حدث خطأ أثناء تحميل بيانات المراقبة.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  useEffect(() => {
    let alive = true;
    async function initialLoad() {
      if (!isTesterWorkflowV2Enabled) {
        setError("ميزة V2 غير مفعّلة في هذا الإصدار.");
        setLoading(false);
        return;
      }
      try {
        const { data, error: requestError } = await getDeveloperTestMonitoringSummary(id);
        if (!alive) return;
        if (requestError || !data) {
          setError("الاختبار غير موجود أو تعذر تحميل بيانات المراقبة.");
        } else {
          setSummary(data as unknown as DeveloperTestMonitoringSummary);
        }
      } catch {
        if (alive) setError("حدث خطأ أثناء تحميل بيانات المراقبة.");
      } finally {
        if (alive) setLoading(false);
      }
    }
    if (!id) {
      setError("معرّف الاختبار غير صالح.");
      setLoading(false);
    } else {
      void initialLoad();
    }
    return () => { alive = false; };
  }, [id]);

  const metrics = summary?.metrics;
  const metricsSuppressed = metrics?.suppressed === true;
  const visibleMetrics = metrics && !metrics.suppressed ? metrics : null;
  const daily = useMemo(() => {
    const indexed = new Map((summary?.dailyActivity ?? []).map(item => [item.date, item.count]));
    return Array.from({ length: 7 }, (_, index) => {
      const date = new Date();
      date.setDate(date.getDate() - (6 - index));
      const key = date.getFullYear() + "-" + String(date.getMonth() + 1).padStart(2, "0") + "-" + String(date.getDate()).padStart(2, "0");
      return { date: key, label: date.toLocaleDateString("ar-DZ", { weekday: "short" }), count: indexed.get(key) ?? 0 };
    });
  }, [summary]);
  const maxDaily = Math.max(1, ...daily.map(item => item.count));
  const statuses = [
    { key: "completed", label: "مكتمل", value: visibleMetrics?.completed ?? 0 },
    { key: "active", label: "نشط", value: visibleMetrics?.active ?? 0 },
    { key: "pending", label: "بانتظار البدء", value: visibleMetrics?.pending ?? 0 },
    { key: "failed", label: "فشل", value: visibleMetrics?.failed ?? 0 },
    { key: "withdrawn", label: "منسحب", value: visibleMetrics?.withdrawn ?? 0 },
    { key: "rejected", label: "مرفوض", value: visibleMetrics?.rejected ?? 0 },
  ];
  const exportSummary = () => {
    if (!summary || metricsSuppressed) return;
    const rows = [
      ["المؤشر", "القيمة"],
      ["الاختبار", summary.test.title],
      ["حالة الاختبار", statusLabels[summary.test.status] ?? summary.test.status],
      ["إجمالي المشاركات", visibleMetrics?.totalAssignments ?? 0],
      ["عدد المختبرين (إجمالي)", visibleMetrics?.uniqueTesters ?? 0],
      ["مكتمل", visibleMetrics?.completed ?? 0],
      ["نشط", visibleMetrics?.active ?? 0],
      ["بانتظار البدء", visibleMetrics?.pending ?? 0],
      ["نسبة الإكمال", (visibleMetrics?.completionRate ?? 0) + "%"],
      ["عمليات تسجيل النشاط", visibleMetrics?.checkins ?? 0],
      ["التقييمات", visibleMetrics?.feedbackCount ?? 0],
      ["متوسط التقييم", visibleMetrics?.averageRating ?? "—"],
    ];
    const csv = rows.map(row => row.map(value => '"' + String(value).replaceAll('"', '""') + '"').join(",")).join("\n");
    const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = "testdz-monitoring-summary.csv";
    anchor.click();
    URL.revokeObjectURL(url);
  };

  return <main className="dtm2-shell" dir="rtl">
    <header className="dtm2-topbar">
      <Brand />
      <nav><Link to="/developer-dashboard">مساحة المطور</Link><Link to="/developer-tests">اختباراتي</Link><Link to="/developer/testers">مجتمع المختبرين</Link><Link to="/developer-test-results">النتائج</Link><Link to="/apps">تطبيقاتي</Link></nav>
    </header>
    <div className="dtm2-content">
      <div className="dtm2-heading-row">
        <div>
          <Link className="dtm2-back" to="/developer-tests">← العودة إلى اختباراتي</Link>
          <p className="dtm2-eyebrow">مساحة المطور · متابعة الاختبارات</p>
          <h1>تفاصيل الاختبار ومراقبته</h1>
          <p className="dtm2-subtitle">تابع التقدم والنشاط ومؤشرات الجودة من خلال بيانات مجمّعة تحافظ على خصوصية المختبرين.</p>
        </div>
        <div className="dtm2-actions">
          <button type="button" onClick={() => void load(true)} disabled={loading || refreshing}>{refreshing ? "جارٍ التحديث…" : "↻ تحديث"}</button>
          <button type="button" className="primary" onClick={exportSummary} disabled={!summary || metricsSuppressed}>تصدير الملخص CSV</button>
        </div>
      </div>

      {error && <div className="dtm2-error" role="alert">{error}</div>}
      {loading && <div className="dtm2-loading">جارٍ تحميل بيانات الاختبار…</div>}
      {summary && <>
        <section className="dtm2-test-hero">
          <div className="dtm2-app-icon">{summary.test.appIconUrl ? <img src={summary.test.appIconUrl} alt="" /> : "▦"}</div>
          <div className="dtm2-test-info">
            <span>{summary.test.appName}</span>
            <h2>{summary.test.title}</h2>
            <p>{summary.test.shortSummary || summary.test.description}</p>
            <div className="dtm2-meta"><span>الحالة: {statusLabels[summary.test.status] ?? summary.test.status}</span><span>النوع: {summary.test.testType}</span><span>الفترة: {dateLabel(summary.test.startDate)} – {dateLabel(summary.test.endDate)}</span></div>
          </div>
          <span className={"dtm2-status status-" + summary.test.status}>{statusLabels[summary.test.status] ?? summary.test.status}</span>
        </section>

        {metricsSuppressed ? <section className="dtm2-privacy-suppressed" role="status"><strong>تم إخفاء مؤشرات هذا الاختبار لحماية خصوصية المختبرين.</strong><p>تُعرض الإحصاءات الإجمالية فقط عندما يشارك ثلاثة مختبرين مختلفين على الأقل. لن نعرض أرقاماً لمجموعة صغيرة.</p></section> : <>
        <section className="dtm2-metrics-grid">
          <MetricCard label="إجمالي المشاركات" value={visibleMetrics?.totalAssignments ?? 0} detail={"الهدف: " + summary.test.minTesters + " مختبراً"} symbol="♙" />
          <MetricCard label="نسبة الإكمال" value={(visibleMetrics?.completionRate ?? 0) + "%"} detail={(visibleMetrics?.completed ?? 0) + " مشاركات مكتملة"} symbol="✓" />
          <MetricCard label="المشاركات النشطة" value={visibleMetrics?.active ?? 0} detail={(visibleMetrics?.pending ?? 0) + " بانتظار البدء"} symbol="◷" />
          <MetricCard label="متوسط التقييم" value={visibleMetrics?.averageRating == null ? "—" : visibleMetrics.averageRating + "/5"} detail={(visibleMetrics?.feedbackCount ?? 0) + " تقييمات مستلمة"} symbol="★" />
        </section>

        <section className="dtm2-panels">
          <article className="dtm2-panel">
            <div className="dtm2-panel-heading"><h3>توزيع حالات المشاركات</h3><span>{visibleMetrics?.totalAssignments ?? 0} إجمالي</span></div>
            {statuses.map(item => {
              const width = visibleMetrics?.totalAssignments ? item.value / visibleMetrics.totalAssignments * 100 : 0;
              return <div className="dtm2-status-row" key={item.key}>
                <div><span>{item.label}</span><b>{item.value}</b></div>
                <div className="dtm2-track"><i className={"fill-" + item.key} style={{ width: width + "%" }} /></div>
              </div>;
            })}
            <p className="dtm2-footnote">الأرقام تمثل إجماليات للحملة، ولا تعرض حالة أي مختبر على حدة.</p>
          </article>

          <article className="dtm2-panel">
            <div className="dtm2-panel-heading"><h3>النشاط خلال آخر 7 أيام</h3><span>تجميع يومي</span></div>
            <div className="dtm2-bars">
              {daily.map(item => <div className="dtm2-bar-col" key={item.date}>
                <strong>{item.count || "—"}</strong>
                <div className="dtm2-bar-track"><i style={{ height: Math.max(item.count ? 8 : 0, item.count / maxDaily * 100) + "%" }} /></div>
                <small>{item.label}</small>
              </div>)}
            </div>
            <p className="dtm2-footnote">لا يظهر اليوم في الرسم إلا إذا شارك فيه ثلاثة مختبرين مختلفين على الأقل.</p>
          </article>
        </section>

        <section className="dtm2-bottom-grid">
          <article className="dtm2-panel">
            <div className="dtm2-panel-heading"><h3>مؤشرات الجودة</h3></div>
            <div className="dtm2-quality-row"><span>تسجيلات النشاط</span><b>{visibleMetrics?.checkins ?? 0}</b></div>
            <div className="dtm2-quality-row"><span>التقييمات المستلمة</span><b>{visibleMetrics?.feedbackCount ?? 0}</b></div>
            <div className="dtm2-quality-row"><span>تقييمات بانتظار المراجعة</span><b>{visibleMetrics?.feedbackPending ?? 0}</b></div>
            <div className="dtm2-quality-row"><span>تقييمات مقبولة</span><b>{visibleMetrics?.feedbackAccepted ?? 0}</b></div>
            <div className="dtm2-quality-row"><span>تقييمات مرفوضة</span><b>{visibleMetrics?.feedbackRejected ?? 0}</b></div>
          </article>
          <article className="dtm2-panel">
            <div className="dtm2-panel-heading"><h3>إعدادات الاختبار</h3></div>
            <div className="dtm2-quality-row"><span>الأولوية</span><b>{String(summary.configuration.priority ?? "—")}</b></div>
            <div className="dtm2-quality-row"><span>هدف الاختبار</span><b>{String(summary.configuration.objective ?? "—")}</b></div>
            <div className="dtm2-quality-row"><span>إصدار Android</span><b>{String(summary.configuration.androidVersion ?? "—")}</b></div>
            <div className="dtm2-quality-row"><span>مدة الحملة</span><b>{String(summary.configuration.durationDays ?? summary.test.durationMinutes ?? "—")}</b></div>
            <div className="dtm2-quality-row"><span>معيار النجاح</span><b>{String(summary.configuration.successCriteria ?? "—")}</b></div>
          </article>
        </section>

        <section className="dtm2-privacy-note"><strong>🔒 خصوصية المختبرين محفوظة</strong><p>تعرض هذه الصفحة إحصاءات مجمّعة فقط. لا تتوفر للمطور معرّفات المختبرين أو سجلاتهم الفردية أو ملاحظاتهم الخاصة أو مسارات ملفاتهم.</p></section>
        </>}
      </>}
      <footer className="dtm2-footer">TestDZ · Build · Test · Improve</footer>
    </div>
  </main>;
}
