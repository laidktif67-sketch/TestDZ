import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { listCaseDisputes, listCaseReports, type AdminCaseDispute, type AdminCaseReport } from "../../../features/admin/admin-api";
import { isTesterWorkflowV2Enabled } from "../../../lib/supabase-v2";
import { useIdentity } from "../../../shared/auth/hooks/useIdentity";
import TesterSidebar from "../../tester/components/TesterSidebar";
import "./case-queues.css";

type View = "reports" | "disputes" | "all";
type StatusFilter = "all" | "open" | "under_review" | "resolved" | "rejected" | "opened" | "resolved_accepted" | "resolved_rejected" | "escalated";
const shortId = (value: string | null) => value ? value.slice(0, 8).toUpperCase() : "—";
const dateTime = (value: string | null) => { if (!value) return "—"; const date = new Date(value); return Number.isNaN(date.getTime()) ? "—" : date.toLocaleString(); };
const label = (value: string) => value.replaceAll("_", " ");

export default function CaseQueuesPage({ view }: { view: View }) {
  const { roles = [] } = useIdentity();
  const [reports, setReports] = useState<AdminCaseReport[]>([]);
  const [disputes, setDisputes] = useState<AdminCaseDispute[]>([]);
  const [filter, setFilter] = useState<StatusFilter>("all");
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [menuOpen, setMenuOpen] = useState(false);
  const isAdmin = roles.includes("admin");
  const isSupport = roles.includes("support");
  const isFinancial = roles.includes("financial");
  const showReports = view !== "disputes" && (isAdmin || isSupport);
  const showDisputes = view !== "reports" && (isAdmin || isFinancial);

  const load = useCallback(async () => {
    if (!isTesterWorkflowV2Enabled) { setLoading(false); return; }
    setLoading(true); setError("");
    try {
      const [reportResult, disputeResult] = await Promise.all([
        showReports ? listCaseReports() : Promise.resolve(null),
        showDisputes ? listCaseDisputes() : Promise.resolve(null),
      ]);
      if (reportResult?.error) throw reportResult.error;
      if (disputeResult?.error) throw disputeResult.error;
      setReports((reportResult?.data ?? []) as AdminCaseReport[]);
      setDisputes((disputeResult?.data ?? []) as AdminCaseDispute[]);
    } catch {
      setReports([]); setDisputes([]);
      setError("Case records could not be loaded. Confirm V2 is enabled and your workspace role is valid, then retry.");
    } finally { setLoading(false); }
  }, [showReports, showDisputes]);
  useEffect(() => { void load(); }, [load]);

  const filteredReports = useMemo(() => {
    const term = search.trim().toLowerCase();
    return reports.filter(row => (filter === "all" || row.status === filter) &&
      (!term || [row.id,row.reporter_id,row.reported_user_id,row.assignment_id,row.report_type,row.status,row.reviewed_by].filter(Boolean).join(" ").toLowerCase().includes(term)));
  }, [reports, filter, search]);
  const filteredDisputes = useMemo(() => {
    const term = search.trim().toLowerCase();
    return disputes.filter(row => (filter === "all" || row.status === filter) &&
      (!term || [row.id,row.opened_by,row.payment_id,row.report_id,row.status,row.resolved_by].filter(Boolean).join(" ").toLowerCase().includes(term)));
  }, [disputes, filter, search]);

  const nav = [
    ...(isAdmin ? [{ label: "Admin Workspace", icon: "shield", href: "/admin" }, { label: "Case Queues", icon: "folder", href: "/admin/cases", active: view === "all" }] : []),
    ...(isSupport ? [{ label: "Support Queue", icon: "headset", href: "/support-workspace" }, { label: "Reports", icon: "alert", href: "/support-workspace/reports", active: view === "reports" }] : []),
    ...(isFinancial ? [{ label: "Financial Operations", icon: "wallet", href: "/financial-operations" }, { label: "Disputes", icon: "file", href: "/financial-operations/disputes", active: view === "disputes" }] : []),
    { label: "Profile", icon: "user", href: "/profile" },
  ];

  if (!isTesterWorkflowV2Enabled) return <main className="case-queues"><h1>Case queues</h1><p>V2 is not enabled in this environment. No V2 case records were loaded.</p></main>;

  return <div className="td-dashboard cq-shell">
    <TesterSidebar nav={nav} name={isAdmin ? "TestDZ Admin" : isFinancial ? "TestDZ Finance" : "TestDZ Support"} firstName={isAdmin ? "A" : isFinancial ? "F" : "S"} avatar="" roles={roles} isAdmin={isAdmin} isDeveloper={roles.includes("developer")} workspaceMenuOpen={menuOpen} setWorkspaceMenuOpen={setMenuOpen} previewMode={false}/>
    <main className="cq-main">
      <header className="cq-header"><div><span className="cq-eyebrow">CASE MANAGEMENT · READ ONLY</span><h1>{view === "reports" ? "Report queue" : view === "disputes" ? "Dispute queue" : "Reports & disputes"}</h1><p>Review case metadata within your role. No case decisions or financial actions are available here.</p></div><button type="button" onClick={() => void load()} disabled={loading}>↻ Refresh</button></header>
      {error && <p className="cq-error" role="alert">{error}</p>}
      <section className="cq-stats">
        {showReports && <article><span>Open reports</span><strong>{reports.filter(row => row.status === "open").length}</strong></article>}
        {showReports && <article><span>Reports under review</span><strong>{reports.filter(row => row.status === "under_review").length}</strong></article>}
        {showDisputes && <article><span>Open disputes</span><strong>{disputes.filter(row => row.status === "opened" || row.status === "under_review").length}</strong></article>}
        {showDisputes && <article><span>Escalated disputes</span><strong>{disputes.filter(row => row.status === "escalated").length}</strong></article>}
      </section>
      <section className="cq-panel">
        <div className="cq-toolbar"><div className="cq-filters" role="group" aria-label="Filter cases">
          {(["all","open","under_review","opened","resolved","rejected","resolved_accepted","resolved_rejected","escalated"] as StatusFilter[]).map(value => <button type="button" key={value} className={filter === value ? "active" : ""} onClick={() => setFilter(value)}>{value === "all" ? "All statuses" : label(value)}</button>)}
        </div><input value={search} onChange={event => setSearch(event.target.value)} placeholder="Search case or account ID…" aria-label="Search case records"/></div>
        {loading ? <div className="cq-empty">Loading case records…</div> : <>
          {showReports && <div className="cq-section"><h2>Reports <span>{filteredReports.length}</span></h2><div className="cq-table-wrap"><table><thead><tr><th>Created</th><th>Report</th><th>Reporter</th><th>Reported account</th><th>Type</th><th>Assignment</th><th>Status</th><th>Reviewed by</th></tr></thead><tbody>
            {filteredReports.map(row => <tr key={row.id}><td>{dateTime(row.created_at)}</td><td><code>{shortId(row.id)}</code></td><td><code>{shortId(row.reporter_id)}</code></td><td><code>{shortId(row.reported_user_id)}</code></td><td>{label(row.report_type)}</td><td><code>{shortId(row.assignment_id)}</code></td><td><span className={"cq-status " + row.status}>{label(row.status)}</span></td><td><code>{shortId(row.reviewed_by)}</code></td></tr>)}
            {!filteredReports.length && <tr><td colSpan={8} className="cq-empty">No reports match this filter.</td></tr>}
          </tbody></table></div></div>}
          {showDisputes && <div className="cq-section"><h2>Disputes <span>{filteredDisputes.length}</span></h2><div className="cq-table-wrap"><table><thead><tr><th>Created</th><th>Dispute</th><th>Opened by</th><th>Payment ref</th><th>Report ref</th><th>Status</th><th>Resolved by</th><th>Updated</th></tr></thead><tbody>
            {filteredDisputes.map(row => <tr key={row.id}><td>{dateTime(row.created_at)}</td><td><code>{shortId(row.id)}</code></td><td><code>{shortId(row.opened_by)}</code></td><td><code>{shortId(row.payment_id)}</code></td><td><code>{shortId(row.report_id)}</code></td><td><span className={"cq-status " + row.status}>{label(row.status)}</span></td><td><code>{shortId(row.resolved_by)}</code></td><td>{dateTime(row.updated_at)}</td></tr>)}
            {!filteredDisputes.length && <tr><td colSpan={8} className="cq-empty">No disputes match this filter.</td></tr>}
          </tbody></table></div></div>}
        </>}
        <footer className="cq-footer">Showing up to 100 latest records per queue. Descriptions, evidence, payment amounts and resolution text are intentionally excluded from this summary.</footer>
      </section>
      <p className="cq-safety"><strong>Workflow boundary:</strong> This is a read-only triage view. Report intake, review decisions, dispute resolution and refunds are not implemented by this screen; no status, payment, wallet or account data can be changed here.</p>
      <p className="cq-link"><Link to={isAdmin ? "/admin" : isFinancial ? "/financial-operations" : "/support-workspace"}>Return to workspace</Link></p>
    </main>
  </div>;
}
