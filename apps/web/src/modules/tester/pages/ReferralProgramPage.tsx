import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "../../../lib/supabase";
import { useIdentity } from "../../../shared/auth/hooks/useIdentity";
import TesterSidebar, { Icon } from "../components/TesterSidebar";
import "../styles/referral-program.css";

export default function ReferralProgramPage() {
  const { session, roles = [] } = useIdentity();
  const [name, setName] = useState("Tester");
  const [avatar, setAvatar] = useState("");
  const [notifications, setNotifications] = useState(0);
  const [menuOpen, setMenuOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const [notice, setNotice] = useState("");
  const [loading, setLoading] = useState(true);
  const isAdmin = roles.includes("admin");
  const isDeveloper = roles.includes("developer");
  const firstName = name.split(/\s+/)[0] || "Tester";

  useEffect(() => {
    if (!session?.user?.id || !supabase) { setLoading(false); return; }
    let alive = true;
    const userId = session.user.id;
    Promise.all([
      supabase.from("profiles").select("display_name,avatar_url").eq("id", userId).maybeSingle(),
      supabase.from("notifications").select("id", { count: "exact", head: true }).eq("user_id", userId).is("read_at", null)
    ]).then(([profile, notification]) => {
      if (!alive) return;
      setName(profile.data?.display_name?.trim() || session.user.email?.split("@")[0] || "Tester");
      setAvatar(profile.data?.avatar_url || "");
      setNotifications(notification.count ?? 0);
      setLoading(false);
    }).catch(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, [session?.user?.id]);

  const nav = [
    { label: "Dashboard", icon: "home", href: "/tester-dashboard" },
    { label: "Discover Tests", icon: "search", href: "/discover-tests" },
    { label: "My Tests", icon: "tests", href: "/my-tests" },
    { label: "Activity & History", icon: "chart", href: "/activity-history" },
    { label: "Check-in History", icon: "calendar", href: "/check-in-history" },
    { label: "Feedback History", icon: "star", href: "/feedback-history" },
    { label: "Wallet & Rewards", icon: "wallet", href: "/wallet-rewards" },
    { label: "Referral Program", icon: "users", href: "/referral-program", active: true },
    { label: "Profile", icon: "user", href: "/profile" },
    { label: "Help & Support", icon: "help", href: "/help-support" },
    { label: "Settings", icon: "settings", href: "/settings" },
    ...(isDeveloper ? [{ label: "Developer Dashboard", icon: "code", href: "/developer-dashboard" }] : []),
    ...(isAdmin ? [{ label: "Admin", icon: "shield", href: "/admin" }] : [])
  ];

  if (loading) return <div className="td-loading"><span className="td-spinner" />Loading referral program…</div>;

  const copyLink = async () => {
    setNotice("Your personal referral link will appear here when referral tracking is enabled.");
    setCopied(false);
  };

  return <div className="td-dashboard rp-dashboard">
    <TesterSidebar nav={nav} name={name} firstName={firstName} avatar={avatar} roles={roles} isAdmin={isAdmin} isDeveloper={isDeveloper} workspaceMenuOpen={menuOpen} setWorkspaceMenuOpen={setMenuOpen} previewMode={false} />
    <main className="td-main rp-main">
      <header className="td-topbar rp-topbar">
        <label className="td-search"><Icon name="search" size={20} /><input placeholder="Search in TestDZ…" /></label>
        <div className="td-top-actions">
          <Link to="/notifications" className="td-notification" aria-label="Notifications"><Icon name="bell" size={22} />{notifications > 0 && <i>{notifications > 9 ? "9+" : notifications}</i>}</Link>
          <span className="td-top-divider" />
          <Link to="/profile" className="td-profile-short"><span>{avatar ? <img src={avatar} alt="" /> : firstName.slice(0, 2).toUpperCase()}</span><strong>{name}</strong><b>⌄</b></Link>
        </div>
      </header>
      <div className="rp-content">
        <Link to="/tester-dashboard" className="rp-back"><Icon name="arrow" size={17} />Back to Dashboard</Link>
        <section className="rp-hero">
          <div className="rp-hero-art" aria-hidden="true"><span className="rp-person">🧑🏻‍💻</span><span className="rp-person rp-person-two">👩🏻‍💻</span><span className="rp-gift">🎁</span></div>
          <div className="rp-hero-copy"><span className="rp-eyebrow">GROW WITH TESTDZ</span><h1>Referral Program</h1><p>Invite your friends to TestDZ and grow the testing community together.</p></div>
          <div className="rp-hero-pill"><Icon name="gift" size={25} />Share · Earn · Grow</div>
        </section>

        <div className="rp-notice" role="status"><Icon name="info" size={19} /><span>Referral tracking is not connected yet. Your dashboard will show verified referrals and rewards once the referral system is enabled.</span></div>

        <section className="rp-stats" aria-label="Referral statistics">
          <article className="rp-stat"><span className="rp-stat-icon blue"><Icon name="users" size={27} /></span><div><strong>—</strong><b>Successful Referrals</b><small>Awaiting referral tracking</small></div></article>
          <article className="rp-stat"><span className="rp-stat-icon purple"><Icon name="star" size={27} /></span><div><strong>—</strong><b>Bonus Points Earned</b><small>Verified after launch</small></div></article>
          <article className="rp-stat"><span className="rp-stat-icon teal"><Icon name="gift" size={27} /></span><div><strong>—</strong><b>Referral Rewards</b><small>Reward rules to be configured</small></div></article>
          <article className="rp-stat"><span className="rp-stat-icon orange"><Icon name="chart" size={27} /></span><div><strong>—</strong><b>Conversion Rate</b><small>Available when tracking is active</small></div></article>
        </section>

        <div className="rp-main-grid">
          <div className="rp-left-column">
            <section className="rp-panel rp-link-panel">
              <div className="rp-panel-heading"><div className="rp-heading-icon"><Icon name="link" size={25} /></div><div><h2>Your Referral Link</h2><p>Share your personal invitation with friends. Referral links will be generated when the program is activated.</p></div></div>
              <div className="rp-link-field"><Icon name="link" size={19} /><span>Referral link not available yet</span><button type="button" onClick={copyLink} disabled><Icon name="copy" size={18} />Copy Link</button></div>
              <div className="rp-share-row">
                <button type="button" disabled><span>◉</span>Share on WhatsApp</button>
                <button type="button" disabled><span>➤</span>Share on Telegram</button>
                <button type="button" disabled><Icon name="mail" size={18} />Share via Email</button>
                <button type="button" disabled aria-label="More sharing options">•••</button>
              </div>
              {notice && <p className="rp-inline-note">{notice}</p>}
            </section>

            <section className="rp-panel rp-steps-panel">
              <div className="rp-section-title"><Icon name="bolt" size={23} /><h2>How It Works</h2></div>
              <div className="rp-steps">
                <article><span className="rp-step-number">1</span><div className="rp-step-art"><Icon name="users" size={43} /></div><h3>Invite Friends</h3><p>Share your referral link with friends</p></article>
                <span className="rp-step-arrow">→</span>
                <article><span className="rp-step-number">2</span><div className="rp-step-art"><Icon name="check" size={43} /></div><h3>They Join</h3><p>Your friends sign up and complete an eligible test</p></article>
                <span className="rp-step-arrow">→</span>
                <article><span className="rp-step-number">3</span><div className="rp-step-art"><Icon name="gift" size={43} /></div><h3>You Both Earn</h3><p>Rewards are credited after referral verification</p></article>
              </div>
            </section>
          </div>

          <aside className="rp-right-column">
            <section className="rp-panel rp-rewards-panel"><div className="rp-section-title"><Icon name="gift" size={25} /><h2>Referral Rewards</h2></div><p className="rp-reward-intro">The reward amounts and eligibility rules will be published here when the program launches.</p><ul><li><Icon name="check" size={18} />Clear eligibility requirements</li><li><Icon name="check" size={18} />Verified referral milestones</li><li><Icon name="check" size={18} />Transparent reward history</li></ul><Link to="/wallet-rewards" className="rp-outline-link">View Wallet &amp; Rewards <Icon name="arrow" size={16} /></Link></section>
            <section className="rp-panel rp-leaderboard"><div className="rp-section-title"><Icon name="trophy" size={24} /><h2>Top Referrers</h2></div><div className="rp-empty"><span><Icon name="users" size={30} /></span><strong>Leaderboard coming soon</strong><p>Top community referrers will appear here after referral tracking is available.</p></div></section>
          </aside>
        </div>

        <section className="rp-bottom-cta"><div className="rp-cta-icon"><Icon name="send" size={30} /></div><div><h2>Invite more friends and grow with TestDZ!</h2><p>Help more testers discover opportunities and build better apps.</p></div><button type="button" disabled>Start Sharing <Icon name="arrow" size={17} /></button></section>
        <footer className="rp-footer">TestDZ · Test · Learn · Grow</footer>
      </div>
    </main>
  </div>;
}
