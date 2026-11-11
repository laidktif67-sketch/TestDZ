import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "../../../lib/supabase";
import { useIdentity } from "../../../shared/auth/hooks/useIdentity";
import TesterSidebar from "../components/TesterSidebar";
import { Icon } from "../components/TesterSidebar";
import "../styles/tester-dashboard.css";
import "../styles/check-in-history.css";

type CheckinRow = {
  id: string;
  assignment_id: string;
  checkin_date: string;
  created_at: string;
  note: string | null;
  evidence_url: string | null;
  assignment?: {
    id: string;
    status: string;
    test?: {
      id: string;
      title: string;
      status: string;
      app?: { name: string; icon_url: string | null } | null;
    } | null;
  } | null;
};
type TabKey = "all" | "active" | "completed";
type StatusKey = "all" | "recorded";

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
  const [error, setError] = useState("");
  const [tab, setTab] = useState<TabKey>("all");
  const [status, setStatus] = useState<StatusKey>("all");
  const [search, setSearch] = useState("");
  const now = new Date();
  const [fromDate, setFromDate] = useState(dateValue(new Date(now.getFullYear(), now.getMonth(), 1)));
  const [toDate, setToDate] = useState(dateValue(new Date(now.getFullYear(), now.getMonth() + 1, 0)));
  const isAdmin = roles.includes("admin");
  const isDeveloper = roles.includes("developer");
  const firstName = name.split(/\s+/)[0] || "Tester";

  useEffect(() => {
    if (!session?.user?.id || !supabase) { setLoading(false); return; }
    let alive = true;
    const client = supabase;
    async function load() {
      setLoading(true);
      setError("");
      const [profile, checkins, notice] = await Promise.all([
        client.from("profiles").select("display_name,avatar_url").eq("id", session!.user.id).maybeSingle(),
        client.from("checkins")
          .select("id,assignment_id,checkin_date,created_at,note,evidence_url,assignment:assignments(id,status,test:tests(id,title,status,app:apps(name,icon_url)))")
          .eq("tester_id", session!.user.id)
          .order("checkin_date", { ascending: false }),
        client.from("notifications").select("id", { count: "exact", head: true }).eq("user_id", session!.user.id).is("read_at", null)
      ]);
      if (!alive) return;
      setName(profile.data?.display_name?.trim() || session!.user.email?.split("@")[0] || "Tester");
      setAvatar(profile.data?.avatar_url || "");
      if (checkins.error) {
        setError("We couldn't load your check-in history. Please refresh and try again.");
        setRows([]);
      } else {
        setRows((checkins.data ?? []) as unknown as CheckinRow[]);
      }
      setNotifications(notice.count ?? 0);
      setLoading(false);
    }
    void load().catch(() => { if (alive) { setError("Something went wrong while loading check-ins."); setLoading(false); } });
    return () => { alive = false; };
  }, [session?.user?.id]);

  const rangedRows = useMemo(() => rows.filter(row =>
    (!fromDate || row.checkin_date >= fromDate) && (!toDate || row.checkin_date <= toDate)
  ), [rows, fromDate, toDate]);
  const visibleRows = useMemo(() => rangedRows.filter(row => {
    const assignmentStatus = row.assignment?.status;
    const matchesTab = tab === "all" ||
      (tab === "active" && assignmentStatus === "active") ||
      (tab === "completed" && assignmentStatus === "completed");
    const appName = row.assignment?.test?.app?.name ?? "";
    const testName = row.assignment?.test?.title ?? "";
    const matchesSearch = (appName + " " + testName + " " + (row.note ?? "")).toLowerCase().includes(search.trim().toLowerCase());
    return matchesTab && matchesSearch && (status === "all" || status === "recorded");
  }), [rangedRows, tab, search, status]);
  const activeCount = rangedRows.filter(row => row.assignment?.status === "active").length;
  const completedCount = rangedRows.filter(row => row.assignment?.status === "completed").length;
  const thisMonthRows = rows.filter(row => row.checkin_date.slice(0, 7) === dateValue(new Date()).slice(0, 7));
  const totalTests = new Set(rangedRows.map(row => row.assignment_id)).size;
  const clearFilters = () => {
    setTab("all"); setStatus("all"); setSearch("");
    setFromDate(dateValue(new Date(new Date().getFullYear(), new Date().getMonth(), 1)));
    setToDate(dateValue(new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0)));
  };

  const nav = [
    { label: "Dashboard", icon: "home", href: "/tester-dashboard" },
    { label: "Discover Tests", icon: "search", href: "/discover-tests" },
    { label: "My Tests", icon: "tests", href: "/my-tests" },
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
          <label className="td-search"><Icon name="search" size={21}/><input value={search} onChange={event => setSearch(event.target.value)} placeholder="Search tests, apps or dates..."/></label>
          <div className="td-top-actions">
            <button className="td-notification" type="button" aria-label="Notifications"><Icon name="bell" size={22}/>{notifications > 0 && <i>{notifications > 9 ? "9+" : notifications}</i>}</button>
            <span className="td-top-divider"/>
            <Link to="/profile" className="td-profile-short"><span>{avatar ? <img src={avatar} alt=""/> : firstName.slice(0, 2).toUpperCase()}</span><b>⌄</b></Link>
          </div>
        </header>

        <div className="cih-back"><Link to="/tester-dashboard"><Icon name="arrow" size={17}/>Back to Dashboard</Link></div>
        <section className="cih-hero">
          <div className="cih-hero-icon"><Icon name="calendar" size={54}/></div>
          <div className="cih-hero-copy"><h1>Check-in History</h1><p>View your check-in records for all tests and track your participation.</p></div>
          <div className="cih-hero-art" aria-hidden="true"><div className="cih-art-calendar"><Icon name="calendar" size={72}/><span>✓</span><span>✓</span><span>✓</span></div><i className="cih-art-clock"/></div>
        </section>

        {error && <div className="td-error">{error}</div>}
        <div className="cih-layout">
          <section className="cih-record-panel">
            <div className="cih-tabs" role="tablist" aria-label="Check-in groups">
              <button className={tab === "all" ? "active" : ""} onClick={() => setTab("all")}>All Check-ins <b>{rangedRows.length}</b></button>
              <button className={tab === "active" ? "active" : ""} onClick={() => setTab("active")}>Active Tests <b>{activeCount}</b></button>
              <button className={tab === "completed" ? "active" : ""} onClick={() => setTab("completed")}>Completed Tests <b>{completedCount}</b></button>
            </div>
            <div className="cih-toolbar">
              <label className="cih-search"><Icon name="search" size={19}/><input value={search} onChange={event => setSearch(event.target.value)} placeholder="Search by test name, app or note..."/></label>
              <div className="cih-date-range"><label><span>From</span><input type="date" value={fromDate} onChange={event => setFromDate(event.target.value)}/></label><b>→</b><label><span>To</span><input type="date" value={toDate} onChange={event => setToDate(event.target.value)}/></label></div>
              <label className="cih-status"><Icon name="filter" size={18}/><select value={status} onChange={event => setStatus(event.target.value as StatusKey)}><option value="all">All Statuses</option><option value="recorded">Recorded</option></select></label>
            </div>

            <div className="cih-table-wrap">
              <table className="cih-table">
                <thead><tr><th>#</th><th>Test Name</th><th>App</th><th>Check-in Date</th><th>Status</th><th>Points</th><th>Actions</th></tr></thead>
                <tbody>
                  {loading ? <tr><td colSpan={7} className="cih-empty">Loading your check-ins...</td></tr> :
                    visibleRows.length === 0 ? <tr><td colSpan={7} className="cih-empty">No check-ins found for these filters.</td></tr> :
                    visibleRows.map((row, index) => {
                      const test = row.assignment?.test;
                      const app = test?.app;
                      return <tr key={row.id}>
                        <td className="cih-index">{String(index + 1).padStart(2, "0")}</td>
                        <td><div className="cih-test-cell"><AppIcon name={test?.title || "Test"} url={app?.icon_url ?? null}/><span>{test?.title || "Test"}</span></div></td>
                        <td><strong className="cih-app-name">{app?.name || "App unavailable"}</strong><small className="cih-muted">{test?.status || "—"}</small></td>
                        <td><strong>{formatDate(row.checkin_date)}</strong><small className="cih-muted">{formatDate(row.created_at, true).split(", ").slice(-1)[0]}</small></td>
                        <td><span className="cih-status-pill"><Icon name="check" size={14}/>Recorded</span></td>
                        <td><span className="cih-points" title="Points are not attributed to individual check-ins in the current data model">—</span></td>
                        <td><Link className="cih-view" to={test?.id ? "/tests/" + test.id : "/my-tests"}>View <Icon name="arrow" size={15}/></Link></td>
                      </tr>;
                    })}
                </tbody>
              </table>
            </div>
            <div className="cih-mobile-list">
              {loading ? <p className="cih-empty">Loading your check-ins...</p> : visibleRows.length === 0 ? <p className="cih-empty">No check-ins found for these filters.</p> : visibleRows.map((row, index) => {
                const test = row.assignment?.test;
                const app = test?.app;
                return <article className="cih-mobile-card" key={row.id}>
                  <div className="cih-mobile-card-top"><span className="cih-index">{String(index + 1).padStart(2, "0")}</span><AppIcon name={test?.title || "Test"} url={app?.icon_url ?? null}/><div><strong>{test?.title || "Test"}</strong><small>{app?.name || "App unavailable"}</small></div><span className="cih-status-pill"><Icon name="check" size={13}/>Recorded</span></div>
                  <div className="cih-mobile-card-bottom"><span><Icon name="calendar" size={14}/>{formatDate(row.checkin_date)}</span><Link className="cih-view" to={test?.id ? "/tests/" + test.id : "/my-tests"}>View <Icon name="arrow" size={14}/></Link></div>
                </article>;
              })}
            </div>
            <div className="cih-footnote">Showing {visibleRows.length} of {rangedRows.length} recorded check-ins</div>
          </section>

          <aside className="cih-aside">
            <section className="cih-side-card cih-summary">
              <h2><Icon name="calendar" size={22}/>Check-in Summary</h2>
              <div className="cih-summary-grid">
                <div><Icon name="calendar" size={25}/><span><small>Total Check-ins</small><strong>{rangedRows.length}</strong></span></div>
                <div><Icon name="check" size={25}/><span><small>Recorded</small><strong>{rangedRows.length}</strong></span></div>
                <div><Icon name="clock" size={25}/><span><small>Active Tests</small><strong>{activeCount}</strong></span></div>
                <div><Icon name="tests" size={25}/><span><small>Completed Tests</small><strong>{completedCount}</strong></span></div>
              </div>
            </section>
            <section className="cih-side-card cih-month">
              <h2><Icon name="chart" size={22}/>This Month</h2>
              <div><span><Icon name="calendar" size={15}/>Total Check-ins</span><strong>{thisMonthRows.length}</strong></div>
              <div><span><Icon name="check" size={15}/>Recorded</span><strong>{thisMonthRows.length}</strong></div>
              <div><span><Icon name="clock" size={15}/>Active Tests</span><strong>{new Set(thisMonthRows.filter(row => row.assignment?.status === "active").map(row => row.assignment_id)).size}</strong></div>
              <div><span><Icon name="tests" size={15}/>Completed Tests</span><strong>{new Set(thisMonthRows.filter(row => row.assignment?.status === "completed").map(row => row.assignment_id)).size}</strong></div>
            </section>
            <section className="cih-side-card cih-filter-card">
              <h2><Icon name="filter" size={22}/>Filters</h2>
              <label><span>Test Type</span><select value={tab} onChange={event => setTab(event.target.value as TabKey)}><option value="all">All Types</option><option value="active">Active Tests</option><option value="completed">Completed Tests</option></select></label>
              <label><span>App</span><select value={search} onChange={event => setSearch(event.target.value)}><option value="">All Apps</option>{Array.from(new Set(rows.map(row => row.assignment?.test?.app?.name).filter((value): value is string => Boolean(value)))).sort().map(appName => <option key={appName} value={appName}>{appName}</option>)}</select></label>
              <label><span>Status</span><select value={status} onChange={event => setStatus(event.target.value as StatusKey)}><option value="all">All Statuses</option><option value="recorded">Recorded</option></select></label>
              <button type="button" onClick={clearFilters}><Icon name="close" size={15}/>Clear Filters</button>
            </section>
          </aside>
        </div>
      </main>
    </div>
  );
}
