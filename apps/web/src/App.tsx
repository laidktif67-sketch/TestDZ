import { useEffect, useState } from "react";
import type { FormEvent } from "react";
import { Link, Navigate, Route, Routes, useNavigate, useParams } from "react-router-dom";
import imageCompression from "browser-image-compression";
import type { AppLimit, AppRecord } from "@testdz/types";
import { supabase } from "./lib/supabase";
import { Brand } from "./components/Brand";
import AuthPage from "./pages/AuthPage";
import ForgotPasswordPage from "./pages/ForgotPasswordPage";
import ResetPasswordPage from "./pages/ResetPasswordPage";
import OnboardingPage from "./pages/OnboardingPage";
import LandingPage from "./pages/LandingPage";
import VerifyEmailPage from "./pages/VerifyEmailPage";
import AuthCallbackPage from "./pages/AuthCallbackPage";
import DashboardPage from "./pages/DashboardPage";


function ProfilePage() {
  const navigate=useNavigate();
  const [userId,setUserId]=useState("");const [displayName,setDisplayName]=useState("");const [phone,setPhone]=useState("");const [bio,setBio]=useState("");const [avatarUrl,setAvatarUrl]=useState("");const [verified,setVerified]=useState(false);const [busy,setBusy]=useState(false);const [message,setMessage]=useState("");const [error,setError]=useState("");
  useEffect(()=>{const client=supabase;if(!client)return;client.auth.getUser().then(async({data,error:authError})=>{if(authError||!data.user){navigate("/auth",{replace:true});return;}setUserId(data.user.id);const {data:profile,error:profileError}=await client.from("profiles").select("display_name,phone,bio,avatar_url,is_verified").eq("id",data.user.id).single();if(profileError){setError("تعذر تحميل الملف الشخصي.");return;}setDisplayName(profile.display_name??"");setPhone(profile.phone??"");setBio(profile.bio??"");setAvatarUrl(profile.avatar_url??"");setVerified(Boolean(profile.is_verified));});},[navigate]);
  async function save(e:FormEvent<HTMLFormElement>){e.preventDefault();if(!supabase)return;setBusy(true);setMessage("");setError("");const {error:err}=await supabase.from("profiles").update({display_name:displayName.trim(),phone:phone.trim()||null,bio:bio.trim()||null}).eq("id",userId);if(err)setError("تعذر حفظ الملف الشخصي. تحقق من البيانات وحاول مجدداً.");else setMessage("تم حفظ الملف الشخصي.");setBusy(false);}
  async function upload(file?:File){if(!file||!supabase)return;setError("");setMessage("");if(file.size>8*1024*1024){setError("حجم الصورة الأصلية يجب ألا يتجاوز 8 ميغابايت.");return;}if(!["image/jpeg","image/png","image/webp"].includes(file.type)){setError("الصيغ المدعومة: JPG وPNG وWebP.");return;}setBusy(true);let compressed:File;try{const output=await imageCompression(file,{maxSizeMB:0.45,maxWidthOrHeight:512,useWebWorker:true});const ext=output.type==="image/png"?"png":output.type==="image/webp"?"webp":"jpg";compressed=new File([output],"avatar."+ext,{type:output.type||"image/jpeg"});}catch{setError("تعذر ضغط الصورة. اختر صورة أخرى.");setBusy(false);return;}const ext=compressed.type==="image/png"?"png":compressed.type==="image/webp"?"webp":"jpg";const path=userId+"/avatar."+ext;const {error:uploadError}=await supabase.storage.from("avatars").upload(path,compressed,{upsert:true,contentType:compressed.type,cacheControl:"3600"});if(uploadError){setError("تعذر رفع الصورة. حاول مرة أخرى.");setBusy(false);return;}const {data}=supabase.storage.from("avatars").getPublicUrl(path);const url=data.publicUrl+"?v="+Date.now();const {error:updateError}=await supabase.from("profiles").update({avatar_url:url}).eq("id",userId);if(updateError)setError("تم رفع الصورة لكن تعذر حفظ رابطها في الملف الشخصي.");else{setAvatarUrl(url);setMessage("تم تحديث الصورة.");}setBusy(false);}
  return <main className="dashboard-shell"><header className="site-header container"><Brand /><Link to="/dashboard">لوحة التحكم</Link></header><section className="dashboard-welcome container"><span className="eyebrow">إعدادات الحساب</span><h1>ملفي الشخصي</h1><div className="dashboard-card profile-card"><div className="profile-avatar">{avatarUrl?<img src={avatarUrl} alt="الصورة الشخصية"/>:<span>{displayName.slice(0,1)||"T"}</span>}</div><label className="button button-outline">تغيير الصورة<input type="file" accept="image/jpeg,image/png,image/webp" hidden onChange={e=>upload(e.target.files?.[0])}/></label><small>حتى 8MB قبل الضغط · 512px بعد الضغط · JPG, PNG, WebP</small></div><form className="auth-form profile-form" onSubmit={save}><label>الاسم الكامل<input required minLength={2} value={displayName} onChange={e=>setDisplayName(e.target.value)}/></label><label>رقم الهاتف (اختياري)<input type="tel" value={phone} onChange={e=>setPhone(e.target.value)} dir="ltr"/></label><label>نبذة قصيرة<textarea rows={4} maxLength={300} value={bio} onChange={e=>setBio(e.target.value)}/></label><div className="verification-line">حالة البريد: <strong>{verified?"مؤكد":"بانتظار التأكيد"}</strong></div>{message&&<div className="notice notice-success">{message}</div>}{error&&<div className="notice notice-error">{error}</div>}<button className="button button-primary button-large" disabled={busy}>{busy?"جارٍ الحفظ...":"حفظ التغييرات"}</button></form><p className="dashboard-note">الأدوار وحالة التحقق والخطة لا يمكن تعديلها من هذه الصفحة.</p></section></main>;
}



const APP_CATEGORIES = [
  { value: "games", label: "ألعاب" },
  { value: "tools", label: "أدوات" },
  { value: "education", label: "تعليم" },
  { value: "social", label: "اجتماعي" },
  { value: "health", label: "صحة" },
  { value: "other", label: "أخرى" },
] as const;

function appError(message: string) {
  if (message.includes("PLAN_LIMIT_REACHED")) return "وصلت إلى الحد الأقصى لتطبيقات خطتك. يمكنك أرشفة تطبيق أو ترقية خطتك.";
  if (message.includes("apps_package_name_global_unique") || message.includes("duplicate key")) return "اسم الحزمة مستخدم بالفعل في المنصة.";
  if (message.includes("DEVELOPER_ROLE_REQUIRED")) return "يلزم تفعيل دور المطوّر قبل إضافة تطبيق.";
  if (message.includes("PACKAGE_NAME_INVALID")) return "اسم الحزمة غير صالح. مثال: dz.testdz.myapp";
  return "تعذّر تنفيذ العملية. تحقق من البيانات وحاول مجدداً.";
}

function useCurrentUser() {
  const [userId,setUserId]=useState<string|null>(null);
  useEffect(()=>{supabase?.auth.getUser().then(({data})=>setUserId(data.user?.id??null));},[]);
  return userId;
}

function AppsPage() {
  const userId=useCurrentUser();
  const navigate=useNavigate();
  const [apps,setApps]=useState<AppRecord[]>([]);
  const [limit,setLimit]=useState<AppLimit|null>(null);
  const [filter,setFilter]=useState<"all"|"active"|"archived">("all");
  const [search,setSearch]=useState("");
  const [loading,setLoading]=useState(true);
  const [error,setError]=useState("");
  const [showForm,setShowForm]=useState(false);
  const [busy,setBusy]=useState(false);
  const [name,setName]=useState("");
  const [packageName,setPackageName]=useState("");
  const [description,setDescription]=useState("");
  const [category,setCategory]=useState("tools");
  const [icon,setIcon]=useState<File|null>(null);
  const [preview,setPreview]=useState("");
  const [notice,setNotice]=useState("");

  async function load(){
    if(!supabase)return;
    setLoading(true);setError("");
    const [{data:rows,error:appsError},{data:limits,error:limitError}]=await Promise.all([
      supabase.from("apps").select("id,developer_id,name,package_name,description,category,icon_url,status,created_at").order("created_at",{ascending:false}),
      supabase.rpc("get_app_limit")
    ]);
    if(appsError)setError("تعذر تحميل التطبيقات. حاول تحديث الصفحة.");
    else setApps((rows??[]) as AppRecord[]);
    if(limitError)setError("تعذر قراءة حد الخطة حالياً.");
    else setLimit(Array.isArray(limits)?limits[0]??null:limits as AppLimit);
    setLoading(false);
  }
  useEffect(()=>{if(!supabase){setError("اتصال Supabase غير مضبوط.");setLoading(false);return;}if(userId)void load();else supabase.auth.getSession().then(({data})=>{if(!data.session){navigate("/auth",{replace:true});setLoading(false);}});},[userId]);
  useEffect(()=>{if(!icon){setPreview("");return;}const url=URL.createObjectURL(icon);setPreview(url);return()=>URL.revokeObjectURL(url);},[icon]);

  async function chooseIcon(file?:File){
    if(!file)return;
    if(!["image/png","image/jpeg"].includes(file.type)){setError("الأيقونة يجب أن تكون PNG أو JPG.");return;}
    try{
      const compressed=await imageCompression(file,{maxSizeMB:0.45,maxWidthOrHeight:512,useWebWorker:true});
      setIcon(new File([compressed],file.name.replace(/\.[^.]+$/,"")+".jpg",{type:compressed.type||"image/jpeg"}));
      setError("");
    }catch{setError("تعذر تجهيز الصورة. اختر صورة أخرى.");}
  }
  function resetForm(){setName("");setPackageName("");setDescription("");setCategory("tools");setIcon(null);setPreview("");setShowForm(false);}
  async function create(event:FormEvent<HTMLFormElement>){
    event.preventDefault();if(!supabase||!userId)return;
    if(name.trim().length<3||name.trim().length>50||description.trim().length<20||description.trim().length>500){setError("الاسم 3–50 حرفاً والوصف 20–500 حرف.");return;}
    if(!/^[a-z][a-z0-9_]*(\.[a-z][a-z0-9_]*)+$/.test(packageName.trim())){setError("اسم الحزمة غير صالح. مثال: dz.testdz.myapp");return;}
    setBusy(true);setError("");setNotice("");
    const {data:appId,error:createError}=await supabase.rpc("create_app",{p_name:name,p_package_name:packageName,p_description:description,p_category:category});
    if(createError){setError(appError(createError.message));setBusy(false);return;}
    let postCreateWarning = "";
    if(icon){
      const ext=icon.type==="image/png"?"png":"jpg";
      const path=userId+"/"+appId+"/icon."+ext;
      const {error:uploadError}=await supabase.storage.from("app-icons").upload(path,icon,{upsert:true,contentType:icon.type,cacheControl:"3600"});
      if(uploadError){postCreateWarning="أُنشئ التطبيق، لكن تعذر رفع الأيقونة. يمكنك إضافتها لاحقاً.";}
      else{
        const {data}=supabase.storage.from("app-icons").getPublicUrl(path);
        const {error:updateError}=await supabase.rpc("update_app",{p_app_id:appId,p_name:name,p_description:description,p_category:category,p_icon_url:data.publicUrl});
        if(updateError)postCreateWarning="أُنشئ التطبيق ورُفعت الأيقونة، لكن تعذر ربطها بالتطبيق.";
      }
    }
    resetForm();setNotice("تم إنشاء التطبيق كمسودة.");await load();if(postCreateWarning)setError(postCreateWarning);setBusy(false);
  }
  const visible=apps.filter(a=>(filter==="all"?a.status!=="archived":filter==="active"?a.status!=="archived":a.status==="archived")&&a.name.toLowerCase().includes(search.toLowerCase()));
  return <main className="dashboard-shell"><header className="site-header container"><Brand/><nav className="header-actions"><Link to="/dashboard">لوحة التحكم</Link><Link to="/profile">الملف الشخصي</Link></nav></header><section className="dashboard-welcome container">
    <div className="apps-heading"><div><span className="eyebrow">مساحة المطوّر</span><h1>تطبيقاتي</h1><p>أدر تطبيقات Android الخاصة بك من مكان واحد.</p></div><button className="button button-primary" onClick={()=>{setError("");setShowForm(true);}} disabled={!limit||!limit.can_create}>＋ إضافة تطبيق</button></div>
    {limit&&<div className="apps-limit"><span>الخطة: <strong>{limit.plan_code.toUpperCase()}</strong></span><span>{limit.current_active_apps} / {limit.max_active_apps} تطبيق نشط</span>{limit.current_active_apps>=limit.max_active_apps&&<Link to="/pricing">ترقية الخطة</Link>}</div>}
    {notice&&<div className="notice notice-success">{notice}</div>}{error&&<div className="notice notice-error">{error}</div>}
    <div className="apps-toolbar"><div className="filter-tabs">{(["all","active","archived"] as const).map(v=><button key={v} className={filter===v?"selected":""} onClick={()=>setFilter(v)}>{v==="all"?"الكل":v==="active"?"النشطة":"المؤرشفة"}</button>)}</div><input aria-label="بحث التطبيقات" placeholder="ابحث عن تطبيق..." value={search} onChange={e=>setSearch(e.target.value)}/></div>
    {loading?<div className="loading-screen">جارٍ تحميل التطبيقات...</div>:visible.length===0?<div className="apps-empty"><div className="empty-icon">▣</div><h2>{search?"لا توجد نتائج":"لا توجد تطبيقات هنا بعد"}</h2><p>{search?"جرّب كلمة بحث أخرى.":"أضف أول تطبيق Android لبدء تنظيم اختباره."}</p>{filter!=="archived"&&<button className="button button-primary" disabled={!limit||!limit.can_create} onClick={()=>setShowForm(true)}>إضافة أول تطبيق</button>}</div>:<div className="apps-grid">{visible.map(app=><article className="app-tile" key={app.id}><button className="app-tile-main" onClick={()=>navigate("/apps/"+app.id)}>{app.icon_url?<img src={app.icon_url} alt="" className="app-tile-icon"/>:<span className="app-tile-icon app-tile-placeholder">▣</span>}<span className="app-tile-copy"><strong>{app.name}</strong><small>{app.package_name}</small><em className={"app-status status-"+app.status}>{app.status==="archived"?"مؤرشف":app.status==="published"?"منشور":app.status==="paused"?"متوقف":"مسودة"}</em></span><span className="app-chevron">←</span></button><div className="app-tile-footer"><span>{APP_CATEGORIES.find(c=>c.value===app.category)?.label??"أخرى"}</span><Link to={"/apps/"+app.id}>التفاصيل</Link></div></article>)}</div>}
  </section>
  {showForm&&<div className="modal-backdrop" role="presentation" onMouseDown={e=>{if(e.target===e.currentTarget)resetForm();}}><section className="app-modal" role="dialog" aria-modal="true" aria-labelledby="new-app-title"><div className="modal-heading"><div><span className="eyebrow">تطبيق جديد</span><h2 id="new-app-title">أضف تطبيقك</h2></div><button className="modal-close" onClick={resetForm} aria-label="إغلاق">×</button></div><form className="auth-form" onSubmit={create}><label>اسم التطبيق<input required minLength={3} maxLength={50} value={name} onChange={e=>setName(e.target.value)} placeholder="مثال: تطبيق المهام"/></label><label>اسم الحزمة<input required value={packageName} onChange={e=>setPackageName(e.target.value)} dir="ltr" placeholder="dz.example.myapp"/></label><label>الوصف<input required minLength={20} maxLength={500} value={description} onChange={e=>setDescription(e.target.value)} placeholder="اكتب وصفاً واضحاً للتطبيق (20–500 حرف)"/></label><label>الفئة<select value={category} onChange={e=>setCategory(e.target.value)}>{APP_CATEGORIES.map(c=><option value={c.value} key={c.value}>{c.label}</option>)}</select></label><label>أيقونة التطبيق <small>PNG أو JPG · 512px كحد أقصى · تُضغط قبل الرفع</small><input type="file" accept="image/png,image/jpeg" onChange={e=>chooseIcon(e.target.files?.[0])}/></label>{preview&&<img src={preview} className="icon-preview" alt="معاينة الأيقونة"/>}<p className="form-hint">سيُحفظ التطبيق كمسودة. يمكنك إكمال بياناته لاحقاً.</p><div className="modal-actions"><button type="button" className="button button-quiet" onClick={resetForm}>إلغاء</button><button type="submit" className="button button-primary" disabled={busy}>{busy?"جارٍ الإنشاء...":"إنشاء التطبيق"}</button></div></form></section></div>}
  </main>;
}

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