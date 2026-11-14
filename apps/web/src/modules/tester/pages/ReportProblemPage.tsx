import { useRef, useState } from "react";
import type { FormEvent, DragEvent } from "react";
import { Link } from "react-router-dom";
import { useIdentity } from "../../../features/identity/hooks/useIdentity";
import TesterSidebar, { Icon } from "../components/TesterSidebar";
import "../styles/tester-dashboard.css";
import "../styles/report-problem.css";

type ProblemType = "Technical" | "Account" | "Payment" | "Testing" | "Other";
type Priority = "Normal" | "High" | "Critical";
const problemTypes: { value: ProblemType; icon: "code" | "user" | "wallet" | "tests" | "help" }[] = [
  { value: "Technical", icon: "code" }, { value: "Account", icon: "user" },
  { value: "Payment", icon: "wallet" }, { value: "Testing", icon: "tests" }, { value: "Other", icon: "help" }
];
const MAX_FILE_SIZE = 10 * 1024 * 1024;
const MAX_FILES = 5;

export default function ReportProblemPage() {
  const { session, roles = [] } = useIdentity();
  const [workspaceMenuOpen, setWorkspaceMenuOpen] = useState(false);
  const [type, setType] = useState<ProblemType>("Technical");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [relatedTest, setRelatedTest] = useState("");
  const [priority, setPriority] = useState<Priority>("Normal");
  const [files, setFiles] = useState<File[]>([]);
  const [notice, setNotice] = useState("");
  const [dragging, setDragging] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const name = session?.user?.user_metadata?.display_name || session?.user?.email?.split("@")[0] || "Tester";
  const firstName = name.split(/[\s._-]+/)[0] || "Tester";
  const isAdmin = roles.includes("admin"), isDeveloper = roles.includes("developer");
  const nav = [
    { label: "Dashboard", icon: "home", href: "/tester-dashboard" },
    { label: "Discover Tests", icon: "search", href: "/discover-tests" },
    { label: "My Tests", icon: "tests", href: "/my-tests" },
    { label: "Feedback History", icon: "star", href: "/feedback-history" },
    { label: "Wallet & Rewards", icon: "wallet", href: "/wallet-rewards" },
    { label: "Profile", icon: "user", href: "/profile" },
    { label: "Support Center", icon: "headset", href: "/support", active: true },
    { label: "Settings", icon: "settings", href: "/settings" },
    ...(isDeveloper ? [{ label: "Developer Dashboard", icon: "code", href: "/developer-dashboard" }] : []),
    ...(isAdmin ? [{ label: "Admin", icon: "shield", href: "/admin" }] : [])
  ];
  const addFiles = (incoming: FileList | File[]) => {
    const accepted = Array.from(incoming);
    const valid = accepted.filter(file => file.size <= MAX_FILE_SIZE && /^(image\/(png|jpeg|webp)|application\/pdf|text\/plain)$/.test(file.type));
    const rejected = accepted.length - valid.length;
    setFiles(current => [...current, ...valid.filter(file => !current.some(old => old.name === file.name && old.size === file.size))].slice(0, MAX_FILES));
    setNotice(rejected ? "Some files were skipped. Use PNG, JPG, WebP, PDF or TXT files up to 10MB each." : "");
  };
  const onDrop = (event: DragEvent<HTMLDivElement>) => { event.preventDefault(); setDragging(false); addFiles(event.dataTransfer.files); };
  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setNotice("Your report is prepared, but report submission is not connected to the support service yet. No report was sent.");
  };
  const reset = () => { setType("Technical"); setTitle(""); setDescription(""); setRelatedTest(""); setPriority("Normal"); setFiles([]); setNotice(""); };
  return <div className="td-dashboard rp-dashboard">
    <TesterSidebar nav={nav} name={name} firstName={firstName} avatar="" roles={roles} isAdmin={isAdmin} isDeveloper={isDeveloper} workspaceMenuOpen={workspaceMenuOpen} setWorkspaceMenuOpen={setWorkspaceMenuOpen} previewMode={false}/>
    <main className="td-main rp-main">
      <header className="td-topbar rp-topbar">
        <label className="td-search rp-search"><Icon name="search" size={20}/><input placeholder="Search in TestDZ..." aria-label="Search in TestDZ"/></label>
        <div className="td-top-actions"><Link to="/notifications" className="td-notification" aria-label="Notifications"><Icon name="bell" size={21}/></Link><span className="td-top-divider"/><Link to="/profile" className="td-profile-short"><span>{firstName.slice(0,2).toUpperCase()}</span><strong>{name}</strong><b>⌄</b></Link></div>
      </header>
      <div className="rp-content">
        <Link to="/support" className="rp-back">← <span>Back to Support Center</span></Link>
        <section className="rp-hero"><div className="rp-hero-icon"><Icon name="headset" size={54}/></div><div className="rp-hero-copy"><h1>Report a Problem</h1><p>Found an issue? Let us know. We’re here to help.</p></div><div className="rp-hero-art" aria-hidden="true"><Icon name="monitor" size={100}/><span>!</span></div></section>
        <form className="rp-layout" onSubmit={submit}>
          <section className="rp-form-card">
            <div className="rp-field-block"><h2><Icon name="grid" size={22}/> <span>1. Problem Type</span></h2><p className="rp-hint">Select the type of problem:</p><div className="rp-type-grid">{problemTypes.map(item=><button type="button" key={item.value} className={type===item.value?"rp-type selected":"rp-type"} onClick={()=>setType(item.value)} aria-pressed={type===item.value}><i className="rp-radio"/><Icon name={item.icon} size={22}/><strong>{item.value}</strong></button>)}</div></div>
            <label className="rp-field-block"><h2><Icon name="code" size={21}/> <span>2. Issue Title</span></h2><div className="rp-input-wrap"><input required maxLength={100} value={title} onChange={e=>setTitle(e.target.value)} placeholder="Briefly describe the issue..."/><small>{title.length} / 100</small></div></label>
            <label className="rp-field-block"><h2><Icon name="receipt" size={21}/> <span>3. Detailed Description</span></h2><div className="rp-textarea-wrap"><textarea required maxLength={1000} value={description} onChange={e=>setDescription(e.target.value)} placeholder="Please provide more details about the problem, including steps to reproduce it..."/><small>{description.length} / 1000</small></div></label>
            <div className="rp-split-fields">
              <label className="rp-field-block"><h2><Icon name="flask" size={21}/> <span>4. Related Test <em>(Optional)</em></span></h2><p className="rp-hint">Select a test if this issue is related to a specific test:</p><select value={relatedTest} onChange={e=>setRelatedTest(e.target.value)}><option value="">No specific test</option></select><small className="rp-muted">Test selection will be available when linked test data is connected.</small></label>
              <div className="rp-field-block"><h2><Icon name="link" size={21}/> <span>5. Attach Files <em>(Optional)</em></span></h2><p className="rp-hint">Add screenshots or files (max 10MB per file).</p><div className={dragging?"rp-dropzone dragging":"rp-dropzone"} onDragOver={e=>{e.preventDefault();setDragging(true);}} onDragLeave={()=>setDragging(false)} onDrop={onDrop}><Icon name="download" size={34}/><strong>Click to upload</strong><span>or drag and drop files</span><small>PNG, JPG, WebP, PDF, TXT · Up to 5 files</small><button type="button" onClick={()=>inputRef.current?.click()}>Browse files</button><input ref={inputRef} type="file" hidden multiple accept="image/png,image/jpeg,image/webp,application/pdf,text/plain" onChange={e=>{if(e.target.files)addFiles(e.target.files);e.target.value="";}}/></div>{files.length>0&&<ul className="rp-file-list">{files.map((file,index)=><li key={file.name+file.size}><Icon name="receipt" size={15}/><span>{file.name}</span><small>{(file.size/1024/1024).toFixed(1)} MB</small><button type="button" aria-label={"Remove "+file.name} onClick={()=>setFiles(current=>current.filter((_,i)=>i!==index))}>×</button></li>)}</ul>}</div>
            </div>
            <div className="rp-field-block rp-priority"><h2><Icon name="bolt" size={21}/> <span>6. Priority Level</span></h2><div className="rp-priority-options">{(["Normal","High","Critical"] as Priority[]).map(value=><label key={value}><input type="radio" name="priority" checked={priority===value} onChange={()=>setPriority(value)}/><span className={"rp-priority-dot "+value.toLowerCase()}/>{value}</label>)}</div></div>
            <div className="rp-form-actions"><button type="button" className="rp-reset" onClick={reset}><Icon name="refresh" size={18}/> Reset Form</button><button type="submit" className="rp-submit"><Icon name="send" size={19}/> Submit Report</button></div>
            {notice&&<p className="rp-notice" role="status">{notice}</p>}
          </section>
          <aside className="rp-side">
            <section className="rp-review-card"><span><Icon name="check" size={34}/></span><div><h3>Your report will be reviewed soon!</h3><p><Icon name="clock" size={25}/> We aim to respond within 24–48 hours after the support workflow is connected.</p></div></section>
            <section className="rp-info-card"><h3><Icon name="info" size={21}/> Report Info</h3><p>Report ID</p><div className="rp-id">Generated after successful submission</div><p>Status</p><strong className="rp-not-submitted">Not submitted</strong><small>No report has been created yet.</small></section>
            <section className="rp-contact-card"><h3><Icon name="headset" size={21}/> Need Immediate Help?</h3><p>Visit the Help Center for available support resources.</p><Link to="/help-support"><Icon name="book" size={17}/> Open Help Center</Link><Link to="/submit-feedback"><Icon name="message-square" size={17}/> Send Feedback</Link></section>
            <section className="rp-tip-card"><Icon name="lightbulb" size={26}/><div><strong>Pro Tip!</strong><p>Include screenshots and clear details to help us understand the issue faster.</p></div></section>
          </aside>
        </form>
      </div>
    </main>
  </div>;
}
