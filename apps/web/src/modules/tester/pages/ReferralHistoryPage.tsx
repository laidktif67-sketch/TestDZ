import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "../../../lib/supabase";
import { isTesterWorkflowV2Enabled, supabaseV2 } from "../../../lib/supabase-v2";
import { useIdentity } from "../../../shared/auth/hooks/useIdentity";
import TesterSidebar, { Icon } from "../components/TesterSidebar";
import "../styles/referral-history.css";
type ReferralRecord={id:string;invited_email:string;status:"successful"|"pending"|"expired"|"qualified"|"rewarded"|"rejected";created_at:string;reward_points?:number;detail:string};
export default function ReferralHistoryPage(){
 const {session,roles=[]}=useIdentity();const [name,setName]=useState("Tester");const [avatar,setAvatar]=useState("");const [notifications,setNotifications]=useState(0);const [menuOpen,setMenuOpen]=useState(false);const [status,setStatus]=useState("All");const [period,setPeriod]=useState("6");const [selected,setSelected]=useState<ReferralRecord|null>(null);const [records,setRecords]=useState<ReferralRecord[]>([]);const [loading,setLoading]=useState(true);const [referralUnavailable,setReferralUnavailable]=useState(false);
 const isAdmin=roles.includes("admin"),isDeveloper=roles.includes("developer"),firstName=name.split(/\s+/)[0]||"Tester";
 useEffect(()=>{
  if(!session?.user?.id||!supabase){setLoading(false);return;}
  let alive=true;
  const id=session.user.id;
  const client:any=isTesterWorkflowV2Enabled?supabaseV2:supabase;
  if(!client){setLoading(false);return;}
  (async()=>{
   try{
    const [p,n]=await Promise.all([
     client.from("profiles").select("display_name,avatar_url").eq("id",id).maybeSingle(),
     client.from("notifications").select("id",{count:"exact",head:true}).eq("user_id",id).is("read_at",null)
    ]);
    if(!alive)return;
    if(p.error||n.error){setReferralUnavailable(true);setLoading(false);return;}
    setName(p.data?.display_name?.trim()||session.user.email?.split("@")[0]||"Tester");
    setAvatar(p.data?.avatar_url||"");
    setNotifications(n.count??0);
    if(isTesterWorkflowV2Enabled){
     const {data,error}=await supabaseV2!.from("referrals")
      .select("id,referrer_id,referred_user_id,referral_code,status,created_at,qualified_at,rewarded_at")
      .eq("referrer_id",id).order("created_at",{ascending:false});
     if(!alive)return;
     if(error){setReferralUnavailable(true);}
     else setRecords((data??[]).map(item=>({
      id:item.id,
      invited_email:"Referred tester "+String(item.referred_user_id).slice(0,8),
      status:item.status,
      created_at:item.created_at,
      detail:"Referral code: "+item.referral_code
     })));
    }
    if(alive)setLoading(false);
   }catch{
    if(alive){setReferralUnavailable(true);setLoading(false);}
   }
  })();
  return()=>{alive=false;};
 },[session?.user?.id]);
 const nav=[{label:"Dashboard",icon:"home",href:"/tester-dashboard"},{label:"Discover Tests",icon:"search",href:"/discover-tests"},{label:"My Tests",icon:"tests",href:"/my-tests"},{label:"Activity & History",icon:"chart",href:"/activity-history"},{label:"Check-in History",icon:"calendar",href:"/check-in-history"},{label:"Feedback History",icon:"star",href:"/feedback-history"},{label:"Wallet & Rewards",icon:"wallet",href:"/wallet-rewards"},{label:"Referral Program",icon:"users",href:"/referral-program",active:true},{label:"Profile",icon:"user",href:"/profile"},{label:"Help & Support",icon:"help",href:"/help-support"},{label:"Settings",icon:"settings",href:"/settings"},...(isDeveloper?[{label:"Developer Dashboard",icon:"code",href:"/developer-dashboard"}]:[]),...(isAdmin?[{label:"Admin",icon:"shield",href:"/admin"}]:[])];
 const cutoff=period==="all"?0:Date.now()-Number(period)*30*24*60*60*1000;const filtered=records.filter(r=>(status==="All"||r.status===status.toLowerCase())&&(new Date(r.created_at).getTime()>=cutoff)),successful=records.filter(r=>r.status==="rewarded"||r.status==="successful").length,rate=records.length?Math.round(successful/records.length*100):0;
 const exportHistory=()=>{if(!filtered.length)return;const rows=[["Date","Referred Tester","Status","Reward Amount","Details"],...filtered.map(r=>[r.created_at,r.invited_email,r.status,isTesterWorkflowV2Enabled?"Unavailable":r.reward_points??"—",r.detail])];const csv=rows.map(row=>row.map(v=>'"'+String(v).replace(/"/g,'""')+'"').join(",")).join("\n");const url=URL.createObjectURL(new Blob([csv],{type:"text/csv;charset=utf-8"}));const a=document.createElement("a");a.href=url;a.download="testdz-referral-history.csv";a.click();URL.revokeObjectURL(url);};
 if(loading)return <div className="td-loading"><span className="td-spinner"/>Loading referral history…</div>;
 return <div className="td-dashboard rh-dashboard"><TesterSidebar nav={nav} name={name} firstName={firstName} avatar={avatar} roles={roles} isAdmin={isAdmin} isDeveloper={isDeveloper} workspaceMenuOpen={menuOpen} setWorkspaceMenuOpen={setMenuOpen} previewMode={false}/><main className="td-main rh-main">
 <header className="td-topbar rh-topbar"><label className="td-search"><Icon name="search" size={20}/><input placeholder="Search in TestDZ…"/></label><div className="td-top-actions"><Link to="/notifications" className="td-notification" aria-label="Notifications"><Icon name="bell" size={22}/>{notifications>0&&<i>{notifications>9?"9+":notifications}</i>}</Link><span className="td-top-divider"/><Link to="/profile" className="td-profile-short"><span>{avatar?<img src={avatar} alt=""/>:firstName.slice(0,2).toUpperCase()}</span><strong>{name}</strong><b>⌄</b></Link></div></header>
 <div className="rh-content">{isTesterWorkflowV2Enabled&&<div role="status" className="rh-empty-table">{referralUnavailable?"Referral data could not be loaded. Please try again later.":"V2 referral records are read-only. Invitation-code creation and reward posting are not enabled; reward amounts are unavailable."}</div>}<Link to="/referral-program" className="rh-back"><Icon name="arrow" size={17}/>Back to Referral Program</Link>
 <section className="rh-hero"><div className="rh-hero-art" aria-hidden="true"><span>🧑🏻‍💻</span><span>👩🏻‍💻</span><i>🎁</i></div><div className="rh-hero-copy"><span>INVITE FRIENDS · EARN MORE</span><h1>Referral History &amp; Details</h1><p>Track your invitations, rewards and more.</p></div><div className="rh-hero-side"><strong>Invite Friends…<br/>Earn More!</strong><span>🎁</span></div></section>
 <section className="rh-stats"><article><span className="rh-stat-icon blue"><Icon name="users" size={34}/></span><div><strong>{records.length||"—"}</strong><b>Total Invites</b><small>{records.length?"Tracked invitations":"Awaiting referral tracking"}</small></div></article><article><span className="rh-stat-icon green"><Icon name="check" size={36}/></span><div><strong>{records.length?successful:"—"}</strong><b>Successful Referrals</b><small>{records.length?"Verified referrals":"Verified after launch"}</small></div></article><article><span className="rh-stat-icon gold"><Icon name="star" size={34}/></span><div><strong>{isTesterWorkflowV2Enabled?"Unavailable":"—"}</strong><b>Total Points Earned</b><small>{isTesterWorkflowV2Enabled?"Reward posting is not enabled":records.length?"Confirmed referral rewards":"Pending verified rewards"}</small></div></article><article><span className="rh-stat-icon amber"><Icon name="trophy" size={34}/></span><div><strong>—</strong><b>Referral Rank</b><small>Available when leaderboard launches</small></div></article></section>
 <div className="rh-layout"><section className="rh-table-panel"><div className="rh-toolbar"><div className="rh-filter-pills">{(isTesterWorkflowV2Enabled?["All","Pending","Qualified","Rewarded","Rejected"]:["All","Successful","Pending","Expired"]).map(item=><button key={item} className={status===item?"active":""} onClick={()=>setStatus(item)}>{item}</button>)}</div><label className="rh-period"><Icon name="calendar" size={18}/><select value={period} onChange={e=>setPeriod(e.target.value)}><option value="1">Last Month</option><option value="3">Last 3 Months</option><option value="6">Last 6 Months</option><option value="12">Last Year</option><option value="all">All Time</option></select><Icon name="chevron" size={15}/></label><button className="rh-export" onClick={exportHistory} disabled={!filtered.length}><Icon name="download" size={19}/>Export History</button></div>
 <div className="rh-table-wrap"><table className="rh-table"><thead><tr><th>Date</th><th>Invited User</th><th>Status</th><th>Reward</th><th>Details</th><th>Actions</th></tr></thead><tbody>{filtered.length?filtered.map(r=><tr key={r.id}><td>{new Date(r.created_at).toLocaleString()}</td><td>{r.invited_email}</td><td><span className={"rh-status "+r.status}>{r.status}</span></td><td>{isTesterWorkflowV2Enabled?"Unavailable":r.status==="successful"&&r.reward_points!==undefined?"+"+r.reward_points+" Pts":"—"}</td><td>{r.detail}</td><td><button className="rh-view" onClick={()=>setSelected(r)}>View</button></td></tr>):<tr><td colSpan={6}><div className="rh-empty-table"><span><Icon name="users" size={30}/></span><strong>No referral activity yet</strong><p>{isTesterWorkflowV2Enabled?"No referral records are linked to this account yet.":"Your verified invitations will appear here when referral tracking is enabled."}</p><Link to="/referral-program">View Referral Program <Icon name="arrow" size={14}/></Link></div></td></tr>}</tbody></table></div><div className="rh-table-foot"><span>Showing {filtered.length} of {records.length} referrals</span><span>Referral records are verified before rewards are displayed</span></div></section>
 <aside className="rh-side-column"><section className="rh-detail-card"><div className="rh-side-heading"><Icon name="info" size={24}/><h2>Referral Details</h2></div>{selected?<><div className="rh-selected-user"><span>{selected.invited_email.slice(0,2).toUpperCase()}</span><div><strong>{selected.invited_email.split("@")[0]}</strong><small>{selected.invited_email}</small><em className={"rh-status "+selected.status}>{selected.status}</em></div></div><div className="rh-detail-line"><Icon name="calendar" size={21}/><div><b>Invited on</b><span>{new Date(selected.created_at).toLocaleString()}</span></div></div><div className="rh-detail-line"><Icon name="gift" size={21}/><div><b>Reward</b><span>{isTesterWorkflowV2Enabled?"Unavailable in this V2 phase":selected.status==="successful"?"+"+selected.reward_points+" Points":"Not eligible yet"}</span></div></div><div className="rh-detail-success"><Icon name="check" size={20}/>Referral record details</div></>:<div className="rh-detail-empty"><span><Icon name="user" size={34}/></span><strong>Select a referral</strong><p>Choose View on a referral record to see its status, invitation date and reward details.</p></div>}</section>
 <section className="rh-quick-card"><div className="rh-side-heading"><Icon name="chart" size={24}/><h2>Quick Stats</h2></div><div className="rh-rate"><span>Success Rate</span><strong>{records.length?rate+"%":"—"}</strong><div className="rh-progress"><i style={{width:rate+"%"}}/></div><small>{records.length?successful+" out of "+records.length+" invites":"Available when tracking is active"}</small></div><div className="rh-bars" aria-hidden="true"><i/><i/><i/><i/><i/></div></section></aside></div>
 <section className="rh-cta"><span><Icon name="lightbulb" size={29}/></span><div><strong>Keep inviting!</strong><p>Share your link and help more people discover TestDZ.</p></div><Link to="/referral-program"><Icon name="share" size={20}/>Share Your Link</Link></section><footer className="rh-footer">TestDZ · Test · Learn · Earn</footer></div></main></div>;
}
