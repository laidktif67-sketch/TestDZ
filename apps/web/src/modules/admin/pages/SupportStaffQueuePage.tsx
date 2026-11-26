import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, Navigate } from "react-router-dom";
import { getSupportStaffTickets } from "../../../features/support/support-api";
import { isTesterWorkflowV2Enabled } from "../../../lib/supabase-v2";
import { useIdentity } from "../../../shared/auth/hooks/useIdentity";
import TesterSidebar, { Icon } from "../../tester/components/TesterSidebar";
import "../../tester/styles/tester-dashboard.css";
import "./support-staff-queue.css";

type SupportTicket = {
  id: string;
  ticket_number: number;
  user_id: string;
  requester_role: "tester" | "developer";
  subject: string;
  category: string;
  priority: string;
  status: string;
  created_at: string;
  updated_at: string;
};

const statusLabels: Record<string, string> = {
  open: "Open",
  in_progress: "In progress",
  waiting_for_user: "Waiting for user",
  resolved: "Resolved",
  closed: "Closed",
};
const categoryLabels: Record<string, string> = {
  technical: "Technical",
  account: "Account",
  testing: "Tests & assignments",
  rewards: "Rewards & points",
  payments: "Payments & withdrawals",
  other: "Other",
};

export default function SupportStaffQueuePage() {
  const { user, roles = [] } = useIdentity();
  const isAdmin = roles.includes("admin");
  const isSupportStaff = isAdmin || roles.includes("support");
  const [menuOpen, setMenuOpen] = useState(false);
  const [tickets, setTickets] = useState<SupportTicket[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("active");

  const name = user?.user_metadata?.display_name || user?.email?.split("@")[0] || "Support";
  const firstName = name.split(/[\\s._-]+/)[0] || "Support";
  const nav = [
    { label: "Support Queue", icon: "headset", href: "/support/queue", active: true },
    { label: "Support Center", icon: "receipt", href: "/support" },
    ...(isAdmin ? [{ label: "Admin Workspace", icon: "shield", href: "/admin" }] : []),
  ];

  const load = useCallback(async () => {
    if (!isSupportStaff || !isTesterWorkflowV2Enabled) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setError("");
    try {
      const { data, error: queryError } = await getSupportStaffTickets();
      if (queryError) setError("The support queue could not be loaded. Verify the V2 schema and staff permissions.");
      else setTickets((data ?? []) as SupportTicket[]);
    } catch {
      setError("The support queue could not be loaded. Check your connection and retry.");
    } finally {
      setLoading(false);
    }
  }, [isSupportStaff]);

  useEffect(() => { void load(); }, [load]);

  const visibleTickets = useMemo(() => {
    const needle = search.trim().toLowerCase();
    return tickets.filter(ticket => {
      const matchesStatus = statusFilter === "all"
        || (statusFilter === "active" && ["open", "in_progress", "waiting_for_user"].includes(ticket.status))
        || ticket.status === statusFilter;
      const matchesSearch = !needle || [
        ticket.subject,
        ticket.category,
        ticket.requester_role,
        String(ticket.ticket_number),
        ticket.user_id,
      ].some(value => value.toLowerCase().includes(needle));
      return matchesStatus && matchesSearch;
    });
  }, [tickets, search, statusFilter]);

  if (!isSupportStaff) return <Navigate to="/support" replace />;

  return (
    <div className="td-dashboard ssq-dashboard">
      <TesterSidebar
        nav={nav}
        name={name}
        firstName={firstName}
        avatar=""
        roles={roles}
        isAdmin={isAdmin}
        isDeveloper={roles.includes("developer")}
        workspaceMenuOpen={menuOpen}
        setWorkspaceMenuOpen={setMenuOpen}
        previewMode={false}
      />
      <main className="td-main ssq-main">
        <header className="td-topbar ssq-topbar">
          <div className="ssq-top-title"><span>TESTDZ OPERATIONS</span><strong>Support workspace</strong></div>
          <div className="td-top-actions">
            <Link to="/notifications" className="td-notification" aria-label="Notifications"><Icon name="bell" size={21}/></Link>
            <span className="td-top-divider"/>
            <Link to="/profile" className="td-profile-short"><span>{firstName.slice(0, 2).toUpperCase()}</span><strong>{name}</strong><b>⌄</b></Link>
          </div>
        </header>
        <div className="ssq-content">
          <section className="ssq-heading">
            <div>
              <span className="ssq-eyebrow">SUPPORT OPERATIONS · V2</span>
              <h1>Support queue</h1>
              <p>Review customer requests and open a ticket to continue the conversation.</p>
            </div>
            <button type="button" onClick={() => void load()} disabled={loading}><Icon name="refresh" size={16}/> Refresh queue</button>
          </section>

          {!isTesterWorkflowV2Enabled ? (
            <div className="ssq-message" role="status">The V2 Support workspace is not enabled in this environment. No legacy ticket data is queried here.</div>
          ) : null}
          {error && <div className="ssq-error" role="alert">{error}</div>}

          <section className="ssq-metrics">
            <article><span>All loaded</span><strong>{tickets.length}</strong></article>
            <article><span>Active</span><strong>{tickets.filter(t => ["open", "in_progress", "waiting_for_user"].includes(t.status)).length}</strong></article>
            <article><span>Resolved / closed</span><strong>{tickets.filter(t => ["resolved", "closed"].includes(t.status)).length}</strong></article>
          </section>

          <section className="ssq-panel">
            <div className="ssq-filters">
              <label className="ssq-search"><Icon name="search" size={18}/><input value={search} onChange={event => setSearch(event.target.value)} placeholder="Search subject, ticket number or user ID" aria-label="Search support tickets"/></label>
              <select value={statusFilter} onChange={event => setStatusFilter(event.target.value)} aria-label="Filter tickets by status">
                <option value="active">Active tickets</option>
                <option value="open">Open</option>
                <option value="in_progress">In progress</option>
                <option value="waiting_for_user">Waiting for user</option>
                <option value="resolved">Resolved</option>
                <option value="closed">Closed</option>
                <option value="all">All statuses</option>
              </select>
            </div>
            {loading ? <div className="ssq-empty">Loading support tickets…</div>
              : !isTesterWorkflowV2Enabled ? null
              : visibleTickets.length === 0 ? <div className="ssq-empty"><Icon name="inbox" size={34}/><strong>No matching tickets</strong><span>Try another status filter or search term.</span></div>
              : <div className="ssq-table-wrap">
                  <table className="ssq-table">
                    <thead><tr><th>Ticket</th><th>Requester workspace</th><th>Subject</th><th>Category</th><th>Priority</th><th>Status</th><th>Last activity</th><th/></tr></thead>
                    <tbody>{visibleTickets.map(ticket => (
                      <tr key={ticket.id}>
                        <td><strong>#{ticket.ticket_number}</strong></td>
                        <td><span className={"ssq-role " + ticket.requester_role}>{ticket.requester_role}</span></td>
                        <td className="ssq-subject">{ticket.subject}</td>
                        <td>{categoryLabels[ticket.category] || ticket.category}</td>
                        <td><span className={"ssq-priority " + ticket.priority}>{ticket.priority}</span></td>
                        <td><span className={"ssq-status " + ticket.status}>{statusLabels[ticket.status] || ticket.status}</span></td>
                        <td>{new Date(ticket.updated_at).toLocaleString()}</td>
                        <td><Link to={"/support/" + ticket.id}>Open <Icon name="arrow" size={14}/></Link></td>
                      </tr>
                    ))}</tbody>
                  </table>
                </div>}
          </section>
          <p className="ssq-privacy">Ticket visibility and requester data are enforced by V2 Row Level Security. The queue intentionally does not load profiles, emails, assignments, check-ins or feedback.</p>
        </div>
      </main>
    </div>
  );
}
