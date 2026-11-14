import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { identityApi } from "../../../features/identity/identity-api";
import { useIdentity } from "../../../features/identity/hooks/useIdentity";
import { getTesterHeaderProfile } from "../../../features/profile/profile-api";
import { listTesterCheckIns, countUnreadTesterNotifications, listCheckInRewardLedger } from "../../../features/testers/checkins-api";
import TesterSidebar, { Icon } from "../components/TesterSidebar";
import "../styles/tester-dashboard.css";
import "../styles/check-in-history.css";

type AssignmentStatus = "pending" | "active" | "completed" | "withdrawn" | "failed" | "rejected" | string;
type CheckinRow = {
  id: string;
  assignment_id: string;
  checkin_date: string;
  created_at: string;
  note: string | null;
  evidence_url: string | null;
  points: number;
  assignment?: {
    id: string;
    status: AssignmentStatus;
    test?: {
      id: string;
      title: string;
      status: string;
      app?: { name: string; icon_url: string | null } | null;
    } | null;
  } | null;
};
type TabKey = "all" | "active" | "completed";
type StatusKey = "all" | "pending" | "active" | "completed" | "failed" | "rejected" | "withdrawn";
type SortKey = "newest" | "oldest";

const dateValue = (date: Date) => {
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60000);
  return local.toISOString().slice(0, 10);
};
const formatDate = (value: string, withTime = false) => {
  const date = new Date(value + (value.length === 10 ? "T12:00:00" : ""));
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleString(undefined, withTime
    ? { month: "short", day: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" }
    : { month: "short", day: "2-digit", year: "numeric" });
};
const statusLabel = (status?: string) => ({
  active: "Active", pending: "Pending", completed: "Completed",
  failed: "Failed", rejected: "Rejected", withdrawn: "Withdrawn"
}[status || ""] || "Not set");
const csvCell = (value: unknown) => '"' + String(value ?? "").replace(/"/g, '""') + '"';

function AppIcon({ name, url }: { name: string; url: string | null }) {
  return <span className="cih-app-icon">{url ? <img src={url} alt="" /> : <span>{name.slice(0, 1).toUpperCase()}</span>}</span>;
}

export default function CheckInHistoryPage() {
  const { session, roles = [] } = useIdentity();
  const [name, setName] = useState("Tester");
  const [avatar, setAvatar] = useState("");
  const [menuOpen, setMenuOpen] = useState(false);
  const [notifications, setNotifications] = useState(0);
  const [rows, setRows] = useState<CheckinRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");
  const [tab, setTab] = useState<TabKey>("all");
  const [status, setStatus] = useState<StatusKey>("all");
  const [appFilter, setAppFilter] = useState("all");
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState<SortKey>("newest");
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);
  const now = new Date();
  const [fromDate, setFromDate] = useState(dateValue(new Date(now.getFullYear(), now.getMonth(), 1)));
  const [toDate, setToDate] = useState(dateValue(new Date(now.getFullYear(), now.getMonth() + 1, 0)));
  const isAdmin = roles.includes("admin");
  const isDeveloper = roles.includes("developer");
  const firstName = name.split(/\s+/)[0] || "Tester";

  useEffect(() => {
    if (!session?.user?.id || !identityApi.isConfigured()) { setLoading(false); return; }
    let alive = true;
    async function load() {
      setLoading(true);
      setRefreshing(true);
      setError("");
      const [profile, checkins, notice] = await Promise.all([
        getTesterHeaderProfile(session!.user.id),
        listTesterCheckIns(session!.user.id),
        countUnreadTesterNotifications(session!.user.id)
      ]);
      if (!alive) return;
      setName(profile.data?.display_name?.trim() || session!.user.email?.split("@")[0] || "Tester");
      setAvatar(profile.data?.avatar_url || "");
      if (checkins.error) {
        setError("We couldn't load your check-in history. Please refresh and try again.");
        setRows([]);
      } else {
        const source = (checkins.data ?? []) as unknown as Omit<CheckinRow, "points">[];
        const ids = source.map(row => row.id);
        let pointTotals: Record<string, number> = {};
        if (ids.length) {
          const ledger = await listCheckInRewardLedger(session!.user.id, ids);
          if (ledger.data) {
            pointTotals = ledger.data.reduce((acc, item) => {
              if (item.reference_id) acc[item.reference_id] = (acc[item.reference_id] || 0) + Number(item.amount || 0);
              return acc;
            }, {} as Record<string, number>);
          }
        }
        if (!alive) return;
        setRows(source.map(row => ({ ...row, points: pointTotals[row.id] || 0 })));
      }
      setNotifications(notice.count ?? 0);
      setLoading(false);
      setRefreshing(false);
    }
    void load().catch(() => {
      if (alive) { setError("Something went wrong while loading check-ins."); setLoading(false); setRefreshing(false); }
    });
    return () => { alive = false; };
  }, [session?.user?.id, refreshKey]);

  const appOptions = useMemo(() => Array.from(new Set(rows
    .map(row => row.assignment?.test?.app?.name)
    .filter((value): value is string => Boolean(value)))).sort((a, b) => a.localeCompare(b)), [rows]);

  const rangedRows = useMemo(() => rows.filter(row =>
    (!fromDate || row.checkin_date >= fromDate) && (!toDate || row.checkin_date <= toDate)
  ), [rows, fromDate, toDate]);

  const visibleRows = useMemo(() => rangedRows.filter(row => {
    const assignmentStatus = row.assignment?.status || "";
    const appName = row.assignment?.test?.app?.name ?? "";
    const testName = row.assignment?.test?.title ?? "";
    const matchesTab = tab === "all" ||
      (tab === "active" && assignmentStatus === "active") ||
      (tab === "completed" && assignmentStatus === "completed");
    const matchesStatus = status === "all" || assignmentStatus === status;
    const matchesApp = appFilter === "all" || appName === appFilter;
    const matchesSearch = (appName + " " + testName + " " + (row.note ?? "")).toLowerCase().includes(search.trim().toLowerCase());
    return matchesTab && matchesStatus && matchesApp && matchesSearch;
  }).sort((a, b) => sort === "newest"
    ? new Date(b.checkin_date).getTime() - new Date(a.checkin_date).getTime()
    : new Date(a.checkin_date).getTime() - new Date(b.checkin_date).getTime()
  ), [rangedRows, tab, status, appFilter, search, sort]);

  const activeCount = rangedRows.filter(row => row.assignment?.status === "active").length;
  const completedCount = rangedRows.filter(row => row.assignment?.status === "completed").length;
  const pendingCount = rangedRows.filter(row => row.assignment?.status === "pending").length;
  const thisMonthRows = rows.filter(row => row.checkin_date.slice(0, 7) === dateValue(new Date()).slice(0, 7));
  const totalPoints = visibleRows.reduce((sum, row) => sum + row.points, 0);
  const linkedPoints = visibleRows.filter(row => row.points !== 0).length;

  const clearFilters = () => {
    setTab("all"); setStatus("all"); setAppFilter("all"); setSearch(""); setSort("newest");
    setFromDate(""); setToDate(""); setExpandedId(null);
  };
  const exportCsv = () => {
    const header = ["Check-in date", "Test", "App", "Assignment status", "Note", "Evidence URL", "Linked points"];
    const data = visibleRows.map(row => [
      row.checkin_date, row.assignment?.test?.title || "", row.assignment?.test?.app?.name || "",
      statusLabel(row.assignment?.status), row.note || "", row.evidence_url || "", row.points || ""
    ]);
    const csv = [header, ...data].map(line => line.map(csvCell).join(",")).join("\r\n");
    const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url; anchor.download = "testdz-check-in-history.csv"; anchor.click();
    URL.revokeObjectURL(url);
  };

  const nav = [
    { label: "Dashboard", icon: "home", href: "/tester-dashboard" },
    { label: "Discover Tests", icon: "search", href: "/discover-tests" },
    { label: "My Tests", icon: "tests", href: "/my-tests" },
    { label: "Activity & History", icon: "chart", href: "/activity-history" },
    { label: "Check-in History", icon: "calendar", href: "/check-in-history", active: true },
    { label: "Feedback History", icon: "star", href: "/feedback-history" },
    { label: "Wallet & Rewards", icon: "wallet", href: "/wallet-rewards" },
    { label: "Profile", icon: "user", href: "/profile" },
    { label: "Help & Support", icon: "help", href: "/help-support" },
    { label: "Settings", icon: "settings", href: "/settings" },
    ...(isDeveloper ? [{ label: "Developer", icon: "code", href: "/developer-dashboard" }] : [])
  ];

  return (
    <div className="td-dashboard cih-dashboard">
      <TesterSidebar nav={nav} name={name} firstName={firstName} avatar={avatar} roles={roles} isAdmin={isAdmin} isDeveloper={isDeveloper} workspaceMenuOpen={menuOpen} setWorkspaceMenuOpen={setMenuOpen} previewMode={false} />
      <main className="td-main cih-main">
        <header className="td-topbar">
          <label className="td-search"><Icon name="search" size={21}/><input value={search} onChange={event => setSearch(event.target.value)} placeholder="Search tests, apps or notes..."/></label>
          <div className="td-top-actions">
            <button className="td-notification" type="button" aria-label="Notifications"><Icon name="bell" size={22}/>{notifications > 0 && <i>{notifications > 9 ? "9+" : notifications}</i>}</button>
            <span className="td-top-divider"/>
            <Link to="/profile" className="td-profile-short"><span>{avatar ? <img src={avatar} alt=""/> : firstName.slice(0, 2).toUpperCase()}</span><b>⌄</b></Link>
          </div>
        </header>

        <div className="cih-back"><Link to="/tester-dashboard"><Icon name="arrow" size={17}/>Back to Dashboard</Link><span>Tester workspace / History</span></div>
        <section className="cih-hero">
          <div className="cih-hero-icon"><Icon name="calendar" size={54}/></div>
          <div className="cih-hero-copy"><span className="cih-eyebrow">YOUR PARTICIPATION</span><h1>Check-in History</h1><p>Review every recorded check-in, revisit your test evidence and follow your participation.</p></div>
          <div className="cih-hero-art" aria-hidden="true"><div className="cih-art-calendar"><Icon name="calendar" size={72}/><span>✓</span><span>✓</span><span>✓</span></div><i className="cih-art-clock"/></div>
        </section>

        {error && <div className="cih-error"><span>{error}</span><button type="button" onClick={() => setRefreshKey(value => value + 1)}>Try again</button></div>}
        <section className="cih-kpi-grid" aria-label="Check-in overview">
          <article className="cih-kpi-card"><span className="cih-kpi-icon blue"><Icon name="calendar" size={22}/></span><div><small>Check-ins in range</small><strong>{rangedRows.length}</strong><span>Recorded entries</span></div></article>
          <article className="cih-kpi-card"><span className="cih-kpi-icon green"><Icon name="check" size={22}/></span><div><small>Completed tests</small><strong>{completedCount}</strong><span>Assignments completed</span></div></article>
          <article className="cih-kpi-card"><span className="cih-kpi-icon amber"><Icon name="clock" size={22}/></span><div><small>Active / pending</small><strong>{activeCount + pendingCount}</strong><span>{activeCount} active · {pendingCount} pending</span></div></article>
          <article className="cih-kpi-card"><span className="cih-kpi-icon violet"><Icon name="gift" size={22}/></span><div><small>Linked points</small><strong>{totalPoints.toLocaleString()}</strong><span>{linkedPoints} entries with linked points</span></div></article>
        </section>

        <div className="cih-layout">
          <section className="cih-record-panel">
            <div className="cih-panel-heading"><div><h2>Participation records</h2><p>Browse and inspect your check-in activity</p></div><div className="cih-panel-actions"><button type="button" className="cih-quiet-btn" onClick={() => setRefreshKey(value => value + 1)} disabled={refreshing}><Icon name="refresh" size={15}/>{refreshing ? "Refreshing" : "Refresh"}</button><button type="button" className="cih-export-btn" onClick={exportCsv} disabled={!visibleRows.length}><Icon name="download" size={15}/>Export CSV</button></div></div>
            <div className="cih-tabs" role="tablist" aria-label="Check-in groups">
              <button className={tab === "all" ? "active" : ""} onClick={() => setTab("all")}>All Check-ins <b>{rangedRows.length}</b></button>
              <button className={tab === "active" ? "active" : ""} onClick={() => setTab("active")}>Active Tests <b>{activeCount}</b></button>
              <button className={tab === "completed" ? "active" : ""} onClick={() => setTab("completed")}>Completed Tests <b>{completedCount}</b></button>
            </div>
            <div className="cih-toolbar">
              <label className="cih-search"><Icon name="search" size={19}/><input value={search} onChange={event => setSearch(event.target.value)} placeholder="Search test, app or note..."/></label>
              <div className="cih-date-range"><label><span>From</span><input aria-label="Start date" type="date" value={fromDate} onChange={event => setFromDate(event.target.value)}/></label><b>→</b><label><span>To</span><input aria-label="End date" type="date" value={toDate} onChange={event => setToDate(event.target.value)}/></label></div>
              <label className="cih-status"><Icon name="filter" size={18}/><select aria-label="Assignment status" value={status} onChange={event => setStatus(event.target.value as StatusKey)}><option value="all">All statuses</option><option value="pending">Pending</option><option value="active">Active</option><option value="completed">Completed</option><option value="failed">Failed</option><option value="rejected">Rejected</option><option value="withdrawn">Withdrawn</option></select></label>
              <label className="cih-sort"><Icon name="sort" size={17}/><select aria-label="Sort records" value={sort} onChange={event => setSort(event.target.value as SortKey)}><option value="newest">Newest first</option><option value="oldest">Oldest first</option></select></label>
            </div>

            <div className="cih-active-filters">
              <span>{visibleRows.length} results</span>
              {appFilter !== "all" && <button onClick={() => setAppFilter("all")}>{appFilter} <Icon name="close" size={12}/></button>}
              {status !== "all" && <button onClick={() => setStatus("all")}>{statusLabel(status)} <Icon name="close" size={12}/></button>}
              {(fromDate || toDate) && <button onClick={() => { setFromDate(""); setToDate(""); }}>Date range <Icon name="close" size={12}/></button>}
              {(search || appFilter !== "all" || status !== "all" || fromDate || toDate || tab !== "all") && <button className="cih-clear-inline" onClick={clearFilters}>Clear all</button>}
            </div>

            <div className="cih-table-wrap">
              <table className="cih-table">
                <thead><tr><th>#</th><th>Test</th><th>App</th><th>Check-in date</th><th>Test status</th><th>Points</th><th>Details</th></tr></thead>
                <tbody>
                  {loading ? <tr><td colSpan={7} className="cih-empty"><span className="cih-loader"/>Loading your check-ins...</td></tr> :
                    visibleRows.length === 0 ? <tr><td colSpan={7} className="cih-empty"><Icon name="search" size={25}/><strong>No check-ins found</strong><span>Try changing the date range or clearing some filters.</span><button onClick={clearFilters}>Clear filters</button></td></tr> :
                    visibleRows.map((row, index) => {
                      const test = row.assignment?.test;
                      const app = test?.app;
                      const assignmentStatus = row.assignment?.status;
                      const expanded = expandedId === row.id;
                      return <tr key={row.id} className={expanded ? "is-expanded" : ""}>
                        <td className="cih-index">{String(index + 1).padStart(2, "0")}</td>
                        <td><div className="cih-test-cell"><AppIcon name={test?.title || "Test"} url={app?.icon_url ?? null}/><span>{test?.title || "Test"}<small>Check-in recorded</small></span></div></td>
                        <td><strong className="cih-app-name">{app?.name || "App unavailable"}</strong><small className="cih-muted">{test?.status || "—"}</small></td>
                        <td><strong>{formatDate(row.checkin_date)}</strong><small className="cih-muted">{formatDate(row.created_at, true).split(", ").slice(-1)[0]}</small></td>
                        <td><span className={"cih-status-pill " + (assignmentStatus || "unknown")}><i/>{statusLabel(assignmentStatus)}</span></td>
                        <td><span className="cih-points">{row.points ? "+" + row.points.toLocaleString() : "—"}</span></td>
                        <td><button className="cih-view" type="button" aria-expanded={expanded} onClick={() => setExpandedId(expanded ? null : row.id)}>{expanded ? "Close" : "Details"} <Icon name={expanded ? "chevron-up" : "arrow"} size={15}/></button></td>
                      </tr>;
                    })}
                </tbody>
              </table>
              {expandedId && visibleRows.some(row => row.id === expandedId) && (() => {
                const row = visibleRows.find(item => item.id === expandedId)!;
                return <section className="cih-detail-panel"><div className="cih-detail-heading"><div><small>CHECK-IN DETAILS</small><h3>{row.assignment?.test?.title || "Test participation"}</h3></div><button type="button" onClick={() => setExpandedId(null)} aria-label="Close details"><Icon name="close" size={18}/></button></div><div className="cih-detail-grid"><div><small>Check-in date</small><strong>{formatDate(row.checkin_date)}</strong></div><div><small>Recorded at</small><strong>{formatDate(row.created_at, true)}</strong></div><div><small>App</small><strong>{row.assignment?.test?.app?.name || "—"}</strong></div><div><small>Test status</small><strong>{statusLabel(row.assignment?.status)}</strong></div><div><small>Points linked</small><strong>{row.points ? "+" + row.points.toLocaleString() : "No points linked"}</strong></div><div><small>Check-in ID</small><strong className="cih-id-value">{row.id}</strong></div></div><div className="cih-detail-note"><small>Tester note</small><p>{row.note?.trim() || "No note was added to this check-in."}</p></div>{row.evidence_url && <a className="cih-evidence-link" href={row.evidence_url} target="_blank" rel="noreferrer"><Icon name="eye" size={16}/>Open submitted evidence <Icon name="arrow" size={14}/></a>}</section>;
              })()}
            </div>
            <div className="cih-mobile-list">
              {loading ? <p className="cih-empty">Loading your check-ins...</p> : visibleRows.length === 0 ? <div className="cih-empty"><Icon name="search" size={24}/><strong>No check-ins found</strong><button onClick={clearFilters}>Clear filters</button></div> : visibleRows.map((row, index) => {
                const test = row.assignment?.test;
                const app = test?.app;
                const expanded = expandedId === row.id;
                return <article className={"cih-mobile-card " + (expanded ? "expanded" : "")} key={row.id}>
                  <div className="cih-mobile-card-top"><span className="cih-index">{String(index + 1).padStart(2, "0")}</span><AppIcon name={test?.title || "Test"} url={app?.icon_url ?? null}/><div><strong>{test?.title || "Test"}</strong><small>{app?.name || "App unavailable"}</small></div><span className={"cih-status-pill " + (row.assignment?.status || "unknown")}><i/>{statusLabel(row.assignment?.status)}</span></div>
                  <div className="cih-mobile-card-bottom"><span><Icon name="calendar" size={14}/>{formatDate(row.checkin_date)}</span><span className="cih-mobile-points">{row.points ? "+" + row.points : "—"} pts</span><button type="button" onClick={() => setExpandedId(expanded ? null : row.id)}>{expanded ? "Hide details" : "View details"} <Icon name={expanded ? "chevron-up" : "arrow"} size={14}/></button></div>
                  {expanded && <div className="cih-mobile-detail"><p>{row.note?.trim() || "No note was added to this check-in."}</p>{row.evidence_url && <a href={row.evidence_url} target="_blank" rel="noreferrer">Open submitted evidence <Icon name="arrow" size={13}/></a>}<small>Recorded at {formatDate(row.created_at, true)}</small></div>}
                </article>;
              })}
            </div>
            <div className="cih-footnote">Showing {visibleRows.length} of {rows.length} check-ins <span>·</span> Sorted {sort === "newest" ? "newest first" : "oldest first"}</div>
          </section>

          <aside className="cih-aside">
            <section className="cih-side-card cih-summary">
              <h2><Icon name="chart" size={22}/>Activity summary</h2>
              <div className="cih-summary-grid">
                <div><Icon name="calendar" size={25}/><span><small>Total check-ins</small><strong>{rangedRows.length}</strong></span></div>
                <div><Icon name="check" size={25}/><span><small>Completed</small><strong>{completedCount}</strong></span></div>
                <div><Icon name="clock" size={25}/><span><small>Active</small><strong>{activeCount}</strong></span></div>
                <div><Icon name="tests" size={25}/><span><small>Pending</small><strong>{pendingCount}</strong></span></div>
              </div>
            </section>
            <section className="cih-side-card cih-month">
              <h2><Icon name="chart" size={22}/>This month</h2>
              <div><span><Icon name="calendar" size={15}/>Check-ins</span><strong>{thisMonthRows.length}</strong></div>
              <div><span><Icon name="check" size={15}/>Completed assignments</span><strong>{new Set(thisMonthRows.filter(row => row.assignment?.status === "completed").map(row => row.assignment_id)).size}</strong></div>
              <div><span><Icon name="clock" size={15}/>Active assignments</span><strong>{new Set(thisMonthRows.filter(row => row.assignment?.status === "active").map(row => row.assignment_id)).size}</strong></div>
              <div><span><Icon name="gift" size={15}/>Linked points</span><strong>{thisMonthRows.reduce((sum, row) => sum + row.points, 0).toLocaleString()}</strong></div>
            </section>
            <section className="cih-side-card cih-filter-card">
              <h2><Icon name="filter" size={22}/>Quick filters</h2>
              <label><span>Test type</span><select value={tab} onChange={event => setTab(event.target.value as TabKey)}><option value="all">All tests</option><option value="active">Active tests</option><option value="completed">Completed tests</option></select></label>
              <label><span>App</span><select value={appFilter} onChange={event => setAppFilter(event.target.value)}><option value="all">All apps</option>{appOptions.map(appName => <option key={appName} value={appName}>{appName}</option>)}</select></label>
              <label><span>Status</span><select value={status} onChange={event => setStatus(event.target.value as StatusKey)}><option value="all">All statuses</option><option value="pending">Pending</option><option value="active">Active</option><option value="completed">Completed</option><option value="failed">Failed</option><option value="rejected">Rejected</option><option value="withdrawn">Withdrawn</option></select></label>
              <button type="button" onClick={clearFilters}><Icon name="close" size={15}/>Clear all filters</button>
            </section>
            <section className="cih-help-card"><span><Icon name="shield" size={20}/></span><div><strong>About your records</strong><p>Each entry represents a check-in saved for one of your assigned tests. Test status is shown separately from the check-in record.</p></div></section>
          </aside>
        </div>
      </main>
    </div>
  );
}
