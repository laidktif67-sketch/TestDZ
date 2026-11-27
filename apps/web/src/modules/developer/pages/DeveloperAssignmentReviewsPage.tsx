import { useCallback, useEffect, useState } from "react";
import { Link, Navigate } from "react-router-dom";
import { isTesterWorkflowV2Enabled } from "../../../lib/supabase-v2";
import { useIdentity } from "../../../shared/auth/hooks/useIdentity";
import {
  getDeveloperSubmissionEvidenceUrl,
  listDeveloperAssignmentSubmissions,
  listDeveloperSubmissionAttachments,
  listDeveloperSubmissionTests,
  reviewDeveloperAssignmentSubmission,
  type DeveloperAssignmentSubmission,
  type DeveloperSubmissionAttachment,
  type DeveloperSubmissionTest,
} from "../../../features/developer/assignment-review-api";
import "../styles/developer-dashboard.css";
import "./developer-assignment-reviews.css";

export default function DeveloperAssignmentReviewsPage() {
  const { session, roles = [], loading: identityLoading } = useIdentity();
  const [submissions, setSubmissions] = useState<DeveloperAssignmentSubmission[]>([]);
  const [tests, setTests] = useState<Record<string, string>>({});
  const [attachments, setAttachments] = useState<DeveloperSubmissionAttachment[]>([]);
  const [selected, setSelected] = useState<DeveloperAssignmentSubmission | null>(null);
  const [note, setNote] = useState("");
  const [loading, setLoading] = useState(true);
  const [attachmentsLoading, setAttachmentsLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const load = useCallback(async () => {
    if (!isTesterWorkflowV2Enabled) {
      setSubmissions([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    setError("");
    try {
      const result = await listDeveloperAssignmentSubmissions();
      if (result.error) throw result.error;
      const rows = (result.data ?? []) as DeveloperAssignmentSubmission[];
      setSubmissions(rows);
      const testIds = [...new Set(rows.map(row => row.test_id))];
      const testResult = await listDeveloperSubmissionTests(testIds);
      if (testResult.error) throw testResult.error;
      const titleMap = Object.fromEntries(((testResult.data ?? []) as DeveloperSubmissionTest[]).map(test => [test.id, test.title]));
      setTests(titleMap);
      setSelected(current => current && rows.some(row => row.id === current.id)
        ? rows.find(row => row.id === current.id) ?? null
        : rows[0] ?? null);
    } catch {
      setError("Submitted reports could not be loaded. Confirm the Developer role and V2 data access.");
      setSubmissions([]);
      setSelected(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!identityLoading && session && roles.includes("developer")) void load();
    else if (!identityLoading) setLoading(false);
  }, [identityLoading, session, roles, load]);

  useEffect(() => {
    let active = true;
    async function loadAttachments() {
      if (!selected || !isTesterWorkflowV2Enabled) {
        setAttachments([]);
        return;
      }
      setAttachmentsLoading(true);
      const result = await listDeveloperSubmissionAttachments(selected.id);
      if (active) {
        if (result.error) {
          setAttachments([]);
          setError("Report attachments could not be loaded.");
        } else {
          setAttachments((result.data ?? []) as DeveloperSubmissionAttachment[]);
        }
        setAttachmentsLoading(false);
      }
    }
    void loadAttachments();
    return () => { active = false; };
  }, [selected?.id]);

  async function openEvidence(path: string) {
    const popup = window.open("about:blank", "_blank");
    if (popup) popup.opener = null;
    try {
      const result = await getDeveloperSubmissionEvidenceUrl(path);
      if (result.error || !result.data?.signedUrl) throw result.error || new Error("SIGNED_URL_UNAVAILABLE");
      if (popup) popup.location.href = result.data.signedUrl;
      else window.location.assign(result.data.signedUrl);
    } catch {
      popup?.close();
      setError("The private report attachment could not be opened.");
    }
  }

  async function decide(decision: "approved" | "changes_requested") {
    if (!selected || busy) return;
    const normalized = note.trim();
    if (decision === "changes_requested" && normalized.length < 10) {
      setError("A change request needs a clear review reason of at least 10 characters.");
      return;
    }
    if (normalized.length > 2000) {
      setError("The review note cannot exceed 2000 characters.");
      return;
    }
    setBusy(true);
    setError("");
    setNotice("");
    try {
      const result = await reviewDeveloperAssignmentSubmission(selected.id, decision, normalized || null);
      if (result.error) throw result.error;
      setNotice(decision === "approved"
        ? "Report approved. The assignment is now completed."
        : "Changes requested. The tester can create a new attempt while the previous report remains in history.");
      setNote("");
      await load();
    } catch {
      setError("The decision could not be saved. The server may have detected a changed prerequisite or an already-reviewed report.");
    } finally {
      setBusy(false);
    }
  }

  if (!identityLoading && !session) return <Navigate to="/auth" replace />;
  if (!identityLoading && session && !roles.includes("developer")) return <Navigate to="/dashboard" replace />;

  if (!isTesterWorkflowV2Enabled) {
    return <main className="dar-shell"><section className="dar-panel"><h1>Tester report reviews</h1><p>The V2 review workflow is not enabled in this environment. No legacy review path was used.</p><Link to="/developer-dashboard">Back to Developer workspace</Link></section></main>;
  }

  return <main className="dar-shell">
    <header className="dar-header"><Link to="/developer-dashboard">← Developer workspace</Link><span>TESTDZ · DEVELOPER REVIEWS</span></header>
    <section className="dar-hero"><span>ASSIGNMENT DELIVERY</span><h1>Tester report reviews</h1><p>Review final reports submitted by testers assigned to your tests. Approval rechecks the 14-day, feedback-quality, medical-exception and evidence prerequisites on the server.</p></section>
    {error && <p className="dar-alert error" role="alert">{error}</p>}
    {notice && <p className="dar-alert success" role="status">{notice}</p>}
    <div className="dar-layout">
      <section className="dar-panel dar-queue">
        <div className="dar-heading"><div><h2>Awaiting your review</h2><p>{submissions.length} submitted report(s)</p></div><button type="button" onClick={() => void load()} disabled={loading || busy}>Refresh</button></div>
        {loading ? <p className="dar-empty">Loading submitted reports…</p> : submissions.length === 0 ? <p className="dar-empty">No reports are awaiting your review.</p> : <div className="dar-queue-list">
          {submissions.map(item => <button type="button" key={item.id} className={"dar-queue-item " + (selected?.id === item.id ? "selected" : "")} onClick={() => { setSelected(item); setNote(""); setError(""); }}>
            <strong>{tests[item.test_id] || "Test report"}</strong><span>Attempt {item.attempt_number} · {new Date(item.submitted_at).toLocaleDateString()}</span><small>{item.summary.slice(0, 115)}{item.summary.length > 115 ? "…" : ""}</small>
            <b>{item.review_due_at ? "Review due " + new Date(item.review_due_at).toLocaleString() : "Awaiting review"}</b>
          </button>)}
        </div>}
      </section>

      <section className="dar-panel dar-detail">
        {!selected ? <p className="dar-empty">Select a submitted report to review.</p> : <>
          <div className="dar-heading"><div><span className="dar-kicker">SUBMISSION · ATTEMPT {selected.attempt_number}</span><h2>{tests[selected.test_id] || "Test report"}</h2><p>Submitted {new Date(selected.submitted_at).toLocaleString()}</p></div><span className="dar-pending">Submitted</span></div>
          <div className="dar-summary"><h3>Tester summary</h3><p>{selected.summary}</p></div>
          {selected.comments && <div className="dar-summary"><h3>Additional comments</h3><p>{selected.comments}</p></div>}
          <div className="dar-attachments"><h3>Supporting evidence</h3>
            {attachmentsLoading ? <p>Loading attachments…</p> : attachments.length === 0 ? <p>No supporting files attached.</p> : attachments.map(file => <div className="dar-file" key={file.id}><span>▣</span><div><strong>{file.original_filename}</strong><small>{file.mime_type} · {(file.size_bytes/1024/1024).toFixed(2)} MiB</small></div><button type="button" onClick={() => void openEvidence(file.storage_path)}>Open file</button></div>)}
          </div>
          <label className="dar-note">Review note
            <textarea rows={4} maxLength={2000} value={note} onChange={event => setNote(event.target.value)} placeholder="Add a clear reason. Required when requesting changes; optional when approving."/>
            <small>{note.trim().length}/2000 characters</small>
          </label>
          <div className="dar-policy"><strong>Approval safety</strong><p>Approval is blocked unless the assignment still has exactly 14 valid required-day check-ins, accepted feedback quality, no pending medical request and verified attachment metadata.</p></div>
          <div className="dar-actions"><button type="button" className="approve" disabled={busy} onClick={() => void decide("approved")}>{busy ? "Saving…" : "Approve final report"}</button><button type="button" className="changes" disabled={busy || note.trim().length < 10} onClick={() => void decide("changes_requested")}>Request changes</button></div>
        </>}
      </section>
    </div>
  </main>;
}
