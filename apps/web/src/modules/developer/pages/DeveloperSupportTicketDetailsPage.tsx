import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { ChangeEvent, FormEvent } from "react";
import { Link, useParams } from "react-router-dom";
import { supabase } from "../../../lib/supabase";
import { useIdentity } from "../../../features/identity/hooks/useIdentity";
import { RoleAccessNotice } from "../../../shared/guards/RoleGuard";
import "../styles/developer-dashboard.css";
import "../styles/developer-support-ticket-details.css";

type Ticket = { id:string; ticket_number:number; user_id:string; requester_role:string; subject:string; category:string; priority:string; status:string; description:string; created_at:string; updated_at:string; resolved_at:string|null; resolved_by:string|null };
type Message = { id:string; ticket_id:string; sender_id:string; body:string; created_at:string };
type Attachment = { id:string; ticket_id:string; message_id:string; uploaded_by:string; storage_path:string; original_filename:string; mime_type:string; size_bytes:number; created_at:string };
type TicketEvent = { id:string; ticket_id:string; actor_id:string|null; event_type:string; old_status:string|null; new_status:string|null; old_priority:string|null; new_priority:string|null; created_at:string };
const statusLabel:Record<string,string>={open:"Open",in_progress:"In Progress",waiting_for_user:"Waiting for You",resolved:"Resolved",closed:"Closed"};
const priorityLabel:Record<string,string>={normal:"Normal",high:"High Priority",urgent:"Urgent"};
const categoryLabel:Record<string,string>={technical:"Technical Issue",account:"Account & Access",testing:"Tests & Campaigns",payments:"Plans & Billing",other:"Other"};
const dateTime=(value:string|null|undefined)=>value?new Date(value).toLocaleString(undefined,{month:"short",day:"numeric",year:"numeric",hour:"numeric",minute:"2-digit"}):"—";
const sizeLabel=(bytes:number)=>bytes<1024?bytes+" B":bytes<1024*1024?Math.round(bytes/1024)+" KB":(bytes/1024/1024).toFixed(1)+" MB";
const allowedTypes=["image/png","image/jpeg","image/webp","text/plain","application/pdf","application/zip"];
export default function DeveloperSupportTicketDetailsPage(){
 const {id=""}=useParams();const {user}=useIdentity();
 const [ticket,setTicket]=useState<Ticket|null>(null),[messages,setMessages]=useState<Message[]>([]),[attachments,setAttachments]=useState<Attachment[]>([]),[events,setEvents]=useState<TicketEvent[]>([]);
 const [loading,setLoading]=useState(true),[sending,setSending]=useState(false),[reply,setReply]=useState(""),[selectedFile,setSelectedFile]=useState<File|null>(null),[error,setError]=useState(""),[notice,setNotice]=useState("");
 const fileRef=useRef<HTMLInputElement>(null);
 const name=user?.user_metadata?.display_name||user?.email?.split("@")[0]||"Developer";const initials=name.split(/[\s._-]+/).slice(0,2).map((part: string)=>part[0]).join("").toUpperCase()||"DK";
 const load=useCallback(async()=>{
  if(!supabase||!user||!id){setLoading(false);return;}setLoading(true);setError("");
  const {data:ticketData,error:ticketError}=await supabase.from("support_tickets").select("id,ticket_number,user_id,requester_role,subject,category,priority,status,description,created_at,updated_at,resolved_at,resolved_by").eq("id",id).eq("requester_role","developer").maybeSingle();
  if(ticketError||!ticketData||ticketData.user_id!==user.id){setError("This ticket could not be loaded. It may not exist or you may not have access to it.");setTicket(null);setMessages([]);setAttachments([]);setEvents([]);setLoading(false);return;}
  setTicket(ticketData as Ticket);
  const [messageResult,attachmentResult,eventResult]=await Promise.all([
   supabase.from("support_ticket_messages").select("id,ticket_id,sender_id,body,created_at").eq("ticket_id",id).order("created_at",{ascending:true}),
   supabase.from("support_ticket_attachments").select("id,ticket_id,message_id,uploaded_by,storage_path,original_filename,mime_type,size_bytes,created_at").eq("ticket_id",id).order("created_at",{ascending:true}),
   supabase.from("support_ticket_events").select("id,ticket_id,actor_id,event_type,old_status,new_status,old_priority,new_priority,created_at").eq("ticket_id",id).order("created_at",{ascending:false})
  ]);
  if(messageResult.error||attachmentResult.error||eventResult.error){setError("Some ticket activity could not be loaded. Please refresh or contact support.");}
  setMessages((messageResult.data||[]) as Message[]);setAttachments((attachmentResult.data||[]) as Attachment[]);setEvents((eventResult.data||[]) as TicketEvent[]);setLoading(false);
 },[id,user?.id]);
 useEffect(()=>{void load();},[load]);
 const canReply=!!ticket&&ticket.status!=="closed"&&ticket.status!=="resolved"&&ticket.user_id===user?.id;
 const initialMessage=useMemo(()=>({id:"initial",ticket_id:id,sender_id:ticket?.user_id||"",body:ticket?.description||"",created_at:ticket?.created_at||""}),[id,ticket]);
 async function sendReply(event:FormEvent<HTMLFormElement>){
  event.preventDefault();if(!supabase||!user||!ticket||(!reply.trim()&&!selectedFile))return;
  if(selectedFile&&(selectedFile.size>10*1024*1024||!allowedTypes.includes(selectedFile.type))){setError("Choose a PNG, JPEG, WebP, TXT, PDF or ZIP file up to 10 MB.");return;}
  setSending(true);setError("");setNotice("");
  const body=reply.trim()||(selectedFile?"Attached a file.":"");
  const {data:messageData,error:insertError}=await supabase.from("support_ticket_messages").insert({ticket_id:ticket.id,sender_id:user.id,body}).select("id").single();
  if(insertError||!messageData){setSending(false);setError("Your reply could not be sent. Please try again.");return;}
  if(selectedFile){
   const safeName=selectedFile.name.replace(/[^a-zA-Z0-9._-]/g,"_").slice(-180)||"attachment";
   const storagePath=`${ticket.id}/${user.id}/${crypto.randomUUID()}-${safeName}`;
   const {error:uploadError}=await supabase.storage.from("support-attachments").upload(storagePath,selectedFile,{contentType:selectedFile.type,upsert:false});
   if(uploadError){setSending(false);setReply("");setSelectedFile(null);setNotice("Your reply was sent, but the file upload failed. Please attach it in a new reply.");await load();return;}
   const {error:metadataError}=await supabase.from("support_ticket_attachments").insert({ticket_id:ticket.id,message_id:messageData.id,uploaded_by:user.id,storage_path:storagePath,original_filename:selectedFile.name,mime_type:selectedFile.type,size_bytes:selectedFile.size});
   if(metadataError){setSending(false);setReply("");setSelectedFile(null);setError("Your reply was sent, but the attachment record could not be saved.");await load();return;}
  }
  setSending(false);setReply("");setSelectedFile(null);if(fileRef.current)fileRef.current.value="";setNotice("Your reply has been sent.");await load();
 }
 async function openAttachment(item:Attachment){
  if(!supabase)return;const {data,error:storageError}=await supabase.storage.from("support-attachments").createSignedUrl(item.storage_path,60);
  if(storageError||!data?.signedUrl){setError("This attachment is unavailable or you do not have permission to access it.");return;}
  window.open(data.signedUrl,"_blank","noopener,noreferrer");
 }
 const ticketCode=ticket?`#SUP-${new Date(ticket.created_at).getFullYear()}-${String(ticket.ticket_number).padStart(4,"0")}`:"";
 return <div className="dd-shell dst-shell">
  <aside className="dd-sidebar"><Link to="/developer-dashboard" className="dd-brand"><span className="dd-brand-mark">✦</span><strong>TestDZ</strong><small>Build · Test · Improve</small></Link><nav className="dd-nav"><Link to="/developer-dashboard" className="dd-nav-link"><span>⌂</span><span>Dashboard</span></Link><span className="dd-nav-label">APPS & WORKSPACE</span><Link to="/apps" className="dd-nav-link"><span>▦</span><span>My Apps</span></Link><Link to="/developer/tests" className="dd-nav-link"><span>⚗</span><span>My Tests</span></Link><Link to="/developer/tests" className="dd-nav-link"><span>◈</span><span>Test Monitoring</span></Link><Link to="/developer/testers" className="dd-nav-link"><span>♙</span><span>Testers Management</span></Link><Link to="/developer/analytics" className="dd-nav-link"><span>▥</span><span>Analytics</span></Link><Link to="/developer/results" className="dd-nav-link"><span>▤</span><span>Test Results</span></Link><Link to="/developer/subscription" className="dd-nav-link"><span>▣</span><span>Subscription</span></Link><span className="dd-nav-label">SUPPORT</span><Link to="/developer/help" className="dd-nav-link"><span>ⓘ</span><span>Help Center</span></Link><Link to="/developer/support" className="dd-nav-link active"><span>☏</span><span>Help & Support</span></Link><Link to="/developer/notifications" className="dd-nav-link"><span>♧</span><span>Notifications</span></Link><Link to="/developer/settings" className="dd-nav-link"><span>⚙</span><span>Settings</span></Link></nav><div className="dd-user"><span className="dd-avatar">{initials}</span><span><strong>{name}</strong><small>Developer</small></span></div></aside>
  <main className="dd-main dst-main"><RoleAccessNotice/><header className="dd-topbar dst-topbar"><label className="dd-search">⌕ <input placeholder="Search in TestDZ…" aria-label="Search in TestDZ"/></label><div className="dd-top-actions"><Link to="/developer/notifications" className="dst-bell" aria-label="Notifications">♧<i>3</i></Link><Link to="/profile" className="dd-top-avatar">{initials}</Link><strong className="dst-account">{name}</strong></div></header>
   <div className="dst-content"><div className="dst-breadcrumb"><Link to="/developer-dashboard">Developer</Link><span>›</span><Link to="/developer/support">Support</Link><span>›</span><b>Ticket Details</b></div><Link to="/developer/support" className="dst-back">← Back to Support</Link>
   {loading?<div className="dst-state">Loading ticket details…</div>:!ticket?<div className="dst-state"><h2>Ticket unavailable</h2><p>{error||"This support ticket could not be found."}</p><Link to="/developer/support">Return to Support</Link></div>:<>
    <section className="dst-ticket-head"><div className="dst-ticket-icon">☏</div><div className="dst-ticket-title"><h1>{ticketCode} <button type="button" title="Copy ticket number" onClick={()=>void navigator.clipboard?.writeText(ticketCode)}>▢</button></h1><h2>{ticket.subject}</h2><div className="dst-meta"><span className={"dst-status "+ticket.status}>● {statusLabel[ticket.status]||ticket.status}</span><span className={"dst-priority "+ticket.priority}>⚑ {priorityLabel[ticket.priority]||ticket.priority}</span><span>▦ {dateTime(ticket.created_at)}</span></div></div><button type="button" className="dst-head-attach" onClick={()=>fileRef.current?.click()}>⌁ Attach File</button></section>
    {notice&&<p className="dst-notice" role="status">{notice}</p>}{error&&<p className="dst-error" role="alert">{error}</p>}
    <div className="dst-layout"><div className="dst-main-column"><section className="dst-card dst-conversation"><h2><span>▰</span> Conversation ({messages.length+1} messages)</h2>
      <article className="dst-message"><div className="dst-avatar own">{initials}</div><div className="dst-message-body"><div className="dst-message-meta"><strong>You (Developer)</strong><time>{dateTime(initialMessage.created_at)}</time></div><div className="dst-bubble own">{initialMessage.body}</div></div></article>
      {messages.map(message=><article className="dst-message" key={message.id}><div className={"dst-avatar "+(message.sender_id===user?.id?"own":"support")}>{message.sender_id===user?.id?initials:"☏"}</div><div className="dst-message-body"><div className="dst-message-meta"><strong>{message.sender_id===user?.id?"You (Developer)":"Support Team ✓"}</strong><time>{dateTime(message.created_at)}</time></div><div className={"dst-bubble "+(message.sender_id===user?.id?"own":"")}>{message.body}</div></div></article>)}
     </section>
     <section className="dst-card dst-reply"><form onSubmit={sendReply}><h2><span>▰</span> Your Reply</h2><textarea value={reply} onChange={e=>setReply(e.target.value)} maxLength={2000} rows={3} placeholder={canReply?"Type your message…":"Replies are unavailable for this ticket."} disabled={!canReply||sending}/><div className="dst-reply-footer"><div className="dst-reply-tools"><button type="button" onClick={()=>fileRef.current?.click()} disabled={!canReply||sending}>⌁ Attach File</button><span className="dst-file-label">{selectedFile?.name||" "}</span><input ref={fileRef} type="file" hidden accept=".png,.jpg,.jpeg,.webp,.txt,.pdf,.zip" onChange={(e:ChangeEvent<HTMLInputElement>)=>setSelectedFile(e.target.files?.[0]||null)}/></div><span className="dst-count">{reply.length} / 2000</span><button className="dst-send" type="submit" disabled={!canReply||sending||(!reply.trim()&&!selectedFile)}>➤ {sending?"Sending…":"Send Reply"}</button></div>{!canReply&&<small className="dst-muted">This ticket is closed or resolved and cannot receive replies.</small>}</form></section>
    </div><aside className="dst-side-column"><section className="dst-card dst-info"><h2>● Ticket Information</h2><dl><div><dt>Ticket Number</dt><dd>{ticketCode}</dd></div><div><dt>Status</dt><dd><span className={"dst-status "+ticket.status}>● {statusLabel[ticket.status]||ticket.status}</span></dd></div><div><dt>Priority</dt><dd><span className={"dst-priority "+ticket.priority}>⚑ {priorityLabel[ticket.priority]||ticket.priority}</span></dd></div><div><dt>Category</dt><dd>{categoryLabel[ticket.category]||ticket.category}</dd></div><div><dt>Created</dt><dd>{dateTime(ticket.created_at)}</dd></div><div><dt>Last Updated</dt><dd>{dateTime(ticket.updated_at)}</dd></div><div><dt>Assigned To</dt><dd>☏ Support Team</dd></div></dl></section>
     <section className="dst-card dst-attachments"><h2>▰ Attachments ({attachments.length})</h2>{attachments.length?attachments.map(item=><button className="dst-attachment" type="button" key={item.id} onClick={()=>void openAttachment(item)}><span className="dst-file-icon">{item.mime_type==="application/pdf"?"PDF":item.mime_type.startsWith("image/")?"IMG":"FILE"}</span><span><strong>{item.original_filename}</strong><small>{sizeLabel(item.size_bytes)} · {dateTime(item.created_at)}</small></span><b>↓</b></button>):<p className="dst-muted">No attachments yet.</p>}</section>
     <section className="dst-card dst-activity"><h2>◷ Activity Log</h2>{events.length?events.map(item=><div className="dst-event" key={item.id}><i/><div><strong>{item.event_type==="created"?"Ticket created":item.event_type==="status_changed"?"Status changed":item.event_type==="priority_changed"?"Priority changed":"Ticket updated"}{item.event_type==="status_changed"&&item.new_status?" to "+(statusLabel[item.new_status]||item.new_status):""}{item.event_type==="priority_changed"&&item.new_priority?" to "+(priorityLabel[item.new_priority]||item.new_priority):""}</strong><small>{dateTime(item.created_at)}</small></div></div>):<p className="dst-muted">No activity has been recorded yet.</p>}</section>
    </aside></div></>}
   </div>
  </main>
 </div>;
}
