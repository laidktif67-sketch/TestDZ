import { useEffect, useRef, useState } from "react";
import type { FormEvent } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { useIdentity } from "../../../shared/auth/hooks/useIdentity";
import { isTesterWorkflowV2Enabled } from "../../../lib/supabase-v2";
import { getTesterFeedbackForAssignment, reviseTesterFeedback, submitTesterFeedback } from "../../../features/tester/feedback-api";
import TesterSidebar, { Icon } from "../components/TesterSidebar";
import "../styles/tester-dashboard.css";
import "../styles/submit-feedback.css";

type FeedbackType = "Bug" | "UI Issue" | "Suggestion";
type Severity = "Critical" | "High" | "Medium" | "Low";

const feedbackTypes: { value: FeedbackType; icon: "bug" | "palette" | "lightbulb" }[] = [
  { value: "Bug", icon: "bug" },
  { value: "UI Issue", icon: "palette" },
  { value: "Suggestion", icon: "lightbulb" }
];

function FeedbackBannerArt() {
  return <svg className="sf-banner-art" viewBox="0 0 500 190" role="img" aria-label="Feedback illustration">
    <circle cx="274" cy="106" r="104" fill="#dcecff" opacity=".8"/>
    <circle cx="370" cy="32" r="12" fill="#b8d9ff"/>
    <path d="M190 175c22-47 58-70 111-70 64 0 107 26 133 70" fill="#c7e1ff" opacity=".72"/>
    <rect x="264" y="12" width="150" height="171" rx="17" transform="rotate(7 264 12)" fill="#0758d8"/>
    <rect x="274" y="23" width="130" height="149" rx="10" transform="rotate(7 274 23)" fill="#fff"/>
    <g transform="rotate(7 340 95)" fill="none" stroke="#c9ddf7" strokeWidth="5" strokeLinecap="round">
      <circle cx="302" cy="62" r="9"/><path d="M322 58h53M322 70h38"/>
      <circle cx="302" cy="101" r="9"/><path d="M322 97h53M322 109h38"/>
      <circle cx="302" cy="140" r="9"/><path d="M322 136h53M322 148h38"/>
    </g>
    <path d="M108 74h82a12 12 0 0 1 12 12v35a12 12 0 0 1-12 12h-31l-19 17v-17h-32a12 12 0 0 1-12-12V86a12 12 0 0 1 12-12Z" fill="#0788ee"/>
    <path d="M126 94h49M126 107h36" stroke="#fff" strokeWidth="6" strokeLinecap="round" opacity=".9"/>
    <path d="m392 86 45-24 17 39-46 24-16-39Z" fill="#0878ed"/>
    <path d="m393 87-25-15 9 55 18-4" fill="#0755c9"/>
    <path d="m452 98 24 1m-17-31 18-14m-17 69 18 14" stroke="#0878ed" strokeWidth="7" strokeLinecap="round"/>
    <path d="M427 126 447 170" stroke="#0755c9" strokeWidth="8" strokeLinecap="round"/>
    <circle cx="73" cy="42" r="10" fill="#b7d8ff"/><path d="m57 143 7 7 7-7m-7-7v14" stroke="#80b7f6" strokeWidth="3" fill="none"/>
  </svg>;
}

function FeedbackIcon({ name }: { name: "bug" | "palette" | "lightbulb" }) {
  if (name === "bug") return <svg viewBox="0 0 32 32" aria-hidden="true"><path d="M11 10 8 6m13 4 3-4M7 14H3m26 0h-4M7 21H3m26 0h-4M11 25l-3 3m13-3 3 3" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round"/><rect x="9" y="9" width="14" height="17" rx="7" fill="none" stroke="currentColor" strokeWidth="2.4"/><path d="M11 8a5 5 0 0 1 10 0M16 12v12" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round"/></svg>;
  if (name === "palette") return <svg viewBox="0 0 32 32" aria-hidden="true"><path d="M16 3C8.8 3 3 8.6 3 15.5 3 22 8 27 14 27h2.5c2 0 3-2.3 1.8-3.9-1.2-1.6-.1-3.8 1.9-3.8h2.1c4 0 7-3.2 7-7.2C29.3 7.3 23.3 3 16 3Z" fill="currentColor"/><g fill="#fff"><circle cx="10" cy="12" r="2"/><circle cx="16" cy="8.5" r="2"/><circle cx="22" cy="12" r="2"/></g></svg>;
  return <svg viewBox="0 0 32 32" aria-hidden="true"><path d="M16 3a10 10 0 0 0-6.2 17.8c1.1.9 1.7 2.1 1.7 3.2h9c0-1.1.6-2.3 1.7-3.2A10 10 0 0 0 16 3Z" fill="none" stroke="currentColor" strokeWidth="2.6"/><path d="M12 28h8m-7-4h6" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round"/></svg>;
}

export default function SubmitFeedbackPage() {
  const { session, roles = [] } = useIdentity();
  const [searchParams] = useSearchParams();
  const assignmentId = searchParams.get("assignmentId") || "";
  const [workspaceMenuOpen, setWorkspaceMenuOpen] = useState(false);
  const [feedbackType, setFeedbackType] = useState<FeedbackType>("Bug");
  const [title, setTitle] = useState("");
  const [severity, setSeverity] = useState<Severity | "">("");
  const [severityOpen, setSeverityOpen] = useState(false);
  const [description, setDescription] = useState("");
  const [steps, setSteps] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const [message, setMessage] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [feedbackLoading, setFeedbackLoading] = useState(false);
  const [feedbackQualityStatus, setFeedbackQualityStatus] = useState<"pending" | "accepted" | "rejected" | null>(null);
  const isRevision = feedbackQualityStatus === "rejected";
  const feedbackLocked = feedbackQualityStatus === "pending" || feedbackQualityStatus === "accepted";
  const fileInput = useRef<HTMLInputElement>(null);
  const name = session?.user?.user_metadata?.display_name || session?.user?.email?.split("@")[0] || "Tester";
  const firstName = name.split(/\s+/)[0];
  const isAdmin = roles.includes("admin");
  const isDeveloper = roles.includes("developer");
  const nav = [
    { label: "Dashboard", icon: "home", href: "/tester-dashboard" },
    { label: "Discover Tests", icon: "search", href: "/discover-tests" },
    { label: "My Tests", icon: "tests", href: "/my-tests" },
    { label: "Rewards", icon: "gift", href: "/wallet-rewards" },
    { label: "Wallet", icon: "wallet", href: "/wallet-rewards" },
    { label: "Profile", icon: "user", href: "/profile" },
    { label: "Help & Support", icon: "headset", href: "/help-support" },
    { label: "Settings", icon: "settings", href: "/settings" },
    ...(isDeveloper ? [{ label: "Developer Dashboard", icon: "code", href: "/developer-dashboard" }] : []),
    ...(isAdmin ? [{ label: "Admin", icon: "shield", href: "/admin" }] : [])
  ];

  useEffect(() => {
    // Reset assignment-scoped state before loading another assignment. Without
    // this, a previous assignment's rejected/pending state can leak into the
    // next form and select the wrong RPC path.
    setFeedbackQualityStatus(null);
    setTitle("");
    setSeverity("");
    setDescription("");
    setSteps("");
    setFeedbackType("Bug");
    setMessage("");
    setFeedbackLoading(false);
    if (!isTesterWorkflowV2Enabled || !session?.user?.id || !assignmentId) return;
    let active = true;
    setFeedbackLoading(true);
    getTesterFeedbackForAssignment(assignmentId, session.user.id).then((result: { data: { category: string; body: string; quality_status: "pending" | "accepted" | "rejected" } | null; error: { message: string } | null }) => {
      if (!active) return;
      if (result.error) {
        setMessage("The current feedback quality status could not be checked. Refresh before submitting.");
        return;
      }
      const existing = result.data as { category: string; body: string; quality_status: "pending" | "accepted" | "rejected" } | null;
      if (!existing) return;
      setFeedbackQualityStatus(existing.quality_status);
      if (existing.quality_status === "rejected") {
        const titleMatch = existing.body.match(/(?:^|\n\n)Title: ([^\n]*)/);
        const severityMatch = existing.body.match(/(?:^|\n\n)Severity: ([^\n]*)/);
        const descriptionMatch = existing.body.match(/(?:^|\n\n)Description: ([\s\S]*?)(?:\n\nSteps to reproduce: |$)/);
        const stepsMatch = existing.body.match(/(?:^|\n\n)Steps to reproduce: ([\s\S]*)$/);
        setTitle(titleMatch?.[1] || "Feedback revision");
        setSeverity((["Critical", "High", "Medium", "Low"].includes(severityMatch?.[1] || "") ? severityMatch?.[1] : "Medium") as Severity);
        setDescription(descriptionMatch?.[1] || existing.body);
        setSteps(stepsMatch?.[1] || "");
        setFeedbackType(existing.category === "bug" ? "Bug" : existing.category === "usability" ? "UI Issue" : "Suggestion");
        setMessage("Admin rejected the previous feedback quality review. Update the details below and resubmit for review.");
      } else if (existing.quality_status === "pending") {
        setMessage("Your feedback is awaiting Admin quality review. You can revise it only if Admin rejects it.");
      } else {
        setMessage("Your feedback quality was accepted. No further revision is available for this assignment.");
      }
    }).catch(() => {
      if (active) setMessage("The current feedback quality status could not be loaded.");
    }).finally(() => {
      if (active) setFeedbackLoading(false);
    });
    return () => { active = false; };
  }, [assignmentId, session?.user?.id]);

  const addFiles = (incoming: FileList | File[]) => {
    const accepted = Array.from(incoming).filter(file => /image\/(png|jpeg|webp)/.test(file.type) && file.size <= 5 * 1024 * 1024);
    setFiles(current => [...current, ...accepted].slice(0, 5));
  };

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!isTesterWorkflowV2Enabled) {
      setMessage("Secure feedback submission is not enabled in this environment yet.");
      return;
    }
    if (!session?.user?.id || !assignmentId) {
      setMessage("Open this form from an active assignment to attach your feedback to the correct test.");
      return;
    }
    if (submitting || feedbackLoading || feedbackLocked) return;
    setSubmitting(true);
    setMessage("");
    const category = feedbackType === "Bug" ? "bug" : feedbackType === "UI Issue" ? "usability" : "general";
    const body = [
      "Title: " + title.trim(),
      "Severity: " + severity,
      "Description: " + description.trim(),
      steps.trim() ? "Steps to reproduce: " + steps.trim() : ""
    ].filter(Boolean).join("\n\n");
    try {
      const result = isRevision
        ? await reviseTesterFeedback({ assignmentId, category, body })
        : await submitTesterFeedback({ assignmentId, category, body });
      if (result.error) {
        setMessage("Your feedback could not be submitted. Check that the assignment is active or completed, then try again.");
      } else {
        setFeedbackQualityStatus("pending");
        setMessage(isRevision ? "Your revised feedback has been resubmitted and is awaiting Admin quality review." : "Your feedback has been submitted and is awaiting Admin quality review.");
        if (!isRevision) { setTitle(""); setSeverity(""); setDescription(""); setSteps(""); setFiles([]); }
      }
    } catch {
      setMessage("A network error prevented feedback submission. Your form is still available; check your connection and try again.");
    } finally {
      setSubmitting(false);
    }
  };

  return <div className="td-dashboard sf-dashboard">
    <TesterSidebar nav={nav} name={name} firstName={firstName} avatar="" roles={roles} isAdmin={isAdmin} isDeveloper={isDeveloper} workspaceMenuOpen={workspaceMenuOpen} setWorkspaceMenuOpen={setWorkspaceMenuOpen} previewMode={false}/>
    <main className="td-main sf-main">
      <header className="td-topbar sf-topbar">
        <label className="td-search sf-search"><Icon name="search" size={21}/><input aria-label="Search tests" placeholder="Search tests..."/></label>
        <div className="td-top-actions">
          <button className="td-notification" type="button" aria-label="Notifications"><Icon name="bell" size={22}/><i>3</i></button>
          <span className="td-top-divider"/>
          <Link to="/profile" className="td-profile-short"><span>{firstName.slice(0,2).toUpperCase()}</span><strong>{name}</strong><b>⌄</b></Link>
        </div>
      </header>

      <div className="sf-content">
        <section className="sf-hero">
          <Link to="/tester-dashboard" className="sf-back"><span aria-hidden="true">←</span> Back to Dashboard</Link>
          <div className="sf-hero-icon"><svg viewBox="0 0 64 64" aria-hidden="true"><path d="M32 8C17.6 8 6 18 6 30.4c0 8.1 4.8 15.2 12.1 19.1L16 59l13.2-5.5c1 .1 1.9.2 2.8.2 14.4 0 26-10 26-23.3S46.4 8 32 8Z" fill="white"/><g fill="#0877ed"><circle cx="20" cy="31" r="3.8"/><circle cx="32" cy="31" r="3.8"/><circle cx="44" cy="31" r="3.8"/></g></svg></div>
          <div className="sf-hero-copy"><h1>Submit Feedback</h1><p>Share your experience, report issues, or suggest improvements.</p></div>
          <FeedbackBannerArt/>
        </section>

        <form className="sf-form-card" onSubmit={submit}>
          {feedbackLoading && <p className="sf-submit-message" role="status">Checking existing feedback status…</p>}
          {feedbackQualityStatus === "pending" && <p className="sf-submit-message" role="status">Feedback is pending Admin quality review. Further edits are locked until a rejection decision.</p>}
          {feedbackQualityStatus === "accepted" && <p className="sf-submit-message" role="status">Feedback quality accepted. This assignment has met the feedback-quality requirement.</p>}
          {feedbackQualityStatus === "rejected" && <p className="sf-submit-message" role="status">Feedback quality was rejected. Correct the feedback below and resubmit it for Admin review.</p>}
          <section className="sf-type-field">
            <h2><span>1.</span> Feedback Type <em>*</em></h2>
            <div className="sf-type-options">
              {feedbackTypes.map(type => <button key={type.value} type="button" className={feedbackType === type.value ? "sf-type-option selected" : "sf-type-option"} onClick={() => setFeedbackType(type.value)} aria-pressed={feedbackType === type.value}>
                <FeedbackIcon name={type.icon}/><span>{type.value}</span><i>{feedbackType === type.value ? "✓" : ""}</i>
              </button>)}
            </div>
          </section>

          <div className="sf-two-columns">
            <label className="sf-field sf-title-field"><span><b>2.</b> Issue Title <em>*</em></span><input required maxLength={100} value={title} onChange={event => setTitle(event.target.value)} placeholder="Enter a short title for your feedback..."/><small className="sf-counter">{title.length} / 100</small></label>
            <div className="sf-field sf-severity-field">
              <span><b>3.</b> Severity <em>*</em></span>
              <div className="sf-severity-picker" onBlur={event => { if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setSeverityOpen(false); }}>
                <button type="button" className={`sf-severity-trigger ${severity ? "has-value" : ""} ${severityOpen ? "is-open" : ""}`} aria-haspopup="listbox" aria-expanded={severityOpen} onClick={() => setSeverityOpen(open => !open)}>
                  <span className={`sf-severity-symbol ${severity ? `severity-${severity.toLowerCase()}` : ""}`}>{severity ? "!" : "!"}</span>
                  <span className="sf-severity-value">{severity || "Select severity level"}{severity && <small>{severity === "Critical" ? "Blocks the test or causes data loss" : severity === "High" ? "Major feature is not working" : severity === "Medium" ? "Feature issue with a workaround" : "Minor issue or visual detail"}</small>}</span>
                  <svg className="sf-severity-arrow" viewBox="0 0 20 20" aria-hidden="true"><path d="m5 7 5 5 5-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
                </button>
                {severityOpen && <div className="sf-severity-menu" role="listbox" aria-label="Select severity level">
                  {([
                    ["Critical","Blocks the test or causes data loss"],
                    ["High","Major feature is not working"],
                    ["Medium","Feature issue with a workaround"],
                    ["Low","Minor issue or visual detail"]
                  ] as [Severity,string][]).map(([value,detail]) => <button type="button" role="option" aria-selected={severity === value} key={value} className={`sf-severity-option severity-${value.toLowerCase()} ${severity === value ? "selected" : ""}`} onClick={() => { setSeverity(value); setSeverityOpen(false); }}>
                    <i aria-hidden="true"/><span><strong>{value}</strong><small>{detail}</small></span><b>{severity === value ? "✓" : ""}</b>
                  </button>)}
                </div>}
              </div>
              <input className="sf-severity-required" tabIndex={-1} aria-hidden="true" required value={severity} onChange={() => {}}/>
            </div>
          </div>

          <label className="sf-field sf-description-field"><span><b>4.</b> Detailed Description <em>*</em></span><textarea required maxLength={1000} value={description} onChange={event => setDescription(event.target.value)} placeholder="Please describe the issue in detail..."/><small className="sf-counter">{description.length} / 1000</small></label>

          <label className="sf-field sf-steps-field"><span><b>5.</b> Steps to Reproduce</span><textarea maxLength={500} value={steps} onChange={event => setSteps(event.target.value)} placeholder="Please list the steps to reproduce this issue..."/><small className="sf-counter">{steps.length} / 500</small></label>

          <div className="sf-bottom-row">
            {!isTesterWorkflowV2Enabled && <section className="sf-attachments">
              <h2>6. Attachments (Optional)</h2>
              <div className="sf-dropzone" onDragOver={event => event.preventDefault()} onDrop={event => { event.preventDefault(); addFiles(event.dataTransfer.files); }}>
                <svg viewBox="0 0 48 48" aria-hidden="true"><path d="M24 32V8m0 0L14 18M24 8l10 10M8 29v8a4 4 0 0 0 4 4h24a4 4 0 0 0 4-4v-8" fill="none" stroke="currentColor" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
                <div className="sf-drop-copy"><strong>Drag &amp; drop images or screenshots here</strong><small>PNG, JPG, or WebP (Max 5MB)</small>{files.length > 0 && <small className="sf-file-list">{files.map(file => file.name).join(" · ")}</small>}</div>
                <button type="button" className="sf-browse" onClick={() => fileInput.current?.click()}><Icon name="folder" size={22}/> Browse Files</button>
                <input ref={fileInput} type="file" accept="image/png,image/jpeg,image/webp" multiple hidden onChange={event => { if (event.target.files) addFiles(event.target.files); event.target.value = ""; }}/>
              </div>
            </section>}
            <div className="sf-submit-wrap"><button type="submit" className="sf-submit" disabled={submitting || feedbackLoading || feedbackLocked}><svg viewBox="0 0 32 32" aria-hidden="true"><path d="M27 4 5 13l9 4 4 10 9-23ZM14 17l13-13" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round"/></svg> {submitting ? "Submitting…" : isRevision ? "Revise and Resubmit Feedback" : "Submit Feedback"}</button>{message && <p className="sf-submit-message" role="status">{message}</p>}</div>
          </div>
        </form>
      </div>
    </main>
  </div>;
}
