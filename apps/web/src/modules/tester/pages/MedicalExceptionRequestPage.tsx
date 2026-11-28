import { useCallback, useEffect, useState } from "react";
import type { FormEvent } from "react";
import { Link, Navigate, useParams } from "react-router-dom";
import { isTesterWorkflowV2Enabled } from "../../../lib/supabase-v2";
import { useIdentity } from "../../../shared/auth/hooks/useIdentity";
import {
  attachTesterMedicalExceptionEvidence,
  getTesterMedicalExceptionAssignment,
  createTesterMedicalExceptionRequest,
  listTesterMedicalExceptionRequests,
  uploadMedicalExceptionEvidence,
  type MedicalExceptionRequest,
} from "../../../features/tester/assignment-lifecycle-api";
import "../styles/tester-dashboard.css";
import "../styles/medical-exception-request.css";

const todayValue = () => {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Africa/Algiers",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());
  const part = (type: string) => parts.find(item => item.type === type)?.value || "";
  return `${part("year")}-${part("month")}-${part("day")}`;
};
const allowedTypes = new Set(["image/jpeg", "image/png", "image/webp", "application/pdf"]);
const extensionFor = (file: File) => {
  const ext = file.name.split(".").pop()?.toLowerCase();
  if (ext && ["jpg", "jpeg", "png", "webp", "pdf"].includes(ext)) return ext;
  return file.type === "image/jpeg" ? "jpg" : file.type === "image/png" ? "png"
    : file.type === "image/webp" ? "webp" : file.type === "application/pdf" ? "pdf" : "";
};

export default function MedicalExceptionRequestPage() {
  const { id = "" } = useParams();
  const { session, roles = [], loading: identityLoading, rolesLoading } = useIdentity();
  const [assignmentStatus, setAssignmentStatus] = useState("");
  const [requests, setRequests] = useState<MedicalExceptionRequest[]>([]);
  const [dates, setDates] = useState<string[]>([todayValue()]);
  const [reason, setReason] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const load = useCallback(async () => {
    if (!session?.user?.id || !id || !isTesterWorkflowV2Enabled) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setError("");
    try {
      const [assignment, requestResult] = await Promise.all([
        getTesterMedicalExceptionAssignment(id, session.user.id),
        listTesterMedicalExceptionRequests(id),
      ]);
      if (assignment.error || !assignment.data) {
        setError("This assignment could not be found in your Tester workspace.");
        setAssignmentStatus("");
      } else {
        setAssignmentStatus(assignment.data.status);
      }
      if (requestResult.error) {
        setError("Medical request history could not be loaded.");
        setRequests([]);
      } else {
        setRequests((requestResult.data ?? []) as MedicalExceptionRequest[]);
      }
    } catch {
      setError("Medical exception information could not be loaded. Please retry.");
    } finally {
      setLoading(false);
    }
  }, [id, session?.user?.id]);

  useEffect(() => {
    if (!identityLoading && !rolesLoading && session && roles.includes("tester")) void load();
  }, [identityLoading, rolesLoading, session, roles, load]);

  async function uploadEvidence(requestId: string, selectedFile: File) {
    if (!session?.user?.id) throw new Error("AUTH_REQUIRED");
    const extension = extensionFor(selectedFile);
    if (!allowedTypes.has(selectedFile.type) || !extension || selectedFile.size < 1 || selectedFile.size > 5 * 1024 * 1024) {
      throw new Error("EVIDENCE_FILE_INVALID");
    }
    const path = [id, session.user.id, requestId, crypto.randomUUID() + "." + extension].join("/");
    const upload = await uploadMedicalExceptionEvidence(path, selectedFile);
    if (upload.error) throw upload.error;
    const attached = await attachTesterMedicalExceptionEvidence(requestId, path);
    if (attached.error) throw attached.error;
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!session?.user?.id || !isTesterWorkflowV2Enabled || !["active", "failed"].includes(assignmentStatus) || busy) return;
    const normalizedDates = dates.map(value => value.trim()).filter(Boolean);
    const normalizedReason = reason.trim();
    if (normalizedDates.length < 1 || normalizedDates.length > 14 || new Set(normalizedDates).size !== normalizedDates.length) {
      setError("Choose between 1 and 14 different dates.");
      return;
    }
    if (normalizedReason.length < 20 || normalizedReason.length > 4000) {
      setError("The reason must contain 20–4000 characters.");
      return;
    }
    if (file && (!allowedTypes.has(file.type) || file.size < 1 || file.size > 5 * 1024 * 1024)) {
      setError("Evidence must be a JPEG, PNG, WebP or PDF file up to 5 MiB.");
      return;
    }
    setBusy(true);
    setError("");
    setNotice("");
    try {
      const result = await createTesterMedicalExceptionRequest({
        assignmentId: id,
        reason: normalizedReason,
        requestedDates: normalizedDates,
      });
      if (result.error || typeof result.data !== "string") {
        throw result.error || new Error("MEDICAL_REQUEST_NOT_CREATED");
      }
      if (file) {
        try {
          await uploadEvidence(result.data, file);
          setNotice("Your medical exception request and private evidence were submitted for Admin review.");
        } catch {
          setNotice("Your request was saved, but the evidence upload did not finish. You can attach it from the pending request below.");
        }
      } else {
        setNotice("Your medical exception request was submitted for Admin review.");
      }
      setDates([todayValue()]);
      setReason("");
      setFile(null);
      await load();
    } catch (submitError) {
      setError(submitError instanceof Error && submitError.message === "MEDICAL_EXCEPTION_DUPLICATE_DATES"
        ? "A date in this request has already been requested or excused."
        : submitError instanceof Error && submitError.message === "MEDICAL_EXCEPTION_DATE_OUTSIDE_REQUIRED_SCHEDULE"
          ? "Choose dates within the current 14-required-day schedule. Previously approved medical dates extend that schedule; pending requests do not."
          : "The request could not be submitted. Check the dates and assignment status, then try again.");
    } finally {
      setBusy(false);
    }
  }

  async function attachToExisting(requestId: string, selectedFile: File | null) {
    if (!selectedFile || busy) return;
    setBusy(true);
    setError("");
    setNotice("");
    try {
      await uploadEvidence(requestId, selectedFile);
      setNotice("Private evidence attached to the pending request.");
      await load();
    } catch {
      setError("Evidence could not be attached. Check the file type, size and request status.");
    } finally {
      setBusy(false);
    }
  }

  if (!identityLoading && !session) return <Navigate to="/auth" replace />;
  if (identityLoading || (session && rolesLoading)) return <main className="mer-shell"><section className="mer-card">Checking Tester permissions…</section></main>;
  if (session && !roles.includes("tester")) return <Navigate to="/dashboard" replace />;

  if (!isTesterWorkflowV2Enabled) {
    return <main className="mer-shell"><section className="mer-card"><h1>Medical exceptions</h1><p>The V2 medical request workflow is not enabled in this environment. No legacy workflow was used.</p><Link to={"/assignments/" + id + "/progress"}>Back to assignment</Link></section></main>;
  }

  return <main className="mer-shell">
    <header className="mer-header"><Link to={"/assignments/" + id + "/progress"}>← Back to assignment</Link><span>TESTDZ · TESTER WORKSPACE</span></header>
    <section className="mer-hero">
      <span className="mer-eyebrow">ASSIGNMENT SUPPORT</span>
      <h1>Medical exception request</h1>
      <p>Request an exception for specific elapsed assignment dates. Only Admin can approve it. Pending requests do not pause the daily schedule.</p>
    </section>
    {error && <p className="mer-alert error" role="alert">{error}</p>}
    {notice && <p className="mer-alert success" role="status">{notice}</p>}
    {loading ? <section className="mer-card">Loading assignment and request history…</section> : <>
      {!["active", "failed"].includes(assignmentStatus) && <section className="mer-card mer-warning"><strong>Medical requests are unavailable for this assignment state.</strong><p>Current assignment status: {assignmentStatus || "Unavailable"}</p></section>}{assignmentStatus === "failed" && <section className="mer-card mer-warning"><strong>Your assignment was interrupted, but you can still submit or complete a pending medical request.</strong><p>Admin can review it after failure. Approval restores the assignment only if no other required day remains unexcused.</p></section>}
      <form className="mer-card mer-form" onSubmit={event => void submit(event)}>
        <div className="mer-card-heading"><div><h2>Request details</h2><p>Choose missed dates within the current 14-required-day schedule. Previously approved exceptions extend that schedule.</p></div><span>1–14 dates</span></div>
        <div className="mer-date-list">
          {dates.map((date, index) => <label key={index}>Date {index + 1}
            <div className="mer-date-row">
              <input type="date" value={date} max={todayValue()} onChange={event => setDates(current => current.map((value, i) => i === index ? event.target.value : value))} required />
              {dates.length > 1 && <button type="button" onClick={() => setDates(current => current.filter((_, i) => i !== index))} aria-label={"Remove date " + (index + 1)}>Remove</button>}
            </div>
          </label>)}
        </div>
        <button className="mer-add-date" type="button" disabled={dates.length >= 14} onClick={() => setDates(current => [...current, todayValue()])}>+ Add another date</button>
        <label className="mer-field">Reason for the request
          <textarea value={reason} onChange={event => setReason(event.target.value)} minLength={20} maxLength={4000} rows={5} required placeholder="Explain why you could not complete the required daily check-in on these dates." />
          <small>{reason.trim().length}/4000 characters · minimum 20</small>
        </label>
        <label className="mer-field">Supporting evidence (optional)
          <input type="file" accept="image/jpeg,image/png,image/webp,application/pdf" onChange={event => setFile(event.target.files?.[0] ?? null)} />
          <small>JPEG, PNG, WebP or PDF · maximum 5 MiB. Evidence is private and visible only to you and Admin.</small>
        </label>
        <div className="mer-policy"><strong>Important</strong><p>Approval adds one calendar day per approved date. Excused dates do not count as check-ins or rewards. A pending or rejected request does not excuse a missed day.</p></div>
        <button className="mer-submit" type="submit" disabled={busy || !["active", "failed"].includes(assignmentStatus) || dates.some(value => !value) || reason.trim().length < 20}>{busy ? "Submitting…" : "Submit request for Admin review"}</button>
      </form>

      <section className="mer-card">
        <div className="mer-card-heading"><div><h2>Your requests</h2><p>Past decisions and pending requests for this assignment.</p></div><button type="button" onClick={() => void load()} disabled={busy}>Refresh</button></div>
        {requests.length === 0 ? <p className="mer-empty">No medical exception requests have been submitted.</p> : <div className="mer-history">
          {requests.map(request => <article className="mer-history-item" key={request.id}>
            <div className="mer-history-top"><strong>{request.requested_dates.length} requested date(s)</strong><span className={"mer-status " + request.status}>{request.status.replace("_", " ")}</span></div>
            <p className="mer-dates">{request.requested_dates.join(" · ")}</p>
            <p>{request.reason}</p>
            {request.review_note && <small>Admin note: {request.review_note}</small>}
            {request.status === "pending" && !request.evidence_storage_path && <label className="mer-attach">Attach supporting evidence (optional)
              <input type="file" accept="image/jpeg,image/png,image/webp,application/pdf" disabled={busy} onChange={event => { const selected = event.target.files?.[0] ?? null; event.target.value = ""; if (selected) void attachToExisting(request.id, selected); }} />
            </label>}
            {request.evidence_storage_path && <small>Supporting evidence attached privately.</small>}
            <time>{new Date(request.created_at).toLocaleString()}</time>
          </article>)}
        </div>}
      </section>
    </>}
  </main>;
}
