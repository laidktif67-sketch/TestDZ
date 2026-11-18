import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { listAdminFraudReviews, type AdminFraudReview } from "../../../features/admin/admin-api";
import { isTesterWorkflowV2Enabled } from "../../../lib/supabase-v2";
import { useIdentity } from "../../../shared/auth/hooks/useIdentity";
import TesterSidebar from "../../tester/components/TesterSidebar";
import "./admin-fraud-reviews.css";

type Filter = "all" | "queued" | "in_review" | "resolved" | "dismissed";
const shortId = (value: string | null) => value ? value.slice(0, 8).toUpperCase() : "—";
const dateTime = (value: string | null) => { if (!value) return "—"; const date = new Date(value); return Number.isNaN(date.getTime()) ? "—" : date.toLocaleString(); };
const label = (value: string) => value.replaceAll("_", " ");

export default function AdminFraudReviewsPage() {
  const { roles = [] } = useIdentity();
  const [rows, setRows] = useState<AdminFraudReview[]>([]);
  const [filter, setFilter] = useState<Filter>("all");
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
      const result = await listAdminFraudReviews();
      if (result.error) throw result.error;
      setRows((result.data ?? []) as AdminFraudReview[]);
    } catch {
      setRows([]);
      setError("Risk review records could not be loaded. Confirm V2 is enabled and your Admin access is valid, then retry.");
    } finally { setLoading(false); }
  }, []);
  useEffect(() => { void load(); }, [load]);

  const counts = useMemo(() => ({
    queued: rows.filter(row => row.status === "queued").length,
    in_review: rows.filter(row => row.status === "in_review").length,
    high: rows.filter(row => row.priority === "high" && row.status !== "resolved" && row.status !== "dismissed").length,
    closed: rows.filter(row => row.status === "resolved" || row.status === "dismissed").length,
  }), [rows]);
  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    return rows.filter(row => (filter === "all" || row.status === filter) &&
      (!term || [row.user_id, row.reviewed_by, row.resolution, row.status, row.priority, String(row.score)].filter(Boolean).join(" ").toLowerCase().includes(term)));
  }, [rows, filter, search]);

  const nav = [
    { label: "Admin", icon: "shield", href: "/admin" },
    { label: "User Directory", icon: "users", href: "/admin/users" },
    { label: "Role Requests", icon: "users", href: "/admin/role-requests" },
    { label: "Review Queue", icon: "check", href: "/admin/developer-reviews" },
    { label: "Fraud Reviews", icon: "shield-alert", href: "/admin/fraud-reviews", active: true },
    { label: "Audit Log", icon: "file-text", href: "/admin/audit-log" },
    { label: "Financial Operations", icon: "wallet", href: "/financial-operations" },
    { label: "Profile", icon: "user", href: "/profile" },
  ];
  if (!isTesterWorkflowV2Enabled) return <main className="admin-fraud-reviews"><h1>Fraud review queue</h1><p>V2 is not enabled in this environment. No V2 risk records were loaded.</p></main>;

  return <div className="td-dashboard afr-shell">
    <TesterSidebar nav={nav} name="TestDZ Admin" firstName="A" avatar="" roles={roles} isAdmin={isAdmin} isDeveloper={isDeveloper} workspaceMenuOpen={workspaceMenuOpen} setWorkspaceMenuOpen={setWorkspaceMenuOpen} previewMode={false} />
    <main className="afr-main">
      <header className="afr-header"><div><span className="afr-eyebrow">TRUST & SAFETY · READ ONLY</span><h1>Fraud review queue</h1><p>Monitor risk-review records without changing account access or financial state.</p></div><button type="button" onClick={() => void load()} disabled={loading}>↻ Refresh</button></header>
      {error && <p className="afr-error" role="alert">{error}</p>}
      <section className="afr-stats" aria-label="Risk review summary">
        <article><span>Queued</span><strong>{counts.queued}</strong></article>
        <article><span>In review</span><strong>{counts.in_review}</strong></article>
        <article><span>High priority · open</span><strong>{counts.high}</strong></article>
        <article><span>Resolved / dismissed</span><strong>{counts.closed}</strong></article>
      </section>
      <section className="afr-panel">
        <div className="afr-toolbar"><div className="afr-filters" role="group" aria-label="Filter by review status">
          {(["all","queued","in_review","resolved","dismissed"] as Filter[]).map(value => <button key={value} type="button" className={filter === value ? "active" : ""} onClick={() => setFilter(value)}>{value === "all" ? "All" : label(value)}</button>)}
        </div><input value={search} onChange={event => setSearch(event.target.value)} aria-label="Search risk reviews" placeholder="Search account, reviewer, score or resolution…" /></div>
        {loading ? <div className="afr-empty" aria-live="polite">Loading risk reviews…</div> : <div className="afr-table-wrap"><table><thead><tr><th>Created</th><th>Account</th><th>Score</th><th>Priority</th><th>Status</th><th>Review due</th><th>Reviewer</th><th>Resolution</th></tr></thead><tbody>
          {filtered.map(row => <tr key={row.id}><td>{dateTime(row.created_at)}</td><td><code>{shortId(row.user_id)}</code></td><td><strong>{row.score}/100</strong></td><td><span className={"afr-priority " + row.priority}>{label(row.priority)}</span></td><td><span className={"afr-status " + row.status}>{label(row.status)}</span></td><td>{dateTime(row.review_due_at)}</td><td><code>{shortId(row.reviewed_by)}</code></td><td>{row.resolution || "—"}</td></tr>)}
          {!filtered.length && <tr><td colSpan={8} className="afr-empty">No risk reviews match this filter.</td></tr>}
        </tbody></table></div>}
        <footer className="afr-footer">Showing up to 100 latest records. Risk signals are intentionally not exposed in this summary. No review, ban, verification or payout action is available here.</footer>
      </section>
      <p className="afr-safety"><strong>Safety boundary:</strong> This view is read-only. Account restrictions and risk resolutions must use separately authorized, reasoned and audited backend workflows.</p>
    </main>
  </div>;
}
