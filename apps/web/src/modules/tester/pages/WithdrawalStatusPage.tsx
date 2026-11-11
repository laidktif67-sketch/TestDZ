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
  const firstName = name.split(/\s+/)[0] || "Tester";

  useEffect(() => {
    const client = supabase;
    if (!client) { setLoading(false); return; }
    let alive = true;
    async function load() {
      try {
        const { data: sessionData } = await client.auth.getSession();
        const user = sessionData.session?.user;
        if (!user) return;
        const { data: profile } = await client.from("profiles").select("display_name,avatar_url").eq("id", user.id).maybeSingle();
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
    { label: "Dashboard", icon: "flask", href: "/tester-dashboard" },
    { label: "Discover Tests", icon: "search", href: "/discover-tests" },
    { label: "My Tests", icon: "tests", href: "/my-tests" },
    { label: "Wallet & Rewards", icon: "wallet", href: "/wallet-rewards", active: true },
    ...(isAdmin ? [{ label: "Admin", icon: "shield", href: "/admin" }] : [])
  ];

  if (loading) return <div className="tws-loading">Loading withdrawal details…</div>;

  return <div className="td-dashboard tws-page">
    <TesterSidebar nav={nav} name={name} firstName={firstName} avatar={avatar} roles={roles} isAdmin={isAdmin} isDeveloper={isDeveloper} workspaceMenuOpen={workspaceMenuOpen} setWorkspaceMenuOpen={setWorkspaceMenuOpen} previewMode={false} />
    <main className="td-main tws-main">
      <header className="tws-header">
        <div><span className="tws-eyebrow">WALLET · PAYOUT TRACKER</span><h1>Withdrawal Details &amp; Status <span>📦</span></h1><p>Track your payout after a real withdrawal request is created.</p></div>
        <Link to="/wallet-rewards" className="tws-back">← Back to Wallet</Link>
      </header>
      <div className="tws-demo-banner" role="status"><span>ℹ️</span><div><strong>Withdrawal tracking is not active yet</strong><p>No withdrawal request exists, no points have been reserved or deducted, and no payout status is being fetched or stored.</p></div></div>
      <section className="tws-status-card">
        <div className="tws-status-top"><div><span className="tws-label">REQUEST TRACKING</span><strong>Awaiting workflow activation</strong></div><span className="tws-status-badge">Not available</span></div>
        <p className="tws-status-copy">This screen is a preview of the planned tracking experience. It will show a real request reference, amount, method and current status only after the secure withdrawal workflow is implemented.</p>
      </section>
      <div className="tws-layout">
        <section className="tws-panel">
          <div className="tws-panel-heading"><span>🧭</span><div><h2>Planned request timeline</h2><p>These stages are not active and none is marked complete.</p></div></div>
          <div className="tws-timeline">
            <div className="tws-step"><span className="tws-step-icon">1</span><div><strong>Request submitted</strong><p>The server validates the request and reserves eligible earned points atomically.</p></div><b>Not active</b></div>
            <div className="tws-step"><span className="tws-step-icon">2</span><div><strong>Under review</strong><p>An authorized administrator reviews the request and payout details.</p></div><b>Not active</b></div>
            <div className="tws-step"><span className="tws-step-icon">3</span><div><strong>Processing</strong><p>The approved payout is reconciled with the selected payment provider.</p></div><b>Not active</b></div>
            <div className="tws-step"><span className="tws-step-icon">4</span><div><strong>Completed</strong><p>The payout is confirmed and the reserved points are consumed.</p></div><b>Not active</b></div>
          </div>
        </section>
        <aside className="tws-side">
          <section className="tws-panel tws-details">
            <div className="tws-panel-heading"><span>🧾</span><div><h2>Request summary</h2><p>Available when a real request exists</p></div></div>
            <div className="tws-detail"><span>Request reference</span><strong>—</strong></div>
            <div className="tws-detail"><span>Payment method</span><strong>Not selected</strong></div>
            <div className="tws-detail"><span>Points reserved</span><strong>—</strong></div>
            <div className="tws-detail"><span>Conversion rate</span><strong>To be configured</strong></div>
            <div className="tws-detail total"><span>Expected payout</span><strong>To be configured</strong></div>
          </section>
          <section className="tws-help"><span>💬</span><h3>Need help?</h3><p>When tracking is enabled, support will be able to review a real request reference and its audited status history.</p><Link to="/help-support">Visit Help &amp; Support ↗</Link></section>
        </aside>
      </div>
      <div className="tws-bottom-actions"><Link to="/withdrawal-request" className="tws-primary">Review withdrawal request <span>→</span></Link><Link to="/wallet-rewards" className="tws-secondary">Return to wallet</Link></div>
      <footer className="tws-footer">TestDZ · Your rewards, clearly tracked <span>💙</span></footer>
    </main>
  </div>;
}
