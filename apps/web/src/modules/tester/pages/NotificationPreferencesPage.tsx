import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "../../../lib/supabase";
import { isTesterWorkflowV2Enabled, supabaseV2 } from "../../../lib/supabase-v2";
import { useIdentity } from "../../../shared/auth/hooks/useIdentity";
import TesterSidebar, { Icon } from "../components/TesterSidebar";
import "../styles/tester-dashboard.css";
import "../styles/notification-preferences.css";

type NoticeKey = "rewards" | "newTests" | "assignmentUpdates" | "achievements" | "supportMessages" | "systemUpdates";
type Channel = "push" | "email" | "inApp";
type Preferences = {
  types: Record<NoticeKey, boolean>;
  channels: Channel[];
  delivery: Record<NoticeKey, Channel>;
  quiet: { enabled: boolean; from: string; to: string; timezone: string };
  emailDigest: boolean;
  marketing: boolean;
};
const defaults: Preferences = {
  types: { rewards: true, newTests: true, assignmentUpdates: true, achievements: true, supportMessages: true, systemUpdates: true },
  channels: ["push"],
  delivery: { rewards: "email", newTests: "push", assignmentUpdates: "push", achievements: "inApp", supportMessages: "email", systemUpdates: "inApp" },
  quiet: { enabled: true, from: "22:00", to: "08:00", timezone: "Africa/Algiers" },
  emailDigest: false,
  marketing: true
};
const items: { key: NoticeKey; title: string; description: string; icon: string; color: string }[] = [
  { key: "rewards", title: "Rewards & Points", description: "Get notified about your points, rewards and bonuses.", icon: "gift", color: "gold" },
  { key: "newTests", title: "New Tests", description: "Be the first to know about new tests available.", icon: "flask", color: "green" },
  { key: "assignmentUpdates", title: "Assignment Updates", description: "Receive updates about your assignments.", icon: "check", color: "violet" },
  { key: "achievements", title: "Achievements", description: "Get notified when you earn badges and achievements.", icon: "trophy", color: "orange" },
  { key: "supportMessages", title: "Support Messages", description: "Receive replies about your support requests.", icon: "message", color: "teal" },
  { key: "systemUpdates", title: "System Updates", description: "Important platform updates and announcements.", icon: "bell", color: "red" }
];
const channelNames: Record<Channel, string> = { push: "Push", email: "Email", inApp: "In-App" };
function Toggle({ checked, onChange, label }: { checked: boolean; onChange: (value: boolean) => void; label: string }) {
  return <button type="button" role="switch" aria-checked={checked} aria-label={label} className={`np-toggle ${checked ? "on" : ""}`} onClick={() => onChange(!checked)}><i /></button>;
}
export default function NotificationPreferencesPage() {
  const { user, roles = [] } = useIdentity();
  const [name, setName] = useState("");
  const [avatar, setAvatar] = useState("");
  const [prefs, setPrefs] = useState<Preferences>(defaults);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [menuOpen, setMenuOpen] = useState(false);
  const firstName = name.trim().split(/\\s+/)[0] || user?.email?.split("@")[0] || "Tester";
  const isAdmin = roles.includes("admin");
  const isDeveloper = roles.includes("developer");
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
    { label: "Notifications", icon: "bell", href: "/notification-preferences", active: true },
    { label: "Settings", icon: "settings", href: "/settings" },
    ...(isDeveloper ? [{ label: "Developer", icon: "code", href: "/developer-dashboard" }] : [])
  ];
  useEffect(() => {
    if (!user || !supabase) return;
    let alive = true;
    const client: any = isTesterWorkflowV2Enabled ? supabaseV2 : supabase;
    if (!client) {
      setError("V2 profile settings are unavailable because the V2 client is not initialized.");
      return;
    }
    Promise.all([
      client.from("profiles").select("display_name,avatar_url").eq("id", user.id).maybeSingle(),
      Promise.resolve(user.user_metadata?.testdz_notification_center_preferences as Partial<Preferences> | undefined)
    ]).then(([profile, saved]) => {
      if (!alive) return;
      if (profile.error) {
        setError("Could not load your profile and notification preferences.");
        return;
      }
      setName(profile.data?.display_name || user.email?.split("@")[0] || "Tester");
      setAvatar(profile.data?.avatar_url || "");
      if (saved) setPrefs({
        ...defaults, ...saved,
        types: { ...defaults.types, ...(saved.types || {}) },
        delivery: { ...defaults.delivery, ...(saved.delivery || {}) },
        quiet: { ...defaults.quiet, ...(saved.quiet || {}) },
        channels: Array.isArray(saved.channels) ? saved.channels : defaults.channels
      });
    }).catch(() => { if (alive) setError("Could not load your notification preferences."); });
    return () => { alive = false; };
  }, [user?.id]);
  const updateType = (key: NoticeKey, value: boolean) => setPrefs(current => ({ ...current, types: { ...current.types, [key]: value } }));
  const updateDelivery = (key: NoticeKey, value: Channel) => setPrefs(current => ({ ...current, delivery: { ...current.delivery, [key]: value } }));
  const save = async () => {
    if (!supabase || !user) { setError("Sign in to save notification preferences."); return; }
    setBusy(true); setMessage(""); setError("");
    const result = await supabase.auth.updateUser({ data: { testdz_notification_center_preferences: prefs } });
    setBusy(false);
    if (result.error) setError("Your preferences could not be saved. Please try again.");
    else setMessage("Your notification preferences have been saved.");
  };
  const reset = () => { setPrefs(defaults); setMessage("Default preferences restored. Select Save Preferences to apply them."); setError(""); };
  const toggleChannel = (channel: Channel) => setPrefs(current => ({
    ...current,
    channels: current.channels.includes(channel) ? current.channels.filter(item => item !== channel) : [...current.channels, channel]
  }));
  const activeChannel = prefs.channels[0] || "push";
  return <div className="td-dashboard np-dashboard">
    <TesterSidebar nav={nav} name={name || firstName} firstName={firstName} avatar={avatar} roles={roles} isAdmin={isAdmin} isDeveloper={isDeveloper} workspaceMenuOpen={menuOpen} setWorkspaceMenuOpen={setMenuOpen} previewMode={!supabase} />
    <main className="td-main np-main">
      <header className="np-topbar">
        <label className="np-search"><Icon name="search" size={21}/><input placeholder="Search in TestDZ..." aria-label="Search in TestDZ" /></label>
        <div className="np-user"><Link to="/notifications" aria-label="Open notifications"><Icon name="bell" size={25}/><i>3</i></Link><span/><Link to="/profile"><b>{avatar ? <img src={avatar} alt="" /> : firstName.slice(0, 2).toUpperCase()}</b>{name || firstName}<Icon name="chevron" size={16}/></Link></div>
      </header>
      <div className="np-content">
        <Link to="/settings" className="np-back"><Icon name="arrow" size={17}/>Back to Settings</Link>
        <section className="np-hero"><div className="np-hero-icon"><Icon name="bell" size={56}/></div><div className="np-hero-copy"><h1>Notification Preferences</h1><p>Choose what notifications you want to receive and how.</p></div><div className="np-hero-art"><Icon name="smartphone" size={104}/><span><Icon name="bell" size={40}/></span><i/><b/></div></section>
        {(message || error) && <div className={`np-alert ${error ? "error" : ""}`} role="status">{error || message}<button onClick={() => { setMessage(""); setError(""); }} aria-label="Dismiss">×</button></div>}
        <div className="np-layout">
          <section className="np-card np-types">
            <h2><Icon name="bell" size={24}/>Notification Types</h2>
            <div className="np-type-list">{items.map(item => <div className="np-type-row" key={item.key}>
              <span className={`np-type-icon ${item.color}`}><Icon name={item.icon} size={25}/></span>
              <div className="np-type-copy"><strong>{item.title}</strong><small>{item.description}</small></div>
              <Toggle checked={prefs.types[item.key]} onChange={value => updateType(item.key, value)} label={`${item.title} notifications`}/>
              <label className="np-channel-select"><Icon name={prefs.delivery[item.key] === "email" ? "mail" : prefs.delivery[item.key] === "push" ? "bell" : "smartphone"} size={18}/><select value={prefs.delivery[item.key]} onChange={event => updateDelivery(item.key, event.target.value as Channel)} aria-label={`${item.title} delivery channel`}>{(Object.keys(channelNames) as Channel[]).map(channel => <option value={channel} key={channel}>{channelNames[channel]}</option>)}</select></label>
            </div>)}</div>
          </section>
          <div className="np-right">
            <section className="np-card np-channels">
              <h2><Icon name="bolt" size={24}/>Notification Channels</h2>
              <div className="np-channel-grid">
                {(["push", "email", "inApp"] as Channel[]).map(channel => <button type="button" key={channel} className={prefs.channels.includes(channel) ? "selected" : ""} onClick={() => toggleChannel(channel)} aria-pressed={prefs.channels.includes(channel)}>
                  <span>{channel === "push" ? <Icon name="bell" size={36}/> : channel === "email" ? <Icon name="mail" size={36}/> : <Icon name="smartphone" size={36}/>}</span><strong>{channelNames[channel]}</strong>{channel === "push" && <small>(Recommended)</small>}{prefs.channels.includes(channel) && <i><Icon name="check" size={14}/></i>}
                </button>)}
              </div>
              <p className="np-hint">Select the channels you want available for notifications. Individual types can use a different delivery preference.</p>
            </section>
            <section className="np-card np-quiet">
              <h2><Icon name="clock" size={24}/>Do Not Disturb <Toggle checked={prefs.quiet.enabled} onChange={value => setPrefs(current => ({ ...current, quiet: { ...current.quiet, enabled: value } }))} label="Do not disturb"/></h2>
              <p>Silence notifications during specific hours.</p>
              <div className="np-time-row"><strong>From</strong><label><Icon name="clock" size={18}/><input type="time" value={prefs.quiet.from} onChange={event => setPrefs(current => ({ ...current, quiet: { ...current.quiet, from: event.target.value } }))}/></label><strong>To</strong><label><Icon name="clock" size={18}/><input type="time" value={prefs.quiet.to} onChange={event => setPrefs(current => ({ ...current, quiet: { ...current.quiet, to: event.target.value } }))}/></label></div>
              <label className="np-timezone"><Icon name="globe" size={19}/><span>Timezone</span><select value={prefs.quiet.timezone} onChange={event => setPrefs(current => ({ ...current, quiet: { ...current.quiet, timezone: event.target.value } }))}><option value="Africa/Algiers">Algeria (GMT+1)</option><option value="UTC">UTC</option><option value="Europe/Paris">Paris (GMT+1/+2)</option><option value="Europe/London">London (GMT+0/+1)</option></select></label>
            </section>
            <section className="np-card np-preview">
              <h2><Icon name="eye" size={24}/>Preview</h2><p>You'll receive notifications like this:</p>
              <div className="np-preview-message"><span><Icon name="check" size={30}/></span><div><strong>TestDZ</strong><small>2m ago</small><p>{prefs.types.rewards ? "You've earned 100 points!" : "Your notification preferences are updated."}</p><small>Keep testing and earn more rewards. 🎉</small></div></div>
              <div className="np-preview-meta">Preferred channel: <b>{channelNames[activeChannel]}</b></div>
            </section>
          </div>
          <section className="np-card np-advanced">
            <h2><Icon name="settings" size={24}/>Advanced Options</h2>
            <div className="np-advanced-row"><span><Icon name="shield" size={23}/></span><div><strong>Email Digest</strong><small>Receive a summary of non-urgent notifications daily.</small></div><Toggle checked={prefs.emailDigest} onChange={value => setPrefs(current => ({ ...current, emailDigest: value }))} label="Email digest"/></div>
            <div className="np-advanced-row"><span><Icon name="message" size={23}/></span><div><strong>Marketing Communications</strong><small>Get updates about new features and offers.</small></div><Toggle checked={prefs.marketing} onChange={value => setPrefs(current => ({ ...current, marketing: value }))} label="Marketing communications"/></div>
          </section>
        </div>
        <footer className="np-footer"><span><Icon name="info" size={29}/><b>Note: You can change these settings anytime. If you're not receiving notifications, please check your device settings.</b></span><div><button className="np-save" onClick={() => void save()} disabled={busy}><Icon name="check" size={19}/>{busy ? "Saving..." : "Save Preferences"}</button><button className="np-reset" onClick={reset}><Icon name="refresh" size={19}/>Reset to Default</button></div></footer>
      </div>
    </main>
  </div>;
}
