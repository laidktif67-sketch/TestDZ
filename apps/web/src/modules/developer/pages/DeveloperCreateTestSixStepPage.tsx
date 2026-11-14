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
  "Configure Test",
  "Test Details",
  "Schedule & Testers",
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
    search: <><circle cx="10.8" cy="10.8" r="7" /><path d="m16 16 4.5 4.5" /></>,\n    details: <><rect x="5" y="4" width="14" height="17" rx="2"/><path d="M9 4.5h6M8 10h8M8 14h8M8 18h5"/></>,\n    target: <><circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5"/><circle cx="12" cy="12" r="1"/></>,\n    flag: <><path d="M5 21V4m0 0h12l-2 4 2 4H5"/></>,\n    scope: <><path d="m9 11 3 3L22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/></>,
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
  const [testingObjective, setTestingObjective] = useState("stability_bugs");
  const [priority, setPriority] = useState<"low" | "medium" | "high">("high");
  const [testingScope, setTestingScope] = useState<string[]>(["core_flows", "performance", "compatibility"]);
  const [successCriteria, setSuccessCriteria] = useState("No critical bugs; core flows pass");
  const [minimumCompletionRate, setMinimumCompletionRate] = useState(80);
  const [targetTesters, setTargetTesters] = useState(12);
  const [cohortNotes, setCohortNotes] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [androidVersion, setAndroidVersion] = useState("Any supported version");
  const [instructions, setInstructions] = useState("");
  const [playTrack, setPlayTrack] = useState<"internal" | "closed" | "open">("internal");
  const [testerMethod, setTesterMethod] = useState<"join_link" | "google_groups" | "upload_list">("join_link");
  const [googleGroup, setGoogleGroup] = useState("");
  const [testerEmails, setTesterEmails] = useState<string[]>([]);
  const [testerFileName, setTesterFileName] = useState("");
  const [appVersion, setAppVersion] = useState("latest_available");
  const [releaseMode, setReleaseMode] = useState<"immediately" | "scheduled">("immediately");
  const [releaseAt, setReleaseAt] = useState("");
  const [durationDays, setDurationDays] = useState<"7" | "14" | "30" | "custom">("14");
  const [allowMoreTesters, setAllowMoreTesters] = useState(true);
  const [joiningMethod, setJoiningMethod] = useState<"google_play_link" | "closed_group" | "upload_list" | "open_testing">("google_play_link");
  const [collectFeedback, setCollectFeedback] = useState(true);
  const [enableBugReports, setEnableBugReports] = useState(false);
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
    if (step === 3 && testType === "google_play_closed" && testerMethod === "google_groups" && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(googleGroup.trim())) { setSaveError("Enter a valid Google Group email address."); return; }
    if (step === 3 && testType === "google_play_closed" && releaseMode === "scheduled" && !releaseAt) { setSaveError("Choose a planned date and time, or select Immediately."); return; }
    if (step === 4 && title.trim().length < 3) { setSaveError("Enter a test title with at least 3 characters."); return; }\n    if (step === 4 && testingScope.length === 0) { setSaveError("Select at least one testing scope."); return; }\n    if (step === 4 && (!Number.isFinite(minimumCompletionRate) || minimumCompletionRate < 1 || minimumCompletionRate > 100)) { setSaveError("Set a minimum completion rate between 1% and 100%."); return; }
    if (step === 5 && (!Number.isFinite(targetTesters) || targetTesters < 1 || targetTesters > 500)) {
      setSaveError("Choose a tester target between 1 and 500.");
      return;
    }
    if (step === 5 && testType === "google_play_closed" && playTrack === "internal" && targetTesters > 100) { setSaveError("Internal testing is limited to a target of 100 testers in this configuration."); return; }
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
    if (title.trim().length < 3) { setStep(4); setSaveError("Enter a test title with at least 3 characters."); return; }
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
        rules: { androidVersion, instructions: instructions.trim() || null },\n        details: { testingObjective, priority, testingScope, successCriteria: successCriteria.trim() || null, minimumCompletionRate },
        schedule: { durationDays: durationDays === "custom" ? null : Number(durationDays), allowMoreTesters, joiningMethod, collectFeedback, enableBugReports },
        googlePlay: {
          track: playTrack,
          testerMethod,
          googleGroup: testerMethod === "google_groups" ? googleGroup.trim() || null : null,
          testerEmails: testerMethod === "upload_list" ? testerEmails : [],
          appVersion,
          releaseMode,
          releaseAt: releaseMode === "scheduled" ? releaseAt || null : null,
        },
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
          <div><span className="dct-hero-kicker">TESTDZ · DEVELOPER SPACE</span><h1>{step === 2 ? <>Select Your <em>App</em></> : step === 3 ? <>Configure <em>Test</em></> : <>Create New <em>Test</em></>}</h1><p>{step === 2 ? "Choose the application you want to test." : step === 3 ? "Set up the details for your testing campaign." : "Choose the right testing flow for your application."}</p></div>
          {step === 3 && selectedType && <span className="dct-hero-type-pill">{selectedType.title}</span>}{step === 2 && <button type="button" className="dct-hero-back" onClick={() => { setSaveError(""); setStep(1); }}><span aria-hidden="true">←</span> Back to Test Types</button>}
          <div className="dct-hero-art" aria-hidden="true"><span className="dct-android">♟</span><span className="dct-hero-phone">✓</span><span className="dct-hero-checklist">☑<br />☑<br />☑</span></div>
        </section>

        <nav className="dct-steps dct-six-steps" aria-label="Test creation steps">
          {steps.map((label, index) => <button type="button" key={label} className={step === index + 1 ? "current" : step > index + 1 ? "done" : ""} onClick={() => { if (index + 1 <= step) setStep((index + 1) as Stage); }}>
            <span>{step > index + 1 ? <Icon name="check" size={16} /> : index + 1}</span><small>{label}</small>
          </button>)}
        </nav>

        <div className={"dct-workspace dct-workspace-step-" + step}>
          <section className="dct-main-card">
            <div className={"dct-section-heading dct-step-heading-" + step}>
              <span className="dct-heading-icon"><Icon name={step === 2 ? "apps" : step === 4 ? "details" : step === 5 ? "calendar" : step === 6 ? "check" : "tests"} size={25} /></span>
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

            {step === 3 && testType === "google_play_closed" && <div className="dct-config-layout">
              <div className="dct-config-main">
                <div className="dct-config-title"><span className="dct-play-mark">▶</span><div><h3>Google Play Closed Testing Settings</h3><p>Configure your closed testing campaign for Google Play</p></div></div>
                <div className="dct-track-panel">
                  <span className="dct-config-symbol"><Icon name="users" size={25} /></span>
                  <div className="dct-track-copy"><strong>Testing Track <i>*</i></strong><small>Choose the track for your testing campaign</small></div>
                  <select value={playTrack} onChange={e => setPlayTrack(e.target.value as typeof playTrack)} aria-label="Testing track"><option value="internal">Internal Testing</option><option value="closed">Closed Testing</option><option value="open">Open Testing</option></select>
                  <p className="dct-track-hint"><Icon name="info" size={15} />{playTrack === "internal" ? "Internal testing is intended for quick validation with a limited group." : playTrack === "closed" ? "Closed testing lets you manage access to a selected tester group." : "Open testing can make a test available to a broader eligible audience."} TestDZ stores this choice; it does not publish to Google Play.</p>
                </div>
                <div className="dct-testers-method">
                  <div className="dct-config-subtitle"><span className="dct-config-symbol plain"><Icon name="users" size={25} /></span><div><strong>Testers</strong><small>Select how to configure tester access for this campaign</small></div></div>
                  <div className="dct-method-grid">
                    <button type="button" className={"dct-method-card " + (testerMethod === "join_link" ? "selected" : "")} onClick={() => setTesterMethod("join_link")}><span className="dct-method-radio"/><span className="dct-method-icon link">↗</span><strong>Join Link</strong><small>Share a link with testers</small></button>
                    <button type="button" className={"dct-method-card " + (testerMethod === "google_groups" ? "selected" : "")} onClick={() => setTesterMethod("google_groups")}><span className="dct-method-radio"/><span className="dct-method-icon mail">✉</span><strong>Google Groups</strong><small>Use a Google group</small></button>
                    <button type="button" className={"dct-method-card " + (testerMethod === "upload_list" ? "selected" : "")} onClick={() => setTesterMethod("upload_list")}><span className="dct-method-radio"/><span className="dct-method-icon list">♟</span><strong>Upload List</strong><small>Add testers via CSV</small></button>
                  </div>
                  {testerMethod === "google_groups" && <label className="dct-config-field">Google Group email<input value={googleGroup} onChange={e => setGoogleGroup(e.target.value)} type="email" placeholder="testers@googlegroups.com" /></label>}
                  {testerMethod === "upload_list" && <div className="dct-config-field"><label htmlFor="dct-tester-csv">Tester email CSV</label><input id="dct-tester-csv" type="file" accept=".csv,text/csv" onChange={async e => { const file = e.target.files?.[0]; if (!file) return; setTesterFileName(file.name); const text = await file.text(); const emails = Array.from(new Set((text.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi) ?? []).map(email => email.toLowerCase()))); setTesterEmails(emails); }} /><small>{testerFileName ? testerEmails.length + " email address(es) read from " + testerFileName + ". Saved as draft configuration only." : "Choose a CSV file. Email addresses are parsed locally and are not invited automatically."}</small></div>}
                </div>
                <div className="dct-config-row">
                  <span className="dct-config-symbol"><Icon name="apps" size={23} /></span><div className="dct-track-copy"><strong>App Version</strong><small>Select the app version to test</small></div>
                  <select value={appVersion} onChange={e => setAppVersion(e.target.value)} aria-label="App version"><option value="latest_available">Latest available version (not verified)</option><option value="to_be_uploaded">Version to be added later</option></select><span className="dct-ready-label">Draft configuration</span>
                </div>
                <div className="dct-release-block">
                  <div className="dct-config-subtitle"><span className="dct-config-symbol plain">➤</span><div><strong>Release to Track</strong><small>Choose when this campaign is planned to be available</small></div></div>
                  <div className="dct-release-grid">
                    <button type="button" className={"dct-release-option " + (releaseMode === "immediately" ? "selected" : "")} onClick={() => setReleaseMode("immediately")}><span className="dct-method-radio"/><span><strong>Immediately</strong><small>Ready for review as soon as the draft is saved</small></span></button>
                    <button type="button" className={"dct-release-option " + (releaseMode === "scheduled" ? "selected" : "")} onClick={() => setReleaseMode("scheduled")}><span className="dct-method-radio"/><span><strong>Schedule for later</strong><small>Choose a planned date and time</small></span></button>
                  </div>
                  {releaseMode === "scheduled" && <label className="dct-config-field">Planned date and time<input type="datetime-local" value={releaseAt} onChange={e => setReleaseAt(e.target.value)} /></label>}
                  <p className="dct-field-note">This is a TestDZ campaign preference only. No Google Play release is triggered from this screen.</p>
                </div>
              </div>
              <aside className="dct-config-summary">
                <div className="dct-config-summary-head"><Icon name="info" size={21}/><strong>Testing Type Summary</strong></div>
                <div className="dct-config-summary-body"><span className="dct-summary-play">▶</span><div><strong>Google Play Closed Testing</strong><p>Prepare a controlled testing campaign before public release.</p></div></div>
                <ul><li>Choose a testing track</li><li>Configure tester access</li><li>Store campaign settings for review</li></ul>
                <div className="dct-pro-tip"><span>☼</span><div><strong>Pro Tip</strong><p>Start with internal testing to validate your app with a small group first.</p></div></div>
                <div className="dct-config-illustration" aria-hidden="true"><span>▶</span><b>✓</b></div>
              </aside>
            </div>}

            {step === 3 && testType !== "google_play_closed" && <div className="dct-form-grid"><div className="dct-capability dct-inline-note"><span><Icon name="info" size={22} /></span><div><strong>{selectedType?.title ?? "Testing"} configuration</strong><p>This campaign type uses general configuration for now. Type-specific integrations can be added separately without claiming an external release has occurred.</p></div></div><label>Android version / device rule<select value={androidVersion} onChange={e => setAndroidVersion(e.target.value)}><option>Any supported version</option><option>Android 10 and newer</option><option>Android 12 and newer</option><option>Android 14 and newer</option></select></label></div>}

            {step === 4 && <div className="dct-details-layout">
  <div className="dct-details-main">
    <section className="dct-details-section">
      <div className="dct-details-heading"><span className="dct-details-icon"><Icon name="details" size={24}/></span><div><h3>Campaign Information</h3><p>Basic information about your testing campaign</p></div></div>
      <label className="dct-details-field">Test Name <i>*</i><input value={title} onChange={e=>setTitle(e.target.value)} maxLength={100} placeholder="e.g. TestDZ Pro — Closed Testing" /></label>
      <label className="dct-details-field">Test Description<textarea value={description} onChange={e=>setDescription(e.target.value)} maxLength={2000} placeholder="Explain what this campaign should validate before release…" /></label>
    </section>
    <section className="dct-details-section">
      <div className="dct-details-heading"><span className="dct-details-icon"><Icon name="target" size={24}/></span><div><h3>Testing Objective</h3><p>Choose the primary goal and priority for this campaign</p></div></div>
      <div className="dct-details-two-col">
        <label className="dct-details-field">Testing Objective<select value={testingObjective} onChange={e=>setTestingObjective(e.target.value)}><option value="stability_bugs">Stability & Bug Discovery</option><option value="usability">Usability & User Experience</option><option value="compatibility">Device Compatibility</option><option value="performance">Performance</option><option value="release_readiness">Release Readiness</option><option value="custom">Custom Objective</option></select></label>
        <label className="dct-details-field">Priority<select value={priority} onChange={e=>setPriority(e.target.value as typeof priority)}><option value="low">Low</option><option value="medium">Medium</option><option value="high">High</option></select></label>
      </div>
    </section>
    <section className="dct-details-section">
      <div className="dct-details-heading"><span className="dct-details-icon"><Icon name="scope" size={24}/></span><div><h3>Testing Scope</h3><p>What should testers focus on?</p></div></div>
      <div className="dct-scope-grid">
        {[{id:"core_flows",title:"Core user flows",desc:"Main journeys and key actions"},{id:"performance",title:"Performance",desc:"Speed, responsiveness, stability"},{id:"compatibility",title:"Compatibility",desc:"Devices and Android versions"},{id:"accessibility",title:"Accessibility",desc:"Readability and inclusive use"}].map(item=><label key={item.id} className={"dct-scope-option "+(testingScope.includes(item.id)?"selected":"")}><input type="checkbox" checked={testingScope.includes(item.id)} onChange={e=>setTestingScope(current=>e.target.checked?[...current,item.id]:current.filter(value=>value!==item.id))}/><span className="dct-scope-check">{testingScope.includes(item.id)?"✓":""}</span><span><strong>{item.title}</strong><small>{item.desc}</small></span></label>)}
      </div>
    </section>
    <section className="dct-details-section">
      <div className="dct-details-heading"><span className="dct-details-icon"><Icon name="users" size={24}/></span><div><h3>Instructions for Testers</h3><p>Give participants a clear task and reporting guidance</p></div></div>
      <label className="dct-details-field">Tester Instructions<textarea value={instructions} onChange={e=>setInstructions(e.target.value)} maxLength={3000} placeholder="Install the selected build, complete the main user flows, and report reproducible issues with device details…"/></label>
    </section>
    <section className="dct-details-section dct-success-section">
      <div className="dct-details-heading"><span className="dct-details-icon"><Icon name="flag" size={24}/></span><div><h3>Success Criteria</h3><p>Define how you will evaluate the results</p></div></div>
      <div className="dct-details-two-col">
        <label className="dct-details-field">Target Outcome<input value={successCriteria} onChange={e=>setSuccessCriteria(e.target.value)} maxLength={300} placeholder="e.g. No critical bugs; core flows pass"/></label>
        <label className="dct-details-field">Minimum Completion Rate (%)<input type="number" min={1} max={100} value={minimumCompletionRate} onChange={e=>setMinimumCompletionRate(Number(e.target.value))}/></label>
      </div>
    </section>
    <p className="dct-details-note"><Icon name="info" size={17}/> Details are stored in the TestDZ draft. This step does not publish to Google Play or send tester invitations.</p>
  </div>
  <aside className="dct-details-summary">
    <div className="dct-details-summary-head"><Icon name="info" size={21}/><strong>Campaign Summary</strong></div>
    <div className="dct-details-app"><AppIcon app={selected} /><div><strong>{selected?.name ?? "Selected application"}</strong><small dir="ltr">{selected?.package_name ?? "Choose an app in step 2"}</small><span className="dct-details-chip">{selectedType?.title ?? "Test type not selected"}</span></div></div>
    <div className="dct-details-summary-list">
      <div><span>Campaign</span><strong>{title.trim() || "Not named yet"}</strong></div>
      <div><span>Objective</span><strong>{({stability_bugs:"Stability & Bug Discovery",usability:"Usability & User Experience",compatibility:"Device Compatibility",performance:"Performance",release_readiness:"Release Readiness",custom:"Custom Objective"} as Record<string,string>)[testingObjective]}</strong></div>
      <div><span>Priority</span><strong className={"dct-priority-"+priority}>{priority.charAt(0).toUpperCase()+priority.slice(1)}</strong></div>
      <div><span>Testing Scope</span><strong>{testingScope.length} area{testingScope.length===1?"":"s"} selected</strong></div>
      <div><span>Completion Goal</span><strong>{minimumCompletionRate}%</strong></div>
    </div>
    <div className="dct-details-tip"><span>💡</span><div><strong>Pro Tip</strong><p>Specific objectives and clear tasks make feedback easier to evaluate.</p></div></div>
  </aside>
</div>}

            {step === 5 && <div className="dct-schedule-layout">
  <div className="dct-schedule-main">
    <section className="dct-schedule-section">
      <div className="dct-schedule-heading"><span className="dct-schedule-big-icon"><Icon name="calendar" size={27} /></span><div><h3>Test Duration</h3><p>Choose how long your test will run</p></div></div>
      <div className="dct-duration-row">
        <label className="dct-duration-select"><Icon name="calendar" size={21}/><select aria-label="Test duration" value={durationDays} onChange={e => { const next=e.target.value as typeof durationDays; setDurationDays(next); if(next !== "custom" && startDate) { const end=new Date(startDate+"T12:00:00"); end.setDate(end.getDate()+Number(next)); setEndDate(end.toISOString().slice(0,10)); } }}><option value="7">7 days</option><option value="14">14 days</option><option value="30">30 days</option><option value="custom">Custom duration</option></select></label>
        <div className="dct-date-range"><Icon name="calendar" size={19}/><span>{startDate || "Choose start date"} – {endDate || "Choose end date"}</span></div>
      </div>
      <div className="dct-date-fields"><label>Start date<input type="date" value={startDate} onChange={e => { setStartDate(e.target.value); if(durationDays !== "custom" && e.target.value) { const end=new Date(e.target.value+"T12:00:00"); end.setDate(end.getDate()+Number(durationDays)); setEndDate(end.toISOString().slice(0,10)); } }} /></label><label>End date<input type="date" value={endDate} min={startDate || undefined} onChange={e => { setEndDate(e.target.value); setDurationDays("custom"); }} /></label></div>
    </section>
    <section className="dct-schedule-section">
      <div className="dct-schedule-heading"><span className="dct-schedule-big-icon"><Icon name="users" size={27}/></span><div><h3>Testers</h3><p>Select how many testers will participate</p></div></div>
      <div className="dct-tester-count-row"><label className="dct-tester-count"><Icon name="users" size={23}/><span><strong>{targetTesters <= 100 ? "Up to " + targetTesters + " testers" : targetTesters + " testers"}</strong><small>Recommended: 20–100 testers</small></span><select aria-label="Target testers" value={targetTesters} onChange={e => setTargetTesters(Number(e.target.value))}>{[10,20,30,50,75,100,150,200,300,500].map(n=><option key={n} value={n}>{n} testers</option>)}</select></label><label className="dct-allow-more"><input type="checkbox" checked={allowMoreTesters} onChange={e => setAllowMoreTesters(e.target.checked)}/><span><strong>Allow more testers</strong><small>If needed</small></span></label></div>
    </section>
    <section className="dct-schedule-section">
      <div className="dct-schedule-heading"><span className="dct-schedule-big-icon"><Icon name="arrow" size={27}/></span><div><h3>Joining Method</h3><p>Choose how testers will join your test</p></div></div>
      <div className="dct-join-grid">
        <button type="button" className={"dct-join-card "+(joiningMethod==="google_play_link"?"selected":"")} onClick={()=>setJoiningMethod("google_play_link")}><span className="dct-join-check">{joiningMethod==="google_play_link"?"✓":""}</span><span className="dct-join-symbol play">▶</span><strong>Google Play Link</strong><small>Share a link</small></button>
        <button type="button" className={"dct-join-card "+(joiningMethod==="closed_group"?"selected":"")} onClick={()=>setJoiningMethod("closed_group")}><span className="dct-join-check">{joiningMethod==="closed_group"?"✓":""}</span><span className="dct-join-symbol group"><Icon name="users" size={29}/></span><strong>Closed Group</strong><small>Invite specific testers</small></button>
        <button type="button" className={"dct-join-card "+(joiningMethod==="upload_list"?"selected":"")} onClick={()=>setJoiningMethod("upload_list")}><span className="dct-join-check">{joiningMethod==="upload_list"?"✓":""}</span><span className="dct-join-symbol upload">☁</span><strong>Upload List</strong><small>Add testers via CSV</small></button>
        <button type="button" className={"dct-join-card "+(joiningMethod==="open_testing"?"selected":"")} onClick={()=>setJoiningMethod("open_testing")}><span className="dct-join-check">{joiningMethod==="open_testing"?"✓":""}</span><span className="dct-join-symbol globe">◎</span><strong>Open Testing</strong><small>Anyone with link</small></button>
      </div>
    </section>
    <section className="dct-schedule-section dct-extra-settings">
      <div className="dct-schedule-heading"><span className="dct-schedule-big-icon"><span aria-hidden="true">⚙</span></span><div><h3>Additional Settings</h3><p>Configure extra options for your test</p></div></div>
      <div className="dct-toggle-grid"><label className="dct-toggle-option"><input type="checkbox" checked={collectFeedback} onChange={e=>setCollectFeedback(e.target.checked)}/><span className="dct-toggle-track"></span><span><strong>Collect Feedback</strong><small>Ask testers for feedback after testing</small></span></label><label className="dct-toggle-option"><input type="checkbox" checked={enableBugReports} onChange={e=>setEnableBugReports(e.target.checked)}/><span className="dct-toggle-track"></span><span><strong>Enable Bug Reports</strong><small>Allow testers to report bugs</small></span></label></div>
    </section>
    <label className="dct-cohort-notes">Cohort preferences (optional)<textarea value={cohortNotes} onChange={e=>setCohortNotes(e.target.value)} maxLength={1000} placeholder="Device coverage, tester experience, or cohort notes…"/></label>
    <label className="dct-cohort-notes">Tester instructions<textarea value={instructions} onChange={e=>setInstructions(e.target.value)} maxLength={3000} placeholder="Describe the tasks testers should perform and what feedback is useful…"/></label>
    <p className="dct-field-note">These settings are saved as draft configuration. TestDZ does not send invitations or publish to Google Play automatically.</p>
  </div>
  <aside className="dct-schedule-summary">
    <div className="dct-schedule-summary-head"><Icon name="info" size={22}/><strong>Test Summary</strong></div>
    <div className="dct-summary-app"><span className="dct-summary-play">▶</span><div><strong>{selectedType?.title ?? "Testing campaign"}</strong><p>Coordinate eligible testers before public release.</p></div></div>
    <div className="dct-summary-list">
      <div><Icon name="calendar" size={20}/><span>Duration</span><strong>{durationDays==="custom"?"Custom":durationDays+" days"}<small>{startDate||"Start date"} – {endDate||"End date"}</small></strong></div>
      <div><Icon name="users" size={20}/><span>Testers</span><strong>{allowMoreTesters?"Up to ":""}{targetTesters} testers</strong></div>
      <div><Icon name="arrow" size={20}/><span>Joining Method</span><strong>{joiningMethod==="google_play_link"?"Google Play Link":joiningMethod==="closed_group"?"Closed Group":joiningMethod==="upload_list"?"Upload List":"Open Testing"}</strong></div>
      <div><Icon name="info" size={20}/><span>Feedback</span><strong>{collectFeedback?"Enabled":"Disabled"}</strong></div>
      <div><Icon name="tests" size={20}/><span>Bug Reports</span><strong>{enableBugReports?"Enabled":"Disabled"}</strong></div>
    </div>
    <div className="dct-schedule-tip"><span>💡</span><div><strong>Pro Tip</strong><p>A good test duration is 1–2 weeks to gather meaningful feedback.</p></div></div>
  </aside>
</div>}

            {step === 6 && <><div className="dct-review"><div><span>Test type</span><strong>{selectedType?.title ?? "Not selected"}</strong></div><div><span>Testing track</span><strong>{playTrack === "internal" ? "Internal Testing" : playTrack === "closed" ? "Closed Testing" : "Open Testing"}</strong></div><div><span>Tester access</span><strong>{testerMethod === "join_link" ? "Join Link" : testerMethod === "google_groups" ? "Google Groups" : "CSV list (" + testerEmails.length + ")"}</strong></div><div><span>Release preference</span><strong>{releaseMode === "immediately" ? "Immediately (draft)" : releaseAt || "Schedule not set"}</strong></div><div><span>Application</span><strong>{selected?.name ?? "Not selected"}</strong></div><div><span>Test title</span><strong>{title || "Not entered"}</strong></div><div><span>Objective</span><strong>{({stability_bugs:"Stability & Bug Discovery",usability:"Usability & User Experience",compatibility:"Device Compatibility",performance:"Performance",release_readiness:"Release Readiness",custom:"Custom Objective"} as Record<string,string>)[testingObjective]}</strong></div><div><span>Priority</span><strong>{priority}</strong></div><div><span>Testing scope</span><strong>{testingScope.length} area(s)</strong></div><div><span>Success criteria</span><strong>{successCriteria || "Not set"} ({minimumCompletionRate}%)</strong></div><div><span>Target testers</span><strong>{targetTesters}{allowMoreTesters ? " (flexible)" : ""}</strong></div><div><span>Testing period</span><strong>{startDate || "Not set"} → {endDate || "Not set"}</strong></div><div><span>Duration</span><strong>{durationDays === "custom" ? "Custom" : durationDays + " days"}</strong></div><div><span>Joining method</span><strong>{joiningMethod === "google_play_link" ? "Google Play Link" : joiningMethod === "closed_group" ? "Closed Group" : joiningMethod === "upload_list" ? "Upload List" : "Open Testing"}</strong></div><div><span>Feedback</span><strong>{collectFeedback ? "Enabled" : "Disabled"}</strong></div><div><span>Bug reports</span><strong>{enableBugReports ? "Enabled" : "Disabled"}</strong></div><div><span>Android rule</span><strong>{androidVersion}</strong></div><div><span>App version preference</span><strong>{appVersion === "latest_available" ? "Latest available (unverified)" : "To be added later"}</strong></div><div><span>Campaign status</span><strong className="dct-review-draft">Draft</strong></div></div><div className="dct-capability dct-inline-note"><span><Icon name="info" size={22} /></span><div><strong>Review & create draft</strong><p>Saving creates a TestDZ draft. It does not publish to Google Play, upload an APK, or automatically recruit testers.</p></div></div></>}

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
