import { useCallback, useEffect, useMemo, useState } from "react";
import type { FormEvent, ChangeEvent } from "react";
import { Link, useParams } from "react-router-dom";
import { supabase } from "../../../lib/supabase";
import { getTesterSupportTicketDetails, sendTesterSupportMessage, addTesterSupportAttachment, updateSupportTicket } from "../../../features/support/support-api";
import { useIdentity } from "../../../shared/auth/hooks/useIdentity";
import TesterSidebar, { Icon } from "../components/TesterSidebar";
import "../styles/tester-dashboard.css";
import "../styles/support-ticket-details.css";

type Ticket = { id:string; ticket_number:number; user_id:string; subject:string; category:string; priority:string; status:string; description:string; created_at:string; updated_at:string; resolved_at:string|null; resolved_by:string|null };
type Message = { id:string; ticket_id:string; sender_id:string; body:string; internal_note:boolean; created_at:string; sender?: { display_name?:string; email?:string } };
type Attachment = { id:string; ticket_id:string; message_id:string; uploaded_by:string; storage_path:string; original_filename:string; mime_type:string; size_bytes:number; created_at:string };
const statusLabel:Record<string,string>={open:"Open",in_progress:"In Progress",waiting_for_user:"Waiting for You",resolved:"Resolved",closed:"Closed"};
const categoryLabel:Record<string,string>={technical:"Technical",account:"Account",testing:"Tests & Assignments",rewards:"Rewards & Points",payments:"Payments & Withdrawals",other:"Other"};
const dateTime=(value:string|null|undefined)=>value?new Date(value).toLocaleString(undefined,{month:"short",day:"2-digit",year:"numeric",hour:"2-digit",minute:"2-digit"}):"—";
const sizeLabel=(bytes:number)=>bytes<1024?bytes+" B":bytes<1024*1024?Math.round(bytes/1024)+" KB":(bytes/1024/1024).toFixed(1)+" MB";
export default function SupportTicketDetailsPage(){
 const {id=""}=useParams(); const {user,roles=[]}=useIdentity();
 const [ticket,setTicket]=useState<Ticket|null>(null),[messages,setMessages]=useState<Message[]>([]),[attachments,setAttachments]=useState<Attachment[]>([]);
 const [loading,setLoading]=useState(true),[sending,setSending]=useState(false),[reply,setReply]=useState(""),[selectedFile,setSelectedFile]=useState<File|null>(null),[error,setError]=useState(""),[notice,setNotice]=useState("");
 const [nextStatus,setNextStatus]=useState("open"),[nextPriority,setNextPriority]=useState("normal"),[updateReason,setUpdateReason]=useState(""),[updating,setUpdating]=useState(false);
 const [menuOpen,setMenuOpen]=useState(false);
 const name=user?.user_metadata?.display_name||user?.email?.split("@")[0]||"Tester";
 const firstName=name.split(/[\s._-]+/)[0]||"Tester",isAdmin=roles.includes("admin"),isDeveloper=roles.includes("developer");
 const nav=[{label:"Dashboard",icon:"home",href:"/tester-dashboard"},{label:"Discover Tests",icon:"search",href:"/discover-tests"},{label:"My Tests",icon:"tests",href:"/my-tests"},{label:"Feedback History",icon:"star",href:"/feedback-history"},{label:"Wallet & Rewards",icon:"wallet",href:"/wallet-rewards"},{label:"Profile",icon:"user",href:"/profile"},{label:"Help Center",icon:"book",href:"/help"},{label:"Support Center",icon:"headset",href:"/support",active:true},{label:"Settings",icon:"settings",href:"/settings"},...(isDeveloper?[{label:"Developer Dashboard",icon:"code",href:"/developer-dashboard"}]:[]),...(roles.includes("support")||isAdmin?[{label:"Support Queue",icon:"headset",href:"/support/queue"}]:[]),...(isAdmin?[{label:"Admin",icon:"shield",href:"/admin"}]:[])];
 const load=useCallback(async()=>{
  if(!user||!id){setLoading(false);return;}
  setLoading(true);setError("");
  const {ticketResult,messageResult,attachmentResult}=await getTesterSupportTicketDetails(id);
  const ticketData=ticketResult.data;
  if(ticketResult.error||!ticketData){setError("This ticket could not be loaded. It may not exist or you may not have access to it.");setTicket(null);setMessages([]);setAttachments([]);setLoading(false);return;}
  setTicket(ticketData as Ticket);setNextStatus(ticketData.status);setNextPriority(ticketData.priority);
  if(messageResult?.error||attachmentResult?.error){setError("Ticket details are available, but conversation or attachment records could not be loaded. Please refresh and try again.");setMessages([]);setAttachments([]);}
  else {setMessages((messageResult?.data||[]) as Message[]);setAttachments((attachmentResult?.data||[]) as Attachment[]);}
  setLoading(false);
 },[id,user?.id]);
 useEffect(()=>{void load();},[load]);
 const isSupportStaff=roles.includes("support")||isAdmin;
 const canReply=!!ticket&&ticket.status!=="closed"&&(ticket.user_id===user?.id||isSupportStaff);
 const customerMessages=useMemo(()=>new Set(messages.filter(m=>m.sender_id===ticket?.user_id).map(m=>m.id)),[messages,ticket?.user_id]);
 async function sendReply(event:FormEvent<HTMLFormElement>){
  event.preventDefault();if(!user||!ticket||!reply.trim())return;
  setSending(true);setError("");setNotice("");
  if(!supabase){setSending(false);setError("Storage is unavailable.");return;}
   if(selectedFile&&(selectedFile.size>10*1024*1024||!["image/png","image/jpeg","image/webp","text/plain","application/pdf","application/zip"].includes(selectedFile.type))){
   setSending(false);setError("Choose a PNG, JPEG, WebP, TXT, PDF or ZIP file up to 10 MB.");return;
  }
  const {data:messageData,error:insertError}=await sendTesterSupportMessage(ticket.id,user.id,reply.trim());
  const messageId=typeof messageData==="string"?messageData:messageData?.id;
  if(insertError||!messageId){setSending(false);setError("Your reply could not be sent. Please try again.");return;}
  if(selectedFile){
   const safeName=selectedFile.name.replace(/[^a-zA-Z0-9._-]/g,"_").slice(-180)||"attachment";
   const storagePath=`${ticket.id}/${user.id}/${crypto.randomUUID()}-${safeName}`;
    const {error:uploadError}=await supabase.storage.from("support-attachments").upload(storagePath,selectedFile,{contentType:selectedFile.type,upsert:false});
   if(uploadError){setSending(false);setReply("");setSelectedFile(null);setNotice("Your reply was sent, but the attachment could not be uploaded. You can send it again in a new reply.");await load();return;}
    const {error:metadataError}=await addTesterSupportAttachment({ticketId:ticket.id,messageId,userId:user.id,storagePath,filename:selectedFile.name.slice(0,255),mimeType:selectedFile.type,sizeBytes:selectedFile.size});
   if(metadataError){setSending(false);setReply("");setSelectedFile(null);await load();setError("Your reply was sent, but the attachment record could not be saved. Contact support before uploading it again.");return;}
  }
  setSending(false);setReply("");setSelectedFile(null);setNotice("Reply sent.");await load();
 }
 async function updateTicket(event:FormEvent<HTMLFormElement>){
  event.preventDefault();if(!ticket)return;
  const status=nextStatus===ticket.status?null:nextStatus;
  const priority=nextPriority===ticket.priority?null:nextPriority;
  const reason=updateReason.trim();
  if(!status&&!priority){setError("Choose a new status or priority before saving.");return;}
  if(reason.length<10||reason.length>1000){setError("The audit reason must contain 10–1000 characters.");return;}
  setUpdating(true);setError("");setNotice("");
  const result=await updateSupportTicket({ticketId:ticket.id,status,priority,reason});
  setUpdating(false);
  if(result.error){setError("The ticket update was rejected. Check the allowed status transition and your Support/Admin permissions.");return;}
  setUpdateReason("");setNotice("Ticket updated. The change and reason were recorded in the audit log.");await load();
 }
 async function openAttachment(item:Attachment){
  setError("");
  if(!supabase)return;
   const {data,error:storageError}=await supabase.storage.from("support-attachments").createSignedUrl(item.storage_path,60);
  if(storageError||!data?.signedUrl){setError("This attachment is not available or you do not have permission to access it.");return;}
  window.open(data.signedUrl,"_blank","noopener,noreferrer");
 }
 return <div className="td-dashboard std-dashboard">
  <TesterSidebar nav={nav} name={name} firstName={firstName} avatar="" roles={roles} isAdmin={isAdmin} isDeveloper={isDeveloper} workspaceMenuOpen={menuOpen} setWorkspaceMenuOpen={setMenuOpen} previewMode={false}/>
  <main className="td-main std-main">
   <header className="td-topbar std-topbar"><label className="td-search std-search"><Icon name="search" size={20}/><input placeholder="Search in TestDZ…" aria-label="Search in TestDZ"/></label><div className="td-top-actions"><Link to="/notifications" className="td-notification" aria-label="Notifications"><Icon name="bell" size={21}/></Link><span className="td-top-divider"/><Link to="/profile" className="td-profile-short"><span>{firstName.slice(0,2).toUpperCase()}</span><strong>{name}</strong><b>⌄</b></Link></div></header>
   <div className="std-content">
    <Link to="/support" className="std-back">← Back to Support</Link>
    {loading?<section className="std-state"><Icon name="refresh" size={26}/>Loading ticket details…</section>:!ticket?<section className="std-state"><Icon name="alert" size={28}/><h2>Ticket unavailable</h2><p>{error||"We could not find this support ticket."}</p><Link to="/support">Return to Support Center</Link></section>:<>
     <section className="std-ticket-head"><div className="std-ticket-icon"><Icon name="receipt" size={38}/></div><div className="std-ticket-title"><div className="std-ticket-number">Ticket #SUP-{new Date(ticket.created_at).getFullYear()}-{String(ticket.ticket_number).padStart(4,"0")}</div><h1>{ticket.subject}</h1><div className="std-meta"><span><Icon name="calendar" size={16}/>{dateTime(ticket.created_at)}</span><i/><span><Icon name="tag" size={16}/>{categoryLabel[ticket.category]||ticket.category}</span><i/><span className={"std-priority "+ticket.priority}><Icon name="alert" size={15}/>{ticket.priority}</span></div></div><span className={"std-status "+ticket.status}><Icon name={ticket.status==="resolved"?"check":"clock"} size={17}/>{statusLabel[ticket.status]||ticket.status}</span></section>
     {ticket.status==="resolved"&&<div className="std-resolved-banner"><span><Icon name="check" size={25}/></span><div><strong>This ticket has been resolved</strong><p>Your issue has been marked as resolved. Thank you for your report!</p></div></div>}
     {notice&&<p className="std-notice" role="status">{notice}</p>}{error&&<p className="std-error" role="alert">{error}</p>}
     <div className="std-layout"><div className="std-main-column">
      <section className="std-card std-conversation"><div className="std-card-title"><Icon name="message" size={22}/><h2>Conversation ({messages.length+1} messages)</h2></div>
       <article className="std-message"><div className="std-avatar">{ticket.user_id===user?.id?firstName.slice(0,2).toUpperCase():"T"}</div><div className="std-message-content"><div className="std-message-meta"><strong>{ticket.user_id===user?.id?"You":"Tester"}</strong><span>{dateTime(ticket.created_at)}</span></div><div className={"std-bubble "+(ticket.user_id===user?.id?"own":"")}>{ticket.description}</div></div></article>
       {messages.map(message=>{const fromCustomer=customerMessages.has(message.id),isCurrentSender=message.sender_id===user?.id;return <article className={"std-message "+(message.internal_note?"std-internal-note":"")} key={message.id}><div className={"std-avatar "+(!fromCustomer?"support":"")}>{fromCustomer?(ticket.user_id===user?.id?firstName.slice(0,2).toUpperCase():"T"):isCurrentSender?firstName.slice(0,2).toUpperCase():"S"}</div><div className="std-message-content"><div className="std-message-meta"><strong>{message.internal_note?"Internal note · staff only":fromCustomer?(ticket.user_id===user?.id?"You":"Tester"):isCurrentSender?"You":"TestDZ Support"}</strong><span>{dateTime(message.created_at)}</span></div><div className={"std-bubble "+(fromCustomer?"own":"")+(message.internal_note?" internal":"")}>{message.body}</div></div></article>})}
       {attachments.length>0&&<div className="std-attachments"><h3><Icon name="file" size={18}/> Attachments ({attachments.length})</h3>{attachments.map(item=><div className="std-attachment" key={item.id}><span className="std-file-icon"><Icon name="file" size={23}/></span><div className="std-file-name"><strong>{item.original_filename}</strong><small>{sizeLabel(item.size_bytes)} · {dateTime(item.created_at)}</small></div><button type="button" onClick={()=>void openAttachment(item)}><Icon name="eye" size={17}/> View / Download</button></div>)}</div>}
       {!messages.length&&<p className="std-empty-note">No replies yet. Your support team can respond here.</p>}
      </section>
      {isSupportStaff&&<section className="std-card std-staff-controls"><h2>Staff controls</h2><p>Status and priority changes require an audit reason and are validated by the database.</p><form onSubmit={updateTicket}><fieldset disabled={updating||(ticket.status==="closed"&&!isAdmin)}><label>Status<select value={nextStatus} onChange={e=>setNextStatus(e.target.value)}><option value="open">Open</option><option value="in_progress">In progress</option><option value="waiting_for_user">Waiting for user</option><option value="resolved">Resolved</option><option value="closed">Closed</option></select></label><label>Priority<select value={nextPriority} onChange={e=>setNextPriority(e.target.value)}><option value="normal">Normal</option><option value="high">High</option><option value="urgent">Urgent</option></select></label><label>Audit reason<textarea rows={3} minLength={10} maxLength={1000} value={updateReason} onChange={e=>setUpdateReason(e.target.value)} placeholder="Explain the reason for this change…"/></label></fieldset>{ticket.status==="closed"&&!isAdmin&&<small>Only Admin can modify a closed ticket.</small>}<button type="submit" disabled={updating||(ticket.status==="closed"&&!isAdmin)||updateReason.trim().length<10||(nextStatus===ticket.status&&nextPriority===ticket.priority)}>{updating?"Saving…":"Save audited changes"}</button></form></section>}
      <section className="std-card std-reply"><form onSubmit={sendReply}><label htmlFor="std-reply">Your reply</label><textarea id="std-reply" rows={3} maxLength={5000} value={reply} onChange={e=>setReply(e.target.value)} placeholder={canReply?"Type your reply here…":"This ticket is closed for replies."} disabled={!canReply||sending}/><div className="std-reply-actions"><label className="std-attach-button"><Icon name="file" size={17}/> Attach File<input type="file" accept=".png,.jpg,.jpeg,.webp,.txt,.pdf,.zip" onChange={(e:ChangeEvent<HTMLInputElement>)=>setSelectedFile(e.target.files?.[0]||null)} disabled={!canReply||sending}/></label>{selectedFile&&<span className="std-selected-file">{selectedFile.name}</span>}<button type="submit" disabled={!canReply||sending||!reply.trim()}><Icon name="send" size={17}/>{sending?"Sending…":"Send Reply"}</button></div>{!canReply&&<small className="std-closed-note">Replies are unavailable for this ticket or account.</small>}</form></section>
     </div><aside className="std-side-column">
      <section className="std-info-card"><h2><Icon name="info" size={22}/> Ticket Information</h2><dl><div><dt>Ticket ID:</dt><dd>SUP-{new Date(ticket.created_at).getFullYear()}-{String(ticket.ticket_number).padStart(4,"0")}</dd></div><div><dt>Subject:</dt><dd>{ticket.subject}</dd></div><div><dt>Category:</dt><dd>{categoryLabel[ticket.category]||ticket.category}</dd></div><div><dt>Priority:</dt><dd className={"std-priority "+ticket.priority}>{ticket.priority}</dd></div><div><dt>Status:</dt><dd><span className={"std-status mini "+ticket.status}>{statusLabel[ticket.status]||ticket.status}</span></dd></div><div><dt>Submitted:</dt><dd>{dateTime(ticket.created_at)}</dd></div><div><dt>Resolved:</dt><dd>{ticket.resolved_at?dateTime(ticket.resolved_at):"—"}</dd></div><div><dt>Handled By:</dt><dd>{ticket.resolved_by?"Support Team":"Not assigned"}</dd></div></dl></section>
      <section className="std-quick-card"><h2><Icon name="bolt" size={21}/> Quick Actions</h2><Link to="/support?new=1"><Icon name="send" size={17}/> Create New Ticket</Link><Link to="/help"><Icon name="book" size={17}/> Back to Help Center</Link></section>
      <section className="std-guides-card"><h2><Icon name="book" size={21}/> Helpful Guides</h2><Link to="/help">Tester Quick Start Guide <Icon name="chevron" size={15}/></Link><Link to="/help">Rewards System Guide <Icon name="chevron" size={15}/></Link><Link to="/help">Testing Best Practices <Icon name="chevron" size={15}/></Link><Link to="/help">Privacy & Data Management <Icon name="chevron" size={15}/></Link></section>
     </aside></div>
     <section className="std-bottom-banners"><article className="std-banner help"><Icon name="book" size={31}/><div><h3>Help Center Shortcut</h3><p>Find answers in our Help Center for common questions.</p><Link to="/help">Go to Help Center <Icon name="arrow" size={14}/></Link></div></article><article className="std-banner live"><span className="std-live-avatar"><Icon name="headset" size={34}/></span><div><h3>Live Support</h3><p>Chat with our support team for instant help.</p><Link to="/live-chat" className="std-live-cta"><Icon name="message" size={14}/> Start Live Chat <Icon name="arrow" size={13}/></Link></div></article><article className="std-banner report"><Icon name="alert" size={31}/><div><h3>Report a Problem</h3><p>Found a bug or security issue? Let us know.</p><Link to="/report-problem">Report Issue <Icon name="arrow" size={14}/></Link></div></article><article className="std-banner guides"><Icon name="book" size={31}/><div><h3>Helpful Guides</h3><p>Explore our guides and tutorials.</p><Link to="/help">View Guides <Icon name="arrow" size={14}/></Link></div></article></section>
    </>}
   </div>
  </main>
 </div>;
}
