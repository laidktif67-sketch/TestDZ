import { useEffect, useState } from "react";
import { Link, Navigate, useNavigate, useParams } from "react-router-dom";
import { supabase } from "../../../lib/supabase";
import { isTesterWorkflowV2Enabled, supabaseV2 } from "../../../lib/supabase-v2";
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
function dateLabel(value:string|null){if(!value)return "To be announced";const date=new Date(value+"T00:00:00");return Number.isNaN(date.getTime())?value:date.toLocaleDateString(undefined,{year:"numeric",month:"short",day:"2-digit"});}
function initials(value:string){return value.split(/\s+/).slice(0,2).map(part=>part[0]||"").join("").toUpperCase()||"T";}

export default function TestPreviewPage(){
 const {id}=useParams<{id:string}>();const navigate=useNavigate();const {session,loading:identityLoading,roles}=useIdentity();
 const [test,setTest]=useState<TestPreview|null>(null);const [name,setName]=useState("Tester");const [avatar,setAvatar]=useState("");const [unread,setUnread]=useState(0);
 const [loading,setLoading]=useState(true);const [error,setError]=useState("");const [alreadyAssigned,setAlreadyAssigned]=useState(false);const [joining,setJoining]=useState(false);const [menuOpen,setMenuOpen]=useState(false);
 const previewMode=import.meta.env.DEV&&new URLSearchParams(window.location.search).get("preview")==="1";
 const isAdmin=roles.includes("admin"),isDeveloper=roles.includes("developer");const firstName=name.split(/\s+/)[0];
 useEffect(()=>{
  if(identityLoading)return;
  const client=supabase;
  if(!session||!id||!client){setLoading(false);return;}
  let alive=true;
  const load=async()=>{
   if(isTesterWorkflowV2Enabled&&supabaseV2){
    const [profile,notifications,testResult,assignmentResult]=await Promise.all([
     supabaseV2.from("profiles").select("display_name,avatar_url").eq("id",session.user.id).maybeSingle(),
     supabaseV2.from("notifications").select("id",{count:"exact",head:true}).eq("user_id",session.user.id).is("read_at",null),
     supabaseV2.from("tests").select("id,app_id,title,description,short_summary,status,min_testers,start_date,end_date").eq("id",id).maybeSingle(),
     supabaseV2.from("assignments").select("id,status").eq("test_id",id).eq("tester_id",session.user.id).maybeSingle()
    ]);
    if(!alive)return;
    setName(profile.data?.display_name?.trim()||session.user.email?.split("@")[0]||"Tester");
    setAvatar(profile.data?.avatar_url||"");
    setUnread(notifications.count??0);
    if(testResult.error||!testResult.data){
     setError("This test could not be found or is no longer available.");
    }else{
     const appResult=await supabaseV2.from("apps").select("name,icon_url,category,play_store_url,description").eq("id",testResult.data.app_id).maybeSingle();
     if(!alive)return;
     if(appResult.error)setError("Test details could not be fully loaded.");
     setTest({...testResult.data,app:appResult.data||null} as unknown as TestPreview);
    }
    if(assignmentResult.data)setAlreadyAssigned(true);
    setLoading(false);
    return;
   }
   const [profile,notifications,testResult,assignmentResult]=await Promise.all([
    client.from("profiles").select("display_name,avatar_url").eq("id",session.user.id).maybeSingle(),
    client.from("notifications").select("id",{count:"exact",head:true}).eq("user_id",session.user.id).is("read_at",null),
    client.from("tests").select("id,app_id,title,description,short_summary,status,min_testers,start_date,end_date,app:apps(name,icon_url,category,play_store_url,description)").eq("id",id).maybeSingle(),
    client.from("assignments").select("id,status").eq("test_id",id).eq("tester_id",session.user.id).maybeSingle()
   ]);
   if(!alive)return;
   setName(profile.data?.display_name?.trim()||session.user.email?.split("@")[0]||"Tester");
   setAvatar(profile.data?.avatar_url||"");
   setUnread(notifications.count??0);
   if(testResult.error||!testResult.data)setError("This test could not be found or is no longer available.");
   else setTest(testResult.data as unknown as TestPreview);
   if(assignmentResult.data)setAlreadyAssigned(true);
   setLoading(false);
  };
  void load().catch(()=>{if(alive){setError("Unable to load this test. Please try again.");setLoading(false);}});
  return()=>{alive=false;};
 },[id,identityLoading,session]);
 if(!identityLoading&&!session&&!previewMode)return <Navigate to="/auth" replace/>;
 const nav=[{label:"Dashboard",icon:"flask",href:"/tester-dashboard"},{label:"Discover Tests",icon:"search",href:"/discover-tests"},{label:"My Tests",icon:"tests",href:"/my-tests"},{label:"Feedback History",icon:"star",href:"/feedback-history"},{label:"Wallet & Rewards",icon:"wallet",href:"/wallet-rewards"},...(isAdmin?[{label:"Admin",icon:"shield",href:"/admin"}]:[])];
 const handleAccept=async()=>{
  if(!isTesterWorkflowV2Enabled||!supabaseV2||!id||joining)return;
  setJoining(true);setError("");
  const {data,error:joinError}=await supabaseV2.rpc("join_test",{p_test_id:id});
  if(joinError||!data){
   setError(joinError?.message||"This test could not be joined. It may have reached capacity.");
   setJoining(false);
   return;
  }
  navigate("/assignments/"+data);
 };
 const statusLabel=test?.status==="recruiting"?"Available Now":test?.status==="ready"?"Coming Soon":(test?.status||"Unavailable").replaceAll("_"," ");
 const appName=test?.app?.name||"TestDZ";
 const description=test?.short_summary||test?.description||test?.app?.description||"Help us improve our mobile app! Explore the latest version, check key features, and share your feedback about your experience.";
 return <div className="td-dashboard dt-page to-page">
  <TesterSidebar nav={nav} name={name} firstName={firstName} avatar={avatar} roles={roles} isAdmin={isAdmin} isDeveloper={isDeveloper} workspaceMenuOpen={menuOpen} setWorkspaceMenuOpen={setMenuOpen} previewMode={previewMode}/>
  <main className="td-main dt-main">
   <header className="td-topbar"><label className="td-search"><Icon name="search" size={20}/><input placeholder="Search in TestDZ..." aria-label="Search in TestDZ"/></label><div className="td-top-actions"><Link to="/notifications" className="td-notification" aria-label="Notifications"><Icon name="bell" size={21}/>{unread>0&&<i>{unread>9?"9+":unread}</i>}</Link><span className="td-top-divider"/><Link to="/profile" className="td-profile-short"><span>{avatar?<img src={avatar} alt=""/>:initials(name)}</span><strong>{name}</strong><b>⌄</b></Link></div></header>
   <div className="to-content">
    <Link className="to-back" to="/discover-tests"><Icon name="arrow" size={19}/> Back to Discover</Link>
    {loading?<section className="to-panel to-loading">Loading test preview…</section>:error||!test?<section className="to-panel to-error"><h1>Test not found</h1><p>{error||"This test may no longer be available."}</p><Link className="to-primary" to="/discover-tests">Return to Discover</Link></section>:<>
     <section className="to-hero">
      <div className="to-app-icon">{test.app?.icon_url?<img src={test.app.icon_url} alt={appName}/>:<div className="to-rocket-art"><Icon name="rocket" size={49}/></div>}</div>
      <div className="to-hero-copy"><h1>Test Preview</h1><h2>Review the details before accepting this test</h2></div>
      <div className="to-availability"><span><Icon name="history" size={19}/>{statusLabel}</span><small>Posted on: {dateLabel(test.start_date)}</small></div>
     </section>
     <div className="to-layout">
      <section className="to-main-column">
       <article className="to-panel to-about">
        <div className="to-app-art" aria-label={appName+" preview illustration"}>
         <div className="to-art-orbit"/><div className="to-art-phone"><div className="to-art-notch"/><div className="to-art-check">✓</div><strong>{appName}</strong><span>Mobile Testing<br/>Made Easy</span><div className="to-art-wave"/></div><div className="to-art-search"><Icon name="search" size={43}/></div>
         {test.app?.icon_url&&<div className="to-art-real-icon"><img src={test.app.icon_url} alt=""/></div>}
        </div>
        <div className="to-app-details"><h2>Test Information</h2><p>{description}</p>
         <div className="to-facts">
          <div><Icon name="gift" size={27}/><span>Reward</span><strong>Test reward</strong></div>
          <div><Icon name="history" size={27}/><span>Estimated Time</span><strong>15 – 30 min</strong></div>
          <div><Icon name="chart" size={27}/><span>Difficulty</span><strong className="to-difficulty">Medium</strong></div>
         </div>
        </div>
       </article>
       <article className="to-panel to-tasks"><h2><span><Icon name="tests" size={22}/></span>What You’ll Do</h2><ol><li><i>1</i><span>Explore the app and use its main features.</span></li><li><i>2</i><span>Check for any issues, bugs, or performance problems.</span></li><li><i>3</i><span>Provide detailed feedback with screenshots if needed.</span></li><li><i>4</i><span>Complete the test within the estimated time.</span></li></ol></article>
      </section>
      <aside className="to-side-column">
       <article className="to-panel to-requirements"><h2><span><Icon name="users" size={27}/></span>Eligibility</h2><ul><li><i><Icon name="check" size={15}/></i>Android device (v8.0+)</li><li><i><Icon name="check" size={15}/></i>Internet connection</li><li><i><Icon name="check" size={15}/></i>Basic knowledge of mobile apps</li></ul></article>
       <article className="to-panel to-checklist"><h2><span><Icon name="tests" size={25}/></span>Requirements</h2><ul><li><i><Icon name="check" size={15}/></i>Install the latest version of TestDZ app</li><li><i><Icon name="check" size={15}/></i>Test main features (login, tests, wallet)</li><li><i><Icon name="check" size={15}/></i>Report any bugs or issues</li></ul></article>
       <article className="to-panel to-feedback-banner"><div className="to-trophy" aria-hidden="true">🏆</div><div><h2>Your Feedback Matters!</h2><p>Help us build a better app and earn rewards.</p></div></article>
      </aside>
     </div>
     <footer className="to-bottom-actions"><Link className="to-question" to="/help"><Icon name="info" size={25}/>Ask a Question</Link>{alreadyAssigned?<Link className="to-accept is-assigned" to="/my-tests"><Icon name="check" size={26}/>View My Tests<Icon name="arrow" size={24}/></Link>:<button className="to-accept" type="button" onClick={handleAccept} disabled={!isTesterWorkflowV2Enabled||joining} title={!isTesterWorkflowV2Enabled?"Secure enrollment will be enabled after the V2 backend is deployed to this environment.":""}><Icon name="check" size={27}/><span>{joining?"Joining…":"Accept Test"}</span><Icon name="arrow" size={25}/></button>}</footer>
     {test.app?.play_store_url&&<p className="to-store-link"><a href={test.app.play_store_url} target="_blank" rel="noreferrer"><Icon name="link" size={15}/> View app on Google Play</a></p>}
    </>}
   </div>
  </main>
 </div>;
}
