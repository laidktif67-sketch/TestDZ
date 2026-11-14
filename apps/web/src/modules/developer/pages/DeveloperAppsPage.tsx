import { useEffect, useMemo, useState } from "react";
import type { FormEvent, ReactNode } from "react";
import { Link, useNavigate } from "react-router-dom";
import imageCompression from "browser-image-compression";
import type { AppLimit, AppRecord } from "@testdz/types";
import { identityApi } from "../../../features/identity/identity-api";
import { APP_CATEGORIES, appError } from "../../../lib/app-utils";
import { createApp, getAppLimit, listApps, uploadAppIcon } from "../../../features/apps/apps-api";
import { listAppMetricTests, listAppMetricAssignments, listAppMetricFeedback } from "../../../features/analytics/app-metrics-api";
import DeveloperSidebar from "../components/DeveloperSidebar";
import "../styles/developer-apps.css";

type Filter = "all" | "published" | "draft" | "paused" | "archived";
type Sort = "latest" | "oldest" | "name";

type AppMetrics = { tests: number; testers: number; rating: number | null };

function Glyph({ name, size = 20 }: { name: string; size?: number }) {
  const paths: Record<string, ReactNode> = {
    home: <><path d="m3 10 9-7 9 7"/><path d="M5 9v11h14V9M9 20v-6h6v6"/></>,
    apps: <><path d="m12 2 9 5-9 5-9-5 9-5Z"/><path d="m3 7 9 5 9-5M3 7v10l9 5 9-5V7M12 12v10"/></>,
    tests: <><path d="M9 3h6M10 3v5l-5 9a3 3 0 0 0 3 4h8a3 3 0 0 0 3-4l-5-9V3"/><path d="M8 14h8"/></>,
    code: <><path d="m8 8-4 4 4 4m8-8 4 4-4 4m-2-11-4 14"/></>,
    check: <path d="m5 12 4 4L19 6"/>,
    users: <><circle cx="9" cy="8" r="3"/><path d="M3 20v-2a6 6 0 0 1 12 0v2M16 5a3 3 0 0 1 0 6m2 3a5 5 0 0 1 3 5v1"/></>,
    chart: <><path d="M4 20V10M10 20V4M16 20v-7M22 20H2"/></>,
    feedback: <><path d="M4 5h16v12H9l-5 4V5Z"/><path d="M8 9h8M8 13h5"/></>,
    crown: <><path d="m2 8 5 4 5-8 5 8 5-4-2 12H4L2 8Z"/></>,
    settings: <><circle cx="12" cy="12" r="3"/><path d="m19 13 2 1-2 4-2-1-2 1v2H9v-2l-2-1-2 1-2-4 2-1v-2l-2-1 2-4 2 1 2-1V4h6v2l2 1 2-1 2 4-2 1z"/></>,
    help: <><circle cx="12" cy="12" r="9"/><path d="M9.5 9a2.6 2.6 0 1 1 4.3 2c-1.2 1-1.8 1.3-1.8 3M12 17h.01"/></>,
    search: <><circle cx="10.8" cy="10.8" r="7"/><path d="m16 16 4.5 4.5"/></>,
    plus: <path d="M12 5v14M5 12h14"/>,
    eye: <><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7Z"/><circle cx="12" cy="12" r="3"/></>,
    edit: <><path d="m4 16-.8 4.8L8 20l11-11-4-4L4 16Z"/><path d="m13.5 6.5 4 4"/></>,
    clock: <><circle cx="12" cy="12" r="9"/><path d="M12 7v5l4 2"/></>,
    download: <><path d="M12 3v12m-5-5 5 5 5-5M4 20h16"/></>,
    star: <path d="m12 2 3 6 7 1-5 5 1 7-6-3-6 3 1-7-5-5 7-1 3-6Z"/>,
    menu: <><circle cx="12" cy="5" r="1"/><circle cx="12" cy="12" r="1"/><circle cx="12" cy="19" r="1"/></>,
    close: <path d="m6 6 12 12M18 6 6 18"/>,
    arrow: <><path d="M4 12h15M13 6l6 6-6 6"/></>,
    android: <><path d="M5 9a7 7 0 0 1 14 0v8H5V9ZM8 3 6 1m10 2 2-2M8 12v1m8-1v1M8 17v4m8-4v4"/></>,
    apple: <path d="M16.5 12.5c0-2 1.7-3 1.8-3.1a4 4 0 0 0-3.2-1.7c-1.4-.1-2.7.8-3.4.8s-1.8-.8-3-.8a4.5 4.5 0 0 0-3.8 2.3c-1.6 2.7-.4 6.7 1.1 8.9.7 1.1 1.5 2.3 2.6 2.2 1-.1 1.4-.7 2.7-.7s1.7.7 2.8.7c1.1 0 1.8-1.1 2.5-2.2.8-1.2 1.1-2.4 1.1-2.5-.1 0-2.2-.9-2.2-3.9ZM14.2 6.2A4 4 0 0 0 15.1 3a4.2 4.2 0 0 0-2.8 1.5 3.8 3.8 0 0 0-.9 3.1 3.5 3.5 0 0 0 2.8-1.4Z"/>,
    fitness: <><path d="M3 10v4m4-7v10m10-10v10m4-7v4M7 12h10"/></>,
    game: <><path d="M6 8h12a4 4 0 0 1 3.8 5l-1 3a2 2 0 0 1-3.2 1l-2.3-2H8.7l-2.3 2a2 2 0 0 1-3.2-1l-1-3A4 4 0 0 1 6 8Z"/><path d="M7 11v4m-2-2h4m7-1h.01M18 14h.01"/></>
  };
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{paths[name] ?? paths.apps}</svg>;
}

function useUserId() {
  const [id, setId] = useState<string | null>(null);
  useEffect(() => { void identityApi.getCurrentUser().then(({ data }) => setId(data.user?.id ?? null)); }, []);
  return id;
}

function AppMark({ app }: { app: AppRecord }) {
  const kind = app.category?.toLowerCase() ?? "";
  return <span className={"dmy-app-mark " + (kind.includes("game") ? "game" : kind.includes("health") || kind.includes("fitness") ? "fitness" : "default")}>
    {app.icon_url ? <img src={app.icon_url} alt="" /> : <Glyph name={kind.includes("game") ? "game" : kind.includes("health") || kind.includes("fitness") ? "fitness" : "tests"} size={28} />}
  </span>;
}

function AppsPage() {
  const userId = useUserId();
  const navigate = useNavigate();
  const [apps, setApps] = useState<AppRecord[]>([]);
  const [appMetrics, setAppMetrics] = useState<Record<string, AppMetrics>>({});
  const [limit, setLimit] = useState<AppLimit | null>(null);
  const [filter, setFilter] = useState<Filter>("all");
  const [search, setSearch] = useState("");
  const [globalSearch, setGlobalSearch] = useState("");
  const [sort, setSort] = useState<Sort>("latest");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [busy, setBusy] = useState(false);
  const [name, setName] = useState("");
  const [packageName, setPackageName] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState("tools");
  const [icon, setIcon] = useState<File | null>(null);
  const [preview, setPreview] = useState("");
  const [notice, setNotice] = useState("");
  const [layout, setLayout] = useState<"grid" | "list">("grid");

  async function load() {
    if (!identityApi.isConfigured()) { setError("Supabase is not configured."); setLoading(false); return; }
    setLoading(true); setError("");
    const [{ data: rows, error: appsError }, { data: limits, error: limitError }] = await Promise.all([listApps(), getAppLimit()]);
    const appRows = (rows ?? []) as AppRecord[];
    if (appsError) setError("Could not load your applications. Please refresh and try again.");
    else setApps(appRows);
    if (!limitError) setLimit(Array.isArray(limits) ? limits[0] ?? null : limits as AppLimit);

    if (!appsError && appRows.length) {
      const appIds = appRows.map(app => app.id);
      const { data: tests, error: testsError } = await listAppMetricTests(appIds);
      if (!testsError) {
        const testRows = (tests ?? []) as { id: string; app_id: string }[];
        const testToApp = new Map(testRows.map(test => [test.id, test.app_id]));
        const next: Record<string, AppMetrics> = {};
        appIds.forEach(id => { next[id] = { tests: 0, testers: 0, rating: null }; });
        testRows.forEach(test => { if (next[test.app_id]) next[test.app_id].tests += 1; });
        if (testRows.length) {
          const { data: assignments, error: assignmentsError } = await listAppMetricAssignments(testRows.map(test => test.id));
          if (!assignmentsError) {
            const assignmentRows = (assignments ?? []) as { id: string; test_id: string; tester_id: string }[];
            const testersByApp = new Map<string, Set<string>>();
            const assignmentToApp = new Map<string, string>();
            assignmentRows.forEach(assignment => {
              const appId = testToApp.get(assignment.test_id);
              if (!appId || !next[appId]) return;
              if (!testersByApp.has(appId)) testersByApp.set(appId, new Set());
              if (assignment.tester_id) testersByApp.get(appId)?.add(assignment.tester_id);
              assignmentToApp.set(assignment.id, appId);
            });
            testersByApp.forEach((testers, appId) => { next[appId].testers = testers.size; });
            if (assignmentRows.length) {
              const { data: feedback, error: feedbackError } = await listAppMetricFeedback(assignmentRows.map(assignment => assignment.id));
              if (!feedbackError) {
                const ratingsByApp = new Map<string, number[]>();
                (feedback ?? []).forEach(item => {
                  if (typeof item.rating !== "number") return;
                  const appId = assignmentToApp.get(item.assignment_id);
                  if (!appId) return;
                  if (!ratingsByApp.has(appId)) ratingsByApp.set(appId, []);
                  ratingsByApp.get(appId)?.push(item.rating);
                });
                ratingsByApp.forEach((ratings, appId) => {
                  next[appId].rating = ratings.reduce((sum, rating) => sum + rating, 0) / ratings.length;
                });
              }
            }
          }
        }
        setAppMetrics(next);
      } else {
        setAppMetrics({});
      }
    } else if (!appsError) {
      setAppMetrics({});
    }
    setLoading(false);
  }

  useEffect(() => {
    if (!identityApi.isConfigured()) { setError("Supabase is not configured."); setLoading(false); return; }
    if (userId) void load();
    else void identityApi.getSession().then(({ data }) => {
      if (!data.session) { navigate("/auth", { replace: true }); setLoading(false); }
    });
  }, [userId]);
  useEffect(() => {
    if (!icon) { setPreview(""); return; }
    const url = URL.createObjectURL(icon);
    setPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [icon]);

  const counts = useMemo(() => ({
    total: apps.length,
    published: apps.filter(app => app.status === "published").length,
    draft: apps.filter(app => app.status === "draft").length,
  }), [apps]);

  const visible = useMemo(() => apps.filter(app => {
    const query = (search + " " + globalSearch).trim().toLowerCase();
    const matches = !query || (app.name + " " + app.package_name + " " + (app.description ?? "")).toLowerCase().includes(query);
    return matches && (filter === "all" || app.status === filter);
  }).sort((a, b) => sort === "name" ? a.name.localeCompare(b.name) : sort === "oldest" ? a.created_at.localeCompare(b.created_at) : b.created_at.localeCompare(a.created_at)), [apps, filter, search, sort]);

  async function chooseIcon(file?: File) {
    if (!file) return;
    if (!["image/png", "image/jpeg"].includes(file.type)) { setError("App icon must be PNG or JPG."); return; }
    try {
      const compressed = await imageCompression(file, { maxSizeMB: 0.45, maxWidthOrHeight: 512, useWebWorker: true });
      setIcon(new File([compressed], file.name.replace(/\.[^.]+$/, "") + ".jpg", { type: compressed.type || "image/jpeg" }));
      setError("");
    } catch { setError("Could not process this image. Please choose another."); }
  }

  function resetForm() {
    setName(""); setPackageName(""); setDescription(""); setCategory("tools"); setIcon(null); setPreview(""); setShowForm(false);
  }

  async function create(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!identityApi.isConfigured() || !userId) return;
    if (name.trim().length < 3 || name.trim().length > 50 || description.trim().length < 20 || description.trim().length > 500) { setError("App name must be 3–50 characters and description 20–500 characters."); return; }
    if (!/^[a-z][a-z0-9_]*(\.[a-z][a-z0-9_]*)+$/.test(packageName.trim())) { setError("Invalid package name. Example: dz.testdz.myapp"); return; }
    setBusy(true); setError(""); setNotice("");
    const { data: appId, error: createError } = await createApp({ name, packageName, description, category });
    if (createError) { setError(appError(createError.message)); setBusy(false); return; }
    let warning = "";
    if (icon) {
      const { uploadError, updateError } = await uploadAppIcon(userId, String(appId), icon, { name, description, category });
      if (uploadError || updateError) warning = "The app was created, but its icon could not be fully saved.";
    }
    resetForm(); setNotice("Application created as a draft."); await load();
    if (warning) setError(warning);
    setBusy(false);
  }

  return <main className="dmy-shell">
    <DeveloperSidebar />

    <section className="dmy-content">
      <header className="dmy-topbar">
        <label className="dmy-global-search"><Glyph name="search"/><input placeholder="Search your apps..." value={globalSearch} onChange={e => setGlobalSearch(e.target.value)}/></label>
        <div className="dmy-user"><button type="button" className="dmy-bell" aria-label="Notifications">♧<i>3</i></button><span className="dmy-avatar">D</span><strong>Developer</strong><span>⌄</span></div>
      </header>

      <div className="dmy-page">
        <section className="dmy-hero">
          <div className="dmy-hero-copy"><span className="dmy-kicker"><Glyph name="apps" size={17}/> My Apps</span><h1>Manage Your Apps</h1><p>Add, organize and track your applications on TestDZ</p><button type="button" className="dmy-hero-button" onClick={() => { setError(""); setShowForm(true); }} disabled={!limit?.can_create}><Glyph name="plus" size={19}/> Add New App <Glyph name="arrow" size={18}/></button></div>
          <div className="dmy-hero-art" aria-hidden="true"><div className="dmy-orbit"/><span className="dmy-platform apple"><Glyph name="apple" size={37}/></span><span className="dmy-platform android"><Glyph name="android" size={38}/></span><div className="dmy-laptop"><span className="dmy-shield">✓</span><b>TestDZ</b></div><div className="dmy-phone"><span className="dmy-shield">✓</span></div></div>
        </section>

        {notice && <div className="dmy-notice success">{notice}</div>}
        {error && <div className="dmy-notice error">{error}</div>}

        <section className="dmy-stats" aria-label="Application statistics">
          <article className="dmy-stat blue"><span className="dmy-stat-icon"><Glyph name="apps" size={29}/></span><div><strong>{counts.total}</strong><b>Total Apps</b></div><span className="dmy-bars"><i/><i/><i/><i/></span></article>
          <article className="dmy-stat green"><span className="dmy-stat-icon"><Glyph name="check" size={29}/></span><div><strong>{counts.published}</strong><b>Published</b></div><span className="dmy-bars"><i/><i/><i/><i/></span></article>
          <article className="dmy-stat amber"><span className="dmy-stat-icon"><Glyph name="clock" size={29}/></span><div><strong>{counts.draft}</strong><b>Drafts</b></div><span className="dmy-bars"><i/><i/><i/><i/></span></article>
        </section>

        {limit && <section className="dmy-usage" aria-label="Application plan usage">
          <div className="dmy-usage-copy"><span className="dmy-usage-icon"><Glyph name="apps" size={19}/></span><div><strong>Application slots</strong><small>{limit.current_active_apps} of {limit.max_active_apps} active app slots used</small></div></div>
          <div className="dmy-usage-track" role="progressbar" aria-label="Active app slots used" aria-valuemin={0} aria-valuemax={limit.max_active_apps} aria-valuenow={Math.min(limit.current_active_apps, limit.max_active_apps)}><span style={{width: (limit.max_active_apps > 0 ? Math.min(100, (limit.current_active_apps / limit.max_active_apps) * 100) : 0) + "%"}}/></div>
          <span className="dmy-usage-remaining">{Math.max(0, limit.max_active_apps - limit.current_active_apps)} available</span>
        </section>}

        <section className="dmy-toolbar">
          <label className="dmy-filter-search"><Glyph name="search"/><input placeholder="Search by app name or package..." value={search} onChange={e => setSearch(e.target.value)}/></label>
          <div className="dmy-filters">{(["all","published","draft","paused","archived"] as Filter[]).map(value => <button type="button" key={value} className={filter === value ? "selected" : ""} onClick={() => setFilter(value)}>{value === "all" ? "All" : value === "published" ? "Published" : value === "draft" ? "Draft" : value === "paused" ? "Paused" : "Archived"}</button>)}</div>
          <label className="dmy-sort">Sort by: <select value={sort} onChange={e => setSort(e.target.value as Sort)}><option value="latest">Latest</option><option value="oldest">Oldest</option><option value="name">Name</option></select></label>
          <div className="dmy-layout-toggle"><button type="button" aria-label="Grid view" className={layout === "grid" ? "selected" : ""} onClick={() => setLayout("grid")}>▦</button><button type="button" aria-label="List view" className={layout === "list" ? "selected" : ""} onClick={() => setLayout("list")}>☷</button></div>
        </section>

        {!loading && apps.length > 0 && <div className="dmy-results-line"><span>Showing <strong>{visible.length}</strong> of <strong>{apps.length}</strong> applications</span>{(search || globalSearch || filter !== "all") && <button type="button" onClick={() => { setSearch(""); setGlobalSearch(""); setFilter("all"); }}>Clear filters</button>}</div>}
        {loading ? <div className="dmy-empty">Loading your applications…</div> : visible.length === 0 ? <div className="dmy-empty"><span>▣</span><h2>{apps.length > 0 ? "No matching applications" : "Your workspace is ready"}</h2><p>{apps.length > 0 ? "No apps match the current search and status filters. Clear filters to see all your apps." : "Add your first application to start building your TestDZ workspace."}</p>{apps.length > 0 ? <button type="button" onClick={() => { setSearch(""); setGlobalSearch(""); setFilter("all"); }}>Clear filters</button> : <button type="button" onClick={() => setShowForm(true)} disabled={!limit?.can_create}>＋ Add New App</button>}</div> :
          <section className={"dmy-app-grid " + (layout === "list" ? "list-view" : "")}>{visible.map(app => <article className="dmy-app-card" key={app.id}>
            <div className="dmy-card-top"><AppMark app={app}/><div className="dmy-app-title"><strong>{app.name}</strong><small dir="ltr">{app.package_name}</small></div><span className={"dmy-status " + app.status}>{app.status === "published" ? "Published" : app.status === "draft" ? "Draft" : app.status === "paused" ? "Paused" : "Archived"}</span><button type="button" className="dmy-more" aria-label={"More actions for " + app.name} onClick={() => navigate("/apps/" + app.id)}><Glyph name="menu"/></button></div>
            <p className="dmy-description">{app.description || "No description added yet."}</p>
            <div className="dmy-card-metrics"><span><Glyph name="tests" size={18}/><b>{appMetrics[app.id]?.tests ?? 0}</b><small>Tests</small></span><span><Glyph name="users" size={18}/><b>{appMetrics[app.id]?.testers ?? 0}</b><small>Testers</small></span><span><Glyph name="star" size={18}/><b>{appMetrics[app.id]?.rating?.toFixed(1) ?? "—"}</b><small>Rating / 5</small></span></div>
            <div className="dmy-updated"><Glyph name="clock" size={16}/> Added {new Date(app.created_at).toLocaleDateString("en-US",{month:"short",day:"numeric",year:"numeric"})}</div>
            <div className="dmy-card-actions"><Link to={"/apps/" + app.id}><Glyph name="eye" size={17}/> View Details</Link><Link to={"/apps/" + app.id + "?edit=1"}><Glyph name="edit" size={17}/> Edit</Link>{app.status === "draft" ? <button type="button" disabled title="Test creation becomes available after the test workflow is implemented"><Glyph name="tests" size={17}/> Create Test</button> : app.status === "published" ? <button type="button" disabled title="Review submission is not available for this status yet">Submit for Review</button> : null}</div>
          </article>)}</section>}

        <footer className="dmy-footer">TestDZ · Build · Test · Improve</footer>
      </div>
    </section>

    {showForm && <div className="dmy-modal-backdrop" role="presentation" onMouseDown={e => { if (e.target === e.currentTarget) resetForm(); }}><section className="dmy-modal" role="dialog" aria-modal="true" aria-labelledby="dmy-new-app-title"><div className="dmy-modal-head"><div><small>DEVELOPER WORKSPACE</small><h2 id="dmy-new-app-title">Add New App</h2></div><button type="button" onClick={resetForm} aria-label="Close"><Glyph name="close"/></button></div><form onSubmit={create}>
      <label>App name<input required minLength={3} maxLength={50} value={name} onChange={e => setName(e.target.value)} placeholder="My Awesome App"/></label>
      <label>Package name<input required value={packageName} onChange={e => setPackageName(e.target.value)} dir="ltr" placeholder="com.example.myapp"/></label>
      <label>Description<textarea required minLength={20} maxLength={500} value={description} onChange={e => setDescription(e.target.value)} placeholder="Describe what your app does…"/></label>
      <label>Category<select value={category} onChange={e => setCategory(e.target.value)}>{APP_CATEGORIES.map(item => <option key={item.value} value={item.value}>{item.label}</option>)}</select></label>
      <label>App icon<input type="file" accept="image/png,image/jpeg" onChange={e => void chooseIcon(e.target.files?.[0])}/></label>
      {preview && <img src={preview} className="dmy-icon-preview" alt="App icon preview"/>}
      <div className="dmy-modal-actions"><button type="button" onClick={resetForm}>Cancel</button><button type="submit" disabled={busy}>{busy ? "Creating…" : "Create App"}</button></div>
    </form></section></div>}
  </main>;
}

export default AppsPage;
