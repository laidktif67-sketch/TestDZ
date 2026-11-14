import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import type { AppRecord } from "@testdz/types";
import { listApps } from "../../../features/apps/apps-api";
import { createTestDraft, type TestType } from "../../../features/tests/tests-api";
import { identityApi } from "../../../features/identity/identity-api";
import DeveloperSidebar from "../components/DeveloperSidebar";
import "../styles/developer-create-test.css";
import "../styles/developer-create-test-six-step.css";

const steps = [
  "Choose Test Type",
  "Select App",
  "Test Details",
  "Testers & Cohort",
  "Schedule & Rules",
  "Review & Publish",
] as const;

const testTypes: { id: TestType; title: string; description: string; icon: string; tint: string; meta: string }[] = [
  { id: "google_play_closed", title: "Google Play Closed Testing", description: "Prepare a closed-testing campaign and coordinate eligible testers.", icon: "▶", tint: "play", meta: "Play testing workflow" },
  { id: "apk_testing", title: "APK Testing", description: "Coordinate testing for an Android app package.", icon: "♟", tint: "apk", meta: "Android package" },
  { id: "bug_discovery", title: "Bug Discovery", description: "Focus testers on finding and documenting issues.", icon: "✳", tint: "bug", meta: "Issue-focused" },
  { id: "usability", title: "Usability Testing", description: "Collect task-based feedback about the user experience.", icon: "♧", tint: "users", meta: "User experience" },
  { id: "compatibility", title: "Compatibility Testing", description: "Gather coverage across supported Android devices and versions.", icon: "▯", tint: "device", meta: "Device coverage" },
  { id: "custom", title: "Custom Test", description: "Define a flexible campaign using your own instructions.", icon: "⚙", tint: "custom", meta: "Custom workflow" },
];

type Stage = 1 | 2 | 3 | 4 | 5 | 6;

function Icon({ name, size = 20 }: { name: string; size?: number }) {
  const paths: Record<string, React.ReactNode> = {
    search: <><circle cx="10.8" cy="10.8" r="7" /><path d="m16 16 4.5 4.5" /></>,
    refresh: <><path d="M20 7v5h-5"/><path d="M4 17v-5h5"/><path d="M5.6 9A7 7 0 0 1 18 6l2 6M4 12l2 6a7 7 0 0 0 12.4-3"/></>,
    check: <path d="m5 12 4 4L19 6" />,
    arrow: <><path d="M4 12h15m-6-6 6 6-6 6" /></>,
    apps: <><rect x="3" y="3" width="8" height="8" rx="2" /><rect x="13" y="3" width="8" height="8" rx="2" /><rect x="3" y="13" width="8" height="8" rx="2" /><rect x="13" y="13" width="8" height="8" rx="2" /></>,
    calendar: <><rect x="3" y="5" width="18" height="16" rx="2" /><path d="M16 3v4M8 3v4M3 10h18" /></>,
    tests: <><path d="M9 3h6M10 3v5l-5 9a3 3 0 0 0 3 4h8a3 3 0 0 0 3-4l-5-9V3" /><path d="M8 14h8" /></>,
    info: <><circle cx="12" cy="12" r="9" /><path d="M12 11v5m0-8h.01" /></>,
    users: <><circle cx="9" cy="8" r="3" /><path d="M3 20v-2a6 6 0 0 1 12 0v2m1-14a3 3 0 0 1 0 6m2 2a5 5 0 0 1 3 5" /></>,
  };
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{paths[name] ?? paths.info}</svg>;
}

function AppIcon({ app }: { app: AppRecord }) {
  const category = (app.category ?? "").toLowerCase();
  return <span className={"dct-app-icon " + (category.includes("game") ? "game" : category.includes("fitness") || category.includes("health") ? "fitness" : "")}>
    {app.icon_url ? <img src={app.icon_url} alt="" /> : category.includes("game") ? "🎮" : category.includes("education") ? "📖" : "▦"}
  </span>;
}

export default function DeveloperCreateTestSixStepPage() {
  const navigate = useNavigate();
  const [apps, setApps] = useState<AppRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [selectedApp, setSelectedApp] = useState("");
  const [search, setSearch] = useState("");
  const [step, setStep] = useState<Stage>(1);
  const [testType, setTestType] = useState<TestType | "">("");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [targetTesters, setTargetTesters] = useState(12);
  const [cohortNotes, setCohortNotes] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [androidVersion, setAndroidVersion] = useState("Any supported version");
  const [instructions, setInstructions] = useState("");
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState("");

  useEffect(() => {
    let alive = true;
    async function load() {
      if (!identityApi.isConfigured()) {
        setLoadError("Supabase is not configured.");
        setLoading(false);
        return;
      }
      const { data: session } = await identityApi.getSession();
      if (!session.session) {
        navigate("/auth", { replace: true });
        return;
      }
      const { data, error } = await listApps();
      if (!alive) return;
      if (error) setLoadError("Could not load your applications. Please refresh and try again.");
      else {
        const available = ((data ?? []) as AppRecord[]).filter(app => app.status === "published");
        setApps(available);
        if (available.length === 1) setSelectedApp(available[0].id);
      }
      setLoading(false);
    }
    void load();
    return () => { alive = false; };
  }, [navigate]);

  const selected = apps.find(app => app.id === selectedApp) ?? null;
  const selectedType = testTypes.find(item => item.id === testType);
  const visibleApps = useMemo(() => apps.filter(app => {
    const q = search.trim().toLowerCase();
    return !q || (app.name + " " + app.package_name + " " + (app.description ?? "")).toLowerCase().includes(q);
  }), [apps, search]);

  async function refreshApps() {
    setLoading(true);
    setLoadError("");
    try {
      const { data, error } = await listApps();
      if (error) {
        setLoadError("Could not refresh your applications. Please try again.");
        return;
      }
      const available = ((data ?? []) as AppRecord[]).filter(app => app.status === "published");
      setApps(available);
      setSelectedApp(current => available.some(app => app.id === current) ? current : available.length === 1 ? available[0].id : "");
    } catch {
      setLoadError("Could not refresh your applications. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  function next() {
    setSaveError("");
    if (step === 1 && !testType) { setSaveError("Choose a test type to continue."); return; }
    if (step === 2 && !selectedApp) { setSaveError("Select an application to continue."); return; }
    if (step === 3 && title.trim().length < 3) { setSaveError("Enter a test title with at least 3 characters."); return; }
    if (step === 4 && (!Number.isFinite(targetTesters) || targetTesters < 1 || targetTesters > 500)) {
      setSaveError("Choose a tester target between 1 and 500.");
      return;
    }
    if (step === 5 && startDate && endDate && endDate < startDate) {
      setSaveError("The end date must be on or after the start date.");
      return;
    }
    setStep(value => Math.min(6, value + 1) as Stage);
  }

  async function saveDraft() {
    setSaveError("");
    if (!testType) { setStep(1); setSaveError("Choose a test type before saving."); return; }
    if (!selectedApp) { setStep(2); setSaveError("Select an application before saving."); return; }
    if (title.trim().length < 3) { setStep(3); setSaveError("Enter a test title with at least 3 characters."); return; }
    if (startDate && endDate && endDate < startDate) { setStep(5); setSaveError("The end date must be on or after the start date."); return; }
    if (!identityApi.isConfigured() || !selected) {
      setSaveError("The selected application could not be verified. Refresh and try again.");
      return;
    }
    const { data: auth } = await identityApi.getCurrentUser();
    if (!auth.user) { navigate("/auth", { replace: true }); return; }
    setSaving(true);
    const { data, error } = await createTestDraft({
      appId: selected.id,
      developerId: auth.user.id,
      title: title.trim(),
      description: description.trim() || null,
      startDate: startDate || null,
      endDate: endDate || null,
      minTesters: Math.max(1, Math.min(500, Math.floor(targetTesters))),
      testType,
      testConfig: {
        cohort: { targetTesters: Math.max(1, Math.min(500, Math.floor(targetTesters))), notes: cohortNotes.trim() || null },
        rules: { androidVersion, instructions: instructions.trim() || null },
      },
    });
    if (error) {
      setSaveError(error.message.includes("cohort")
        ? "The test could not be created because the current cohort setup needs attention."
        : "Could not save your test. Check the details and confirm the latest database migration has been applied.");
      setSaving(false);
      return;
    }
    navigate("/developer/tests", { state: { createdTestId: data.id } });
  }

  return <main className="dct-shell">
    <DeveloperSidebar />
    <section className="dct-content">
      <header className="dct-topbar">
        <label className="dct-global-search"><Icon name="search" /><input placeholder="Search apps, tests, or anything..." /></label>
        <div className="dct-user"><span className="dct-bell">♧<i>3</i></span><span className="dct-avatar">D</span><strong>Developer</strong></div>
      </header>
      <div className="dct-page">
        <section className={"dct-hero " + (step === 2 ? "dct-hero-select-app" : "")}>
          <div><span className="dct-hero-kicker">TESTDZ · DEVELOPER SPACE</span><h1>{step === 2 ? <>Select Your <em>App</em></> : <>Create New <em>Test</em></>}</h1><p>{step === 2 ? "Choose the application you want to test." : "Choose the right testing flow for your application."}</p></div>
          {step === 2 && <button type="button" className="dct-hero-back" onClick={() => { setSaveError(""); setStep(1); }}><span aria-hidden="true">←</span> Back to Test Types</button>}
          <div className="dct-hero-art" aria-hidden="true"><span className="dct-android">♟</span><span className="dct-hero-phone">✓</span><span className="dct-hero-checklist">☑<br />☑<br />☑</span></div>
        </section>

        <nav className="dct-steps dct-six-steps" aria-label="Test creation steps">
          {steps.map((label, index) => <button type="button" key={label} className={step === index + 1 ? "current" : step > index + 1 ? "done" : ""} onClick={() => { if (index + 1 <= step) setStep((index + 1) as Stage); }}>
            <span>{step > index + 1 ? <Icon name="check" size={16} /> : index + 1}</span><small>{label}</small>
          </button>)}
        </nav>

        <div className="dct-workspace">
          <section className="dct-main-card">
            <div className="dct-section-heading">
              <span className="dct-heading-icon"><Icon name={step === 2 ? "apps" : step === 4 ? "users" : step === 5 ? "calendar" : step === 6 ? "check" : "tests"} size={25} /></span>
              <div><h2>{steps[step - 1]}</h2><p>{[
                "Choose the testing campaign type that matches your goal.",
                "Select an application already registered in My Apps.",
                "Add a clear title and explain what the campaign should evaluate.",
                "Set the target number of testers and add cohort preferences.",
                "Set the campaign dates and the instructions testers should follow.",
                "Review the saved configuration. The campaign will be created as a draft.",
              ][step - 1]}</p></div>
            </div>

            {step === 1 && <div className="dct-type-grid">{testTypes.map(type => <button type="button" key={type.id} className={"dct-type-card " + (testType === type.id ? "selected" : "")} onClick={() => setTestType(type.id)}>
              <span className={"dct-type-icon " + type.tint}>{type.icon}</span><span className="dct-type-copy"><strong>{type.title}</strong><small>{type.description}</small><em>{type.meta}</em></span><span className="dct-type-check"><Icon name="check" size={15} /></span>
            </button>)}</div>}

            {step === 2 && <>
              <div className="dct-app-toolbar">
                <div className="dct-app-toolbar-title"><span className="dct-heading-icon"><Icon name="apps" size={24} /></span><div><h3>Your Applications</h3><p>Select an app from your published applications</p></div></div>
                <div className="dct-app-controls"><label className="dct-app-search"><Icon name="search" /><input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search for an app..." aria-label="Search published apps" /></label><button type="button" className="dct-refresh" onClick={() => void refreshApps()} disabled={loading}><Icon name="refresh" size={17} />{loading ? "Refreshing…" : "Refresh"}</button></div>
              </div>
              {loadError && <div className="dct-error" role="alert">{loadError}</div>}
              {loading ? <div className="dct-loading">Loading your published applications…</div> : visibleApps.length ? <div className="dct-app-grid dct-app-grid-select">{visibleApps.map(app => <button type="button" key={app.id} className={"dct-app-card dct-app-card-select " + (selectedApp === app.id ? "selected" : "")} onClick={() => setSelectedApp(app.id)} aria-pressed={selectedApp === app.id}><span className="dct-selected-check"><Icon name="check" size={15} /></span><AppIcon app={app} /><span className="dct-app-card-copy"><strong>{app.name}</strong><small dir="ltr">{app.package_name}</small><span className="dct-app-description">{app.description || "Application registered in your TestDZ workspace."}</span><span className="dct-status published"><i />Published</span></span></button>)}</div> : <div className="dct-empty dct-published-empty"><Icon name="apps" size={35} /><strong>{apps.length ? "No apps match your search" : "No published apps found"}</strong><p>{apps.length ? "Try another search term." : "Make sure your application is published and accessible in your account."}</p><Link to="/apps">View My Apps <Icon name="arrow" size={15} /></Link></div>}
              <div className="dct-app-info"><span><Icon name="info" size={22} /></span><div><strong>Can’t find your app?</strong><p>Make sure your application is published and accessible in your account.</p></div><Link to="/apps">View My Apps <Icon name="arrow" size={16} /></Link></div>
            </>}

            {step === 3 && <div className="dct-form-grid"><label>Test title<input value={title} onChange={e => setTitle(e.target.value)} maxLength={100} placeholder="e.g. Android usability test" /></label><label className="full">Test description<textarea value={description} onChange={e => setDescription(e.target.value)} maxLength={2000} placeholder="Describe what testers will evaluate and what success looks like…" /></label><p className="dct-field-note">Title and description are saved with the test campaign.</p></div>}

            {step === 4 && <div className="dct-form-grid"><label>Target testers<input type="number" min={1} max={500} value={targetTesters} onChange={e => setTargetTesters(Number(e.target.value))} /></label><label className="full">Cohort preferences (optional)<textarea value={cohortNotes} onChange={e => setCohortNotes(e.target.value)} maxLength={1000} placeholder="Device coverage, tester experience, or cohort notes…" /></label><div className="dct-capability dct-inline-note"><span><Icon name="users" size={22} /></span><div><strong>Target and preferences are saved in test configuration.</strong><p>The platform forms tester cohorts through its separate lifecycle workflow; creating this draft does not assign testers or start recruitment.</p></div></div></div>}

            {step === 5 && <div className="dct-form-grid"><label>Start date<input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} /></label><label>End date<input type="date" value={endDate} min={startDate || undefined} onChange={e => setEndDate(e.target.value)} /></label><label className="full">Android version / device rule<select value={androidVersion} onChange={e => setAndroidVersion(e.target.value)}><option>Any supported version</option><option>Android 10 and newer</option><option>Android 12 and newer</option><option>Android 14 and newer</option></select></label><label className="full">Tester instructions<textarea value={instructions} onChange={e => setInstructions(e.target.value)} maxLength={3000} placeholder="Describe the tasks testers should perform and what feedback is useful…" /></label><p className="dct-field-note">These rules are stored as campaign configuration. Dates can be left unset for a draft.</p>{testType === "apk_testing" && <div className="dct-capability dct-inline-note"><span><Icon name="info" size={22} /></span><div><strong>APK upload is a separate storage workflow.</strong><p>This page records the testing mode and instructions; it does not claim an APK has been uploaded or distributed.</p></div></div>}</div>}

            {step === 6 && <><div className="dct-review"><div><span>Test type</span><strong>{selectedType?.title ?? "Not selected"}</strong></div><div><span>Application</span><strong>{selected?.name ?? "Not selected"}</strong></div><div><span>Test title</span><strong>{title || "Not entered"}</strong></div><div><span>Target testers</span><strong>{targetTesters}</strong></div><div><span>Testing period</span><strong>{startDate || "Not set"} → {endDate || "Not set"}</strong></div><div><span>Android rule</span><strong>{androidVersion}</strong></div><div><span>Campaign status</span><strong className="dct-review-draft">Draft</strong></div></div><div className="dct-capability dct-inline-note"><span><Icon name="info" size={22} /></span><div><strong>Review & create draft</strong><p>Saving creates a TestDZ draft. It does not publish to Google Play, upload an APK, or automatically recruit testers.</p></div></div></>}

            {saveError && <div className="dct-error" role="alert">{saveError}</div>}
            <div className="dct-tip"><span>💡</span><p><strong>Pro Tip:</strong> Clear tasks and useful feedback instructions help your campaign produce better results.</p></div>
            <div className="dct-actions"><button type="button" className="dct-draft" onClick={() => void saveDraft()} disabled={saving}>{saving ? "Saving…" : "Save as Draft"}</button><div><button type="button" className="dct-cancel" onClick={() => navigate("/developer/tests")}>Cancel</button>{step > 1 && <button type="button" className="dct-cancel" onClick={() => { setSaveError(""); setStep(value => Math.max(1, value - 1) as Stage); }}>Back</button>}{step < 6 ? <button type="button" className="dct-next" onClick={next}>Next Step <Icon name="arrow" size={18} /></button> : <button type="button" className="dct-next" onClick={() => void saveDraft()} disabled={saving}>{saving ? "Saving…" : "Create Test Draft"} <Icon name="arrow" size={18} /></button>}</div></div>
          </section>

          <aside className="dct-overview"><div className="dct-overview-head"><h2>Test Overview</h2><Icon name="info" size={20} /></div>{selected ? <><div className="dct-overview-app"><AppIcon app={selected} /><div><strong>{selected.name}</strong><span className={"dct-status " + selected.status}><i />{selected.status === "published" ? "Published" : "Draft"}</span><p>{selected.description || "Application selected for this testing campaign."}</p></div></div><div className="dct-overview-details"><div><Icon name="apps" /><span>Package Name</span><strong dir="ltr">{selected.package_name}</strong></div><div><Icon name="apps" /><span>Category</span><strong>{selected.category}</strong></div><div><Icon name="tests" /><span>Test type</span><strong>{selectedType?.title ?? "Not selected"}</strong></div><div><Icon name="users" /><span>Target testers</span><strong>{targetTesters}</strong></div></div></> : <div className="dct-overview-empty"><Icon name="apps" size={34} /><strong>No app selected</strong><p>Choose an app in step 2 to see its details here.</p></div>}</aside>
        </div>
      </div>
    </section>
  </main>;
}
