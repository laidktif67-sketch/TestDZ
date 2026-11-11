import { useEffect, useState } from "react";
import type { ReactNode } from "react";
import { Link, useNavigate } from "react-router-dom";
import { supabase } from "../../../lib/supabase";
import { useIdentity } from "../../../shared/auth/hooks/useIdentity";
import TesterSidebar, { Icon } from "../components/TesterSidebar";
import "../styles/tester-dashboard.css";
import "../styles/settings-security.css";

type Tab = "account" | "security" | "notifications" | "privacy" | "appearance";
type Preferences = { newTests: boolean; rewards: boolean; support: boolean; system: boolean; promotions: boolean };
const defaultPreferences: Preferences = { newTests: true, rewards: true, support: true, system: true, promotions: false };
const tabs: { id: Tab; label: string; icon: string }[] = [
  { id: "account", label: "Account Settings", icon: "user" },
  { id: "security", label: "Security", icon: "shield" },
  { id: "notifications", label: "Notifications", icon: "bell" },
  { id: "privacy", label: "Privacy", icon: "lock" },
  { id: "appearance", label: "Appearance", icon: "settings" }
];
function Toggle({ checked, onChange, label }: { checked: boolean; onChange: (value: boolean) => void; label: string }) {
  return <button type="button" role="switch" aria-checked={checked} aria-label={label} className={`ss-toggle ${checked ? "on" : ""}`} onClick={() => onChange(!checked)}><i/></button>;
}
function SettingRow({ icon, title, description, action }: { icon: string; title: string; description: string; action?: ReactNode }) {
  return <div className="ss-setting-row"><span className="ss-row-icon"><Icon name={icon} size={23}/></span><div className="ss-row-copy"><strong>{title}</strong><small>{description}</small></div>{action && <div className="ss-row-action">{action}</div>}</div>;
}
export default function SettingsSecurityPage() {
  const { user, roles = [], signOut } = useIdentity();
  const navigate = useNavigate();
  const [tab, setTab] = useState<Tab>("account");
  const [name, setName] = useState("");
  const [avatar, setAvatar] = useState("");
  const [locale, setLocale] = useState("en-DZ");
  const [email, setEmail] = useState(user?.email ?? "");
  const [emailVerified, setEmailVerified] = useState(Boolean(user?.email_confirmed_at));
  const [preferences, setPreferences] = useState<Preferences>(defaultPreferences);
  const [theme, setTheme] = useState("light");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  const [newEmail, setNewEmail] = useState("");
  const [twoFactor, setTwoFactor] = useState(false);
  const [mfaQr, setMfaQr] = useState("");
  const [mfaFactorId, setMfaFactorId] = useState("");
  const [mfaCode, setMfaCode] = useState("");
  const [mfaBusy, setMfaBusy] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const isAdmin = roles.includes("admin");
  const isDeveloper = roles.includes("developer");
  const firstName = name.trim().split(/\s+/)[0] || user?.email?.split("@")[0] || "Tester";
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
    { label: "Notifications", icon: "bell", href: "/notification-preferences" },
    { label: "Settings", icon: "settings", href: "/settings", active: true },
    ...(isDeveloper ? [{ label: "Developer", icon: "code", href: "/developer-dashboard" }] : [])
  ];

  useEffect(() => {
    if (!user || !supabase) return;
    let alive = true;
    const client = supabase;
    Promise.all([
      client.from("profiles").select("display_name,avatar_url,locale").eq("id", user.id).maybeSingle(),
      client.auth.mfa.listFactors(),
    ]).then(([profile, factors]) => {
      if (!alive) return;
      setName(profile.data?.display_name || user.email?.split("@")[0] || "Tester");
      setAvatar(profile.data?.avatar_url || "");
      setLocale(profile.data?.locale || "en-DZ");
      setEmail(user.email || "");
      setEmailVerified(Boolean(user.email_confirmed_at));
      const metadata = user.user_metadata || {};
      const savedPrefs = metadata.testdz_notification_preferences as Partial<Preferences> | undefined;
      if (savedPrefs) setPreferences({ ...defaultPreferences, ...savedPrefs });
      setTheme(typeof metadata.testdz_theme === "string" ? metadata.testdz_theme : "light");
      setTwoFactor(Boolean(factors.data?.totp?.some(factor => factor.status === "verified")));
    }).catch(() => { if (alive) setError("Some account settings could not be loaded."); });
    return () => { alive = false; };
  }, [user?.id]);

  useEffect(() => {
    const query = new URLSearchParams(window.location.search);
    if (query.get("tab") === "notifications") setTab("notifications");
  }, []);

  const alert = (text: string, isError = false) => { setMessage(isError ? "" : text); setError(isError ? text : ""); };
  async function saveProfile() {
    if (!supabase || !user) return;
    if (!name.trim()) { alert("Your display name cannot be empty.", true); return; }
    setBusy(true); alert("");
    const result = await supabase.from("profiles").update({ display_name: name.trim(), locale }).eq("id", user.id);
    setBusy(false);
    if (result.error) alert("Could not save account settings. Please try again.", true);
    else alert("Account settings saved successfully.");
  }
  async function savePreferences(next: Preferences) {
    const previous = preferences;
    setPreferences(next);
    if (!supabase) return;
    const result = await supabase.auth.updateUser({ data: { testdz_notification_preferences: next } });
    if (result.error) { setPreferences(previous); alert("Preferences could not be saved. Your previous choices were restored.", true); }
    else alert("Notification preferences saved.");
  }
  async function saveTheme(next: string) {
    const previous = theme;
    setTheme(next);
    if (!supabase) return;
    const result = await supabase.auth.updateUser({ data: { testdz_theme: next } });
    if (result.error) { setTheme(previous); alert("Appearance preference could not be saved. Your previous choice was restored.", true); }
    else alert("Appearance preference saved.");
  }
  async function changePassword() {
    if (!supabase || password.length < 8) { alert("Use a password with at least 8 characters.", true); return; }
    if (password !== confirmPassword) { alert("The password confirmation does not match.", true); return; }
    setBusy(true);
    const result = await supabase.auth.updateUser({ password });
    setBusy(false);
    if (result.error) alert(result.error.message, true);
    else { setPassword(""); setConfirmPassword(""); alert("Password updated successfully."); }
  }
  async function changeEmail() {
    if (!supabase || !newEmail.includes("@")) { alert("Enter a valid email address.", true); return; }
    setBusy(true);
    const result = await supabase.auth.updateUser({ email: newEmail.trim() });
    setBusy(false);
    if (result.error) alert(result.error.message, true);
    else { setNewEmail(""); alert("Confirmation email sent to your new address. Follow the link to finish the change."); }
  }
  async function setupMfa() {
    if (!supabase) return;
    setMfaBusy(true); alert("");
    const result = await supabase.auth.mfa.enroll({ factorType: "totp", friendlyName: "TestDZ authenticator" });
    setMfaBusy(false);
    if (result.error) { alert(result.error.message, true); return; }
    setMfaQr(result.data.totp.qr_code);
    setMfaFactorId(result.data.id);
    setTab("security");
  }
  async function verifyMfa() {
    if (!supabase || !mfaFactorId || mfaCode.trim().length < 6) return;
    setMfaBusy(true);
    const challenge = await supabase.auth.mfa.challenge({ factorId: mfaFactorId });
    if (challenge.error) { setMfaBusy(false); alert(challenge.error.message, true); return; }
    const verified = await supabase.auth.mfa.verify({ factorId: mfaFactorId, challengeId: challenge.data.id, code: mfaCode.trim() });
    setMfaBusy(false);
    if (verified.error) { alert(verified.error.message, true); return; }
    setTwoFactor(true); setMfaQr(""); setMfaCode(""); alert("Two-factor authentication enabled.");
  }
  async function disableMfa() {
    if (!supabase) return;
    setMfaBusy(true);
    const factors = await supabase.auth.mfa.listFactors();
    const factor = factors.data?.totp?.find(item => item.status === "verified");
    if (!factor) { setMfaBusy(false); setTwoFactor(false); return; }
    const result = await supabase.auth.mfa.unenroll({ factorId: factor.id });
    setMfaBusy(false);
    if (result.error) alert(result.error.message, true);
    else { setTwoFactor(false); alert("Two-factor authentication disabled."); }
  }
  async function downloadData() {
    if (!supabase || !user) return;
    setBusy(true);
    const [profile, notices, checkins, feedback, ledger] = await Promise.all([
      supabase.from("profiles").select("*").eq("id", user.id).maybeSingle(),
      supabase.from("notifications").select("*").eq("user_id", user.id),
      supabase.from("checkins").select("*").eq("tester_id", user.id),
      supabase.from("feedback").select("*").eq("tester_id", user.id),
      supabase.from("points_ledger").select("*").eq("user_id", user.id)
    ]);
    setBusy(false);
    const payload = { exported_at: new Date().toISOString(), account: { id: user.id, email: user.email }, profile: profile.data, notifications: notices.data || [], checkins: checkins.data || [], feedback: feedback.data || [], points_ledger: ledger.data || [] };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob); const anchor = document.createElement("a");
    anchor.href = url; anchor.download = "testdz-account-data.json"; anchor.click(); window.setTimeout(() => URL.revokeObjectURL(url), 1000);
    alert("Your account data export has been prepared.");
  }
  async function logout() { await signOut(); navigate("/auth", { replace: true }); }

  const notificationItems: { key: keyof Preferences; title: string; icon: string }[] = [
    { key: "newTests", title: "New Tests & Assignments", icon: "tests" },
    { key: "rewards", title: "Rewards & Points", icon: "gift" },
    { key: "support", title: "Support Updates", icon: "help" },
    { key: "system", title: "System Updates", icon: "settings" },
    { key: "promotions", title: "Promotions & News", icon: "bell" }
  ];
  const matchingTabs = tabs.filter(item => `${item.label} ${item.id}`.toLowerCase().includes(searchTerm.trim().toLowerCase()));
  const tabsView = <div className="ss-tabs-wrap"><div className="ss-tabs" role="tablist">{matchingTabs.map(item => <button type="button" role="tab" aria-selected={tab === item.id} className={tab === item.id ? "active" : ""} key={item.id} onClick={() => { setTab(item.id); setSearchTerm(""); }}><Icon name={item.icon} size={19}/>{item.label}</button>)}</div>{searchTerm.trim() && matchingTabs.length === 0 && <p className="ss-search-empty">No settings section matches “{searchTerm}”. Try account, security, privacy or notifications.</p>}</div>;

  return <div className="td-dashboard ss-dashboard">
    <TesterSidebar nav={nav} name={name || firstName} firstName={firstName} avatar={avatar} roles={roles} isAdmin={isAdmin} isDeveloper={isDeveloper} workspaceMenuOpen={menuOpen} setWorkspaceMenuOpen={setMenuOpen} previewMode={!supabase}/>
    <main className="td-main ss-main">
      <header className="ss-topbar"><label className="ss-global-search"><Icon name="search" size={21}/><input value={searchTerm} onChange={event => setSearchTerm(event.target.value)} placeholder="Search settings..." aria-label="Search settings"/></label><div className="ss-top-user"><button type="button" aria-label="Notifications" onClick={() => setTab("notifications")}><Icon name="bell" size={23}/></button><span/><Link to="/profile"><b>{avatar ? <img src={avatar} alt=""/> : firstName.slice(0,2).toUpperCase()}</b>{name || firstName}<Icon name="chevron" size={16}/></Link></div></header>
      <div className="ss-content">
        <Link to="/tester-dashboard" className="ss-back"><Icon name="arrow" size={17}/>Back to Dashboard</Link>
        <section className="ss-hero"><div className="ss-hero-icon"><Icon name="settings" size={57}/></div><div><h1>Settings &amp; Security</h1><p>Manage your account settings, security and preferences.</p></div><div className="ss-hero-art"><Icon name="shield" size={110}/><span>✓</span><i/><b/></div></section>
        {tabsView}
        {(message || error) && <div className={`ss-alert ${error ? "error" : ""}`} role="status">{error || message}<button type="button" onClick={() => alert("")}>×</button></div>}
        {tab === "account" && <div className="ss-columns">
          <div className="ss-column">
            <section className="ss-card ss-account-card"><h2><Icon name="user" size={25}/>Account Settings</h2>
              <div className="ss-profile-row"><div className="ss-avatar">{avatar ? <img src={avatar} alt=""/> : firstName.slice(0,2).toUpperCase()}</div><div><strong>Profile Information</strong><small>Update your personal information.</small></div><Link to="/profile" className="ss-outline">Edit Profile <Icon name="user" size={15}/></Link></div>
              <div className="ss-info-row"><span className="ss-info-icon"><Icon name="mail" size={23}/></span><div><strong>Email Address</strong><small>{email || "Not available"}</small></div><span className={`ss-verified ${emailVerified ? "" : "pending"}`}>{emailVerified ? "Verified ✓" : "Not verified"}</span><button className="ss-outline" onClick={() => setTab("security")}>Change Email</button></div>
              <div className="ss-info-row"><span className="ss-info-icon"><Icon name="lock" size={23}/></span><div><strong>Password</strong><small>Update your account password securely.</small></div><button className="ss-outline" onClick={() => setTab("security")}>Change Password <Icon name="lock" size={14}/></button></div>
              <div className="ss-info-row"><span className="ss-info-icon"><Icon name="globe" size={23}/></span><div><strong>Language &amp; Region</strong><small>Choose your preferred language and region.</small></div><select value={locale} onChange={event => setLocale(event.target.value)}><option value="en-DZ">English (Algeria)</option><option value="fr-DZ">Français (Algérie)</option><option value="ar-DZ">العربية (الجزائر)</option></select></div>
              <div className="ss-info-row"><span className="ss-info-icon"><Icon name="clock" size={23}/></span><div><strong>Time Zone</strong><small>UTC+01:00 · Algiers</small></div><span className="ss-readonly">Africa/Algiers</span></div>
              <div className="ss-save-row"><button className="ss-primary" disabled={busy} onClick={() => void saveProfile()}>{busy ? "Saving..." : "Save account settings"}</button></div>
            </section>
            <section className="ss-card ss-account-actions"><h2><Icon name="bolt" size={24}/>Account Actions</h2><div><button onClick={() => void downloadData()} disabled={busy}><Icon name="download" size={23}/><span>Download<br/>My Data</span></button><button className="danger" onClick={() => { setTab("privacy"); alert("Account deletion is handled by TestDZ support to protect your account and active test assignments."); }}><Icon name="trash" size={23}/><span>Delete Account<br/><small>Contact support</small></span></button><button onClick={() => void logout()}><Icon name="logout" size={23}/><span>Sign Out</span></button></div></section>
          </div>
          <div className="ss-column">
            <section className="ss-card"><h2><Icon name="shield" size={25}/>Security</h2>
              <SettingRow icon="smartphone" title="Two-Factor Authentication (2FA)" description="Add an extra layer of security to your account." action={<><Toggle checked={twoFactor} onChange={value => value ? void setupMfa() : void disableMfa()} label="Two-factor authentication"/><span className={`ss-verified ${twoFactor ? "" : "pending"}`}>{twoFactor ? "✓ Active" : "Not active"}</span></>}/>
              <SettingRow icon="clock" title="Login Activity" description="Review your current authenticated session." action={<Link className="ss-outline" to="/tester/security-history">View Activity <Icon name="arrow" size={14}/></Link>}/>
              <SettingRow icon="monitor" title="Active Sessions" description={`This device · last sign-in ${user?.last_sign_in_at ? new Date(user.last_sign_in_at).toLocaleString() : "time unavailable"}.`} action={<Link className="ss-outline" to="/active-sessions">Manage Sessions <Icon name="arrow" size={14}/></Link>}/>
            </section>
            <section className="ss-card ss-notification-card"><h2><Icon name="bell" size={25}/>Notification Preferences</h2><p>Choose what notifications you want to receive.</p><div className="ss-pref-grid">{notificationItems.map(item => <label key={item.key}><input type="checkbox" checked={preferences[item.key]} onChange={event => void savePreferences({ ...preferences, [item.key]: event.target.checked })}/><span>{item.title}</span></label>)}</div></section>
            <section className="ss-success-card"><span><Icon name="check" size={30}/></span><div><strong>Account security overview</strong><b>{emailVerified ? "Email verified" : "Email verification pending"} · {twoFactor ? "2FA enabled" : "2FA not enabled"}</b><small>Your account security status is based on the current Supabase account.</small></div><Icon name="shield" size={45}/></section>
          </div>
        </div>}
        {tab === "security" && <div className="ss-single-column">
          <section className="ss-card ss-form-card"><h2><Icon name="shield" size={25}/>Security &amp; Sign-in</h2><p>Manage the credentials used to access your TestDZ account.</p>
            <div className="ss-form-block"><h3>Change Password</h3><p>Use at least 8 characters. A mix of letters, numbers and symbols makes your password stronger.</p><label>New password<input type="password" minLength={8} autoComplete="new-password" value={password} onChange={event => setPassword(event.target.value)} placeholder="At least 8 characters"/></label><div className="ss-password-meter" aria-label={`Password strength ${password.length ? Math.min(5, [password.length >= 8, /[A-Z]/.test(password), /[a-z]/.test(password), /\d/.test(password), /[^A-Za-z0-9]/.test(password)].filter(Boolean).length) : 0} of 5`}><div className="ss-password-bars">{[1,2,3,4,5].map(level => <i key={level} className={password.length && level <= [password.length >= 8, /[A-Z]/.test(password), /[a-z]/.test(password), /\d/.test(password), /[^A-Za-z0-9]/.test(password)].filter(Boolean).length ? "filled" : ""}/>)}</div><small>{!password ? "Password strength" : password.length < 8 ? "Too short" : [password.length >= 8, /[A-Z]/.test(password), /[a-z]/.test(password), /\d/.test(password), /[^A-Za-z0-9]/.test(password)].filter(Boolean).length >= 4 ? "Strong password" : "Could be stronger"}</small></div><label>Confirm new password<input type="password" autoComplete="new-password" value={confirmPassword} onChange={event => setConfirmPassword(event.target.value)} placeholder="Enter the password again"/></label>{confirmPassword && <small className={password === confirmPassword ? "ss-match-ok" : "ss-match-error"}>{password === confirmPassword ? "Passwords match" : "Passwords do not match"}</small>}<button className="ss-primary" disabled={busy || password.length < 8 || password !== confirmPassword} onClick={() => void changePassword()}>{busy ? "Updating..." : "Update Password"}</button></div>
            <div className="ss-form-block"><h3>Change Email Address</h3><p>Supabase will send a confirmation link before the new email address is applied.</p><label>New email address<input type="email" autoComplete="email" value={newEmail} onChange={event => setNewEmail(event.target.value)} placeholder="name@example.com"/></label><button className="ss-primary" disabled={busy || !newEmail.includes("@")} onClick={() => void changeEmail()}>Send confirmation</button></div>
            <div className="ss-form-block"><h3>Two-Factor Authentication</h3><p>{twoFactor ? "An authenticator factor is verified on your account." : "Use an authenticator app to add a second verification step."}</p>{!twoFactor && !mfaQr && <button className="ss-outline" disabled={mfaBusy} onClick={() => void setupMfa()}>{mfaBusy ? "Preparing..." : "Set up authenticator"}</button>}{mfaQr && <div className="ss-mfa-setup"><img src={mfaQr} alt="Authenticator QR code"/><label>Enter the 6-digit code from your authenticator<input inputMode="numeric" autoComplete="one-time-code" value={mfaCode} onChange={event => setMfaCode(event.target.value.replace(/\D/g,"").slice(0,6))}/></label><button className="ss-primary" disabled={mfaBusy || mfaCode.length !== 6} onClick={() => void verifyMfa()}>Verify and enable</button></div>}{twoFactor && <button className="ss-danger-button" disabled={mfaBusy} onClick={() => void disableMfa()}>Turn off 2FA</button>}</div>
          </section>
        </div>}
        {tab === "notifications" && <div className="ss-single-column"><section className="ss-card ss-form-card"><h2><Icon name="bell" size={25}/>Notification Preferences</h2><p>Choose the updates you want to receive. Your preferences are saved to your account.</p><div className="ss-pref-list">{notificationItems.map(item => <label key={item.key}><span className="ss-row-icon"><Icon name={item.icon} size={20}/></span><span>{item.title}</span><Toggle checked={preferences[item.key]} onChange={value => void savePreferences({ ...preferences, [item.key]: value })} label={item.title}/></label>)}</div></section></div>}
        {tab === "privacy" && <div className="ss-single-column"><section className="ss-card ss-form-card"><h2><Icon name="lock" size={25}/>Privacy &amp; Data</h2><p>Review your account data and current sign-in session.</p><div className="ss-form-block"><h3>Download your data</h3><p>Export your profile, notifications, check-ins, feedback and points ledger as a JSON file.</p><button className="ss-primary" disabled={busy} onClick={() => void downloadData()}><Icon name="download" size={17}/> Download account data</button></div><div className="ss-form-block"><h3>Current session</h3><p>Signed in as {email || "your TestDZ account"}. Session information is managed securely by Supabase Authentication.</p><span className="ss-current-session">Current device · Active</span></div><div className="ss-form-block"><h3>Delete account</h3><p>Account deletion requires a support review so active assignments, rewards and outstanding withdrawals are handled safely.</p><Link className="ss-outline" to="/help-support">Contact TestDZ Support <Icon name="arrow" size={14}/></Link></div></section></div>}
        {tab === "appearance" && <div className="ss-single-column"><section className="ss-card ss-form-card"><h2><Icon name="settings" size={25}/>Appearance</h2><p>Choose how TestDZ looks on this account.</p><Link className="ss-outline" to="/tester/language-appearance">Open Language &amp; Appearance Settings <Icon name="arrow" size={14}/></Link><div className="ss-theme-options"><button className={theme === "light" ? "selected" : ""} onClick={() => void saveTheme("light")}><span className="ss-theme-preview light"/>Light theme {theme === "light" && <Icon name="check" size={16}/>}</button><button className={theme === "dark" ? "selected" : ""} onClick={() => void saveTheme("dark")}><span className="ss-theme-preview dark"/>Dark theme {theme === "dark" && <Icon name="check" size={16}/>}</button><button className={theme === "system" ? "selected" : ""} onClick={() => void saveTheme("system")}><span className="ss-theme-preview system"/>System default {theme === "system" && <Icon name="check" size={16}/>}</button></div><p className="ss-note">The preference is saved to your account. Full dark-theme styling can be enabled across the workspace separately.</p></section></div>}
      </div>
    </main>
  </div>;
}
