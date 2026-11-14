import { useCallback, useEffect, useMemo, useState } from "react";
import type { FormEvent, ReactNode } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { identityApi } from "../../../features/identity/identity-api";
import { createDeveloperFeedbackMessage, createDeveloperFeedbackReview, createFeedbackAttachmentMetadata, getDeveloperFeedbackAttachmentUrl, getDeveloperFeedbackDetails, getDeveloperFeedbackReview, listDeveloperFeedbackAttachments, listDeveloperFeedbackEvents, listDeveloperFeedbackMessages, updateDeveloperFeedbackReview, uploadDeveloperFeedbackAttachment } from "../../../features/feedback/feedback-api";
import { useIdentity } from "../../../features/identity/hooks/useIdentity";
import { RoleAccessNotice } from "../../../shared/guards/RoleGuard";
import "../styles/developer-feedback.css";
import "../styles/developer-feedback-details.css";

type ReviewStatus="new"|"under_review"|"planned"|"resolved"|"wont_fix";
type Priority="low"|"normal"|"high"|"urgent";
type Feedback = {
  id: string;
  assignment_id: string;
  tester_id: string;
  rating: number | null;
  body: string;
  category: string;
  quality_status: string;
  created_at: string;
  assignment: {
    test: {
      id: string;
      title: string;
      app: { id: string; name: string; icon_url: string | null; package_name: string } | null;
    } | null;
  } | null;
  tester: { display_name: string | null; avatar_url: string | null } | null;
};
type Message={id:string;feedback_id:string;sender_id:string;body:string;created_at:string;sender:{display_name:string|null;avatar_url:string|null}|null};
type Attachment={id:string;message_id:string|null;storage_path:string;original_filename:string;mime_type:string;size_bytes:number;created_at:string};
type Event={id:string;actor_id:string|null;event_type:string;old_value:string|null;new_value:string|null;created_at:string};
const statusLabels:Record<ReviewStatus,string>={new:"Open",under_review:"In Progress",planned:"Planned",resolved:"Resolved",wont_fix:"Won't Fix"};
const priorityLabels:Record<Priority,string>={low:"Low Priority",normal:"Normal Priority",high:"High Priority",urgent:"Urgent"};
const dateTime=(v:string)=>new Date(v).toLocaleString("en-US",{month:"short",day:"2-digit",year:"numeric",hour:"numeric",minute:"2-digit"});
const initials=(s:string)=>s.split(/\s+/).filter(Boolean).slice(0,2).map(x=>x[0]).join("").toUpperCase()||"T";
const fileSize=(n:number)=>n<1024? n+" B":n<1048576?(n/1024).toFixed(1)+" KB":(n/1048576).toFixed(1)+" MB";
function Glyph({name}:{name:string}){const paths:Record<string,ReactNode>={feedback:<><path d="M4 5h16v12H9l-5 4V5Z"/><path d="M9 10h6m-6 3h4"/></>,back:<path d="m15 18-6-6 6-6M9 12h12"/>,calendar:<><rect x="3" y="5" width="18" height="16" rx="2"/><path d="M7 3v4m10-4v4M3 10h18"/></>,phone:<><rect x="6" y="2" width="12" height="20" rx="3"/><path d="M10 18h4"/></>,send:<><path d="m22 2-7 20-4-9-9-4Z"/><path d="M22 2 11 13"/></>,clip:<><path d="m8 12.5 7.1-7.1a3 3 0 0 1 4.2 4.2L9.4 19.5a5 5 0 0 1-7.1-7.1L13 1.7"/></>,image:<><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><path d="m21 15-5-5L5 21"/></>,clock:<><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></>,info:<><circle cx="12" cy="12" r="9"/><path d="M12 11v5m0-8h.01"/></>,app:<><path d="m12 2 9 5v10l-9 5-9-5V7z"/><path d="m3 7 9 5 9-5m-9 5v10"/></>,link:<><path d="M10 13a5 5 0 0 0 7.1 0l3-3A5 5 0 0 0 13 2.9l-1.7 1.7"/><path d="M14 11a5 5 0 0 0-7.1 0l-3 3A5 5 0 0 0 11 21.1l1.7-1.7"/></>};return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">{paths[name]||paths.info}</svg>}
export default function DeveloperFeedbackDetailsPage(){
 const {id=""}=useParams();const navigate=useNavigate();const {roles}=useIdentity();const allowed=roles.includes("developer")||roles.includes("admin");
 const [currentUserId,setCurrentUserId]=useState("");const [feedback,setFeedback]=useState<Feedback|null>(null),[messages,setMessages]=useState<Message[]>([]),[attachments,setAttachments]=useState<Attachment[]>([]),[events,setEvents]=useState<Event[]>([]);
 const [status,setStatus]=useState<ReviewStatus>("new"),[priority,setPriority]=useState<Priority>("normal"),[reply,setReply]=useState(""),[busy,setBusy]=useState(false),[loading,setLoading]=useState(true),[error,setError]=useState(""),[tab,setTab]=useState<"conversation"|"details"|"attachments"|"activity">("conversation"),[files,setFiles]=useState<File[]>([]);
 const load=useCallback(async()=>{if(!identityApi.isConfigured()){setError("Supabase is not configured.");setLoading(false);return}const {data:s}=await identityApi.getSession();const user=s.session?.user;if(!user){navigate("/auth",{replace:true});return}
 setCurrentUserId(user.id);const {data:f,error:e}=await getDeveloperFeedbackDetails(id,user.id);
 if(e||!f){setError("Feedback not found or you do not have access to it.");setLoading(false);return}setFeedback(f as unknown as Feedback);
 const [r,m,a,v]=await Promise.all([
 getDeveloperFeedbackReview(id),
 listDeveloperFeedbackMessages(id),
 listDeveloperFeedbackAttachments(id),
 listDeveloperFeedbackEvents(id)
 ]);
 if(r.data){setStatus((r.data.status||"new") as ReviewStatus);setPriority((r.data.priority||"normal") as Priority)}
 setMessages((m.data??[]) as unknown as Message[]);setAttachments((a.data??[]) as Attachment[]);setEvents((v.data??[]) as Event[]);
 if(m.error||a.error||v.error)setError("Some conversation information could not be loaded. Check access permissions.");
 setLoading(false);
 },[id,navigate]);
 useEffect(()=>{void load()},[load]);
 const app=feedback?.assignment?.test?.app;const test=feedback?.assignment?.test;
 const number=useMemo(()=>id.replaceAll("-","").slice(0,8).toUpperCase(),[id]);
 const updateReview=async(field:"status"|"priority",value:string)=>{if(!identityApi.isConfigured()||!feedback)return;setBusy(true);setError("");const {data:s}=await identityApi.getCurrentUser();const uid=s.user?.id;if(!uid){setBusy(false);return}
 const {data:existing,error:readError}=await getDeveloperFeedbackReview(id,{includeId:true});if(readError){setError("Could not load the current feedback review.");setBusy(false);return}
 const result=existing
 ?field==="status"
  ?await updateDeveloperFeedbackReview(id,{status:value})
  :await updateDeveloperFeedbackReview(id,{priority:value})
 :field==="status"
  ?await createDeveloperFeedbackReview({feedback_id:id,developer_id:uid,status:value})
  :await createDeveloperFeedbackReview({feedback_id:id,developer_id:uid,priority:value});
 if(result.error){setError("Unable to update feedback. Please check your access and try again.");setBusy(false);return}
 if(field==="status")setStatus(value as ReviewStatus);else setPriority(value as Priority);
 await load();setBusy(false)
 };
 const sendReply=async(e:FormEvent<HTMLFormElement>)=>{e.preventDefault();if(!identityApi.isConfigured()||!reply.trim()||!feedback)return;setBusy(true);setError("");const {data:s}=await identityApi.getCurrentUser();const uid=s.user?.id;if(!uid){setBusy(false);return}
 const {data:msg,error:e1}=await createDeveloperFeedbackMessage({feedback_id:id,sender_id:uid,body:reply.trim()});if(e1||!msg){setError("Your reply could not be sent.");setBusy(false);return}
 for(const file of files){const ext=file.name.split(".").pop()?.toLowerCase()||"bin";const path=id+"/"+uid+"/"+crypto.randomUUID()+"."+ext;const upload=await uploadDeveloperFeedbackAttachment(path,file);if(upload.error){setError("Reply sent, but "+file.name+" could not be uploaded.");continue}
 const saved=await createFeedbackAttachmentMetadata({feedback_id:id,message_id:msg.id,uploaded_by:uid,storage_path:path,original_filename:file.name,mime_type:file.type,size_bytes:file.size});if(saved.error)setError("Reply sent, but attachment metadata could not be saved.");
 
 }
 setReply("");setFiles([]);await load();setBusy(false)
 };
 const openAttachment=async(file:Attachment)=>{if(!identityApi.isConfigured())return;const {data,error:e}=await getDeveloperFeedbackAttachmentUrl(file.storage_path);if(e||!data?.signedUrl){setError("Could not open this attachment.");return}window.open(data.signedUrl,"_blank","noopener,noreferrer")};
 const addFiles=(list:FileList|null)=>{if(!list)return;const accepted=Array.from(list).filter(f=>["image/png","image/jpeg","image/webp","text/plain","application/pdf","application/zip"].includes(f.type)&&f.size<=10485760);setFiles(old=>[...old,...accepted].slice(0,5))};
 if(!allowed)return <RoleAccessNotice/>;
 return <main className="df-shell"><aside className="df-sidebar"><Link to="/developer-dashboard" className="df-brand"><span>✓</span><b>TestDZ<small>Build · Test · Improve</small></b></Link><div className="df-module">‹/› <b>Developer</b><i>Pro</i></div><nav><Link to="/developer-dashboard">⌂ Dashboard</Link><Link to="/apps">◇ My Apps</Link><Link to="/developer/tests">♟ My Tests</Link><Link to="/developer/analytics">▥ Analytics</Link><Link to="/developer/results">▤ Test Results</Link><Link to="/developer/notifications">♧ Notifications</Link><Link className="active" to="/developer/feedback"><Glyph name="feedback"/>Feedback</Link><Link to="/developer/help">◉ Help & Support</Link><Link to="/developer/settings">⚙ Settings</Link></nav><div className="df-promo">🚀<b>Upgrade your plan<br/>for more powerful<br/>testing features</b><Link to="/developer/subscription">Upgrade Plan →</Link></div></aside>
 <section className="df-content"><header className="df-top"><label><span>⌕</span><input readOnly value="Search in TestDZ..."/></label><span className="df-user"><Glyph name="info"/><b>DK</b><strong>Dev Kitf⌄</strong></span></header><div className="df-page">
 <div className="dfd-breadcrumb"><Link to="/developer-dashboard">Developer</Link><span>›</span><Link to="/developer/feedback">Feedback</Link><span>›</span><b>Feedback Details</b></div>
 <div className="dfd-toolbar"><Link to="/developer/feedback"><Glyph name="back"/> Back to Feedback</Link><div><label><Glyph name="info"/><select aria-label="Update status" value={status} disabled={busy||loading} onChange={e=>void updateReview("status",e.target.value)}>{Object.entries(statusLabels).map(([k,v])=><option key={k} value={k}>{v}</option>)}</select></label><label>⚑ <select aria-label="Set priority" value={priority} disabled={busy||loading} onChange={e=>void updateReview("priority",e.target.value)}>{Object.entries(priorityLabels).map(([k,v])=><option key={k} value={k}>{v}</option>)}</select></label><button onClick={()=>{setTab("conversation");document.getElementById("dfd-reply")?.scrollIntoView({behavior:"smooth",block:"center"})}}>↶ Reply to Feedback</button></div></div>
 {error&&<div className="df-error" role="alert">{error}<button onClick={()=>void load()}>Retry</button></div>}
 <section className="dfd-heading"><div className="dfd-icon"><Glyph name="feedback"/></div><div><div className="dfd-title"><h1>#FB-{number}</h1><span className={"dfd-status "+status}>{statusLabels[status]}</span></div><h2>{feedback?feedback.category.replaceAll("_"," ").replace(/\b\w/g,c=>c.toUpperCase()):loading?"Loading feedback…":"Feedback"}</h2><div className="dfd-meta"><span><Glyph name="calendar"/>{feedback?dateTime(feedback.created_at):"—"}</span><span><Glyph name="phone"/>Device info unavailable</span><span className={"dfd-priority "+priority}>● {priorityLabels[priority]}</span></div></div></section>
 <div className="dfd-layout"><div className="dfd-main"><nav className="dfd-tabs">{([["conversation","▣","Conversation"],["details","ⓘ","Details"],["attachments","♧","Attachments"],["activity","◷","Activity Log"]] as const).map(([key,icon,label])=><button key={key} className={tab===key?"active":""} onClick={()=>setTab(key)}>{icon}　{label}{key==="attachments"?" ("+attachments.length+")":""}</button>)}</nav>
 {tab==="conversation"&&<><article className="dfd-conversation">{loading?<p className="df-empty">Loading conversation…</p>:<><div className="dfd-original"><span className="dfd-avatar">{feedback?.tester?.avatar_url?<img src={feedback.tester.avatar_url} alt=""/>:initials(feedback?.tester?.display_name||"Tester")}</span><div className="dfd-message-body"><header><b>{feedback?.tester?.display_name||"Tester"}</b><time>{feedback?dateTime(feedback.created_at):""}</time><span className="dfd-badge tester">Tester</span></header><p>{feedback?.body}</p><small>Original feedback · {feedback?.rating??"—"}/5 rating</small></div></div>
 {messages.map(m=>{const own=m.sender_id===currentUserId;return <div className={"dfd-message "+(own?"mine":"") } key={m.id}><span className="dfd-avatar">{initials(m.sender?.display_name||"Developer")}</span><div className="dfd-message-body"><header><b>{m.sender?.display_name||"Developer"}</b><time>{dateTime(m.created_at)}</time><span className={"dfd-badge "+(own?"developer":"tester")}>{own?"Developer":"Tester"}</span></header><p>{m.body}</p>{attachments.filter(a=>a.message_id===m.id).map(a=><button className="dfd-file-chip" key={a.id} onClick={()=>void openAttachment(a)}><Glyph name="clip"/>{a.original_filename}</button>)}</div></div>})}
 {!messages.length&&<div className="dfd-empty-note">No replies yet. Send a response to start the conversation.</div>}</>}</article>
 <form id="dfd-reply" className="dfd-reply" onSubmit={sendReply}><h3><Glyph name="feedback"/> Reply to Feedback</h3><textarea value={reply} onChange={e=>setReply(e.target.value)} maxLength={5000} placeholder="Type your reply here…" required/><div className="dfd-reply-foot"><span>{reply.length} / 5000</span><div><label className="dfd-attach"><Glyph name="clip"/> Attach File<input type="file" multiple accept=".png,.jpg,.jpeg,.webp,.txt,.pdf,.zip" onChange={e=>addFiles(e.target.files)}/></label><label className="dfd-attach"><Glyph name="image"/> Add Screenshot<input type="file" accept="image/png,image/jpeg,image/webp" onChange={e=>addFiles(e.target.files)}/></label><button type="submit" disabled={busy||!reply.trim()}><Glyph name="send"/>{busy?"Sending…":"Send Reply"}</button></div></div>{files.length>0&&<div className="dfd-pending-files">{files.map((f,i)=><span key={i}>{f.name}<button type="button" onClick={()=>setFiles(old=>old.filter((_,j)=>j!==i))}>×</button></span>)}</div>}<small className="dfd-upload-hint">Files up to 10 MB · PNG, JPG, WEBP, TXT, PDF, ZIP</small></form></>}
 {tab==="details"&&<article className="dfd-panel"><h3>Feedback Information</h3><dl><dt>Feedback ID</dt><dd>#FB-{number}</dd><dt>Category</dt><dd>{feedback?.category.replaceAll("_"," ")||"—"}</dd><dt>Rating</dt><dd className="dfd-stars">{"★".repeat(feedback?.rating||0)}{"☆".repeat(5-(feedback?.rating||0))} ({feedback?.rating??"—"}/5)</dd><dt>Quality Status</dt><dd>{feedback?.quality_status||"—"}</dd><dt>Developer Status</dt><dd>{statusLabels[status]}</dd><dt>Priority</dt><dd>{priorityLabels[priority]}</dd><dt>Reported By</dt><dd>{feedback?.tester?.display_name||"Tester"}</dd><dt>Submitted</dt><dd>{feedback?dateTime(feedback.created_at):"—"}</dd></dl><h3>Original Message</h3><p>{feedback?.body}</p></article>}
 {tab==="attachments"&&<article className="dfd-panel"><h3>Attachments ({attachments.length})</h3>{attachments.length?attachments.map(a=><button className="dfd-attachment-row" key={a.id} onClick={()=>void openAttachment(a)}><Glyph name="clip"/><span><b>{a.original_filename}</b><small>{fileSize(a.size_bytes)} · {dateTime(a.created_at)}</small></span><Glyph name="link"/></button>):<div className="dfd-empty-note">No attachments have been shared with this feedback yet.</div>}</article>}
 {tab==="activity"&&<article className="dfd-panel"><h3>Activity Log</h3><div className="dfd-timeline">{events.map(ev=><div key={ev.id}><i>{ev.event_type==="message_sent"?"↶":ev.event_type==="priority_changed"?"⚑":ev.event_type==="attachment_added"?"♧":"●"}</i><b>{ev.event_type==="status_changed"?"Status changed":ev.event_type==="priority_changed"?"Priority changed":ev.event_type==="message_sent"?"Reply sent":ev.event_type==="attachment_added"?"Attachment added":"Feedback event"}{ev.new_value?" to "+(ev.new_value.replaceAll("_"," ")):""}</b><small>{dateTime(ev.created_at)}</small></div>)}{feedback&&<div><i>●</i><b>Feedback submitted</b><small>{dateTime(feedback.created_at)}</small></div>}</div></article>}
 </div><aside className="dfd-side"><article className="dfd-card"><h3><Glyph name="info"/> Feedback Details</h3><dl><dt>♧　Feedback ID</dt><dd>#FB-{number}</dd><dt>●　Status</dt><dd><span className={"dfd-status "+status}>{statusLabels[status]}</span></dd><dt>⚑　Priority</dt><dd><span className={"dfd-priority "+priority}>{priorityLabels[priority]}</span></dd><dt>▤　Category</dt><dd>{feedback?.category.replaceAll("_"," ")||"—"}</dd><dt>✿　App</dt><dd>{app?.name||"—"}</dd><dt>♟　Reported By</dt><dd>{feedback?.tester?.display_name||"Tester"}</dd><dt>▦　Created</dt><dd>{feedback?dateTime(feedback.created_at):"—"}</dd></dl></article><article className="dfd-card"><h3><Glyph name="app"/> Related Information</h3><dl><dt>Test Campaign</dt><dd>{test?.title||"—"}</dd><dt>Package</dt><dd>{app?.package_name||"—"}</dd><dt>Device</dt><dd>Not provided</dd></dl>{test?.id&&<Link className="dfd-related-link" to={"/developer/tests/"+test.id}>View Test Campaign →</Link>}{app?.id&&<Link className="dfd-related-link" to={"/apps/"+app.id}>View App Details →</Link>}</article><article className="dfd-card"><h3><Glyph name="clock"/> Activity Timeline <button onClick={()=>setTab("activity")}>View All →</button></h3><div className="dfd-timeline compact">{events.slice(0,3).map(ev=><div key={ev.id}><i>●</i><b>{ev.event_type.replaceAll("_"," ")}</b><small>{dateTime(ev.created_at)}</small></div>)}{!events.length&&<p className="dfd-subtle">No activity recorded yet.</p>}</div></article></aside></div><footer className="df-footer">TestDZ · Build · Test · Improve</footer></div></section></main>
}
