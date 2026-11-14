import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { identityApi } from "../../../features/identity/identity-api";
import { useIdentity } from "../../../features/identity/hooks/useIdentity";
import { listTesterFeedbackHistory, listTesterFeedbackRewards } from "../../../features/feedback/feedback-api";
import { countTesterUnreadNotifications } from "../../../features/notifications/notifications-api";
import TesterSidebar, { Icon } from "../components/TesterSidebar";
import { useTesterProfile } from "../hooks/useTesterProfile";
import "../styles/tester-dashboard.css";
import "../styles/feedback-history.css";

type FeedbackStatus = "pending" | "accepted" | "rejected";
type FeedbackRow = {
  id: string;
  assignment_id: string;
  rating: number | null;
  body: string;
  category: string;
  quality_status: FeedbackStatus;
  reviewed_at: string | null;
  created_at: string;
  assignment?: {
    id: string;
    test?: { id: string; title: string; app?: { name: string; icon_url: string | null } | null } | null;
  } | null;
};
type LedgerRow = { amount: number; reference_id: string | null; reference_type: string | null };
type RangeKey = "30" | "90" | "all";

const statusText: Record<FeedbackStatus, string> = {
  pending: "Pending",
  accepted: "Approved",
  rejected: "Rejected"
};
const formatDate = (value: string) => {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "Date unavailable" : date.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
};
const formatCategory = (value: string) => (value || "general").replace(/[_-]+/g, " ").replace(/\b\w/g, letter => letter.toUpperCase());

function RatingStars({ value }: { value: number | null }) {
  return <span className="fh-stars" aria-label={value === null ? "Not rated" : value + " out of 5"}>
    {Array.from({ length: 5 }, (_, index) => <span key={index} className={value !== null && index < value ? "is-filled" : ""}>★</span>)}
  </span>;
}

function AppMark({ name, iconUrl }: { name: string; iconUrl?: string | null }) {
  const lower = name.toLowerCase();
  const fallback = lower.includes("secure") || lower.includes("vault") ? "✓" : lower.includes("media") ? "▶" : lower.includes("health") ? "♥" : "✦";
  return <span className="fh-app-mark">{iconUrl ? <img src={iconUrl} alt="" /> : fallback}</span>;
}

export default function FeedbackHistoryPage() {
  const { session, roles = [] } = useIdentity();
  const { name, avatar, firstName, loading: profileLoading } = useTesterProfile();
  const [workspaceMenuOpen, setWorkspaceMenuOpen] = useState(false);
  const [rows, setRows] = useState<FeedbackRow[]>([]);
  const [ledger, setLedger] = useState<LedgerRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [filter, setFilter] = useState<"all" | FeedbackStatus>("all");
  const [range, setRange] = useState<RangeKey>("30");
  const [search, setSearch] = useState("");
  const [expanded, setExpanded] = useState<string | null>(null);
  const [unreadCount, setUnreadCount] = useState(0);
  const isAdmin = roles.includes("admin");
  const isDeveloper = roles.includes("developer");

  useEffect(() => {
    let alive = true;
    setUnreadCount(0);
    if (!session?.user?.id || !identityApi.isConfigured()) return () => { alive = false; };
    void Promise.resolve(countTesterUnreadNotifications(session.user.id)).then(({ count, error }) => {
      if (alive && !error) setUnreadCount(count ?? 0);
    }).catch(() => { if (alive) setUnreadCount(0); });
    return () => { alive = false; };
  }, [session?.user?.id]);

  useEffect(() => {
    if (!session?.user?.id || !identityApi.isConfigured()) { setLoading(false); return; }
    let alive = true;
    async function load() {
      setLoading(true);
      setError("");
      const [feedbackResult, ledgerResult] = await Promise.all([
        listTesterFeedbackHistory(session!.user.id),
        listTesterFeedbackRewards(session!.user.id)
      ]);
      if (!alive) return;
      if (feedbackResult.error) {
        setError("We couldn't load your feedback history. Please try again.");
        setRows([]);
      } else {
        setRows((feedbackResult.data ?? []) as unknown as FeedbackRow[]);
      }
      if (!ledgerResult.error) setLedger((ledgerResult.data ?? []) as LedgerRow[]);
      setLoading(false);
    }
    void load();
    return () => { alive = false; };
  }, [session?.user?.id]);

  const cutoff = useMemo(() => range === "all" ? null : Date.now() - Number(range) * 86400000, [range]);
  const rangedRows = useMemo(() => rows.filter(row => !cutoff || new Date(row.created_at).getTime() >= cutoff), [rows, cutoff]);
  const visibleRows = useMemo(() => rangedRows.filter(row => {
    const matchesStatus = filter === "all" || row.quality_status === filter;
    const appName = row.assignment?.test?.app?.name ?? "";
    const testName = row.assignment?.test?.title ?? "";
    const matchesSearch = (appName + " " + testName + " " + row.body + " " + row.category).toLowerCase().includes(search.trim().toLowerCase());
    return matchesStatus && matchesSearch;
  }), [rangedRows, filter, search]);
  const statusCounts = useMemo(() => ({
    all: rangedRows.length,
    pending: rangedRows.filter(row => row.quality_status === "pending").length,
    accepted: rangedRows.filter(row => row.quality_status === "accepted").length,
    rejected: rangedRows.filter(row => row.quality_status === "rejected").length
  }), [rangedRows]);
  const hasActiveFilters = filter !== "all" || range !== "30" || search.trim().length > 0;
  const clearFilters = () => { setFilter("all"); setRange("30"); setSearch(""); };
  const ratedRows = rangedRows.filter(row => row.rating !== null);
  const average = ratedRows.length ? ratedRows.reduce((sum, row) => sum + (row.rating ?? 0), 0) / ratedRows.length : null;
  const feedbackIds = new Set(rangedRows.map(row => row.id));
  const earned = ledger.reduce((sum, entry) => sum + (entry.reference_id && feedbackIds.has(entry.reference_id) && Number(entry.amount) > 0 ? Number(entry.amount) : 0), 0);
  const rewardFor = (feedbackId: string) => ledger.filter(entry => entry.reference_id === feedbackId && Number(entry.amount) > 0).reduce((sum, entry) => sum + Number(entry.amount), 0);

  const nav = [
    { label: "Dashboard", icon: "home", href: "/tester-dashboard" },
    { label: "Discover Tests", icon: "search", href: "/discover-tests" },
    { label: "My Tests", icon: "tests", href: "/my-tests" },
    { label: "Activity & History", icon: "chart", href: "/activity-history" },
    { label: "Check-in History", icon: "calendar", href: "/check-in-history" },
    { label: "Feedback History", icon: "star", href: "/feedback-history", active: true },
    { label: "Wallet & Rewards", icon: "wallet", href: "/wallet-rewards" },
    { label: "Profile", icon: "user", href: "/profile" },
    { label: "Help & Support", icon: "help", href: "/help-support" },
    { label: "Settings", icon: "settings", href: "/settings" },
    ...(isDeveloper ? [{ label: "Developer Dashboard", icon: "code", href: "/developer-dashboard" }] : []),
    ...(isAdmin ? [{ label: "Admin", icon: "shield", href: "/admin" }] : [])
  ];

  if (loading || profileLoading) return <div className="fh-loading"><span className="td-spinner" />Loading your feedback history…</div>;

  return <div className="td-dashboard fh-dashboard">
    <TesterSidebar nav={nav} name={name} firstName={firstName} avatar={avatar} roles={roles} isAdmin={isAdmin} isDeveloper={isDeveloper} workspaceMenuOpen={workspaceMenuOpen} setWorkspaceMenuOpen={setWorkspaceMenuOpen} previewMode={false} />
    <main className="td-main fh-main">
      <header className="td-topbar fh-topbar">
        <label className="td-search"><Icon name="search" size={20}/><input value={search} onChange={event => setSearch(event.target.value)} placeholder="Search in feedback history…"/></label>
        <div className="td-top-actions"><Link className="td-notification" to="/notifications" aria-label={unreadCount>0?`Notifications, ${unreadCount} unread`:"Notifications"}><Icon name="bell" size={21}/>{unreadCount>0&&<i>{unreadCount>9?"9+":unreadCount}</i>}</Link><span className="td-top-divider"/><Link to="/profile" className="td-profile-short"><span>{avatar ? <img src={avatar} alt=""/> : firstName.slice(0,2).toUpperCase()}</span><strong>{name}</strong><b>⌄</b></Link></div>
      </header>
      <div className="fh-content">
        <section className="fh-heading">
          <div className="fh-heading-copy"><span className="fh-heading-icon"><Icon name="star" size={42}/></span><div><h1>Feedback History</h1><p>Track your submitted feedback and review status</p></div></div>
          <div className="fh-stat-grid">
            <article><span className="fh-stat-icon blue"><Icon name="chart" size={25}/></span><div><small>Total Feedback</small><strong>{rangedRows.length}</strong></div></article>
            <article><span className="fh-stat-icon gold">★</span><div><small>Average Rating</small><strong>{average === null ? "—" : average.toFixed(1) + " / 5"}</strong></div></article>
            <article><span className="fh-stat-icon green"><Icon name="gift" size={25}/></span><div><small>Total Earned</small><strong className="fh-earned">+{earned} pts</strong></div></article>
          </div>
        </section>
        {error && <div className="fh-error" role="alert">{error}<button type="button" onClick={() => window.location.reload()}>Retry</button></div>}
        <section className="fh-toolbar" aria-label="Feedback filters">
          <div className="fh-tabs">
            {(["all", "pending", "accepted", "rejected"] as const).map(value => <button type="button" key={value} className={filter === value ? "selected" : ""} aria-pressed={filter === value} onClick={() => setFilter(value)}><span className="fh-tab-label"><Icon name={value === "all" ? "grid" : value === "pending" ? "clock" : value === "accepted" ? "check" : "close"} size={16}/><span>{value === "all" ? "All" : value === "pending" ? "Pending" : value === "accepted" ? "Approved" : "Rejected"}</span></span><b>{statusCounts[value]}</b></button>)}
          </div>
          <label className="fh-range"><Icon name="calendar" size={17}/><select aria-label="Filter by date range" value={range} onChange={event => setRange(event.target.value as RangeKey)}><option value="30">Last 30 Days</option><option value="90">Last 90 Days</option><option value="all">All Time</option></select></label>
        </section>
        <div className="fh-results-meta"><span>Showing <strong>{visibleRows.length}</strong> of <strong>{rangedRows.length}</strong> feedback entries</span>{hasActiveFilters && <button type="button" onClick={clearFilters}>Clear filters <span aria-hidden="true">×</span></button>}</div>
        <section className="fh-list" aria-label="Submitted feedback">
          {visibleRows.length ? visibleRows.map(row => {
            const test = row.assignment?.test;
            const appName = test?.app?.name ?? test?.title ?? "Android app test";
            const reward = rewardFor(row.id);
            const isExpanded = expanded === row.id;
            return <article className={"fh-card " + (isExpanded ? "is-expanded" : "")} key={row.id}>
              <button type="button" className="fh-row" onClick={() => setExpanded(isExpanded ? null : row.id)} aria-expanded={isExpanded}>
                <AppMark name={appName} iconUrl={test?.app?.icon_url}/>
                <span className="fh-row-app"><strong>{appName}</strong><small>{test?.title ?? "Submitted feedback"}</small></span>
                <span className="fh-row-rating"><RatingStars value={row.rating}/><strong>{row.rating === null ? "Not rated" : row.rating.toFixed(1) + " / 5"}</strong></span>
                <span className="fh-row-date"><Icon name="calendar" size={15}/>{formatDate(row.created_at)}</span>
                <span className={"fh-status " + row.quality_status}>{row.quality_status === "accepted" ? "✓  Approved" : row.quality_status === "rejected" ? "✕  Rejected" : "◷  Pending"}</span>
                <strong className="fh-row-reward">+{reward} pts</strong>
                <span className="fh-row-view"><Icon name="eye" size={17}/>View</span>
                <span className="fh-row-chevron">{isExpanded ? "⌃" : "›"}</span>
              </button>
              {isExpanded && <div className="fh-details">
                <section className="fh-app-detail"><AppMark name={appName} iconUrl={test?.app?.icon_url}/><strong>{appName}</strong><small>{test?.title ?? "Feedback submission"}</small><span className="fh-category">{formatCategory(row.category)}</span></section>
                <section className="fh-rating-detail"><h3>Your Rating</h3><div><RatingStars value={row.rating}/><strong>{row.rating === null ? "—" : row.rating.toFixed(1) + " / 5"}</strong></div><small>Overall rating recorded for this feedback</small></section>
                <section className="fh-comment-detail"><h3>Your Comment</h3><blockquote>{row.body}</blockquote><span className="fh-category">{formatCategory(row.category)}</span></section>
                <section className="fh-review-detail"><h3>Review Status</h3><span className={"fh-status " + row.quality_status}>{statusText[row.quality_status]}</span><small>{row.reviewed_at ? "Reviewed on " + formatDate(row.reviewed_at) : "Awaiting QA review"}</small><div className="fh-reward-box"><Icon name="gift" size={25}/><span>Reward Earned<strong>+{reward} pts</strong></span></div></section>
              </div>}
            </article>;
          }) : <div className="fh-empty"><span>★</span><strong>{rows.length ? "No matching feedback" : "Your feedback journey starts here"}</strong><p>{rows.length ? "There are no entries for these filters. Clear them to see your full history." : "Feedback you submit after completing a test will appear here, together with its review status and earned points."}</p>{hasActiveFilters && <button type="button" onClick={clearFilters}>Clear all filters</button>}</div>}
        </section>
        <footer className="fh-footer">TestDZ · Test · Review · Earn</footer>
      </div>
    </main>
  </div>;
}
