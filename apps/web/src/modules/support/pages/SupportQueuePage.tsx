import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { listSupportQueueTickets, type SupportQueueTicket } from "../../../features/support/support-api";
import { isTesterWorkflowV2Enabled } from "../../../lib/supabase-v2";
import { useIdentity } from "../../../shared/auth/hooks/useIdentity";
import TesterSidebar from "../../tester/components/TesterSidebar";
import "./support-queue.css";

type Filter = "all" | "open" | "in_progress" | "waiting_for_user" | "resolved" | "closed";
const label = (value: string) => value.replaceAll("_", " ");
const dateTime = (value: string) => { const date = new Date(value); return Number.isNaN(date.getTime()) ? "—" : date.toLocaleString(); };
const shortId = (value: string) => value.slice(0, 8).toUpperCase();

export default function SupportQueuePage() {
  const { user, roles = [] } = useIdentity();
  const [rows, setRows] = useState<SupportQueueTicket[]>([]);
  const [filter, setFilter] = useState<Filter>("all");
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [menuOpen, setMenuOpen] = useState(false);
  const isAdmin = roles.includes("admin");
  const isDeveloper = roles.includes("developer");
  const name = user?.user_metadata?.display_name || user?.email?.split("@")[0] || "Support";
  const firstName = name.split(/[\s._-]+/)[0] || "Support";

  const load = useCallback(async () => {
    if (!isTesterWorkflowV2Enabled) { setLoading(false); return; }
    setLoading(true); setError("");
    try {
      const result = await listSupportQueueTickets();
      if (result.error) throw result.error;
      setRows((result.data ?? []) as SupportQueueTicket[]);
    } catch {
      setRows([]);
      setError("The support queue could not be loaded. Confirm V2 is enabled and your Support access is valid, then retry.");
    } finally { setLoading(false); }
  }, []);
  useEffect(() => { void load(); }, [load]);

  const counts = useMemo(() => ({
    open: rows.filter(row => row.status === "open").length,
    active: rows.filter(row => row.status === "in_progress" || row.status === "waiting_for_user").length,
    urgent: rows.filter(row => row.priority === "urgent" && !["resolved", "closed"].includes(row.status)).length,
    closed: rows.filter(row => row.status === "resolved" || row.status === "closed").length,
  }), [rows]);
  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    return rows.filter(row => (filter === "all" || row.status === filter) &&
      (!term || [row.ticket_number, row.user_id, row.subject, row.category, row.priority, row.status, row.requester_role].join(" ").toLowerCase().includes(term)));
  }, [rows, filter, search]);

  const nav = [
    { label: "Support Queue", icon: "headset", href: "/support-workspace", active: true },
    ...(isAdmin ? [{ label: "Admin Workspace", icon: "shield", href: "/admin" }] : []),
    { label: "Support Center", icon: "life-buoy", href: "/support" },
    { label: "Profile", icon: "user", href: "/profile" },
    { label: "Settings", icon: "settings", href: "/settings" },
  ];

  if (!isTesterWorkflowV2Enabled) return <main className="support-queue"><h1>Support queue</h1><p>V2 is not enabled in this environment. No V2 support records were loaded.</p></main>;

  return <div className="td-dashboard sq-shell">
    <TesterSidebar nav={nav} name={name} firstName={firstName} avatar="" roles={roles} isAdmin={isAdmin} isDeveloper={isDeveloper} workspaceMenuOpen={menuOpen} setWorkspaceMenuOpen={setMenuOpen} previewMode={false} />
    <main className="sq-main">
      <header className="sq-header"><div><span className="sq-eyebrow">CUSTOMER CARE · STAFF WORKSPACE</span><h1>Support queue</h1><p>Monitor incoming requests, open a ticket to review its public conversation and manage its status with an audited reason.</p></div><button type="button" onClick={() => void load()} disabled={loading}>↻ Refresh</button></header>
      {error && <p className="sq-error" role="alert">{error}</p>}
      <section className="sq-stats" aria-label="Support queue summary">
        <article><span>Open</span><strong>{counts.open}</strong></article>
        <article><span>In progress / waiting</span><strong>{counts.active}</strong></article>
        <article><span>Urgent · active</span><strong>{counts.urgent}</strong></article>
        <article><span>Resolved / closed</span><strong>{counts.closed}</strong></article>
      </section>
      <section className="sq-panel">
        <div className="sq-toolbar"><div className="sq-filters" role="group" aria-label="Filter support tickets">
          {(["all","open","in_progress","waiting_for_user","resolved","closed"] as Filter[]).map(value => <button key={value} type="button" className={filter === value ? "active" : ""} onClick={() => setFilter(value)}>{value === "all" ? "All" : label(value)}</button>)}
        </div><input value={search} onChange={event => setSearch(event.target.value)} aria-label="Search support tickets" placeholder="Search ticket, subject, account or category…" /></div>
        {loading ? <div className="sq-empty" aria-live="polite">Loading support tickets…</div> : <div className="sq-table-wrap"><table><thead><tr><th>Ticket</th><th>Subject</th><th>Requester</th><th>Category</th><th>Priority</th><th>Status</th><th>Updated</th></tr></thead><tbody>
          {filtered.map(row => <tr key={row.id}><td><code>#{row.ticket_number}</code></td><td><Link className="sq-ticket-link" to={"/support-workspace/" + row.id}><strong>{row.subject}</strong></Link></td><td><span>{row.requester_role}</span><br/><code>{shortId(row.user_id)}</code></td><td>{label(row.category)}</td><td><span className={"sq-priority " + row.priority}>{label(row.priority)}</span></td><td><span className={"sq-status " + row.status}>{label(row.status)}</span></td><td>{dateTime(row.updated_at)}</td></tr>)}
          {!filtered.length && <tr><td colSpan={7} className="sq-empty">No tickets match this filter.</td></tr>}
        </tbody></table></div>}
        <footer className="sq-footer">Showing up to 100 latest tickets. Open a ticket to send a public reply or make a reason-required, audited status/priority change.</footer>
      </section>
      <p className="sq-safety"><strong>Privacy boundary:</strong> This list requests ticket metadata only. Ticket details load public messages and event metadata on demand; internal notes and attachment contents remain excluded.</p>
      <p className="sq-link"><Link to="/support">Open the customer Support Center</Link></p>
    </main>
  </div>;
}
