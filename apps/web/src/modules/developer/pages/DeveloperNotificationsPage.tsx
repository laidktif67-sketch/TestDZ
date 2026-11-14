import { useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import { listDeveloperNotifications, markDeveloperNotificationRead, markAllDeveloperNotificationsRead, setDeveloperNotificationArchived } from "../../../features/notifications/notifications-api";
import { useIdentity } from "../../../features/identity/hooks/useIdentity";
import { RoleAccessNotice } from "../../../shared/guards/RoleGuard";
import DeveloperSidebar from "../components/DeveloperSidebar";
import "../styles/developer-notifications.css";

type NotificationRow = {
  id: string;
  user_id: string;
  type: string;
  title: string;
  body: string;
  data: Record<string, unknown> | null;
  read_at: string | null;
  archived_at: string | null;
  created_at: string;
};
type Filter = "all" | "feedback" | "tests" | "campaigns" | "system" | "billing";
const filters: Filter[] = ["all", "feedback", "tests", "campaigns", "system", "billing"];
const labels: Record<Filter, string> = { all: "All", feedback: "Feedback", tests: "Tests", campaigns: "Campaigns", system: "System", billing: "Billing" };
function category(type: string): Exclude<Filter, "all"> {
  const v = type.toLowerCase();
  if (v.includes("feedback") || v.includes("review")) return "feedback";
  if (v.includes("campaign") || v.includes("cohort")) return "campaigns";
  if (v.includes("payment") || v.includes("billing") || v.includes("subscription") || v.includes("invoice")) return "billing";
  if (v.includes("test") || v.includes("assignment") || v.includes("result") || v.includes("tester")) return "tests";
  return "system";
}
function important(row: NotificationRow) {
  return row.data?.important === true || row.data?.priority === "important" || row.data?.priority === "high";
}
function ago(value: string) {
  const seconds = Math.max(0, Math.floor((Date.now() - new Date(value).getTime()) / 1000));
  if (seconds < 60) return "Just now";
  if (seconds < 3600) return Math.floor(seconds / 60) + " min ago";
  if (seconds < 86400) return Math.floor(seconds / 3600) + " hours ago";
  if (seconds < 604800) return Math.floor(seconds / 86400) + " days ago";
  return new Date(value).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}
function dateLabel(value: string) {
  return new Date(value).toLocaleString(undefined, { month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit" });
}
function Icon({ name, size = 20 }: { name: string; size?: number }) {
  const common = { width: size, height: size, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 1.8, strokeLinecap: "round" as const, strokeLinejoin: "round" as const, "aria-hidden": true as const };
  const paths: Record<string, ReactNode> = {
    home: <><path d="m3 10 9-7 9 7"/><path d="M5 9v11h14V9"/></>,
    apps: <><rect x="3" y="3" width="8" height="8" rx="2"/><rect x="13" y="3" width="8" height="8" rx="2"/><rect x="3" y="13" width="8" height="8" rx="2"/><rect x="13" y="13" width="8" height="8" rx="2"/></>,
    tests: <><path d="M9 3h6M10 3v5l-5 9a3 3 0 0 0 3 4h8a3 3 0 0 0 3-4l-5-9V3"/><path d="M8 15h8"/></>,
    monitor: <><rect x="3" y="4" width="18" height="13" rx="2"/><path d="M8 21h8m-4-4v4"/></>,
    users: <><circle cx="9" cy="8" r="3"/><path d="M3 20v-2a6 6 0 0 1 12 0v2m1-12a3 3 0 0 1 0 6m2 1a5 5 0 0 1 3 5"/></>,
    chart: <><path d="M4 20V10m6 10V4m6 16v-7m6 7H2"/></>,
    feedback: <><path d="M4 5h16v12H9l-5 4V5Z"/><path d="M8 9h8m-8 4h5"/></>,
    bell: <><path d="M18 9a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9m-8 12h4"/></>,
    settings: <><circle cx="12" cy="12" r="3"/><path d="m19 13 2 1-2 4-2-1-2 1v2H9v-2l-2-1-2 1-2-4 2-1v-2l-2-1 2-4 2 1 2-1V4h6v2l2 1 2-1 2 4-2 1z"/></>,
    search: <><circle cx="10.8" cy="10.8" r="7"/><path d="m16 16 5 5"/></>,
    message: <><path d="M4 5h16v12H9l-5 4V5Z"/><path d="M8 9h8m-8 4h5"/></>,
    check: <path d="m5 12 4 4L19 6"/>,
    archive: <><rect x="3" y="4" width="18" height="4" rx="1"/><path d="M5 8v12h14V8m-9 4h4"/></>,
    calendar: <><rect x="3" y="5" width="18" height="16" rx="2"/><path d="M16 3v4M8 3v4M3 10h18"/></>,
    arrow: <><path d="M5 12h14m-6-6 6 6-6 6"/></>,
    close: <path d="m6 6 12 12M18 6 6 18"/>,
    mail: <><rect x="3" y="5" width="18" height="14" rx="2"/><path d="m3 7 9 6 9-6"/></>,
    star: <path d="m12 3 2.7 5.5 6.1.9-4.4 4.3 1 6.1-5.4-2.9-5.4 2.9 1-6.1-4.4-4.3 6.1-.9z"/>,
    send: <><path d="m22 2-7 20-4-9-9-4Z"/><path d="M22 2 11 13"/></>
  };
  return <svg {...common}>{paths[name] || paths.bell}</svg>;
}
export default function DeveloperNotificationsPage() {
  const { user, roles = [] } = useIdentity();
  const allowed = roles.includes("developer") || roles.includes("admin");
  const [rows, setRows] = useState<NotificationRow[]>([]);
  const [selectedId, setSelectedId] = useState("");
  const [filter, setFilter] = useState<Filter>("all");
  const [range, setRange] = useState("30");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [showArchived, setShowArchived] = useState(false);
  const pageSize = 6;

  useEffect(() => {
    let alive = true;
    async function load() {
      if (!user?.id) { setLoading(false); return; }
      setLoading(true); setError("");
      const result = await listDeveloperNotifications(user.id);
      if (!alive) return;
      if (result.error) {
        setError("Could not load notifications. Refresh the page and try again.");
        setRows([]);
      } else {
        const list = (result.data ?? []) as unknown as NotificationRow[];
        setRows(list);
        setSelectedId(current => list.some(row => row.id === current) ? current : list.find(row => !row.archived_at)?.id || "");
      }
      setLoading(false);
    }
    void load();
    return () => { alive = false; };
  }, [user?.id]);

  const activeRows = useMemo(() => rows.filter(row => showArchived ? Boolean(row.archived_at) : !row.archived_at), [rows, showArchived]);
  const unread = activeRows.filter(row => !row.read_at).length;
  const read = activeRows.length - unread;
  const importantCount = activeRows.filter(important).length;
  const cutoff = range === "all" ? 0 : Date.now() - Number(range) * 86400000;
  const filtered = useMemo(() => activeRows.filter(row => {
    if (new Date(row.created_at).getTime() < cutoff) return false;
    if (filter !== "all" && category(row.type) !== filter) return false;
    return (row.title + " " + row.body + " " + row.type).toLowerCase().includes(search.toLowerCase());
  }), [activeRows, cutoff, filter, search]);
  const pageCount = Math.max(1, Math.ceil(filtered.length / pageSize));
  const visible = filtered.slice((page - 1) * pageSize, page * pageSize);
  const selected = activeRows.find(row => row.id === selectedId) || visible[0] || null;
  const counts = useMemo(() => ({
    all: activeRows.length,
    feedback: activeRows.filter(row => category(row.type) === "feedback").length,
    tests: activeRows.filter(row => category(row.type) === "tests").length,
    campaigns: activeRows.filter(row => category(row.type) === "campaigns").length,
    system: activeRows.filter(row => category(row.type) === "system").length,
    billing: activeRows.filter(row => category(row.type) === "billing").length
  }), [activeRows]);

  useEffect(() => { setPage(1); }, [filter, range, search, showArchived]);
  async function markRead(row: NotificationRow) {
    if (!user?.id || row.read_at) return;
    setBusy(true); setError("");
    const readAt = new Date().toISOString();
    const result = await markDeveloperNotificationRead(row.id, user.id, readAt);
    if (result.error) setError("Could not mark this notification as read.");
    else setRows(current => current.map(item => item.id === row.id ? { ...item, read_at: readAt } : item));
    setBusy(false);
  }
  async function markAllRead() {
    if (!user?.id || unread === 0) return;
    setBusy(true); setError("");
    const readAt = new Date().toISOString();
    const result = await markAllDeveloperNotificationsRead(user.id, readAt);
    if (result.error) setError("Could not mark all notifications as read.");
    else setRows(current => current.map(item => !item.archived_at && !item.read_at ? { ...item, read_at: readAt } : item));
    setBusy(false);
  }
  async function archive(row: NotificationRow) {
    if (!user?.id) return;
    setBusy(true); setError("");
    const archivedAt = row.archived_at ? null : new Date().toISOString();
    const result = await setDeveloperNotificationArchived(row.id, user.id, archivedAt);
    if (result.error) setError("Could not update the archive state. Please try again.");
    else {
      setRows(current => current.map(item => item.id === row.id ? { ...item, archived_at: archivedAt } : item));
      setSelectedId("");
    }
    setBusy(false);
  }
  if (!allowed) return <RoleAccessNotice />;
  const firstName = user?.email?.split("@")[0]?.split(/[._-]/)[0] || "Developer";
  const testId = typeof selected?.data?.test_id === "string" ? selected.data.test_id : "";
  const testHref = testId ? "/developer/tests/" + testId + "/monitoring" : "/developer/tests";

  return <main className="dn-shell">
    <DeveloperSidebar />
    <section className="dn-main">
      <header className="dn-topbar">
        <label className="dn-search"><Icon name="search" size={22}/><input value={search} onChange={event => setSearch(event.target.value)} placeholder="Search notifications..."/></label>
        <div className="dn-account"><span className="dn-bell"><Icon name="bell" size={22}/>{unread > 0 && <i>{unread > 9 ? "9+" : unread}</i>}</span><span className="dn-account-divider"/><b>{firstName.slice(0,2).toUpperCase()}</b><strong>{firstName}</strong><span>⌄</span></div>
      </header>
      <div className="dn-content">
        <section className="dn-hero"><div className="dn-hero-bell"><Icon name="bell" size={66}/><i>{unread}</i></div><div className="dn-hero-copy"><h1>Notifications Center</h1><p>Stay updated with the latest activities and important updates</p></div><div className="dn-hero-art"><Icon name="send" size={76}/><span>▤　▱　▥</span></div></section>
        {error && <div className="dn-alert" role="alert">{error}<button onClick={() => setError("")}>×</button></div>}
        <section className="dn-stats">
          <article className="blue"><span><Icon name="bell" size={30}/></span><div><b>{activeRows.length}</b><small>Total Notifications</small></div><i>▂▅▇</i></article>
          <article className="sky"><span><Icon name="mail" size={30}/></span><div><b>{unread}</b><small>Unread</small></div><i>▂▅▇</i></article>
          <article className="green"><span><Icon name="check" size={30}/></span><div><b>{read}</b><small>Read</small></div><i>▂▅▇</i></article>
          <article className="violet"><span><Icon name="star" size={30}/></span><div><b>{importantCount}</b><small>Important</small></div><i>▂▅▇</i></article>
        </section>
        <div className="dn-toolbar">
          <div className="dn-filters">{filters.map(value => <button key={value} className={filter === value ? "active" : ""} onClick={() => setFilter(value)}>{labels[value]} <small className="dn-filter-count">{counts[value]}</small></button>)}</div>
          <select value={range} onChange={event => setRange(event.target.value)} aria-label="Notification date range"><option value="7">Last 7 Days</option><option value="30">Last 30 Days</option><option value="90">Last 90 Days</option><option value="all">All Time</option></select>
          <button className="dn-mark-all" disabled={busy || unread === 0 || showArchived} onClick={() => void markAllRead()}><Icon name="check" size={16}/>{busy ? "Saving..." : "Mark All as Read"}</button>
        </div>
        <div className="dn-archive-toggle"><button className={!showArchived ? "active" : ""} onClick={() => setShowArchived(false)}>Inbox</button><button className={showArchived ? "active" : ""} onClick={() => setShowArchived(true)}>Archived</button></div>
        <div className="dn-layout">
          <section className="dn-list">
            {loading ? <div className="dn-empty">Loading notifications...</div> : visible.length ? visible.map(row => <button key={row.id} className={"dn-row " + (selected?.id === row.id ? "selected " : "") + (!row.read_at ? "unread" : "")} onClick={() => setSelectedId(row.id)}>
              <span className={"dn-row-icon " + category(row.type)}><Icon name={category(row.type) === "feedback" ? "message" : category(row.type) === "billing" ? "mail" : category(row.type) === "campaigns" ? "calendar" : category(row.type) === "tests" ? "tests" : "bell"} size={25}/></span>
              <span className="dn-row-copy"><b>{row.title}</b><small>{row.body}</small><em>{ago(row.created_at)} <span>•</span> {row.type.replaceAll("_", " ")}</em></span>
              <span className="dn-row-tags"><i className={"dn-tag " + category(row.type)}>{labels[category(row.type)]}</i><i className={"dn-state " + (row.read_at ? "read" : "unread")}>{row.read_at ? "Read" : "Unread"}</i>{important(row) && <i className="dn-important">Important</i>}</span>
              <Icon name="arrow" size={19}/>
            </button>) : <div className="dn-empty"><Icon name="bell" size={34}/><b>{showArchived ? "No archived notifications" : "No notifications found"}</b><span>{rows.length ? "Try changing the filters or date range." : "New updates will appear here when they are sent to your account."}</span></div>}
            <footer><span>Showing {filtered.length ? (page - 1) * pageSize + 1 : 0}–{Math.min(page * pageSize, filtered.length)} of {filtered.length} notifications</span><div><button disabled={page <= 1} onClick={() => setPage(p => p - 1)}>‹</button><b>{page}</b><span>/ {pageCount}</span><button disabled={page >= pageCount} onClick={() => setPage(p => p + 1)}>›</button></div></footer>
          </section>
          <aside className="dn-detail">
            <header><h2><Icon name="message" size={22}/>Notification Details</h2>{selected && <button aria-label="Clear selection" onClick={() => setSelectedId("")}>×</button>}</header>
            {selected ? <div className="dn-detail-body">
              <div className="dn-detail-title"><h3>{selected.title}</h3><i className={selected.read_at ? "read" : "unread"}>{selected.read_at ? "Read" : "Unread"}</i></div>
              <p>{selected.body}</p>
              <div className="dn-detail-meta"><span><Icon name="calendar" size={16}/>{dateLabel(selected.created_at)}</span><i className={"dn-tag " + category(selected.type)}>{labels[category(selected.type)]}</i></div>
              {testId && <div className="dn-related"><span>★</span><div><b>Related Test</b><small>Test reference: {testId.slice(0, 8)}</small></div><Link to={testHref}>View Test <Icon name="arrow" size={14}/></Link></div>}
              <h4>Message</h4><div className="dn-message">{selected.body}</div>
              <div className="dn-detail-actions">
                {!selected.read_at && !showArchived && <button className="primary" disabled={busy} onClick={() => void markRead(selected)}><Icon name="check" size={17}/>{busy ? "Saving..." : "Mark as Read"}</button>}
                <button className="secondary" disabled={busy} onClick={() => void archive(selected)}><Icon name="archive" size={17}/>{selected.archived_at ? "Restore" : "Archive"}</button>
              </div>
              <section className="dn-history"><h4>Notification History</h4><div><i/><span><b>Created</b><small>{dateLabel(selected.created_at)}</small></span></div><div><i className={selected.read_at ? "done" : ""}/><span><b>{selected.read_at ? "Read" : "Unread"}</b><small>{selected.read_at ? dateLabel(selected.read_at) : "Not yet read"}</small></span></div>{selected.archived_at && <div><i className="done"/><span><b>Archived</b><small>{dateLabel(selected.archived_at)}</small></span></div>}</section>
            </div> : <div className="dn-empty">Select a notification to see its details.</div>}
          </aside>
        </div>
        <footer className="dn-footer">TestDZ · Build · Test · Improve</footer>
      </div>
    </section>
  </main>;
}
