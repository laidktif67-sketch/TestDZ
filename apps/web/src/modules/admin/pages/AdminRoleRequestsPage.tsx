import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import {
  listPendingDeveloperRoleRequests,
  reviewDeveloperRoleRequest,
  type AdminDeveloperRoleRequest,
} from "../../../features/admin/admin-api";
import { isTesterWorkflowV2Enabled } from "../../../lib/supabase-v2";
import "./admin-role-requests.css";

function formatDate(value: string) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "—" : date.toLocaleString();
}

export default function AdminRoleRequestsPage() {
  const [requests, setRequests] = useState<AdminDeveloperRoleRequest[]>([]);
  const [reasons, setReasons] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
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
      const { data, error: queryError } = await listPendingDeveloperRoleRequests();
      if (queryError) throw queryError;
      setRequests((data ?? []) as AdminDeveloperRoleRequest[]);
    } catch {
      setRequests([]);
      setError("Could not load Developer access requests. Refresh and try again.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function decide(requestId: string, decision: "approved" | "rejected") {
    const reason = (reasons[requestId] ?? "").trim();
    if (reason.length < 10 || reason.length > 1000) {
      setError("Enter a decision reason between 10 and 1000 characters.");
      return;
    }

    setBusyId(requestId);
    setError("");
    setNotice("");
    try {
      const { error: reviewError } = await reviewDeveloperRoleRequest(requestId, decision, reason);
      if (reviewError) throw reviewError;
      setNotice(decision === "approved"
        ? "Developer access approved and recorded in the audit log."
        : "The request was rejected and recorded in the audit log.");
      setReasons((current) => ({ ...current, [requestId]: "" }));
      await load();
    } catch {
      setError("The decision could not be saved. The request has not been changed.");
    } finally {
      setBusyId(null);
    }
  }

  if (!isTesterWorkflowV2Enabled) {
    return (
      <main className="admin-role-requests">
        <h1>Developer access requests</h1>
        <p>V2 is not enabled in this environment. No V2 request data was loaded.</p>
      </main>
    );
  }

  return (
    <main className="admin-role-requests">
      <Link className="admin-role-requests__back" to="/admin">← Back to Admin</Link>
      <header className="admin-role-requests__header">
        <div>
          <p className="admin-role-requests__eyebrow">ADMINISTRATION</p>
          <h1>Developer access requests</h1>
          <p>Review each request. Every approval or rejection requires a reason and creates an audit record.</p>
        </div>
        <button type="button" onClick={() => void load()} disabled={loading}>Refresh</button>
      </header>

      {error && <p className="admin-role-requests__alert" role="alert">{error}</p>}
      {notice && <p className="admin-role-requests__notice" role="status">{notice}</p>}

      {loading ? (
        <p aria-live="polite">Loading requests…</p>
      ) : requests.length === 0 ? (
        <section className="admin-role-requests__empty">
          <h2>All caught up</h2>
          <p>No pending Developer requests.</p>
        </section>
      ) : (
        <section className="admin-role-requests__list">
          {requests.map((request) => {
            const reason = reasons[request.request_id] ?? "";
            const validReason = reason.trim().length >= 10 && reason.trim().length <= 1000;
            return (
              <article className="admin-role-request" key={request.request_id}>
                <div className="admin-role-request__top">
                  <div>
                    <span className="admin-role-request__role">{request.requested_role.toUpperCase()}</span>
                    <h2>{request.display_name || "Unnamed applicant"}</h2>
                    <p>{request.user_id}</p>
                  </div>
                  <time dateTime={request.created_at}>{formatDate(request.created_at)}</time>
                </div>
                <p className="admin-role-request__reason">
                  {request.request_reason || "No applicant reason supplied."}
                </p>
                <label htmlFor={`review-${request.request_id}`}>Decision reason (required)</label>
                <textarea
                  id={`review-${request.request_id}`}
                  minLength={10}
                  maxLength={1000}
                  value={reason}
                  onChange={(event) => setReasons((current) => ({
                    ...current,
                    [request.request_id]: event.target.value,
                  }))}
                  placeholder="Explain why this request is approved or rejected."
                />
                <div className="admin-role-request__actions">
                  <button
                    className="admin-role-request__approve"
                    type="button"
                    disabled={busyId !== null || !validReason}
                    onClick={() => void decide(request.request_id, "approved")}
                  >
                    {busyId === request.request_id ? "Saving…" : "Approve Developer"}
                  </button>
                  <button
                    className="admin-role-request__reject"
                    type="button"
                    disabled={busyId !== null || !validReason}
                    onClick={() => void decide(request.request_id, "rejected")}
                  >
                    Reject request
                  </button>
                </div>
              </article>
            );
          })}
        </section>
      )}
    </main>
  );
}
