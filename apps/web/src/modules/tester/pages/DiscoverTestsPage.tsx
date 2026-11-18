import { useEffect, useMemo, useState } from "react";
import type { Session } from "@supabase/supabase-js";
import { Link, Navigate } from "react-router-dom";
import { supabase } from "../../../lib/supabase";
import { useIdentity } from "../../../shared/auth/hooks/useIdentity";
import TesterSidebar from "../components/TesterSidebar";
import { Icon } from "../components/TesterSidebar";
import "../styles/tester-dashboard.css";
import "../styles/discover-tests.css";

type AppInfo={name:string;icon_url:string|null;category?:string|null};
type TestRow={id:string;title:string;description:string|null;status:string;min_testers:number;start_date:string|null;end_date:string|null;app?:AppInfo|null};
type Category="all"|"games"|"tools"|"education"|"social"|"health"|"other";
const filters:{id:Category;label:string;symbol:string}[]=[
 {id:"all",label:"All opportunities",symbol:"✦"},
 {id:"games",label:"Games",symbol:"◈"},
 {id:"tools",label:"Tools",symbol:"⚙"},
 {id:"education",label:"Education",symbol:"▤"},
 {id:"social",label:"Social",symbol:"◎"},
 {id:"health",label:"Health",symbol:"＋"},
 {id:"other",label:"Other",symbol:"✧"}
];
function categoryOf(value?:string|null):Category{const v=(value||"").toLowerCase();return ["games","tools","education","social","health","other"].includes(v)?v as Category:"other";}
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
  const client=supabase;if(!client){setLoading(false);setError("Supabase is not configured.");return;}let alive=true;
  const load=async(userId:string,email?:string)=>{
   const [profile,wallet,assignments,notifications,testRows]=await Promise.all([
    client.from("profiles").select("display_name,avatar_url").eq("id",userId).maybeSingle(),
    client.from("wallets").select("earned_points").eq("user_id",userId).maybeSingle(),
    client.from("assignments").select("id,status").eq("tester_id",userId),
    client.from("notifications").select("id",{count:"exact",head:true}).eq("user_id",userId).is("read_at",null),
    client.from("tests").select("id,title,description,status,min_testers,start_date,end_date,app:apps(name,icon_url,category)").in("status",["recruiting","ready"]).order("created_at",{ascending:false}).limit(60)
   ]);
   if(!alive)return;
   setName(profile.data?.display_name?.trim()||email?.split("@")[0]||"Tester");setAvatar(profile.data?.avatar_url||"");
   setPoints(Number(wallet.data?.earned_points??0));setCompleted((assignments.data??[]).filter((a:{status:string})=>a.status==="completed").length);
   setUnread(notifications.count??0);setTests((testRows.data??[]) as unknown as TestRow[]);
   if(profile.error||wallet.error||assignments.error||notifications.error||testRows.error)setError("Some information could not be loaded. You can still explore the available tests.");
   setLoading(false);
  };
  client.auth.getSession().then(({data,error:sessionError})=>{if(!alive)return;if(sessionError){setError("We couldn’t verify your session. Refresh and try again.");setLoading(false);return;}setSession(data.session);if(data.session)void load(data.session.user.id,data.session.user.email);else setLoading(false);}).catch(()=>{if(alive){setError("We couldn’t verify your session.");setLoading(false);}});
  const {data}=client.auth.onAuthStateChange((_event,next)=>{if(!alive)return;setSession(next);if(next){setLoading(true);window.setTimeout(()=>{if(alive)void load(next.user.id,next.user.email);},0);}else{setTests([]);setLoading(false);}});
  return()=>{alive=false;data.subscription.unsubscribe();};
 },[]);
 const visible=useMemo(()=>{const q=query.trim().toLowerCase();const rows=tests.filter(t=>{const text=[t.title,t.description,t.app?.name,t.app?.category].filter(Boolean).join(" ").toLowerCase();return(!q||text.includes(q))&&(category==="all"||categoryOf(t.app?.category)===category);});if(sort==="title")rows.sort((a,b)=>a.title.localeCompare(b.title));if(sort==="closing")rows.sort((a,b)=>(a.end_date||"9999").localeCompare(b.end_date||"9999"));return rows;},[tests,query,category,sort]);
 if(!loading&&!session&&!previewMode)return <Navigate to="/auth" replace/>;
 const firstName=name.split(/\s+/)[0];
 const nav=[{label:"Dashboard",icon:"flask",href:"/tester-dashboard"},{label:"Discover Tests",icon:"search",href:"/discover-tests",active:true},{label:"My Tests",icon:"tests",href:"/my-tests"},{label:"Wallet & Rewards",icon:"wallet",href:"/wallet-rewards"},...(isAdmin?[{label:"Admin",icon:"shield",href:"/admin"}]:[])];
 return <div className="td-dashboard dt-page">
  <TesterSidebar nav={nav} name={name} firstName={firstName} avatar={avatar} roles={roles} isAdmin={isAdmin} isDeveloper={isDeveloper} workspaceMenuOpen={menuOpen} setWorkspaceMenuOpen={setMenuOpen} previewMode={previewMode}/>
  <main className="td-main dt-main">
   <header className="td-topbar"><label className="td-search"><Icon name="search" size={20}/><input value={query} onChange={e=>setQuery(e.target.value)} placeholder="Search tests, apps or skills…"/></label><div className="td-top-actions"><Link to="/profile" className="td-notification" aria-label="Notifications"><Icon name="bell" size={21}/>{unread>0&&<i>{unread>9?"9+":unread}</i>}</Link><span className="td-top-divider"/><Link to="/profile" className="td-profile-short"><span>{avatar?<img src={avatar} alt=""/>:initials(name)}</span><b>⌄</b></Link></div></header>
   <div className="dt-content">
    <section className="dt-hero"><div className="dt-hero-copy"><span className="dt-kicker"><i/> TESTDZ OPPORTUNITIES</span><h1>Discover your next<br/><em>testing opportunity.</em></h1><p>Explore real apps, share useful feedback, and build your tester journey one test at a time.</p><div className="dt-hero-actions"><a href="#dt-results">Explore opportunities <Icon name="arrow" size={16}/></a><span><Icon name="shield" size={15}/> Verified opportunities</span></div></div><div className="dt-hero-art"><HeroIllustration/></div><div className="dt-hero-orbit orbit-one"/><div className="dt-hero-orbit orbit-two"/></section>
    <section className="dt-welcome-row"><div><span className="dt-overline">YOUR TESTER SPACE</span><h2>Find a test that fits you, {firstName}.</h2><p>New opportunities are added as developers open recruitment.</p></div><div className="dt-mini-stats"><article><span><Icon name="tests" size={17}/></span><b>{tests.length}</b><small>Open tests</small></article><article><span><Icon name="check" size={17}/></span><b>{completed}</b><small>Completed</small></article><article><span><Icon name="star" size={17}/></span><b>{points.toLocaleString()}</b><small>Earned points</small></article></div></section>
    <section className="dt-toolbar" id="dt-results"><div className="dt-toolbar-title"><div><span className="dt-overline">FIND YOUR NEXT TEST</span><h2>Available tests <span>{visible.length}</span></h2></div><label className="dt-sort">Sort by <select value={sort} onChange={e=>setSort(e.target.value)}><option value="newest">Recently added</option><option value="closing">Closing soon</option><option value="title">Name A–Z</option></select></label></div><div className="dt-filter-row"><div className="dt-filter-pills">{filters.map(f=><button key={f.id} type="button" className={category===f.id?"active":""} onClick={()=>setCategory(f.id)}><span>{f.symbol}</span>{f.label}</button>)}</div><label className="dt-search"><Icon name="search" size={17}/><input value={query} onChange={e=>setQuery(e.target.value)} placeholder="Search by app or test name"/></label></div></section>
    {error&&<div className="dt-error" role="status">{error}</div>}
    <div className="dt-results-layout"><section className="dt-results" aria-live="polite">{loading?<div className="dt-skeleton-grid">{[1,2,3].map(n=><div className="dt-skeleton" key={n}><i/><b/><span/><span/></div>)}</div>:visible.length?visible.map(test=>{const left=daysLeft(test.end_date);const type=categoryOf(test.app?.category);return <article className="dt-card" key={test.id}><div className="dt-card-top"><div className={"dt-app-icon "+type}>{test.app?.icon_url?<img src={test.app.icon_url} alt=""/>:<span>{type==="mobile"?"▯":type==="web"?"◎":type==="desktop"?"▣":"✦"}</span>}</div><span className={"dt-status "+(test.status==="ready"?"upcoming":"recruiting")}><i/>{test.status==="ready"?"Coming soon":"Recruiting"}</span></div><div className="dt-card-heading"><span>{test.app?.name||"TestDZ application"}</span><h3>{test.title}</h3></div><p className="dt-description">{test.description||"Open this opportunity to review its details and tester requirements."}</p><div className="dt-card-meta"><span><Icon name="users" size={15}/>{test.min_testers} testers needed</span><span><Icon name="clock" size={15}/>{left===null?"Dates to be announced":left===0?"Closing today":left+" days left"}</span></div><div className="dt-card-footer"><span className="dt-reward-note"><Icon name="shield" size={14}/> Reward details in test brief</span><Link to={"/tests/"+test.id}>View test details <Icon name="arrow" size={15}/></Link></div></article>; }):<div className="dt-empty"><span><Icon name="search" size={28}/></span><h3>{query||category!=="all"?"No matching tests":"No open tests just yet"}</h3><p>{query||category!=="all"?"Try another search or category to find an opportunity.":"There are no tests currently open for recruitment. Check back soon for new opportunities."}</p>{(query||category!=="all")&&<button onClick={()=>{setQuery("");setCategory("all");}}>Clear search and filters</button>}</div>}</section>
    <aside className="dt-rail"><article className="dt-points-card"><div className="dt-points-orb"><Icon name="trophy" size={28}/></div><span>YOUR REWARDS</span><strong>{points.toLocaleString()}</strong><small>Available earned points</small><Link to="/wallet-rewards">Open wallet <Icon name="arrow" size={14}/></Link></article><article className="dt-tip-card"><span><Icon name="lightbulb" size={19}/></span><div><b>Make every test count</b><p>Read the requirements carefully and provide clear, reproducible feedback.</p></div></article><article className="dt-help-card"><div><Icon name="help" size={20}/><b>Need a hand?</b></div><p>Questions about joining a test or submitting feedback?</p><Link to="/help-support">Visit tester support <Icon name="arrow" size={14}/></Link></article></aside></div>
    <footer className="dt-footer">TestDZ <span>·</span> Test with purpose. Grow with every experience.</footer>
   </div>
  </main>
 </div>;
}
