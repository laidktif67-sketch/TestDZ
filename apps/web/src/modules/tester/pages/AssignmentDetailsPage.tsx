import { useEffect, useState } from "react";
import { Link, Navigate, useParams } from "react-router-dom";
import { supabase } from "../../../lib/supabase";
import { isTesterWorkflowV2Enabled } from "../../../lib/supabase-v2";
import { getTesterAssignmentDetailsPageData } from "../../../features/tester/assignments-api";
import { useIdentity } from "../../../shared/auth/hooks/useIdentity";
import TesterSidebar, { Icon } from "../components/TesterSidebar";
import "../styles/tester-dashboard.css";
import "../styles/assignment-details.css";

type AssignmentDetails = { id:string; status:string; start_date:string|null; points_awarded:number|null; test:{id:string;title:string;description:string|null;short_summary:string|null;start_date:string|null;end_date:string|null;app:{name:string;icon_url:string|null;category:string|null}|null}|null };
type AssignmentAsset={id:string;title:string;original_filename:string;mime_type:string;size_bytes:number;download_url:string};
const dateLabel=(v:string|null)=>v?new Date(v+"T00:00:00").toLocaleDateString(undefined,{month:"short",day:"2-digit",year:"numeric"}):"Not scheduled";

export default function AssignmentDetailsPage(){
 const {id=""}=useParams(); const {session,roles=[]}=useIdentity();
 const [data,setData]=useState<AssignmentDetails|null>(null); const [assets,setAssets]=useState<AssignmentAsset[]>([]); const [loading,setLoading]=useState(true); const [error,setError]=useState(""); const [menuOpen,setMenuOpen]=useState(false);
 const preview=import.meta.env.DEV&&new URLSearchParams(window.location.search).get("preview")==="1";
 const name=session?.user?.user_metadata?.display_name||session?.user?.email?.split("@")[0]||"Tester"; const firstName=name.split(/\s+/)[0];
 useEffect(()=>{
  if(preview){setData({id:"preview-assignment",status:"active",start_date:"2026-11-07",points_awarded:75,test:{id:"preview-test",title:"Performance Testing",description:"Help us test the app’s performance and stability under different conditions. Focus on responsiveness, smoothness, crashes and battery usage.",short_summary:"Test the app performance under different conditions.",start_date:"2026-11-07",end_date:"2026-11-14",app:{name:"PlayStore App",icon_url:null,category:"Android application"}}});setLoading(false);return;}
  if(!session?.user?.id||!id){setLoading(false);return;}
  const storageClient=supabase;
  if(!storageClient){setError("Database connection is unavailable.");setLoading(false);return;}
  let alive=true;
  (async()=>{
   const result=await getTesterAssignmentDetailsPageData(id,session.user.id);
   if(!alive)return;
   if(!result.data){
    setError(result.error?.message||"This assignment could not be found.");
    setLoading(false);
    return;
   }
   const signedAssets=await Promise.all((result.assets??[]).map(async asset=>{
    const {data:signed,error:signedError}=await storageClient.storage.from("test-assets").createSignedUrl(asset.storage_path,300);
    return signedError||!signed?.signedUrl?null:{id:asset.id,title:asset.title,original_filename:asset.original_filename,mime_type:asset.mime_type,size_bytes:asset.size_bytes,download_url:signed.signedUrl};
   }));
   setAssets(signedAssets.filter((asset):asset is NonNullable<typeof asset>=>!!asset));
   setData(result.data as AssignmentDetails);
   if(result.error)setError("Some assignment information or private test materials could not be loaded.");
   setLoading(false);
  })().catch(()=>{if(alive){setError("Unable to load assignment details.");setLoading(false);}});
  return()=>{alive=false;};
 },[id,session?.user?.id,preview]);
 if(!preview&&!session)return <Navigate to="/auth" replace/>;if(!preview&&!roles.includes("tester")&&!loading)return <Navigate to="/dashboard" replace/>;
 const test=data?.test;const canStart=data?.status==="active"||data?.status==="pending";
 return <div className="td-dashboard ad-dashboard"><TesterSidebar nav={[{label:"Dashboard",icon:"home",href:"/tester-dashboard"},{label:"Discover Tests",icon:"search",href:"/discover-tests"},{label:"My Tests",icon:"tests",href:"/my-tests",active:true},{label:"Wallet & Rewards",icon:"wallet",href:"/wallet-rewards"},{label:"Profile",icon:"user",href:"/profile"},{label:"Help & Support",icon:"headset",href:"/help-support"},{label:"Feedback History",icon:"star",href:"/feedback-history"},{label:"Settings",icon:"settings",href:"/settings"}]} name={name} firstName={firstName} avatar="" roles={preview?["tester",...roles]:roles} isAdmin={roles.includes("admin")} isDeveloper={roles.includes("developer")} workspaceMenuOpen={menuOpen} setWorkspaceMenuOpen={setMenuOpen} previewMode={preview}/>
 <main className="td-main ad-main"><header className="td-topbar"><label className="td-search"><Icon name="search" size={21}/><input placeholder="Search in TestDZ..." aria-label="Search in TestDZ"/></label><div className="td-top-actions"><Link to="/notifications" className="td-notification" aria-label="Notifications"><Icon name="bell" size={22}/><span className="ad-notification-count">3</span></Link><span className="td-top-divider"/><Link to="/profile" className="td-profile-short"><span>{firstName.slice(0,2).toUpperCase()}</span><strong>{name}</strong><b>⌄</b></Link></div></header>
 <div className="ad-content"><Link to="/my-tests" className="ad-back"><Icon name="arrow" size={20}/> Back to My Tests</Link>
 {loading?<div className="ad-panel">Loading assignment details…</div>:error||!data?<div className="ad-panel ad-error">{error||"Assignment not found"}<Link to="/my-tests">Return to My Tests</Link></div>:<>
 <section className="ad-page-hero"><div className="ad-hero-icon"><Icon name="play" size={43}/></div><div className="ad-page-title"><h1>Assignment Details</h1><p>View the details of your assigned testing task</p></div><div className="ad-assignment-status"><span><Icon name="check" size={20}/>{data.status==="completed"?"Completed":"Assigned"}</span><small>Assigned on: {dateLabel(data.start_date||test?.start_date||null)}{data.start_date?" · 09:30 AM":""}</small></div></section>
 <div className="ad-overview-grid"><section className="ad-app-card"><div className="ad-app-art"><div className="ad-phone"><div className="ad-phone-notch"/><div className="ad-phone-brand"><span>✓</span><b>TestDZ</b></div><div className="ad-phone-logo">✓</div><strong>Better Apps<br/>Together</strong><div className="ad-phone-wave"/></div><div className="ad-android-badge">🤖</div></div><div className="ad-app-copy"><h2>{test?.app?.name||test?.title||"TestDZ Mobile App v2.0"}</h2><div className="ad-app-tags"><span>{test?.app?.category||"Mobile Application"}</span><span><Icon name="smartphone" size={15}/>{test?.app?.category?.toLowerCase().includes("ios")?"iOS":"Android"}</span></div><p>{test?.short_summary||test?.description||"Test the latest version of the TestDZ mobile application and report any issues, usability problems, or suggestions for improvement."}</p><div className="ad-instruction-summary"><h3><Icon name="tests" size={18}/> Instructions:</h3><ol><li>Install and open the assigned application.</li><li>Test the main features and core user journeys.</li><li>Report bugs or issues with screenshots where possible.</li><li>Provide clear, constructive feedback.</li></ol></div></div></section>
 <aside className="ad-stats-card"><div className="ad-stat-row"><span className="ad-stat-icon ad-clock"><Icon name="history" size={25}/></span><div className="ad-stat-label"><span>Time Limit</span><small>Until: {dateLabel(test?.end_date||null)}</small></div><div className="ad-stat-value"><strong>{test?.start_date&&test?.end_date?"7 Days":"—"}</strong><i/></div></div><div className="ad-stat-row"><span className="ad-stat-icon ad-effort"><Icon name="star" size={24}/></span><div className="ad-stat-label"><span>Estimated Effort</span></div><div className="ad-stat-value"><strong>30 – 45 min</strong><i/></div></div><div className="ad-stat-row"><span className="ad-stat-icon ad-reward"><Icon name="gift" size={24}/></span><div className="ad-stat-label"><span>Reward</span></div><div className="ad-stat-value ad-green"><strong>{data.points_awarded===null?"Not available yet":"+"+data.points_awarded+" pts"}</strong><Icon name="gift" size={20}/></div></div><div className="ad-stat-row"><span className="ad-stat-icon ad-difficulty"><Icon name="chart" size={24}/></span><div className="ad-stat-label"><span>Difficulty Level</span></div><div className="ad-difficulty-pill">Medium</div></div></aside></div>
 <div className="ad-lower-grid"><article className="ad-task-card"><h2><Icon name="tests" size={22}/> Task Details</h2><ul><li><Icon name="check" size={21}/>Test the application performance and stability</li><li><Icon name="check" size={21}/>Report any UI/UX issues</li><li><Icon name="check" size={21}/>Evaluate the assigned features</li><li><Icon name="check" size={21}/>Provide detailed feedback</li></ul></article><article className="ad-notes-card"><div><h2><Icon name="info" size={25}/> Important Notes</h2><ul><li>Please use the latest version of the application.</li><li>Include screenshots for any issues you report.</li><li>Be honest and provide constructive feedback.</li><li>Your feedback helps us improve the product.</li></ul></div><div className="ad-clipboard-art"><Icon name="receipt" size={65}/><span>✓</span></div></article></div>
 {assets.length>0&&<section className="ad-task-card ad-test-assets"><h2><Icon name="file" size={22}/> Test materials</h2><ul>{assets.map(asset=><li key={asset.id}><Icon name={asset.mime_type.startsWith("image/")?"image":asset.mime_type.startsWith("video/")?"video":"file"} size={20}/><span><strong>{asset.title}</strong> · {(asset.size_bytes/1048576).toFixed(1)} MB<br/>{asset.mime_type.startsWith("image/")?<a href={asset.download_url} target="_blank" rel="noreferrer">View {asset.original_filename}</a>:asset.mime_type.startsWith("video/")?<video controls preload="metadata" src={asset.download_url} style={{maxWidth:"100%"}}/>:<a href={asset.download_url} target="_blank" rel="noreferrer">Open {asset.original_filename}</a>}</span></li>)}</ul></section>}
 <footer className="ad-bottom-actions"><Link className="ad-guide-button" to={"/tests/"+(test?.id||id)}><Icon name="file" size={21}/>View Test Guide</Link><Link className="ad-question-button" to="/help-support"><Icon name="message" size={22}/>Ask a Question</Link><Link className="ad-start-button" to={canStart?"/assignments/"+id+"/progress"+(preview?"?preview=1":""):"/my-tests"}><Icon name="play" size={21}/>{canStart?"Start Assignment":"View My Tests"}<Icon name="arrow" size={22}/></Link></footer>
 </>}</div></main></div>;
}