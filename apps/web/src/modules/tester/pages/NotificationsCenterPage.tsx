import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "../../../lib/supabase";
import { isTesterWorkflowV2Enabled } from "../../../lib/supabase-v2";
import { getNotificationsCenterPageData, markTesterNotificationRead, markAllTesterNotificationsRead } from "../../../features/notifications/notifications-api";
import { useIdentity } from "../../../shared/auth/hooks/useIdentity";
import TesterSidebar, { Icon } from "../components/TesterSidebar";
import "../styles/tester-dashboard.css";
import "../styles/notifications-center.css";

type NotificationRow = {
  id: string;
  recipient_role?: "tester" | "developer";
  type: string;
  title: string;
  body: string;
  data: Record<string, unknown> | null;
  read_at: string | null;
  created_at: string;
};
type Category = "all" | "unread" | "tests" | "rewards" | "system";
type Preferences = { tests: boolean; feedback: boolean; rewards: boolean; security: boolean };
const defaults: Preferences = { tests: true, feedback: true, rewards: true, security: true };

function categoryFor(type: string): Exclude<Category, "all" | "unread"> {
  const value = type.toLowerCase();
  if (value.includes("reward") || value.includes("point") || value.includes("wallet")) return "rewards";
  if (value.includes("test") || value.includes("assignment") || value.includes("deadline") || value.includes("checkin")) return "tests";
  return "system";
}
function iconFor(type: string): string {
  const value = type.toLowerCase();
  if (value.includes("reward") || value.includes("point") || value.includes("wallet")) return "gift";
  if (value.includes("feedback") || value.includes("review")) return "message";
  if (value.includes("deadline") || value.includes("checkin")) return "calendar";
  if (value.includes("security") || value.includes("login") || value.includes("password")) return "shield";
  if (value.includes("test") || value.includes("assignment")) return "flask";
  return "bell";
}
function timeAgo(value: string): string {
  const seconds = Math.max(0, Math.floor((Date.now() - new Date(value).getTime()) / 1000));
  if (seconds < 60) return "Just now";
  if (seconds < 3600) return Math.floor(seconds / 60) + " min ago";
  if (seconds < 86400) return Math.floor(seconds / 3600) + " hours ago";
  if (seconds < 604800) return Math.floor(seconds / 86400) + " days ago";
  return new Date(value).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}
function preferenceKey(userId: string) { return "testdz-notification-preferences:" + userId; }

export default function NotificationsCenterPage() {
  const { user, roles = [] } = useIdentity();
  const [rows, setRows] = useState<NotificationRow[]>([]);
  const [filter, setFilter] = useState<Category>("all");
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [rewardPoints, setRewardPoints] = useState(0);
  const [deadlines, setDeadlines] = useState(0);
  const [preferences, setPreferences] = useState<Preferences>(defaults);
  const [menuOpen, setMenuOpen] = useState(false);
  const isAdmin = roles.includes("admin");
  const isDeveloper = roles.includes("developer");
  const name = user?.email?.split("@")[0] || "Tester";
  const firstName = name.split(/[\s._-]+/)[0];

  const nav = [
    { label: "Dashboard", icon: "home", href: "/tester-dashboard" },
    { label: "Discover Tests", icon: "search", href: "/discover-tests" },
    { label: "My Tests", icon: "tests", href: "/my-tests" },
    { label: "Activity & History", icon: "chart", href: "/activity-history" },
    { label: "Feedback History", icon: "star", href: "/feedback-history" },
    { label: "Wallet & Rewards", icon: "wallet", href: "/wallet-rewards" },
    { label: "Help & Support", icon: "help", href: "/help-support" },
    { label: "Notifications", icon: "bell", href: "/notifications", active: true },
    { label: "Settings", icon: "settings", href: "/settings" },
    ...(isDeveloper ? [{ label: "Developer", icon: "code", href: "/developer-dashboard" }] : [])
  ];

  useEffect(() => {
    if (!user?.id) return;
    try {
      const saved = localStorage.getItem(preferenceKey(user.id));
      if (saved) setPreferences({ ...defaults, ...JSON.parse(saved) });
    } catch { /* Ignore invalid local preference data. */ }
  }, [user?.id]);

  useEffect(() => {
    let alive = true;
    async function load() {
      if (!supabase || !user?.id) { setLoading(false); return; }
      setLoading(true); setError("");
      const result = await getNotificationsCenterPageData(user.id, "tester");
      if (!alive) return;
      const { notificationResult, assignmentResult } = result;
      if (notificationResult.error) setError("Could not load your notifications. Please refresh and try again.");
      else setRows((notificationResult.data ?? []) as NotificationRow[]);
      setRewardPoints(result.rewardPoints);
      if (!assignmentResult.error) {
        const today = new Date().toISOString().slice(0, 10);
        setDeadlines((assignmentResult.data ?? []).filter((row: any) => row.test?.end_date && row.test.end_date >= today).length);
      }
      setLoading(false);
    }
    void load();
    return () => { alive = false; };
  }, [user?.id]);

  const unread = rows.filter(row => !row.read_at).length;
  const counts = useMemo(() => ({
    all: rows.length,
    unread,
    tests: rows.filter(row => categoryFor(row.type) === "tests").length,
    rewards: rows.filter(row => categoryFor(row.type) === "rewards").length,
    system: rows.filter(row => categoryFor(row.type) === "system").length
  }), [rows, unread]);
  const filtered = useMemo(() => rows.filter(row => {
    if (filter === "unread" && row.read_at) return false;
    if (filter !== "all" && filter !== "unread" && categoryFor(row.type) !== filter) return false;
    return (row.title + " " + row.body).toLowerCase().includes(search.toLowerCase());
  }), [rows, filter, search]);

  async function markRead(row: NotificationRow) {
    if (row.read_at || !supabase || !user?.id) return;
    setBusyId(row.id); setNotice(""); setError("");
    const readAt = new Date().toISOString();
    const result = await markTesterNotificationRead(user.id, row.id, readAt, "tester");
    setBusyId("");
    if (result.error) { setError("Could not update this notification. Please try again."); return; }
    setRows(current => current.map(item => item.id === row.id ? { ...item, read_at: readAt } : item));
  }
  async function markAllRead() {
    if (!supabase || !user?.id || unread === 0) return;
    setSaving(true); setNotice(""); setError("");
    const readAt = new Date().toISOString();
    const result = await markAllTesterNotificationsRead(user.id, readAt, "tester");
    setSaving(false);
    if (result.error) { setError("Could not mark all notifications as read. Please try again."); return; }
    setRows(current => current.map(item => item.read_at ? item : { ...item, read_at: readAt }));
    setNotice("All notifications marked as read.");
  }
  function savePreferences() {
    if (!user?.id) return;
    setSaving(true);
    try {
      localStorage.setItem(preferenceKey(user.id), JSON.stringify(preferences));
      setNotice("Preferences saved on this device.");
    } catch { setError("Your browser could not save these preferences."); }
    setSaving(false);
  }

  return <div className="td-dashboard nc-dashboard">
    <TesterSidebar nav={nav} name={name} firstName={firstName} avatar="" roles={roles} isAdmin={isAdmin} isDeveloper={isDeveloper} workspaceMenuOpen={menuOpen} setWorkspaceMenuOpen={setMenuOpen} previewMode={!supabase}/>
    <main className="td-main nc-main">
      <header className="td-topbar nc-topbar">
        <label className="td-search"><Icon name="search" size={20}/><input value={search} onChange={event => setSearch(event.target.value)} placeholder="Search notifications…"/></label>
        <div className="td-top-actions"><Link className="td-notification nc-bell" to="/notifications" aria-label="Notifications"><Icon name="bell" size={21}/>{unread > 0 && <i>{unread > 9 ? "9+" : unread}</i>}</Link><span className="td-top-divider"/><Link to="/profile" className="td-profile-short"><span>{firstName.slice(0,2).toUpperCase()}</span><strong>{firstName}</strong><b>⌄</b></Link></div>
      </header>
      <div className="nc-content">
        <section className="nc-hero">
          <div className="nc-hero-bell"><Icon name="bell" size={76}/><b>{unread}</b></div>
          <div className="nc-hero-copy"><h1><span>Notifications</span> Center</h1><p>Stay updated with your latest tests, feedback, rewards and account activity.</p></div>
          <div className="nc-hero-send"><Icon name="send" size={86}/><span/></div>
        </section>

        <section className="nc-stats" aria-label="Notification summary">
          <article className="nc-stat blue"><span><Icon name="bell" size={34}/></span><div><strong>{unread}</strong><small>New Notifications</small></div></article>
          <article className="nc-stat sky"><span><Icon name="mail" size={34}/></span><div><strong>{rows.length}</strong><small>Total Notifications</small></div></article>
          <article className="nc-stat green"><span><Icon name="gift" size={34}/></span><div><strong>{isTesterWorkflowV2Enabled?"—":"+"+rewardPoints.toLocaleString()+" pts"}</strong><small>{isTesterWorkflowV2Enabled?"Reward posting not enabled":"Recent Reward · 30 days"}</small></div></article>
          <article className="nc-stat violet"><span><Icon name="calendar" size={34}/></span><div><strong>{deadlines}</strong><small>Upcoming Test Deadlines</small></div></article>
        </section>

        <div className="nc-toolbar">
          <div className="nc-tabs" role="tablist" aria-label="Notification filters">
            {(["all", "unread", "tests", "rewards", "system"] as Category[]).map(value => <button type="button" key={value} className={filter === value ? "active" : ""} aria-pressed={filter === value} onClick={() => setFilter(value)}>
              {value === "all" ? <Icon name="grid" size={17}/> : value === "unread" ? <i/> : value === "tests" ? <Icon name="flask" size={17}/> : value === "rewards" ? <Icon name="gift" size={17}/> : <Icon name="settings" size={17}/>}
              <span>{value === "all" ? "All" : value === "unread" ? "Unread" : value === "tests" ? "Tests" : value === "rewards" ? "Rewards" : "System"}</span><b>{counts[value]}</b>
            </button>)}
          </div>
          <button type="button" className="nc-mark-all" disabled={!unread || saving} onClick={() => void markAllRead()}><Icon name="check" size={18}/>{saving ? "Saving…" : "Mark All as Read"}</button>
        </div>

        {(error || notice) && <div className={error ? "nc-message error" : "nc-message"} role={error ? "alert" : "status"}>{error || notice}<button type="button" onClick={() => { setError(""); setNotice(""); }}>×</button></div>}

        <div className="nc-layout">
          <section className="nc-list" aria-label="Your notifications">
            {loading ? <div className="nc-empty"><span className="nc-spinner"/><strong>Loading notifications…</strong></div> :
              filtered.length ? filtered.map(row => {
                const category = categoryFor(row.type);
                return <button type="button" key={row.id} className={"nc-item " + (!row.read_at ? "unread" : "")} onClick={() => void markRead(row)} disabled={busyId === row.id}>
                  <span className={"nc-item-icon " + category}><Icon name={iconFor(row.type)} size={31}/></span>
                  <span className="nc-item-copy"><strong>{row.title}</strong><small>{row.body}</small></span>
                  <span className="nc-item-time"><i className={!row.read_at ? "blue-dot" : category === "rewards" ? "green-dot" : "muted-dot"}/>{timeAgo(row.created_at)}</span>
                  <Icon name="arrow" size={20}/>
                </button>;
              }) : <div className="nc-empty"><span><Icon name="bell" size={35}/></span><strong>{rows.length ? "No notifications found" : "You're all caught up"}</strong><p>{rows.length ? "Try another filter or search term." : "New updates about tests, rewards and your account will appear here."}</p></div>}
          </section>

          <aside className="nc-side">
            <section className="nc-preferences">
              <h2><Icon name="settings" size={23}/>Notification Preferences</h2><p>Choose which notification categories you want to receive.</p>
              {([
                ["tests", "Test Updates", "flask"],
                ["feedback", "Feedback Updates", "message"],
                ["rewards", "Rewards & Points", "gift"],
                ["security", "Account & Security", "shield"]
              ] as [keyof Preferences, string, string][]).map(([key, label, icon]) => <label className="nc-pref-row" key={key}><span><Icon name={icon} size={19}/>{label}</span><input type="checkbox" checked={preferences[key]} onChange={event => setPreferences(current => ({ ...current, [key]: event.target.checked }))}/><i/></label>)}
              <button type="button" className="nc-save" onClick={savePreferences} disabled={saving}><Icon name="download" size={16}/>{saving ? "Saving…" : "Save Preferences"}</button>
              <small className="nc-pref-note">Preferences are saved on this device. Server-side delivery controls are not configured yet.</small>
            </section>
            <section className="nc-promo"><div className="nc-promo-art"><Icon name="rocket" size={56}/></div><strong>Never miss an important update!</strong><p>Keep your notification preferences up to date so you can follow your testing progress.</p><Link to="/settings">Review Account Settings <Icon name="arrow" size={15}/></Link></section>
          </aside>
        </div>
        <footer className="nc-footer">TestDZ · Test · Review · Earn</footer>
      </div>
    </main>
  </div>;
}
