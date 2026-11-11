import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "../../../lib/supabase";
import { useIdentity } from "../../../shared/auth/hooks/useIdentity";
import TesterSidebar, { Icon } from "../components/TesterSidebar";
import "../styles/withdrawal-status.css";

export default function WithdrawalStatusPage() {
  const { roles = [] } = useIdentity();
  const [name, setName] = useState("Tester");
  const [avatar, setAvatar] = useState("");
  const [workspaceMenuOpen, setWorkspaceMenuOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const isAdmin = roles.includes("admin");
  const isDeveloper = roles.includes("developer");
  const firstName = name.split(/\s+/)[0] || "Tester";

  useEffect(() => {
    const client = supabase;
    if (!client) { setLoading(false); return; }
    const db = client;
    let alive = true;
    async function load() {
      try {
        const { data: sessionData, error: sessionError } = await db.auth.getSession();
        if (sessionError) throw sessionError;
        const user = sessionData.session?.user;
        if (!user) return;
        const { data: profile, error } = await db.from("profiles").select("display_name,avatar_url").eq("id", user.id).maybeSingle();
        if (error) throw error;
        if (alive) {
          setName(profile?.display_name?.trim() || user.email?.split("@")[0] || "Tester");
          setAvatar(profile?.avatar_url || "");
        }
      } catch {
        if (alive) setLoadError("We couldn't load your profile details. Withdrawal tracking remains unavailable.");
      } finally {
        if (alive) setLoading(false);
      }
    }
    void load();
    return () => { alive = false; };
  }, []);

  const nav = [
    { label: "Dashboard", icon: "home", href: "/tester-dashboard" },
    { label: "Discover Tests", icon: "search", href: "/discover-tests" },
    { label: "My Tests", icon: "tests", href: "/my-tests" },
    { label: "Rewards", icon: "gift", href: "/wallet-rewards" },
    { label: "Wallet", icon: "wallet", href: "/wallet-rewards", active: true },
    { label: "Profile", icon: "user", href: "/profile" },
    { label: "Help & Support", icon: "headset", href: "/help-support" },
    { label: "Settings", icon: "settings", href: "/settings" },
    ...(isAdmin ? [{ label: "Admin", icon: "shield", href: "/admin" }] : [])
  ];

  if (loading) return <div className="tws-loading"><span className="td-spinner" />Loading withdrawal details…</div>;

  return <div className="td-dashboard tws-page">
    <TesterSidebar nav={nav} name={name} firstName={firstName} avatar={avatar} roles={roles} isAdmin={isAdmin} isDeveloper={isDeveloper} workspaceMenuOpen={workspaceMenuOpen} setWorkspaceMenuOpen={setWorkspaceMenuOpen} previewMode={false} />
    <main className="td-main tws-main">
      <header className="td-topbar tws-topbar">
        <label className="td-search"><Icon name="search" size={20}/><input aria-label="Search TestDZ" placeholder="Search in TestDZ…" readOnly /></label>
        <div className="td-top-actions"><Link to="/help-support" className="tws-top-help" aria-label="Help and support"><Icon name="bell" size={21}/></Link><span className="td-top-divider"/><Link to="/profile" className="td-profile-short"><span>{avatar ? <img src={avatar} alt=""/> : firstName.slice(0,2).toUpperCase()}</span><strong>{name}</strong><b>⌄</b></Link></div>
      </header>

      <Link to="/wallet-rewards" className="tws-back"><Icon name="arrow" size={16}/> Back to Wallet</Link>
      <section className="tws-hero">
        <div className="tws-hero-icon"><Icon name="wallet" size={49}/><span><Icon name="check" size={18}/></span></div>
        <div className="tws-hero-copy"><h1>Withdrawal Details &amp; Status</h1><p>Track the status of your withdrawal request.</p></div>
        <div className="tws-hero-art" aria-hidden="true"><span className="tws-coin tws-coin-a">$</span><span className="tws-coin tws-coin-b">$</span><div className="tws-phone"><span><Icon name="check" size={34}/></span></div></div>
      </section>

      {loadError && <div className="tws-error" role="alert">{loadError}</div>}
      <div className="tws-notice" role="status"><Icon name="info" size={22}/><div><strong>Withdrawal tracking is not active yet</strong><p>No real withdrawal request is currently available. This page will display your request details and status history once the secure withdrawal workflow is implemented.</p></div></div>

      <section className="tws-summary-grid">
        <article className="tws-request-card">
          <div className="tws-request-head"><span className="tws-request-id">No active request</span><span className="tws-processing"><i/> Not submitted</span></div>
          <div className="tws-request-overview">
            <div className="tws-method-block"><span className="tws-method-symbol"><Icon name="wallet" size={42}/></span><strong>—</strong><small>Payment method</small></div>
            <div className="tws-amount-block"><strong>— <small>Points</small></strong><span>Amount will appear here</span></div>
            <div className="tws-date-block"><Icon name="calendar" size={30}/><div><span>Requested on</span><strong>—</strong><small>Waiting for request</small></div></div>
          </div>
          <div className="tws-request-foot"><span><Icon name="shield" size={15}/> Your points remain in your wallet</span><span>Request reference: —</span></div>
        </article>
        <aside className="tws-request-summary">
          <h2><Icon name="info" size={22}/> Request Summary</h2>
          <div className="tws-summary-rows">
            <div><span>Withdrawal Method:</span><strong>Not selected</strong></div>
            <div><span>Points Amount:</span><strong>—</strong></div>
            <div><span>Estimated Amount:</span><strong>Not configured</strong></div>
            <div><span>Processing Time:</span><strong>Not available</strong></div>
          </div>
          <p className="tws-summary-note"><Icon name="lock" size={14}/> Payout estimates appear after official rates and processing rules are configured.</p>
        </aside>
      </section>

      <section className="tws-panel tws-timeline-panel">
        <div className="tws-section-heading"><h2><Icon name="clock" size={23}/> Status Timeline</h2><span>Workflow preview</span></div>
        <div className="tws-horizontal-timeline">
          <article className="tws-stage"><span className="tws-stage-icon"><Icon name="send" size={19}/></span><strong>Request Submitted</strong><small>Awaiting first request</small></article>
          <article className="tws-stage"><span className="tws-stage-icon"><Icon name="search" size={19}/></span><strong>Under Review</strong><small>Not started</small></article>
          <article className="tws-stage"><span className="tws-stage-icon"><Icon name="refresh" size={19}/></span><strong>Processing</strong><small>Not started</small></article>
          <article className="tws-stage"><span className="tws-stage-icon"><Icon name="check" size={20}/></span><strong>Completed</strong><small>Not started</small></article>
        </div>
        <p className="tws-timeline-note">Timeline stages are shown for guidance only. No request has been submitted, reviewed or paid.</p>
      </section>

      <section className="tws-panel tws-recent-panel">
        <div className="tws-section-heading"><h2><Icon name="list" size={22}/> Recent Withdrawals</h2><span>Request history</span></div>
        <div className="tws-table-wrap"><table className="tws-table"><thead><tr><th>#</th><th>Date</th><th>Method</th><th>Amount</th><th>Status</th><th>Details</th></tr></thead><tbody><tr><td colSpan={6} className="tws-empty"><span><Icon name="receipt" size={27}/></span><strong>No withdrawal history yet</strong><small>Your submitted withdrawal requests will appear here.</small></td></tr></tbody></table></div>
        <div className="tws-history-footer"><span>0 withdrawal requests</span><span>Secure payout history · read only</span></div>
      </section>

      <div className="tws-bottom-actions"><Link to="/withdrawal-request" className="tws-primary">Create a withdrawal request <Icon name="arrow" size={17}/></Link><Link to="/wallet-rewards" className="tws-secondary">Return to Wallet</Link></div>
      <footer className="tws-footer">TestDZ · Your rewards, clearly tracked <span>💙</span></footer>
    </main>
  </div>;
}
