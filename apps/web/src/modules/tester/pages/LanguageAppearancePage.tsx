import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "../../../lib/supabase";
import { useIdentity } from "../../../shared/auth/hooks/useIdentity";
import TesterSidebar, { Icon } from "../components/TesterSidebar";
import "../styles/tester-dashboard.css";
import "../styles/language-appearance.css";

type Theme = "light" | "dark" | "system";
type Language = "en-DZ" | "ar-DZ" | "fr-DZ";
type DateFormat = "MMM DD, YYYY" | "DD/MM/YYYY" | "YYYY-MM-DD";
type TimeFormat = "24h" | "12h";
type WeekStart = "Sunday" | "Monday" | "Saturday";
type Preferences = {
  theme: Theme;
  compactMode: boolean;
  animations: boolean;
  tips: boolean;
  dateFormat: DateFormat;
  timeFormat: TimeFormat;
  weekStart: WeekStart;
};
const defaults: Preferences = {
  theme: "light", compactMode: false, animations: true, tips: true,
  dateFormat: "MMM DD, YYYY", timeFormat: "24h", weekStart: "Sunday"
};
const languages: { value: Language; label: string; flag: string; native: string }[] = [
  { value: "en-DZ", label: "English", flag: "🇬🇧", native: "English" },
  { value: "ar-DZ", label: "العربية", flag: "🇩🇿", native: "العربية" },
  { value: "fr-DZ", label: "Français", flag: "🇫🇷", native: "Français" }
];
function Toggle({ checked, onChange, label }: { checked: boolean; onChange: (value: boolean) => void; label: string }) {
  return <button type="button" role="switch" aria-checked={checked} aria-label={label} className={`la-toggle ${checked ? "on" : ""}`} onClick={() => onChange(!checked)}><i /></button>;
}
export default function LanguageAppearancePage() {
  const { user, roles = [] } = useIdentity();
  const [name, setName] = useState("");
  const [avatar, setAvatar] = useState("");
  const [language, setLanguage] = useState<Language>("en-DZ");
  const [prefs, setPrefs] = useState<Preferences>(defaults);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
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
    { label: "Activity & History", icon: "chart", href: "/activity-history" },
    { label: "Notifications", icon: "bell", href: "/notification-preferences" },
    { label: "Settings", icon: "settings", href: "/settings", active: true },
    ...(isDeveloper ? [{ label: "Developer", icon: "code", href: "/developer-dashboard" }] : [])
  ];
  useEffect(() => {
    if (!user || !supabase) return;
    let alive = true;
    Promise.all([
      supabase.from("profiles").select("display_name,avatar_url,locale").eq("id", user.id).maybeSingle(),
      Promise.resolve(user.user_metadata?.testdz_language_appearance as Partial<Preferences> | undefined)
    ]).then(([profile, saved]) => {
      if (!alive) return;
      setName(profile.data?.display_name || user.email?.split("@")[0] || "Tester");
      setAvatar(profile.data?.avatar_url || "");
      const locale = profile.data?.locale;
      if (locale === "ar-DZ" || locale === "fr-DZ" || locale === "en-DZ") setLanguage(locale);
      if (saved) setPrefs({ ...defaults, ...saved });
    }).catch(() => { if (alive) setError("Some preferences could not be loaded."); });
    return () => { alive = false; };
  }, [user?.id]);
  useEffect(() => {
    const root = document.documentElement;
    root.dataset.theme = prefs.theme;
    root.lang = language.slice(0, 2);
    root.dir = language === "ar-DZ" ? "rtl" : "ltr";
    return () => { delete root.dataset.theme; root.dir = "ltr"; };
  }, [prefs.theme, language]);
  const update = <K extends keyof Preferences,>(key: K, value: Preferences[K]) => setPrefs(current => ({ ...current, [key]: value }));
  async function save() {
    if (!supabase || !user) { setError("Sign in to save your language and appearance preferences."); return; }
    setBusy(true); setMessage(""); setError("");
    const profileResult = await supabase.from("profiles").update({ locale: language }).eq("id", user.id);
    if (profileResult.error) {
      setBusy(false); setError("Your language preference could not be saved. Please try again."); return;
    }
    const authResult = await supabase.auth.updateUser({ data: { testdz_language_appearance: prefs, testdz_theme: prefs.theme } });
    setBusy(false);
    if (authResult.error) setError("Your display preferences could not be saved. Please try again.");
    else setMessage("Your preferences have been saved securely.");
  }
  function reset() {
    setLanguage("en-DZ"); setPrefs(defaults); setMessage("Default preferences restored. Select Save Changes to apply them."); setError("");
  }
  const displayName = name || firstName;
  const datePreview = prefs.dateFormat === "DD/MM/YYYY" ? "07/11/2026" : prefs.dateFormat === "YYYY-MM-DD" ? "2026-11-07" : "Nov 07, 2026";
  const timePreview = prefs.timeFormat === "24h" ? "14:30" : "02:30 PM";
  return <div className={`td-dashboard la-dashboard ${prefs.compactMode ? "compact" : ""} ${!prefs.animations ? "no-motion" : ""}`}>
    <TesterSidebar nav={nav} name={displayName} firstName={firstName} avatar={avatar} roles={roles} isAdmin={isAdmin} isDeveloper={isDeveloper} workspaceMenuOpen={menuOpen} setWorkspaceMenuOpen={setMenuOpen} previewMode={!supabase}/>
    <main className="td-main la-main">
      <header className="td-topbar"><label className="td-search" role="search"><Icon name="search" size={21}/><input placeholder="Search in TestDZ..." aria-label="Search in TestDZ"/></label><div className="td-top-actions"><Link to="/notifications" className="td-notification" aria-label="Notifications"><Icon name="bell" size={21}/></Link><span className="td-top-divider"/><Link to="/profile" className="td-profile-short" aria-label="Your profile"><span>{avatar ? <img src={avatar} alt=""/> : firstName.slice(0,2).toUpperCase()}</span><strong>{displayName}</strong><Icon name="chevron" size={16}/></Link></div></header>
      <div className="la-content">
        <Link to="/settings" className="la-back"><Icon name="arrow" size={17}/>Back to Settings</Link>
        <section className="la-hero"><div className="la-hero-icon"><Icon name="settings" size={54}/></div><div className="la-hero-copy"><h1>Language &amp; Appearance Settings</h1><p>Customize your experience with your preferred language and display options.</p></div><div className="la-hero-art"><span>Aa</span><Icon name="monitor" size={58}/></div></section>
        {(message || error) && <div className={`la-alert ${error ? "error" : ""}`} role="status">{error || message}<button type="button" onClick={() => { setMessage(""); setError(""); }}>×</button></div>}
        <div className="la-grid">
          <section className="la-card la-language"><h2><Icon name="globe" size={25}/>Language Settings</h2><strong className="la-section-label">Choose your preferred language:</strong>
            <div className="la-language-options">{languages.map(item => <button type="button" key={item.value} className={language === item.value ? "selected" : ""} onClick={() => setLanguage(item.value)} aria-pressed={language === item.value}><i>{language === item.value ? "●" : "○"}</i><span className="la-flag">{item.flag}</span><b>{item.label}</b></button>)}</div>
            <div className="la-info"><Icon name="info" size={20}/><span>The language preference is saved to your TestDZ profile.</span></div>
          </section>
          <section className="la-card la-theme"><h2><Icon name="sun" size={25}/>Appearance Mode</h2><strong className="la-section-label">Select your preferred theme:</strong>
            <div className="la-theme-options">
              <button type="button" className={prefs.theme === "light" ? "selected" : ""} onClick={() => update("theme", "light")}><Icon name="sun" size={34}/><b>Light Mode</b><i>{prefs.theme === "light" ? "●" : "○"}</i></button>
              <button type="button" className={prefs.theme === "dark" ? "selected" : ""} onClick={() => update("theme", "dark")}><Icon name="moon" size={34}/><b>Dark Mode</b><i>{prefs.theme === "dark" ? "●" : "○"}</i></button>
              <button type="button" className={prefs.theme === "system" ? "selected" : ""} onClick={() => update("theme", "system")}><Icon name="monitor" size={34}/><b>Auto<br/>(Follow System)</b><i>{prefs.theme === "system" ? "●" : "○"}</i></button>
            </div>
          </section>
          <section className="la-card la-display"><h2><Icon name="monitor" size={25}/>Display Preferences</h2>
            <div className="la-setting-row"><span className="la-setting-icon"><Icon name="shield" size={23}/></span><div><b>Compact Mode</b><small>Show a more compact layout</small></div><Toggle checked={prefs.compactMode} onChange={value => update("compactMode", value)} label="Compact mode"/></div>
            <div className="la-setting-row"><span className="la-setting-icon"><Icon name="bolt" size={23}/></span><div><b>Animations</b><small>Enable smooth animations</small></div><Toggle checked={prefs.animations} onChange={value => update("animations", value)} label="Animations"/></div>
            <div className="la-setting-row"><span className="la-setting-icon"><Icon name="lightbulb" size={23}/></span><div><b>Show Tips &amp; Hints</b><small>Display helpful tips throughout the platform</small></div><Toggle checked={prefs.tips} onChange={value => update("tips", value)} label="Show tips and hints"/></div>
          </section>
          <section className="la-card la-region"><h2><Icon name="globe" size={25}/>Regional Settings</h2>
            <label><b>Date Format</b><select value={prefs.dateFormat} onChange={event => update("dateFormat", event.target.value as DateFormat)}><option value="MMM DD, YYYY">Nov 07, 2026 (MMM DD, YYYY)</option><option value="DD/MM/YYYY">07/11/2026 (DD/MM/YYYY)</option><option value="YYYY-MM-DD">2026-11-07 (YYYY-MM-DD)</option></select></label>
            <label><b>Time Format</b><select value={prefs.timeFormat} onChange={event => update("timeFormat", event.target.value as TimeFormat)}><option value="24h">24-Hour (14:30)</option><option value="12h">12-Hour (02:30 PM)</option></select></label>
            <label><b>First Day of Week</b><select value={prefs.weekStart} onChange={event => update("weekStart", event.target.value as WeekStart)}><option>Sunday</option><option>Monday</option><option>Saturday</option></select></label>
          </section>
          <section className="la-card la-preview"><h2><Icon name="eye" size={25}/>Preview</h2><p>Here's how the settings will look:</p><div className="la-preview-user"><span>{avatar ? <img src={avatar} alt=""/> : firstName.slice(0,2).toUpperCase()}</span><div><b>{displayName}</b><small>Welcome to TestDZ!</small></div><em>{roles.includes("tester") ? "Tester" : "Member"}</em><strong className={`theme-${prefs.theme}`}>{prefs.theme === "dark" ? "☾" : "☀"} {prefs.theme === "system" ? "Auto Mode" : prefs.theme === "dark" ? "Dark Mode" : "Light Mode"}</strong></div><div className="la-preview-meta"><span>{datePreview}</span><span>{timePreview}</span><span>{prefs.weekStart} start</span></div></section>
          <section className="la-card la-saved"><span><Icon name="shield" size={35}/></span><div><b>Your Preferences are Saved Securely</b><small>You can change these settings anytime from this page.</small></div></section>
        </div>
        <footer className="la-footer"><button type="button" className="la-reset" onClick={reset}><Icon name="refresh" size={18}/>Reset to Default</button><button type="button" className="la-save" onClick={() => void save()} disabled={busy}><Icon name="check" size={18}/>{busy ? "Saving..." : "Save Changes"}</button></footer>
      </div>
    </main>
  </div>;
}
