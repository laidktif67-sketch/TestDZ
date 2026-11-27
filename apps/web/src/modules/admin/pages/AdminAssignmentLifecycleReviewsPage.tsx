import { useCallback, useEffect, useState } from "react";
import { Link, Navigate } from "react-router-dom";
import { useIdentity } from "../../../shared/auth/hooks/useIdentity";
import { isTesterWorkflowV2Enabled } from "../../../lib/supabase-v2";
import {
  getMedicalExceptionEvidenceUrl,
  listPendingFeedbackQuality,
  listPendingMedicalExceptionRequests,
  reviewFeedbackQuality,
  reviewMedicalExceptionRequest,
  type AdminFeedbackQualityItem,
  type AdminMedicalExceptionRequest,
} from "../../../features/admin/assignment-lifecycle-api";
import "./assignment-lifecycle-reviews.css";

export default function AdminAssignmentLifecycleReviewsPage() {
  const { session, roles = [], loading: identityLoading } = useIdentity();
  const [medical, setMedical] = useState<AdminMedicalExceptionRequest[]>([]);
  const [feedback, setFeedback] = useState<AdminFeedbackQualityItem[]>([]);
  const [medicalNotes, setMedicalNotes] = useState<Record<string, string>>({});
  const [feedbackNotes, setFeedbackNotes] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const load = useCallback(async () => {
    if (!isTesterWorkflowV2Enabled) {
      setMedical([]);
      setFeedback([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    setError("");
    try {
      const [medicalResult, feedbackResult] = await Promise.all([
        listPendingMedicalExceptionRequests(),
        listPendingFeedbackQuality(),
      ]);
      if (medicalResult.error || feedbackResult.error) {
        setError("Some review queues could not be loaded. Confirm Admin permissions and the current V2 schema.");
      }
      setMedical((medicalResult.data ?? []) as AdminMedicalExceptionRequest[]);
      setFeedback((feedbackResult.data ?? []) as AdminFeedbackQualityItem[]);
    } catch {
      setError("The assignment review queues could not be loaded. Please retry.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!identityLoading && session && roles.includes("admin")) void load();
    else if (!identityLoading) setLoading(false);
  }, [identityLoading, session, roles, load]);

  async function decideMedical(item: AdminMedicalExceptionRequest, decision: "approved" | "rejected") {
    const note = (medicalNotes[item.id] ?? "").trim();
    if (note.length < 10 || note.length > 2000) {
      setError("Medical decisions require an audit note between 10 and 2000 characters.");
      return;
    }
    setBusyId("medical:" + item.id);
    setError("");
    setNotice("");
    try {
      const result = await reviewMedicalExceptionRequest(item.id, decision, note);
      if (result.error) throw result.error;
      setNotice(decision === "approved"
        ? "Medical exception approved. The assignment schedule was extended by the number of approved dates."
        : "Medical exception rejected. The assignment schedule was not extended.");
      setMedicalNotes(current => ({ ...current, [item.id]: "" }));
      await load();
    } catch {
      setError("The medical decision could not be saved. The request may have changed or an overlapping date may now exist.");
    } finally {
      setBusyId("");
    }
  }

  async function decideFeedback(item: AdminFeedbackQualityItem, decision: "accepted" | "rejected") {
    const note = (feedbackNotes[item.id] ?? "").trim();
    if (note.length < 10 || note.length > 2000) {
      setError("Feedback quality decisions require an audit note between 10 and 2000 characters.");
      return;
    }
    setBusyId("feedback:" + item.id);
    setError("");
    setNotice("");
    try {
      const result = await reviewFeedbackQuality(item.id, decision, note);
      if (result.error) throw result.error;
      setNotice(decision === "accepted"
        ? "Feedback quality accepted. The tester can now meet this submission prerequisite."
        : "Feedback quality rejected. The decision and reason were recorded.");
      setFeedbackNotes(current => ({ ...current, [item.id]: "" }));
      await load();
    } catch {
      setError("The feedback quality decision could not be saved. It may already have been reviewed.");
    } finally {
      setBusyId("");
    }
  }

  async function openEvidence(path: string) {
    setError("");
    const popup = window.open("about:blank", "_blank");
    if (popup) popup.opener = null;
    try {
      const result = await getMedicalExceptionEvidenceUrl(path);
      if (result.error || !result.data?.signedUrl) throw result.error || new Error("SIGNED_URL_UNAVAILABLE");
      if (popup) popup.location.href = result.data.signedUrl;
      else window.location.assign(result.data.signedUrl);
    } catch {
      popup?.close();
      setError("Private medical evidence could not be opened. Access is restricted to Admin and the requesting tester.");
    }
  }

  if (!identityLoading && !session) return <Navigate to="/auth" replace />;
  if (!identityLoading && session && !roles.includes("admin")) return <Navigate to="/dashboard" replace />;

  if (!isTesterWorkflowV2Enabled) {
    return <main className="alr-shell"><section className="alr-panel"><h1>Assignment lifecycle reviews</h1><p>The V2 review workspace is not enabled in this environment. No legacy review data was queried.</p><Link to="/admin">Back to Admin</Link></section></main>;
  }

  return <main className="alr-shell">
    <header className="alr-header"><Link to="/admin">← Admin workspace</Link><span>TESTDZ · ADMIN ONLY</span></header>
    <section className="alr-hero"><span>TRUST & SAFETY OPERATIONS</span><h1>Assignment lifecycle reviews</h1><p>Review medical exception requests and feedback quality. These queues are Admin-only; Support and developers do not receive access to raw medical evidence or tester feedback quality decisions.</p></section>
    {error && <p className="alr-alert error" role="alert">{error}</p>}
    {notice && <p className="alr-alert success" role="status">{notice}</p>}
    <div className="alr-toolbar"><div><strong>Pending reviews</strong><span>{medical.length} medical · {feedback.length} feedback</span></div><button type="button" onClick={() => void load()} disabled={loading || !!busyId}>Refresh queues</button></div>
    {loading ? <section className="alr-panel">Loading Admin review queues…</section> : <>
      <section className="alr-panel">
        <div className="alr-section-heading"><div><h2>Medical exception requests</h2><p>Each approved date adds one calendar day. Excused dates never become check-ins.</p></div><b>{medical.length}</b></div>
        {medical.length === 0 ? <p className="alr-empty">No pending medical exception requests.</p> : <div className="alr-list">
          {medical.map(item => <article className="alr-item" key={item.id}>
            <div className="alr-item-heading"><strong>{item.requested_dates.length} requested date(s)</strong><small>{new Date(item.created_at).toLocaleString()}</small></div>
            <p className="alr-dates">{item.requested_dates.join(" · ")}</p>
            <p className="alr-reason">{item.reason}</p>
            <div className="alr-meta"><span>Assignment: {item.assignment_id}</span><span>Tester: {item.tester_id}</span></div>
            {item.evidence_storage_path && <button className="alr-evidence" type="button" onClick={() => void openEvidence(item.evidence_storage_path!)}>Open private supporting evidence</button>}
            <label className="alr-note">Decision note (required)
              <textarea rows={3} minLength={10} maxLength={2000} value={medicalNotes[item.id] ?? ""} onChange={event => setMedicalNotes(current => ({ ...current, [item.id]: event.target.value }))} placeholder="Record the reason for approving or rejecting this exception." />
            </label>
            <div className="alr-actions"><button type="button" className="approve" disabled={!!busyId || (medicalNotes[item.id] ?? "").trim().length < 10} onClick={() => void decideMedical(item, "approved")}>Approve and extend schedule</button><button type="button" className="reject" disabled={!!busyId || (medicalNotes[item.id] ?? "").trim().length < 10} onClick={() => void decideMedical(item, "rejected")}>Reject</button></div>
          </article>)}
        </div>}
      </section>

      <section className="alr-panel">
        <div className="alr-section-heading"><div><h2>Feedback quality review</h2><p>Only accepted feedback satisfies the assignment completion prerequisite. This is separate from developer triage.</p></div><b>{feedback.length}</b></div>
        {feedback.length === 0 ? <p className="alr-empty">No feedback entries are waiting for quality review.</p> : <div className="alr-list">
          {feedback.map(item => <article className="alr-item" key={item.id}>
            <div className="alr-item-heading"><strong>{item.category.replace("_", " ")}</strong><small>{new Date(item.created_at).toLocaleString()}</small></div>
            {item.rating !== null && <span className="alr-rating">Tester rating: {item.rating}/5</span>}
            <p className="alr-reason">{item.body}</p>
            <div className="alr-meta"><span>Assignment: {item.assignment_id}</span><span>Tester: {item.tester_id}</span></div>
            <label className="alr-note">Decision note (required)
              <textarea rows={3} minLength={10} maxLength={2000} value={feedbackNotes[item.id] ?? ""} onChange={event => setFeedbackNotes(current => ({ ...current, [item.id]: event.target.value }))} placeholder="Explain why the feedback meets or does not meet quality requirements." />
            </label>
            <div className="alr-actions"><button type="button" className="approve" disabled={!!busyId || (feedbackNotes[item.id] ?? "").trim().length < 10} onClick={() => void decideFeedback(item, "accepted")}>Accept quality</button><button type="button" className="reject" disabled={!!busyId || (feedbackNotes[item.id] ?? "").trim().length < 10} onClick={() => void decideFeedback(item, "rejected")}>Reject quality</button></div>
          </article>)}
        </div>}
      </section>
    </>}
  </main>;
}
