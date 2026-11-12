import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { supabase } from "../../../lib/supabase";
import { useIdentity } from "../../../shared/auth/hooks/useIdentity";
import "../styles/developer-settings.css";

type Preferences = { testResults: boolean; feedback: boolean; subscription: boolean; system: boolean };
const defaults: Preferences = { testResults: true, feedback: true, subscription: true, system: false };
type Profile = { display_name: string | null; avatar_url: string | null; locale: string | null; bio?: string | null };

function Glyph({ name, size = 20 }: { name: string; size?: number }) {
  const paths: Record<string, React.ReactNode> = {
    home:<><path d="m3 10 9-7 9 7"/><path d="M5 9v11h14V9"/></>, apps:<><rect x="3" y="3" width="8" height="8" rx="2"/><rect x="13" y="3" width="8" height="8" rx="2"/><rect x="3" y="13" width="8" height="8" rx="2"/><rect x="13" y="13" width="8" height="8" rx="2"/></>, tests:<><path d="M9 3h6M10 3v5l-5 9a3 3 0 0 0 3 4h8a3 3 0 0 0 3-4l-5-9V3"/><path d="M8 14h8"/></>, chart:<><path d="M4 20V10M10 20V4M16 20v-7M22 20H2"/></>, feedback:<><path d="M4 5h16v12H9l-5 4V5Z"/><path d="M8 9h8M8 13h5"/></>, crown:<path d="m2 8 5 4 5-8 5 8 5-4-2 12H4L2 8Z"/>, settings:<><circle cx="12" cy="12" r="3"/><path d="m19 13 2 1-2 4-2-1-2 1v2H9v-2l-2-1-2 1-2-4 2-1v-2l-2-1 2-4 2 1 2-1V4h6v2l2 1 2-1 2 4-2 1z"/></>, help:<><circle cx="12" cy="12" r="9"/><path d="M9 9a3 3 0 1 1 5 2c-1 1-2 1-2 3m0 3h.01"/></>, search:<><circle cx="10.8" cy="10.8" r="7"/><path d="m16 16 4.5 4.5"/></>, user:<><circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/></>, palette:<><path d="M12 3a9 9 0 1 0 0 18h1.2a2 2 0 0 0 1.5-3.3 1.7 1.7 0 0 1 1.3-2.8H18a3 3 0 0 0 3-3c0-5-4-8.9-9-8.9Z"/><path d="M7.5 10h.01M11 7h.01M15.5 9h.01"/></>, shield:<><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10Z"/><path d="m9 12 2 2 4-4"/></>, bell:<><path d="M18 9a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9m-8 12h4"/></>, clock:<><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></>, puzzle:<><path d="M9 3H5a2 2 0 0 0-2 2v4h3a2 2 0 1 1 0 4H3v4a2 2 0 0 0 2 2h4v-3a2 2 0 1 1 4 0v3h4a2 2 0 0 0 2-2v-4h-3a2 2 0 1 1 0-4h3V5a2 2 0 0 0-2-2h-4v3a2 2 0 1 1-4 0V3Z"/></>, arrow:<><path d="M4 12h15m-6-6 6 6-6 6"/></>, check:<path d="m5 12 4 4L19 6"/>, lock:<><rect x="4" y="10" width="16" height="11" rx="2"/><path d="M8 10V7a4 4 0 0 1 8 0v3"/></>, mail:<><rect x="3" y="5" width="18" height="14" rx="2"/><path d="m3 7 9 6 9-6"/></>, code:<><path d="m8 8-4 4 4 4m8-8 4 4-4 4m-2-11-4 14"/></>, camera:<><path d="M4 7h4l2-3h4l2 3h4v13H4z"/><circle cx="12" cy="13" r="3"/></>
  };
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{paths[name] ?? paths.settings}</svg>;
}


function BrandIcon({ name }: { name: "github" | "gitlab" | "figma" | "slack" }) {
  if (name === "github") return <svg className="dset-brand-logo github" viewBox="0 0 24 24" aria-label="GitHub" role="img"><path fill="currentColor" d="M12 .9a11.1 11.1 0 0 0-3.51 21.63c.56.1.76-.24.76-.54v-2.1c-3.1.67-3.75-1.32-3.75-1.32-.5-1.28-1.24-1.62-1.24-1.62-1.02-.7.08-.69.08-.69 1.13.08 1.73 1.16 1.73 1.16 1 .1.76 2.03 3.34 1.55.1-.73.4-1.23.7-1.51-2.48-.28-5.09-1.24-5.09-5.53 0-1.22.44-2.22 1.16-3-.12-.28-.5-1.42.11-2.96 0 0 .95-.3 3.05 1.15a10.6 10.6 0 0 1 5.55 0c2.1-1.45 3.04-1.15 3.04-1.15.61 1.54.23 2.68.12 2.96.72.78 1.15 1.78 1.15 3 0 4.3-2.61 5.24-5.1 5.52.4.35.75 1.03.75 2.08v3.08c0 .3.2.65.77.54A11.1 11.1 0 0 0 12 .9Z"/></svg>;
  if (name === "gitlab") return <svg className="dset-brand-logo gitlab" viewBox="0 0 24 24" aria-label="GitLab" role="img"><path fill="#E24329" d="m12 21.2 4.42-13.6H7.58L12 21.2Z"/><path fill="#FC6D26" d="m12 21.2-4.42-13.6H4.5L12 21.2Z"/><path fill="#FCA326" d="M4.5 7.6 3.15 11.75a1.1 1.1 0 0 0 .4 1.23L12 21.2 4.5 7.6Z"/><path fill="#E24329" d="M3.15 11.75 1.8 7.6a.56.56 0 0 0-1.06 0L.05 9.8a1.1 1.1 0 0 0 .4 1.23l2.7 1.95Z"/><path fill="#FC6D26" d="m12 21.2 4.42-13.6h3.08L12 21.2Z"/><path fill="#FCA326" d="m19.5 7.6 1.35 4.15a1.1 1.1 0 0 1-.4 1.23L12 21.2l7.5-13.6Z"/><path fill="#E24329" d="m20.85 11.75 1.35-4.15a.56.56 0 0 1 1.06 0l.69 2.2a1.1 1.1 0 0 1-.4 1.23l-2.7 1.95Z"/></svg>;
  if (name === "figma") return <svg className="dset-brand-logo figma" viewBox="0 0 24 24" aria-label="Figma" role="img"><path fill="#F24E1E" d="M12 12H6a4 4 0 0 1 0-8h6v8Z"/><path fill="#FF7262" d="M12 20a4 4 0 0 1-4-4v-4h4v8Z"/><path fill="#A259FF" d="M6 12h6v4a4 4 0 1 1-6-4Z"/><path fill="#1ABCFE" d="M12 12h4a4 4 0 1 1-4 4v-4Z"/><path fill="#0ACF83" d="M12 4h4a4 4 0 1 1 0 8h-4V4Z"/></svg>;
  return <svg className="dset-brand-logo slack" viewBox="0 0 24 24" aria-label="Slack" role="img"><path fill="#36C5F0" d="M9.2 2.2a1.8 1.8 0 0 1 1.8 1.8v4H7.4a1.8 1.8 0 1 1 0-3.6h.4V4a1.8 1.8 0 0 1 1.4-1.8Z"/><path fill="#2EB67D" d="M21.8 9.2a1.8 1.8 0 0 1-1.8 1.8h-4V7.4a1.8 1.8 0 1 1 3.6 0v.4h.4a1.8 1.8 0 0 1 1.8 1.4Z"/><path fill="#E01E5A" d="M14.8 21.8a1.8 1.8 0 0 1-1.8-1.8v-4h3.6a1.8 1.8 0 1 1 0 3.6h-.4v.4a1.8 1.8 0 0 1-1.4 1.8Z"/><path fill="#ECB22E" d="M2.2 14.8A1.8 1.8 0 0 1 4 13h4v3.6a1.8 1.8 0 1 1-3.6 0v-.4H4a1.8 1.8 0 0 1-1.8-1.4Z"/><path fill="#36C5F0" d="M13 4a1.8 1.8 0 1 1 3.6 0v4H13V4Z"/><path fill="#2EB67D" d="M20 13a1.8 1.8 0 1 1 0 3.6h-4V13h4Z"/><path fill="#E01E5A" d="M11 20a1.8 1.8 0 1 1-3.6 0v-4H11v4Z"/><path fill="#ECB22E" d="M4 11a1.8 1.8 0 1 1 0-3.6h4V11H4Z"/></svg>;
}

function Toggle({ checked, onChange, label, disabled = false }: { checked: boolean; onChange: (value: boolean) => void; label: string; disabled?: boolean }) {
  return <button type="button" role="switch" aria-checked={checked} aria-label={label} disabled={disabled} className={"dset-toggle " + (checked ? "on" : "")} onClick={() => onChange(!checked)}><i /></button>;
}

export default function DeveloperSettingsPage() {
  const { user, signOut } = useIdentity();
  const navigate = useNavigate();
  const [profile, setProfile] = useState<Profile>({ display_name: null, avatar_url: null, locale: "en-DZ" });
  const [name, setName] = useState("");
  const [locale, setLocale] = useState("en-DZ");
  const [theme, setTheme] = useState("light");
  const [preferences, setPreferences] = useState<Preferences>(defaults);
  const [twoFactor, setTwoFactor] = useState(false);
  const [factorId, setFactorId] = useState("");
  const [qr, setQr] = useState("");
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [savingPrefs, setSavingPrefs] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [editing, setEditing] = useState(false);
  const [activity, setActivity] = useState<{ created: string; lastSignIn: string; emailVerified: boolean }>({ created: "", lastSignIn: "", emailVerified: false });

  useEffect(() => {
    if (!user || !supabase) return;
    let active = true;
    const client = supabase;
    void Promise.all([
      client.from("profiles").select("display_name,avatar_url,locale,bio").eq("id", user.id).maybeSingle(),
      client.auth.mfa.listFactors()
    ]).then(([profileResult, factors]) => {
      if (!active) return;
      const data = (profileResult.data ?? {}) as Profile;
      setProfile(data);
      setName(data.display_name || user.email?.split("@")[0] || "Developer");
      setLocale(data.locale || "en-DZ");
      const metadata = user.user_metadata || {};
      setTheme(typeof metadata.testdz_theme === "string" ? metadata.testdz_theme : "light");
      const saved = metadata.testdz_developer_notifications as Partial<Preferences> | undefined;
      if (saved) setPreferences({ ...defaults, ...saved });
      setActivity({ created: user.created_at || "", lastSignIn: user.last_sign_in_at || "", emailVerified: Boolean(user.email_confirmed_at) });
      setTwoFactor(Boolean(factors.data?.totp?.some(factor => factor.status === "verified")));
    }).catch(() => { if (active) setError("Some settings could not be loaded. Please refresh."); });
    return () => { active = false; };
  }, [user?.id]);

  async function saveProfile() {
    if (!supabase || !user || !name.trim()) { setError("Enter a valid display name."); return; }
    setBusy(true); setError(""); setMessage("");
    const result = await supabase.from("profiles").update({ display_name: name.trim(), locale }).eq("id", user.id);
    setBusy(false);
    if (result.error) setError("Could not save profile settings. Please try again.");
    else { setProfile(current => ({ ...current, display_name: name.trim(), locale })); setEditing(false); setMessage("Profile settings saved."); }
  }

  async function savePreferences(next: Preferences) {
    if (!supabase) return;
    const previous = preferences;
    setPreferences(next); setSavingPrefs(true); setError(""); setMessage("");
    const result = await supabase.auth.updateUser({ data: { testdz_developer_notifications: next } });
    setSavingPrefs(false);
    if (result.error) { setPreferences(previous); setError("Notification preferences could not be saved."); }
    else setMessage("Notification preferences saved automatically.");
  }

  async function saveTheme(next: string) {
    if (!supabase) return;
    const previous = theme; setTheme(next); setError(""); setMessage("");
    const result = await supabase.auth.updateUser({ data: { testdz_theme: next } });
    if (result.error) { setTheme(previous); setError("Theme preference could not be saved."); }
    else setMessage("Theme preference saved.");
  }

  async function setupMfa() {
    if (!supabase) return;
    setBusy(true); setError("");
    const result = await supabase.auth.mfa.enroll({ factorType: "totp", friendlyName: "TestDZ Developer authenticator" });
    setBusy(false);
    if (result.error) { setError(result.error.message); return; }
    setQr(result.data.totp.qr_code); setFactorId(result.data.id);
  }

  async function verifyMfa() {
    if (!supabase || !factorId || code.trim().length < 6) return;
    setBusy(true);
    const challenge = await supabase.auth.mfa.challenge({ factorId });
    if (challenge.error) { setBusy(false); setError(challenge.error.message); return; }
    const result = await supabase.auth.mfa.verify({ factorId, challengeId: challenge.data.id, code: code.trim() });
    setBusy(false);
    if (result.error) setError(result.error.message);
    else { setTwoFactor(true); setQr(""); setCode(""); setMessage("Two-factor authentication enabled."); }
  }

  async function disableMfa() {
    if (!supabase) return;
    setBusy(true);
    const factors = await supabase.auth.mfa.listFactors();
    const factor = factors.data?.totp?.find(item => item.status === "verified");
    if (!factor) { setBusy(false); setTwoFactor(false); return; }
    const result = await supabase.auth.mfa.unenroll({ factorId: factor.id });
    setBusy(false);
    if (result.error) setError(result.error.message);
    else { setTwoFactor(false); setMessage("Two-factor authentication disabled."); }
  }

  const firstName = name.trim().split(/\s+/)[0] || "Developer";
  const filteredActivity = [
    { title: "Account created", detail: "Your TestDZ account was registered", date: activity.created },
    { title: "Last sign-in", detail: "Most recent authenticated session", date: activity.lastSignIn },
    { title: "Email verification", detail: activity.emailVerified ? "Email address verified" : "Email verification is pending", date: "" }
  ].filter(item => (item.title + " " + item.detail).toLowerCase().includes(search.toLowerCase()));
  const fmt = (value: string) => value ? new Date(value).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" }) : "Not available";

  return <main className="dset-shell">
    <aside className="dset-sidebar">
      <Link to="/developer-dashboard" className="dset-brand"><span className="dset-brand-mark"><Glyph name="check" size={33}/></span><span><strong>TestDZ</strong><small>Build · Test · Improve</small></span></Link>
      <div className="dset-module"><Glyph name="code" size={21}/><b>Developer</b><i>Pro</i></div>
      <nav className="dset-nav">
        <Link to="/developer-dashboard"><Glyph name="home"/>Dashboard</Link>
        <Link to="/apps"><Glyph name="apps"/>My Apps</Link>
        <Link to="/developer/tests/new"><Glyph name="tests"/>Create Test</Link>
        <Link to="/developer/tests"><Glyph name="tests"/>My Tests</Link>
        <Link to="/tester-dashboard"><Glyph name="user"/>Testers</Link>
        <Link to="/developer-dashboard"><Glyph name="chart"/>Analytics</Link>
        <Link to="/developer-dashboard"><Glyph name="feedback"/>Feedback</Link>
        <Link to="/developer/subscription"><Glyph name="crown"/>Subscription</Link>
        <Link to="/developer/settings" className="active"><Glyph name="settings"/>Settings</Link>
        <Link to="/help"><Glyph name="help"/>Help &amp; Support</Link>
      </nav>
      <div className="dset-promo"><span>🚀</span><strong>Keep building<br/>with TestDZ</strong><Link to="/pricing">Upgrade Plan <Glyph name="arrow" size={15}/></Link></div>
    </aside>

    <section className="dset-content">
      <header className="dset-topbar"><label className="dset-global-search"><Glyph name="search"/><input value={search} onChange={event => setSearch(event.target.value)} placeholder="Search settings..."/></label><div className="dset-user"><span className="dset-bell"><Glyph name="bell"/><i>3</i></span><span className="dset-avatar">{firstName.slice(0,2).toUpperCase()}</span><strong>{name || "Developer"}</strong><span>⌄</span></div></header>
      <div className="dset-page">
        <section className="dset-hero"><span className="dset-hero-icon"><Glyph name="settings" size={62}/></span><div><span className="dset-kicker">TESTDZ · DEVELOPER WORKSPACE</span><h1>Developer <em>Settings</em></h1><p>Customize your experience and manage your account settings</p></div><div className="dset-hero-art"><span><Glyph name="code" size={64}/></span><i>☷</i></div></section>
        {(message || error) && <div className={"dset-alert " + (error ? "error" : "")} role="status">{error || message}<button type="button" onClick={() => { setMessage(""); setError(""); }}>×</button></div>}
        <div className="dset-grid">
          <section className="dset-card dset-profile-card"><div className="dset-card-heading"><span className="dset-card-icon"><Glyph name="user" size={25}/></span><div><h2>Profile Settings</h2><p>Manage your profile information</p></div><button type="button" className="dset-outline" onClick={() => setEditing(value => !value)}>{editing ? "Cancel" : "Edit Profile"} <Glyph name="user" size={15}/></button></div>
            <div className="dset-profile-summary"><span className="dset-profile-avatar">{profile.avatar_url ? <img src={profile.avatar_url} alt=""/> : firstName.slice(0,1).toUpperCase()}</span><div><h3>{name || "Developer"} {activity.emailVerified && <span className="dset-verified">✓</span>}</h3><p>{user?.email || "Email unavailable"}</p><small>Developer account</small></div></div>
            {editing && <div className="dset-edit-fields"><label>Display name<input value={name} onChange={event => setName(event.target.value)} maxLength={80}/></label><label>Language<select value={locale} onChange={event => setLocale(event.target.value)}><option value="en-DZ">English</option><option value="fr-DZ">Français</option><option value="ar-DZ">العربية</option></select></label><button type="button" className="dset-primary" onClick={() => void saveProfile()} disabled={busy}>{busy ? "Saving…" : "Save Profile"}</button></div>}
            <div className="dset-profile-stats"><span><Glyph name="tests"/><b>Developer</b><small>Workspace</small></span><span><Glyph name="apps"/><b>TestDZ</b><small>Platform</small></span><span><Glyph name="shield"/><b>{activity.emailVerified ? "Verified" : "Pending"}</b><small>Email status</small></span></div>
          </section>

          <section className="dset-card dset-preferences-card"><div className="dset-card-heading"><span className="dset-card-icon"><Glyph name="palette" size={25}/></span><div><h2>Preferences</h2><p>Personalize your TestDZ experience</p></div></div><div className="dset-preference-layout"><div className="dset-preference-fields"><label>Language<select value={locale} onChange={event => { setLocale(event.target.value); if (user && supabase) void supabase.from("profiles").update({ locale: event.target.value }).eq("id", user.id).then(({error:err}) => err ? setError("Could not save language preference.") : setMessage("Language preference saved.")); }}><option value="en-DZ">🇺🇸　English</option><option value="fr-DZ">🇫🇷　Français</option><option value="ar-DZ">🇩🇿　العربية</option></select></label><label>Theme<select value={theme} onChange={event => void saveTheme(event.target.value)}><option value="light">☀️　Light</option><option value="dark">🌙　Dark</option><option value="system">◐　System</option></select></label><label>Timezone<span className="dset-readonly">◷　(UTC+01) Algiers</span></label></div><div className="dset-preference-art"><span>✓</span><strong>Your preferences</strong><small>are saved automatically</small></div></div></section>

          <section className="dset-card dset-integrations-card"><div className="dset-card-heading"><span className="dset-card-icon"><Glyph name="puzzle" size={25}/></span><div><h2>Integrations</h2><p>Connect your favorite tools</p></div><span className="dset-coming">Integration management</span></div><div className="dset-integrations"><article><span className="dset-integration-logo"><BrandIcon name="github"/></span><strong>GitHub</strong><small>Repository access</small><span className="dset-connected">Available in project workspace</span></article><article><span className="dset-integration-logo"><BrandIcon name="gitlab"/></span><strong>GitLab</strong><small>Source control</small><span className="dset-unavailable">Not connected</span></article><article><span className="dset-integration-logo"><BrandIcon name="figma"/></span><strong>Figma</strong><small>Design workflow</small><span className="dset-unavailable">Not connected</span></article><article><span className="dset-integration-logo"><BrandIcon name="slack"/></span><strong>Slack</strong><small>Team notifications</small><span className="dset-unavailable">Not connected</span></article></div></section>

          <section className="dset-card dset-security-card"><div className="dset-card-heading"><span className="dset-card-icon"><Glyph name="shield" size={25}/></span><div><h2>Security</h2><p>Keep your account secure</p></div></div><div className="dset-security-layout"><span className="dset-security-art"><Glyph name="shield" size={75}/><i><Glyph name="lock" size={29}/></i></span><div className="dset-security-items"><div><span className="dset-mini-icon"><Glyph name="lock"/></span><span><strong>Change Password</strong><small>Update your sign-in credentials</small></span><Link to="/reset-password" className="dset-outline">Update <Glyph name="arrow" size={14}/></Link></div><div><span className="dset-mini-icon"><Glyph name="shield"/></span><span><strong>Two-Factor Authentication</strong><small>{twoFactor ? "Authenticator is enabled" : "Add an extra layer of security"}</small></span><Toggle checked={twoFactor || Boolean(qr)} onChange={value => value ? void setupMfa() : void disableMfa()} label="Two-factor authentication" disabled={busy || Boolean(qr)}/></div>{qr && <div className="dset-mfa-setup"><p>Scan this QR code with your authenticator app, then enter its 6-digit code.</p><img src={qr} alt="Authenticator setup QR code"/><input value={code} onChange={event => setCode(event.target.value)} inputMode="numeric" maxLength={8} placeholder="Authentication code"/><button type="button" className="dset-primary" onClick={() => void verifyMfa()} disabled={busy || code.trim().length < 6}>Verify and enable</button></div>}<div><span className="dset-mini-icon"><Glyph name="clock"/></span><span><strong>Login Activity</strong><small>Account creation and most recent sign-in</small></span><a className="dset-outline" href="#dset-activity">View <Glyph name="arrow" size={14}/></a></div></div></div></section>

          <section className="dset-card dset-notifications-card"><div className="dset-card-heading"><span className="dset-card-icon"><Glyph name="bell" size={25}/></span><div><h2>Notifications</h2><p>Choose what you want to be notified about</p></div></div>{([{key:"testResults",title:"Test Results & Reports",desc:"Get notified when tests complete",icon:"tests"},{key:"feedback",title:"New Feedback",desc:"Receive new tester feedback",icon:"feedback"},{key:"subscription",title:"Subscription Updates",desc:"Get updates about your plan",icon:"crown"},{key:"system",title:"System Updates",desc:"Important platform updates",icon:"shield"}] as const).map(item => <div className="dset-notification-row" key={item.key}><span className="dset-notification-icon"><Glyph name={item.icon}/></span><span><strong>{item.title}</strong><small>{item.desc}</small></span><Toggle checked={preferences[item.key]} onChange={value => void savePreferences({...preferences,[item.key]:value})} label={item.title} disabled={savingPrefs}/></div>)}</section>

          <section className="dset-card dset-activity-card" id="dset-activity"><div className="dset-card-heading"><span className="dset-card-icon"><Glyph name="clock" size={25}/></span><div><h2>Activity Log</h2><p>Your recent account activity</p></div><span className="dset-activity-label">Account events</span></div><div className="dset-activity-table"><div className="dset-activity-head"><span>Action</span><span>Details</span><span>Date &amp; Time</span></div>{filteredActivity.map((item,index)=><div className="dset-activity-row" key={item.title}><b className={"dset-activity-dot dot-"+index}><Glyph name={index===0?"user":index===1?"clock":"check"} size={15}/></b><strong>{item.title}</strong><span>{item.detail}</span><time>{fmt(item.date)}</time></div>)}{filteredActivity.length===0 && <p className="dset-no-activity">No account events match your search.</p>}</div></section>
        </div>
        <footer className="dset-footer">TestDZ · Build · Test · Improve <button type="button" onClick={() => { void signOut(); navigate("/auth",{replace:true}); }}>Sign out</button></footer>
      </div>
    </section>
  </main>;
}
