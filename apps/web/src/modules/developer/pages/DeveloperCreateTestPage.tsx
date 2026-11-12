import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import type { AppRecord } from "@testdz/types";
import { listApps } from "../../../features/apps/apps-api";
import { supabase } from "../../../lib/supabase";
import "../styles/developer-create-test.css";

const steps = ["Select App", "Test Info", "Testing Period", "Requirements", "Rewards", "Media", "Review", "Publish"];
type Stage = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8;
type AppFilter = "all" | "published" | "draft";

function Icon({ name, size = 20 }: { name: string; size?: number }) {
  const paths: Record<string, React.ReactNode> = {
    home: <><path d="m3 10 9-7 9 7" /><path d="M5 9v11h14V9" /></>,
    apps: <><rect x="3" y="3" width="8" height="8" rx="2" /><rect x="13" y="3" width="8" height="8" rx="2" /><rect x="3" y="13" width="8" height="8" rx="2" /><rect x="13" y="13" width="8" height="8" rx="2" /></>,
    tests: <><path d="M9 3h6M10 3v5l-5 9a3 3 0 0 0 3 4h8a3 3 0 0 0 3-4l-5-9V3" /><path d="M8 14h8" /></>,
    users: <><circle cx="9" cy="8" r="3" /><path d="M3 20v-2a6 6 0 0 1 12 0v2m1-14a3 3 0 0 1 0 6m2 2a5 5 0 0 1 3 5" /></>,
    chart: <><path d="M4 20V10M10 20V4M16 20v-7M22 20H2" /></>,
    feedback: <><path d="M4 5h16v12H9l-5 4V5Z" /><path d="M8 9h8M8 13h5" /></>,
    crown: <path d="m2 8 5 4 5-8 5 8 5-4-2 12H4L2 8Z" />,
    settings: <><circle cx="12" cy="12" r="3" /><path d="m19 13 2 1-2 4-2-1-2 1v2H9v-2l-2-1-2 1-2-4 2-1v-2l-2-1 2-4 2 1 2-1V4h6v2l2 1 2-1 2 4-2 1z" /></>,
    help: <><circle cx="12" cy="12" r="9" /><path d="M9 9a3 3 0 1 1 5 2c-1 1-2 1-2 3m0 3h.01" /></>,
    search: <><circle cx="10.8" cy="10.8" r="7" /><path d="m16 16 4.5 4.5" /></>,
    check: <path d="m5 12 4 4L19 6" />,
    arrow: <><path d="M4 12h15m-6-6 6 6-6 6" /></>,
    android: <><path d="M5 9a7 7 0 0 1 14 0v8H5V9ZM8 3 6 1m10 2 2-2M8 12v1m8-1v1M8 17v4m8-4v4" /></>,
    info: <><circle cx="12" cy="12" r="9" /><path d="M12 11v5m0-8h.01" /></>,
    calendar: <><rect x="3" y="5" width="18" height="16" rx="2" /><path d="M16 3v4M8 3v4M3 10h18" /></>,
    gift: <><rect x="3" y="8" width="18" height="13" rx="2" /><path d="M12 8v13M2 8h20v-3H2zM12 5c-4-6-8 0 0 3m0-3c4-6 8 0 0 3" /></>,
    image: <><rect x="3" y="3" width="18" height="18" rx="2" /><circle cx="8.5" cy="8.5" r="1.5" /><path d="m21 15-5-5L5 21" /></>,
  };
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{paths[name] ?? paths.info}</svg>;
}

function AppIcon({ app }: { app: AppRecord }) {
  const category = app.category.toLowerCase();
  return <span className={"dct-app-icon " + (category.includes("game") ? "game" : category.includes("fitness") || category.includes("health") ? "fitness" : "")}>
    {app.icon_url ? <img src={app.icon_url} alt="" /> : category.includes("game") ? "🎮" : category.includes("education") ? "📖" : category.includes("fitness") ? "🏋️" : "▦"}
  </span>;
}

export default function DeveloperCreateTestPage() {
  const navigate = useNavigate();
  const [apps, setApps] = useState<AppRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [selectedApp, setSelectedApp] = useState("");
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<AppFilter>("all");
  const [step, setStep] = useState<Stage>(1);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [minTesters, setMinTesters] = useState(12);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState("");

  useEffect(() => {
    let alive = true;
    async function load() {
      if (!supabase) { setLoadError("Supabase is not configured."); setLoading(false); return; }
      const { data: session } = await supabase.auth.getSession();
      if (!session.session) { navigate("/auth", { replace: true }); return; }
      const { data, error } = await listApps();
      if (!alive) return;
      if (error) setLoadError("Could not load your applications. Please refresh and try again.");
      else {
        const available = ((data ?? []) as AppRecord[]).filter(app => app.status !== "archived");
        setApps(available);
        if (available.length === 1) setSelectedApp(available[0].id);
      }
      setLoading(false);
    }
    void load();
    return () => { alive = false; };
  }, [navigate]);

  const selected = apps.find(app => app.id === selectedApp) ?? null;
  const visibleApps = useMemo(() => apps.filter(app => {
    const q = search.trim().toLowerCase();
    return (!q || (app.name + " " + app.package_name).toLowerCase().includes(q))
      && (filter === "all" || app.status === filter);
  }), [apps, search, filter]);

  function next() {
    setSaveError("");
    if (step === 1 && !selectedApp) { setSaveError("Select an application to continue."); return; }
    if (step === 2 && title.trim().length < 3) { setSaveError("Enter a test title with at least 3 characters."); return; }
    if (step === 3 && startDate && endDate && endDate < startDate) { setSaveError("The end date must be after the start date."); return; }
    setStep(value => Math.min(8, value + 1) as Stage);
  }

  async function saveAsDraft() {\n    if (!selectedApp) { setSaveError("Select an application before saving your draft."); setStep(1); return; }\n    if (title.trim().length < 3) { setSaveError("Enter a test title with at least 3 characters before saving."); setStep(2); return; }\n    await publishDraft();\n  }\n\n  async function publishDraft() {
    if (!supabase || !selected) return;
    const { data: auth } = await supabase.auth.getUser();
    if (!auth.user) { navigate("/auth", { replace: true }); return; }
    setSaving(true); setSaveError("");
    const { data, error } = await supabase.from("tests").insert({
      app_id: selected.id,
      developer_id: auth.user.id,
      title: title.trim(),
      description: description.trim() || null,
      start_date: startDate || null,
      end_date: endDate || null,
      min_testers: Math.max(1, Math.min(1000, Math.floor(minTesters))),
      status: "draft",
    }).select("id").single();
    if (error) {
      setSaveError(error.message.includes("cohort") ? "This test could not be created because the current testing setup is incomplete." : "Could not save your test. Please check the details and try again.");
      setSaving(false);
      return;
    }
    navigate("/developer/tests", { state: { createdTestId: data.id } });
  }

  return <main className="dct-shell">
    <aside className="dct-sidebar">
      <Link to="/developer-dashboard" className="dct-brand"><span className="dct-brand-mark">✓</span><span><strong>TestDZ</strong><small>Build · Test · Improve</small></span></Link>
      <div className="dct-module"><span>‹/›</span><b>Developer</b><i>Pro</i></div>
      <nav className="dct-nav">
        <Link to="/developer-dashboard"><Icon name="home" />Dashboard</Link>
        <Link to="/apps"><Icon name="apps" />My Apps</Link>
        <Link to="/developer/tests/new" className="active"><Icon name="tests" />Create Test</Link>
        <Link to="/developer/tests"><Icon name="tests" />My Tests</Link>
        <Link to="/tester-dashboard"><Icon name="users" />Testers</Link>
        <Link to="/developer-dashboard"><Icon name="chart" />Analytics</Link>
        <Link to="/developer-dashboard"><Icon name="feedback" />Feedback</Link>
        <Link to="/pricing"><Icon name="crown" />Subscription</Link>
        <Link to="/settings"><Icon name="settings" />Settings</Link>
        <Link to="/help"><Icon name="help" />Help & Support</Link>
      </nav>
      <div className="dct-promo"><span>🚀</span><strong>Reach more users<br />with TestDZ</strong><Link to="/pricing">Upgrade Plan <Icon name="arrow" size={15} /></Link></div>
    </aside>

    <section className="dct-content">
      <header className="dct-topbar"><label className="dct-global-search"><Icon name="search" /><input placeholder="Search..." /></label><div className="dct-user"><span className="dct-bell">♧<i>3</i></span><span className="dct-avatar">DK</span><strong>Developer</strong><span>⌄</span></div></header>
      <div className="dct-page">
        <section className="dct-hero"><div><span className="dct-hero-kicker">TESTDZ · DEVELOPER SPACE</span><h1>Create a New <em>Test</em></h1><p>Launch a testing campaign and get valuable feedback from real users.</p></div><div className="dct-hero-art" aria-hidden="true"><span className="dct-android">♟</span><span className="dct-hero-phone">✓</span><span className="dct-hero-checklist">☑<br />☑<br />☑</span></div></section>

        <nav className="dct-steps" aria-label="Test creation steps">{steps.map((label, index) => <button type="button" key={label} className={step === index + 1 ? "current" : step > index + 1 ? "done" : ""} onClick={() => { if (index + 1 <= step) setStep((index + 1) as Stage); }}><span>{step > index + 1 ? <Icon name="check" size={16} /> : index + 1}</span><small>{label}</small></button>)}</nav>

        <div className="dct-workspace">
          <section className="dct-main-card">
            <div className="dct-section-heading"><span className="dct-heading-icon"><Icon name={step === 1 ? "apps" : step === 3 ? "calendar" : step === 5 ? "gift" : step === 6 ? "image" : "tests"} size={25} /></span><div><h2>{steps[step - 1]}</h2><p>{step === 1 ? "Choose the application you want to test" : step === 2 ? "Give your testing campaign a clear title and description" : step === 3 ? "Set the campaign dates and tester target" : step === 4 ? "Review the testing requirements available for this campaign" : step === 5 ? "Reward configuration will be connected when reward fields are added to the test schema" : step === 6 ? "Media attachments will be enabled when campaign media storage is configured" : step === 7 ? "Review the campaign details before saving" : "Save your test as a draft and continue managing it from My Tests"}</p></div></div>

            {step === 1 && <>
              <div className="dct-app-controls"><label className="dct-app-search"><Icon name="search" /><input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search for your apps..." /></label><select value={filter} onChange={e => setFilter(e.target.value as AppFilter)} aria-label="Filter applications"><option value="all">All Apps</option><option value="published">Published</option><option value="draft">Draft</option></select></div>
              {loadError && <div className="dct-error">{loadError}</div>}
              {loading ? <div className="dct-loading">Loading your applications…</div> : visibleApps.length ? <div className="dct-app-grid">{visibleApps.map(app => <button type="button" key={app.id} className={"dct-app-card " + (selectedApp === app.id ? "selected" : "")} onClick={() => setSelectedApp(app.id)}><span className="dct-selected-check"><Icon name="check" size={15} /></span><AppIcon app={app} /><strong>{app.name}</strong><small dir="ltr">{app.package_name}</small><span className={"dct-status " + app.status}><i />{app.status === "published" ? "Published" : "Draft"}</span></button>)}</div> : <div className="dct-empty"><Icon name="apps" size={35} /><strong>{apps.length ? "No apps match your search" : "No applications yet"}</strong><p>{apps.length ? "Try another search or filter." : "Add an application before creating a test campaign."}</p><Link to="/apps">Go to My Apps <Icon name="arrow" size={15} /></Link></div>}
            </>}

            {step === 2 && <div className="dct-form-grid"><label>Test title<input value={title} onChange={e => setTitle(e.target.value)} maxLength={100} placeholder="e.g. Android usability test" /></label><label className="full">Test description<textarea value={description} onChange={e => setDescription(e.target.value)} maxLength={2000} placeholder="Describe what testers will be evaluating…" /></label><p className="dct-field-note">The title and description are saved with your test.</p></div>}
            {step === 3 && <div className="dct-form-grid"><label>Start date<input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} /></label><label>End date<input type="date" value={endDate} min={startDate || undefined} onChange={e => setEndDate(e.target.value)} /></label><label>Target testers<input type="number" min={1} max={1000} value={minTesters} onChange={e => setMinTesters(Number(e.target.value))} /></label><p className="dct-field-note">Dates and tester target are saved in the current tests table.</p></div>}
            {step === 4 && <div className="dct-capability"><span><Icon name="info" size={22} /></span><div><strong>Requirements are not stored by the current test schema yet.</strong><p>This step is reserved for tester eligibility, device, Android version and task instructions. I have kept it explicit rather than saving settings that the database cannot retain.</p></div></div>}
            {step === 5 && <div className="dct-capability"><span><Icon name="gift" size={22} /></span><div><strong>Rewards configuration is not available in the current test schema.</strong><p>Reward amount and reward rules need a dedicated campaign-rewards data model before they can be saved reliably.</p></div></div>}
            {step === 6 && <div className="dct-capability"><span><Icon name="image" size={22} /></span><div><strong>Media uploads are not connected to tests yet.</strong><p>App screenshots and campaign attachments need a test-media storage relation. This step is shown in the reference flow but will not pretend to upload or save files.</p></div></div>}
            {step === 7 && <div className="dct-review"><div><span>Selected app</span><strong>{selected?.name || "Not selected"}</strong></div><div><span>Test title</span><strong>{title || "Not entered"}</strong></div><div><span>Testing period</span><strong>{startDate || "Not set"} → {endDate || "Not set"}</strong></div><div><span>Target testers</span><strong>{minTesters}</strong></div><div><span>Campaign status</span><strong className="dct-review-draft">Draft</strong></div></div>}
            {step === 8 && <div className="dct-publish-state"><span><Icon name="check" size={30} /></span><h3>Ready to save your test</h3><p>Your campaign will be created as a draft. You can review it from My Tests after saving.</p></div>}
            {saveError && <div className="dct-error">{saveError}</div>}
            <div className="dct-tip"><span>💡</span><p><strong>Pro Tip:</strong> A well-defined test helps you get high-quality feedback. Make sure to set clear goals and instructions.</p></div>
            <div className="dct-actions"><button type="button" className="dct-draft" onClick={() => void saveAsDraft()}><Icon name="check" size={18} />Save as Draft</button><div><button type="button" className="dct-cancel" onClick={() => navigate("/developer/tests")}>Cancel</button>{step < 8 ? <button type="button" className="dct-next" onClick={next}>Next Step <Icon name="arrow" size={18} /></button> : <button type="button" className="dct-next" onClick={() => void publishDraft()} disabled={saving}>{saving ? "Saving…" : "Create Draft"} <Icon name="arrow" size={18} /></button>}</div></div>
          </section>

          <aside className="dct-overview"><div className="dct-overview-head"><h2>Test Overview</h2><Icon name="info" size={20} /></div>{selected ? <><div className="dct-overview-app"><AppIcon app={selected} /><div><strong>{selected.name}</strong><span className={"dct-status " + selected.status}><i />{selected.status === "published" ? "Published" : "Draft"}</span><p>{selected.description || "Application selected for this testing campaign."}</p></div></div><div className="dct-overview-details"><div><Icon name="android" /><span>Package Name</span><strong dir="ltr">{selected.package_name}</strong></div><div><Icon name="apps" /><span>Category</span><strong>{selected.category}</strong></div><div><Icon name="info" /><span>Current Version</span><strong>Not provided</strong></div><div><Icon name="info" /><span>App Size</span><strong>Not provided</strong></div></div></> : <div className="dct-overview-empty"><Icon name="apps" size={34} /><strong>No app selected</strong><p>Choose an app to see its details here.</p></div>}</aside>
        </div>
      </div>
    </section>
  </main>;
}
