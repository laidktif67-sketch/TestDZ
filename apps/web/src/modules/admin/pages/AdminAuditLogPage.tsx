import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { listAdminAuditEvents, type AdminAuditEvent } from "../../../features/admin/admin-api";
import { isTesterWorkflowV2Enabled } from "../../../lib/supabase-v2";
import { useIdentity } from "../../../shared/auth/hooks/useIdentity";
import TesterSidebar from "../../tester/components/TesterSidebar";
import "./admin-audit-log.css";

const shortId = (value: string | null) => value ? value.slice(0, 8).toUpperCase() : "—";
const dateTime = (value: string) => { const date = new Date(value); return Number.isNaN(date.getTime()) ? "—" : date.toLocaleString(); };

export default function AdminAuditLogPage() {
  const { roles = [] } = useIdentity();
  const [events, setEvents] = useState<AdminAuditEvent[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [workspaceMenuOpen, setWorkspaceMenuOpen] = useState(false);
  const isAdmin = roles.includes("admin");
  const isDeveloper = roles.includes("developer");

  const load = useCallback(async () => {
    if (!isTesterWorkflowV2Enabled) { setLoading(false); return; }
    setLoading(true); setError("");
    try {
      const result = await listAdminAuditEvents();
      if (result.error) throw result.error;
      setEvents((result.data ?? []) as AdminAuditEvent[]);
    } catch {
      setEvents([]);
      setError("Audit history could not be loaded. Confirm V2 is enabled and your Admin access is valid, then retry.");
    } finally { setLoading(false); }
  }, []);
  useEffect(() => { void load(); }, [load]);

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return events;
    return events.filter(event => [event.action, event.target_type, event.target_id, event.actor_id, event.reason].filter(Boolean).join(" ").toLowerCase().includes(term));
  }, [events, search]);

  const nav = [
    { label: "Admin", icon: "shield", href: "/admin" },
    { label: "User Directory", icon: "users", href: "/admin/users" },
    { label: "Role Requests", icon: "users", href: "/admin/role-requests" },
    { label: "Audit Log", icon: "file-text", href: "/admin/audit-log", active: true },
    { label: "Financial Operations", icon: "wallet", href: "/financial-operations" },
    { label: "Profile", icon: "user", href: "/profile" },
  ];
  if (!isTesterWorkflowV2Enabled) return <main className="admin-audit-log"><h1>Admin audit log</h1><p>V2 is not enabled in this environment. No V2 audit records were loaded.</p></main>;

  return <div className="td-dashboard aal-shell">
    <TesterSidebar nav={nav} name="TestDZ Admin" firstName="A" avatar="" roles={roles} isAdmin={isAdmin} isDeveloper={isDeveloper} workspaceMenuOpen={workspaceMenuOpen} setWorkspaceMenuOpen={setWorkspaceMenuOpen} previewMode={false} />
    <main className="aal-main">
      <header className="aal-header"><div><span className="aal-eyebrow">GOVERNANCE · IMMUTABLE HISTORY</span><h1>Admin audit log</h1><p>Review recent privileged actions and their recorded reasons.</p></div><div className="aal-actions"><Link to="/admin">Admin workspace</Link><button type="button" onClick={() => void load()} disabled={loading}>↻ Refresh</button></div></header>
      {error && <p className="aal-error" role="alert">{error}</p>}
      <section className="aal-panel">
        <div className="aal-toolbar"><div><strong>{events.length}</strong><span> recent audit events</span></div><input value={search} onChange={event => setSearch(event.target.value)} aria-label="Search audit events" placeholder="Search action, actor, target or reason…" /></div>
        {loading ? <div className="aal-empty" aria-live="polite">Loading audit history…</div> : <div className="aal-table-wrap"><table><thead><tr><th>Time</th><th>Action</th><th>Target</th><th>Target ID</th><th>Actor ID</th><th>Reason</th></tr></thead><tbody>
          {filtered.map(event => <tr key={event.id}><td>{dateTime(event.created_at)}</td><td><span className="aal-action">{event.action}</span></td><td>{event.target_type}</td><td><code>{shortId(event.target_id)}</code></td><td><code>{shortId(event.actor_id)}</code></td><td className="aal-reason">{event.reason || "—"}</td></tr>)}
          {!filtered.length && <tr><td colSpan={6} className="aal-empty">No audit events match this search.</td></tr>}
        </tbody></table></div>}
        <footer className="aal-footer">Showing up to 100 most recent records. This screen is read-only; audit history cannot be edited or deleted here.</footer>
      </section>
      <p className="aal-safety"><strong>Audit integrity:</strong> Access is restricted by the database Admin-only policy. Event metadata is intentionally omitted from this screen to avoid exposing unnecessary operational payloads.</p>
    </main>
  </div>;
}
