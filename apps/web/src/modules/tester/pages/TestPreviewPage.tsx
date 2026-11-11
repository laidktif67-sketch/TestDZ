import { useEffect, useState } from "react";
import { Link, Navigate, useParams } from "react-router-dom";
import { supabase } from "../../../lib/supabase";
import { useIdentity } from "../../../shared/auth/hooks/useIdentity";
import TesterSidebar from "../components/TesterSidebar";
import { Icon } from "../components/TesterSidebar";
import "../styles/tester-dashboard.css";
import "../styles/discover-tests.css";
import "../styles/test-overview.css";

type TestPreview = {
 id:string; app_id:string; title:string; description:string|null; short_summary?:string|null;
 status:string; min_testers:number; start_date:string|null; end_date:string|null;
 app:{name:string;icon_url:string|null;category:string|null;play_store_url?:string|null;description?:string|null}|null;
};

function dateLabel(value:string|null){if(!value)return "To be announced";const date=new Date(value+"T00:00:00");return Number.isNaN(date.getTime())?value:date.toLocaleDateString(undefined,{year:"numeric",month:"short",day:"numeric"});}
function initials(value:string){return value.split(/\s+/).slice(0,2).map(part=>part[0]||"").join("").toUpperCase()||"T";}

export default function TestPreviewPage(){
 const {id}=useParams<{id:string}>();const {session,loading:identityLoading,roles}=useIdentity();
 const [test,setTest]=useState<TestPreview|null>(null);const [name,setName]=useState("Tester");const [avatar,setAvatar]=useState("");const [unread,setUnread]=useState(0);
 const [loading,setLoading]=useState(true);const [error,setError]=useState("");const [alreadyAssigned,setAlreadyAssigned]=useState(false);
 const [menuOpen,setMenuOpen]=useState(false);
 const previewMode=import.meta.env.DEV&&new URLSearchParams(window.location.search).get("preview")==="1";
 const isAdmin=roles.includes("admin"),isDeveloper=roles.includes("developer");const firstName=name.split(/\s+/)[0];
 useEffect(()=>{
  if(identityLoading)return;const client=supabase;if(!session||!id||!client){setLoading(false);return;}let alive=true;
  const load=async()=>{
   const [profile,notifications,testResult,assignmentResult]=await Promise.all([
    client.from("profiles").select("display_name,avatar_url").eq("id",session.user.id).maybeSingle(),
    client.from("notifications").select("id",{count:"exact",head:true}).eq("user_id",session.user.id).is("read_at",null),
    client.from("tests").select("id,app_id,title,description,short_summary,status,min_testers,start_date,end_date,app:apps(name,icon_url,category,play_store_url,description)").eq("id",id).maybeSingle(),
    client.from("assignments").select("id,status").eq("test_id",id).eq("tester_id",session.user.id).maybeSingle()
   ]);
   if(!alive)return;setName(profile.data?.display_name?.trim()||session.user.email?.split("@")[0]||"Tester");setAvatar(profile.data?.avatar_url||"");setUnread(notifications.count??0);
   if(testResult.error||!testResult.data)setError("This test could not be found or is no longer available.");else setTest(testResult.data as unknown as TestPreview);
   if(assignmentResult.data)setAlreadyAssigned(true);
   setLoading(false);
  };void load();return()=>{alive=false;};
 },[id,identityLoading,session]);
 if(!identityLoading&&!session&&!previewMode)return <Navigate to="/auth" replace/>;
 const nav=[{label:"Dashboard",icon:"flask",href:"/tester-dashboard"},{label:"Discover Tests",icon:"search",href:"/discover-tests"},{label:"My Tests",icon:"tests",href:"/my-tests"},{label:"Wallet & Rewards",icon:"wallet",href:"/wallet-rewards"},...(isAdmin?[{label:"Admin",icon:"shield",href:"/admin"}]:[])];
 const canJoin=!!test&&test.status==="recruiting"&&!alreadyAssigned;
 const category=test?.app?.category||"Android application";
 return <div className="td-dashboard dt-page to-page">
  <TesterSidebar nav={nav} name={name} firstName={firstName} avatar={avatar} roles={roles} isAdmin={isAdmin} isDeveloper={isDeveloper} workspaceMenuOpen={menuOpen} setWorkspaceMenuOpen={setMenuOpen} previewMode={previewMode}/>
  <main className="td-main dt-main">
   <header className="td-topbar"><label className="td-search"><Icon name="search" size={20}/><input placeholder="Search tests..." aria-label="Search tests"/></label><div className="td-top-actions"><Link to="/notifications" className="td-notification" aria-label="Notifications"><Icon name="bell" size={21}/>{unread>0&&<i>{unread>9?"9+":unread}</i>}</Link><span className="td-top-divider"/><Link to="/profile" className="td-profile-short"><span>{avatar?<img src={avatar} alt=""/>:initials(name)}</span><strong>{name}</strong><b>⌄</b></Link></div></header>
   <div className="to-content">
    <Link className="to-back" to="/discover-tests"><Icon name="arrow" size={17}/> Back to Discover</Link>
    {loading?<section className="to-panel to-loading">Loading test overview…</section>:error||!test?<section className="to-panel to-error"><h1>Test not found</h1><p>{error||"This test may no longer be available."}</p><Link className="to-primary" to="/discover-tests">Return to Discover</Link></section>:<>
     <section className="to-hero">
      <div className="to-app-icon">{test.app?.icon_url?<img src={test.app.icon_url} alt={test.app.name||"Application icon"}/>:<Icon name="smartphone" size={58}/>}</div>
      <div className="to-hero-copy"><span className="to-verified"><Icon name="check-circle" size={15}/> TEST OVERVIEW</span><h1>{test.title}</h1><h2>by {test.app?.name||"App developer"}</h2><p>{test.short_summary||test.description||test.app?.description||"Review this Android application and share your honest testing feedback with its developer."}</p><div className="to-tags"><span>{category}</span><span>Android</span><span>Google Play testing</span></div></div>
      <div className="to-fact"><Icon name="calendar" size={25}/><span>Test Duration</span><strong>14 Days</strong><small>{dateLabel(test.start_date)} – {dateLabel(test.end_date)}</small></div>
      <div className="to-fact"><Icon name="users" size={25}/><span>Minimum Testers</span><strong>{test.min_testers}</strong><small>Required participants</small></div>
      <div className="to-fact"><Icon name="chart" size={25}/><span>Availability</span><strong className="to-status">{test.status==="recruiting"?"Recruiting":test.status==="ready"?"Coming soon":test.status.replaceAll("_"," ")}</strong><small>Current test status</small></div>
     </section>
     <div className="to-layout">
      <section className="to-main-column">
       <article className="to-panel to-about"><div className="to-heading"><span><Icon name="info" size={21}/></span><div><h2>About This Test</h2><p>Get to know the application before joining the testing cycle.</p></div></div><p className="to-description">{test.description||test.short_summary||test.app?.description||"The developer has not provided additional details for this test yet. Review the requirements and testing policy before joining."}</p>
        <div className="to-gallery" aria-label="Application preview gallery">
         <div className="to-device to-device-feature"><div className="to-device-screen"><div className="to-screen-top"><span/><span/><span/></div><div className="to-screen-app">{test.app?.icon_url?<img src={test.app.icon_url} alt=""/>:<Icon name="smartphone" size={45}/>}</div><strong>{test.app?.name||test.title}</strong><small>Application preview</small><div className="to-screen-button">Get Started</div></div></div>
         <div className="to-device"><div className="to-device-screen"><div className="to-screen-top"><span/><span/><span/></div><b className="to-screen-title">Explore</b><div className="to-screen-lines"><i/><i/><i/></div><div className="to-screen-tile"><Icon name="grid" size={24}/><span>Features</span></div></div></div>
         <div className="to-device"><div className="to-device-screen"><div className="to-screen-top"><span/><span/><span/></div><b className="to-screen-title">Activity</b><div className="to-screen-chart"><i/><i/><i/><i/><i/></div><div className="to-screen-lines"><i/><i/></div></div></div>
         <div className="to-device"><div className="to-device-screen"><div className="to-screen-top"><span/><span/><span/></div><b className="to-screen-title">Settings</b><div className="to-screen-list"><i/><i/><i/><i/></div></div></div>
        </div>
        {test.app?.play_store_url&&<a className="to-play-link" href={test.app.play_store_url} target="_blank" rel="noreferrer"><Icon name="external" size={16}/> View on Google Play</a>}
       </article>
       <article className="to-panel to-important"><div className="to-heading"><span><Icon name="lightbulb" size={21}/></span><div><h2>Important Information</h2><p>What to expect when you join this testing cycle.</p></div></div><ul><li>You must complete 14 consecutive testing days with a valid daily check-in.</li><li>Install and explore the application throughout the testing period.</li><li>Provide clear, honest feedback about your experience and any issues.</li><li>Follow the testing guidelines and submit the requested evidence.</li></ul></article>
      </section>
      <aside className="to-side-column">
       <article className="to-panel to-requirements"><div className="to-heading"><span><Icon name="clipboard" size={21}/></span><div><h2>Test Requirements</h2><p>Make sure you can complete these steps.</p></div></div><ul><li><Icon name="check-circle" size={18}/>Use the latest available version of the app</li><li><Icon name="check-circle" size={18}/>Explore the main features regularly</li><li><Icon name="check-circle" size={18}/>Complete daily check-ins for 14 consecutive days</li><li><Icon name="check-circle" size={18}/>Submit useful and honest feedback</li><li><Icon name="check-circle" size={18}/>Follow the testing and evidence guidelines</li></ul></article>
       <article className="to-panel to-reward"><div className="to-reward-icon"><Icon name="gift" size={29}/></div><div><h2>Your Rewards</h2><strong>Reward details</strong><p>Final points are determined by the approved test reward rules.</p></div><div className="to-coins" aria-hidden="true">✦</div></article>
       <article className="to-join-panel">{alreadyAssigned?<Link className="to-primary" to="/my-tests"><Icon name="check-circle" size={20}/> View My Tests</Link>:<button className="to-primary" type="button" disabled={!canJoin} title="Test enrollment will be enabled when the secure cohort assignment flow is available"><Icon name="rocket" size={21}/>{test.status==="recruiting"?"Join Test":"Joining unavailable"}</button>}<p><Icon name="info" size={15}/> By joining, you agree to the testing terms and conditions.</p>{!alreadyAssigned&&<small>Enrollment is managed through the secure tester assignment workflow.</small>}</article>
      </aside>
     </div>
    </>}
   </div>
  </main>
 </div>;
}
