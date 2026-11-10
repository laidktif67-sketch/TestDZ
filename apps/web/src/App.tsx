import { useEffect, useState } from "react";
import type { FormEvent } from "react";
import { Link, Navigate, Route, Routes, useParams } from "react-router-dom";
import type { AppRecord } from "@testdz/types";
import { supabase } from "./lib/supabase";
import { Brand } from "./components/Brand";
import { APP_CATEGORIES, appError } from "./lib/app-utils";
import AppsPage from "./pages/AppsPage";
import AuthPage from "./pages/AuthPage";
import ForgotPasswordPage from "./pages/ForgotPasswordPage";
import ResetPasswordPage from "./pages/ResetPasswordPage";
import OnboardingPage from "./pages/OnboardingPage";
import LandingPage from "./pages/LandingPage";
import VerifyEmailPage from "./pages/VerifyEmailPage";
import AuthCallbackPage from "./pages/AuthCallbackPage";
import DashboardPage from "./pages/DashboardPage";
import ProfilePage from "./pages/ProfilePage";




function AppDetailPage(){
  const {id}=useParams();const [app,setApp]=useState<AppRecord|null>(null);const [loading,setLoading]=useState(true);const [error,setError]=useState("");const [editing,setEditing]=useState(false);const [name,setName]=useState("");const [description,setDescription]=useState("");const [category,setCategory]=useState("other");const [busy,setBusy]=useState(false);const [notice,setNotice]=useState("");
  async function load(){if(!supabase||!id){setError("تعذر الاتصال بالتطبيق.");setLoading(false);return;}const {data,error:err}=await supabase.from("apps").select("id,developer_id,name,package_name,description,category,icon_url,status,created_at").eq("id",id).single();if(err)setError("التطبيق غير موجود أو لا تملك صلاحية عرضه.");else{const a=data as AppRecord;setApp(a);setName(a.name);setDescription(a.description??"");setCategory(a.category??"other");}setLoading(false);}
  useEffect(()=>{void load();},[id]);
  async function save(e:FormEvent<HTMLFormElement>){e.preventDefault();if(!supabase||!id)return;setBusy(true);const {error:err}=await supabase.rpc("update_app",{p_app_id:id,p_name:name,p_description:description,p_category:category});if(err)setError(appError(err.message));else{setNotice("تم حفظ التعديلات.");setEditing(false);await load();}setBusy(false);}
  async function archive(){if(!supabase||!id||!window.confirm("هل تريد أرشفة هذا التطبيق؟ يمكنك استعادته لاحقاً."))return;setBusy(true);const {error:err}=await supabase.rpc("archive_app",{p_app_id:id});if(err)setError(appError(err.message));else{setNotice("تمت أرشفة التطبيق.");await load();}setBusy(false);}
  async function restore(){if(!supabase||!id)return;setBusy(true);const {error:err}=await supabase.rpc("restore_app",{p_app_id:id});if(err)setError(appError(err.message));else{setNotice("تمت استعادة التطبيق.");await load();}setBusy(false);}
  if(loading)return <div className="loading-screen">جارٍ تحميل التطبيق...</div>;
  if(!app)return <main className="dashboard-shell container"><p className="notice notice-error">{error||"التطبيق غير موجود."}</p><Link to="/apps">العودة إلى تطبيقاتي</Link></main>;
  return <main className="dashboard-shell"><header className="site-header container"><Brand/><Link to="/apps">← تطبيقاتي</Link></header><section className="dashboard-welcome container"><div className="detail-heading">{app.icon_url?<img src={app.icon_url} alt="" className="detail-icon"/>:<span className="detail-icon app-tile-placeholder">▣</span>}<div><span className="eyebrow">تفاصيل التطبيق</span><h1>{app.name}</h1><p dir="ltr">{app.package_name}</p></div></div>{notice&&<div className="notice notice-success">{notice}</div>}{error&&<div className="notice notice-error">{error}</div>}<div className="detail-actions">{app.status==="archived"?<button className="button button-primary" onClick={restore} disabled={busy}>استعادة التطبيق</button>:<><button className="button button-outline" onClick={()=>setEditing(!editing)}>تحرير البيانات</button><button className="button button-quiet" onClick={archive} disabled={busy}>أرشفة</button></>}</div>
    {editing&&<form className="dashboard-card auth-form detail-edit" onSubmit={save}><label>اسم التطبيق<input required minLength={3} maxLength={50} value={name} onChange={e=>setName(e.target.value)}/></label><label>الوصف<input required minLength={20} maxLength={500} value={description} onChange={e=>setDescription(e.target.value)}/></label><label>الفئة<select value={category} onChange={e=>setCategory(e.target.value)}>{APP_CATEGORIES.map(c=><option value={c.value} key={c.value}>{c.label}</option>)}</select></label><div className="modal-actions"><button type="button" className="button button-quiet" onClick={()=>setEditing(false)}>إلغاء</button><button className="button button-primary" disabled={busy}>حفظ</button></div></form>}
    <div className="detail-grid"><article className="dashboard-card"><span className="eyebrow">نظرة عامة</span><h2>معلومات التطبيق</h2><p>{app.description}</p><div className="detail-meta"><span>الفئة</span><strong>{APP_CATEGORIES.find(c=>c.value===app.category)?.label??"أخرى"}</strong><span>الحالة</span><strong>{app.status==="archived"?"مؤرشف":app.status==="published"?"منشور":app.status==="paused"?"متوقف":"مسودة"}</strong><span>تاريخ الإضافة</span><strong>{new Date(app.created_at).toLocaleDateString("ar-DZ")}</strong></div></article><article className="dashboard-card"><span className="eyebrow">قريباً</span><h2>دورات الاختبار</h2><p>إدارة دورات الاختبار والمختبرين ستتوفر عند تنفيذ Week 5.</p><div className="placeholder-panel">لا توجد دورات اختبار مرتبطة حالياً.</div><h2>المراجعات</h2><p>المراجعات الداخلية وتقارير الجودة ستتوفر بعد اكتمال محرك الاختبار.</p></article></div>
  </section></main>;
}

export default function App() {
  return <Routes><Route path="/" element={<LandingPage />} /><Route path="/auth" element={<AuthPage />} /><Route path="/auth/callback" element={<AuthCallbackPage />} /><Route path="/verify-email" element={<VerifyEmailPage />} /><Route path="/forgot-password" element={<ForgotPasswordPage />} /><Route path="/reset-password" element={<ResetPasswordPage />} /><Route path="/onboarding" element={<OnboardingPage />} /><Route path="/profile" element={<ProfilePage />} /><Route path="/dashboard" element={<DashboardPage />} /><Route path="/apps" element={<AppsPage />} /><Route path="/apps/:id" element={<AppDetailPage />} /><Route path="*" element={<Navigate to="/" replace />} /></Routes>;
}