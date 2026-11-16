import { useEffect, useMemo, useState } from "react";
import type { Session } from "@supabase/supabase-js";
import { Link, Navigate } from "react-router-dom";
import { supabase } from "../../../lib/supabase";
import { isTesterWorkflowV2Enabled } from "../../../lib/supabase-v2";
import { getDiscoverTestsPageData } from "../../../features/tester/dashboard-api";
import { useIdentity } from "../../../shared/auth/hooks/useIdentity";
import TesterSidebar from "../components/TesterSidebar";
import { Icon } from "../components/TesterSidebar";
import "../styles/tester-dashboard.css";
import "../styles/discover-tests.css";

type AppInfo={name:string;icon_url:string|null;category?:string|null};
type TestRow={id:string;title:string;description:string|null;short_summary?:string|null;status:string;min_testers:number;start_date:string|null;end_date:string|null;app?:AppInfo|null};
type Category="all"|"mobile"|"web"|"desktop"|"other";
type FilterIconName="grid"|"smartphone"|"globe"|"monitor"|"layers";
const filters:{id:Category;label:string;icon:FilterIconName}[]=[
 {id:"all",label:"All opportunities",icon:"grid"},
 {id:"mobile",label:"Mobile apps",icon:"smartphone"},
 {id:"web",label:"Web apps",icon:"globe"},
 {id:"desktop",label:"Desktop",icon:"monitor"},
 {id:"other",label:"Other",icon:"layers"}
];
function categoryOf(value?:string|null):Category{const v=(value||"").toLowerCase();if(/android|ios|mobile|game|health|education/.test(v))return"mobile";if(/web|saas|website/.test(v))return"web";if(/desktop|windows|mac|linux/.test(v))return"desktop";return"other";}
function initials(value:string){return value.split(/\s+/).slice(0,2).map(x=>x[0]||"").join("").toUpperCase()||"T";}
function daysLeft(value:string|null){if(!value)return null;return Math.max(0,Math.ceil((new Date(value+"T23:59:59").getTime()-Date.now())/86400000));}
function HeroIllustration(){return <svg viewBox="0 0 520 270" role="img" aria-label="Discover, test and earn illustration"><defs><linearGradient id="dt-screen" x1="0" y1="0" x2="1" y2="1"><stop stopColor="#fff"/><stop offset="1" stopColor="#dceaff"/></linearGradient><linearGradient id="dt-blue" x1="0" y1="0" x2="1" y2="1"><stop stopColor="#54b7ff"/><stop offset="1" stopColor="#0755d9"/></linearGradient><filter id="dt-shadow"><feDropShadow dx="0" dy="8" stdDeviation="8" floodColor="#12468e" floodOpacity=".22"/></filter></defs><circle cx="276" cy="137" r="115" fill="#fff" opacity=".16"/><circle cx="276" cy="137" r="88" fill="none" stroke="#fff" strokeOpacity=".45" strokeWidth="2"/><g filter="url(#dt-shadow)"><path d="m102 55 245 12 9 151-253-12Z" fill="#123e8e"/><path d="m115 67 219 11 7 119-219-11Z" fill="url(#dt-screen)"/><rect x="140" y="91" width="155" height="9" rx="4.5" fill="#b9cdef"/><rect x="140" y="112" width="126" height="7" rx="3.5" fill="#d1def1"/><g fill="#1472ed"><circle cx="151" cy="143" r="10"/><circle cx="151" cy="174" r="10"/></g><g fill="none" stroke="#fff" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="m146 143 4 4 7-8m-11 35 4 4 7-8"/></g><rect x="171" y="139" width="128" height="7" rx="3.5" fill="#a9c2e8"/><rect x="171" y="170" width="105" height="7" rx="3.5" fill="#a9c2e8"/><path d="m76 218 286 13-28 18-288-15Z" fill="url(#dt-blue)"/></g><g filter="url(#dt-shadow)"><circle cx="361" cy="145" r="52" fill="#bce7ff" fillOpacity=".7" stroke="#0961d5" strokeWidth="9"/><path d="m398 184 43 48" stroke="#0754bd" strokeWidth="15" strokeLinecap="round"/><path d="m398 184 43 48" stroke="#8bd4ff" strokeWidth="4" strokeLinecap="round"/></g><g transform="translate(399 24) rotate(28)"><path d="M20 0C5 17 3 37 7 54l13 10 13-10C37 37 35 17 20 0Z" fill="#0865e9" stroke="#0643a9" strokeWidth="2"/><circle cx="20" cy="31" r="7" fill="#e9f7ff"/><path d="m8 48-10 15 13-3m21-12 10 15-13-3" fill="#ffad35"/></g><circle cx="75" cy="53" r="8" fill="#fff" opacity=".85"/><path d="m446 100 6 12 13 2-9 9 2 13-12-6-12 6 2-13-9-9 13-2Z" fill="#fff" opacity=".9"/><rect x="25" y="135" width="78" height="48" rx="12" fill="#fff" opacity=".95"/><text x="64" y="166" fontSize="23" textAnchor="middle" fontWeight="800" fill="#075bd8">&lt;/&gt;</text></svg>;}
export default function DiscoverTestsPage(){
 const {roles=[]}=useIdentity();
 const [session,setSession]=useState<Session|null>(null),[name,setName]=useState("Tester"),[avatar,setAvatar]=useState("");
 const [tests,setTests]=useState<TestRow[]>([]),[points,setPoints]=useState(0),[completed,setCompleted]=useState(0),[unread,setUnread]=useState(0);
 const [query,setQuery]=useState(""),[category,setCategory]=useState<Category>("all"),[sort,setSort]=useState("newest"),[loading,setLoading]=useState(true),[error,setError]=useState("");
 const [menuOpen,setMenuOpen]=useState(false);
 const previewMode=import.meta.env.DEV&&new URLSearchParams(window.location.search).get("preview")==="1";
 const isAdmin=roles.includes("admin"),isDeveloper=roles.includes("developer");
 useEffect(()=>{
  const client=supabase;
  if(!client){setLoading(false);setError("Supabase is not configured.");return;}
  let alive=true;
  const load=async(userId:string,email?:string)=>{
   const result = await getDiscoverTestsPageData(userId);
   if(!alive)return;
   setName(result.displayName||email?.split("@")[0]||"Tester");
   setAvatar(result.avatarUrl);
   setPoints(result.points);
   setCompleted(result.completed);
   setUnread(result.unread);
   setTests(result.tests as TestRow[]);
   if(result.hasError)
    setError("Some information could not be loaded. You can still explore the available tests.");
   setLoading(false);
  };
  client.auth.getSession().then(({data,error:sessionError})=>{if(!alive)return;if(sessionError){setError("We couldn’t verify your session. Refresh and try again.");setLoading(false);return;}setSession(data.session);if(data.session)void load(data.session.user.id,data.session.user.email);else setLoading(false);}).catch(()=>{if(alive){setError("We couldn’t verify your session.");setLoading(false);}});
  const {data}=client.auth.onAuthStateChange((_event,next)=>{if(!alive)return;setSession(next);if(next){setLoading(true);window.setTimeout(()=>{if(alive)void load(next.user.id,next.user.email);},0);}else{setTests([]);setLoading(false);}});
  return()=>{alive=false;data.subscription.unsubscribe();};
 },[]);
 const visible=useMemo(()=>{const q=query.trim().toLowerCase();const rows=tests.filter(t=>{const text=[t.title,t.description,t.short_summary,t.app?.name,t.app?.category].filter(Boolean).join(" ").toLowerCase();return(!q||text.includes(q))&&(category==="all"||categoryOf(t.app?.category)===category);});if(sort==="title")rows.sort((a,b)=>a.title.localeCompare(b.title));if(sort==="closing")rows.sort((a,b)=>(a.end_date||"9999").localeCompare(b.end_date||"9999"));return rows;},[tests,query,category,sort]);
 if(!loading&&!session&&!previewMode)return <Navigate to="/auth" replace/>;
 const firstName=name.split(/\s+/)[0];
 const nav=[{label:"Dashboard",icon:"flask",href:"/tester-dashboard"},{label:"Discover Tests",icon:"search",href:"/discover-tests",active:true},{label:"My Tests",icon:"tests",href:"/my-tests"},{label:"Wallet & Rewards",icon:"wallet",href:"/wallet-rewards"},...(isAdmin?[{label:"Admin",icon:"shield",href:"/admin"}]:[])];
 return <div className="td-dashboard dt-page">
  <TesterSidebar nav={nav} name={name} firstName={firstName} avatar={avatar} roles={roles} isAdmin={isAdmin} isDeveloper={isDeveloper} workspaceMenuOpen={menuOpen} setWorkspaceMenuOpen={setMenuOpen} previewMode={previewMode}/>
  <main className="td-main dt-main">
   <header className="td-topbar"><div className="td-search" role="search" aria-label="Tester workspace"><Icon name="search" size={20}/><span>Explore testing opportunities</span></div><div className="td-top-actions"><Link to="/profile" className="td-notification" aria-label="Notifications"><Icon name="bell" size={21}/>{unread>0&&<i>{unread>9?"9+":unread}</i>}</Link><span className="td-top-divider"/><Link to="/profile" className="td-profile-short"><span>{avatar?<img src={avatar} alt=""/>:initials(name)}</span><b>⌄</b></Link></div></header>
   <div className="discover-content">
    <section className="discover-hero">
     <div className="discover-hero-copy">
      <span className="discover-eyebrow">🚀 Explore Opportunities</span>
      <h1>Discover Available Tests</h1>
      <p>Find exciting testing opportunities, share useful feedback, and grow your tester journey.</p>
      <form className="discover-search" onSubmit={event=>event.preventDefault()}>
       <span><Icon name="search" size={18}/></span>
       <input value={query} onChange={event=>setQuery(event.target.value)} type="search" placeholder="Search for tests, applications or developers..." aria-label="Search tests"/>
       <button type="submit"><Icon name="search" size={16}/> Search</button>
      </form>
      <div className="discover-categories">
       {filters.map(filter=><button type="button" key={filter.id} onClick={()=>setCategory(filter.id)} className={category===filter.id?"active":""} aria-pressed={category===filter.id}><span className="discover-filter-icon"><Icon name={filter.icon} size={16}/></span><span className="discover-filter-label">{filter.label}</span>{category===filter.id&&<span className="discover-filter-selected" aria-hidden="true"><Icon name="check" size={12}/></span>}</button>)}
      </div>
     </div>
     <div className="discover-hero-art" aria-hidden="true"><HeroIllustration/></div>
    </section>
    <div className="discover-section-heading">
     <h2><Icon name="tests" size={19}/> Available Tests ({visible.length})</h2>
     <label>Sort by: <select value={sort} onChange={event=>setSort(event.target.value)}><option value="newest">Most Recent</option><option value="closing">Closing Soon</option><option value="title">A – Z</option></select></label>
    </div>
    {error&&<div className="discover-empty" role="status">{error}</div>}
    <div className="discover-workspace">
     <section className="discover-grid" aria-live="polite">
      {loading?<div className="discover-empty">Loading available tests…</div>:visible.length?visible.map(test=>{
       const left=daysLeft(test.end_date);
       const type=categoryOf(test.app?.category);
       return <article className="discover-test-card" key={test.id}>
        <div className="discover-card-top">
         <div className={"discover-app-icon app-"+type}>{test.app?.icon_url?<img src={test.app.icon_url} alt=""/>:<span>{type==="mobile"?"▣":type==="web"?"▥":type==="desktop"?"▱":"✦"}</span>}</div>
         <span className="discover-status"><i/>{test.status==="ready"?"Upcoming":"Recruiting"}</span>
        </div>
        <h3>{test.title}</h3>
        <p>{test.short_summary||test.description||"Explore this testing opportunity and review its requirements."}</p>
        <div className="discover-tags"><span><Icon name="code" size={13}/> {test.app?.category||"App"}</span><span>✦ Testing</span></div>
        <div className="discover-meta"><span><Icon name="users" size={14}/> {test.min_testers} testers</span><span><Icon name="clock" size={14}/> {left===null?"Schedule pending":left===0?"Closing today":left+" days left"}</span></div>
        <div className="discover-card-bottom"><strong>Reward details in test brief</strong><Link to={"/tests/"+test.id}>View Details <Icon name="arrow" size={14}/></Link></div>
       </article>;
      }):<div className="discover-empty"><strong>{query||category!=="all"?"No matching tests":"No available tests right now"}</strong><p>{query||category!=="all"?"Try another search or category to find an opportunity.":"New opportunities will appear here when developers publish recruiting tests."}</p>{(query||category!=="all")&&<button type="button" onClick={()=>{setQuery("");setCategory("all");}}>Clear search and filters</button>}</div>}
     </section>
     <aside className="discover-right-rail">
      <section className="discover-reward-card"><div>🏆</div><h3>Your Rewards</h3><strong>{loading?"—":isTesterWorkflowV2Enabled?"Unavailable":points.toLocaleString("en-US")}</strong><span>{isTesterWorkflowV2Enabled?"Reward posting disabled":"Earned points"}</span><Link to="/wallet-rewards">View Wallet <Icon name="arrow" size={14}/></Link></section>
      <section className="discover-stats"><h3><Icon name="tests" size={18}/> Quick Stats</h3><div>
       <article><b className="stat-check">✓</b><strong>{completed}</strong><span>Completed Tests</span></article>
       <article><b className="stat-star">★</b><strong>{isTesterWorkflowV2Enabled?"Unavailable":points.toLocaleString("en-US")}</strong><span>{isTesterWorkflowV2Enabled?"Reward posting disabled":"Earned Points"}</span></article>
       <article><b className="stat-gift">♔</b><strong>{tests.length}</strong><span>Open Tests</span></article>
       <article><b className="stat-time">◷</b><strong>{visible.length}</strong><span>Matching Tests</span></article>
      </div></section>
      <section className="discover-help"><b><Icon name="headset" size={20}/> Need Help?</b><p>Our support team is here to help with joining tests and submitting feedback.</p><Link to="/help-support" className="discover-help-cta"><span>Visit Tester Support</span><span className="discover-help-cta-icon"><Icon name="arrow" size={16}/></span></Link></section>
     </aside>
    </div>
   </div>
  </main>
 </div>;
}
