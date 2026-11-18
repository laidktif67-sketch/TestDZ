import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { getDeveloperTestMonitoringSummary, listDeveloperTests, type DeveloperTestMonitoringSummary } from "../../../features/apps/apps-api";
import { isTesterWorkflowV2Enabled } from "../../../lib/supabase-v2";
import { useIdentity } from "../../../shared/auth/hooks/useIdentity";
import { Brand } from "../../../shared/components/Brand";
import "../styles/developer-testers-v2.css";

type TesterCampaign = DeveloperTestMonitoringSummary;

const statusLabels: Record<string,string> = {
  draft:"مسودة", submitted:"قيد المراجعة", recruiting:"يستقبل المختبرين",
  ready:"جاهز", running:"جارٍ التنفيذ", at_risk:"يحتاج متابعة",
  completed:"مكتمل", failed:"مرفوض", cancelled:"ملغى"
};

function Stat({label,value,detail,symbol}:{label:string;value:string|number;detail:string;symbol:string}) {
  return <article className="dtv2-stat"><span aria-hidden="true">{symbol}</span><small>{label}</small><strong>{value}</strong><em>{detail}</em></article>;
}

export default function DeveloperTestersPage() {
  const { user, rolesLoading, rolesError, refreshRoles } = useIdentity();
  const [rows,setRows]=useState<TesterCampaign[]>([]);
  const [loading,setLoading]=useState(true);
  const [refreshing,setRefreshing]=useState(false);
  const [error,setError]=useState("");
  const [query,setQuery]=useState("");
  const [status,setStatus]=useState("all");

  async function load(isRefresh=false) {
    if(isRefresh)setRefreshing(true);else setLoading(true);
    setError("");
    try {
      if(!isTesterWorkflowV2Enabled) {
        setRows([]);
        setError("إدارة مجتمع المختبرين متاحة عند تفعيل مساحة V2 فقط.");
        return;
      }
      if(!user?.id) {
        setRows([]);
        setError("تعذر التحقق من جلسة المطوّر.");
        return;
      }
      const {data:tests,error:testError}=await listDeveloperTests(user.id);
      if(testError)throw testError;
      const owned=(tests??[]) as Array<{id:string}>;
      const summaries:TesterCampaign[]=[];
      for(let i=0;i<owned.length;i+=4) {
        const batch=owned.slice(i,i+4);
        const results=await Promise.all(batch.map(async test=>{
          const result=await getDeveloperTestMonitoringSummary(test.id);
          if(result.error)throw result.error;
          return result.data as TesterCampaign;
        }));
        summaries.push(...results.filter(Boolean));
      }
      setRows(summaries);
    } catch(reason) {
      setRows([]);
      setError(reason instanceof Error?reason.message:"تعذر تحميل إحصاءات مجتمع المختبرين.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  useEffect(()=>{
    if(rolesLoading)return;
    if(!user){setLoading(false);setError("سجّل الدخول للوصول إلى مساحة المطوّر.");return;}
    void load();
  },[user?.id,rolesLoading]);

  const visible=useMemo(()=>rows.filter(row=>{
    const matchesQuery=(row.test.title+" "+row.test.appName).toLocaleLowerCase().includes(query.toLocaleLowerCase());
    return matchesQuery&&(status==="all"||row.test.status===status);
  }),[rows,query,status]);

  const totals=useMemo(()=>rows.reduce((sum,row)=>({
    campaigns:sum.campaigns+1,
    assignments:sum.assignments+row.metrics.totalAssignments,
    participants:sum.participants+row.metrics.uniqueTesters,
    active:sum.active+row.metrics.active,
    completed:sum.completed+row.metrics.completed,
    pending:sum.pending+row.metrics.pending
  }),{campaigns:0,assignments:0,participants:0,active:0,completed:0,pending:0}),[rows]);
  const completion=totals.assignments?Math.round(totals.completed/totals.assignments*100):0;

  function exportCsv(){
    const lines=[
      ["الاختبار","التطبيق","حالة الاختبار","عدد المشاركين في الاختبار","إجمالي المشاركات","نشط","بانتظار البدء","مكتمل","نسبة الإكمال"],
      ...visible.map(row=>[
        row.test.title,row.test.appName,statusLabels[row.test.status]??row.test.status,
        row.metrics.uniqueTesters,row.metrics.totalAssignments,row.metrics.active,row.metrics.pending,
        row.metrics.completed,row.metrics.completionRate+"%"
      ])
    ];
    const csv=lines.map(line=>line.map(value=>'"'+String(value??"").replaceAll('"','""')+'"').join(",")).join("\n");
    const blob=new Blob(["\uFEFF"+csv],{type:"text/csv;charset=utf-8"});
    const url=URL.createObjectURL(blob);
    const anchor=document.createElement("a");
    anchor.href=url;anchor.download="testdz-tester-community-summary.csv";anchor.click();
    URL.revokeObjectURL(url);
  }

  if(rolesError)return <main className="dtv2-shell"><section className="dtv2-state"><h1>تعذر التحقق من الصلاحيات</h1><p>لم نغيّر صلاحيات حسابك. أعد المحاولة.</p><button onClick={()=>void refreshRoles()}>إعادة المحاولة</button></section></main>;

  return <main className="dtv2-shell" dir="rtl">
    <header className="dtv2-header"><Brand/><nav><Link to="/developer-dashboard">لوحة المطوّر</Link><Link to="/developer-tests">اختباراتي</Link><Link to="/apps">تطبيقاتي</Link></nav></header>
    <section className="dtv2-content">
      <div className="dtv2-heading">
        <div><Link className="dtv2-back" to="/developer-tests">← العودة إلى الاختبارات</Link><span className="dtv2-eyebrow">مساحة المطوّر · مجتمع المختبرين</span><h1>متابعة مجتمع المختبرين</h1><p>راقب حجم المشاركة والتقدم لكل اختبار باستخدام إحصاءات مجمّعة تحافظ على خصوصية المشاركين.</p></div>
        <div className="dtv2-actions"><button type="button" onClick={()=>void load(true)} disabled={loading||refreshing}>{refreshing?"جارٍ التحديث…":"↻ تحديث"}</button><button type="button" className="primary" onClick={exportCsv} disabled={!visible.length}>تصدير الملخص CSV</button></div>
      </div>

      {error&&<div className="dtv2-error" role="alert">{error}</div>}
      {rolesLoading||loading?<div className="dtv2-loading">جارٍ تحميل إحصاءات الاختبارات…</div>:<>
        <section className="dtv2-stats">
          <Stat label="الاختبارات" value={totals.campaigns} detail="اختبارات تملكها" symbol="▦"/>
          <Stat label="إجمالي المشاركات" value={totals.assignments} detail="عبر اختباراتك" symbol="♙"/>
          <Stat label="المشاركات النشطة" value={totals.active} detail={totals.pending+" بانتظار البدء"} symbol="◷"/>
          <Stat label="نسبة الإكمال" value={completion+"%"} detail={totals.completed+" مشاركة مكتملة"} symbol="✓"/>
        </section>
        <section className="dtv2-toolbar">
          <label className="dtv2-search"><span aria-hidden="true">⌕</span><input value={query} onChange={e=>setQuery(e.target.value)} placeholder="ابحث باسم الاختبار أو التطبيق…" aria-label="البحث"/></label>
          <select value={status} onChange={e=>setStatus(e.target.value)} aria-label="تصفية حالة الاختبار">
            <option value="all">كل الحالات</option>
            {Object.entries(statusLabels).map(([value,label])=><option key={value} value={value}>{label}</option>)}
          </select>
          <span>{visible.length} من {rows.length} اختبار</span>
        </section>
        {visible.length===0?<section className="dtv2-empty"><span>♙</span><h2>{rows.length?"لا توجد نتائج مطابقة":"لا توجد اختبارات بعد"}</h2><p>{rows.length?"غيّر كلمات البحث أو عامل التصفية.":"أنشئ اختباراً وانشره لبدء استقبال المشاركات."}</p><Link to="/developer/tests/new">إنشاء اختبار جديد</Link></section>:
          <section className="dtv2-table-wrap"><table className="dtv2-table"><thead><tr><th>الاختبار والتطبيق</th><th>المشاركون</th><th>إجمالي المشاركات</th><th>نشط</th><th>مكتمل</th><th>نسبة الإكمال</th><th>الحالة</th><th/></tr></thead><tbody>
            {visible.map(row=><tr key={row.test.id}>
              <td><strong>{row.test.title}</strong><small>{row.test.appName}</small></td>
              <td>{row.metrics.uniqueTesters}</td><td>{row.metrics.totalAssignments}</td><td>{row.metrics.active}</td><td>{row.metrics.completed}</td>
              <td><div className="dtv2-progress"><i style={{width:row.metrics.completionRate+"%"}}/></div><small>{row.metrics.completionRate}%</small></td>
              <td><span className={"dtv2-status status-"+row.test.status}>{statusLabels[row.test.status]??row.test.status}</span></td>
              <td><Link to={"/developer/tests/"+row.test.id+"/monitoring"}>التفاصيل ←</Link></td>
            </tr>)}
          </tbody></table></section>
        }
        <section className="dtv2-privacy"><strong>🔒 خصوصية المختبرين</strong><p>هذه الصفحة لا تعرض أسماء المختبرين أو صورهم أو عناوينهم أو معرّفاتهم أو سجلاتهم الفردية. الأرقام هي إحصاءات مجمّعة لكل اختبار، ولا تمثل عدداً فريداً على مستوى جميع الاختبارات لأن الشخص نفسه قد يشارك في أكثر من اختبار.</p></section>
      </>}
      <footer className="dtv2-footer">TestDZ · Build · Test · Improve</footer>
    </section>
  </main>;
}
