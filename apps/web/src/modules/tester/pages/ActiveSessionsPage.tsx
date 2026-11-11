import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "../../../lib/supabase";
import { useIdentity } from "../../../shared/auth/hooks/useIdentity";
import TesterSidebar, { Icon } from "../components/TesterSidebar";
import "../styles/tester-dashboard.css";
import "../styles/active-sessions.css";

export default function ActiveSessionsPage() {
  const { user, roles = [] } = useIdentity();
  const [sessionReady, setSessionReady] = useState(false);
  const [sessions, setSessions] = useState<Array<{id:string;created_at:string;last_active_at:string;user_agent:string|null;ip_address:string|null;assurance_level:string|null;is_current:boolean}>>([]);
  const hasSession = sessions.some(session => session.is_current);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [menuOpen, setMenuOpen] = useState(false);
  const isAdmin = roles.includes("admin");
  const isDeveloper = roles.includes("developer");
  const firstName = user?.email?.split("@")[0] || "Tester";
  const lastLogin = user?.last_sign_in_at ? new Date(user.last_sign_in_at) : null;
  const nav = [
    { label: "Dashboard", icon: "home", href: "/tester-dashboard" },
    { label: "Discover Tests", icon: "search", href: "/discover-tests" },
    { label: "My Tests", icon: "tests", href: "/my-tests" },
    { label: "Rewards", icon: "gift", href: "/wallet-rewards" },
    { label: "Wallet", icon: "wallet", href: "/wallet-rewards" },
    { label: "Profile", icon: "user", href: "/profile" },
    { label: "Help & Support", icon: "help", href: "/help-support" },
    { label: "Feedback", icon: "star", href: "/feedback-history" },
    { label: "Activity & History", icon: "chart", href: "/check-in-history" },
    { label: "Notifications", icon: "bell", href: "/settings?tab=notifications" },
    { label: "Settings", icon: "settings", href: "/settings", active: true },
    ...(isDeveloper ? [{ label: "Developer", icon: "code", href: "/developer-dashboard" }] : [])
  ];

  useEffect(() => {
    let alive = true;
    async function loadSessions() {
      if (!supabase) { if (alive) setSessionReady(true); return; }
      const [auth, result] = await Promise.all([supabase.auth.getSession(), supabase.rpc("get_my_active_sessions")]);
      if (!alive) return;
      if (auth.error) setError("Could not verify the current session. Refresh and try again.");
      if (result.error) setError("Could not load your active sessions. Please try again.");
      else setSessions((result.data || []) as typeof sessions);
      setSessionReady(true);
    }
    void loadSessions();
    return () => { alive = false; };
  }, []);

  async function signOutOtherSessions() {
    if (!supabase || !hasSession) return;
    const confirmed = window.confirm("Sign out all other devices? This device will remain signed in.");
    if (!confirmed) return;
    setBusy(true); setMessage(""); setError("");
    const result = await supabase.auth.signOut({ scope: "others" });
    if (result.error) { setBusy(false); setError("Could not sign out other sessions. Please try again."); return; }
    const refreshed = await supabase.rpc("get_my_active_sessions");
    setBusy(false);
    if (refreshed.error) setError("Other sessions were signed out, but the session list could not be refreshed.");
    else { setSessions((refreshed.data || []) as typeof sessions); setMessage("Other sessions have been signed out. This device remains connected."); }
  }

  const formattedLogin = lastLogin ? lastLogin.toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" }) : "Not available";
  const latestSession = sessions.reduce((latest, item) => !latest || item.last_active_at > latest.last_active_at ? item : latest, null as typeof sessions[number] | null);
  const securityGood = Boolean(user?.email_confirmed_at);
  return <div className="td-dashboard as-dashboard">
    <TesterSidebar nav={nav} name={firstName} firstName={firstName} avatar="" roles={roles} isAdmin={isAdmin} isDeveloper={isDeveloper} workspaceMenuOpen={menuOpen} setWorkspaceMenuOpen={setMenuOpen} previewMode={!supabase}/>
    <main className="td-main as-main">
      <header className="as-topbar">
        <label className="as-search"><Icon name="search" size={20}/><input placeholder="Search in TestDZ..." aria-label="Search in TestDZ" readOnly/></label>
        <div className="as-user"><Link to="/profile"><b>{firstName.slice(0,2).toUpperCase()}</b><span>{firstName}</span><Icon name="chevron" size={16}/></Link></div>
      </header>
      <div className="as-content">
        <Link to="/settings" className="as-back"><Icon name="arrow" size={17}/>Back to Settings</Link>
        <section className="as-hero"><div className="as-hero-icon"><Icon name="lock" size={54}/></div><div className="as-hero-copy"><h1>Active Sessions</h1><p>Manage your active sessions and devices for better security.</p></div><div className="as-hero-art"><Icon name="shield" size={104}/><span>✓</span></div></section>

        <section className="as-summary-grid">
          <article className="as-summary-card"><span className="as-summary-icon"><Icon name="monitor" size={42}/></span><i className={hasSession ? "online" : "offline"}/><div><strong>{sessionReady ? String(sessions.length) : "—"}</strong><small>Active Sessions</small></div></article>
          <article className="as-summary-card"><span className="as-summary-icon solid"><Icon name="clock" size={35}/></span><div><small>Last Login</small><strong className="as-date">{latestSession ? new Date(latestSession.last_active_at).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" }) : formattedLogin}</strong></div></article>
          <article className="as-summary-card"><span className="as-summary-icon shield"><Icon name="shield" size={42}/></span><div><small>Account Security</small><strong className={securityGood ? "as-good" : "as-review"}><Icon name="check" size={17}/>{securityGood ? "Email verified" : "Needs review"}</strong></div></article>
        </section>

        {(message || error) && <div className={`as-alert ${error ? "error" : ""}`} role="status">{error || message}<button type="button" onClick={() => { setMessage(""); setError(""); }} aria-label="Dismiss message">×</button></div>}

        <div className="as-columns">
          <section className="as-card as-session-card">
            <h2><Icon name="monitor" size={26}/>Your Active Sessions</h2>
            {!sessionReady ? <div className="as-empty">Loading your active sessions…</div> : sessions.length ? sessions.map(item => { const agent = item.user_agent || "Device details not provided"; const mobile = /Android|iPhone|iPad|Mobile/i.test(agent); const os = /Android/i.test(agent) ? "Android" : /iPhone|iPad/i.test(agent) ? "iOS" : /Windows/i.test(agent) ? "Windows" : /Mac OS/i.test(agent) ? "macOS" : /Linux/i.test(agent) ? "Linux" : "Unknown OS"; const browser = /Edg\//i.test(agent) ? "Microsoft Edge" : /Firefox\//i.test(agent) ? "Firefox" : /Chrome\//i.test(agent) ? "Chrome" : /Safari\//i.test(agent) ? "Safari" : "Browser"; return <article className="as-device" key={item.id}>
              <span className="as-device-icon"><Icon name={mobile ? "smartphone" : "monitor"} size={45}/></span>
              <div className="as-device-copy"><div className="as-device-title"><strong>{mobile ? "Mobile Device" : "Web Browser"}{item.is_current ? " · Current" : ""}</strong>{item.is_current && <span className="as-current"><i/>Current Session</span>}</div><p>{os} · {browser}</p><div className="as-device-meta"><span><Icon name="globe" size={16}/>{item.ip_address || "IP not available"}</span><span><Icon name="clock" size={16}/>{new Date(item.last_active_at).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" })}</span></div></div>
              <span className="as-status"><Icon name="check" size={16}/>Active</span>
            </article>; }) : <div className="as-empty">No active sessions were returned for this account.</div>}
            <div className="as-session-foot"><Icon name="info" size={19}/><p>Session details come from Supabase Auth. Device names are inferred from the recorded user agent; precise geographic location is not assumed from an IP address.</p></div>
          </section>

          <aside className="as-side-column">
            <section className="as-card as-details-card"><h2><Icon name="shield" size={25}/>Session Details</h2><p>You can keep your account secure by reviewing your signed-in device. If you notice unfamiliar activity, sign out other sessions and update your password.</p><button type="button" className="as-primary" disabled={!hasSession || busy || !supabase} onClick={() => void signOutOtherSessions()}><Icon name="logout" size={21}/>{busy ? "Signing out…" : "Log Out All Other Sessions"}</button><Link to="/settings?tab=security" className="as-secondary">Change Password <Icon name="arrow" size={15}/></Link></section>
            <section className="as-card as-tips-card"><h2><Icon name="lightbulb" size={27}/>Security Tips</h2><ul><li><Icon name="check" size={17}/>Use a strong, unique password</li><li><Icon name="check" size={17}/>Enable two-factor authentication (2FA)</li><li><Icon name="check" size={17}/>Sign out from shared devices</li></ul></section>
          </aside>
        </div>
        <div className="as-note"><Icon name="info" size={25}/><p><strong>Note:</strong> This page shows the session currently authenticated in this browser. If you suspect unauthorized access, sign out other sessions and contact TestDZ support if you need further help.</p><Icon name="shield" size={42}/></div>
      </div>
    </main>
  </div>;
}
