import { useEffect, useMemo, useState } from "react";
import type { Session } from "@supabase/supabase-js";
import { Link, Navigate } from "react-router-dom";
import { supabase } from "../lib/supabase";
import "./FeedbackHistory.css";

type FeedbackRow = {
  id: string;
  assignment_id: string;
  rating: number | null;
  body: string;
  category: string;
  quality_status: "pending" | "accepted" | "rejected";
  reviewed_at: string | null;
  created_at: string;
  assignment?: {
    id: string;
    test?: { title: string; app?: { name: string; icon_url: string | null } | null } | null;
  } | null;
};
type LedgerRow = { amount: number; reference_id: string | null };
type RangeKey = "30" | "90" | "all";
const statusLabel = (status: FeedbackRow["quality_status"]) =>
  status === "accepted" ? "Approved" : status === "rejected" ? "Rejected" : "Pending";
const dateLabel = (value: string) => new Date(value).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });

function Stars({ value }: { value: number | null }) {
  return <span className="fh-stars" aria-label={value ? value + " out of 5" : "Not rated"}>
    {Array.from({ length: 5 }, (_, i) => <span key={i} className={value && i < value ? "filled" : ""}>★</span>)}
  </span>;
}

function FeedbackIcon({ name }: { name: string }) {
  const icon = name.toLowerCase();
  const symbol = icon.includes("secure") ? "✓" : icon.includes("media") ? "▶" : icon.includes("health") ? "♥" : "✦";
  return <span className={"fh-app-icon " + (icon.includes("secure") ? "green" : icon.includes("media") ? "purple" : icon.includes("health") ? "pink" : "blue")}>{symbol}</span>;
}

export default function FeedbackHistoryPage({ session }: { session: Session }) {
  const [rows, setRows] = useState<FeedbackRow[]>([]);
  const [ledger, setLedger] = useState<LedgerRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [filter, setFilter] = useState<"all" | FeedbackRow["quality_status"]>("all");
  const [range, setRange] = useState<RangeKey>("30");
  const [search, setSearch] = useState("");
  const [expanded, setExpanded] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    async function load() {
      if (!supabase) { setError("Supabase connection is not configured."); setLoading(false); return; }
      setLoading(true); setError("");
      const [feedbackRes, ledgerRes] = await Promise.all([
        supabase.from("feedback")
          .select("id,assignment_id,rating,body,category,quality_status,reviewed_at,created_at,assignment:assignments(id,test:tests(title,app:apps(name,icon_url)))")
          .eq("tester_id", session.user.id)
          .order("created_at", { ascending: false }),
        supabase.from("points_ledger").select("amount,reference_id").eq("user_id", session.user.id).eq("wallet_type", "earned_points")
      ]);
      if (!alive) return;
      if (feedbackRes.error) setError("We couldn't load your feedback history. Check your connection and access permissions, then retry.");
      else setRows((feedbackRes.data ?? []) as unknown as FeedbackRow[]);
      if (ledgerRes.error) {
        // Feedback remains readable even if ledger visibility is unavailable.
        setLedger([]);
      } else setLedger((ledgerRes.data ?? []) as LedgerRow[]);
      setLoading(false);
    }
    void load();
    return () => { alive = false; };
  }, [session.user.id]);

  const visible = useMemo(() => {
    const cutoff = range === "all" ? null : Date.now() - Number(range) * 86400000;
    return rows.filter(row => {
      const matchesStatus = filter === "all" || row.quality_status === filter;
      const matchesRange = !cutoff || new Date(row.created_at).getTime() >= cutoff;
      const app = row.assignment?.test?.app?.name ?? "";
      const test = row.assignment?.test?.title ?? "";
      const matchesSearch = (app + " " + test + " " + row.body).toLowerCase().includes(search.trim().toLowerCase());
      return matchesStatus && matchesRange && matchesSearch;
    });
  }, [rows, filter, range, search]);

  const rangedRows = useMemo(() => {
    const cutoff = range === "all" ? null : Date.now() - Number(range) * 86400000;
    return rows.filter(row => !cutoff || new Date(row.created_at).getTime() >= cutoff);
  }, [rows, range]);
  const total = rangedRows.length;
  const rated = rangedRows.filter(row => row.rating !== null);
  const average = rated.length ? rated.reduce((sum, row) => sum + (row.rating ?? 0), 0) / rated.length : null;
  const feedbackIds = new Set(rangedRows.map(row => row.id));
  const earned = ledger.reduce((sum, entry) => sum + (entry.reference_id && feedbackIds.has(entry.reference_id) ? Math.max(0, Number(entry.amount)) : 0), 0);

  if (loading) return <div className="fh-loading"><span className="td-spinner" /> Loading your feedback history…</div>;

  return <main className="td-app fh-app-shell">
    <aside className="td-sidebar fh-sidebar">
      <Link className="td-brand" to="/dashboard"><span className="td-brand-mark">✓</span><span><b>TestDZ</b><small>Test · Review · Earn</small></span></Link>
      <nav className="td-nav" aria-label="Tester navigation">
        <Link to="/dashboard"><span>⌂</span>Dashboard</Link>
        <Link to="/apps"><span>▣</span>Discover</Link>
        <Link to="/dashboard#my-tests"><span>▤</span>My Tests</Link>
        <Link className="active" to="/feedback-history"><span>★</span>Feedback History</Link>
        <Link to="/profile"><span>♔</span>Rewards</Link>
        <Link to="/profile"><span>▣</span>Wallet</Link>
        <Link to="/profile"><span>●</span>Profile</Link>
      </nav>
      <div className="fh-sidebar-promo"><span>🏆</span><b>Your feedback helps build a better Android experience!</b><i>♥</i></div>
      <div className="td-sidebar-user"><div className="td-avatar">{(session.user.email ?? "T").slice(0,1).toUpperCase()}</div><div className="td-user-meta"><b>{session.user.email?.split("@")[0] ?? "Tester"}</b><small>Tester</small></div><Link to="/profile" className="td-settings" aria-label="Profile settings">⚙</Link></div>
    </aside>

    <section className="td-main fh-main">
      <header className="td-topbar fh-topbar">
        <label className="td-search"><span>⌕</span><input value={search} onChange={event => setSearch(event.target.value)} placeholder="Search in feedback history..." aria-label="Search feedback history" /></label>
        <div className="td-top-actions"><span className="fh-bell">♧</span><span className="td-top-divider" /><span className="td-top-avatar">{(session.user.email ?? "T").slice(0,2).toUpperCase()}</span><span className="fh-user-name">{session.user.email?.split("@")[0] ?? "Tester"}⌄</span></div>
      </header>

      <div className="fh-content">
        <section className="fh-heading-card">
          <div className="fh-heading-copy"><span className="fh-heading-icon">★</span><div><h1>Feedback History</h1><p>Track your submitted feedback and review status</p></div></div>
          <div className="fh-stats">
            <article><span className="fh-stat-symbol blue">▥</span><div><small>Total Feedback</small><strong>{total}</strong></div></article>
            <article><span className="fh-stat-symbol gold">★</span><div><small>Average Rating</small><strong>{average === null ? "—" : average.toFixed(1) + " / 5"}</strong></div></article>
            <article><span className="fh-stat-symbol green">🎁</span><div><small>Total Earned</small><strong className="fh-earned">+{earned} pts</strong></div></article>
          </div>
        </section>

        {error && <div className="fh-error" role="alert">{error}<button onClick={() => window.location.reload()}>Retry</button></div>}

        <section className="fh-toolbar" aria-label="Feedback filters">
          <div className="fh-tabs">
            {(["all", "pending", "accepted", "rejected"] as const).map(value => <button key={value} className={filter === value ? "selected" : ""} onClick={() => setFilter(value)}>{value === "all" ? "▦  All" : value === "pending" ? "◷  Pending" : value === "accepted" ? "●  Approved" : "✕  Rejected"}</button>)}
          </div>
          <label className="fh-range"><span>▦</span><select value={range} onChange={event => setRange(event.target.value as RangeKey)}><option value="30">Last 30 Days</option><option value="90">Last 90 Days</option><option value="all">All Time</option></select></label>
        </section>

        <section className="fh-list" aria-label="Submitted feedback">
          {visible.length ? visible.map(row => {
            const test = row.assignment?.test;
            const appName = test?.app?.name ?? test?.title ?? "Android app test";
            const reward = ledger.filter(entry => entry.reference_id === row.id).reduce((sum, entry) => sum + Math.max(0, Number(entry.amount)), 0);
            const isOpen = expanded === row.id;
            return <article className={"fh-feedback-card " + (isOpen ? "expanded" : "")} key={row.id}>
              <button className="fh-row" onClick={() => setExpanded(isOpen ? null : row.id)} aria-expanded={isOpen}>
                <FeedbackIcon name={appName} />
                <span className="fh-row-title"><b>{appName}</b><small>{test?.title ?? "Submitted feedback"}</small></span>
                <span className="fh-row-rating"><Stars value={row.rating} /><b>{row.rating === null ? "Not rated" : row.rating.toFixed(1) + " / 5"}</b></span>
                <span className="fh-row-date">▦　{dateLabel(row.created_at)}</span>
                <span className={"fh-status fh-status-" + row.quality_status}>{row.quality_status === "accepted" ? "✓  Approved" : row.quality_status === "rejected" ? "✕  Rejected" : "◷  Pending"}</span>
                <span className="fh-row-reward">+{reward} pts</span>
                <span className="fh-view">◉　View</span>
                <span className="fh-chevron">{isOpen ? "⌃" : "›"}</span>
              </button>
              {isOpen && <div className="fh-details">
                <div className="fh-app-detail"><FeedbackIcon name={appName} /><b>{appName}</b><small>{test?.title ?? "Feedback submission"}</small><span className="fh-category">{row.category.replace("_", " ")}</span></div>
                <div className="fh-rating-detail"><b>Your Rating</b><div><Stars value={row.rating} /><strong>{row.rating === null ? "—" : row.rating.toFixed(1) + " / 5"}</strong></div><small>Overall rating recorded for this feedback</small></div>
                <div className="fh-comment-detail"><b>Your Comment</b><blockquote>{row.body}</blockquote><span className="fh-issue-tag">{row.category === "bug" ? "Bug" : row.category === "performance" ? "Performance" : row.category === "usability" ? "Usability" : row.category === "compatibility" ? "Compatibility" : "General"}</span></div>
                <div className="fh-review-detail"><b>Review Status</b><strong className={"fh-status fh-status-" + row.quality_status}>{statusLabel(row.quality_status)}</strong><small>{row.reviewed_at ? "Reviewed on " + dateLabel(row.reviewed_at) : "Awaiting QA review"}</small><div className="fh-reward-box">🎁 <span>Reward Earned<strong>+{reward} pts</strong></span></div></div>
              </div>}
            </article>;
          }) : <div className="fh-empty"><span>★</span><b>No feedback found</b><p>{rows.length ? "Try changing your filters or search term." : "Your submitted feedback will appear here after you send your first report."}</p></div>}
        </section>
        <footer className="td-footer">© 2026 TestDZ · Test · Review · Earn</footer>
      </div>
    </section>
  </main>;
}
