import { useCallback, useEffect, useState } from "react";
import type { FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import type { AppRecord } from "@testdz/types";
import { supabase } from "../../../lib/supabase";
import { isTesterWorkflowV2Enabled } from "../../../lib/supabase-v2";
import {
  createDeveloperTest,
  createDeveloperTestCohort,
  listApps,
  listDeveloperTests,
  submitDeveloperTestForReview,
} from "../../../features/apps/apps-api";
import { Brand } from "../../../shared/components/Brand";

type DeveloperTestInputType = "google_play_closed"|"apk_testing"|"bug_discovery"|"usability"|"compatibility"|"custom";

type DeveloperTest = {
  id: string; app_id: string; title: string; description: string | null;
  short_summary: string | null; test_type: string; status: string;
  min_testers: number; start_date: string | null; end_date: string | null;
  estimated_duration_minutes: number | null; created_at: string;
};

const statusLabel: Record<string,string> = {
  draft:"مسودة", submitted:"قيد المراجعة", recruiting:"يستقبل المختبرين",
  ready:"جاهز", running:"جارٍ", at_risk:"معرّض للتأخير",
  completed:"مكتمل", failed:"مرفوض", cancelled:"ملغى",
};

export default function DeveloperTestsPage() {
  const navigate=useNavigate();
  const [userId,setUserId]=useState<string|null>(null);
  const [apps,setApps]=useState<AppRecord[]>([]);
  const [tests,setTests]=useState<DeveloperTest[]>([]);
  const [loading,setLoading]=useState(true);
  const [busy,setBusy]=useState(false);
  const [error,setError]=useState("");
  const [notice,setNotice]=useState("");
  const [showCreate,setShowCreate]=useState(false);
  const [appId,setAppId]=useState("");
  const [title,setTitle]=useState("");
  const [description,setDescription]=useState("");
  const [summary,setSummary]=useState("");
  const [testType,setTestType]=useState<DeveloperTestInputType>("usability");
  const [minTesters,setMinTesters]=useState(12);
  const [duration,setDuration]=useState(30);
  const [instructions,setInstructions]=useState("");
  const [cohortFor,setCohortFor]=useState<string|null>(null);
  const [cohortName,setCohortName]=useState("");
  const [cohortCapacity,setCohortCapacity]=useState(12);

  const load=useCallback(async(id:string)=>{
    setLoading(true);setError("");
    const [appResult,testResult]=await Promise.all([listApps(id),listDeveloperTests(id)]);
    if(appResult.error)setError("تعذر تحميل تطبيقاتك.");
    else setApps((appResult.data??[]) as AppRecord[]);
    if(testResult.error)setError("تعذر تحميل الاختبارات.");
    else setTests((testResult.data??[]) as DeveloperTest[]);
    setLoading(false);
  },[]);

  useEffect(()=>{
    if(!isTesterWorkflowV2Enabled){setLoading(false);return;}
    if(!supabase){setError("اتصال قاعدة البيانات غير متاح.");setLoading(false);return;}
    let alive=true;
    void supabase.auth.getUser().then(({data,error:authError})=>{
      if(!alive)return;
      if(authError||!data.user){navigate("/auth",{replace:true});return;}
      setUserId(data.user.id);
      void load(data.user.id);
    });
    return()=>{alive=false;};
  },[load,navigate]);

  async function createTest(event:FormEvent<HTMLFormElement>){
    event.preventDefault();
    if(!appId){setError("اختر التطبيق المنشور أولاً.");return;}
    setBusy(true);setError("");setNotice("");
    const {error:rpcError}=await createDeveloperTest({
      appId,title,description,shortSummary:summary,testType,minTesters,
      durationMinutes:duration,instructions,
    });
    if(rpcError)setError(rpcError.message==="PUBLISHED_OWNED_APP_REQUIRED"?"يجب أن يكون التطبيق منشوراً ومملوكاً لك.":"تعذر إنشاء الاختبار: "+rpcError.message);
    else{setNotice("تم إنشاء الاختبار كمسودة. راجعه ثم أرسله للمراجعة.");setShowCreate(false);setTitle("");setDescription("");setSummary("");setInstructions("");if(userId)await load(userId);}
    setBusy(false);
  }

  async function submitTest(id:string){
    setBusy(true);setError("");setNotice("");
    const {error:rpcError}=await submitDeveloperTestForReview(id);
    if(rpcError)setError("تعذر إرسال الاختبار: "+rpcError.message);
    else{setNotice("أُرسل الاختبار للمراجعة الإدارية.");if(userId)await load(userId);}
    setBusy(false);
  }

  async function createCohort(event:FormEvent<HTMLFormElement>,testId:string){
    event.preventDefault();setBusy(true);setError("");setNotice("");
    const {error:rpcError}=await createDeveloperTestCohort({testId,name:cohortName,capacity:cohortCapacity});
    if(rpcError)setError("تعذر إنشاء مجموعة المختبرين: "+rpcError.message);
    else{setNotice("أُنشئت المجموعة وربطت بالاختبار.");setCohortFor(null);setCohortName("");if(userId)await load(userId);}
    setBusy(false);
  }

  if(!isTesterWorkflowV2Enabled)return <main className="dashboard-shell"><section className="dashboard-welcome container"><h1>إدارة الاختبارات V2</h1><p>هذه الميزة غير مفعّلة في هذه البيئة. لم يتم الرجوع تلقائياً إلى مخطط البيانات القديم.</p><Link to="/developer-dashboard">العودة إلى لوحة المطوّر</Link></section></main>;

  const publishedApps=apps.filter(app=>app.status==="published");
  return <main className="dashboard-shell">
    <header className="site-header container"><Brand/><nav className="header-actions"><Link to="/developer-dashboard">لوحة المطوّر</Link><Link to="/apps">تطبيقاتي</Link></nav></header>
    <section className="dashboard-welcome container">
      <div className="apps-heading"><div><span className="eyebrow">مساحة المطوّر · V2</span><h1>إدارة الاختبارات</h1><p>أنشئ اختباراً لتطبيق منشور، أرسله للمراجعة، ثم جهّز مجموعة المختبرين بعد اعتماده.</p></div><button className="button button-primary" onClick={()=>setShowCreate(v=>!v)} disabled={!publishedApps.length}>＋ إنشاء اختبار</button></div>
      {!publishedApps.length&&<div className="notice">يلزم نشر تطبيق واحد على الأقل قبل إنشاء اختبار. يمكنك إرسال مسودة التطبيق للمراجعة من صفحة تفاصيله.</div>}
      {notice&&<div className="notice notice-success">{notice}</div>}{error&&<div className="notice notice-error">{error}</div>}
      {showCreate&&<form className="dashboard-card auth-form" onSubmit={createTest}>
        <h2>اختبار جديد</h2>
        <label>التطبيق المنشور<select required value={appId} onChange={e=>setAppId(e.target.value)}><option value="">اختر التطبيق</option>{publishedApps.map(a=><option key={a.id} value={a.id}>{a.name}</option>)}</select></label>
        <label>عنوان الاختبار<input required minLength={3} maxLength={160} value={title} onChange={e=>setTitle(e.target.value)}/></label>
        <label>الوصف<textarea required minLength={20} maxLength={12000} rows={4} value={description} onChange={e=>setDescription(e.target.value)}/></label>
        <label>ملخص قصير<input maxLength={240} value={summary} onChange={e=>setSummary(e.target.value)}/></label>
        <label>نوع الاختبار<select value={testType} onChange={e=>setTestType(e.target.value as typeof testType)}><option value="usability">سهولة الاستخدام</option><option value="bug_discovery">اكتشاف الأخطاء</option><option value="compatibility">التوافق</option><option value="google_play_closed">اختبار مغلق Google Play</option><option value="apk_testing">اختبار APK</option><option value="custom">مخصص</option></select></label>
        <label>عدد المختبرين المطلوب<input type="number" min={1} max={500} value={minTesters} onChange={e=>setMinTesters(Number(e.target.value))}/></label>
        <label>المدة التقديرية بالدقائق<input type="number" min={1} max={1440} value={duration} onChange={e=>setDuration(Number(e.target.value))}/></label>
        <label>تعليمات المختبر<textarea rows={3} maxLength={12000} value={instructions} onChange={e=>setInstructions(e.target.value)}/></label>
        <div className="detail-actions"><button className="button button-primary" disabled={busy}>حفظ كمسودة</button><button type="button" className="button button-quiet" onClick={()=>setShowCreate(false)}>إلغاء</button></div>
      </form>}
      {loading?<div className="loading-screen">جارٍ تحميل الاختبارات...</div>:tests.length===0?<div className="apps-empty"><h2>لا توجد اختبارات بعد</h2><p>بعد نشر تطبيقك، يمكنك إنشاء أول اختبار وإرساله للمراجعة.</p></div>:<div className="apps-grid">{tests.map(test=><article className="app-tile" key={test.id}><div className="app-tile-main"><span className="app-tile-icon app-tile-placeholder">✓</span><span className="app-tile-copy"><strong>{test.title}</strong><small>{test.test_type} · {test.min_testers} مختبراً</small><em className={"app-status status-"+test.status}>{statusLabel[test.status]??test.status}</em></span></div><div className="app-tile-footer"><span>{test.estimated_duration_minutes?test.estimated_duration_minutes+" دقيقة":"المدة غير محددة"}</span>{(test.status==="draft"||test.status==="failed"||test.status==="cancelled")&&<button onClick={()=>void submitTest(test.id)} disabled={busy}>إرسال للمراجعة</button>}{(test.status==="recruiting"||test.status==="ready")&&<button onClick={()=>{setCohortFor(test.id);setCohortName("مجموعة "+test.title);}}>إنشاء مجموعة</button>}</div>{cohortFor===test.id&&<form className="auth-form" onSubmit={e=>void createCohort(e,test.id)}><label>اسم المجموعة<input required minLength={2} maxLength={120} value={cohortName} onChange={e=>setCohortName(e.target.value)}/></label><label>السعة<input type="number" min={1} max={500} value={cohortCapacity} onChange={e=>setCohortCapacity(Number(e.target.value))}/></label><button className="button button-primary" disabled={busy}>إنشاء وربط المجموعة</button></form>}</article>)}</div>}
    </section>
  </main>;
}
