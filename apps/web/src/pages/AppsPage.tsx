import { useEffect, useState } from "react";
import type { FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import imageCompression from "browser-image-compression";
import type { AppLimit, AppRecord } from "@testdz/types";
import { supabase } from "../lib/supabase";
import { Brand } from "../components/Brand";
import { APP_CATEGORIES, appError } from "../lib/app-utils";
import { createApp, getAppLimit, listApps, updateApp, uploadAppIcon } from "../features/apps/apps-api";

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
      listApps(),
      getAppLimit()
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
    const {data:appId,error:createError}=await createApp({name,packageName,description,category});
    if(createError){setError(appError(createError.message));setBusy(false);return;}
    let postCreateWarning = "";
    if(icon){
      const {uploadError,updateError}=await uploadAppIcon(userId,String(appId),icon);
      if(uploadError){postCreateWarning="أُنشئ التطبيق، لكن تعذر رفع الأيقونة. يمكنك إضافتها لاحقاً.";}
      else if(updateError){postCreateWarning="أُنشئ التطبيق ورُفعت الأيقونة، لكن تعذر ربطها بالتطبيق.";}
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

export default AppsPage;
