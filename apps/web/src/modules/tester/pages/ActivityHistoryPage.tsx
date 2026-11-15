import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "../../../lib/supabase";
import { isTesterWorkflowV2Enabled, supabaseV2 } from "../../../lib/supabase-v2";
import { useIdentity } from "../../../shared/auth/hooks/useIdentity";
import TesterSidebar, { Icon } from "../components/TesterSidebar";
import "../styles/tester-dashboard.css";
import "../styles/activity-history.css";

type Assignment = {
  id: string; status: string; start_date: string | null; completed_at: string | null; created_at: string;
  test?: { id: string; title: string; status: string; app?: { name: string; icon_url: string | null } | null } | null;
  checkins?: { id: string; checkin_date: string; created_at: string }[];
};
type Feedback = { id: string; assignment_id: string; rating: number | null; quality_status: string; created_at: string };
type Ledger = { amount: number; reference_id: string | null; wallet_type: string };
type ActivityEvent = { id: string; kind: "completed" | "checkin" | "feedback"; title: string; detail: string; date: string };
type Filter = "all" | "completed" | "pending" | "rejected";

const dateTimeLabel = (value: string) => {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "—" : date.toLocaleString(undefined, { month: "short", day: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" });
};
const dayKey = (value: string) => {
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return value;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "" : date.getFullYear() + "-" + String(date.getMonth()+1).padStart(2,"0") + "-" + String(date.getDate()).padStart(2,"0");
};
const csvCell = (value: unknown) => '"' + String(value ?? "").replace(/"/g, '""') + '"';

function AppMark({ name, url }: { name: string; url: string | null }) {
  return <span className="ah-app-mark">{url ? <img src={url} alt="" /> : <span>{name.slice(0,1).toUpperCase()}</span>}</span>;
}

function ActivityChart({ events }: { events: ActivityEvent[] }) {
  const days = useMemo(() => Array.from({ length: 15 }, (_, index) => {
    const date = new Date(); date.setHours(0,0,0,0); date.setDate(date.getDate() - (14-index));
    const key = dayKey(date.toISOString());
    return { key, label: date.toLocaleDateString(undefined,{month:"short",day:"2-digit"}), tests: events.filter(event => event.kind === "completed" && dayKey(event.date) === key).length, engagement: events.filter(event => event.kind !== "completed" && dayKey(event.date) === key).length };
  }), [events]);
  const max = Math.max(4, ...days.map(day => Math.max(day.tests,day.engagement)));
  const makeLine=(key:"tests"|"engagement")=>days.map((day,index)=>({x:18+index*47,y:116-day[key]/max*88,...day})).map((point,index)=>(index?"L":"M")+point.x+" "+point.y).join(" ");
  const tests=makeLine("tests"),engagement=makeLine("engagement");
  return <div className="ah-chart-wrap">
    <div className="ah-chart-y"><span>{max}</span><span>{Math.ceil(max*.66)}</span><span>{Math.ceil(max*.33)}</span><span>0</span></div>
    <svg viewBox="0 0 690 132" preserveAspectRatio="none" role="img" aria-label="Completed tests and engagement activities over the last 15 days" className="ah-chart">
      {[28,58,88,118].map(y=><line key={y} x1="18" y1={y} x2="678" y2={y} stroke="#e5edf8" strokeDasharray="3 4"/>)}
      <path d={tests+" L"+(18+14*47)+" 126 L18 126 Z"} fill="#1764ef" fillOpacity=".08"/>
      <path d={engagement+" L"+(18+14*47)+" 126 L18 126 Z"} fill="#10aeb2" fillOpacity=".08"/>
      <path d={tests} fill="none" stroke="#075cf5" strokeWidth="3.2" strokeLinecap="round" strokeLinejoin="round"/>
      <path d={engagement} fill="none" stroke="#10aeb2" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"/>
      {days.map((day,index)=><g key={day.key}><circle cx={18+index*47} cy={116-day.tests/max*88} r="3.5" fill="#075cf5" stroke="#fff" strokeWidth="1.5"><title>{day.label}: {day.tests} completed tests</title></circle><circle cx={18+index*47} cy={116-day.engagement/max*88} r="3.5" fill="#10aeb2" stroke="#fff" strokeWidth="1.5"><title>{day.label}: {day.engagement} check-ins and feedback</title></circle></g>)}
    </svg>
    <div className="ah-chart-x">{[0,3,6,9,12,14].map(index=><span key={index}>{days[index].label}</span>)}</div>
  </div>;
}

function ActivityBreakdown({ events }: { events: ActivityEvent[] }) {
  const parts=[{label:"Tests Completed",value:events.filter(item=>item.kind==="completed").length,color:"#075be8"},{label:"Check-ins",value:events.filter(item=>item.kind==="checkin").length,color:"#10aeb2"},{label:"Feedback",value:events.filter(item=>item.kind==="feedback").length,color:"#8b4de8"}];
  const total=parts.reduce((sum,item)=>sum+item.value,0);
  let offset=0;
  const gradient=total?parts.map(item=>{const start=offset;offset+=item.value/total*100;return item.color+" "+start+"% "+offset+"%";}).join(", "):"#e8eef8 0% 100%";
  return <div className="ah-breakdown">
    <div className="ah-donut" style={{background:"conic-gradient("+gradient+")"}}><span><strong>{total}</strong><small>Activities</small></span></div>
    <div className="ah-breakdown-legend">{parts.map(item=><div key={item.label}><i style={{background:item.color}}/><span>{item.label}</span><strong>{item.value}</strong><small>{total?Math.round(item.value/total*100):0}%</small></div>)}</div>
  </div>;
}

export default function ActivityHistoryPage() {
  const { session, roles = [] } = useIdentity();
  const [name,setName]=useState("Tester"),[avatar,setAvatar]=useState(""),[menuOpen,setMenuOpen]=useState(false);
  const [assignments,setAssignments]=useState<Assignment[]>([]),[feedback,setFeedback]=useState<Feedback[]>([]),[ledger,setLedger]=useState<Ledger[]>([]);
  const [notifications,setNotifications]=useState(0),[loading,setLoading]=useState(true),[error,setError]=useState("");
  const [filter,setFilter]=useState<Filter>("all"),[range,setRange]=useState("30"),[search,setSearch]=useState(""),[page,setPage]=useState(1);
  const previewMode=import.meta.env.DEV && new URLSearchParams(window.location.search).get("preview")==="1";
  const isAdmin=roles.includes("admin"),isDeveloper=roles.includes("developer"),firstName=name.split(/\s+/)[0]||"Tester";

  useEffect(()=>{
    if(previewMode){
      const now=new Date(); const at=(days:number)=>{const d=new Date(now);d.setDate(d.getDate()-days);return d.toISOString();};
      const demo:Assignment[]=[
        {id:"demo-1",status:"completed",start_date:at(8),completed_at:at(1),created_at:at(9),test:{id:"t1",title:"Performance Testing",status:"completed",app:{name:"PlayStore App",icon_url:null}},checkins:[]},
        {id:"demo-2",status:"completed",start_date:at(12),completed_at:at(3),created_at:at(13),test:{id:"t2",title:"Security Testing",status:"completed",app:{name:"SecureApp",icon_url:null}},checkins:[]},
        {id:"demo-3",status:"completed",start_date:at(15),completed_at:at(6),created_at:at(16),test:{id:"t3",title:"Usability Testing",status:"completed",app:{name:"ChatNow",icon_url:null}},checkins:[]},
        {id:"demo-4",status:"active",start_date:at(5),completed_at:null,created_at:at(5),test:{id:"t4",title:"Functionality Testing",status:"running",app:{name:"Photo Editor",icon_url:null}},checkins:Array.from({length:5},(_,i)=>({id:"c"+i,checkin_date:at(i+1),created_at:at(i+1)}))},
        {id:"demo-5",status:"pending",start_date:null,completed_at:null,created_at:at(2),test:{id:"t5",title:"Compatibility Testing",status:"recruiting",app:{name:"SocialHub",icon_url:null}},checkins:[]}
      ];
      setName("Laid Ktif");setAssignments(demo);setFeedback([{id:"f1",assignment_id:"demo-1",rating:4.8,quality_status:"accepted",created_at:at(1)},{id:"f2",assignment_id:"demo-2",rating:4.4,quality_status:"accepted",created_at:at(3)},{id:"f3",assignment_id:"demo-3",rating:4.5,quality_status:"accepted",created_at:at(6)}]);
      setLedger([{amount:50,reference_id:"demo-1",wallet_type:"earned_points"},{amount:45,reference_id:"demo-2",wallet_type:"earned_points"},{amount:45,reference_id:"demo-3",wallet_type:"earned_points"}]);setNotifications(3);setLoading(false);return;
    }
    if(!session?.user?.id||!supabase){setLoading(false);return;}
    let alive=true;const client=supabase;const userId=session.user.id;const userEmail=session.user.email;
    async function load(){
      setLoading(true);setError("");
      if(isTesterWorkflowV2Enabled&&supabaseV2){
        const [profile,assignmentResult,feedbackResult,ledgerResult,notice]=await Promise.all([
          supabaseV2.from("profiles").select("display_name,avatar_url").eq("id",userId).maybeSingle(),
          supabaseV2.from("assignments").select("id,status,started_at,assigned_at,completed_at,created_at,test:tests(id,title,status,app:apps(name,icon_url)),checkins(id,checkin_date,created_at)").eq("tester_id",userId).order("assigned_at",{ascending:false}),
          supabaseV2.from("feedback").select("id,assignment_id,rating,quality_status,created_at").eq("tester_id",userId).order("created_at",{ascending:false}),
          supabaseV2.from("wallet_ledger").select("amount,reference_id,wallet_type").eq("user_id",userId).eq("wallet_type","earned_points"),
          supabaseV2.from("notifications").select("id",{count:"exact",head:true}).eq("user_id",userId).is("read_at",null)
        ]);
        if(!alive)return;
        setName(profile.data?.display_name?.trim()||userEmail?.split("@")[0]||"Tester");setAvatar(profile.data?.avatar_url||"");
        if(assignmentResult.error){setError("We couldn't load your test activity. Please refresh and try again.");setAssignments([]);}
        else setAssignments((assignmentResult.data??[]).map((row:any)=>({
          id:row.id,status:row.status,start_date:row.started_at||row.assigned_at,
          completed_at:row.completed_at,created_at:row.created_at||row.assigned_at,
          test:row.test||null,checkins:row.checkins||[]
        })) as Assignment[]);
        if(!feedbackResult.error)setFeedback((feedbackResult.data??[]) as Feedback[]);
        if(!ledgerResult.error)setLedger((ledgerResult.data??[]) as Ledger[]);
        setNotifications(notice.count??0);
        if(profile.error||feedbackResult.error||ledgerResult.error||notice.error)setError("Some activity details could not be loaded. Your test history is still available where possible.");
        setLoading(false);return;
      }
      const [profile,assignmentResult,feedbackResult,ledgerResult,notice]=await Promise.all([
        client.from("profiles").select("display_name,avatar_url").eq("id",userId).maybeSingle(),
        client.from("assignments").select("id,status,start_date,completed_at,created_at,test:tests(id,title,status,app:apps(name,icon_url)),checkins(id,checkin_date,created_at)").eq("tester_id",userId).order("created_at",{ascending:false}),
        client.from("feedback").select("id,assignment_id,rating,quality_status,created_at").eq("tester_id",userId).order("created_at",{ascending:false}),
        client.from("points_ledger").select("amount,reference_id,wallet_type").eq("user_id",userId).eq("wallet_type","earned_points"),
        client.from("notifications").select("id",{count:"exact",head:true}).eq("user_id",userId).is("read_at",null)
      ]);
      if(!alive)return;
      setName(profile.data?.display_name?.trim()||userEmail?.split("@")[0]||"Tester");setAvatar(profile.data?.avatar_url||"");
      if(assignmentResult.error){setError("We couldn't load your test activity. Please refresh and try again.");setAssignments([]);}
      else setAssignments((assignmentResult.data??[]) as unknown as Assignment[]);
      if(!feedbackResult.error)setFeedback((feedbackResult.data??[]) as Feedback[]);
      if(!ledgerResult.error)setLedger((ledgerResult.data??[]) as Ledger[]);
      setNotifications(notice.count??0);
      if(profile.error||feedbackResult.error||ledgerResult.error||notice.error)setError("Some activity details could not be loaded. Your test history is still available where possible.");
      setLoading(false);
    }
    void load().catch(()=>{if(alive){setError("Something went wrong while loading activity history.");setLoading(false);}});
    return()=>{alive=false;};
  },[session?.user?.id,previewMode]);

  const feedbackByAssignment=useMemo(()=>feedback.reduce((map,row)=>{if(!map[row.assignment_id])map[row.assignment_id]=[];map[row.assignment_id].push(row);return map;},{} as Record<string,Feedback[]>),[feedback]);
  const pointsByAssignment=useMemo(()=>ledger.reduce((map,row)=>{if(row.reference_id)map[row.reference_id]=(map[row.reference_id]||0)+Number(row.amount||0);return map;},{} as Record<string,number>),[ledger]);
  const completed=assignments.filter(row=>row.status==="completed").length;
  const activeDays=new Set(assignments.flatMap(row=>(row.checkins??[]).map(item=>dayKey(item.checkin_date||item.created_at)).filter(Boolean))).size;
  const totalPoints=Math.max(0,ledger.reduce((sum,row)=>sum+Number(row.amount||0),0));
  const events=useMemo(()=>{
    const list:ActivityEvent[]=[];
    assignments.forEach(row=>{
      if(row.completed_at)list.push({id:"done-"+row.id,kind:"completed",title:"Test completed",detail:row.test?.title||"Test assignment",date:row.completed_at});
      (row.checkins??[]).forEach(item=>list.push({id:"check-"+item.id,kind:"checkin",title:"Check-in submitted",detail:row.test?.title||"Test assignment",date:item.created_at||item.checkin_date}));
    });
    feedback.forEach(row=>{const assignment=assignments.find(item=>item.id===row.assignment_id);list.push({id:"feedback-"+row.id,kind:"feedback",title:"Feedback submitted",detail:assignment?.test?.title||"Test feedback",date:row.created_at});});
    return list.sort((a,b)=>new Date(b.date).getTime()-new Date(a.date).getTime());
  },[assignments,feedback]);
  const ranged=useMemo(()=>{const cutoff=range==="all"?0:Date.now()-Number(range)*86400000;return assignments.filter(row=>!cutoff||new Date(row.completed_at||row.created_at).getTime()>=cutoff);},[assignments,range]);
  const visible=useMemo(()=>ranged.filter(row=>{
    const normalized=row.status==="completed"?"completed":["pending","active"].includes(row.status)?"pending":["rejected","failed","withdrawn"].includes(row.status)?"rejected":"pending";
    const app=row.test?.app?.name||"",title=row.test?.title||"";
    return (filter==="all"||normalized===filter)&&(`${title} ${app}`.toLowerCase().includes(search.trim().toLowerCase()));
  }),[ranged,filter,search]);
  const pages=Math.max(1,Math.ceil(visible.length/5)),pageRows=visible.slice((page-1)*5,page*5);
  const pageNumbers=Array.from({length:Math.min(5,pages)},(_,index)=>Math.max(1,Math.min(page-2,pages-4))+index);
  const filterCounts={all:ranged.length,completed:ranged.filter(row=>row.status==="completed").length,pending:ranged.filter(row=>["pending","active"].includes(row.status)).length,rejected:ranged.filter(row=>["rejected","failed","withdrawn"].includes(row.status)).length};
  useEffect(()=>setPage(1),[filter,range,search]);
  const clearFilters=()=>{setFilter("all");setRange("30");setSearch("");};
  const exportCsv=()=>{
    const rows=[["Test","App","Date","Duration (days)","Feedback rating","Points","Status"],...visible.map(row=>{
      const rating=feedbackByAssignment[row.id]?.filter(item=>item.rating!==null).map(item=>Number(item.rating))||[];
      const average=rating.length?rating.reduce((sum,value)=>sum+value,0)/rating.length:null;
      const duration=row.start_date&&row.completed_at?Math.max(1,Math.ceil((new Date(row.completed_at).getTime()-new Date(row.start_date).getTime())/86400000)):null;
      return [row.test?.title||"Test",row.test?.app?.name||"",row.completed_at||row.created_at,duration??"",average??"",pointsByAssignment[row.id]||0,row.status];
    })];
    const blob=new Blob([rows.map(row=>row.map(csvCell).join(",")).join("\n")],{type:"text/csv;charset=utf-8;"});
    const url=URL.createObjectURL(blob);const anchor=document.createElement("a");anchor.href=url;anchor.download="testdz-activity-history.csv";anchor.click();window.setTimeout(()=>URL.revokeObjectURL(url),1000);
  };
  const achievements=[
    {title:"Top Tester",description:"Complete 10 tests",earned:completed>=10,icon:"award",tone:"blue"},
    {title:"Active Tester",description:"Stay active for 7 days",earned:activeDays>=7,icon:"calendar",tone:"green"},
    {title:"Feedback Star",description:"Receive 5 accepted feedback reviews",earned:feedback.filter(row=>row.quality_status==="accepted").length>=5,icon:"star",tone:"purple"}
  ];
  const nav=[
    {label:"Dashboard",icon:"home",href:"/tester-dashboard"},
    {label:"Discover Tests",icon:"search",href:"/discover-tests"},
    {label:"My Tests",icon:"tests",href:"/my-tests"},
    {label:"Activity & History",icon:"chart",href:"/activity-history",active:true},
    {label:"Check-in History",icon:"calendar",href:"/check-in-history"},
    {label:"Feedback History",icon:"star",href:"/feedback-history"},
    {label:"Wallet & Rewards",icon:"wallet",href:"/wallet-rewards"},
    {label:"Referral Program",icon:"users",href:"/referral-program"},
    {label:"Profile",icon:"user",href:"/profile"},
    {label:"Help & Support",icon:"help",href:"/help-support"},
    {label:"Settings",icon:"settings",href:"/settings"},
    ...(isDeveloper?[{label:"Developer Dashboard",icon:"code",href:"/developer-dashboard"}]:[]),
    ...(isAdmin?[{label:"Admin",icon:"shield",href:"/admin"}]:[])
  ];
  if(loading)return <div className="td-loading"><span className="td-spinner"/>Loading your activity history…</div>;
  return <div className="td-dashboard ah-dashboard">
    <TesterSidebar nav={nav} name={name} firstName={firstName} avatar={avatar} roles={roles} isAdmin={isAdmin} isDeveloper={isDeveloper} workspaceMenuOpen={menuOpen} setWorkspaceMenuOpen={setMenuOpen} previewMode={previewMode}/>
    <main className="td-main ah-main">
      <header className="td-topbar ah-topbar">
        <label className="td-search"><Icon name="search" size={20}/><input value={search} onChange={event=>setSearch(event.target.value)} placeholder="Search tests, apps or activity…"/></label>
        <div className="td-top-actions"><button className="td-notification" type="button" aria-label={notifications+" unread notifications"}><Icon name="bell" size={22}/>{notifications>0&&<i>{notifications>9?"9+":notifications}</i>}</button><span className="td-top-divider"/><Link to="/profile" className="td-profile-short"><span>{avatar?<img src={avatar} alt=""/>:firstName.slice(0,2).toUpperCase()}</span><strong>{name}</strong><b>⌄</b></Link></div>
      </header>
      <div className="ah-content">
        <Link to="/tester-dashboard" className="ah-back"><Icon name="arrow" size={17}/>Back to Dashboard</Link>
        <section className="ah-hero"><div className="ah-hero-icon"><Icon name="chart" size={43}/></div><div className="ah-hero-copy"><h1>Tester Activity &amp; Test History</h1><p>Track your activity, view your test history and achievements.</p></div><div className="ah-hero-art"><Icon name="trophy" size={100}/><span>★</span></div></section>
        {error&&<div className="ah-error" role="status">{error}</div>}
        <section className="ah-stats">
          <article className="ah-stat blue"><span><Icon name="tests" size={30}/></span><div><strong>{events.length}</strong><b>Total Activities</b></div><small>Recorded</small><i aria-hidden="true"/></article>
          <article className="ah-stat green"><span><Icon name="check" size={30}/></span><div><strong>{completed}</strong><b>Completed</b></div><small>{assignments.length?Math.round(completed/assignments.length*100):0}%</small><i aria-hidden="true"/></article>
          <article className="ah-stat gold"><span><Icon name="star" size={30}/></span><div><strong>{totalPoints.toLocaleString()}</strong><b>Total Points</b></div><small>Earned</small><i aria-hidden="true"/></article>
          <article className="ah-stat teal"><span><Icon name="calendar" size={30}/></span><div><strong>{activeDays}</strong><b>Active Days</b></div><i aria-hidden="true"/></article>
        </section>
        <section className="ah-overview-grid">
          <article className="ah-panel ah-activity-panel"><div className="ah-panel-heading"><h2><Icon name="clock" size={21}/>Activity Overview</h2><span>Last 15 days · {events.length} events</span></div><ActivityChart events={events}/></article>
          <article className="ah-panel ah-achievements"><div className="ah-panel-heading"><h2><Icon name="pie" size={23}/>Activity Breakdown</h2><span>{events.length} recorded activities</span></div><ActivityBreakdown events={events}/></article>
        </section>
        <section className="ah-panel ah-recent-panel"><div className="ah-panel-heading"><h2><Icon name="trophy" size={21}/>Your Achievements</h2><span>{achievements.filter(item=>item.earned).length} of {achievements.length} unlocked</span></div><div className="ah-achievement-list">{achievements.map(item=><div className={`ah-achievement ${item.tone} ${item.earned?"earned":"locked"}`} key={item.title}><span><Icon name={item.icon} size={37}/></span><strong>{item.title}</strong><small>{item.earned?"Achievement unlocked":item.description}</small></div>)}</div><div className="ah-panel-heading ah-recent-subheading"><h2><Icon name="clock" size={19}/>Recent Activity</h2><span>Latest updates from your tester journey</span></div>{events.length?<div className="ah-timeline">{events.slice(0,5).map(event=><article className="ah-timeline-item" key={event.id}><span className={`ah-timeline-icon ${event.kind}`}><Icon name={event.kind==="completed"?"check":event.kind==="checkin"?"calendar":"star"} size={17}/></span><div className="ah-timeline-copy"><strong>{event.title}</strong><small>{event.detail}</small></div><time dateTime={event.date}>{dateTimeLabel(event.date)}</time></article>)}</div>:<p className="ah-timeline-empty">Your recent activity will appear here as you participate in tests.</p>}</section>
        <section className="ah-panel ah-history-panel">
          <div className="ah-history-heading"><h2><Icon name="tests" size={22}/>Test History</h2><div className="ah-controls"><div className="ah-filter-tabs">{(["all","completed","pending","rejected"] as Filter[]).map(value=><button type="button" key={value} className={filter===value?"selected":""} aria-pressed={filter===value} onClick={()=>setFilter(value)}>{value==="all"?"All":value[0].toUpperCase()+value.slice(1)}<span>{filterCounts[value]}</span></button>)}</div><label className="ah-range"><Icon name="calendar" size={16}/><select value={range} onChange={event=>setRange(event.target.value)}><option value="30">Last 30 Days</option><option value="90">Last 90 Days</option><option value="all">All Time</option></select></label>{(filter!=="all"||range!=="30"||search.trim())&&<button type="button" className="ah-export" onClick={clearFilters}>Clear</button>}<button type="button" className="ah-export" onClick={exportCsv}><Icon name="download" size={16}/>Export</button></div></div>
          <div className="ah-table-wrap"><table className="ah-table"><thead><tr><th>#</th><th>Test Name</th><th>App</th><th>Date</th><th>Duration</th><th>Score</th><th>Points</th><th>Status</th><th>Actions</th></tr></thead><tbody>{pageRows.map((row,index)=>{
            const ratings=(feedbackByAssignment[row.id]||[]).filter(item=>item.rating!==null).map(item=>Number(item.rating));
            const score=ratings.length?ratings.reduce((sum,value)=>sum+value,0)/ratings.length:null;
            const duration=row.start_date&&row.completed_at?Math.max(1,Math.ceil((new Date(row.completed_at).getTime()-new Date(row.start_date).getTime())/86400000)):null;
            const appName=row.test?.app?.name||row.test?.title||"Test app";
            const statusClass=row.status==="completed"?"completed":["rejected","failed","withdrawn"].includes(row.status)?"rejected":row.status==="pending"?"pending":"active";
            return <tr key={row.id}><td className="ah-index">{String((page-1)*5+index+1).padStart(3,"0")}</td><td><strong className="ah-test-name">{row.test?.title||"Test assignment"}</strong></td><td><span className="ah-app-cell"><AppMark name={appName} url={row.test?.app?.icon_url??null}/><span>{appName}</span></span></td><td>{dateTimeLabel(row.completed_at||row.created_at)}</td><td>{duration===null?"—":duration+" days"}</td><td>{score===null?"—":score.toFixed(1)+"/5"}</td><td className="ah-points">{pointsByAssignment[row.id]? "+"+pointsByAssignment[row.id]:"—"}</td><td><span className={`ah-status ${statusClass}`}>{statusClass==="completed"?"Approved":statusClass==="rejected"?"Rejected":statusClass==="pending"?"Pending":"Active"}</span></td><td><Link className="ah-view" to={row.test?.id?`/tests/${row.test.id}`:"/my-tests"}><Icon name="eye" size={15}/>View</Link></td></tr>;
          })}{!pageRows.length&&<tr><td colSpan={9} className="ah-empty">{assignments.length?"No tests match these filters.":"Your test history will appear here after you join a test."}</td></tr>}</tbody></table></div>
          <div className="ah-table-footer"><span>Showing {visible.length?((page-1)*5+1):0}–{Math.min(page*5,visible.length)} of {visible.length} tests</span><div className="ah-pagination"><button type="button" disabled={page===1} onClick={()=>setPage(value=>Math.max(1,value-1))} aria-label="Previous page">‹</button>{pageNumbers.map(number=><button type="button" key={number} className={page===number?"selected":""} aria-current={page===number?"page":undefined} onClick={()=>setPage(number)}>{number}</button>)}<button type="button" disabled={page===pages} onClick={()=>setPage(value=>Math.min(pages,value+1))} aria-label="Next page">›</button></div></div>
        </section>
        <footer className="ah-footer">TestDZ · Test · Learn · Grow</footer>
      </div>
    </main>
  </div>;
}
