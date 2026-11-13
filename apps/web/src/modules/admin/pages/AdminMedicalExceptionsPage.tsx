import { useMemo, useState } from "react";
import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import "../styles/admin-dashboard.css";
import "../styles/admin-medical-exceptions.css";
import AdminSidebar from "../components/AdminSidebar";

type RequestStatus = "pending" | "approved" | "rejected";
type MedicalRequest = {
  id: string; tester: string; initials: string; assignment: string; test: string;
  submittedAt: string; dates: string[]; reason: string; status: RequestStatus;
  reviewer?: string; reviewedAt?: string; reviewNote?: string;
};

const initialRequests: MedicalRequest[] = [
  { id: "ME-001", tester: "سارة بن عيسى", initials: "سع", assignment: "TST-20251113-001", test: "اختبار واجهة المستخدم", submittedAt: "2025/11/13 14:30", dates: ["2025-11-13","2025-11-14"], reason: "أعاني من حالة صحية تستدعي الراحة الطبية لفترة قصيرة، وأرجو إعفائي من المشاركة خلال هذه الأيام.", status: "pending" },
  { id: "ME-002", tester: "أحمد شرياك", initials: "أش", assignment: "TST-20251112-004", test: "اختبار تطبيق التسوق", submittedAt: "2025/11/13 12:15", dates: ["2025-11-12"], reason: "أحتاج إلى فترة راحة قصيرة بسبب ظرف صحي مؤقت.", status: "pending" },
  { id: "ME-003", tester: "مريم دهشان", initials: "مد", assignment: "TST-20251110-002", test: "اختبار الأداء", submittedAt: "2025/11/12 16:20", dates: ["2025-11-08","2025-11-09"], reason: "تعرضت لوعكة صحية منعتني من إكمال أيام المشاركة المطلوبة.", status: "rejected", reviewer: "مشرف النظام", reviewedAt: "2025/11/12 17:10", reviewNote: "يرجى تقديم تواريخ ضمن فترة التكليف النشط." },
  { id: "ME-004", tester: "علي بن عمار", initials: "عب", assignment: "TST-20251109-006", test: "اختبار التوافق", submittedAt: "2025/11/12 11:45", dates: ["2025-11-11"], reason: "أطلب إعفاءً ليوم واحد بسبب موعد طبي.", status: "approved", reviewer: "مشرف النظام", reviewedAt: "2025/11/13 09:20", reviewNote: "تمت الموافقة على يوم الإعفاء." },
  { id: "ME-005", tester: "ياسمين بوزيان", initials: "يب", assignment: "TST-20251108-003", test: "اختبار الجودة", submittedAt: "2025/11/11 10:30", dates: ["2025-11-10"], reason: "ظرف صحي طارئ منعني من تسجيل الدخول.", status: "approved", reviewer: "مشرف النظام", reviewedAt: "2025/11/11 11:45", reviewNote: "تمت الموافقة." },
  { id: "ME-006", tester: "إكرام دهان", initials: "إد", assignment: "TST-20251107-005", test: "اختبار واجهة المستخدم", submittedAt: "2025/11/10 09:20", dates: ["2025-11-07","2025-11-08"], reason: "أحتاج إلى إعفاء مؤقت بسبب وعكة صحية.", status: "rejected", reviewer: "مشرف النظام", reviewedAt: "2025/11/10 12:00", reviewNote: "التواريخ غير متوافقة مع فترة التكليف." },
];

const statusText: Record<RequestStatus,string> = { pending: "قيد المراجعة", approved: "مقبول", rejected: "مرفوض" };
const formatDate = (value: string) => new Intl.DateTimeFormat("ar-DZ", { day: "2-digit", month: "2-digit", year: "numeric", timeZone: "Africa/Algiers" }).format(new Date(value + "T12:00:00"));

function Icon({ name, size = 18 }: { name: string; size?: number }) {
  const paths: Record<string, ReactNode> = {
    home: <><path d="m3 10 9-7 9 7M5 9v11h14V9M9 20v-6h6v6" /></>,
    users: <><circle cx="9" cy="8" r="3" /><path d="M3 20v-2a6 6 0 0 1 12 0v2m1-14a3 3 0 0 1 0 6m2 2a5 5 0 0 1 3 5v1" /></>,
    shield: <><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10Z" /><path d="m9 12 2 2 4-4" /></>,
    search: <><circle cx="10.8" cy="10.8" r="7" /><path d="m16 16 4 4" /></>,
    calendar: <><rect x="3" y="5" width="18" height="16" rx="2" /><path d="M7 3v4m10-4v4M3 10h18" /></>,
    file: <><path d="M6 2h8l5 5v15H6zM14 2v6h5M9 13h7M9 17h7" /></>,
    clock: <><circle cx="12" cy="12" r="9" /><path d="M12 7v5l4 2" /></>,
    check: <path d="m5 12 4 4L19 6" />,
    close: <path d="m6 6 12 12M18 6 6 18" />,
    back: <path d="M19 12H5m7-7-7 7 7 7" />,
    heart: <><path d="M20.8 8.7c0 5.2-8.8 11-8.8 11s-8.8-5.8-8.8-11a4.7 4.7 0 0 1 8.8-2.2 4.7 4.7 0 0 1 8.8 2.2Z" /><path d="M7 12h3l1.5-3 2 6 1.5-3H17" /></>,
    bell: <><path d="M18 9a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9M10 21h4" /></>,
  };
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{paths[name] ?? paths.file}</svg>;
}

export default function AdminMedicalExceptionsPage() {
  const [requests, setRequests] = useState(initialRequests);
  const [selectedId, setSelectedId] = useState(initialRequests[0].id);
  const [filter, setFilter] = useState<"all" | RequestStatus>("all");
  const [search, setSearch] = useState("");
  const [decision, setDecision] = useState<"approved" | "rejected" | null>(null);
  const [note, setNote] = useState("");
  const [notice, setNotice] = useState("");
  const selected = requests.find((request) => request.id === selectedId) ?? requests[0];
  const filtered = useMemo(() => requests.filter((request) => (filter === "all" || request.status === filter) && (request.tester.includes(search.trim()) || request.id.toLowerCase().includes(search.trim().toLowerCase()) || request.assignment.toLowerCase().includes(search.trim().toLowerCase()))), [requests, filter, search]);
  const counts = { all: requests.length, pending: requests.filter((r) => r.status === "pending").length, approved: requests.filter((r) => r.status === "approved").length, rejected: requests.filter((r) => r.status === "rejected").length };

  function saveDecision() {
    if (!decision || !selected || selected.status !== "pending") return;
    if (decision === "rejected" && !note.trim()) {
      setNotice("يرجى كتابة سبب الرفض قبل حفظ القرار.");
      return;
    }
    setRequests((current) => current.map((request) => request.id === selected.id ? { ...request, status: decision, reviewer: "المشرف الحالي (بيانات تجريبية)", reviewedAt: new Date().toLocaleString("ar-DZ"), reviewNote: note.trim() } : request));
    setNotice("تم تحديث حالة الطلب في المعاينة التجريبية فقط. لم يتم إرسال أي قرار إلى قاعدة البيانات.");
    setDecision(null);
  }

  return <main className="admin-dashboard admin-medical-page" dir="rtl">
    <aside className="admin-sidebar">
      <Link className="admin-brand" to="/admin"><span className="admin-brand-mark">✓</span><span>TestDZ<small>Build · Test · Improve</small></span></Link>
      <div className="admin-sidebar-label">الإدارة</div>
      <AdminSidebar activePath="/admin/medical-exceptions" />
      <div className="admin-sidebar-footer"><span className="admin-avatar">AD</span><div><strong>Admin</strong><small>مشرف المنصة</small></div><span className="admin-online" /></div>
    </aside>

    <section className="admin-main">
      <header className="admin-topbar">
        <label className="admin-search"><Icon name="search" /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="ابحث باسم المختبر أو رقم الطلب..." /></label>
        <div className="admin-top-actions"><button type="button" className="admin-icon-button" aria-label="الإشعارات"><Icon name="bell" /><span>3</span></button><div className="admin-user-menu"><span className="admin-avatar">AD</span><span>المشرف</span></div></div>
      </header>

      <div className="admin-content medical-content">
        <section className="admin-welcome medical-welcome">
          <div><span className="admin-eyebrow">TESTDZ · ADMIN WORKSPACE</span><h1>إدارة طلبات الاستثناء الطبي</h1><p>مراجعة طلبات المختبرين واتخاذ القرار المناسب مع توثيق كل إجراء.</p></div>
          <div className="admin-welcome-art" aria-hidden="true">✚　✦</div>
          <span className="medical-period"><Icon name="calendar" /> آخر 30 يوماً</span>
        </section>

        <div className="medical-demo-banner"><Icon name="shield" /> وضع المعاينة: جميع الطلبات والإحصائيات تجريبية. القرارات لا تُحفظ في قاعدة البيانات.</div>

        <section className="medical-stats" aria-label="ملخص الطلبات">
          <article><span className="medical-stat-icon blue"><Icon name="file" size={23} /></span><div><strong>{counts.all}</strong><small>إجمالي الطلبات</small></div></article>
          <article><span className="medical-stat-icon amber"><Icon name="clock" size={23} /></span><div><strong>{counts.pending}</strong><small>قيد المراجعة</small></div></article>
          <article><span className="medical-stat-icon green"><Icon name="check" size={23} /></span><div><strong>{counts.approved}</strong><small>تمت الموافقة</small></div></article>
          <article><span className="medical-stat-icon red"><Icon name="close" size={23} /></span><div><strong>{counts.rejected}</strong><small>تم الرفض</small></div></article>
        </section>

        {notice && <div className="medical-notice" role="status">{notice}<button type="button" onClick={() => setNotice("")} aria-label="إغلاق">×</button></div>}

        <section className="medical-workspace">
          <article className="admin-panel medical-list-panel">
            <div className="admin-panel-heading"><h2><Icon name="file" /> قائمة طلبات الاستثناء الطبي</h2><span className="admin-total-badge">{counts.pending} قيد الانتظار</span></div>
            <div className="medical-filters" role="group" aria-label="تصفية حسب الحالة">
              {(["all","pending","approved","rejected"] as const).map((value) => <button type="button" key={value} className={filter === value ? "selected" : ""} onClick={() => setFilter(value)}>{value === "all" ? "جميع الحالات" : statusText[value]} <b>{counts[value]}</b></button>)}
            </div>
            <div className="medical-table-wrap"><table className="medical-table"><thead><tr><th>المختبر</th><th>التواريخ المطلوبة</th><th>الحالة</th><th>التفاصيل</th></tr></thead><tbody>
              {filtered.map((request) => <tr key={request.id} className={selectedId === request.id ? "chosen" : ""}><td><span className="medical-tester-cell"><i>{request.initials}</i><span><strong>{request.tester}</strong><small>{request.id}</small></span></span></td><td>{request.dates.length} {request.dates.length === 1 ? "يوم" : "أيام"}</td><td><span className={"medical-status " + request.status}>{statusText[request.status]}</span></td><td><button className="medical-view-button" type="button" onClick={() => {setSelectedId(request.id);setDecision(null);setNote("");setNotice("");}}>عرض الطلب</button></td></tr>)}
              {filtered.length === 0 && <tr><td colSpan={4} className="medical-empty">لا توجد طلبات تطابق البحث أو التصفية.</td></tr>}
            </tbody></table></div>
            <div className="medical-list-footer"><span>عرض {filtered.length} من {requests.length} طلبات تجريبية</span><Link to="/admin">العودة إلى لوحة التحكم <Icon name="back" size={14} /></Link></div>
          </article>

          <article className="admin-panel medical-detail-panel">
            <div className="admin-panel-heading"><h2><Icon name="file" /> تفاصيل طلب الاستثناء</h2><span className={"medical-status " + selected.status}>{statusText[selected.status]}</span></div>
            <div className="medical-profile"><span className="medical-profile-avatar">{selected.initials}</span><div><strong>{selected.tester}</strong><small>مختبر · {selected.assignment}</small><small>{selected.test}</small></div></div>
            <div className="medical-meta-grid"><div><small>تاريخ الطلب</small><strong>{selected.submittedAt}</strong></div><div><small>المدة المطلوبة</small><strong>{selected.dates.length} يوم</strong></div></div>
            <section className="medical-detail-block"><h3><Icon name="calendar" /> تواريخ الإعفاء المطلوبة</h3><div className="medical-date-chips">{selected.dates.map((date) => <span key={date}>{formatDate(date)}</span>)}</div></section>
            <section className="medical-detail-block"><h3><Icon name="file" /> سبب الطلب من المختبر</h3><blockquote>{selected.reason}</blockquote></section>
            {selected.status === "pending" ? <>
              <section className="medical-decision"><h3>قرار المشرف</h3><div className="medical-decision-options"><button type="button" className={decision === "approved" ? "approve active" : "approve"} onClick={() => {setDecision("approved");setNotice("");}}> <Icon name="check" /> موافقة</button><button type="button" className={decision === "rejected" ? "reject active" : "reject"} onClick={() => {setDecision("rejected");setNotice("");}}> <Icon name="close" /> رفض</button></div><label htmlFor="medical-review-note">ملاحظة المشرف {decision === "rejected" ? "(مطلوبة عند الرفض)" : "(اختيارية)"}</label><textarea id="medical-review-note" maxLength={2000} value={note} onChange={(event) => setNote(event.target.value)} placeholder="اكتب ملاحظة توضح القرار..." /><small className="medical-char-count">{note.length}/2000</small></section>
              <button type="button" className="medical-save-button" disabled={!decision} onClick={saveDecision}>حفظ القرار التجريبي <Icon name="check" /></button>
            </> : <section className="medical-reviewed"><strong>تمت مراجعة هذا الطلب</strong><span>المراجع: {selected.reviewer}</span><span>التاريخ: {selected.reviewedAt}</span>{selected.reviewNote && <p>{selected.reviewNote}</p>}</section>}
            <p className="medical-policy-note"><Icon name="shield" /> الموافقة تسجل أيام الإعفاء وتمدد مهلة التكليف داخلياً. هذه الأيام لا تُحتسب كأيام تسجيل في Google Play ولا تمنح نقاط تسجيل يومي.</p>
          </article>
        </section>

        <section className="admin-panel medical-audit-panel"><div className="admin-panel-heading"><h2><Icon name="clock" /> سجل القرارات الأخيرة</h2><span className="admin-panel-link">سجل تجريبي</span></div><div className="medical-audit-items">{requests.filter((request) => request.status !== "pending").slice(0,3).map((request) => <div key={request.id}><span className={"medical-audit-icon " + request.status}><Icon name={request.status === "approved" ? "check" : "close"} /></span><span><strong>{request.status === "approved" ? "تمت الموافقة على الطلب" : "تم رفض الطلب"} · {request.tester}</strong><small>{request.reviewedAt}</small></span></div>)}</div></section>
      </div>
    </section>
  </main>;
}
