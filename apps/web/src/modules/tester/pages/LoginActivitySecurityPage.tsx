import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { identityApi } from "../../../features/identity/identity-api";
import { useIdentity } from "../../../features/identity/hooks/useIdentity";
import TesterSidebar, { Icon } from "../components/TesterSidebar";
import "../styles/tester-dashboard.css";
import "../styles/login-activity-security.css";

function getDevice() {
  const ua = typeof navigator === "undefined" ? "" : navigator.userAgent;
  const mobile = /Android|iPhone|iPad|iPod/i.test(ua);
  const os = /Android/i.test(ua) ? "Android" : /iPhone|iPad|iPod/i.test(ua) ? "iOS" : /Windows/i.test(ua) ? "Windows" : /Mac OS/i.test(ua) ? "macOS" : /Linux/i.test(ua) ? "Linux" : "Unknown OS";
  const browser = /Edg\//i.test(ua) ? "Edge" : /Firefox\//i.test(ua) ? "Firefox" : /Chrome\//i.test(ua) ? "Chrome" : /Safari\//i.test(ua) ? "Safari" : "Browser";
  return { mobile, os, browser, label: mobile ? "Mobile device" : "Desktop device" };
}
export default function LoginActivitySecurityPage() {
  const { user, roles = [] } = useIdentity();
  const [menuOpen, setMenuOpen] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [notice, setNotice] = useState("");
  const [activity, setActivity] = useState<Array<{id:string;event:string;occurred_at:string;ip_address:string|null}>>([]);
  const [loadingActivity, setLoadingActivity] = useState(true);
  const device = useMemo(getDevice, []);
  useEffect(() => {
    let alive = true;
    async function loadActivity() {
      if (!identityApi.isConfigured() || !user) { if (alive) setLoadingActivity(false); return; }
      setLoadingActivity(true);
      const result = await identityApi.getMySecurityActivity(30);
      if (!alive) return;
      if (result.error) setNotice("Login history is temporarily unavailable. Please try again.");
      else setActivity((result.data || []) as typeof activity);
      setLoadingActivity(false);
    }
    void loadActivity();
    return () => { alive = false; };
  }, [user?.id]);
  const firstName = user?.email?.split("@")[0] || "Tester";
  const lastLogin = user?.last_sign_in_at ? new Date(user.last_sign_in_at) : null;
  const formattedLogin = lastLogin && !Number.isNaN(lastLogin.getTime())
    ? lastLogin.toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" })
    : "Not available";
  const verified = Boolean(user?.email_confirmed_at);
  const nav = [
    { label: "Dashboard", icon: "home", href: "/tester-dashboard" },
    { label: "Discover Tests", icon: "search", href: "/discover-tests" },
    { label: "My Tests", icon: "tests", href: "/my-tests" },
    { label: "Rewards", icon: "gift", href: "/wallet-rewards" },
    { label: "Wallet", icon: "wallet", href: "/wallet-rewards" },
    { label: "Profile", icon: "user", href: "/profile" },
    { label: "Help & Support", icon: "help", href: "/help-support" },
    { label: "Feedback", icon: "star", href: "/feedback-history" },
    { label: "Activity & History", icon: "chart", href: "/activity-history" },
    { label: "Notifications", icon: "bell", href: "/notification-preferences" },
    { label: "Security", icon: "shield", href: "/tester/security-history", active: true },
    { label: "Settings", icon: "settings", href: "/settings" },
    { label: "Privacy", icon: "lock", href: "/tester/privacy" },
    ...(roles.includes("developer") ? [{ label: "Developer", icon: "code", href: "/developer-dashboard" }] : [])
  ];
  async function refreshActivity() {
    if (!identityApi.isConfigured() || !user) { setNotice("Sign in to load your account security history."); return; }
    setRefreshing(true); setNotice("");
    const result = await identityApi.getMySecurityActivity(30);
    setRefreshing(false);
    if (result.error) setNotice("Could not refresh login history. Please try again.");
    else { setActivity((result.data || []) as typeof activity); setNotice("Login history refreshed."); }
  }
  const rows = activity.map(item => ({ id: item.id, date: new Date(item.occurred_at).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" }), device: "Not recorded", browser: "Not recorded", location: "Not provided", ip: item.ip_address || "Not available", status: item.event }));
  return <div className="td-dashboard las-dashboard">
    <TesterSidebar nav={nav} name={firstName} firstName={firstName} avatar="" roles={roles} isAdmin={roles.includes("admin")} isDeveloper={roles.includes("developer")} workspaceMenuOpen={menuOpen} setWorkspaceMenuOpen={setMenuOpen} previewMode={!identityApi.isConfigured()}/>
    <main className="td-main las-main">
      <header className="las-topbar"><label className="las-search"><Icon name="search" size={20}/><input placeholder="Search in TestDZ..." aria-label="Search in TestDZ" readOnly/></label><div className="las-user"><Link to="/profile"><b>{firstName.slice(0,2).toUpperCase()}</b><span>{firstName}</span><Icon name="chevron" size={16}/></Link></div></header>
      <div className="las-content">
        <Link to="/settings" className="las-back"><Icon name="arrow" size={17}/>Back to Settings</Link>
        <section className="las-hero"><div className="las-hero-icon"><Icon name="shield" size={55}/></div><div className="las-hero-copy"><h1>Login Activity &amp; Security History</h1><p>Review your login activity and keep your account secure.</p></div><div className="las-hero-art"><Icon name="monitor" size={105}/><span><Icon name="check" size={47}/></span></div></section>
        <section className="las-stats">
          <article><span className="las-stat-icon blue"><Icon name="calendar" size={32}/></span><div><strong>{activity.length || "0"}</strong><b>Recorded Login Events</b><small>Supabase Auth audit history</small></div></article>
          <article><span className="las-stat-icon green"><Icon name="smartphone" size={32}/></span><div><strong>{user ? "1" : "—"}</strong><b>Current Device</b><small>{device.label} · Last sign-in: {formattedLogin}</small></div></article>
          <article><span className="las-stat-icon purple"><Icon name="globe" size={32}/></span><div><strong>—</strong><b>Login Locations</b><small>Location data not provided</small></div></article>
          <article><span className="las-stat-icon teal"><Icon name="shield" size={32}/></span><div><strong>{verified ? "Verified" : "Review"}</strong><b>Account Verification</b><small>{verified ? "Email confirmed" : "Email not confirmed"}</small></div></article>
        </section>
        {notice && <div className="las-notice" role="status">{notice}<button type="button" onClick={() => setNotice("")}>×</button></div>}
        <div className="las-columns">
          <section className="las-card las-activity">
            <div className="las-card-heading"><h2><Icon name="clock" size={25}/>Recent Login Activity</h2><span>Account record</span></div>
            <div className="las-table-wrap"><table><thead><tr><th>Date &amp; Time</th><th>Device</th><th>Browser</th><th>Location</th><th>IP Address</th><th>Status</th></tr></thead><tbody>
              {loadingActivity ? <tr><td colSpan={6} className="las-empty">Loading your login history…</td></tr> : rows.length ? rows.map(row => <tr key={row.id}><td>{row.date}</td><td><Icon name={device.mobile ? "smartphone" : "monitor"} size={18}/>{row.device}</td><td>{row.browser}</td><td>{row.location}</td><td>{row.ip}</td><td><span className="las-status"><Icon name="check" size={13}/>{row.status}</span></td></tr>) : <tr><td colSpan={6} className="las-empty">No login audit events are available for this account yet.</td></tr>}
            </tbody></table></div>
            <div className="las-data-note"><Icon name="info" size={20}/><p>Only events recorded by Supabase Auth are shown. Device, browser and location are not inferred when the audit record does not contain them.</p></div>
          </section>
          <aside className="las-side">
            <section className="las-card las-overview"><h2><Icon name="shield" size={24}/>Security Overview</h2><div className={verified ? "las-secure-mark" : "las-review-mark"}><Icon name={verified ? "check" : "alert"} size={42}/></div><h3>{verified ? "Email Address Verified" : "Email Verification Needed"}</h3><p>{verified ? "Your email address is confirmed on this account." : "Confirm your email address to strengthen account security."}</p><div className="las-check"><Icon name={verified ? "check" : "alert"} size={17}/><span>{verified ? "Email verification confirmed" : "Email verification pending"}</span></div><Link to="/settings?tab=security">Review Security Settings <Icon name="arrow" size={15}/></Link></section>
            <section className="las-card las-tips"><h2><Icon name="sun" size={24}/>Security Tips</h2><ul><li><Icon name="check" size={17}/>Keep two-factor authentication enabled.</li><li><Icon name="check" size={17}/>Never share your password.</li><li><Icon name="check" size={17}/>Sign out from devices you no longer use.</li><li><Icon name="check" size={17}/>Review your account activity regularly.</li></ul></section>
          </aside>
        </div>
        <div className="las-footer"><div><Icon name="info" size={25}/><p><b>About Login Activity</b><br/>This page displays the latest sign-in information available from your TestDZ account. If you notice unfamiliar activity, change your password and contact support.</p></div><button type="button" onClick={() => void refreshActivity()} disabled={refreshing}><Icon name="refresh" size={18}/>{refreshing ? "Refreshing..." : "Refresh Activity"}</button></div>
      </div>
    </main>
  </div>;
}
