import { useEffect, useRef, useState } from "react";
import type { FormEvent } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { getTesterSupportTickets, createTesterSupportTicket } from "../../../features/support/support-api";
import { useIdentity } from "../../../shared/auth/hooks/useIdentity";
import TesterSidebar, { Icon } from "../components/TesterSidebar";
import "../styles/tester-dashboard.css";
import "../styles/support-center.css";
import "../styles/support-ticket-details.css";

type Ticket = { id: string; ticket_number: number; requester_role?: "tester" | "developer"; subject: string; category: string; priority: string; status: string; created_at: string };
const categories = [{value:"technical",label:"Technical"},{value:"account",label:"Account"},{value:"testing",label:"Tests & Assignments"},{value:"rewards",label:"Rewards & Points"},{value:"payments",label:"Payments & Withdrawals"},{value:"other",label:"Other"}];
const statusLabel: Record<string,string> = {open:"Open",in_progress:"In Progress",waiting_for_user:"Waiting for You",resolved:"Resolved",closed:"Closed"};
export default function SupportCenterPage() {
  const { user, roles = [] } = useIdentity();
  const [searchParams] = useSearchParams();
  const [menuOpen,setMenuOpen]=useState(false),[tickets,setTickets]=useState<Ticket[]>([]),[loading,setLoading]=useState(true),[searchQuery,setSearchQuery]=useState("");
  const createButtonRef=useRef<HTMLButtonElement>(null),modalRef=useRef<HTMLElement>(null);
  const [subject,setSubject]=useState(""),[category,setCategory]=useState("technical"),[priority,setPriority]=useState("normal"),[description,setDescription]=useState("");
  const availableRequesterRoles = roles.filter((role): role is "tester" | "developer" => role === "tester" || role === "developer");
  const [requesterRole,setRequesterRole]=useState<"tester" | "developer">(()=>roles.includes("developer")&&!roles.includes("tester")?"developer":"tester");
  const effectiveRequesterRole = availableRequesterRoles.includes(requesterRole) ? requesterRole : availableRequesterRoles[0];
  useEffect(()=>{if(effectiveRequesterRole&&effectiveRequesterRole!==requesterRole)setRequesterRole(effectiveRequesterRole);},[effectiveRequesterRole,requesterRole]);
  const [showForm,setShowForm]=useState(false),[busy,setBusy]=useState(false),[notice,setNotice]=useState(""),[error,setError]=useState("");
  const name=user?.user_metadata?.display_name || user?.email?.split("@")[0] || "User";
  const firstName=name.split(/[\s._-]+/)[0] || "Tester",isAdmin=roles.includes("admin"),isDeveloper=roles.includes("developer");
  const nav=[{label:"Dashboard",icon:"home",href:"/tester-dashboard"},{label:"Discover Tests",icon:"search",href:"/discover-tests"},{label:"My Tests",icon:"tests",href:"/my-tests"},{label:"Feedback History",icon:"star",href:"/feedback-history"},{label:"Wallet & Rewards",icon:"wallet",href:"/wallet-rewards"},{label:"Profile",icon:"user",href:"/profile"},{label:"Help Center",icon:"book",href:"/help"},{label:"Support Center",icon:"headset",href:"/support",active:true},{label:"Settings",icon:"settings",href:"/settings"},...(isDeveloper?[{label:"Developer Dashboard",icon:"code",href:"/developer-dashboard"}]:[]),...(roles.includes("support")||isAdmin?[{label:"Support Queue",icon:"headset",href:"/support/queue"}]:[]),...(isAdmin?[{label:"Admin",icon:"shield",href:"/admin"}]:[])];
  async function loadTickets(){
    if(!user){setLoading(false);return;}
    setLoading(true);setError("");
    try {
      const {data,error}=await getTesterSupportTickets(user.id);
      if(error)setError("Could not load your support tickets. Please refresh.");
      else setTickets((data||[]) as Ticket[]);
    } catch {
      setError("Could not load your support tickets. Please refresh.");
    } finally {
      setLoading(false);
    }
  }
  useEffect(()=>{void loadTickets();},[user?.id]);
  useEffect(()=>{if(searchParams.get("new")==="1")setShowForm(true);},[searchParams]);
  useEffect(()=>{
    if(!showForm)return;
    const modal=modalRef.current;
    modal?.querySelector<HTMLInputElement>("input,select,textarea")?.focus();
    const getFocusable=()=>Array.from(modal?.querySelectorAll<HTMLElement>('button:not([disabled]),input:not([disabled]),select:not([disabled]),textarea:not([disabled]),a[href],[tabindex]:not([tabindex="-1"])')||[]).filter(element=>element.getClientRects().length>0);
    const handleKeyDown=(event:KeyboardEvent)=>{
      if(event.key==="Escape"){event.preventDefault();setShowForm(false);return;}
      if(event.key!=="Tab")return;
      const items=getFocusable();
      if(!items.length){event.preventDefault();return;}
      const first=items[0],last=items[items.length-1];
      if(event.shiftKey&&document.activeElement===first){event.preventDefault();last.focus();}
      else if(!event.shiftKey&&document.activeElement===last){event.preventDefault();first.focus();}
    };
    document.addEventListener("keydown",handleKeyDown);
    return ()=>{document.removeEventListener("keydown",handleKeyDown);createButtonRef.current?.focus();};
  },[showForm]);
  const normalizedSearch=searchQuery.trim().toLocaleLowerCase();
  const visibleTickets=tickets.filter(ticket=>!normalizedSearch||[String(ticket.ticket_number),ticket.subject,ticket.category,ticket.status,ticket.requester_role||"tester"].some(value=>value.toLocaleLowerCase().includes(normalizedSearch)));
  async function createTicket(event:FormEvent<HTMLFormElement>){
    event.preventDefault();
    if(!user)return;
    if(!effectiveRequesterRole){setError("A Tester or Developer workspace role is required to create a support ticket.");return;}
    setBusy(true);setError("");setNotice("");
    try {
      const result=await createTesterSupportTicket({userId:user.id,requesterRole:effectiveRequesterRole,subject:subject.trim(),category,priority,description:description.trim()});
      const created=Array.isArray(result.data)?result.data[0]:result.data;
      if(result.error||!created){setError("Your ticket could not be created. Please check the details and try again.");return;}
      setTickets(current=>[created as Ticket,...current]);
      setSubject("");setDescription("");setPriority("normal");setCategory("technical");setShowForm(false);
      setNotice("Your support ticket was created successfully.");
    } catch {
      setError("Your ticket could not be created because the request failed. Please try again.");
    } finally {
      setBusy(false);
    }
  }
  return <div className="td-dashboard sc-dashboard"><TesterSidebar nav={nav} name={name} firstName={firstName} avatar="" roles={roles} isAdmin={isAdmin} isDeveloper={isDeveloper} workspaceMenuOpen={menuOpen} setWorkspaceMenuOpen={setMenuOpen} previewMode={false}/><main className="td-main sc-main"><header className="td-topbar sc-topbar"><label className="td-search sc-search"><Icon name="search" size={20}/><input type="search" placeholder="Search support tickets…" aria-label="Search support tickets" value={searchQuery} onChange={event=>setSearchQuery(event.target.value)}/></label><div className="td-top-actions"><Link to="/notifications" className="td-notification" aria-label="Notifications"><Icon name="bell" size={21}/></Link><span className="td-top-divider"/><Link to="/profile" className="td-profile-short"><span>{firstName.slice(0,2).toUpperCase()}</span><strong>{name}</strong><b>⌄</b></Link></div></header>
  <div className="sc-content"><Link to="/help" className="sc-back">← Back to Help Center</Link>
  <section className="sc-hero"><div><span className="sc-eyebrow">TESTDZ SUPPORT</span><h1>We’re here to help.</h1><p>{isDeveloper&&!roles.includes("tester")?"Get help with your developer workspace, apps, and tests.":"Create a support ticket and track every update in one place."}</p><button ref={createButtonRef} type="button" onClick={()=>setShowForm(true)} ><Icon name="send" size={18}/> Create a Support Ticket</button></div><div className="sc-hero-art"><Icon name="headset" size={92}/><span>?</span></div></section>
  {notice&&<p className="sc-notice" role="status">{notice}</p>}{error&&<p className="sc-error" role="alert">{error}</p>}
  <div className="sc-summary"><article><span><Icon name="receipt" size={23}/></span><div><strong>{tickets.length}</strong><small>Total Tickets</small></div></article><article><span className="green"><Icon name="clock" size={23}/></span><div><strong>{tickets.filter(t=>t.status==="open"||t.status==="in_progress"||t.status==="waiting_for_user").length}</strong><small>Active Requests</small></div></article><article><span className="purple"><Icon name="check" size={23}/></span><div><strong>{tickets.filter(t=>t.status==="resolved"||t.status==="closed").length}</strong><small>Resolved</small></div></article></div>
  <section className="sc-panel"><div className="sc-panel-head"><div><h2><Icon name="receipt" size={22}/> Your Support Tickets</h2><p>Review requests raised from your Tester or Developer workspace.</p></div><button type="button" onClick={()=>void loadTickets()}><Icon name="refresh" size={16}/> Refresh</button></div>
  {loading?<div className="sc-empty" role="status">Loading your tickets…</div>:visibleTickets.length?<div className="sc-table-wrap"><table className="sc-table"><thead><tr><th>Ticket</th><th>Workspace</th><th>Subject</th><th>Category</th><th>Status</th><th>Date</th></tr></thead><tbody>{visibleTickets.map(ticket=><tr key={ticket.id}><td data-label="Ticket">#{ticket.ticket_number}</td><td data-label="Workspace">{ticket.requester_role==="developer"?"Developer":"Tester"}</td><td data-label="Subject"><Link className="sc-ticket-link" to={`/support/${ticket.id}`}>{ticket.subject} <Icon name="arrow" size={13}/></Link></td><td data-label="Category">{categories.find(c=>c.value===ticket.category)?.label||ticket.category}</td><td data-label="Status"><span className={"sc-status "+ticket.status}>{statusLabel[ticket.status]||ticket.status}</span></td><td data-label="Date">{new Date(ticket.created_at).toLocaleDateString()}</td></tr>)}</tbody></table></div>:<div className="sc-empty"><span><Icon name="message" size={30}/></span><strong>{tickets.length?"No matching tickets":"No support tickets yet"}</strong><p>{tickets.length?"Try a different ticket number, subject, category, status, or workspace.":"If you need help with your account, app, test, or payment, create a ticket and our team can review it."}</p>{tickets.length?<button type="button" onClick={()=>setSearchQuery("")}>Clear search</button>:<button type="button" onClick={()=>setShowForm(true)}>Create your first ticket</button>}</div>}</section>
  <div className="sc-contact"><div><Icon name="book" size={26}/><div><strong>Need a quick answer first?</strong><p>Browse FAQs and helpful guides before creating a ticket.</p></div></div><Link to="/help">Open Help Center <Icon name="arrow" size={16}/></Link></div>
  {showForm&&<div className="sc-modal-backdrop" role="presentation" onMouseDown={e=>{if(e.target===e.currentTarget)setShowForm(false);}}><section ref={modalRef} className="sc-modal" role="dialog" aria-modal="true" aria-labelledby="sc-form-title" aria-describedby="sc-form-description" tabIndex={-1}><div className="sc-modal-head"><div><h2 id="sc-form-title">Create a Support Ticket</h2><p id="sc-form-description">Tell us what happened in your {effectiveRequesterRole==="developer"?"Developer":"Tester"} workspace. Please do not include passwords or verification codes.</p></div><button type="button" aria-label="Close" onClick={()=>setShowForm(false)}>×</button></div><form onSubmit={createTicket}>{availableRequesterRoles.length>1&&<label>Workspace<select value={requesterRole} onChange={e=>setRequesterRole(e.target.value as "tester" | "developer")}><option value="tester">Tester</option><option value="developer">Developer</option></select></label>}<label>Subject<input required minLength={5} maxLength={120} value={subject} onChange={e=>setSubject(e.target.value)} placeholder="Briefly describe your issue"/></label><div className="sc-form-grid"><label>Category<select value={category} onChange={e=>setCategory(e.target.value)}>{categories.map(c=><option key={c.value} value={c.value}>{c.label}</option>)}</select></label><label>Priority<select value={priority} onChange={e=>setPriority(e.target.value)}><option value="normal">Normal</option><option value="high">High</option><option value="urgent">Urgent</option></select></label></div><label>Details<textarea required minLength={10} maxLength={5000} rows={5} value={description} onChange={e=>setDescription(e.target.value)} placeholder="Explain the issue and what you expected to happen…"/></label><div className="sc-modal-actions"><button type="button" className="secondary" onClick={()=>setShowForm(false)}>Cancel</button><button type="submit" disabled={busy}>{busy?"Submitting…":"Submit Ticket"}</button></div></form></section></div>}
  </div></main></div>;
}
