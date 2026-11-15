import { useEffect, useState } from "react";
import { Link, Navigate, useParams } from "react-router-dom";
import { supabase } from "../../../lib/supabase";
import { isTesterWorkflowV2Enabled, supabaseV2 } from "../../../lib/supabase-v2";
import { useIdentity } from "../../../shared/auth/hooks/useIdentity";
import TesterSidebar, { Icon } from "../components/TesterSidebar";
import "../styles/tester-dashboard.css";
import "../styles/active-assignment-progress.css";

type Assignment={id:string;status:string;start_date:string|null;medical_extension_days:number;test:{id:string;title:string;description:string|null;short_summary:string|null;start_date:string|null;end_date:string|null;app:{name:string;icon_url:string|null;category:string|null;play_store_url:string|null}|null}|null};
type Checkin={id:string;checkin_date:string;evidence_url:string|null};
type Leader={id:string;name:string;avatar:string|null;points:number};
const dateOnly=(v:Date)=>{const d=new Date(v.getTime()-v.getTimezoneOffset()*60000);return d.toISOString().slice(0,10);};
const dateLabel=(v:string|null|undefined)=>v?new Date(v+"T12:00:00").toLocaleDateString(undefined,{month:"short",day:"numeric",year:"numeric"}):"To be announced";
const initials=(v:string)=>v.split(/\s+/).slice(0,2).map(x=>x[0]||"").join("").toUpperCase()||"T";

export default function ActiveAssignmentProgressPage(){
 const {id=""}=useParams();const {session,roles=[]}=useIdentity();
 const preview=import.meta.env.DEV&&new URLSearchParams(window.location.search).get("preview")==="1";
 const [assignment,setAssignment]=useState<Assignment|null>(null),[checkins,setCheckins]=useState<Checkin[]>([]),[feedbackCount,setFeedbackCount]=useState(0),[earned,setEarned]=useState(0);
 const [name,setName]=useState("Tester"),[avatar,setAvatar]=useState(""),[unread,setUnread]=useState(0),[leaders,setLeaders]=useState<Leader[]>([]);
 const [loading,setLoading]=useState(true),[error,setError]=useState(""),[leaderError,setLeaderError]=useState(""),[menuOpen,setMenuOpen]=useState(false);
 const [checkinSubmitting,setCheckinSubmitting]=useState(false),[checkinNotice,setCheckinNotice]=useState("");
 useEffect(()=>{
  if(preview){setAssignment({id:"preview-assignment",status:"active",start_date:"2026-11-04",medical_extension_days:0,test:{id:"preview-test",title:"Productivity Pro",description:"Help us test this productivity application. Explore its core features, check reliability and share honest feedback throughout the testing period.",short_summary:"A productivity app for organizing tasks and improving focus.",start_date:"2026-11-04",end_date:"2026-11-17",app:{name:"BestDev Team",icon_url:null,category:"Productivity",play_store_url:null}}});setCheckins(Array.from({length:7},(_,i)=>({id:String(i),checkin_date:"2026-11-"+String(4+i).padStart(2,"0"),evidence_url:null})));setFeedbackCount(1);setEarned(120);setLeaders([{id:"p1",name:"Sara Dev",avatar:null,points:1180},{id:"p2",name:"Ahmed Tech",avatar:null,points:1250},{id:"p3",name:"Omar Code",avatar:null,points:1100}]);setName("John Doe");setLoading(false);return;}
  if(!session?.user?.id||!id||!supabase){setLoading(false);return;}
  let alive=true;const client=supabase,uid=session.user.id;
  (async()=>{
   if(isTesterWorkflowV2Enabled&&supabaseV2){
    const [profile,notice,a,c,f]=await Promise.all([
     supabaseV2.from("profiles").select("display_name,avatar_url").eq("id",uid).maybeSingle(),
     supabaseV2.from("notifications").select("id",{count:"exact",head:true}).eq("user_id",uid).is("read_at",null),
     supabaseV2.from("assignments").select("id,status,test_id,assigned_at,started_at,medical_extension_days").eq("id",id).eq("tester_id",uid).maybeSingle(),
     supabaseV2.from("checkins").select("id,checkin_date").eq("assignment_id",id).eq("tester_id",uid).order("checkin_date"),
     supabaseV2.from("feedback").select("id",{count:"exact",head:true}).eq("assignment_id",id).eq("tester_id",uid)
    ]);
    if(!alive)return;
    setName(profile.data?.display_name?.trim()||session.user.email?.split("@")[0]||"Tester");
    setAvatar(profile.data?.avatar_url||"");setUnread(notice.count??0);
    if(a.error||!a.data){setError(a.error?.message||"This assignment could not be found.");setLoading(false);return;}
    let startedAt=a.data.started_at as string|null;
    let assignmentStatus=a.data.status as string;
    if(assignmentStatus==="pending"){
     const started=await supabaseV2.rpc("start_assignment",{p_assignment_id:id});
     if(!alive)return;
     if(started.error){setError("This test is not ready to start yet. Please try again when its cohort is ready.");setLoading(false);return;}
     startedAt=started.data as string;assignmentStatus="active";
    }
    const t=await supabaseV2.from("tests").select("id,title,description,short_summary,status,start_date,end_date,app_id").eq("id",a.data.test_id).maybeSingle();
    if(!alive)return;
    if(t.error||!t.data){setError(t.error?.message||"The assigned test could not be found.");setLoading(false);return;}
    const app=await supabaseV2.from("apps").select("name,icon_url,category,play_store_url").eq("id",t.data.app_id).maybeSingle();
    if(!alive)return;
    setAssignment({
     id:a.data.id,status:assignmentStatus,start_date:startedAt||a.data.assigned_at,
     medical_extension_days:a.data.medical_extension_days||0,
     test:{id:t.data.id,title:t.data.title,description:t.data.description,short_summary:t.data.short_summary,
      start_date:t.data.start_date,end_date:t.data.end_date,
      app:app.data||null}
    } as Assignment);
    setCheckins((c.data??[]).map((row:{id:string;checkin_date:string})=>({...row,evidence_url:null})));
    setFeedbackCount(f.count??0);setEarned(0);setLeaders([]);
    setLeaderError("Verified rankings will appear when the secure leaderboard service is available.");
    if(app.error)setError("Some app information could not be loaded.");
    setLoading(false);return;
   }
   const [profile,notice,a,c,f,l,roleRows]=await Promise.all([
    client.from("profiles").select("display_name,avatar_url").eq("id",uid).maybeSingle(),
    client.from("notifications").select("id",{count:"exact",head:true}).eq("user_id",uid).is("read_at",null),
    client.from("assignments").select("id,status,start_date,medical_extension_days,test:tests(id,title,description,short_summary,start_date,end_date,app:apps(name,icon_url,category,play_store_url))").eq("id",id).eq("tester_id",uid).maybeSingle(),
    client.from("checkins").select("id,checkin_date,evidence_url").eq("assignment_id",id).eq("tester_id",uid).order("checkin_date"),
    client.from("feedback").select("id",{count:"exact",head:true}).eq("assignment_id",id).eq("tester_id",uid),
    client.from("points_ledger").select("amount").eq("user_id",uid).eq("wallet_type","earned_points").eq("reference_id",id),
    client.from("user_roles").select("user_id").eq("role","tester").limit(5000)
   ]);
   if(!alive)return;setName(profile.data?.display_name?.trim()||session.user.email?.split("@")[0]||"Tester");setAvatar(profile.data?.avatar_url||"");setUnread(notice.count??0);
   if(a.error||!a.data){setError(a.error?.message||"This assignment could not be found.");setLoading(false);return;}
   setAssignment(a.data as unknown as Assignment);setCheckins((c.data??[]) as Checkin[]);setFeedbackCount(f.count??0);setEarned((l.data??[]).reduce((sum,x)=>sum+Number(x.amount||0),0));
   const ids=(roleRows.data??[]).map(x=>x.user_id);
   if(ids.length){const [profiles,ledger]=await Promise.all([client.from("profiles").select("id,display_name,avatar_url").in("id",ids),client.from("points_ledger").select("user_id,amount").eq("wallet_type","earned_points").in("user_id",ids).limit(20000)]);
    if(!alive)return;if(profiles.error||ledger.error)setLeaderError("Leaderboard rankings are temporarily unavailable.");else{const map=new Map<string,Leader>();for(const p of profiles.data??[])map.set(p.id,{id:p.id,name:p.display_name?.trim()||"TestDZ Tester",avatar:p.avatar_url||null,points:0});for(const x of ledger.data??[]){const row=map.get(x.user_id);if(row)row.points+=Number(x.amount||0);}setLeaders([...map.values()].sort((x,y)=>y.points-x.points).slice(0,3));}}
   setLoading(false);
  })().catch(()=>{if(alive){setError("Unable to load assignment progress.");setLoading(false);}});
  return()=>{alive=false;};
 },[id,session?.user?.id,preview]);
 if(!preview&&!session)return <Navigate to="/auth" replace/>;
 if(!preview&&!roles.includes("tester")&&!loading)return <Navigate to="/dashboard" replace/>;
 const test=assignment?.test,days=14+(assignment?.medical_extension_days||0),today=dateOnly(new Date()),start=assignment?.start_date;
 const elapsed=start?Math.max(1,Math.floor((new Date(today+"T12:00:00").getTime()-new Date(start+"T12:00:00").getTime())/86400000)+1):1;
 const currentDay=Math.min(days,elapsed),progress=Math.min(100,Math.round(checkins.length/days*100)),checkinSet=new Set(checkins.map(x=>x.checkin_date));
 const evidenceCount=checkins.filter(x=>x.evidence_url).length,endDate=start?dateOnly(new Date(new Date(start+"T12:00:00").getTime()+(days-1)*86400000)):null;
 const done=assignment?.status==="completed",leadersSorted=[...leaders].sort((a,b)=>b.points-a.points),myRank=leadersSorted.findIndex(x=>x.id===session?.user?.id)+1;
 const handleCheckin=async()=>{
  if(!isTesterWorkflowV2Enabled||!supabaseV2||!assignment||checkinSubmitting)return;
  setCheckinSubmitting(true);setCheckinNotice("");
  const result=await supabaseV2.rpc("submit_checkin",{p_assignment_id:id,p_note:null});
  if(result.error||!result.data){
   setCheckinNotice("Today's check-in could not be recorded. Please try again.");
   setCheckinSubmitting(false);return;
  }
  const saved=await supabaseV2.from("checkins").select("id,checkin_date").eq("id",result.data).maybeSingle();
  if(saved.data){
   setCheckins(current=>[...current.filter(row=>row.id!==saved.data.id),{id:saved.data!.id,checkin_date:saved.data!.checkin_date,evidence_url:null}].sort((a,b)=>a.checkin_date.localeCompare(b.checkin_date)));
   setCheckinNotice("Your daily check-in has been recorded.");
  }else{
   setCheckinNotice("Check-in was recorded. Refresh to update your history.");
  }
  setCheckinSubmitting(false);
 };
 const nav=[{label:"Dashboard",icon:"home",href:"/tester-dashboard"},{label:"Discover Tests",icon:"search",href:"/discover-tests"},{label:"My Tests",icon:"tests",href:"/my-tests",active:true},{label:"Leaderboard",icon:"trophy",href:"/leaderboard"},{label:"Wallet & Rewards",icon:"wallet",href:"/wallet-rewards"},{label:"Profile",icon:"user",href:"/profile"},{label:"Help & Support",icon:"help",href:"/help-support"},{label:"Settings",icon:"settings",href:"/settings"}];
 return <div className="td-dashboard aap-page"><TesterSidebar nav={nav} name={name} firstName={name.split(/\s+/)[0]||"Tester"} avatar={avatar} roles={preview?["tester",...roles]:roles} isAdmin={roles.includes("admin")} isDeveloper={roles.includes("developer")} workspaceMenuOpen={menuOpen} setWorkspaceMenuOpen={setMenuOpen} previewMode={preview}/>
 <main className="td-main aap-main"><header className="td-topbar"><label className="td-search"><Icon name="search" size={21}/><input placeholder="Search tests..." aria-label="Search tests"/></label><div className="td-top-actions"><Link to="/notifications" className="td-notification" aria-label="Notifications"><Icon name="bell" size={22}/>{unread>0&&<i>{unread>9?"9+":unread}</i>}</Link><span className="td-top-divider"/><Link to="/profile" className="td-profile-short"><span>{avatar?<img src={avatar} alt=""/>:initials(name)}</span><strong>{name}</strong><b>⌄</b></Link></div></header>
 <div className="aap-content"><Link to="/my-tests" className="aap-back"><Icon name="arrow" size={17}/>Back to My Tests</Link>
 {loading?<section className="aap-panel aap-state">Loading your testing progress…</section>:error||!assignment?<section className="aap-panel aap-state"><h1>Assignment unavailable</h1><p>{error||"This assignment could not be found."}</p><Link to="/my-tests">Return to My Tests</Link></section>:<>
 <section className="aap-hero"><div className="aap-app-icon">{test?.app?.icon_url?<img src={test.app.icon_url} alt=""/>:<Icon name="smartphone" size={53}/>}</div><div className="aap-hero-copy"><span className="aap-eyebrow">ACTIVE TEST ASSIGNMENT</span><h1>{test?.title||"Application testing"}</h1><h2>{test?.app?.name||"TestDZ Developer"} · {test?.app?.category||"Android App"}</h2><p>{test?.short_summary||test?.description||"Test the application, complete daily check-ins and share honest feedback."}</p><div className="aap-meta"><span className={done?"done":""}><i/>{done?"Completed":assignment.status==="active"?"Active":assignment.status}</span><span><Icon name="calendar" size={15}/>{dateLabel(start)} – {dateLabel(endDate||test?.end_date||null)}</span></div></div><div className="aap-hero-art" aria-hidden="true"><div className="aap-rocket">↗</div><div className="aap-spark">✦</div><div className="aap-orbit">✓</div></div></section>
 <div className="aap-overview-grid">
 <section className="aap-panel aap-progress-card"><h2><Icon name="chart" size={22}/>Your Progress</h2><div className="aap-progress-body"><div className="aap-ring" style={{"--progress":progress} as React.CSSProperties}><strong>{progress}%</strong><small>Overall Progress</small></div><div className="aap-progress-stats"><div><span><i className="green-dot"/>Check-ins Completed</span><b>{checkins.length} / {days} Days</b></div><div><span><i className="blue-dot"/>Pending Days</span><b>{Math.max(0,days-checkins.length)} Days</b></div><div><span><Icon name="calendar" size={17}/>End Date</span><b>{dateLabel(endDate||test?.end_date||null)}</b></div></div></div></section>
 <section className="aap-panel aap-daily"><div className="aap-section-title"><h2><Icon name="calendar" size={22}/>Daily Progress</h2><span>Day {currentDay} of {days}</span></div><div className="aap-days">{Array.from({length:days},(_,i)=>{const d=start?dateOnly(new Date(new Date(start+"T12:00:00").getTime()+i*86400000)):null;const checked=d?checkinSet.has(d):i<checkins.length;return <div className={"aap-day "+(checked?"completed ":"")+(i+1===currentDay?"today":"")} key={i}><span>{checked?<Icon name="check" size={15}/>:i+1===currentDay?i+1:""}</span><b>{i+1}</b></div>;})}</div><div className="aap-track"><i style={{width:progress+"%"}}/></div><small>{checkins.length} valid check-ins recorded</small></section></div>
 <div className="aap-main-grid">
 <section className="aap-panel aap-tasks"><div className="aap-section-title"><h2><Icon name="check" size={22}/>Today’s Tasks</h2><span>{done?"Completed":"Day "+currentDay+" of "+days}</span></div>
 <div className="aap-task"><span className="aap-task-icon green"><Icon name="check" size={19}/></span><div><strong>Daily Check-in</strong><p>Confirm your participation for today’s testing day.</p></div><button className="aap-task-action secondary" type="button" onClick={handleCheckin} disabled={done||checkinSubmitting}>{checkinSubmitting?"Recording…":start&&checkinSet.has(today)?"Record / Refresh Check-in":"Record Today’s Check-in"}</button></div>
 <div className="aap-task"><span className="aap-task-icon purple"><Icon name="play" size={19}/></span><div><strong>Test the Application</strong><p>Explore the app’s features and report any issues.</p></div>{test?.app?.play_store_url?<a className="aap-task-action" href={test.app.play_store_url} target="_blank" rel="noreferrer">Open App <Icon name="arrow" size={14}/></a>:<span className="aap-task-state">Continue testing</span>}</div>
 <div className="aap-task"><span className="aap-task-icon orange"><Icon name="message" size={19}/></span><div><strong>Share Feedback</strong><p>Report bugs or suggest improvements.</p></div><Link className="aap-task-action" to="/submit-feedback">Submit Feedback <Icon name="arrow" size={14}/></Link></div>
 <div className="aap-task"><span className="aap-task-icon cyan"><Icon name="folder" size={19}/></span><div><strong>Upload Evidence</strong><p>{evidenceCount} evidence file{evidenceCount===1?"":"s"} linked to your check-ins.</p></div><Link className="aap-task-action secondary" to={"/assignments/"+id+"/submit"}>Upload / Submit <Icon name="arrow" size={14}/></Link></div>
 <div className="aap-task-foot"><span>{checkinNotice || `${feedbackCount} feedback entr${feedbackCount===1?"y":"ies"} submitted`}</span><Link to="/feedback-history">View feedback history</Link></div></section>
 <div className="aap-middle"><section className="aap-panel aap-medical"><div className="aap-panel-heading"><span className="purple-icon">✚</span><h2>Medical Exceptions</h2></div><p>Need extra time for a medical reason? Request an exception for Admin review.</p><div className="aap-medical-note"><Icon name="info" size={16}/>Only approved dates extend the testing schedule. Excused dates do not count as check-ins.</div><Link to="/help-support" className="aap-outline-button"><Icon name="file" size={17}/>Request Exception <Icon name="info" size={15}/></Link><span className="aap-request-state">Medical requests are subject to Admin approval.</span></section>
 <section className="aap-panel aap-status"><div className="aap-panel-heading"><span className="status-icon"><Icon name="chart" size={21}/></span><h2>Assignment Status</h2><b className={done?"complete":""}><i/>{done?"Completed":"On Track"}</b></div><p>{done?"Your testing assignment has been completed. View your final summary.":"Keep completing your daily tasks to stay on track with the testing schedule."}</p><div className="aap-chart-art"><i/><i/><i/><i/><span>↗</span></div>{done&&<Link to={"/assignments/"+id+"/summary"}>View completion summary <Icon name="arrow" size={15}/></Link>}</section></div>
 <div className="aap-right"><section className="aap-panel aap-rewards"><div className="aap-section-title"><h2><Icon name="gift" size={22}/>Rewards Progress</h2><strong>+{earned.toLocaleString()} pts</strong></div><p>{isTesterWorkflowV2Enabled?"Reward posting is not enabled yet.":"Points recorded for this assignment"}</p><div className="aap-reward-foot"><Link to="/wallet-rewards">View Wallet History <Icon name="arrow" size={15}/></Link></div></section>
 <section className="aap-panel aap-leaderboard"><div className="aap-leader-head"><div><span className="aap-trophy">🏆</span><div><h2>Top Leaderboard</h2><p>See how you rank among other TestDZ testers.</p></div></div><Link to="/leaderboard">View Full Leaderboard <Icon name="arrow" size={14}/></Link></div>
 {leaderError?<p className="aap-leader-empty">{leaderError}</p>:leadersSorted.length?<div className="aap-podium">{leadersSorted.map((p,i)=><div className={"aap-podium-person place-"+(i+1)} key={p.id}><span className="aap-leader-avatar">{p.avatar?<img src={p.avatar} alt=""/>:initials(p.name)}</span><strong>{p.name}</strong><b>{p.points.toLocaleString()} pts</b><i>{i+1}</i></div>)}</div>:<p className="aap-leader-empty">Verified leaderboard rankings will appear when points are available.</p>}
 {myRank>0&&<small className="aap-my-rank">Your current community rank: #{myRank}</small>}</section></div></div>
 <div className="aap-important"><Icon name="info" size={20}/><span><strong>Important:</strong> Complete 14 consecutive testing days. Approved medical dates extend the schedule; excused days are not check-ins.</span></div>
 </>}
 </div></main></div>;
}
