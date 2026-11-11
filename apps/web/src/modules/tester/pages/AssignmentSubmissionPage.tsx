import { useEffect, useMemo, useRef, useState } from "react";
import type { ChangeEvent, DragEvent, CSSProperties, ReactNode } from "react";
import { Link, Navigate, useParams } from "react-router-dom";
import { supabase } from "../../../lib/supabase";
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

function dateTime(value: string | null) {
  if (!value) return "Not submitted";
  return new Date(value).toLocaleString(undefined, { month: "short", day: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" });
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
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [report, setReport] = useState("");
  const [comments, setComments] = useState("");
  const [evidence, setEvidence] = useState<EvidenceFile[]>([]);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [notice, setNotice] = useState("");
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
      setFeedbackCount(1); setLoading(false); return;
    }
    if (!session?.user?.id || !id) { setLoading(false); return; }
    let alive = true;
    (async () => {
      const client = supabase;
      if (!client) { if (alive) { setLoadError("The database connection is unavailable."); setLoading(false); } return; }
      const [a, c, f] = await Promise.all([
        client.from("assignments").select("id,status,start_date,completed_at,created_at,test:tests(id,title,status,start_date,end_date,app:apps(name,icon_url))").eq("id", id).eq("tester_id", session.user.id).maybeSingle(),
        client.from("checkins").select("id,checkin_date").eq("assignment_id", id).eq("tester_id", session.user.id).order("checkin_date", { ascending: true }),
        client.from("feedback").select("id", { count: "exact", head: true }).eq("assignment_id", id).eq("tester_id", session.user.id)
      ]);
      if (!alive) return;
      if (a.error || !a.data) setLoadError(a.error?.message || "This assignment could not be found.");
      else setAssignment(a.data as unknown as AssignmentRow);
      setCheckins(c.data || []); setFeedbackCount(f.count || 0); setLoading(false);
    })();
    return () => { alive = false; };
  }, [id, session?.user?.id, previewMode]);

  const progress = assignment?.status === "completed" ? 100 : Math.min(100, Math.round(((Math.min(checkins.length, 14) / 14) * 70) + (feedbackCount > 0 ? 15 : 0) + (evidence.length > 0 ? 15 : 0)));
  const points = assignment?.points_awarded ?? 0;
  const draftKey = `testdz:assignment-submission:${session?.user?.id || "preview"}:${id}`;
  const appName = assignment?.test?.app?.name || "Assigned app";
  const dateRange = assignment?.test?.start_date && assignment?.test?.end_date
    ? `${new Date(assignment.test.start_date + "T00:00:00").toLocaleDateString(undefined, { month: "short", day: "2-digit" })} – ${new Date(assignment.test.end_date + "T00:00:00").toLocaleDateString(undefined, { month: "short", day: "2-digit", year: "numeric" })}`
    : "Dates not set";
  const completedLabel = assignment?.status === "completed" ? "Completed" : assignment?.status === "active" ? "Active" : assignment?.status || "Pending";
  const canSubmit = assignment?.status === "active";
  const checklist = [
    { label: "14 daily check-ins", done: checkins.length >= 14 },
    { label: "Feedback submitted", done: feedbackCount > 0 },
    { label: "Evidence attached", done: evidence.length > 0 },
    { label: "Assignment ready for review", done: assignment?.status === "completed" },
  ];
  const totalSize = useMemo(() => evidence.reduce((sum, item) => sum + item.file.size, 0), [evidence]);

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
          <div className="as-hero-copy"><div className="as-title-line"><h1>{assignment?.test?.title || "Performance Testing"}</h1><span className={`as-status ${assignment?.status === "completed" ? "done" : "live"}`}><i/>{completedLabel}</span></div><p>Test the app performance under different conditions.</p><div className="as-meta"><span><Icon name="smartphone" size={16}/>{appName}</span><span><Icon name="calendar" size={16}/>{dateRange}</span><span><Icon name="star" size={16}/>+{points || 50} Points</span></div></div>
          <div className="as-hero-art" aria-hidden="true"><div className="as-art-phone"><GaugeIcon/><span>✓</span></div><i/><b/></div>
        </section>

        {loading ? <div className="as-state"><span className="as-spinner"/> Loading assignment details…</div> : loadError ? <div className="as-state as-error">{loadError}<Link to="/my-tests">Return to My Tests</Link></div> : assignment ? <>
          <div className="as-layout">
            <section className="as-form-card">
              <h2 className="as-card-heading"><Icon name="check" size={24}/>Submission Form</h2>
              <div className="as-section"><Step n={1}>Your Results Summary</Step><div className="as-summary">
                <div><Icon name="chart" size={28}/><span>Check-ins Completed</span><strong>{checkins.length}<small> / 14</small></strong></div>
                <div><Icon name="receipt" size={28}/><span>Feedback Submitted</span><strong>{feedbackCount}</strong></div>
                <div><Icon name="clock" size={28}/><span>Assignment Status</span><strong className="as-status-text">{completedLabel}</strong></div>
                <div><Icon name="star" size={28}/><span>Points Awarded</span><strong className="as-points">+{points}</strong></div>
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
              <div className="as-form-footer"><div className="as-guidance"><Icon name="info" size={20}/><div><p>✓ Make sure your assignment requirements are complete.</p><p>✓ Review your results and evidence before sending.</p></div></div><div className="as-actions"><button type="button" className="as-preview-btn" onClick={() => { if (previewMode || !session?.user?.id) { setNotice("Draft saving is unavailable in preview mode."); return; } try { window.localStorage.setItem(draftKey, JSON.stringify({ report, comments, savedAt: new Date().toISOString() })); setNotice("Draft saved on this device. Attached files are not saved and must be selected again."); } catch { setNotice("Could not save the draft on this device. Check available browser storage."); } }}><Icon name="file" size={19}/>Save as Draft</button><button type="button" className="as-submit-btn" disabled={!canSubmit || !report.trim()} onClick={() => setNotice("Your report is ready, but final submission is not connected to the database yet. No report or files have been sent.")}><Icon name="send" size={19}/>{canSubmit ? "Submit Assignment" : "Submission unavailable"}</button></div></div>
            </section>
            <aside className="as-side">
              <section className="as-side-card as-progress-card"><h2><Icon name="chart" size={22}/>Submission Readiness</h2><div className="as-progress-content"><div className="as-progress-ring" style={{"--progress": progress} as CSSProperties}><strong>{progress}%</strong></div><div className="as-checklist">{checklist.map(item => <span className={item.done ? "is-done" : "is-pending"} key={item.label}><i>{item.done ? "✓" : "·"}</i>{item.label}</span>)}<b><Icon name="trophy" size={22}/> +{points} Points</b></div></div></section>
              <section className="as-side-card as-details-card"><h2><Icon name="receipt" size={22}/>Submission Details</h2><div><Icon name="calendar" size={20}/><span>Assignment Started<strong>{dateTime(assignment.start_date)}</strong></span></div><div><Icon name="calendar" size={20}/><span>Last Updated<strong>{dateTime(assignment.completed_at || assignment.created_at)}</strong></span></div><div><Icon name="clock" size={20}/><span>Status<strong className="as-detail-status">{completedLabel}</strong></span></div><div><Icon name="info" size={20}/><span>Assignment ID<strong className="as-id">{assignment.id.slice(0, 13)}…</strong></span></div></section>
              <section className="as-success-card"><span>✓</span><div><strong>{assignment.status === "completed" ? "Assignment completed" : "You're making progress!"}</strong><p>{assignment.status === "completed" ? "Your assignment is marked as completed." : "Keep your evidence and comments ready before final submission."}</p></div></section>
            </aside>
          </div>
        </> : null}
      </div>
    </main>
    {previewOpen && <div className="as-modal-backdrop" role="presentation" onMouseDown={event => { if (event.target === event.currentTarget) setPreviewOpen(false); }}><section className="as-preview-modal" role="dialog" aria-modal="true" aria-labelledby="as-preview-title"><header><h2 id="as-preview-title">Submission Preview</h2><button type="button" onClick={() => setPreviewOpen(false)} aria-label="Close preview">×</button></header><p><strong>Assignment:</strong> {assignment?.test?.title}</p><p><strong>App:</strong> {appName}</p><p><strong>Assignment ID:</strong> {assignment?.id}</p><p><strong>Check-ins:</strong> {checkins.length} · <strong>Feedback:</strong> {feedbackCount}</p><p><strong>Test Results Report:</strong></p><div className="as-preview-comments">{report || "No report written yet."}</div><p><strong>Evidence:</strong> {evidence.length ? evidence.map(item => item.file.name).join(", ") : "No files attached"}</p><p><strong>Comments:</strong></p><div className="as-preview-comments">{comments || "No additional comments."}</div><footer><button type="button" onClick={() => setPreviewOpen(false)}>Back to form</button></footer></section></div>}
  </div>;
}
