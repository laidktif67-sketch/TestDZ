import { useEffect, useState } from "react";
import { Link, Navigate, useParams } from "react-router-dom";
import { supabase } from "../../../lib/supabase";
import { useIdentity } from "../../../shared/auth/hooks/useIdentity";
import TesterSidebar from "../components/TesterSidebar";
import { Icon } from "../components/TesterSidebar";
import "../styles/tester-dashboard.css";
import "../styles/discover-tests.css";

type TestPreview = {
 id:string;
 title:string;
 description:string|null;
 short_summary:string|null;
 status:string;
 min_testers:number;
 start_date:string|null;
 end_date:string|null;
 app:{name:string;icon_url:string|null;category:string|null}|null;
};

function dateLabel(value:string|null){
 if(!value)return "To be announced";
 const date=new Date(value+"T00:00:00");
 return Number.isNaN(date.getTime())?value:date.toLocaleDateString(undefined,{year:"numeric",month:"short",day:"numeric"});
}

function initials(value:string){
 return value.split(/\s+/).slice(0,2).map(part=>part[0]||"").join("").toUpperCase()||"T";
}

export default function TestPreviewPage(){
 const {id}=useParams<{id:string}>();
 const {session,loading:identityLoading,roles}=useIdentity();
 const [test,setTest]=useState<TestPreview|null>(null);
 const [name,setName]=useState("Tester");
 const [avatar,setAvatar]=useState("");
 const [unread,setUnread]=useState(0);
 const [loading,setLoading]=useState(true);
 const [error,setError]=useState("");
 const [menuOpen,setMenuOpen]=useState(false);
 const previewMode=import.meta.env.DEV&&new URLSearchParams(window.location.search).get("preview")==="1";
 const isAdmin=roles.includes("admin"),isDeveloper=roles.includes("developer");
 const firstName=name.split(/\s+/)[0];

 useEffect(()=>{
  if(identityLoading)return;
  if(!session||!id||!supabase){setLoading(false);return;}
  let alive=true;
  const load=async()=>{
   const [profile,notifications,testResult]=await Promise.all([
    supabase.from("profiles").select("display_name,avatar_url").eq("id",session.user.id).maybeSingle(),
    supabase.from("notifications").select("id",{count:"exact",head:true}).eq("user_id",session.user.id).is("read_at",null),
    supabase.from("tests").select("id,title,description,short_summary,status,min_testers,start_date,end_date,app:apps(name,icon_url,category)").eq("id",id).maybeSingle()
   ]);
   if(!alive)return;
   setName(profile.data?.display_name?.trim()||session.user.email?.split("@")[0]||"Tester");
   setAvatar(profile.data?.avatar_url||"");
   setUnread(notifications.count??0);
   if(testResult.error||!testResult.data)setError("This test could not be found or is no longer available.");
   else setTest(testResult.data as unknown as TestPreview);
   setLoading(false);
  };
  void load();
  return()=>{alive=false;};
 },[id,identityLoading,session]);

 if(!identityLoading&&!session&&!previewMode)return <Navigate to="/auth" replace/>;
 const nav=[
  {label:"Dashboard",icon:"flask",href:"/tester-dashboard"},
  {label:"Discover Tests",icon:"search",href:"/discover-tests"},
  {label:"My Tests",icon:"tests",href:"/my-tests"},
  {label:"Wallet & Rewards",icon:"wallet",href:"/wallet-rewards"},
  ...(isAdmin?[{label:"Admin",icon:"shield",href:"/admin"}]:[])
 ];

 return <div className="td-dashboard dt-page">
  <TesterSidebar nav={nav} name={name} firstName={firstName} avatar={avatar} roles={roles} isAdmin={isAdmin} isDeveloper={isDeveloper} workspaceMenuOpen={menuOpen} setWorkspaceMenuOpen={setMenuOpen} previewMode={previewMode}/>
  <main className="td-main dt-main">
   <header className="td-topbar"><div className="td-search" aria-label="Tester workspace"><Icon name="search" size={20}/><span>Test opportunity details</span></div><div className="td-top-actions"><Link to="/profile" className="td-notification" aria-label="Notifications"><Icon name="bell" size={21}/>{unread>0&&<i>{unread>9?"9+":unread}</i>}</Link><span className="td-top-divider"/><Link to="/profile" className="td-profile-short"><span>{avatar?<img src={avatar} alt=""/>:initials(name)}</span><b>⌄</b></Link></div></header>
   <div className="dt-preview-content">
    <Link className="dt-preview-back" to="/discover-tests"><Icon name="arrow" size={15}/> Back to Discover Tests</Link>
    {loading?<section className="dt-preview-panel"><div className="dt-preview-loading"/>Loading test details…</section>:error||!test?<section className="dt-preview-panel"><span className="dt-preview-icon"><Icon name="tests" size={26}/></span><h1>Test not found</h1><p>{error||"This test may no longer be available."}</p><Link className="dt-preview-primary" to="/discover-tests">Return to available tests</Link></section>:<>
     <section className="dt-preview-hero">
      <span className="dt-preview-kicker">TESTING OPPORTUNITY</span>
      <span className={"dt-preview-status "+(test.status==="ready"?"upcoming":"recruiting")}>{test.status==="ready"?"Coming soon":"Recruiting"}</span>
      <h1>{test.title}</h1>
      <p>{test.short_summary||test.description||"Review this opportunity and its tester requirements before the assignment workflow is activated."}</p>
      <div className="dt-preview-app">{test.app?.icon_url?<img src={test.app.icon_url} alt=""/>:<span><Icon name="code" size={19}/></span>}<div><b>{test.app?.name||"TestDZ application"}</b><small>{test.app?.category||"Application"}</small></div></div>
     </section>
     <section className="dt-preview-panel">
      <div className="dt-preview-heading"><span>OVERVIEW</span><h2>Test information</h2></div>
      <div className="dt-preview-facts">
       <article><Icon name="users" size={19}/><span>Target testers</span><strong>{test.min_testers}</strong></article>
       <article><Icon name="clock" size={19}/><span>Start date</span><strong>{dateLabel(test.start_date)}</strong></article>
       <article><Icon name="clock" size={19}/><span>End date</span><strong>{dateLabel(test.end_date)}</strong></article>
       <article><Icon name="shield" size={19}/><span>Test status</span><strong>{test.status.replaceAll("_"," ")}</strong></article>
      </div>
      <div className="dt-preview-description"><h3>About this test</h3><p>{test.description||test.short_summary||"The developer has not added a detailed description yet."}</p></div>
      <div className="dt-preview-notice"><Icon name="help" size={18}/><p>This is the opportunity preview. Joining and assignment actions remain unavailable here until the approved tester workflow is implemented.</p></div>
      <Link className="dt-preview-primary" to="/discover-tests">Back to available tests</Link>
     </section>
    </>}
   </div>
  </main>
 </div>;
}
