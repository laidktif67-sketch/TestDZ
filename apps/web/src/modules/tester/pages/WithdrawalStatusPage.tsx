import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "../../../lib/supabase";
import { useIdentity } from "../../../shared/auth/hooks/useIdentity";
import TesterSidebar from "../components/TesterSidebar";
import "../styles/withdrawal-status.css";

export default function WithdrawalStatusPage() {
  const { roles = [] } = useIdentity();
  const [name, setName] = useState("Tester");
  const [avatar, setAvatar] = useState("");
  const [workspaceMenuOpen, setWorkspaceMenuOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const isAdmin = roles.includes("admin");
  const isDeveloper = roles.includes("developer");
  const firstName = name.split(/\\s+/)[0] || "Tester";

  useEffect(() => {
    let alive = true;
    async function load() {
      try {
        if (!supabase) return;
        const { data } = await supabase.auth.getUser();
        const user = data.user;
        if (!user) return;
        const { data: profile } = await supabase.from("profiles").select("display_name,avatar_url").eq("id", user.id).maybeSingle();
        if (alive) {
          setName(profile?.display_name?.trim() || user.email?.split("@")[0] || "Tester");
          setAvatar(profile?.avatar_url || "");
        }
      } finally {
        if (alive) setLoading(false);
      }
    }
    void load();
    return () => { alive = false; };
  }, []);

  const nav = [
    { label: "Dashboard", icon: "home", href: "/tester-dashboard" },
    { label: "My Tests", icon: "tests", href: "/my-tests" },
    { label: "Feedback History", icon: "star", href: "/feedback-history" },
    { label: "Wallet & Rewards", icon: "wallet", href: "/wallet-rewards" },
    { label: "Withdrawal Status", icon: "clock", href: "/withdrawal-status", active: true },
    { label: "Profile", icon: "user", href: "/profile" },
    { label: "Help & Support", icon: "bell", href: "/help-support" },
    { label: "Settings", icon: "settings", href: "/settings" },
    ...(isDeveloper || isAdmin ? [{ label: "Discover Apps", icon: "search", href: "/apps" }] : []),
    ...(isDeveloper || isAdmin ? [{ label: "Developer Dashboard", icon: "code", href: "/developer-dashboard" }] : []),
    ...(isAdmin ? [{ label: "Admin", icon: "shield", href: "/admin" }] : [])
  ];

  if (loading) return <div className="tws-loading">Loading withdrawal details…</div>;

  return <div className="td-dashboard tws-page">
    <TesterSidebar nav={nav} name={name} firstName={firstName} avatar={avatar} roles={roles} isAdmin={isAdmin} isDeveloper={isDeveloper} workspaceMenuOpen={workspaceMenuOpen} setWorkspaceMenuOpen={setWorkspaceMenuOpen} previewMode={false} />
    <main className="td-main tws-main">
      <header className="tws-header"><div><span className="tws-eyebrow">WALLET · PAYOUT TRACKER</span><h1>Withdrawal Details & Status <span>📦</span></h1><p>Follow your payout request from submission to completion.</p></div><Link to="/wallet-rewards" className="tws-back">← Back to Wallet</Link></header>
      <div className="tws-demo-banner"><span>🧪</span><div><strong>Demo status page</strong><p>This is a visual preview. No real withdrawal request exists yet, and no payout status is being fetched or stored.</p></div></div>
      <section className="tws-status-card">
        <div className="tws-status-top"><div><span className="tws-label">SAMPLE REQUEST ID</span><strong>#WD-DEMO-001</strong></div><span className="tws-status-badge">⌛ Pending review</span></div>
        <div className="tws-amount-row"><div><span className="tws-label">REQUESTED AMOUNT</span><strong>1,000 <small>DA</small></strong></div><div className="tws-date"><span className="tws-label">SUBMITTED ON</span><strong>Demo date</strong></div></div>
        <div className="tws-progress"><span /></div><div className="tws-progress-labels"><span>Request submitted</span><span>Under review</span><span>Paid</span></div>
      </section>
      <div className="tws-layout">
        <section className="tws-panel">
          <div className="tws-panel-heading"><span>🧭</span><div><h2>Request timeline</h2><p>Each step will update when your request is processed.</p></div></div>
          <div className="tws-timeline">
            <div className="tws-step done"><span className="tws-step-icon">✓</span><div><strong>Request created</strong><p>Your withdrawal details have been submitted.</p><small>Demo event · No real submission</small></div><b>Done</b></div>
            <div className="tws-step current"><span className="tws-step-icon">⌛</span><div><strong>Waiting for review</strong><p>The admin team checks the amount and payment details.</p><small>Next step in this sample flow</small></div><b>Pending</b></div>
            <div className="tws-step"><span className="tws-step-icon">✓</span><div><strong>Request approved</strong><p>Your payout is approved and ready for processing.</p></div><b>Waiting</b></div>
            <div className="tws-step"><span className="tws-step-icon">💸</span><div><strong>Payment sent</strong><p>The payout is transferred to your selected account.</p></div><b>Waiting</b></div>
          </div>
        </section>
        <aside className="tws-side">
          <section className="tws-panel tws-details">
            <div className="tws-panel-heading"><span>🧾</span><div><h2>Payment details</h2><p>Example information only</p></div></div>
            <div className="tws-detail"><span>Payment method</span><strong>📱 BaridiMob</strong></div>
            <div className="tws-detail"><span>Account holder</span><strong>Sample Tester</strong></div>
            <div className="tws-detail"><span>Account number</span><strong>•••• •••• 0000</strong></div>
            <div className="tws-detail"><span>Withdrawal fee</span><strong>Not configured</strong></div>
            <div className="tws-detail total"><span>Expected payout</span><strong>1,000 DA</strong></div>
          </section>
          <section className="tws-help"><span>💬</span><h3>Need help?</h3><p>If a real request is delayed, you will be able to contact support with its request ID.</p><Link to="/help-support">Visit Help & Support ↗</Link></section>
        </aside>
      </div>
      <div className="tws-bottom-actions"><Link to="/withdrawal-request" className="tws-primary">Create a withdrawal request <span>→</span></Link><Link to="/wallet-rewards" className="tws-secondary">Return to wallet</Link></div>
      <footer className="tws-footer">TestDZ · Your rewards, clearly tracked <span>💙</span></footer>
    </main>
  </div>;
}
