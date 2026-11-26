import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import {
  listPendingRoleRequests,
  reviewRoleRequest,
  type AdminRoleRequest,
} from "../../../features/admin/admin-api";
import { isTesterWorkflowV2Enabled } from "../../../lib/supabase-v2";

export default function AdminRoleRequestsPage() {
  const [requests, setRequests] = useState<AdminRoleRequest[]>([]);
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const load = useCallback(async () => {
    if (!isTesterWorkflowV2Enabled) {
      setRequests([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    setError("");
    try {
      const { data, error: queryError } = await listPendingRoleRequests();
      if (queryError) throw queryError;
      setRequests((data ?? []) as AdminRoleRequest[]);
    } catch {
      setRequests([]);
      setError("Could not load pending role requests. Check the Admin workspace permissions.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  async function decide(request: AdminRoleRequest, decision: "approved" | "rejected") {
    const reviewNote = (notes[request.request_id] ?? "").trim();
    if (reviewNote.length < 10 || reviewNote.length > 1000) {
      setError("Enter a review reason between 10 and 1000 characters.");
      return;
    }
    setBusyId(request.request_id);
    setError("");
    setNotice("");
    try {
      const { error: reviewError } = await reviewRoleRequest(
        request.request_id,
        decision,
        reviewNote,
      );
      if (reviewError) {
        setError("The role request could not be reviewed. It may already have been processed.");
      } else {
        setNotice(decision === "approved" ? "Role request approved and access granted." : "Role request rejected. The decision was recorded.");
        setNotes(current => ({ ...current, [request.request_id]: "" }));
        await load();
      }
    } catch {
      setError("The role request could not be reviewed. Please retry.");
    } finally {
      setBusyId("");
    }
  }

  if (!isTesterWorkflowV2Enabled) {
    return (
      <main className="dashboard-shell">
        <section className="dashboard-welcome container">
          <h1>Role requests</h1>
          <p>V2 is not enabled in this environment. No V2 role-request data was loaded.</p>
        </section>
      </main>
    );
  }

  return (
    <main className="dashboard-shell">
      <header className="site-header container">
        <strong>TestDZ Admin</strong>
        <nav className="header-actions"><Link to="/admin">Admin workspace</Link></nav>
      </header>
      <section className="dashboard-welcome container">
        <div className="apps-heading">
          <div>
            <span className="eyebrow">ADMINISTRATION · V2</span>
            <h1>Role requests</h1>
            <p>Review Tester and Developer access requests. Approval and rejection require a reason and are recorded in the audit log.</p>
          </div>
          <button className="button button-outline" type="button" onClick={() => void load()} disabled={loading}>Refresh</button>
        </div>
        {notice && <div className="notice notice-success" role="status">{notice}</div>}
        {error && <div className="notice notice-error" role="alert">{error}</div>}
        {loading ? <div className="loading-screen">Loading pending requests…</div> : requests.length === 0 ? (
          <p className="placeholder-panel">There are no pending role requests.</p>
        ) : (
          <div className="apps-grid">
            {requests.map(request => (
              <article className="app-tile" key={request.request_id}>
                <div className="app-tile-copy">
                  <strong>{request.display_name?.trim() || "TestDZ member"}</strong>
                  <small>{request.requested_role.toUpperCase()} access · {new Date(request.created_at).toLocaleString()}</small>
                  <p>{request.request_reason}</p>
                </div>
                <label>
                  Audit reason
                  <textarea
                    rows={3}
                    minLength={10}
                    maxLength={1000}
                    value={notes[request.request_id] ?? ""}
                    onChange={event => setNotes(current => ({ ...current, [request.request_id]: event.target.value }))}
                    placeholder="Explain why this request is approved or rejected…"
                  />
                </label>
                <div className="detail-actions">
                  <button className="button button-primary" type="button" disabled={busyId === request.request_id || (notes[request.request_id] ?? "").trim().length < 10} onClick={() => void decide(request, "approved")}>Approve</button>
                  <button className="button button-quiet" type="button" disabled={busyId === request.request_id || (notes[request.request_id] ?? "").trim().length < 10} onClick={() => void decide(request, "rejected")}>Reject</button>
                </div>
              </article>
            ))}
          </div>
        )}
      </section>
    </main>
  );
}
