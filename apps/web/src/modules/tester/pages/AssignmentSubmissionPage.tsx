import { useEffect, useMemo, useRef, useState } from "react";
import type { ChangeEvent, DragEvent, CSSProperties, ReactNode } from "react";
import { Link, Navigate, useParams } from "react-router-dom";
import { supabase } from "../../../lib/supabase";
import { getAssignmentSubmissionPageData, getTesterAssignmentSubmission, createTesterAssignmentSubmission, getTesterSubmissionAttachments, registerTesterSubmissionAttachment, finalizeTesterAssignmentSubmission } from "../../../features/tester/assignments-api";
import { isTesterWorkflowV2Enabled } from "../../../lib/supabase-v2";
import { useIdentity } from "../../../shared/auth/hooks/useIdentity";
import TesterSidebar, { Icon } from "../components/TesterSidebar";
import "../styles/tester-dashboard.css";
import "../styles/assignment-submission.css";

type AssignmentRow = {
  id: string; status: string; start_date: string | null; completed_at: string | null;
  created_at: string; points_awarded?: number | null;
  test: { id: string; title: string; status: string; start_date: string | null; end_date: string | null; app: { name: string; icon_url: string | null } | null } | null;
};
type EvidenceFile = { file: File; url: string };

async function stableEvidenceFileId(file: File): Promise<string> {
  if (!globalThis.crypto?.subtle) throw new Error("Secure file fingerprinting is unavailable in this browser.");
  const metadata = new TextEncoder().encode(`${file.name}\0${file.type}\0${file.size}\0`);
  const bytes = new Uint8Array(await file.arrayBuffer());
  const input = new Uint8Array(metadata.length + bytes.length);
  input.set(metadata);
  input.set(bytes, metadata.length);
  const digest = new Uint8Array(await crypto.subtle.digest("SHA-256", input));
  // Derive a stable UUID-shaped key from the SHA-256 digest (version 5 / RFC variant).
  digest[6] = (digest[6] & 0x0f) | 0x50;
  digest[8] = (digest[8] & 0x3f) | 0x80;
  const hex = Array.from(digest.slice(0, 16), value => value.toString(16).padStart(2, "0")).join("");
  return `${hex.slice(0,8)}-${hex.slice(8,12)}-${hex.slice(12,16)}-${hex.slice(16,20)}-${hex.slice(20)}`;
}

function dateTime(value: string | null) {
  if (!value) return "Not submitted";
  return new Date(value).toLocaleString(undefined, { month: "short", day: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" });
}
function algeriaDate(value: string | Date) {
  if (typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value)) return value;
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Africa/Algiers", year: "numeric", month: "2-digit", day: "2-digit",
  }).formatToParts(new Date(value));
  const part = (type: string) => parts.find(item => item.type === type)?.value || "";
  return `${part("year")}-${part("month")}-${part("day")}`;
}
function nextCalendarDate(value: string) {
  const date = new Date(`${value}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + 1);
  return date.toISOString().slice(0, 10);
}
function Step({ n, children }: { n: number; children: ReactNode }) {
  return <h3 className="as-step-title"><span>{n}</span>{children}</h3>;
}
function GaugeIcon() {
  return <svg viewBox="0 0 64 64" aria-hidden="true"><path d="M9 43a23 23 0 0 1 46 0M32 20v5m-16 2 4 4m28-4-4 4M32 43l14-13" fill="none" stroke="currentColor" strokeWidth="5" strokeLinecap="round"/><circle cx="32" cy="43" r="4" fill="currentColor"/></svg>;
}

export default function AssignmentSubmissionPage() {
  const { id = "" } = useParams();
  const { session, roles = [] } = useIdentity();
  const [assignment, setAssignment] = useState<AssignmentRow | null>(null);
  const [checkins, setCheckins] = useState<{ id: string; checkin_date: string }[]>([]);
  const [feedbackCount, setFeedbackCount] = useState(0);
  const [feedbackQuality, setFeedbackQuality] = useState<{ quality_status: string; reviewed_at: string | null; reviewed_by: string | null } | null>(null);
  const [medicalExceptions, setMedicalExceptions] = useState<{ status: string; requested_dates: string[] }[]>([]);
  const [submissionStatus, setSubmissionStatus] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [report, setReport] = useState("");
  const [comments, setComments] = useState("");
  const [evidence, setEvidence] = useState<EvidenceFile[]>([]);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [notice, setNotice] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [workspaceMenuOpen, setWorkspaceMenuOpen] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const evidenceRef = useRef<EvidenceFile[]>([]);
  const previewMode = import.meta.env.DEV && new URLSearchParams(window.location.search).get("preview") === "1";
  const name = session?.user?.user_metadata?.display_name || session?.user?.email?.split("@")[0] || "Tester";
  const firstName = name.split(/\s+/)[0];
  const isAdmin = roles.includes("admin"), isDeveloper = roles.includes("developer");

  useEffect(() => {
    if (previewMode) {
      setAssignment({
        id: "preview-assignment", status: "active", start_date: "2026-11-07",
        completed_at: null, created_at: "2026-11-07T09:00:00Z", points_awarded: 75,
        test: { id: "preview-test", title: "Performance Testing", status: "running", start_date: "2026-11-07", end_date: "2026-11-14", app: { name: "PlayStore App", icon_url: null } }
      });
      setCheckins([{ id: "1", checkin_date: "2026-11-07" }, { id: "2", checkin_date: "2026-11-08" }]);
      setFeedbackCount(1);
      setFeedbackQuality({ quality_status: "pending", reviewed_at: null, reviewed_by: null });
      setMedicalExceptions([]);
      setSubmissionStatus(null);
      setLoading(false); return;
    }
    if (!session?.user?.id || !id) { setLoading(false); return; }
    let alive = true;
    (async () => {
      const client = supabase;
      if (!client) { if (alive) { setLoadError("The database connection is unavailable."); setLoading(false); } return; }
      const result = await getAssignmentSubmissionPageData(id, session.user.id);
      if (!alive) return;
      if (result.error && !result.assignment) setLoadError(result.error);
      else if (result.assignment) setAssignment(result.assignment as AssignmentRow);
      setCheckins(result.checkins || []);
      setFeedbackCount(result.feedbackCount || 0);
      setFeedbackQuality(result.feedback || null);
      setMedicalExceptions(result.medicalExceptions || []);
      setSubmissionStatus(result.submission?.status || null);
      if (result.error) setLoadError(result.error);
      setLoading(false);
    })().catch(() => {
      if (alive) { setLoadError("Unable to load assignment details."); setLoading(false); }
    });
    return () => { alive = false; };
  }, [id, session?.user?.id, previewMode]);

  const todayInAlgeria = algeriaDate(new Date());
  const startDateInAlgeria = assignment?.start_date ? algeriaDate(assignment.start_date) : "";
  const approvedMedicalDates = new Set(medicalExceptions.filter(item => item.status === "approved").flatMap(item => item.requested_dates || []));
  const pendingMedicalException = medicalExceptions.some(item => item.status === "pending");
  const checkedInDates = new Set(checkins.map(item => item.checkin_date));
  const requiredDates: string[] = [];
  if (startDateInAlgeria && startDateInAlgeria <= todayInAlgeria) {
    for (let day = startDateInAlgeria; day <= todayInAlgeria && requiredDates.length < 14; day = nextCalendarDate(day)) {
      if (!approvedMedicalDates.has(day)) requiredDates.push(day);
    }
  }
  const completedRequiredDays = requiredDates.filter(day => checkedInDates.has(day)).length;
  const checkinsReady = requiredDates.length === 14 && completedRequiredDays === 14;
  const feedbackAccepted = feedbackQuality?.quality_status === "accepted" && Boolean(feedbackQuality.reviewed_at) && Boolean(feedbackQuality.reviewed_by);
  const reportReady = report.trim().length >= 20;
  const reviewPrerequisitesReady = checkinsReady && feedbackAccepted && !pendingMedicalException && reportReady;
  const progress = assignment?.status === "completed" ? 100 : Math.min(100, Math.round(((completedRequiredDays / 14) * 70) + (feedbackAccepted ? 20 : 0) + (reportReady ? 10 : 0)));
  const points = assignment?.points_awarded ?? null;
  const draftKey = `testdz:assignment-submission:${session?.user?.id || "preview"}:${id}`;
  const appName = assignment?.test?.app?.name || "Assigned app";
  const dateRange = assignment?.test?.start_date && assignment?.test?.end_date
    ? `${new Date(assignment.test.start_date + "T00:00:00").toLocaleDateString(undefined, { month: "short", day: "2-digit" })} – ${new Date(assignment.test.end_date + "T00:00:00").toLocaleDateString(undefined, { month: "short", day: "2-digit", year: "numeric" })}`
    : "Dates not set";
  const completedLabel = assignment?.status === "completed" ? "Completed" : assignment?.status === "active" ? "Active" : assignment?.status || "Pending";
  const canSubmit = assignment?.status === "active" && submissionStatus !== "submitted" && submissionStatus !== "approved";
  const checklist = [
    { label: "14 required check-in days", done: checkinsReady },
    { label: "Feedback quality accepted by Admin", done: feedbackAccepted },
    { label: "No pending medical exception", done: !pendingMedicalException },
    { label: "Final report has at least 20 characters", done: reportReady },
  ];
  const totalSize = useMemo(() => evidence.reduce((sum, item) => sum + item.file.size, 0), [evidence]);
  const handleFinalSubmit = async () => {
    if (!isTesterWorkflowV2Enabled || !supabase || !session?.user?.id || !assignment) {
      setNotice("Secure final submission is not enabled in this environment yet.");
      return;
    }
    if (report.trim().length < 20) {
      setNotice("Please provide at least 20 characters in your test results report.");
      return;
    }
    if (submitting) return;
    setSubmitting(true);
    setNotice("");
    try {
      const existing = await getTesterAssignmentSubmission(id);
      if (existing.error) throw existing.error;
      if (existing.data?.status === "submitted") {
        setSubmissionStatus("submitted");
        setNotice("Your final report is already awaiting developer review.");
        return;
      }

      const created = await createTesterAssignmentSubmission(id, report.trim(), comments.trim() || null);
      if (created.error || !created.data) throw created.error || new Error("Could not save the submission draft.");
      const submissionId = created.data as string;

      const prior = await getTesterSubmissionAttachments(submissionId);
      if (prior.error) throw prior.error;
      const registered = (prior.data || []) as unknown as {
        file_id: string; original_filename: string; mime_type: string; size_bytes: number; storage_path: string;
      }[];

      for (const item of evidence) {
        const file = item.file;
        const extension = file.name.split(".").pop()?.toLowerCase() || "";
        // Match retries by the actual file bytes plus metadata, never by name/size/MIME alone.
        const fileId = await stableEvidenceFileId(file);
        const priorFile = registered.find(row => row.file_id === fileId);
        let storagePath = priorFile?.storage_path;
        if (storagePath) {
          const existingObject = await supabase.storage.from("test-evidence").createSignedUrl(storagePath, 60);
          if (!existingObject.error) continue;
        } else {
          const registeredFile = await registerTesterSubmissionAttachment({
            submissionId, fileId, extension, originalFilename: file.name,
            mimeType: file.type, sizeBytes: file.size
          });
          if (registeredFile.error || !registeredFile.data) throw registeredFile.error || new Error("Could not register an evidence file.");
          storagePath = registeredFile.data as string;
          registered.push({ file_id: fileId, original_filename: file.name, mime_type: file.type, size_bytes: file.size, storage_path: storagePath });
        }
        const uploaded = await supabase.storage.from("test-evidence").upload(storagePath, file, {
          contentType: file.type, upsert: false
        });
        if (uploaded.error) throw uploaded.error;
      }

      const finalized = await finalizeTesterAssignmentSubmission(submissionId);
      if (finalized.error || !finalized.data) throw finalized.error || new Error("Could not finalize the submission.");
      window.localStorage.removeItem(draftKey);
      evidence.forEach(item => URL.revokeObjectURL(item.url));
      setEvidence([]);
      setSubmissionStatus("submitted");
      setNotice("Your final report and evidence were submitted successfully and are awaiting developer review.");
    } catch {
      setNotice("Submission could not be completed. Your draft and uploaded evidence remain available; check your connection and try again.");
    } finally {
      setSubmitting(false);
    }
  };


  const addFiles = (files: FileList | File[]) => {
    const incoming = Array.from(files);
    let skipped = 0;
    const next = [...evidence];
    for (const file of incoming) {
      const supported = /^(image\/(png|jpeg|webp)|application\/pdf)$/.test(file.type);
      const duplicate = next.some(item => item.file.name === file.name && item.file.size === file.size);
      if (!supported || file.size > 10 * 1024 * 1024 || duplicate || next.length >= 5) { skipped++; continue; }
      next.push({ file, url: URL.createObjectURL(file) });
    }
    setEvidence(next);
    setNotice(skipped ? "Some files were skipped: use up to 5 unique PNG, JPG, WebP or PDF files (10 MB max each)." : "");
  };
  const removeFile = (index: number) => {
    const removed = evidence[index];
    if (removed) URL.revokeObjectURL(removed.url);
    setEvidence(evidence.filter((_, i) => i !== index));
  };
  const onFileChange = (event: ChangeEvent<HTMLInputElement>) => {
    if (event.target.files) addFiles(event.target.files);
    event.target.value = "";
  };
  const onDrop = (event: DragEvent<HTMLDivElement>) => { event.preventDefault(); setIsDragging(false); if (event.dataTransfer.files) addFiles(event.dataTransfer.files); };

  useEffect(() => { evidenceRef.current = evidence; }, [evidence]);
  useEffect(() => {
    if (previewMode || !id || !session?.user?.id) return;
    try {
      const raw = window.localStorage.getItem(draftKey);
      if (!raw) return;
      const draft = JSON.parse(raw) as { report?: unknown; comments?: unknown };
      if (typeof draft.report === "string") setReport(draft.report);
      if (typeof draft.comments === "string") setComments(draft.comments);
    } catch {
      setNotice("A saved draft could not be restored. You can continue and save a new draft.");
    }
  }, [draftKey, id, previewMode, session?.user?.id]);
  useEffect(() => () => { evidenceRef.current.forEach(item => URL.revokeObjectURL(item.url)); }, []);
  useEffect(() => { if (!previewOpen) return; const close = (event: KeyboardEvent) => { if (event.key === "Escape") setPreviewOpen(false); }; window.addEventListener("keydown", close); return () => window.removeEventListener("keydown", close); }, [previewOpen]);

  if (!previewMode && !session) return <Navigate to="/auth" replace />;
  if (!previewMode && !roles.includes("tester") && !loading) return <Navigate to="/dashboard" replace />;

  return <div className="td-dashboard as-dashboard">
    <TesterSidebar nav={[
      { label: "Dashboard", icon: "home", href: "/tester-dashboard" },
      { label: "Discover Tests", icon: "search", href: "/discover-tests" },
      { label: "My Tests", icon: "tests", href: "/my-tests", active: true },
      { label: "Rewards", icon: "gift", href: "/wallet-rewards" },
      { label: "Wallet", icon: "wallet", href: "/wallet-rewards" },
      { label: "Profile", icon: "user", href: "/profile" },
      { label: "Help & Support", icon: "headset", href: "/help-support" },
      { label: "Feedback", icon: "star", href: "/feedback-history" },
      { label: "Settings", icon: "settings", href: "/settings" }
    ]} name={name} firstName={firstName} avatar="" roles={roles} isAdmin={isAdmin} isDeveloper={isDeveloper} workspaceMenuOpen={workspaceMenuOpen} setWorkspaceMenuOpen={setWorkspaceMenuOpen} previewMode={previewMode}/>
    <main className="td-main as-main">
      <header className="td-topbar as-topbar">
        <label className="td-search"><Icon name="search" size={21}/><input placeholder="Search tests..." aria-label="Search tests"/></label>
        <div className="td-top-actions"><Link to="/notifications" className="td-notification" aria-label="Notifications"><Icon name="bell" size={22}/><i>3</i></Link><span className="td-top-divider"/><Link to="/profile" className="td-profile-short"><span>{firstName.slice(0, 2).toUpperCase()}</span><strong>{name}</strong><b>⌄</b></Link></div>
      </header>
      <div className="as-content">
        <Link to={`/assignments/${id}`} className="as-back"><span>←</span> Back to Assignment Details</Link>
        <section className="as-hero">
          <div className="as-hero-icon"><GaugeIcon/></div>
          <div className="as-hero-copy"><div className="as-title-line"><h1>{assignment?.test?.title || "Performance Testing"}</h1><span className={`as-status ${assignment?.status === "completed" ? "done" : "live"}`}><i/>{completedLabel}</span></div><p>Test the app performance under different conditions.</p><div className="as-meta"><span><Icon name="smartphone" size={16}/>{appName}</span><span><Icon name="calendar" size={16}/>{dateRange}</span><span><Icon name="star" size={16}/>{points===null?"Reward not available":"+"+points+" Points"}</span></div></div>
          <div className="as-hero-art" aria-hidden="true"><div className="as-art-phone"><GaugeIcon/><span>✓</span></div><i/><b/></div>
        </section>

        {loading ? <div className="as-state"><span className="as-spinner"/> Loading assignment details…</div> : loadError ? <div className="as-state as-error">{loadError}<Link to="/my-tests">Return to My Tests</Link></div> : assignment ? <>
          <div className="as-layout">
            <section className="as-form-card">
              <h2 className="as-card-heading"><Icon name="check" size={24}/>Submission Form</h2>
              <div className="as-section"><Step n={1}>Your Results Summary</Step><div className="as-summary">
                <div><Icon name="chart" size={28}/><span>Required Days Completed</span><strong>{completedRequiredDays}<small> / 14</small></strong></div>
                <div><Icon name="receipt" size={28}/><span>Feedback Quality</span><strong className="as-status-text">{feedbackQuality?.quality_status || (feedbackCount ? "Pending review" : "Not submitted")}</strong></div>
                <div><Icon name="clock" size={28}/><span>Assignment Status</span><strong className="as-status-text">{completedLabel}</strong></div>
                <div><Icon name="star" size={28}/><span>Points Awarded</span><strong className="as-points">{points===null?"Not available":"+"+points}</strong></div>
              </div></div>
              <div className="as-section"><Step n={2}>Test Results Report</Step><textarea className="as-comments as-report" maxLength={2000} value={report} onChange={event => setReport(event.target.value)} placeholder="Summarize what you tested, the results, issues found, and the overall outcome..." aria-label="Test results report"/><div className="as-char-count">{report.length} / 2000</div></div>
              <div className="as-section"><Step n={3}>Upload Evidence</Step>
                <div className="as-upload-row">
                  <div className={`as-dropzone ${isDragging ? "is-dragging" : ""}`} onDragOver={event => { event.preventDefault(); setIsDragging(true); }} onDragLeave={event => { if (!event.currentTarget.contains(event.relatedTarget as Node)) setIsDragging(false); }} onDrop={onDrop} onClick={() => fileRef.current?.click()} role="button" tabIndex={0} onKeyDown={event => { if (event.key === "Enter" || event.key === " ") fileRef.current?.click(); }}>
                    <svg viewBox="0 0 48 48" aria-hidden="true"><path d="M24 32V8m0 0L14 18M24 8l10 10M8 29v8a4 4 0 0 0 4 4h24a4 4 0 0 0 4-4v-8" fill="none" stroke="currentColor" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
                    <strong>{isDragging ? "Drop your evidence here" : "Drag & drop screenshots or files here"}</strong><span>PNG, JPG, WebP or PDF · up to 10 MB each · maximum 5 files</span>
                    <input ref={fileRef} type="file" accept="image/png,image/jpeg,image/webp,application/pdf" multiple hidden onChange={onFileChange}/>
                  </div>
                  {evidence.length > 0 && <div className="as-evidence-list">{evidence.map((item, index) => <div className="as-evidence-item" key={item.file.name + index}>{item.file.type.startsWith("image/") ? <img src={item.url} alt={item.file.name}/> : <div className="as-pdf">PDF</div>}<span title={item.file.name}>{item.file.name}</span><button type="button" aria-label={`Remove ${item.file.name}`} onClick={() => removeFile(index)}>×</button></div>)}</div>}
                </div>
                <small className="as-upload-note">{evidence.length}/5 files · {(totalSize / (1024 * 1024)).toFixed(1)} MB selected</small>
              </div>
              <div className="as-section"><Step n={4}>Additional Comments <small>(Optional)</small></Step><textarea className="as-comments" maxLength={500} value={comments} onChange={event => setComments(event.target.value)} placeholder="Add any additional notes about your test..."/><div className="as-char-count">{comments.length} / 500</div></div>
              {notice && <p className="as-notice" role="status" aria-live="polite">{notice}</p>}
              <div className="as-form-footer"><div className="as-guidance"><Icon name="info" size={20}/><div><p>✓ All 14 required days and accepted feedback are checked against the workflow rules.</p><p>✓ Evidence is optional; any uploaded files are verified securely before finalization.</p></div></div><div className="as-actions"><button type="button" className="as-preview-btn" onClick={() => { if (previewMode || !session?.user?.id) { setNotice("Draft saving is unavailable in preview mode."); return; } try { window.localStorage.setItem(draftKey, JSON.stringify({ report, comments, savedAt: new Date().toISOString() })); setNotice("Draft saved on this device. Attached files are not saved and must be selected again."); } catch { setNotice("Could not save the draft on this device. Check available browser storage."); } }}><Icon name="file" size={19}/>Save as Draft</button><button type="button" className="as-submit-btn" disabled={!canSubmit || (isTesterWorkflowV2Enabled && (!reviewPrerequisitesReady || submitting)) || (!isTesterWorkflowV2Enabled && !report.trim())} onClick={() => { if (isTesterWorkflowV2Enabled) void handleFinalSubmit(); else setNotice("Your report is ready, but secure final submission is not enabled in this environment. No report or files have been sent."); }}><Icon name="send" size={19}/>{submitting ? "Submitting…" : submissionStatus === "submitted" ? "Awaiting Developer Review" : canSubmit ? "Submit Assignment" : "Submission unavailable"}</button></div></div>
            </section>
            <aside className="as-side">
              <section className="as-side-card as-progress-card"><h2><Icon name="chart" size={22}/>Submission Readiness</h2><div className="as-progress-content"><div className="as-progress-ring" style={{"--progress": progress} as CSSProperties}><strong>{progress}%</strong></div><div className="as-checklist">{checklist.map(item => <span className={item.done ? "is-done" : "is-pending"} key={item.label}><i>{item.done ? "✓" : "·"}</i>{item.label}</span>)}<b><Icon name="trophy" size={22}/> {points===null?"Reward pending":"+"+points+" Points"}</b></div></div></section>
              <section className="as-side-card as-details-card"><h2><Icon name="receipt" size={22}/>Submission Details</h2><div><Icon name="calendar" size={20}/><span>Assignment Started<strong>{dateTime(assignment.start_date)}</strong></span></div><div><Icon name="calendar" size={20}/><span>Last Updated<strong>{dateTime(assignment.completed_at || assignment.created_at)}</strong></span></div><div><Icon name="clock" size={20}/><span>Status<strong className="as-detail-status">{completedLabel}</strong></span></div><div><Icon name="info" size={20}/><span>Assignment ID<strong className="as-id">{assignment.id.slice(0, 13)}…</strong></span></div></section>
              <section className="as-success-card"><span>✓</span><div><strong>{submissionStatus === "submitted" ? "Awaiting developer review" : assignment.status === "completed" ? "Assignment completed" : "You're making progress!"}</strong><p>{submissionStatus === "submitted" ? "Your report was submitted. The assignment remains active until the developer approves it." : assignment.status === "completed" ? "Your assignment has been approved and completed." : pendingMedicalException ? "A medical exception is awaiting Admin review; final submission is paused." : feedbackCount && !feedbackAccepted ? "Your feedback must pass the Admin quality review before final submission." : "Complete the required days, accepted feedback and report before submitting."}</p></div></section>
            </aside>
          </div>
        </> : null}
      </div>
    </main>
    {previewOpen && <div className="as-modal-backdrop" role="presentation" onMouseDown={event => { if (event.target === event.currentTarget) setPreviewOpen(false); }}><section className="as-preview-modal" role="dialog" aria-modal="true" aria-labelledby="as-preview-title"><header><h2 id="as-preview-title">Submission Preview</h2><button type="button" onClick={() => setPreviewOpen(false)} aria-label="Close preview">×</button></header><p><strong>Assignment:</strong> {assignment?.test?.title}</p><p><strong>App:</strong> {appName}</p><p><strong>Assignment ID:</strong> {assignment?.id}</p><p><strong>Check-ins:</strong> {checkins.length} · <strong>Feedback:</strong> {feedbackCount}</p><p><strong>Test Results Report:</strong></p><div className="as-preview-comments">{report || "No report written yet."}</div><p><strong>Evidence:</strong> {evidence.length ? evidence.map(item => item.file.name).join(", ") : "No files attached"}</p><p><strong>Comments:</strong></p><div className="as-preview-comments">{comments || "No additional comments."}</div><footer><button type="button" onClick={() => setPreviewOpen(false)}>Back to form</button></footer></section></div>}
  </div>;
}
