import { useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import type { Session } from "@supabase/supabase-js";
import { Link, Navigate } from "react-router-dom";
import { supabase } from "../lib/supabase";
import "../styles/tester-dashboard.css";
import "../styles/my-tests.css";

type Assignment = { id:string; status:string; start_date:string|null; completed_at:string|null; created_at:string; test?:{id:string;title:string;status:string;end_date:string|null;app?:{name:string;icon_url:string|null}|null}|null; checkins?:{id:string;checkin_date:string;created_at:string}[] };
type Activity = {id:string;kind:"checkin"|"feedback"|"completed";title:string;detail:string;date:string};
function I({name,size=20}:{name:string;size?:number}){
 const paths:Record<string,ReactNode>={
  flask:<><path d="M9 3h6M10 3v6l-5 9a2.4 2.4 0 0 0 2.1 3.6h9.8A2.4 2.4 0 0 0 19 18l-5-9V3"/><path d="M7.5 15h9"/></>,
  search:<><circle cx="10.8" cy="10.8" r="7.1"/><path d="m16 16 4.5 4.5"/></>,
  tests:<><rect x="5" y="3.5" width="14" height="17" rx="2.2"/><path d="M9 3.5V2.8h6v.7M8.5 10h7M8.5 13.5h4.2M8.5 17h2.2"/></>,
  wallet:<><rect x="3" y="6" width="18" height="15" rx="2.3"/><path d="M3 9.5h18M16 14h2.5"/></>,
  shield:<><path d="M12 21.5s8-3.8 8-9.6V5.2L12 2.5 4 5.2v6.7c0 5.8 8 9.6 8 9.6Z"/><path d="m8.7 12 2.1 2.1 4.6-4.7"/></>,
  bell:<><path d="M18.2 9a6.2 6.2 0 0 0-12.4 0c0 7-2.8 7.1-2.8 9h18c0-1.9-2.8-2-2.8-9Z"/><path d="M9.5 21h5"/></>,
  arrow:<><path d="M5 12h13.5"/><path d="m13 6.5 5.5 5.5-5.5 5.5"/></>,
  check:<path d="m5 12.5 4.2 4.2L19.5 6.5"/>,
  clock:<><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3.2 2"/></>,
  trophy:<><path d="M8 3.5h8v6.2a4 4 0 0 1-8 0V3.5Z"/><path d="M8 6H4v2.2a4.2 4.2 0 0 0 4.2 4.2M16 6h4v2.2a4.2 4.2 0 0 1-4.2 4.2M12 14v5M8.5 21h7"/></>,
  gift:<><rect x="3" y="9" width="18" height="12" rx="1.8"/><path d="M2.5 6.5h19v3h-19zM12 6.5v14.5"/></>,
  star:<path d="m12 2.8 2.8 5.7 6.3.9-4.6 4.5 1.1 6.3-5.6-3-5.6 3 1.1-6.3-4.6-4.5 6.3-.9L12 2.8Z"/>,
  settings:<><circle cx="12" cy="12" r="3.1"/><path d="m19 14 1 1-2 3-1.5-.6a8 8 0 0 1-1.7 1l-.2 1.5h-3.4L11 19.4a8 8 0 0 1-1.7-1l-1.4.6-1.7-3 1.1-1a7 7 0 0 1 0-2l-1.1-1 1.7-3 1.4.6a8 8 0 0 1 1.7-1l.2-1.5h3.4l.2 1.5a8 8 0 0 1 1.7 1l1.4-.6 1.7 3-1.1 1a7 7 0 0 1 0 2Z"/></>,
  code:<><path d="m8 8-4 4 4 4m8-8 4 4-4 4m-2-11-4 14"/></>,
  logout:<><path d="M10 17.2 15.2 12 10 6.8M15 12H3.5"/><path d="M12.5 3.5h6A2.5 2.5 0 0 1 21 6v12a2.5 2.5 0 0 1-2.5 2.5h-6"/></>,
  chevron:<path d="m7 10 5 5 5-5"/>,
  award:<><circle cx="12" cy="8.5" r="5.5"/><path d="m8.5 13-1 8 4.5-2.5 4.5 2.5-1-8"/></>,
  play:<><circle cx="12" cy="12" r="9"/><path d="m10 8.5 6 3.5-6 3.5v-7Z" fill="currentColor" stroke="none"/></>,
  calendar:<><rect x="3" y="5" width="18" height="16" rx="2"/><path d="M7 3v4m10-4v4M3 10h18"/></>
 };
 return <svg className="mt-icon" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{paths[name]||paths.star}</svg>;
}
function dateLabel(value:string){return new Date(value).toLocaleDateString(undefined,{month:"short",day:"numeric",year:"numeric"});}
function dayDiff(a:string,b:string){return Math.max(0,Math.round((new Date(b+"T00:00:00").getTime()-new Date(a+"T00:00:00").getTime())/86400000));}
export default function MyTestsPage(){
 const [session,setSession]=useState<Session|null>(null),[roles,setRoles]=useState<string[]>([]);
 const [name,setName]=useState("there"),[avatar,setAvatar]=useState(""),[assignments,setAssignments]=useState<Assignment[]>([]);
 const [points,setPoints]=useState(0),[acceptedFeedback,setAcceptedFeedback]=useState(0),[activities,setActivities]=useState<Activity[]>([]);
 const [notifications,setNotifications]=useState(0),[search,setSearch]=useState(""),[menuOpen,setMenuOpen]=useState(false),[loading,setLoading]=useState(true),[error,setError]=useState("");
 const previewMode=import.meta.env.DEV&&new URLSearchParams(window.location.search).get("preview")==="1";
 useEffect(()=>{
  if(previewMode){
   setName("John Doe");setRoles(["tester","developer"]);setPoints(2450);setAcceptedFeedback(5);setNotifications(3);
   const today=new Date();const start=new Date(today);start.setDate(start.getDate()-8);const end=new Date(today);end.setDate(end.getDate()+6);const iso=(d:Date)=>d.toISOString().slice(0,10);const completedOne=new Date(today);completedOne.setDate(completedOne.getDate()-3);const completedTwo=new Date(today);completedTwo.setDate(completedTwo.getDate()-2);const createdOld=new Date(today);createdOld.setDate(createdOld.getDate()-9);const createdRecent=new Date(today);createdRecent.setDate(createdRecent.getDate()-1);
   const demo:Assignment[]=[
    {id:"p1",status:"active",start_date:iso(start),completed_at:null,created_at:iso(start),test:{id:"t1",title:"Web Development Basics",status:"running",end_date:iso(end),app:{name:"CodeMaster",icon_url:null}},checkins:Array.from({length:8},(_,i)=>{const d=new Date(start);d.setDate(d.getDate()+i);return{id:"c"+i,checkin_date:iso(d),created_at:iso(d)+"T10:00:00Z"};})},
    {id:"p2",status:"completed",start_date:iso(createdOld),completed_at:completedOne.toISOString(),created_at:iso(createdOld),test:{id:"t2",title:"Python Basics",status:"completed",end_date:iso(completedOne),app:{name:"Python",icon_url:null}},checkins:[]},
    {id:"p3",status:"completed",start_date:iso(createdOld),completed_at:completedTwo.toISOString(),created_at:iso(createdOld),test:{id:"t3",title:"Data Science Intro",status:"completed",end_date:iso(completedTwo),app:{name:"DataLab",icon_url:null}},checkins:[]},
    {id:"p4",status:"pending",start_date:null,completed_at:null,created_at:iso(createdRecent),test:{id:"t4",title:"React Native Essentials",status:"ready",end_date:null,app:{name:"React Native",icon_url:null}},checkins:[]},
    {id:"p5",status:"pending",start_date:null,completed_at:null,created_at:iso(today),test:{id:"t5",title:"UI Design Foundations",status:"recruiting",end_date:null,app:{name:"DesignLab",icon_url:null}},checkins:[]}
   ];
   setAssignments(demo);setActivities([
    {id:"a1",kind:"completed",title:"You earned +120 points",detail:"from Python Basics",date:completedOne.toISOString()},
    {id:"a2",kind:"feedback",title:"You submitted feedback",detail:"on Web Development Basics",date:completedTwo.toISOString()},
    {id:"a3",kind:"checkin",title:"You completed a test check-in",detail:"Web Development Basics",date:iso(start)+"T08:00:00Z"}
   ]);setLoading(false);return;
  }
  const client=supabase;if(!client){setLoading(false);return;}let alive=true;
  const load=async(userId:string,email?:string)=>{
   const [roleRes,profileRes,walletRes,assignmentRes,feedbackRes,noticeRes]=await Promise.all([
    client.from("user_roles").select("role").eq("user_id",userId),
    client.from("profiles").select("display_name,avatar_url").eq("id",userId).maybeSingle(),
    client.from("wallets").select("earned_points").eq("user_id",userId).maybeSingle(),
    client.from("assignments").select("id,status,start_date,completed_at,created_at,test:tests(id,title,status,end_date,app:apps(name,icon_url)),checkins(id,checkin_date,created_at)").eq("tester_id",userId).order("created_at",{ascending:false}),
    client.from("feedback").select("id,quality_status,created_at,assignment_id").eq("tester_id",userId).order("created_at",{ascending:false}),
    client.from("notifications").select("id",{count:"exact",head:true}).eq("user_id",userId).is("read_at",null)
   ]);
   if(!alive)return;
   setRoles((roleRes.data??[]).map((r:{role:string})=>r.role));setName(profileRes.data?.display_name?.trim()||email?.split("@")[0]||"there");setAvatar(profileRes.data?.avatar_url||"");
   const rows=(assignmentRes.data??[]) as unknown as Assignment[];setAssignments(rows);setPoints(Number(walletRes.data?.earned_points??0));
   setAcceptedFeedback((feedbackRes.data??[]).filter((f:{quality_status:string})=>f.quality_status==="accepted").length);setNotifications(noticeRes.count??0);
   const events:Activity[]=[];
   rows.forEach(a=>{if(a.completed_at)events.push({id:"done-"+a.id,kind:"completed",title:"You completed a test",detail:a.test?.title||"Test",date:a.completed_at});(a.checkins??[]).forEach(c=>events.push({id:"check-"+c.id,kind:"checkin",title:"You completed a check-in",detail:a.test?.title||"Test",date:c.created_at||c.checkin_date}));});
   (feedbackRes.data??[]).forEach((f:{id:string;created_at:string;assignment_id:string})=>{const a=rows.find(x=>x.id===f.assignment_id);events.push({id:"feedback-"+f.id,kind:"feedback",title:"You submitted feedback",detail:a?.test?.title||"Test feedback",date:f.created_at});});
   setActivities(events.sort((a,b)=>new Date(b.date).getTime()-new Date(a.date).getTime()).slice(0,4));
   if(roleRes.error||profileRes.error||assignmentRes.error||feedbackRes.error)setError("Some tester information could not be loaded. Please refresh and try again.");
  };
  client.auth.getSession().then(({data})=>{if(!alive)return;setSession(data.session);if(data.session)void load(data.session.user.id,data.session.user.email);else setLoading(false);});
  const {data}=client.auth.onAuthStateChange((_event,next)=>{setSession(next);if(next)window.setTimeout(()=>{if(alive)void load(next.user.id,next.user.email);},0);else{setRoles([]);setLoading(false);}});
  return()=>{alive=false;data.subscription.unsubscribe();};
 },[previewMode]);
 const firstName=name.split(/\s+/)[0],isAdmin=roles.includes("admin"),isDeveloper=roles.includes("developer");
 const visible=useMemo(()=>assignments.filter(a=>(a.test?.title||"").toLowerCase().includes(search.toLowerCase())),[assignments,search]);
 const active=visible.filter(a=>a.status==="active"),completed=visible.filter(a=>a.status==="completed"),upcoming=visible.filter(a=>a.status==="pending");
 const done=assignments.filter(a=>a.status==="completed").length,total=assignments.length;
 const progressValues=assignments.map(a=>{if(a.status==="completed")return 100;if(a.status!=="active"||!a.start_date||!a.test?.end_date)return 0;const days=Math.max(1,dayDiff(a.start_date,a.test.end_date));return Math.min(99,Math.round(dayDiff(a.start_date,new Date().toISOString().slice(0,10))/days*100));});
 const overall=previewMode?70:(progressValues.length?Math.round(progressValues.reduce((s,v)=>s+v,0)/progressValues.length):0);
 const checkinTotal=assignments.reduce((s,a)=>s+(a.checkins?.length||0),0);
 const achievements=[
  {title:"First Steps",sub:"Complete your first test",earned:done>=1,tone:"gold",icon:"star"},
  {title:"Consistency",sub:"Complete 7 check-ins",earned:checkinTotal>=7,tone:"fire",icon:"bolt"},
  {title:"Feedback Hero",sub:"Get 5 accepted feedbacks",earned:acceptedFeedback>=5,tone:"blue",icon:"award"}
 ];
 if(loading)return <div className="td-loading"><span className="td-spinner"/>Loading your tests…</div>;
 if(!session&&!previewMode)return <Navigate to="/auth" replace/>;
 return <div className="td-dashboard mt-page">
  <aside className="td-sidebar">
   <Link to="/tester-dashboard" className="td-brand"><span className="td-brand-flask"><I name="flask" size={31}/></span><strong>TestDZ</strong><small>Test · Learn · Grow</small></Link>
   <nav className="td-side-nav"><Link to="/tester-dashboard" className="td-nav-link"><I name="flask"/><span>Dashboard</span></Link><Link to="/apps" className="td-nav-link"><I name="search"/><span>Discover</span></Link><Link to="/my-tests" className="td-nav-link active"><I name="tests"/><span>My Tests</span></Link><Link to="/profile" className="td-nav-link"><I name="wallet"/><span>Billing</span></Link>{isAdmin&&<Link to="/profile" className="td-nav-link"><I name="shield"/><span>Admin</span></Link>}</nav>
   <div className="td-sidebar-promo"><div className="td-rocket"><I name="trophy" size={40}/></div><strong>Reach Your Full Potential</strong><p>Build skills, earn points and grow with TestDZ!</p><Link to="/profile">View Rewards <I name="arrow" size={14}/></Link></div>
   <div className="td-user-menu-wrap"><button type="button" className="td-user-mini td-user-trigger" aria-expanded={menuOpen} onClick={()=>setMenuOpen(v=>!v)}><div className="td-avatar">{avatar?<img src={avatar} alt=""/>:firstName.slice(0,1).toUpperCase()}</div><div><strong>{name}</strong><small>{isDeveloper?"Developer":"Tester"}</small></div><I name="chevron" size={17}/></button>{menuOpen&&<div className="td-workspace-menu"><Link to="/profile" onClick={()=>setMenuOpen(false)}><I name="settings" size={16}/><span>Profile settings</span></Link>{isDeveloper&&<><span className="td-workspace-menu-label">SWITCH WORKSPACE</span><Link to="/tester-dashboard" onClick={()=>setMenuOpen(false)}><I name="flask" size={16}/><span>Tester Dashboard</span></Link><Link to="/developer-dashboard" onClick={()=>setMenuOpen(false)}><I name="code" size={16}/><span>Developer Dashboard</span></Link></>}</div>}</div>
   {previewMode?<div className="td-signout td-preview-note">Preview mode · read only</div>:<button className="td-signout" onClick={async()=>{await supabase?.auth.signOut();}}><I name="logout"/>Sign Out</button>}
  </aside>
  <main className="td-main mt-main">
   <header className="td-topbar"><label className="td-search"><I name="search" size={21}/><input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search your tests…"/></label><div className="td-top-actions"><Link to="/profile" className="td-notification" aria-label="Notifications"><I name="bell" size={22}/>{notifications>0&&<i>{notifications>9?"9+":notifications}</i>}</Link><span className="td-top-divider"/><Link to="/profile" className="td-profile-short"><span>{avatar?<img src={avatar} alt=""/>:firstName.slice(0,2).toUpperCase()}</span><b>⌄</b></Link></div></header>
   <div className="mt-breadcrumb"><Link to="/tester-dashboard">← Back to Dashboard</Link><span>/</span><strong>Tester Progress</strong></div>
   <section className="mt-hero"><div className="mt-avatar">{avatar?<img src={avatar} alt=""/>:<span>{firstName.slice(0,1).toUpperCase()}</span>}<i>✓</i></div><div className="mt-identity"><h1>{name}</h1><p><span className="mt-online-dot"/>Active Tester <b>·</b> Member since {session?.user.created_at?dateLabel(session.user.created_at):"your first day"}</p><strong className="mt-points"><I name="star" size={18}/>{points.toLocaleString()} pts</strong></div><div className="mt-quote"><p>“Keep going!<br/>You’re doing great!”</p><span>✦</span></div><div className="mt-hero-trophy"><I name="trophy" size={86}/><i>✦</i></div></section>
   {error&&<div className="mt-error">{error}</div>}
   <section className="mt-stat-grid">
    <article className="mt-stat"><span className="mt-stat-blue"><I name="tests" size={34}/></span><div><strong>{total}</strong><b>Total Tests</b><small>{done} Completed · {active.length} Active · {upcoming.length} Upcoming</small></div></article>
    <article className="mt-stat"><span className="mt-stat-teal"><I name="check" size={34}/></span><div><strong>{overall}%</strong><b>Overall Progress</b><div className="mt-progress-track"><i style={{width:overall+"%"}}/></div></div></article>
    <article className="mt-stat"><span className="mt-stat-gold"><I name="star" size={38}/></span><div><strong>{points.toLocaleString()}</strong><b>Total Points</b><small className="mt-green-copy">Earned points balance</small></div></article>
    <article className="mt-stat"><span className="mt-stat-purple"><I name="gift" size={34}/></span><div><strong>{achievements.filter(a=>a.earned).length}</strong><b>Milestones Earned</b><small>Achievement progress</small></div></article>
   </section>
   <section className="mt-content-grid">
    <article className="mt-panel mt-active-panel"><div className="mt-panel-title"><h2><span className="mt-lightning">ϟ</span>Active Tests</h2><span className="mt-count">{active.length} active</span></div>
     {active.length?active.map(a=>{const days=a.start_date&&a.test?.end_date?Math.max(1,dayDiff(a.start_date,a.test.end_date)):14;const elapsed=a.start_date?Math.min(days,dayDiff(a.start_date,new Date().toISOString().slice(0,10))):a.checkins?.length||0;const pct=Math.min(99,Math.round(elapsed/days*100));const remaining=a.test?.end_date?dayDiff(new Date().toISOString().slice(0,10),a.test.end_date):null;return <div className="mt-active-card" key={a.id}><div className="mt-app-icon">{a.test?.app?.icon_url?<img src={a.test.app.icon_url} alt=""/>:<I name="code" size={34}/>}<span><I name="play" size={13}/></span></div><div className="mt-active-info"><h3>{a.test?.title||"Test assignment"}</h3><p>Keep testing and submit your daily check-ins</p><div className="mt-active-meta"><span><I name="calendar" size={15}/>{remaining===null?"In progress":remaining===0?"Ends today":"Ends in "+remaining+" days"}</span><b>{elapsed} / {days} days</b></div><div className="mt-progress-track"><i style={{width:pct+"%"}}/></div></div><Link to="/apps" className="mt-continue">Continue Test <I name="arrow" size={15}/></Link></div>}) : <div className="mt-empty">No active tests yet. Explore available tests to get started.</div>}
    </article>
    <article className="mt-panel mt-achievements"><div className="mt-panel-title"><h2><I name="trophy" size={22}/>Achievements</h2><span>Milestones</span></div><div className="mt-badges">{achievements.map(a=><div className={"mt-badge "+a.tone+" "+(a.earned?"earned":"locked")} key={a.title}><span><I name={a.icon} size={27}/></span><strong>{a.title}</strong><small>{a.sub}</small></div>)}</div></article>
    <article className="mt-panel mt-history"><div className="mt-panel-title"><h2><I name="clock" size={22}/>Test History</h2><span>{completed.length} completed</span></div><div className="mt-table-wrap"><table><thead><tr><th>Test</th><th>Status</th><th>Progress</th><th>Points</th><th>Date</th></tr></thead><tbody>{completed.slice(0,5).map(a=><tr key={a.id}><td><strong>{a.test?.title||"Test"}</strong></td><td><span className="mt-status completed"><I name="check" size={12}/>Completed</span></td><td>Completed</td><td>—</td><td>{a.completed_at?dateLabel(a.completed_at):"—"}</td></tr>)}{upcoming.slice(0,2).map(a=><tr key={a.id}><td><strong>{a.test?.title||"Test"}</strong></td><td><span className="mt-status upcoming">Upcoming</span></td><td>Not started</td><td>—</td><td>{dateLabel(a.created_at)}</td></tr>)}{!completed.length&&!upcoming.length&&<tr><td colSpan={5} className="mt-table-empty">Your completed tests will appear here.</td></tr>}</tbody></table></div></article>
    <article className="mt-panel mt-activity"><div className="mt-panel-title"><h2><span className="mt-pulse">⌁</span>Recent Activity</h2></div>{activities.length?<div className="mt-activity-list">{activities.slice(0,4).map(a=><div className="mt-activity-item" key={a.id}><span className={"mt-activity-icon "+a.kind}>{a.kind==="completed"?<I name="star" size={17}/>:a.kind==="feedback"?<I name="tests" size={17}/>:<I name="check" size={17}/>}</span><div><strong>{a.title}</strong><small>{a.detail}</small></div><time>{dateLabel(a.date)}</time></div>)}</div>:<div className="mt-empty">Your activity will appear here as you participate in tests.</div>}</article>
   </section>
   <footer className="td-footer">TestDZ · Test · Learn · Grow</footer>
  </main>
 </div>;
}
