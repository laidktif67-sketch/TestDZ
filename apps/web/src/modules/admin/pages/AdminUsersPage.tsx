import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { listAdminUsers, type AdminUserRecord } from "../../../features/admin/admin-api";
import { isTesterWorkflowV2Enabled } from "../../../lib/supabase-v2";
import { useIdentity } from "../../../shared/auth/hooks/useIdentity";
import TesterSidebar from "../../tester/components/TesterSidebar";
import "./admin-users.css";

type RoleFilter = "all" | "tester" | "developer" | "financial" | "support" | "admin";
const shortId = (value: string) => value.slice(0, 8).toUpperCase();
const dateTime = (value: string) => { const date = new Date(value); return Number.isNaN(date.getTime()) ? "—" : date.toLocaleDateString(); };
const rolesOf = (user: AdminUserRecord) => (user.user_roles ?? []).map(item => item.role);

export default function AdminUsersPage() {
  const { roles = [] } = useIdentity();
  const [users, setUsers] = useState<AdminUserRecord[]>([]);
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState<RoleFilter>("all");
  const [statusFilter, setStatusFilter] = useState<"all" | "active" | "banned">("all");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [workspaceMenuOpen, setWorkspaceMenuOpen] = useState(false);
  const isAdmin = roles.includes("admin");
  const isDeveloper = roles.includes("developer");

  const load = useCallback(async () => {
    if (!isTesterWorkflowV2Enabled) { setLoading(false); return; }
    setLoading(true);
    setError("");
    try {
      const result = await listAdminUsers();
      if (result.error) throw result.error;
      setUsers((result.data ?? []) as AdminUserRecord[]);
    } catch {
      setError("User records could not be loaded. Check the V2 environment and your Admin access, then retry.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const filtered = useMemo(() => users.filter(user => {
    const roles = rolesOf(user);
    const text = [user.display_name, user.id, user.locale, ...roles].join(" ").toLowerCase();
    return text.includes(search.trim().toLowerCase())
      && (roleFilter === "all" || roles.includes(roleFilter))
      && (statusFilter === "all" || (statusFilter === "banned" ? user.is_banned : !user.is_banned));
  }), [users, search, roleFilter, statusFilter]);

  const counts = useMemo(() => ({
    total: users.length,
    admins: users.filter(user => rolesOf(user).includes("admin")).length,
    financial: users.filter(user => rolesOf(user).includes("financial")).length,
    banned: users.filter(user => user.is_banned).length,
  }), [users]);

  const nav = [
    { label: "Admin", icon: "shield", href: "/admin", active: false },
    { label: "User Directory", icon: "users", href: "/admin/users", active: true },
    { label: "Role Requests", icon: "users", href: "/admin/role-requests" },
    { label: "Financial Operations", icon: "wallet", href: "/financial-operations" },
    { label: "Profile", icon: "user", href: "/profile" },
  ];

  if (!isTesterWorkflowV2Enabled) return <main className="admin-users"><h1>User directory</h1><p>V2 is not enabled in this environment. No V2 user records were loaded.</p></main>;

  return <div className="td-dashboard au-shell">
    <TesterSidebar nav={nav} name="TestDZ Admin" firstName="A" avatar="" roles={roles} isAdmin={isAdmin} isDeveloper={isDeveloper} workspaceMenuOpen={workspaceMenuOpen} setWorkspaceMenuOpen={setWorkspaceMenuOpen} previewMode={false} />
    <main className="au-main">
      <header className="au-header"><div><span className="au-eyebrow">ADMINISTRATION · READ ONLY</span><h1>User directory</h1><p>Review account profiles, assigned workspace roles and account status.</p></div><div className="au-actions"><Link to="/admin">Admin workspace</Link><button type="button" onClick={() => void load()} disabled={loading}>↻ Refresh</button></div></header>
      {error && <p className="au-error" role="alert">{error}</p>}
      <section className="au-stats" aria-label="User summary">
        <article><span>Accounts loaded</span><strong>{counts.total}</strong><small>Latest 100 profiles</small></article>
        <article><span>Admin accounts</span><strong>{counts.admins}</strong><small>Privileged workspace</small></article>
        <article><span>Financial accounts</span><strong>{counts.financial}</strong><small>Financial read access</small></article>
        <article><span>Banned accounts</span><strong>{counts.banned}</strong><small>Flagged by account status</small></article>
      </section>
      <section className="au-panel">
        <div className="au-toolbar">
          <input value={search} onChange={event => setSearch(event.target.value)} aria-label="Search users" placeholder="Search name, account ID, locale or role…" />
          <select aria-label="Filter by role" value={roleFilter} onChange={event => setRoleFilter(event.target.value as RoleFilter)}>
            <option value="all">All roles</option><option value="tester">Tester</option><option value="developer">Developer</option><option value="financial">Financial</option><option value="support">Support</option><option value="admin">Admin</option>
          </select>
          <select aria-label="Filter by account status" value={statusFilter} onChange={event => setStatusFilter(event.target.value as "all" | "active" | "banned")}>
            <option value="all">All statuses</option><option value="active">Not banned</option><option value="banned">Banned</option>
          </select>
        </div>
        {loading ? <div className="au-empty">Loading accounts…</div> : <div className="au-table-wrap"><table><thead><tr><th>Account</th><th>Account ID</th><th>Workspace roles</th><th>Locale</th><th>Joined</th><th>Verification</th><th>Status</th></tr></thead><tbody>
          {filtered.map(user => <tr key={user.id}><td><strong>{user.display_name || "Unnamed account"}</strong></td><td><code>{shortId(user.id)}</code></td><td><div className="au-roles">{rolesOf(user).length ? rolesOf(user).map(role => <span key={role} className={"au-role " + role}>{role}</span>) : <span className="au-muted">No role</span>}</div></td><td>{user.locale || "—"}</td><td>{dateTime(user.created_at)}</td><td><span className={"au-flag " + (user.is_verified ? "verified" : "unverified")}>{user.is_verified ? "Verified" : "Not verified"}</span></td><td><span className={"au-flag " + (user.is_banned ? "banned" : "active")}>{user.is_banned ? "Banned" : "Active"}</span></td></tr>)}
          {!filtered.length && <tr><td colSpan={7} className="au-empty">No accounts match these filters.</td></tr>}
        </tbody></table></div>}
        <footer className="au-footer">Showing up to 100 most recently created profiles. Email addresses, phone numbers and private profile content are intentionally excluded. No account, role or status changes can be made here.</footer>
      </section>
      <p className="au-safety"><strong>Access control:</strong> This page is Admin-only and relies on database RLS for both profiles and user roles. Role assignment, banning and verification changes remain unavailable until dedicated audited backend actions and authorization tests are implemented.</p>
    </main>
  </div>;
}
