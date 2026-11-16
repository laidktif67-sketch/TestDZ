import { useCallback, useEffect, useState } from "react";
import { Link, Navigate } from "react-router-dom";
import { isTesterWorkflowV2Enabled } from "../../../lib/supabase-v2";
import { useIdentity } from "../../../shared/auth/hooks/useIdentity";
import { Brand } from "../../../shared/components/Brand";
import {
  listDeveloperFeedback,
  listDeveloperFeedbackMessages,
  sendDeveloperFeedbackMessage,
  updateDeveloperFeedbackReview,
  type DeveloperFeedbackMessage,
  type DeveloperFeedbackPriority,
  type DeveloperFeedbackRecord,
  type DeveloperFeedbackStatus,
} from "../../../features/apps/apps-api";
import "./../styles/developer-feedback.css";

const statusLabels: Record<DeveloperFeedbackStatus,string> = {
  new:"New",under_review:"Under review",planned:"Planned",resolved:"Resolved",wont_fix:"Won't fix"
};
const priorityLabels: Record<DeveloperFeedbackPriority,string> = {
  low:"Low",normal:"Normal",high:"High",urgent:"Urgent"
};
const categoryLabels: Record<string,string> = {
  general:"General",bug:"Bug",usability:"Usability",performance:"Performance",compatibility:"Compatibility"
};
const dateLabel=(value:string)=>new Date(value).toLocaleString(undefined,{dateStyle:"medium",timeStyle:"short"});

export default function DeveloperFeedbackPage(){
  const {session,roles=[],loading:identityLoading}=useIdentity();
  const [rows,setRows]=useState<DeveloperFeedbackRecord[]>([]);
  const [selectedId,setSelectedId]=useState("");
  const [messages,setMessages]=useState<DeveloperFeedbackMessage[]>([]);
  const [status,setStatus]=useState<DeveloperFeedbackStatus>("new");
  const [priority,setPriority]=useState<DeveloperFeedbackPriority>("normal");
  const [resolutionNote,setResolutionNote]=useState("");
  const [messageDraft,setMessageDraft]=useState("");
  const [filter,setFilter]=useState<"all"|DeveloperFeedbackStatus>("all");
  const [search,setSearch]=useState("");
  const [loading,setLoading]=useState(true);
  const [busy,setBusy]=useState(false);
  const [error,setError]=useState("");
  const [notice,setNotice]=useState("");

  const load=useCallback(async()=>{
    setLoading(true);setError("");
    const result=await listDeveloperFeedback();
    if(result.error){setError("Could not load feedback for your tests: "+result.error.message);setRows([]);}
    else{
      const next=(result.data??[]) as DeveloperFeedbackRecord[];
      setRows(next);
      setSelectedId(current=>current&&next.some(row=>row.feedback_id===current)?current:(next[0]?.feedback_id??""));
    }
    setLoading(false);
  },[]);

  useEffect(()=>{
    if(identityLoading)return;
    if(!session){setLoading(false);return;}
    if(!isTesterWorkflowV2Enabled){setLoading(false);return;}
    if(roles.includes("developer"))void load();
    else setLoading(false);
  },[identityLoading,session,roles,load]);

  const selected=rows.find(row=>row.feedback_id===selectedId)??null;
  useEffect(()=>{
    if(!selected){setMessages([]);return;}
    setStatus(selected.review_status);
    setPriority(selected.priority);
    setResolutionNote(selected.resolution_note??"");
    let alive=true;
    void listDeveloperFeedbackMessages(selected.feedback_id).then(result=>{
      if(!alive)return;
      if(result.error){setError("Could not load the feedback conversation.");setMessages([]);}
      else setMessages((result.data??[]) as DeveloperFeedbackMessage[]);
    });
    return()=>{alive=false;};
  },[selectedId,selected?.feedback_id]);

  const visible=rows.filter(row=>{
    const matchesStatus=filter==="all"||row.review_status===filter;
    const matchesSearch=(row.test_title+" "+row.app_name+" "+row.body+" "+row.category).toLowerCase().includes(search.toLowerCase());
    return matchesStatus&&matchesSearch;
  });

  async function saveReview(){
    if(!selected)return;
    if((status==="resolved"||status==="wont_fix")&&resolutionNote.trim().length<5){
      setError("Add a resolution note of at least 5 characters before closing this feedback.");return;
    }
    setBusy(true);setError("");setNotice("");
    const result=await updateDeveloperFeedbackReview({
      feedbackId:selected.feedback_id,status,priority,
      resolutionNote:resolutionNote.trim()||null
    });
    if(result.error)setError("Could not save the review: "+result.error.message);
    else{setNotice("Review status saved.");await load();}
    setBusy(false);
  }

  async function sendMessage(){
    if(!selected||!messageDraft.trim())return;
    setBusy(true);setError("");setNotice("");
    const result=await sendDeveloperFeedbackMessage(selected.feedback_id,messageDraft.trim());
    if(result.error)setError("Could not send the message: "+result.error.message);
    else{
      setMessageDraft("");
      const refreshed=await listDeveloperFeedbackMessages(selected.feedback_id);
      if(!refreshed.error)setMessages((refreshed.data??[]) as DeveloperFeedbackMessage[]);
      setNotice("Private note added.");
    }
    setBusy(false);
  }

  if(!identityLoading&&!session)return <Navigate to="/auth" replace/>;
  if(!identityLoading&&session&&!roles.includes("developer"))return <Navigate to="/dashboard" replace/>;

  if(!isTesterWorkflowV2Enabled)return <main className="df-shell"><header className="df-header"><Brand/><Link to="/developer-dashboard">Developer Dashboard</Link></header><section className="df-empty"><h1>Developer feedback</h1><p>This workspace is not enabled in this environment yet.</p></section></main>;

  return <main className="df-shell">
    <header className="df-header"><Brand/><nav><Link to="/developer-dashboard">Dashboard</Link><Link to="/developer-tests">Manage tests</Link></nav></header>
    <section className="df-heading">
      <div><span className="df-eyebrow">DEVELOPER WORKSPACE</span><h1>Feedback inbox</h1><p>Review feedback submitted for tests you own, track priorities and reply without accessing tester identity details.</p></div>
      <button type="button" className="df-refresh" onClick={()=>void load()} disabled={loading||busy}>Refresh</button>
    </section>
    {error&&<div className="df-alert df-alert-error" role="alert">{error}</div>}
    {notice&&<div className="df-alert df-alert-success" role="status">{notice}</div>}
    <div className="df-layout">
      <section className="df-list-panel">
        <div className="df-list-toolbar"><input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search tests or feedback…" aria-label="Search feedback"/><select value={filter} onChange={e=>setFilter(e.target.value as typeof filter)} aria-label="Filter by status"><option value="all">All statuses</option>{Object.entries(statusLabels).map(([value,label])=><option key={value} value={value}>{label}</option>)}</select></div>
        <div className="df-list-meta"><strong>{visible.length}</strong> feedback entries <span>·</span> Only tests you own</div>
        {loading?<div className="df-empty-small">Loading feedback…</div>:visible.length===0?<div className="df-empty-small">No feedback matches this view.</div>:<div className="df-feedback-list">{visible.map(row=><button type="button" key={row.feedback_id} className={"df-feedback-item"+(row.feedback_id===selectedId?" selected":"")} onClick={()=>setSelectedId(row.feedback_id)}>
          <div className="df-item-top"><strong>{row.test_title}</strong><span className={"df-status df-status-"+row.review_status}>{statusLabels[row.review_status]}</span></div>
          <small>{row.app_name} · {categoryLabels[row.category]??row.category} · {dateLabel(row.submitted_at)}</small>
          <p>{row.body}</p>
          <div className="df-item-bottom"><span className={"df-priority df-priority-"+row.priority}>{priorityLabels[row.priority]} priority</span>{row.rating!==null&&<span>Rating {row.rating}/5</span>}</div>
        </button>)}</div>}
      </section>
      <section className="df-detail-panel">
        {!selected?<div className="df-empty"><h2>Select feedback</h2><p>Choose an entry to review its details.</p></div>:<>
          <div className="df-detail-heading"><div><span className="df-eyebrow">FEEDBACK DETAILS</span><h2>{selected.test_title}</h2><p>{selected.app_name} · {categoryLabels[selected.category]??selected.category}</p></div><span className={"df-status df-status-"+selected.review_status}>{statusLabels[selected.review_status]}</span></div>
          <article className="df-message-card"><div className="df-message-meta"><strong>Tester feedback</strong><span>{dateLabel(selected.submitted_at)}</span></div><p>{selected.body}</p>{selected.rating!==null&&<small>Submitted rating: {selected.rating}/5</small>}</article>
          <div className="df-review-form">
            <label>Review status<select value={status} onChange={e=>setStatus(e.target.value as DeveloperFeedbackStatus)}>{Object.entries(statusLabels).map(([value,label])=><option key={value} value={value}>{label}</option>)}</select></label>
            <label>Priority<select value={priority} onChange={e=>setPriority(e.target.value as DeveloperFeedbackPriority)}>{Object.entries(priorityLabels).map(([value,label])=><option key={value} value={value}>{label}</option>)}</select></label>
            <label className="df-wide">Resolution note<textarea rows={3} maxLength={2000} value={resolutionNote} onChange={e=>setResolutionNote(e.target.value)} placeholder="Record the action taken or why this will not be fixed…"/></label>
            <button type="button" onClick={()=>void saveReview()} disabled={busy}>Save review</button>
          </div>
          <section className="df-conversation"><div className="df-conversation-heading"><h3>Internal notes</h3><span>Only visible to your developer team</span></div>
            {messages.length===0?<p className="df-empty-small">No internal notes yet.</p>:messages.map((message,index)=><article className={"df-chat-message"+(message.sender_label==="You"?" own":"")} key={index}><div><strong>{message.sender_label}</strong><time>{dateLabel(message.created_at)}</time></div><p>{message.body}</p></article>)}
            <div className="df-reply"><textarea rows={2} maxLength={5000} value={messageDraft} onChange={e=>setMessageDraft(e.target.value)} placeholder="Add a private note…"/><button type="button" onClick={()=>void sendMessage()} disabled={busy||!messageDraft.trim()}>Add note</button></div>
          </section>
        </>}
      </section>
    </div>
  </main>;
}
