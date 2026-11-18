import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { getDeveloperTestMonitoringSummary, listDeveloperTests, type DeveloperTestMonitoringSummary } from "../../../features/apps/apps-api";
import { isTesterWorkflowV2Enabled } from "../../../lib/supabase-v2";
import { useIdentity } from "../../../shared/auth/hooks/useIdentity";
import { Brand } from "../../../shared/components/Brand";
import "../styles/developer-test-results-v2.css";

type ResultRow=DeveloperTestMonitoringSummary;
const labels:Record<string,string>={draft:"مسودة",submitted:"قيد المراجعة",recruiting:"يستقبل المختبرين",ready:"جاهز",running:"جارٍ التنفيذ",at_risk:"يحتاج متابعة",completed:"مكتمل",failed:"مرفوض",cancelled:"ملغى"};

export default function DeveloperTestResultsPage(){
 const {user,rolesLoading}=useIdentity();
 const [rows,setRows]=useState<ResultRow[]>([]);
 const [loading,setLoading]=useState(true);
 const [refreshing,setRefreshing]=useState(false);
 const [error,setError]=useState("");
 const [query,setQuery]=useState("");
 const [testStatus,setTestStatus]=useState("all");
 const [sort,setSort]=useState("assignments");

 async function load(refresh=false){
  if(refresh)setRefreshing(true);else setLoading(true);
  setError("");
  try{
   if(!isTesterWorkflowV2Enabled)throw new Error("ميزة النتائج متاحة عند تفعيل مساحة V2 فقط.");
   if(!user?.id)throw new Error("تعذر التحقق من جلسة المطوّر.");
   const {data:tests,error:testError}=await listDeveloperTests(user.id);
   if(testError)throw testError;
   const owned=(tests??[]) as Array<{id:string}>;
   const summaries:ResultRow[]=[];
   for(let i=0;i<owned.length;i+=4){
    const result=await Promise.all(owned.slice(i,i+4).map(async test=>{
     const response=await getDeveloperTestMonitoringSummary(test.id);
     if(response.error)throw response.error;
     return response.data as ResultRow;
    }));
    summaries.push(...result.filter(Boolean));
   }
   setRows(summaries);
  }catch(reason){setRows([]);setError(reason instanceof Error?reason.message:"تعذر تحميل نتائج الاختبارات.");}
  finally{setLoading(false);setRefreshing(false);}
 }

 useEffect(()=>{if(rolesLoading)return;if(!user){setLoading(false);setError("سجّل الدخول للوصول إلى نتائج اختباراتك.");return;}void load();},[user?.id,rolesLoading]);

 const totals=useMemo(()=>rows.reduce((a,row)=>({
  assignments:a.assignments+row.metrics.totalAssignments,
  completed:a.completed+row.metrics.completed,
  failed:a.failed+row.metrics.failed,
  active:a.active+row.metrics.active,
  pending:a.pending+row.metrics.pending,
  feedback:a.feedback+row.metrics.feedbackCount,
  ratingPoints:a.ratingPoints+(row.metrics.averageRating??0)*row.metrics.ratingCount,
  rated:a.rated+row.metrics.ratingCount
 }),{assignments:0,completed:0,failed:0,active:0,pending:0,feedback:0,ratingPoints:0,rated:0}),[rows]);
 const rate=totals.assignments?Math.round(totals.completed/totals.assignments*100):0;
 const average=totals.rated?totals.ratingPoints/totals.rated:0;
 const visible=useMemo(()=>rows.filter(row=>(row.test.title+" "+row.test.appName).toLocaleLowerCase().includes(query.toLocaleLowerCase())&&(testStatus==="all"||row.test.status===testStatus)).sort((a,b)=>sort==="rating"?(b.metrics.averageRating??0)-(a.metrics.averageRating??0):sort==="completion"?b.metrics.completionRate-a.metrics.completionRate:b.metrics.totalAssignments-a.metrics.totalAssignments),[rows,query,testStatus,sort]);

 function exportCsv(){
  const data=[["الاختبار","التطبيق","الحالة","المشاركات","مكتمل","نشط","فشل","التقييمات","متوسط التقييم","نسبة الإكمال"],...visible.map(row=>[row.test.title,row.test.appName,labels[row.test.status]??row.test.status,row.metrics.totalAssignments,row.metrics.completed,row.metrics.active,row.metrics.failed,row.metrics.feedbackCount,row.metrics.averageRating??"",row.metrics.completionRate+"%"])];
  const csv=data.map(line=>line.map(v=>'"'+String(v??"").replaceAll('"','""')+'"').join(",")).join("\n");
  const url=URL.createObjectURL(new Blob(["\uFEFF"+csv],{type:"text/csv;charset=utf-8"}));
  const anchor=document.createElement("a");anchor.href=url;anchor.download="testdz-test-results-summary.csv";anchor.click();URL.revokeObjectURL(url);
 }

 return <main className="dres-shell" dir="rtl">
  <header className="dres-header"><Brand/><nav><Link to="/developer-dashboard">لوحة المطوّر</Link><Link to="/developer-tests">اختباراتي</Link><Link to="/developer/testers">مجتمع المختبرين</Link></nav></header>
  <section className="dres-content">
   <div className="dres-heading"><div><Link className="dres-back" to="/developer-tests">← العودة إلى الاختبارات</Link><span className="dres-eyebrow">مساحة المطوّر · النتائج</span><h1>نتائج الاختبارات</h1><p>راجع نسب الإكمال والتقييمات وجودة النتائج عبر اختباراتك، دون كشف سجلات المشاركين الفردية.</p></div><div className="dres-actions"><button onClick={()=>void load(true)} disabled={loading||refreshing}>{refreshing?"جارٍ التحديث…":"↻ تحديث"}</button><button className="primary" onClick={exportCsv} disabled={!visible.length}>تصدير CSV</button></div></div>
   {error&&<div className="dres-error" role="alert">{error}</div>}
   {loading||rolesLoading?<div className="dres-loading">جارٍ تحميل النتائج…</div>:<>
    <section className="dres-kpis">
     <article><small>إجمالي المشاركات</small><strong>{totals.assignments}</strong><span>عبر {rows.length} اختبار</span></article>
     <article><small>نسبة الإكمال</small><strong>{rate}%</strong><span>{totals.completed} مشاركة مكتملة</span></article>
     <article><small>مشاركات نشطة</small><strong>{totals.active}</strong><span>{totals.pending} بانتظار البدء</span></article>
     <article><small>متوسط التقييم</small><strong>{totals.rated?average.toFixed(2)+"/5":"—"}</strong><span>{totals.feedback} تقييمات مستلمة</span></article>
    </section>
    <section className="dres-breakdown">
     <article className="dres-panel"><h2>توزيع النتائج</h2>{[{label:"مكتمل",value:totals.completed,cls:"complete"},{label:"نشط",value:totals.active,cls:"active"},{label:"بانتظار البدء",value:totals.pending,cls:"pending"},{label:"فشل",value:totals.failed,cls:"failed"}].map(item=><div className="dres-bar-row" key={item.cls}><div><span>{item.label}</span><b>{item.value}</b></div><div className="dres-track"><i className={item.cls} style={{width:(totals.assignments?item.value/totals.assignments*100:0)+"%"}}/></div></div>)}</article>
     <article className="dres-panel"><h2>مؤشرات الجودة</h2><div className="dres-quality"><span>التقييمات المستلمة</span><b>{totals.feedback}</b></div><div className="dres-quality"><span>متوسط التقييم</span><b>{totals.rated?average.toFixed(2)+" / 5":"—"}</b></div><div className="dres-quality"><span>الاختبارات التي لديها مشاركات</span><b>{rows.filter(row=>row.metrics.totalAssignments>0).length}</b></div><div className="dres-quality"><span>الاختبارات المكتملة</span><b>{rows.filter(row=>row.test.status==="completed").length}</b></div></article>
    </section>
    <section className="dres-toolbar"><input value={query} onChange={e=>setQuery(e.target.value)} placeholder="ابحث باسم الاختبار أو التطبيق…" aria-label="البحث"/><select value={testStatus} onChange={e=>setTestStatus(e.target.value)} aria-label="حالة الاختبار"><option value="all">كل الحالات</option>{Object.entries(labels).map(([v,l])=><option key={v} value={v}>{l}</option>)}</select><select value={sort} onChange={e=>setSort(e.target.value)} aria-label="ترتيب النتائج"><option value="assignments">الأكثر مشاركة</option><option value="completion">أعلى إكمال</option><option value="rating">أعلى تقييم</option></select><span>{visible.length} اختبار</span></section>
    {visible.length?<section className="dres-table-wrap"><table><thead><tr><th>الاختبار</th><th>المشاركات</th><th>مكتمل</th><th>فشل</th><th>التقييمات</th><th>متوسط التقييم</th><th>الإكمال</th><th/></tr></thead><tbody>{visible.map(row=><tr key={row.test.id}><td><b>{row.test.title}</b><small>{row.test.appName} · {labels[row.test.status]??row.test.status}</small></td><td>{row.metrics.totalAssignments}</td><td>{row.metrics.completed}</td><td>{row.metrics.failed}</td><td>{row.metrics.feedbackCount}</td><td>{row.metrics.averageRating===null?"—":row.metrics.averageRating.toFixed(2)+"/5"}</td><td><div className="dres-progress"><i style={{width:row.metrics.completionRate+"%"}}/></div><small>{row.metrics.completionRate}%</small></td><td><Link to={"/developer/tests/"+row.test.id+"/monitoring"}>عرض التفاصيل ←</Link></td></tr>)}</tbody></table></section>:<section className="dres-empty"><h2>لا توجد نتائج مطابقة</h2><p>{rows.length?"جرّب تغيير البحث أو الفلاتر.":"ستظهر النتائج بعد بدء الاختبارات واستقبال المشاركات."}</p></section>}
    <section className="dres-privacy"><strong>🔒 بيانات مجمّعة فقط</strong><p>لا تتضمن هذه الصفحة أسماء المختبرين أو معرّفاتهم أو تفاصيل مشاركاتهم الفردية أو محتوى الملاحظات. يتم حساب المؤشرات من ملخصات آمنة خاصة بالاختبارات التي تملكها.</p></section>
   </>}
   <footer className="dres-footer">TestDZ · Build · Test · Improve</footer>
  </section>
 </main>;
}
