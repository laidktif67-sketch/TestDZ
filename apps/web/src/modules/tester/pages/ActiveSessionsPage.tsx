import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "../../../lib/supabase";
import { useIdentity } from "../../../shared/auth/hooks/useIdentity";
import TesterSidebar, { Icon } from "../components/TesterSidebar";
import "../styles/tester-dashboard.css";
import "../styles/active-sessions.css";

function getDeviceInfo() {
  const ua = navigator.userAgent || "";
  const isMobile = /Android|iPhone|iPad|iPod/i.test(ua);
  const os = /Android/i.test(ua) ? "Android" : /iPhone|iPad|iPod/i.test(ua) ? "iOS" : /Windows/i.test(ua) ? "Windows" : /Mac OS/i.test(ua) ? "macOS" : /Linux/i.test(ua) ? "Linux" : "Unknown OS";
  const browser = /Edg\//i.test(ua) ? "Microsoft Edge" : /Firefox\//i.test(ua) ? "Firefox" : /Chrome\//i.test(ua) ? "Chrome" : /Safari\//i.test(ua) ? "Safari" : "Browser";
  const version = ua.match(/(?:Chrome|Firefox|Edg|Version)\/([\d.]+)/i)?.[1];
  return { isMobile, os, browser: version ? browser + " " + version : browser, label: isMobile ? "Mobile Device" : "Desktop Browser" };
}

export default function ActiveSessionsPage() {
  const { user, roles = [] } = useIdentity();
  const [sessionReady, setSessionReady] = useState(false);
  const [hasSession, setHasSession] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [menuOpen, setMenuOpen] = useState(false);
  const device = useMemo(() => typeof navigator === "undefined" ? { isMobile: false, os: "Unknown OS", browser: "Unknown browser", label: "Current device" } : getDeviceInfo(), []);
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
    async function loadSession() {
      if (!supabase) { setSessionReady(true); return; }
      const result = await supabase.auth.getSession();
      if (!alive) return;
      setHasSession(Boolean(result.data.session));
      setSessionReady(true);
      if (result.error) setError("Could not verify the current session. Refresh and try again.");
    }
    void loadSession();
    const { data } = supabase?.auth.onAuthStateChange((_event, session) => {
      if (alive) setHasSession(Boolean(session));
    }) ?? { data: { subscription: { unsubscribe: () => undefined } } };
    return () => { alive = false; data.subscription.unsubscribe(); };
  }, []);

  async function signOutOtherSessions() {
    if (!supabase || !hasSession) return;
    const confirmed = window.confirm("Sign out all other devices? This device will remain signed in.");
    if (!confirmed) return;
    setBusy(true); setMessage(""); setError("");
    const result = await supabase.auth.signOut({ scope: "others" });
    setBusy(false);
    if (result.error) setError("Could not sign out other sessions. Please try again.");
    else setMessage("Other sessions have been signed out. This device remains connected.");
  }

  const formattedLogin = lastLogin ? lastLogin.toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" }) : "Not available";
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
          <article className="as-summary-card"><span className="as-summary-icon"><Icon name="monitor" size={42}/></span><i className={hasSession ? "online" : "offline"}/><div><strong>{sessionReady ? (hasSession ? "1" : "0") : "—"}</strong><small>Current Session{hasSession ? " Active" : ""}</small></div></article>
          <article className="as-summary-card"><span className="as-summary-icon solid"><Icon name="clock" size={35}/></span><div><small>Last Login</small><strong className="as-date">{formattedLogin}</strong></div></article>
          <article className="as-summary-card"><span className="as-summary-icon shield"><Icon name="shield" size={42}/></span><div><small>Account Security</small><strong className={securityGood ? "as-good" : "as-review"}><Icon name="check" size={17}/>{securityGood ? "Email verified" : "Needs review"}</strong></div></article>
        </section>

        {(message || error) && <div className={`as-alert ${error ? "error" : ""}`} role="status">{error || message}<button type="button" onClick={() => { setMessage(""); setError(""); }} aria-label="Dismiss message">×</button></div>}

        <div className="as-columns">
          <section className="as-card as-session-card">
            <h2><Icon name="monitor" size={26}/>Your Active Session</h2>
            {!sessionReady ? <div className="as-empty">Checking your current session…</div> : hasSession ? <article className="as-device">
              <span className="as-device-icon"><Icon name={device.isMobile ? "smartphone" : "monitor"} size={45}/></span>
              <div className="as-device-copy"><div className="as-device-title"><strong>{device.label}</strong><span className="as-current"><i/>Current Session</span></div><p>{device.os} · {device.browser}</p><div className="as-device-meta"><span><Icon name="globe" size={16}/>Location not shared by the browser</span><span><Icon name="clock" size={16}/>{formattedLogin}</span></div></div>
              <span className="as-status"><Icon name="check" size={16}/>Active</span>
            </article> : <div className="as-empty">No authenticated session was found. Please sign in again to manage sessions.</div>}
            <div className="as-session-foot"><Icon name="info" size={19}/><p>For privacy, this page only displays the device currently connected to this browser. Other device sessions are not exposed by the standard client session API.</p></div>
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
