import { useEffect, useMemo, useState } from "react";
import type { AppRecord } from "@testdz/types";
import type { ReactNode } from "react";
import { Link, Navigate } from "react-router-dom";
import { supabase } from "../lib/supabase";
import "../styles/developer-dashboard.css";

type Language = "en" | "fr" | "ar";
type Range = "7D" | "30D" | "90D" | "1Y";

const copy = {
  en: {
    dashboard:"Developer Dashboard", apps:"My Apps", create:"Create App", tests:"Manage Tests", analytics:"Analytics", discover:"Discover", billing:"Billing", settings:"Settings",
    promoTitle:"Build Better Together", promoBody:"Create amazing apps and prepare them for testing.", promoCta:"Explore Docs",
    search:"Search apps, tests, or developers...", welcome:"Welcome back, Developer!", subtitle:"Build, test and share your amazing applications with TestDZ.", createApp:"Create New App",
    total:"My Apps", published:"Published Apps", drafts:"Draft Apps", archived:"Archived Apps", overview:"Apps Overview", quick:"Quick Actions",
    manage:"Manage Apps", view:"View All", recent:"Recently Added", emptyTitle:"Your workspace is ready", emptyBody:"Create your first app to start building your TestDZ workspace.", addFirst:"Add Your First App",
    status:{draft:"Draft",published:"Published",paused:"Paused",archived:"Archived"}, category:"Application", package:"Package", open:"Manage", all:"All applications",
    latest:"Latest apps added to your workspace", limit:"Plan usage", of:"of", active:"active apps", noLimit:"Plan limit unavailable",
    noSearch:"No applications match your search.", preview:"Development preview · sample data · read only", loading:"Loading your developer workspace…",
    access:"This area is available to developer accounts.", back:"Go to dashboard", soon:"Coming soon", appTrend:"Applications created over time", noTrend:"Add apps to see your activity here.",
    days:"7 days", month:"30 days", quarter:"90 days", year:"1 year", language:"Language", account:"Developer"
  },
  fr: {
    dashboard:"Tableau de bord développeur", apps:"Mes applications", create:"Créer une app", tests:"Gérer les tests", analytics:"Analyses", discover:"Découvrir", billing:"Facturation", settings:"Paramètres",
    promoTitle:"Construisons ensemble", promoBody:"Créez des applications et préparez-les aux tests.", promoCta:"Explorer la documentation",
    search:"Rechercher des applications, tests...", welcome:"Bon retour, développeur !", subtitle:"Créez, testez et partagez vos applications avec TestDZ.", createApp:"Créer une application",
    total:"Mes applications", published:"Applications publiées", drafts:"Brouillons", archived:"Archivées", overview:"Aperçu des applications", quick:"Actions rapides",
    manage:"Gérer les applications", view:"Tout voir", recent:"Ajouts récents", emptyTitle:"Votre espace est prêt", emptyBody:"Créez votre première application pour commencer.", addFirst:"Ajouter votre première app",
    status:{draft:"Brouillon",published:"Publiée",paused:"En pause",archived:"Archivée"}, category:"Application", package:"Package", open:"Gérer", all:"Toutes les applications",
    latest:"Dernières applications ajoutées", limit:"Utilisation du forfait", of:"sur", active:"applications actives", noLimit:"Limite indisponible",
    noSearch:"Aucune application ne correspond.", preview:"Aperçu de développement · données exemples · lecture seule", loading:"Chargement de votre espace développeur…",
    access:"Cette page est réservée aux comptes développeur.", back:"Retour au tableau de bord", soon:"Bientôt", appTrend:"Applications créées au fil du temps", noTrend:"Ajoutez des applications pour voir votre activité.",
    days:"7 jours", month:"30 jours", quarter:"90 jours", year:"1 an", language:"Langue", account:"Développeur"
  },
  ar: {
    dashboard:"لوحة المطوّر", apps:"تطبيقاتي", create:"إضافة تطبيق", tests:"إدارة الاختبارات", analytics:"التحليلات", discover:"اكتشف", billing:"الفوترة", settings:"الإعدادات",
    promoTitle:"نبني الأفضل معاً", promoBody:"أنشئ تطبيقاتك وجهّزها للاختبار على TestDZ.", promoCta:"استكشف التوثيق",
    search:"ابحث عن التطبيقات أو الاختبارات...", welcome:"مرحباً بعودتك، أيها المطوّر!", subtitle:"أنشئ تطبيقاتك واختبرها وشاركها مع مجتمع TestDZ.", createApp:"إنشاء تطبيق جديد",
    total:"تطبيقاتي", published:"التطبيقات المنشورة", drafts:"المسودات", archived:"المؤرشفة", overview:"نظرة عامة على التطبيقات", quick:"إجراءات سريعة",
    manage:"إدارة التطبيقات", view:"عرض الكل", recent:"أُضيفت مؤخراً", emptyTitle:"مساحة عملك جاهزة", emptyBody:"أنشئ أول تطبيق لك لبدء العمل على TestDZ.", addFirst:"أضف تطبيقك الأول",
    status:{draft:"مسودة",published:"منشور",paused:"متوقف",archived:"مؤرشف"}, category:"تطبيق", package:"اسم الحزمة", open:"إدارة", all:"كل التطبيقات",
    latest:"أحدث التطبيقات التي أضفتها", limit:"استخدام الخطة", of:"من", active:"تطبيقات نشطة", noLimit:"حد الخطة غير متاح",
    noSearch:"لا توجد تطبيقات تطابق البحث.", preview:"معاينة تطوير · بيانات تجريبية · للقراءة فقط", loading:"جارٍ تحميل مساحة المطوّر…",
    access:"هذه المساحة متاحة لحسابات المطوّرين فقط.", back:"العودة إلى لوحة التحكم", soon:"قريباً", appTrend:"التطبيقات المضافة عبر الزمن", noTrend:"أضف تطبيقاتك لعرض نشاطك هنا.",
    days:"7 أيام", month:"30 يوماً", quarter:"90 يوماً", year:"سنة", language:"اللغة", account:"مطوّر"
  }
} as const;

function Icon({ name, size = 20 }: { name: string; size?: number }) {
  const common = { width:size, height:size, viewBox:"0 0 24 24", fill:"none", stroke:"currentColor", strokeWidth:1.9, strokeLinecap:"round" as const, strokeLinejoin:"round" as const, "aria-hidden":true as const };
  const paths: Record<string, ReactNode> = {
    home:<><path d="m3 10 9-7 9 7"/><path d="M5 9v11h14V9M9 20v-6h6v6"/></>,
    apps:<><rect x="3" y="3" width="8" height="8" rx="2"/><rect x="13" y="3" width="8" height="8" rx="2"/><rect x="3" y="13" width="8" height="8" rx="2"/><rect x="13" y="13" width="8" height="8" rx="2"/></>,
    plus:<><path d="M12 5v14M5 12h14"/></>,
    tests:<><rect x="5" y="3" width="14" height="18" rx="2"/><path d="M9 3v-1h6v1M8 9h8M8 13h8M8 17h5"/></>,
    chart:<><path d="M4 19V5M4 19h16"/><path d="m7 15 4-4 3 2 5-7"/></>,
    search:<><circle cx="10.8" cy="10.8" r="7"/><path d="m16 16 4.5 4.5"/></>,
    wallet:<><rect x="3" y="6" width="18" height="15" rx="2"/><path d="M3 10h18M16 14h2"/></>,
    settings:<><circle cx="12" cy="12" r="3"/><path d="m19 13 2 1-2 4-2-1-2 1v2H9v-2l-2-1-2 1-2-4 2-1v-2l-2-1 2-4 2 1 2-1V4h6v2l2 1 2-1 2 4-2 1z"/></>,
    arrow:<><path d="M4 12h15M13 6l6 6-6 6"/></>,
    bell:<><path d="M18 9a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9M10 21h4"/></>,
    rocket:<><path d="M14 4c3-2 5-2 6-2 0 2 0 4-2 7l-6 8-5-5z"/><path d="m8 12-4 1-2 4 6-1m6 0-1 5 4-2 1-4"/><circle cx="15" cy="7" r="1.5"/></>,
    box:<><path d="m12 2 9 5v10l-9 5-9-5V7z"/><path d="m3 7 9 5 9-5M12 12v10"/></>,
    check:<path d="m5 12 4 4L19 6"/>,
    file:<><path d="M6 2h8l5 5v15H6z"/><path d="M14 2v6h5M9 13h7M9 17h7"/></>,
    archive:<><rect x="3" y="4" width="18" height="5" rx="1"/><path d="M5 9v11h14V9M10 13h4"/></>,
    clock:<><circle cx="12" cy="12" r="9"/><path d="M12 7v5l4 2"/></>,
    code:<><path d="m8 8-4 4 4 4m8-8 4 4-4 4m-2-11-4 14"/></>,
    users:<><circle cx="9" cy="8" r="3"/><path d="M3 20v-2a6 6 0 0 1 12 0v2M16 5a3 3 0 0 1 0 6m2 3a5 5 0 0 1 3 5v1"/></>
  };
  return <svg {...common}>{paths[name] ?? paths.box}</svg>;
}

function DeveloperMascot() {
  return <svg className="dd-developer-mascot" viewBox="0 0 470 250" role="img" aria-label="Developer working on a laptop">
    <circle cx="248" cy="128" r="112" fill="#fff" opacity=".12"/>
    <rect x="28" y="52" width="92" height="66" rx="13" fill="#fff" opacity=".95"/>
    <path d="M45 72h49M45 84h34M45 96h42" stroke="#65aef7" strokeWidth="5" strokeLinecap="round"/>
    <rect x="352" y="34" width="88" height="70" rx="13" fill="#fff" opacity=".94"/>
    <path d="M372 83V67m18 16V54m18 29V46" stroke="#0875ed" strokeWidth="9" strokeLinecap="round"/>
    <path d="M151 165c11-45 39-65 87-65 50 0 78 26 91 77l8 73H139l12-85Z" fill="#0754b9"/>
    <path d="M188 147c10-25 27-37 50-37 26 0 45 14 55 41l15 99H173l15-103Z" fill="#0878e8"/>
    <path d="M211 143h54l-12 26h-30z" fill="#fff" opacity=".9"/>
    <path d="M190 89c-9-12-13-27-13-45 0-38 24-62 59-62 38 0 62 27 62 66 0 22-8 40-22 53l-17 14h-52l-17-26Z" fill="#f2b88f"/>
    <path d="M177 57c-9-45 17-74 59-74 37 0 63 24 64 64-16-6-28-20-34-37-18 20-49 29-84 25l-5 22Z" fill="#39251f"/>
    <path d="M177 20c18-26 51-37 81-23" stroke="#553027" strokeWidth="14" fill="none" strokeLinecap="round"/>
    <rect x="190" y="59" width="37" height="28" rx="11" fill="none" stroke="#142b50" strokeWidth="5"/>
    <rect x="235" y="59" width="37" height="28" rx="11" fill="none" stroke="#142b50" strokeWidth="5"/>
    <path d="M227 71h8" stroke="#142b50" strokeWidth="5"/>
    <circle cx="208" cy="73" r="4.5" fill="#15284a"/><circle cx="253" cy="73" r="4.5" fill="#15284a"/>
    <path d="M217 101q15 12 30 0" fill="none" stroke="#a34e45" strokeWidth="4" strokeLinecap="round"/>
    <path d="M299 151q22-19 36-5l18 27q0 15-16 16l-36-20" fill="#f2b88f"/>
    <path d="M345 163q-10-15-3-22 8-5 14 8 9-17 17-10 8 7-6 25l-12 14-10-15Z" fill="#f2b88f"/>
    <rect x="101" y="190" width="265" height="45" rx="9" fill="#102c5b"/>
    <rect x="116" y="197" width="235" height="29" rx="5" fill="#d9edff"/>
    <path d="M85 238h298l-17 8H103l-18-8Z" fill="#a9c9e9"/>
    <path d="m218 204 12 14 12-14" fill="none" stroke="#176ce1" strokeWidth="4"/>
  </svg>;
}

function MiniChart({ apps, range }: { apps: AppRecord[]; range: Range }) {
  const count = range === "7D" ? 7 : range === "30D" ? 4 : range === "90D" ? 3 : 12;
  const labels = range === "7D" ? ["Mon","Tue","Wed","Thu","Fri","Sat","Sun"] : range === "30D" ? ["W1","W2","W3","W4"] : range === "90D" ? ["M1","M2","M3"] : ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
  const now = new Date();
  const values = Array.from({length:count},(_,i)=>{
    const start = new Date(now);
    const end = new Date(now);
    if(range==="7D"){start.setDate(now.getDate()-(6-i));start.setHours(0,0,0,0);end.setTime(start.getTime());end.setDate(end.getDate()+1);}
    else if(range==="30D"){start.setDate(now.getDate()-(27-i*7));start.setHours(0,0,0,0);end.setTime(start.getTime());end.setDate(end.getDate()+7);}
    else if(range==="90D"){start.setMonth(now.getMonth()-(2-i),1);start.setHours(0,0,0,0);end.setTime(start.getTime());end.setMonth(end.getMonth()+1);}
    else {start.setFullYear(now.getFullYear(),i,1);start.setHours(0,0,0,0);end.setTime(start.getTime());end.setMonth(end.getMonth()+1);}
    return apps.filter(app=>{const date=new Date(app.created_at);return date>=start&&date<end;}).length;
  });
  const max = Math.max(1,...values);
  const coords = values.map((v,i)=>({x:24+(i*(552/Math.max(1,count-1))),y:142-(v/max)*105}));
  const line = coords.map((p,i)=>(i?"L":"M")+p.x+" "+p.y).join(" ");
  const area = line+" L"+coords[coords.length-1].x+" 155 L"+coords[0].x+" 155 Z";
  return <div className="dd-chart-wrap">
    <svg className="dd-chart" viewBox="0 0 600 175" preserveAspectRatio="none" role="img" aria-label="Application creation chart">
      <defs><linearGradient id="dd-fill" x1="0" x2="0" y1="0" y2="1"><stop offset="0%" stopColor="#1764ef" stopOpacity=".22"/><stop offset="100%" stopColor="#1764ef" stopOpacity=".015"/></linearGradient></defs>
      {[45,82,119,155].map(y=><line key={y} x1="20" y1={y} x2="580" y2={y} stroke="#e7eef9" strokeWidth="1"/>)}
      <path d={area} fill="url(#dd-fill)"/><path d={line} fill="none" stroke="#1764ef" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round"/>
      {coords.map((p,i)=><circle key={i} cx={p.x} cy={p.y} r="4.5" fill="#1764ef" stroke="#fff" strokeWidth="2"/>)}
    </svg>
    <div className="dd-chart-labels">{labels.map((label,i)=><span key={i}>{label}</span>)}</div>
    <div className="dd-chart-summary"><strong>{apps.length}</strong><span>total apps</span></div>
  </div>;
}

export default function DeveloperDashboardPage() {
  const previewMode = import.meta.env.DEV && new URLSearchParams(window.location.search).get("preview") === "1";
  const [language,setLanguage]=useState<Language>(()=>{const saved=window.localStorage.getItem("testdz-landing-language");return saved==="fr"||saved==="ar"?saved:"en";});
  const [sessionReady,setSessionReady]=useState(previewMode);
  const [hasSession,setHasSession]=useState(previewMode);
  const [allowed,setAllowed]=useState(previewMode);
  const [canTester,setCanTester]=useState(previewMode);
  const [name,setName]=useState("Developer");
  const [avatar,setAvatar]=useState("");
  const [apps,setApps]=useState<AppRecord[]>([]);
  const [limit,setLimit]=useState<{plan_code:string;max_active_apps:number;current_active_apps:number;can_create:boolean}|null>(null);
  const [loading,setLoading]=useState(!previewMode);
  const [error,setError]=useState("");
  const [search,setSearch]=useState("");
  const [range,setRange]=useState<Range>("7D");
  const [filter,setFilter]=useState<"all"|"active"|"draft"|"archived">("all");
  const t=copy[language];
  const dir=language==="ar"?"rtl":"ltr";

  useEffect(()=>{document.documentElement.lang=language;document.documentElement.dir=dir;window.localStorage.setItem("testdz-landing-language",language);},[language,dir]);

  useEffect(()=>{
    if(previewMode){
      const now=Date.now();
      const sample:AppRecord[]=[
        {id:"preview-1",developer_id:"preview",name:"CodeMaster",package_name:"com.testdz.codemaster",description:"A sample developer workspace app.",category:"tools",icon_url:null,status:"published",created_at:new Date(now-86400000).toISOString()},
        {id:"preview-2",developer_id:"preview",name:"GameQuiz",package_name:"com.testdz.gamequiz",description:"A sample quiz app.",category:"games",icon_url:null,status:"published",created_at:new Date(now-3*86400000).toISOString()},
        {id:"preview-3",developer_id:"preview",name:"EduTest",package_name:"com.testdz.edutest",description:"A sample learning app.",category:"education",icon_url:null,status:"draft",created_at:new Date(now-5*86400000).toISOString()},
        {id:"preview-4",developer_id:"preview",name:"SkillCheck",package_name:"com.testdz.skillcheck",description:"A sample skills app.",category:"tools",icon_url:null,status:"paused",created_at:new Date(now-9*86400000).toISOString()}
      ];
      setApps(sample);setName("John Doe");setCanTester(true);setLimit({plan_code:"starter",max_active_apps:10,current_active_apps:3,can_create:true});setLoading(false);return;
    }
    if(!supabase){setError("Supabase is not configured.");setLoading(false);setSessionReady(true);return;}
    let alive=true;
    const load=async()=>{
      const {data:sessionData}=await supabase.auth.getSession();
      if(!alive)return;
      const user=sessionData.session?.user;
      if(!user){setHasSession(false);setSessionReady(true);setLoading(false);return;}
      setHasSession(true);
      const [roleRes,profileRes,appsRes,limitRes]=await Promise.all([
        supabase!.from("user_roles").select("role").eq("user_id",user.id),
        supabase!.from("profiles").select("display_name,avatar_url").eq("id",user.id).maybeSingle(),
        supabase!.from("apps").select("id,developer_id,name,package_name,description,category,icon_url,status,created_at").order("created_at",{ascending:false}),
        supabase!.rpc("get_app_limit")
      ]);
      if(!alive)return;
      const roles=(roleRes.data??[]).map((row:{role:string})=>row.role);
      const metadataRole=user.user_metadata?.account_type;
      const canDeveloper=roles.includes("developer")||roles.includes("both")||metadataRole==="developer"||metadataRole==="both";
      const hasTester=roles.includes("tester")||roles.includes("both")||metadataRole==="tester"||metadataRole==="both";
      setAllowed(canDeveloper);setCanTester(hasTester);
      setName(profileRes.data?.display_name?.trim()||user.email?.split("@")[0]||"Developer");
      setAvatar(profileRes.data?.avatar_url||"");
      if(appsRes.error)setError("Could not load your applications. Check your connection and permissions.");
      else setApps((appsRes.data??[]) as AppRecord[]);
      if(!limitRes.error){const value=Array.isArray(limitRes.data)?limitRes.data[0]:limitRes.data;setLimit(value as typeof limit);}
      if(roleRes.error)setError("Could not verify your developer role.");
      setSessionReady(true);setLoading(false);
    };
    void load();
    const {data}=supabase.auth.onAuthStateChange(()=>{void load();});
    return()=>{alive=false;data.subscription.unsubscribe();};
  },[previewMode]);

  const counts=useMemo(()=>({
    total:apps.length,
    published:apps.filter(a=>a.status==="published").length,
    drafts:apps.filter(a=>a.status==="draft").length,
    archived:apps.filter(a=>a.status==="archived").length
  }),[apps]);
  const visible=useMemo(()=>apps.filter(app=>{
    const matchesSearch=(app.name+" "+app.package_name).toLowerCase().includes(search.toLowerCase());
    const matchesFilter=filter==="all"||(filter==="active"?(app.status==="published"||app.status==="paused"):app.status===filter);
    return matchesSearch&&matchesFilter;
  }),[apps,search,filter]);
  const firstName=name.trim().split(/\s+/)[0]||"Developer";
  const statusClass=(status:string)=>"dd-status dd-status-"+status;

  if(loading)return <div className="dd-loading"><span/> {t.loading}</div>;
  if(!previewMode&&sessionReady&&!hasSession)return <Navigate to="/auth" replace/>;
  if(!previewMode&&!allowed)return <Navigate to="/tester-dashboard" replace/>;

  return <div className="dd-shell" dir={dir}>
    <aside className="dd-sidebar">
      <Link to="/tester-dashboard" className="dd-brand"><span className="dd-brand-mark"><Icon name="tests" size={29}/></span><strong>TestDZ</strong><small>Test · Learn · Grow</small></Link>
      <nav className="dd-nav">
        <Link to="/developer-dashboard" className="dd-nav-link active"><Icon name="home"/><span>{t.dashboard}</span></Link>
        <span className="dd-nav-label">APPS & WORKSPACE</span>
        <Link to="/apps" className="dd-nav-link"><Icon name="apps"/><span>{t.apps}</span><b>{counts.total}</b></Link>
        <Link to="/apps" className="dd-nav-link"><Icon name="plus"/><span>{t.create}</span></Link>
        <span className="dd-nav-link dd-disabled"><Icon name="tests"/><span>{t.tests}</span><em>{t.soon}</em></span>
        <span className="dd-nav-link dd-disabled"><Icon name="chart"/><span>{t.analytics}</span><em>{t.soon}</em></span>
        <span className="dd-nav-label">DISCOVER & ACCOUNT</span>
        <Link to="/tester-dashboard" className="dd-nav-link"><Icon name="search"/><span>{t.discover}</span></Link>
        <Link to="/profile" className="dd-nav-link"><Icon name="wallet"/><span>{t.billing}</span></Link>
        <Link to="/profile" className="dd-nav-link"><Icon name="settings"/><span>{t.settings}</span></Link>
      </nav>
      <div className="dd-promo"><div className="dd-rocket"><Icon name="rocket" size={43}/></div><strong>{t.promoTitle}</strong><p>{t.promoBody}</p><Link to="/apps">{t.promoCta}<Icon name="arrow" size={15}/></Link></div>
      <div className="dd-user"><span className="dd-avatar">{avatar?<img src={avatar} alt=""/>:firstName.slice(0,1).toUpperCase()}</span><span><strong>{name}</strong><small>{t.account}</small></span><Link to="/profile" aria-label={t.settings}><Icon name="settings" size={18}/></Link></div>
      {canTester && <div className="dd-workspace-switch" aria-label="Choose workspace"><Link to="/tester-dashboard" className="dd-workspace-option"><Icon name="flask" size={15}/><span>Tester</span></Link><Link to="/developer-dashboard" className="dd-workspace-option active"><Icon name="code" size={15}/><span>Developer</span></Link></div>}
      {previewMode?<div className="dd-preview-note">{t.preview}</div>:<button className="dd-signout" onClick={async()=>{await supabase?.auth.signOut();}}><Icon name="arrow" size={17}/>Sign Out</button>}
    </aside>

    <main className="dd-main">
      <header className="dd-topbar">
        <label className="dd-search"><Icon name="search"/><input value={search} onChange={e=>setSearch(e.target.value)} placeholder={t.search}/></label>
        <div className="dd-top-actions"><span className="dd-online-dot"/><select aria-label={t.language} value={language} onChange={e=>setLanguage(e.target.value as Language)}><option value="en">EN</option><option value="fr">FR</option><option value="ar">AR</option></select><Link to="/profile" className="dd-top-avatar">{avatar?<img src={avatar} alt=""/>:firstName.slice(0,2).toUpperCase()}</Link></div>
      </header>

      <section className="dd-hero">
        <div className="dd-hero-copy"><span className="dd-hero-kicker">TESTDZ · DEVELOPER SPACE</span><h1>👋 {t.welcome}</h1><p>{t.subtitle}</p><Link to="/apps" className="dd-primary"><Icon name="plus"/>{t.createApp}<Icon name="arrow" size={17}/></Link></div>
        <div className="dd-hero-art" aria-hidden="true"><DeveloperMascot/></div>
      </section>

      {error&&<div className="dd-error">{error}</div>}

      <section className="dd-stats">
        <article className="dd-stat dd-stat-blue"><span><Icon name="apps" size={30}/></span><div><strong>{counts.total}</strong><b>{t.total}</b><small>{counts.total===0?"—":t.all}</small></div><Icon name="arrow"/></article>
        <article className="dd-stat dd-stat-green"><span><Icon name="check" size={31}/></span><div><strong>{counts.published}</strong><b>{t.published}</b><small>{t.status.published}</small></div><Icon name="arrow"/></article>
        <article className="dd-stat dd-stat-violet"><span><Icon name="file" size={30}/></span><div><strong>{counts.drafts}</strong><b>{t.drafts}</b><small>{t.status.draft}</small></div><Icon name="arrow"/></article>
        <article className="dd-stat dd-stat-amber"><span><Icon name="archive" size={30}/></span><div><strong>{counts.archived}</strong><b>{t.archived}</b><small>{t.status.archived}</small></div><Icon name="arrow"/></article>
      </section>

      <section className="dd-main-grid">
        <article className="dd-panel dd-overview">
          <div className="dd-panel-head"><h2><Icon name="chart"/>{t.overview}</h2><div className="dd-ranges">{(["7D","30D","90D","1Y"] as Range[]).map(item=><button key={item} className={range===item?"selected":""} onClick={()=>setRange(item)}>{item}</button>)}</div></div>
          {apps.length?<MiniChart apps={apps} range={range}/>:<div className="dd-chart-empty"><Icon name="chart" size={35}/><p>{t.noTrend}</p></div>}
          {limit&&<div className="dd-limit"><span>{t.limit}</span><strong>{limit.current_active_apps} {t.of} {limit.max_active_apps} {t.active}</strong><div><i style={{width:Math.min(100,limit.max_active_apps?limit.current_active_apps/limit.max_active_apps*100:0)+"%"}}/></div></div>}
        </article>
        <article className="dd-panel dd-quick">
          <div className="dd-panel-head"><h2><Icon name="rocket"/>{t.quick}</h2><Link to="/apps">{t.view}<Icon name="arrow" size={15}/></Link></div>
          <div className="dd-quick-grid">
            <Link to="/apps" className="dd-quick-item q-blue"><span><Icon name="plus" size={24}/></span><div><strong>{t.createApp}</strong><small>{t.create}</small></div><Icon name="arrow"/></Link>
            <Link to="/apps" className="dd-quick-item q-green"><span><Icon name="apps" size={24}/></span><div><strong>{t.manage}</strong><small>{t.all}</small></div><Icon name="arrow"/></Link>
            <Link to="/profile" className="dd-quick-item q-violet"><span><Icon name="wallet" size={24}/></span><div><strong>{t.billing}</strong><small>{limit?.plan_code?.toUpperCase()||"—"}</small></div><Icon name="arrow"/></Link>
            <Link to="/tester-dashboard" className="dd-quick-item q-amber"><span><Icon name="search" size={24}/></span><div><strong>{t.discover}</strong><small>{t.tests}</small></div><Icon name="arrow"/></Link>
          </div>
        </article>
      </section>

      <section className="dd-lower-grid">
        <article className="dd-panel dd-apps-panel">
          <div className="dd-panel-head"><h2><Icon name="box"/>{t.apps}</h2><Link to="/apps">{t.view}<Icon name="arrow" size={15}/></Link></div>
          <div className="dd-filter-row">{(["all","active","draft","archived"] as const).map(item=><button key={item} className={filter===item?"selected":""} onClick={()=>setFilter(item)}>{item==="all"?t.all:item==="active"?t.published:item==="draft"?t.drafts:t.archived}</button>)}</div>
          {visible.length?<div className="dd-app-grid">{visible.slice(0,4).map(app=><article className="dd-app-card" key={app.id}><div className="dd-app-icon">{app.icon_url?<img src={app.icon_url} alt=""/>:<Icon name="code" size={31}/>}</div><strong>{app.name}</strong><small dir="ltr">{app.package_name}</small><span className={statusClass(app.status)}>{t.status[app.status]}</span><Link to={"/apps/"+app.id}>{t.open}<Icon name="arrow" size={15}/></Link></article>)}</div>:<div className="dd-app-empty"><Icon name="box" size={36}/><strong>{apps.length?t.noSearch:t.emptyTitle}</strong><p>{apps.length?t.noSearch:t.emptyBody}</p>{!apps.length&&<Link to="/apps" className="dd-primary">{t.addFirst}<Icon name="arrow"/></Link>}</div>}
        </article>
        <article className="dd-panel dd-recent">
          <div className="dd-panel-head"><h2><Icon name="clock"/>{t.recent}</h2><Link to="/apps">{t.view}<Icon name="arrow" size={15}/></Link></div>
          <div className="dd-recent-content">
            {apps.length?<div className="dd-recent-list">{[...apps].sort((a,b)=>new Date(b.created_at).getTime()-new Date(a.created_at).getTime()).slice(0,4).map(app=><Link to={"/apps/"+app.id} key={app.id}><span className="dd-recent-icon"><Icon name="box"/></span><span><strong>{app.name}</strong><small>{app.package_name}</small></span><time>{new Date(app.created_at).toLocaleDateString(language==="ar"?"ar-DZ":language==="fr"?"fr-FR":"en-GB")}</time></Link>)}</div>:<div className="dd-recent-empty"><Icon name="clock" size={31}/><p>{t.noTrend}</p></div>}
            <div className="dd-recent-trophy" aria-hidden="true"><Icon name="award" size={104}/><span>TestDZ</span></div>
          </div>
          <div className="dd-recent-foot"><span>{t.latest}</span><Icon name="rocket" size={23}/></div>
        </article>
      </section>
      <footer className="dd-footer">TestDZ · Test · Learn · Grow</footer>
    </main>
  </div>;
}
