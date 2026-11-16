import { useCallback, useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { supabase } from "../../../lib/supabase";
import { isTesterWorkflowV2Enabled } from "../../../lib/supabase-v2";
import { getAdminReviewQueue, reviewDeveloperApp, reviewDeveloperTest, type AdminReviewApp, type AdminReviewTest } from "../../../features/apps/apps-api";
import { Brand } from "../../../shared/components/Brand";


export default function DeveloperReviewQueuePage(){
 const navigate=useNavigate();
 const [apps,setApps]=useState<AdminReviewApp[]>([]);
 const [tests,setTests]=useState<AdminReviewTest[]>([]);
 const [notes,setNotes]=useState<Record<string,string>>({});
 const [loading,setLoading]=useState(true);
 const [busyId,setBusyId]=useState("");
 const [error,setError]=useState("");
 const [notice,setNotice]=useState("");

 const load=useCallback(async()=>{
  setLoading(true);setError("");
  try {
   const {apps:appResult,tests:testResult}=await getAdminReviewQueue();
   if(appResult.error||testResult.error)setError("تعذر تحميل طلبات المراجعة. تحقق من صلاحيات الإدارة والاتصال.");
   else{setApps((appResult.data??[]) as AdminReviewApp[]);setTests((testResult.data??[]) as AdminReviewTest[]);}
  } catch {
   setError("تعذر تحميل طلبات المراجعة. تحقق من صلاحيات الإدارة والاتصال.");
  }
  setLoading(false);
 },[]);

 useEffect(()=>{
  if(!isTesterWorkflowV2Enabled){setLoading(false);return;}
  if(!supabase){setError("اتصال قاعدة البيانات غير متاح.");setLoading(false);return;}
  let alive=true;
  void supabase.auth.getUser().then(({data,error:authError})=>{
   if(!alive)return;
   if(authError||!data.user){navigate("/auth",{replace:true});return;}
   void load();
  });
  return()=>{alive=false;};
 },[load,navigate]);

 async function decide(kind:"app"|"test",id:string,decision:"approved"|"rejected"){
  const reason=(notes[kind+":"+id]??"").trim();
  if(reason.length<5){setError("اكتب سبباً واضحاً للموافقة أو الرفض (5 أحرف على الأقل).");return;}
  setBusyId(kind+":"+id);setError("");setNotice("");
  const result=kind==="app"?await reviewDeveloperApp(id,decision,reason):await reviewDeveloperTest(id,decision,reason);
  if(result.error)setError("تعذرت معالجة الطلب: "+result.error.message);
  else{setNotice(decision==="approved"?"تمت الموافقة على الطلب.":"تم رفض الطلب مع حفظ السبب.");setNotes(v=>({...v,[kind+":"+id]:""}));await load();}
  setBusyId("");
 }

 if(!isTesterWorkflowV2Enabled)return <main className="dashboard-shell"><section className="dashboard-welcome container"><h1>مراجعة المطوّرين V2</h1><p>هذه الوظيفة غير مفعّلة في هذه البيئة.</p><Link to="/developer-dashboard">العودة</Link></section></main>;
 return <main className="dashboard-shell">
  <header className="site-header container"><Brand/><nav className="header-actions"><Link to="/developer-dashboard">لوحة المطوّر</Link></nav></header>
  <section className="dashboard-welcome container">
   <div className="apps-heading"><div><span className="eyebrow">إدارة المنصة · V2</span><h1>طلبات المراجعة</h1><p>لا يمكن إلا لحساب Admin اعتماد التطبيقات والاختبارات أو رفضها. كل قرار يتطلب سبباً ويسجل في سجل التدقيق.</p></div><button className="button button-outline" onClick={()=>void load()}>تحديث</button></div>
   {notice&&<div className="notice notice-success">{notice}</div>}{error&&<div className="notice notice-error">{error}</div>}
   {loading?<div className="loading-screen">جارٍ تحميل الطلبات...</div>:<>
    <h2>التطبيقات ({apps.length})</h2>
    {!apps.length&&<p className="placeholder-panel">لا توجد تطبيقات تنتظر المراجعة.</p>}
    <div className="apps-grid">{apps.map(app=><article className="app-tile" key={app.id}><div className="app-tile-copy"><strong>{app.name}</strong><small dir="ltr">{app.package_name}</small><p>{app.description}</p><small>Developer ID: {app.developer_id}</small></div><label>سبب القرار<textarea rows={2} minLength={5} maxLength={2000} value={notes["app:"+app.id]??""} onChange={e=>setNotes(v=>({...v,["app:"+app.id]:e.target.value}))}/></label><div className="detail-actions"><button className="button button-primary" disabled={busyId==="app:"+app.id} onClick={()=>void decide("app",app.id,"approved")}>اعتماد ونشر</button><button className="button button-quiet" disabled={busyId==="app:"+app.id} onClick={()=>void decide("app",app.id,"rejected")}>رفض</button></div></article>)}</div>
    <h2>الاختبارات ({tests.length})</h2>
    {!tests.length&&<p className="placeholder-panel">لا توجد اختبارات تنتظر المراجعة.</p>}
    <div className="apps-grid">{tests.map(test=><article className="app-tile" key={test.id}><div className="app-tile-copy"><strong>{test.title}</strong><small>{test.test_type} · {test.min_testers} مختبراً</small><p>{test.description}</p><small>App ID: {test.app_id}</small><small>Developer ID: {test.developer_id}</small></div><label>سبب القرار<textarea rows={2} minLength={5} maxLength={2000} value={notes["test:"+test.id]??""} onChange={e=>setNotes(v=>({...v,["test:"+test.id]:e.target.value}))}/></label><div className="detail-actions"><button className="button button-primary" disabled={busyId==="test:"+test.id} onClick={()=>void decide("test",test.id,"approved")}>اعتماد وفتح التسجيل</button><button className="button button-quiet" disabled={busyId==="test:"+test.id} onClick={()=>void decide("test",test.id,"rejected")}>رفض</button></div></article>)}</div>
   </>}
  </section>
 </main>;
}
