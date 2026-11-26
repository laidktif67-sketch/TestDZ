import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { getAppDataClient } from "../../../lib/supabase-data";

type RoleRequest = {
  request_id: string;
  user_id: string;
  requested_role: "tester" | "developer";
  request_reason: string;
  created_at: string;
  display_name: string | null;
};

export default function AdminRoleRequestsPage() {
  const [requests, setRequests] = useState<RoleRequest[]>([]);
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const { data, error: queryError } = await getAppDataClient().rpc("admin_list_pending_role_requests");
      if (queryError) setError("Could not load pending role requests. Check the Admin workspace permissions.");
      else setRequests((data ?? []) as RoleRequest[]);
    } catch {
      setError("Could not load pending role requests. Check your connection and Admin permissions.");
    }
    setLoading(false);
  }, []);

  useEffect(() => { void load(); }, [load]);

  async function decide(request: RoleRequest, decision: "approved" | "rejected") {
    const reviewNote = (notes[request.request_id] ?? "").trim();
    if (reviewNote.length < 10) {
      setError("Add a clear review reason of at least 10 characters.");
      return;
    }
    setBusyId(request.request_id);
    setError("");
    setNotice("");
    try {
      const { error: reviewError } = await getAppDataClient().rpc("admin_review_role_request", {
        p_request_id: request.request_id,
        p_decision: decision,
        p_review_note: reviewNote,
      });
      if (reviewError) {
        setError("The role request could not be reviewed. It may already have been processed.");
      } else {
        setNotice(decision === "approved" ? "Role request approved and access granted." : "Role request rejected. The decision was recorded.");
        setNotes(current => ({ ...current, [request.request_id]: "" }));
        await load();
      }
    } catch {
      setError("The role request could not be reviewed. Please retry.");
    }
    setBusyId("");
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
                  <small>User ID: {request.user_id}</small>
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
