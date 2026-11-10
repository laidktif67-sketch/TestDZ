import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { gsap } from "gsap";
import { supabase } from "../../../lib/supabase";
import { useIdentity } from "../../../shared/auth/hooks/useIdentity";
import TesterSidebar from "../components/TesterSidebar";
import { Icon } from "../components/TesterSidebar";
import "../styles/wallet-rewards.css";

type LedgerEntry = {
  id: string;
  wallet_type: string;
  amount: number;
  reason: string;
  reference_type: string | null;
  reference_id: string | null;
  created_at: string;
};

type WalletData = { earned_points: number; purchased_credits: number };

const milestones = [
  { points: 250, title: "Badge", icon: "🏅" },
  { points: 500, title: "Bonus +50", icon: "🎁" },
  { points: 1000, title: "Premium Gift", icon: "🎀" },
  { points: 1500, title: "Special Reward", icon: "⭐" },
  { points: 2000, title: "Top Tester", icon: "👑" }
];

function formatDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleString(undefined, { month: "short", day: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" });
}

function transactionKind(entry: LedgerEntry) {
  if (entry.amount < 0) return "redeemed";
  if (/bonus/i.test(entry.reason)) return "bonus";
  return "earned";
}

function WalletHeroArt() {
  return <div className="tw-hero-art" aria-hidden="true">
    <span className="tw-coin tw-coin-one">★</span><span className="tw-coin tw-coin-two">★</span>
    <span className="tw-wallet-emoji">👛</span><span className="tw-spark tw-spark-one">✦</span><span className="tw-spark tw-spark-two">✧</span>
  </div>;
}

export default function WalletRewardsPage() {
  const { roles = [] } = useIdentity();
  const [name, setName] = useState("Tester");
  const [avatar, setAvatar] = useState("");
  const [workspaceMenuOpen, setWorkspaceMenuOpen] = useState(false);
  const [wallet, setWallet] = useState<WalletData>({ earned_points: 0, purchased_credits: 0 });
  const [ledger, setLedger] = useState<LedgerEntry[]>([]);
  const [notifications, setNotifications] = useState(0);
  const [filter, setFilter] = useState("all");
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [noticeOpen, setNoticeOpen] = useState(false);
  const [catalogNotice, setCatalogNotice] = useState(false);
  const [animatedBalance, setAnimatedBalance] = useState(0);
  const isAdmin = roles.includes("admin");
  const isDeveloper = roles.includes("developer");

  useEffect(() => {
    if (!supabase) { setLoading(false); return; }
    let alive = true;
    async function load(userId: string, email?: string) {
      try {
        const [profileRes, walletRes, ledgerRes, noticeRes] = await Promise.all([
          supabase!.from("profiles").select("display_name,avatar_url").eq("id", userId).maybeSingle(),
          supabase!.from("wallets").select("earned_points,purchased_credits").eq("user_id", userId).maybeSingle(),
          supabase!.from("points_ledger").select("id,wallet_type,amount,reason,reference_type,reference_id,created_at").eq("user_id", userId).order("created_at", { ascending: false }).limit(100),
          supabase!.from("notifications").select("id", { count: "exact", head: true }).eq("user_id", userId).is("read_at", null)
        ]);
        if (!alive) return;
        setName(profileRes.data?.display_name?.trim() || email?.split("@")[0] || "Tester");
        setAvatar(profileRes.data?.avatar_url || "");
        setWallet({
          earned_points: Number(walletRes.data?.earned_points ?? 0),
          purchased_credits: Number(walletRes.data?.purchased_credits ?? 0)
        });
        setLedger((ledgerRes.data ?? []) as LedgerEntry[]);
        setNotifications(noticeRes.count ?? 0);
        if (profileRes.error || walletRes.error || ledgerRes.error || noticeRes.error) {
          setError("Some wallet information could not be loaded. Please refresh and try again.");
        }
      } catch {
        if (alive) setError("We couldn't load your wallet. Check your connection and try again.");
      } finally {
        if (alive) setLoading(false);
      }
    }
    supabase.auth.getSession().then(({ data, error: sessionError }) => {
      if (!alive) return;
      if (sessionError) { setError("We couldn't verify your session. Please refresh and try again."); setLoading(false); return; }
      if (data.session) void load(data.session.user.id, data.session.user.email);
      else setLoading(false);
    }).catch(() => {
      if (alive) { setError("We couldn't verify your session. Please refresh and try again."); setLoading(false); }
    });
    const { data } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!alive) return;
      if (session) { setLoading(true); window.setTimeout(() => { if (alive) void load(session.user.id, session.user.email); }, 0); }
      else { setWallet({ earned_points: 0, purchased_credits: 0 }); setLedger([]); setLoading(false); }
    });
    return () => { alive = false; data.subscription.unsubscribe(); };
  }, []);

  const filteredLedger = useMemo(() => ledger.filter((entry) => {
    const kind = transactionKind(entry);
    const matchesFilter = filter === "all" || (filter === "earned" && kind === "earned") || (filter === "redeemed" && kind === "redeemed") || (filter === "bonus" && kind === "bonus");
    const matchesSearch = (entry.reason + " " + (entry.reference_type ?? "")).toLowerCase().includes(search.toLowerCase());
    return matchesFilter && matchesSearch;
  }), [ledger, filter, search]);

  const lifetimeEarned = ledger.filter((entry) => entry.wallet_type === "earned_points" && entry.amount > 0).reduce((sum, entry) => sum + entry.amount, 0);
  const nextMilestone = milestones.find((item) => item.points > wallet.earned_points) ?? milestones[milestones.length - 1];
  const milestoneProgress = Math.min(100, Math.round((wallet.earned_points / nextMilestone.points) * 100));
  const firstName = name.split(/\s+/)[0] || "Tester";

  useEffect(() => {
    const target = wallet.earned_points;
    const counter = { value: 0 };
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reducedMotion) { setAnimatedBalance(target); return; }
    const tween = gsap.to(counter, { value: target, duration: 1.15, ease: "power3.out", onUpdate: () => setAnimatedBalance(Math.round(counter.value)) });
    return () => { tween.kill(); };
  }, [wallet.earned_points]);

  const nav = [
    { label: "Dashboard", icon: "home", href: "/tester-dashboard" },
    { label: "My Tests", icon: "tests", href: "/my-tests" },
    { label: "Feedback History", icon: "star", href: "/feedback-history" },
    { label: "Wallet & Rewards", icon: "wallet", href: "/wallet-rewards", active: true },
    { label: "Profile", icon: "user", href: "/profile" },
    { label: "Help & Support", icon: "bell", href: "/help-support" },
    { label: "Settings", icon: "settings", href: "/settings" },
    ...(isDeveloper || isAdmin ? [{ label: "Discover Apps", icon: "search", href: "/apps" }] : []),
    ...(isDeveloper || isAdmin ? [{ label: "Developer Dashboard", icon: "code", href: "/developer-dashboard" }] : []),
    ...(isAdmin ? [{ label: "Admin", icon: "shield", href: "/admin" }] : [])
  ];

  if (loading) return <div className="tw-loading"><span className="td-spinner" />Loading your wallet…</div>;

  return <div className="td-dashboard tw-page">
    <TesterSidebar nav={nav} name={name} firstName={firstName} avatar={avatar} roles={roles} isAdmin={isAdmin} isDeveloper={isDeveloper} workspaceMenuOpen={workspaceMenuOpen} setWorkspaceMenuOpen={setWorkspaceMenuOpen} previewMode={false} />
    <main className="td-main tw-main">
      <header className="td-topbar tw-topbar">
        <label className="td-search"><Icon name="search" size={21} /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search transactions…" /></label>
        <div className="td-top-actions">
          <button className="td-notification" type="button" onClick={() => setNoticeOpen((value) => !value)} aria-label="Notifications"><Icon name="bell" size={22} />{notifications > 0 && <i>{notifications > 9 ? "9+" : notifications}</i>}</button>
          <span className="td-top-divider" />
          <Link to="/profile" className="td-profile-short"><span>{avatar ? <img src={avatar} alt="" /> : firstName.slice(0, 2).toUpperCase()}</span><b>⌄</b></Link>
        </div>
        {noticeOpen && <div className="td-notice-pop"><strong>{notifications ? notifications + " unread notifications" : "You're all caught up"}</strong><p>{notifications ? "Open your profile to review account activity." : "New updates will appear here."}</p></div>}
      </header>

      <section className="tw-hero">
        <div className="tw-hero-copy"><span className="tw-hero-tag">⭐ TestDZ Rewards</span><h1>Track your earnings,<br />check your points and redeem <em>rewards.</em></h1><p>Your testing effort deserves recognition. Keep earning with every test.</p><Link to="/withdrawal-request" className="tw-withdraw-link">💸 Request Withdrawal <span>→</span></Link></div>
        <WalletHeroArt />
      </section>

      {error && <div className="tw-error" role="alert">{error}</div>}

      <section className="tw-summary" aria-label="Wallet summary">
        <article className="tw-balance-card tw-balance-blue">
          <div className="tw-card-top"><span className="tw-card-icon">👛</span><span className="tw-card-caption">WALLET BALANCE</span></div>
          <div className="tw-card-content"><b>Total Balance</b><strong>{animatedBalance.toLocaleString()} <i>pts</i></strong><small><span className="tw-live-dot" /> Available earned points</small></div>
          <span className="tw-card-decoration" aria-hidden="true"><i /><i /><i /><i /></span>
          <span className="tw-card-glow" aria-hidden="true" />
        </article>
        <article className="tw-balance-card tw-balance-green">
          <div className="tw-card-top"><span className="tw-card-icon">🏆</span><span className="tw-card-caption">TOTAL EARNED</span></div>
          <div className="tw-card-content"><b>Earned Points</b><strong>{lifetimeEarned.toLocaleString()} <i>pts</i></strong><small>From the latest 100 ledger entries</small></div>
          <span className="tw-card-decoration" aria-hidden="true"><i /><i /><i /><i /></span>
          <span className="tw-card-glow" aria-hidden="true" />
        </article>
        <article className="tw-balance-card tw-balance-gold">
          <div className="tw-card-top"><span className="tw-card-icon">⏳</span><span className="tw-card-caption">IN REVIEW</span></div>
          <div className="tw-card-content"><b>Pending Rewards</b><strong>—</strong><small>Pending rewards are not tracked yet</small></div>
          <span className="tw-hourglass" aria-hidden="true">⌛</span>
          <span className="tw-card-glow" aria-hidden="true" />
        </article>
      </section>

      <section className="tw-middle">
        <article className="tw-panel tw-milestones">
          <div className="tw-panel-heading"><h2>🏆 Reward Milestones</h2><span className="tw-earned-label">{wallet.earned_points.toLocaleString()} available</span></div>
          <div className="tw-milestone-track"><span className="tw-track-base" /><span className="tw-track-fill" style={{ width: Math.min(100, Math.round((wallet.earned_points / 2000) * 100)) + "%" }} />{milestones.map((item) => {
            const achieved = lifetimeEarned >= item.points;
            return <div className={"tw-milestone " + (achieved ? "achieved" : "")} key={item.points}><span className="tw-milestone-dot">{achieved ? "✓" : item.icon}</span><b>{item.points.toLocaleString()} pts</b><small>{item.title}</small></div>;
          })}</div>
          <div className="tw-milestone-progress"><span>Balance progress: <strong>toward {nextMilestone.points.toLocaleString()} pts · {nextMilestone.title}</strong></span><b>{milestoneProgress}%</b></div>
        </article>
        <article className="tw-redeem-card"><div className="tw-gift-art" aria-hidden="true">🎁</div><div><span className="tw-redeem-kicker">A little thank-you</span><h2>Redeem Rewards</h2><p>Explore reward options as soon as the TestDZ rewards catalogue is available.</p><button type="button" onClick={() => setCatalogNotice((value) => !value)}>🎁 Browse Rewards <span>→</span></button>{catalogNotice && <small className="tw-catalog-note">The rewards catalogue is not enabled yet. Your points remain safely in your wallet.</small>}</div></article>
      </section>

      <section className="tw-panel tw-transactions">
        <div className="tw-panel-heading tw-transaction-heading"><h2>🕘 Transaction History</h2><div className="tw-filters" role="group" aria-label="Filter transactions">{[{ value: "all", label: "All" }, { value: "earned", label: "Earned" }, { value: "redeemed", label: "Redeemed" }, { value: "bonus", label: "Bonus" }].map((item) => <button key={item.value} type="button" className={filter === item.value ? "active" : ""} onClick={() => setFilter(item.value)}>{item.label}</button>)}</div></div>
        <div className="tw-table-wrap"><table className="tw-table"><thead><tr><th>Date</th><th>Description</th><th>Type</th><th>Points</th><th>Status</th></tr></thead><tbody>
          {filteredLedger.map((entry) => {
            const kind = transactionKind(entry);
            return <tr key={entry.id}><td>{formatDate(entry.created_at)}</td><td><span className="tw-row-description"><span>{kind === "redeemed" ? "🎁" : kind === "bonus" ? "✨" : "🚀"}</span>{entry.reason}</span></td><td><span className={"tw-type-pill " + kind}>{kind === "redeemed" ? "↘ Redeemed" : kind === "bonus" ? "🎁 Bonus" : "↗ Earned"}</span></td><td className={entry.amount < 0 ? "negative" : "positive"}>{entry.amount > 0 ? "+" : ""}{entry.amount.toLocaleString()} pts</td><td><span className="tw-status-pill">Recorded</span></td></tr>;
          })}
          {!filteredLedger.length && <tr><td colSpan={5} className="tw-empty"><span>🧾</span><strong>{ledger.length ? "No transactions match this filter" : "Your transaction history is empty"}</strong><small>Point activity will appear here when it is recorded.</small></td></tr>}
        </tbody></table></div>
        <div className="tw-table-footer"><span>Showing {filteredLedger.length} of {ledger.length} recent transactions</span><span>Points ledger · read only</span></div>
      </section>
      <footer className="tw-footer">TestDZ · Test · Review · Earn <span>💙</span></footer>
    </main>
  </div>;
}
