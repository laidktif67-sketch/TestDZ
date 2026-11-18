import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import {
  getSupportTicketDetails,
  sendSupportStaffReply,
  updateSupportTicket,
  type SupportTicketDetail,
  type SupportTicketEvent,
  type SupportTicketMessage,
} from "../../../features/support/support-api";
import { isTesterWorkflowV2Enabled } from "../../../lib/supabase-v2";
import { useIdentity } from "../../../shared/auth/hooks/useIdentity";
import TesterSidebar from "../../tester/components/TesterSidebar";
import "./support-ticket-detail.css";

const label = (value: string) => value.replaceAll("_", " ");
const dateTime = (value: string) => {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "—" : date.toLocaleString();
};
const shortId = (value: string | null | undefined) => value ? value.slice(0, 8).toUpperCase() : "—";

export default function SupportTicketDetailPage() {
  const { id = "" } = useParams();
  const { user, roles = [] } = useIdentity();
  const [ticket, setTicket] = useState<SupportTicketDetail | null>(null);
  const [messages, setMessages] = useState<SupportTicketMessage[]>([]);
  const [events, setEvents] = useState<SupportTicketEvent[]>([]);
  const [status, setStatus] = useState<SupportTicketDetail["status"]>("open");
  const [priority, setPriority] = useState<SupportTicketDetail["priority"]>("normal");
  const [reason, setReason] = useState("");
  const [reply, setReply] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [menuOpen, setMenuOpen] = useState(false);
  const isAdmin = roles.includes("admin");
  const isDeveloper = roles.includes("developer");
  const name = user?.user_metadata?.display_name || user?.email?.split("@")[0] || "Support";
  const firstName = name.split(/[\s._-]+/)[0] || "Support";

  const load = useCallback(async () => {
    if (!id || !isTesterWorkflowV2Enabled) { setLoading(false); return; }
    setLoading(true); setError("");
    try {
      const result = await getSupportTicketDetails(id);
      if (result.ticketResult.error) throw result.ticketResult.error;
      if (!result.ticketResult.data) throw new Error("Ticket not found or access denied.");
      if (result.messageResult?.error) throw result.messageResult.error;
      if (result.eventResult?.error) throw result.eventResult.error;
      const nextTicket = result.ticketResult.data as SupportTicketDetail;
      setTicket(nextTicket);
      setStatus(nextTicket.status);
      setPriority(nextTicket.priority);
      setMessages((result.messageResult?.data ?? []) as SupportTicketMessage[]);
      setEvents((result.eventResult?.data ?? []) as SupportTicketEvent[]);
    } catch {
      setTicket(null); setMessages([]); setEvents([]);
      setError("Ticket details could not be loaded. Confirm your Support access and retry.");
    } finally { setLoading(false); }
  }, [id]);
  useEffect(() => { void load(); }, [load]);

  const nav = useMemo(() => [
    { label: "Support Queue", icon: "headset", href: "/support-workspace" },
    ...(isAdmin ? [{ label: "Admin Workspace", icon: "shield", href: "/admin" }] : []),
    { label: "Support Center", icon: "life-buoy", href: "/support" },
    { label: "Profile", icon: "user", href: "/profile" },
    { label: "Settings", icon: "settings", href: "/settings" },
  ], [isAdmin]);

  const isClosed = ticket?.status === "closed";
  const statusLocked = !!ticket && (ticket.status === "closed" || ticket.status === "resolved") && !isAdmin;
  const canEdit = !!ticket && (!isClosed || isAdmin);
  const canSave = !!ticket && canEdit && !saving &&
    (status !== ticket.status || priority !== ticket.priority) &&
    reason.trim().length >= 10 && reason.trim().length <= 1000;

  async function saveChanges() {
    if (!ticket || !canSave) return;
    setSaving(true); setError(""); setNotice("");
    try {
      const result = await updateSupportTicket({
        ticketId: ticket.id,
        status: status === ticket.status ? null : status,
        priority: priority === ticket.priority ? null : priority,
        reason: reason.trim(),
      });
      if (result.error) throw result.error;
      setReason("");
      setNotice("Ticket updated. The change was added to the immutable audit history.");
      await load();
    } catch {
      setError("The ticket could not be updated. The database rejected the action or your permissions changed.");
    } finally { setSaving(false); }
  }

  async function sendReply() {
    if (!ticket || !reply.trim() || reply.trim().length > 5000 || isClosed || sending) return;
    setSending(true); setError(""); setNotice("");
    try {
      const result = await sendSupportStaffReply(ticket.id, reply.trim());
      if (result.error) throw result.error;
      setReply("");
      setNotice("Reply sent and recorded in the ticket event history.");
      await load();
    } catch {
      setError("The reply could not be sent. The ticket may be closed or your access may have changed.");
    } finally { setSending(false); }
  }

  if (!isTesterWorkflowV2Enabled) return <main className="std-page"><h1>Support ticket</h1><p>V2 is not enabled in this environment. No V2 support records were loaded.</p></main>;

  return <div className="td-dashboard sq-shell">
    <TesterSidebar nav={nav} name={name} firstName={firstName} avatar="" roles={roles} isAdmin={isAdmin} isDeveloper={isDeveloper} workspaceMenuOpen={menuOpen} setWorkspaceMenuOpen={setMenuOpen} previewMode={false} />
    <main className="std-main">
      <div className="std-back"><Link to="/support-workspace">← Back to support queue</Link></div>
      {loading ? <section className="std-panel std-empty" aria-live="polite">Loading ticket details…</section> : !ticket ? <section className="std-panel"><h1>Ticket unavailable</h1><p>{error || "This ticket could not be found."}</p></section> : <>
        <header className="std-header">
          <div><span className="sq-eyebrow">SUPPORT WORKSPACE · TICKET #{ticket.ticket_number}</span><h1>{ticket.subject}</h1><p>{label(ticket.category)} · {ticket.requester_role} · Account {shortId(ticket.user_id)}</p></div>
          <div className="std-header-actions"><span className={"sq-status " + ticket.status}>{label(ticket.status)}</span><span className={"sq-priority " + ticket.priority}>{label(ticket.priority)} priority</span></div>
        </header>
        {error && <p className="std-alert error" role="alert">{error}</p>}
        {notice && <p className="std-alert success" role="status">{notice}</p>}
        <div className="std-grid">
          <section className="std-panel">
            <div className="std-section-heading"><h2>Request details</h2><span>Submitted {dateTime(ticket.created_at)}</span></div>
            <p className="std-description">{ticket.description}</p>
            <div className="std-meta"><span>Last updated</span><strong>{dateTime(ticket.updated_at)}</strong><span>Assigned to</span><strong>{shortId(ticket.assigned_to)}</strong>{ticket.resolved_at && <><span>Resolved</span><strong>{dateTime(ticket.resolved_at)} · {shortId(ticket.resolved_by)}</strong></>}</div>
          </section>
          <section className="std-panel">
            <div className="std-section-heading"><h2>Ticket controls</h2><span>Every change is audited</span></div>
            <label className="std-field">Status
              <select value={status} onChange={event => setStatus(event.target.value as SupportTicketDetail["status"])} disabled={!canEdit || statusLocked}>
                <option value="open">Open</option><option value="in_progress">In progress</option><option value="waiting_for_user">Waiting for user</option><option value="resolved">Resolved</option><option value="closed">Closed</option>
              </select>
            </label>
            <label className="std-field">Priority
              <select value={priority} onChange={event => setPriority(event.target.value as SupportTicketDetail["priority"])} disabled={!canEdit}>
                <option value="normal">Normal</option><option value="high">High</option><option value="urgent">Urgent</option>
              </select>
            </label>
            <label className="std-field">Reason for change <span>(10–1000 characters)</span>
              <textarea value={reason} onChange={event => setReason(event.target.value)} maxLength={1000} rows={3} placeholder="Explain why this status or priority change is necessary…" disabled={!canEdit} />
            </label>
            <div className="std-action-row"><span>{reason.trim().length}/1000</span><button type="button" onClick={() => void saveChanges()} disabled={!canSave}>{saving ? "Saving…" : "Save audited changes"}</button></div>
            {statusLocked && <p className="std-hint">Resolved and closed tickets can only be reopened by an Admin.</p>}
            {isClosed && !isAdmin && <p className="std-hint">Closed tickets are read-only for Support.</p>}
          </section>
        </div>
        <section className="std-panel std-conversation">
          <div className="std-section-heading"><h2>Public conversation</h2><span>{messages.length} messages · internal notes excluded</span></div>
          {messages.length ? <div className="std-messages">{messages.map(message => <article className={"std-message " + (message.sender_id === ticket.user_id ? "customer" : "staff")} key={message.id}>
            <div><strong>{message.sender_id === ticket.user_id ? "Requester" : "Support"}</strong><span>{shortId(message.sender_id)} · {dateTime(message.created_at)}</span></div>
            <p>{message.body}</p>
          </article>)}</div> : <p className="std-hint">No public replies yet.</p>}
          <label className="std-field">Send a public reply
            <textarea value={reply} onChange={event => setReply(event.target.value)} maxLength={5000} rows={4} placeholder="Write a clear response to the requester…" disabled={isClosed || sending} />
          </label>
          <div className="std-action-row"><span>{reply.trim().length}/5000 · Replies are visible to the requester</span><button type="button" onClick={() => void sendReply()} disabled={!reply.trim() || reply.trim().length > 5000 || isClosed || sending}>{sending ? "Sending…" : "Send reply"}</button></div>
          {isClosed && <p className="std-hint">This ticket is closed. An Admin must reopen it before a reply can be sent.</p>}
        </section>
        <section className="std-panel">
          <div className="std-section-heading"><h2>Immutable ticket history</h2><span>{events.length} events</span></div>
          {events.length ? <ol className="std-events">{events.map(event => <li key={event.id}>
            <span className="std-event-dot" />
            <div><strong>{label(event.event_type)}</strong><p>{event.event_type === "status_changed" ? label(event.old_status || "") + " → " + label(event.new_status || "") : event.event_type === "priority_changed" ? label(event.old_priority || "") + " → " + label(event.new_priority || "") : event.event_type === "message_sent" ? "Public message recorded" : "Ticket created"}</p><small>{shortId(event.actor_id)} · {dateTime(event.created_at)}</small></div>
          </li>)}</ol> : <p className="std-hint">No history events are available.</p>}
        </section>
        <p className="std-privacy"><strong>Privacy boundary:</strong> This view loads public conversation messages only. Internal notes and attachment contents are not requested. Message bodies are never copied into audit metadata.</p>
      </>}
    </main>
  </div>;
}
