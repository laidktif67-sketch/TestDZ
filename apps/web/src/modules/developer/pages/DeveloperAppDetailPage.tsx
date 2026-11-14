import { useEffect, useState } from "react";
import type { FormEvent } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import type { AppRecord } from "@testdz/types";
import { identityApi } from "../../../features/identity/identity-api";
import { APP_CATEGORIES, appError } from "../../../lib/app-utils";
import { archiveApp, getAppById, listAppTests, restoreApp, updateApp } from "../../../features/apps/apps-api";
import DeveloperSidebar from "../components/DeveloperSidebar";
import "../styles/developer-app-detail.css";

type AppTest = {
  id: string;
  title: string;
  status: string;
  created_at: string;
  start_date: string | null;
  end_date: string | null;
};
type Tab = "overview" | "tests" | "versions";

function statusLabel(status: string) {
  const labels: Record<string, string> = {
    draft: "Draft",
    published: "Published",
    paused: "Paused",
    archived: "Archived",
    recruiting: "Recruiting",
    active: "Active",
    completed: "Completed",
    cancelled: "Cancelled",
    failed: "Failed",
    pending: "Pending",
  };
  return labels[status] ?? status.replaceAll("_", " ");
}

function AppDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [app, setApp] = useState<AppRecord | null>(null);
  const [tests, setTests] = useState<AppTest[]>([]);
  const [loading, setLoading] = useState(true);
  const [testsLoading, setTestsLoading] = useState(true);
  const [error, setError] = useState("");
  const [editing, setEditing] = useState(() => new URLSearchParams(window.location.search).get("edit") === "1");
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState("other");
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");
  const [tab, setTab] = useState<Tab>("overview");
  const [copied, setCopied] = useState(false);

  async function loadApp(showLoading = true) {
    if (!identityApi.isConfigured() || !id) {
      setError("The application could not be loaded. Please check your connection and try again.");
      setLoading(false);
      return;
    }
    if (showLoading) setLoading(true);
    const { data, error: loadError } = await getAppById(id);
    if (loadError || !data) {
      setError("This app could not be found, or you do not have permission to view it.");
      setApp(null);
    } else {
      const record = data as AppRecord;
      setApp(record);
      setName(record.name);
      setDescription(record.description ?? "");
      setCategory(record.category ?? "other");
      setError("");
    }
    setLoading(false);
  }

  async function loadTests(appId: string) {
    setTestsLoading(true);
    const { data, error: testsError } = await listAppTests(appId);
    if (testsError) {
      setTests([]);
      setError((current) => current || "Related tests could not be loaded.");
    } else {
      setTests((data ?? []) as AppTest[]);
    }
    setTestsLoading(false);
  }

  useEffect(() => {
    void loadApp();
  }, [id]);

  useEffect(() => {
    if (app?.id) void loadTests(app.id);
  }, [app?.id]);

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!identityApi.isConfigured() || !id) return;
    setBusy(true);
    setError("");
    const { error: saveError } = await updateApp({ id, name: name.trim(), description: description.trim(), category });
    if (saveError) {
      setError(appError(saveError.message));
    } else {
      setNotice("App details saved successfully.");
      setEditing(false);
      await loadApp(false);
    }
    setBusy(false);
  }

  async function archive() {
    if (!identityApi.isConfigured() || !id || !window.confirm("Archive this app? You can restore it later.")) return;
    setBusy(true);
    setError("");
    const { error: actionError } = await archiveApp(id);
    if (actionError) setError(appError(actionError.message));
    else {
      setNotice("App archived.");
      await loadApp(false);
    }
    setBusy(false);
  }

  async function restore() {
    if (!identityApi.isConfigured() || !id) return;
    setBusy(true);
    setError("");
    const { error: actionError } = await restoreApp(id);
    if (actionError) setError(appError(actionError.message));
    else {
      setNotice("App restored.");
      await loadApp(false);
    }
    setBusy(false);
  }

  async function copyLink() {
    if (!app?.distribution_url) return;
    try {
      await navigator.clipboard.writeText(app.distribution_url);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
    } catch {
      setError("Could not copy the link automatically. Select and copy it from Application Information.");
    }
  }

  if (loading) {
    return <div className="dad-shell"><DeveloperSidebar /><main className="dad-main"><div className="dad-page"><p className="dad-muted">Loading application details…</p></div></main></div>;
  }

  if (!app) {
    return <div className="dad-shell"><DeveloperSidebar /><main className="dad-main"><div className="dad-page"><div className="dad-alert error">{error || "App not found."}</div><Link className="dad-back" to="/apps">← Back to My Apps</Link></div></main></div>;
  }

  const appStatus = statusLabel(app.status);
  const categoryLabel = APP_CATEGORIES.find((item) => item.value === app.category)?.label ?? "Other";
  const createdDate = new Date(app.created_at).toLocaleString("en-GB", { dateStyle: "medium", timeStyle: "short" });

  return (
    <div className="dad-shell">
      <DeveloperSidebar />
      <main className="dad-main">
        <header className="dad-topbar">
          <label className="dad-search"><span>⌕</span><input aria-label="Search in TestDZ" placeholder="Search in TestDZ…" onKeyDown={(event) => { if (event.key === "Escape") event.currentTarget.blur(); }} /></label>
          <div className="dad-account"><span className="dad-bell" aria-label="Notifications">♧</span><span>🇬🇧 EN</span><span className="dad-avatar">DV</span></div>
        </header>

        <div className="dad-page">
          <nav className="dad-breadcrumb" aria-label="Breadcrumb"><Link to="/apps">My Apps</Link><span>›</span><strong>App Details</strong></nav>

          <section className="dad-hero">
            <div className="dad-app-icon">{app.icon_url ? <img src={app.icon_url} alt="" /> : <span aria-hidden="true">▦</span>}</div>
            <div className="dad-hero-copy">
              <div className="dad-hero-title"><h1>{app.name}</h1><span className={`dad-status ${app.status}`}>{appStatus}</span></div>
              <p>{app.description || "No description has been added yet."}</p>
              <div className="dad-package"><span dir="ltr">{app.package_name}</span>{app.distribution_url && <button type="button" className="dad-button quiet" onClick={copyLink}>{copied ? "Copied" : "Copy link"}</button>}</div>
            </div>
            <div className="dad-hero-actions">
              {app.status !== "archived" && <button type="button" className="dad-button white" onClick={() => { setEditing((current) => !current); setTab("overview"); }}>✎ {editing ? "Close editor" : "Edit App"}</button>}
              <button type="button" className="dad-button white" onClick={() => { setTab("tests"); document.getElementById("dad-detail-content")?.scrollIntoView({ behavior: "smooth", block: "start" }); }}>▤ Related Tests</button>
            </div>
          </section>

          <div className="dad-tabs" role="tablist" aria-label="App details sections">
            <button type="button" role="tab" aria-selected={tab === "overview"} className={`dad-tab ${tab === "overview" ? "active" : ""}`} onClick={() => setTab("overview")}>ⓘ Overview</button>
            <button type="button" role="tab" aria-selected={tab === "tests"} className={`dad-tab ${tab === "tests" ? "active" : ""}`} onClick={() => setTab("tests")}>⚗ Related Tests <span>{tests.length}</span></button>
            <button type="button" role="tab" aria-selected={tab === "versions"} className={`dad-tab ${tab === "versions" ? "active" : ""}`} onClick={() => setTab("versions")}>◈ Version History</button>
          </div>

          {notice && <div className="dad-alert">{notice}</div>}
          {error && <div className="dad-alert error">{error}</div>}

          <div id="dad-detail-content" className="dad-layout">
            <div className="dad-column">
              {tab === "overview" && <>
                <section className="dad-card">
                  <div className="dad-card-heading"><span>ⓘ</span><div><h2>Application Information</h2><p>Basic information about your application</p></div></div>
                  {editing ? (
                    <form className="dad-edit-form" onSubmit={save}>
                      <label>App Name<input required minLength={3} maxLength={50} value={name} onChange={(event) => setName(event.target.value)} /></label>
                      <label>Category<select value={category} onChange={(event) => setCategory(event.target.value)}>{APP_CATEGORIES.map((item) => <option value={item.value} key={item.value}>{item.label}</option>)}</select></label>
                      <label className="wide">Description<textarea required minLength={20} maxLength={500} value={description} onChange={(event) => setDescription(event.target.value)} /></label>
                      <div className="dad-form-actions"><button type="button" className="dad-button quiet" onClick={() => { setEditing(false); setName(app.name); setDescription(app.description ?? ""); setCategory(app.category ?? "other"); }}>Cancel</button><button className="dad-button primary" disabled={busy}>{busy ? "Saving…" : "Save Changes"}</button></div>
                    </form>
                  ) : (
                    <div className="dad-app-overview">
                      <div className="dad-identity"><div className="dad-big-icon">{app.icon_url ? <img src={app.icon_url} alt="" /> : <span aria-hidden="true">▦</span>}</div><dl className="dad-fields"><dt>App Name</dt><dd>{app.name}</dd><dt>Package ID</dt><dd dir="ltr">{app.package_name}</dd><dt>Category</dt><dd>{categoryLabel}</dd><dt>Description</dt><dd>{app.description || "No description provided."}</dd></dl></div>
                      <div className="dad-distribution"><h3>↗ Distribution Method</h3><span className="dad-status">{app.distribution_method === "apk_upload" ? "APK Upload" : app.distribution_method === "external_link" && app.distribution_url ? "External Link" : "Not configured"}</span>{app.distribution_url ? <><h3 style={{ marginTop: 18 }}>App Distribution Link</h3><div className="dad-link-box"><a href={app.distribution_url} target="_blank" rel="noreferrer" dir="ltr">{app.distribution_url}</a><button type="button" onClick={copyLink}>{copied ? "Copied" : "Copy"}</button></div></> : <p>No distribution link has been saved for this app yet.</p>}</div>
                    </div>
                  )}
                </section>

                <section className="dad-card">
                  <div className="dad-card-heading"><span>⚗</span><div><h2>Related Tests</h2><p>Tests created for this application</p></div><button type="button" className="dad-button outline" style={{ marginLeft: "auto" }} onClick={() => navigate("/developer/tests")}>View All Tests →</button></div>
                  {testsLoading ? <p className="dad-muted">Loading related tests…</p> : tests.length === 0 ? <div className="dad-empty">No tests are linked to this app yet.<br />Create a test and select this app to see it listed here.<br /><button type="button" className="dad-button primary" style={{ marginTop: 12 }} onClick={() => navigate("/developer/tests/new")}>＋ Create Test</button></div> : <div className="dad-table-wrap"><table className="dad-table"><thead><tr><th>Test Name</th><th>Status</th><th>Created</th><th>Actions</th></tr></thead><tbody>{tests.slice(0, 5).map((test) => <tr key={test.id}><td><div className="dad-test-title"><span className="dad-test-icon">▤</span><strong>{test.title}</strong></div></td><td><span className={`dad-status ${test.status}`}>{statusLabel(test.status)}</span></td><td>{new Date(test.created_at).toLocaleDateString("en-GB")}</td><td><Link className="dad-button outline" to={`/developer/tests/${test.id}`}>View Details →</Link></td></tr>)}</tbody></table></div>}
                </section>
              </>}

              {tab === "tests" && <section className="dad-card">
                <div className="dad-card-heading"><span>⚗</span><div><h2>Related Tests</h2><p>Tests connected to {app.name}</p></div><button type="button" className="dad-button primary" style={{ marginLeft: "auto" }} onClick={() => navigate("/developer/tests/new")}>＋ Create Test</button></div>
                {testsLoading ? <p className="dad-muted">Loading related tests…</p> : tests.length === 0 ? <div className="dad-empty">There are no tests linked to this application yet.</div> : <div className="dad-table-wrap"><table className="dad-table"><thead><tr><th>Test Name</th><th>Status</th><th>Start Date</th><th>End Date</th><th>Action</th></tr></thead><tbody>{tests.map((test) => <tr key={test.id}><td><strong>{test.title}</strong></td><td><span className={`dad-status ${test.status}`}>{statusLabel(test.status)}</span></td><td>{test.start_date ? new Date(test.start_date).toLocaleDateString("en-GB") : "—"}</td><td>{test.end_date ? new Date(test.end_date).toLocaleDateString("en-GB") : "—"}</td><td><Link className="dad-button outline" to={`/developer/tests/${test.id}`}>View →</Link></td></tr>)}</tbody></table></div>}
              </section>}

              {tab === "versions" && <section className="dad-card"><div className="dad-card-heading"><span>◈</span><div><h2>Version History</h2><p>Manage releases of your application</p></div></div><div className="dad-version-placeholder"><span>ⓘ</span><div><strong>Version tracking is not available yet</strong><p>The current TestDZ app data model stores application details and a distribution link, but does not yet store version records. No version numbers or upload dates are shown here until version management is implemented.</p></div></div></section>}
            </div>

            <aside className="dad-column dad-aside">
              <section className="dad-card dad-status-card"><div className="dad-card-heading"><span>◉</span><div><h2>Application Status</h2><p>Current app availability</p></div></div><div className="dad-status-symbol">{app.status === "published" ? "✓" : app.status === "archived" ? "Ⅱ" : app.status === "paused" ? "Ⅱ" : "•"}</div><h3>{appStatus}</h3><p>{app.status === "published" ? "Your application is published on TestDZ." : app.status === "paused" ? "This app is paused." : app.status === "archived" ? "This app is archived and can be restored." : "This app is a draft and is not published yet."}</p><div className="dad-date-box">▦ Added on<strong>{createdDate}</strong></div></section>

              <section className="dad-card"><div className="dad-card-heading"><span>ϟ</span><div><h2>Quick Actions</h2><p>Common app management tasks</p></div></div><div className="dad-actions-stack">{app.distribution_url && <button type="button" className="dad-button outline" onClick={copyLink}>↗ {copied ? "Link Copied" : "Copy App Link"}</button>}<button type="button" className="dad-button outline" onClick={() => { setTab("tests"); document.getElementById("dad-detail-content")?.scrollIntoView({ behavior: "smooth", block: "start" }); }}>⚗ View Related Tests</button>{app.status === "archived" ? <button type="button" className="dad-button primary" onClick={restore} disabled={busy}>Restore App</button> : <button type="button" className="dad-button quiet" onClick={archive} disabled={busy}>Archive App</button>}</div></section>

              <section className="dad-note"><h3>💡 App Management Tip</h3><p>Keep your app details accurate and make sure the distribution link is valid and accessible to your testers. TestDZ currently supports external links; APK upload and version history require separate implementation.</p></section>
            </aside>
          </div>
        </div>
      </main>
    </div>
  );
}

export default AppDetailPage;
