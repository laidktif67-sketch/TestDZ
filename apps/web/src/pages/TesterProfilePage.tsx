import { useEffect, useState } from "react";
import type { FormEvent } from "react";
import imageCompression from "browser-image-compression";
import { Link, useNavigate } from "react-router-dom";
import type { AvatarMimeType } from "@testdz/types";
import { profilesApi } from "../features/profiles/profiles-api";
import { identityApi } from "../features/identity/identity-api";
import { useIdentity } from "../features/identity/hooks/useIdentity";
import TesterSidebar from "../components/TesterSidebar";

function avatarMimeType(value: string): AvatarMimeType {
  if (value === "image/png" || value === "image/webp") return value;
  return "image/jpeg";
}

function Toggle({ defaultOn = true, label }: { defaultOn?: boolean; label: string }) {
  const [on, setOn] = useState(defaultOn);
  return <button type="button" className={`tester-toggle ${on ? "is-on" : ""}`} aria-label={label} aria-pressed={on} onClick={() => setOn((value) => !value)}><span /></button>;
}

export default function ProfilePage() {
  const navigate = useNavigate();
  const { roles: identityRoles } = useIdentity();
  const [workspaceMenuOpen, setWorkspaceMenuOpen] = useState(false);
  const [userId, setUserId] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [bio, setBio] = useState("");
  const [avatarUrl, setAvatarUrl] = useState("");
  const [verified, setVerified] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [editing, setEditing] = useState(false);
  const [language, setLanguage] = useState("English");
  const [theme, setTheme] = useState("Light");

  useEffect(() => {
    if (!profilesApi.isConfigured()) return;
    identityApi.getCurrentUser().then(async ({ data, error: authError }) => {
      if (authError || !data.user) { navigate("/auth", { replace: true }); return; }
      setUserId(data.user.id);
      setEmail(data.user.email ?? "");
      const { data: profile, error: profileError } = await profilesApi.getProfile(data.user.id);
      if (profileError) { setError("We couldn't load your profile. Please refresh and try again."); return; }
      setDisplayName(profile.display_name ?? "");
      setPhone(profile.phone ?? "");
      setBio(profile.bio ?? "");
      setAvatarUrl(profile.avatar_url ?? "");
      setVerified(Boolean(profile.is_verified));
    }).catch(() => setError("We couldn't load your profile. Please refresh and try again."));
  }, [navigate]);

  async function logout() {
    if (identityApi.isConfigured()) {
      try { await identityApi.signOut(); } catch { setError("Could not sign out. Please try again."); return; }
    }
    navigate("/auth", { replace: true });
  }

  async function save(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!profilesApi.isConfigured()) { setMessage("Preview mode: connect the backend to save profile changes."); return; }
    setBusy(true); setMessage(""); setError("");
    try {
      const { error: err } = await profilesApi.updateSettings(userId, { display_name: displayName.trim(), phone: phone.trim() || null, bio: bio.trim() || null });
      if (err) setError("Couldn't save your profile. Check the details and try again.");
      else { setMessage("Profile updated successfully!"); setEditing(false); }
    } catch { setError("Couldn't save your profile. Check the details and try again."); }
    finally { setBusy(false); }
  }

  async function upload(file?: File) {
    if (!file) return;
    if (!profilesApi.isConfigured()) { setMessage("Preview mode: connect the backend to upload a profile photo."); return; }
    setError(""); setMessage("");
    if (file.size > 8 * 1024 * 1024) { setError("The original image must be 8 MB or smaller."); return; }
    if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) { setError("Supported formats: JPG, PNG and WebP."); return; }
    setBusy(true);
    try {
      const output = await imageCompression(file, { maxSizeMB: 0.45, maxWidthOrHeight: 512, useWebWorker: true });
      const result = await profilesApi.uploadAvatar(userId, { body: await output.arrayBuffer(), contentType: avatarMimeType(output.type) });
      if (!result.ok) setError(result.stage === "upload" ? "Couldn't upload the photo. Please try again." : "The photo uploaded, but its profile link couldn't be saved.");
      else { setAvatarUrl(result.url); setMessage(result.cleanupPending ? "Photo updated; some old files could not be cleaned up." : "Profile photo updated."); }
    } catch { setError("Couldn't process the image. Please choose another photo."); }
    finally { setBusy(false); }
  }

  const initials = displayName.trim().split(/\s+/).map((part) => part[0]).join("").slice(0, 2).toUpperCase() || "T";
  return (
    <main className="tester-profile-page">
      <TesterSidebar
        nav={[
          { label: "Dashboard", icon: "home", href: "/tester-dashboard" },
          { label: "My Tests", icon: "tests", href: "/my-tests" },
          { label: "Feedback History", icon: "star", href: "/feedback-history" },
          { label: "Wallet & Rewards", icon: "wallet", href: "/wallet-rewards" },
          { label: "Profile", icon: "user", href: "/profile", active: true },
          { label: "Help & Support", icon: "bell", href: "/help-support" },
          { label: "Settings", icon: "settings", href: "/settings" },
          ...(identityRoles.includes("developer") || identityRoles.includes("admin") ? [{ label: "Discover Apps", icon: "search", href: "/apps" }] : []),
          ...(identityRoles.includes("developer") || identityRoles.includes("admin") ? [{ label: "Developer Dashboard", icon: "code", href: "/developer-dashboard" }] : []),
          ...(identityRoles.includes("admin") ? [{ label: "Admin", icon: "shield", href: "/admin" }] : [])
        ]}
        name={displayName || email.split("@")[0] || "Tester"}
        firstName={(displayName || email.split("@")[0] || "Tester").split(/\s+/)[0]}
        avatar={avatarUrl}
        roles={identityRoles}
        isAdmin={identityRoles.includes("admin")}
        isDeveloper={identityRoles.includes("developer")}
        workspaceMenuOpen={workspaceMenuOpen}
        setWorkspaceMenuOpen={setWorkspaceMenuOpen}
        previewMode={!profilesApi.isConfigured()}
        sidebarClassName="tester-sidebar"
      />

      <section className="tester-profile-main">
        <header className="tester-topbar">
          <label className="tester-search"><span>⌕</span><input aria-label="Search" placeholder="Search anything..." /></label>
          <div className="tester-top-actions"><button type="button" className="tester-notification" aria-label="Notifications">🔔<i>3</i></button><span className="tester-top-divider" /><span className="tester-top-avatar">{initials}</span><strong>{displayName || "Tester"}</strong><span className="tester-chevron">⌄</span></div>
        </header>

        <div className="tester-profile-content">
          <section className="tester-profile-hero">
            <div><h1>Your Profile,<br />Your Control!</h1><p>Manage your information and customize your experience.</p></div>
            <div className="tester-hero-art" aria-hidden="true"><span className="tester-art-gear">⚙️</span><span className="tester-art-id">🪪<b>✓</b></span><span className="tester-art-shield">🛡️</span><i>✨</i><em>⭐</em></div>
          </section>

          <section className="tester-summary-card">
            <div className="tester-summary-person">
              <div className="tester-large-avatar">{avatarUrl ? <img src={avatarUrl} alt="Profile" /> : <span className="tester-avatar-emoji" aria-label="Profile avatar">👨🏻‍💻</span>}<label className="tester-camera" title="Change profile photo">📷<input type="file" accept="image/jpeg,image/png,image/webp" onChange={(e) => upload(e.target.files?.[0])} /></label></div>
              <div className="tester-summary-copy"><h2>{displayName || "Your Name"} <span className="tester-verified-badge">☑️</span></h2><p>Tester ID: <strong>TST-{userId ? userId.replace(/-/g, "").slice(0, 8).toUpperCase() : "PREVIEW"}</strong> <span className="tester-level">⭐ Level 1</span></p><small>{bio || "Passionate about testing and improving apps ✨"}</small></div>
            </div>
            <div className="tester-stat"><span>🧪</span><strong>—</strong><small>Total Tests</small></div>
            <div className="tester-stat"><span>⭐</span><strong>—</strong><small>Average Rating</small></div>
            <div className="tester-stat"><span>🎁</span><strong>—</strong><small>Total Points</small></div>
          </section>

          {(message || error) && <div className={`tester-profile-alert ${error ? "is-error" : ""}`} role="status">{error || message}<button type="button" onClick={() => { setMessage(""); setError(""); }} aria-label="Dismiss">×</button></div>}

          <div className="tester-profile-grid">
            <div className="tester-profile-left">
              <section className="tester-panel tester-personal-panel">
                <div className="tester-panel-heading"><span className="tester-panel-icon blue">👤</span><div><h2>Personal Information</h2><p>Update your basic information</p></div><button className="tester-edit-button" type="button" onClick={() => setEditing((value) => !value)}>{editing ? "Cancel" : "✎ Edit"}</button></div>
                <form className="tester-profile-form" onSubmit={save}>
                  <div className="tester-info-illustration" aria-hidden="true"><div className="tester-id-card">🪪<span /><span /><b>✓</b></div></div>
                  <div className="tester-profile-fields">
                    <label><span>Full Name</span><input required minLength={2} value={displayName} readOnly={!editing} onChange={(e) => setDisplayName(e.target.value)} /></label>
                    <label><span>Email Address</span><strong className="tester-readonly-value">{email || "Connect account to view"} <i className={verified ? "verified" : ""}>{verified ? "✓" : "•"}</i></strong></label>
                    <label><span>Phone Number</span><input type="tel" dir="ltr" value={phone} readOnly={!editing} placeholder="Add a phone number" onChange={(e) => setPhone(e.target.value)} /></label>
                    <label className="tester-bio-field"><span>Short Bio</span><textarea rows={2} maxLength={300} value={bio} readOnly={!editing} placeholder="Tell the community about yourself" onChange={(e) => setBio(e.target.value)} /></label>
                  </div>
                  {editing && <button className="tester-save-button" type="submit" disabled={busy}>{busy ? "Saving..." : "Save changes"}</button>}
                </form>
              </section>

              <section className="tester-panel tester-device-panel"><div className="tester-device-art" aria-hidden="true">📱<span>⚙️</span></div><div className="tester-device-copy"><h2>Tester Information</h2><p>Your testing details</p><div><span>Device Type</span><strong>Android Phone</strong></div><div><span>Android Version</span><strong>Android device</strong></div><div><span>Interests</span><strong className="tester-tags"><i>Productivity</i><i>Health</i><i>Games</i><i>+1</i></strong></div></div></section>

              <section className="tester-panel tester-verification-panel"><span className="tester-big-shield">🛡️</span><div className="tester-verification-copy"><h2>Account Verification</h2><p>Your account security status</p><span>✓ &nbsp; Email address {verified ? "verified" : "verification pending"}</span><span>✓ &nbsp; Keep your profile information up to date</span></div><div className={`tester-verification-status ${verified ? "verified" : ""}`}><strong>✓</strong><span><b>{verified ? "Verified" : "In progress"}</b><small>{verified ? "All good!" : "Check your email"}</small></span></div></section>

              <section className="tester-account-actions"><span className="tester-logout-icon">🚪</span><div><h2>Account Actions</h2><p>Manage your account actions</p></div><button type="button" onClick={() => void logout()}>🚪 Log Out</button><button type="button" className="danger" onClick={() => setMessage("To close your account, contact TestDZ support.")}>🗑️ Close Account</button></section>
            </div>

            <div className="tester-profile-right">
              <section className="tester-panel tester-setting-panel"><div className="tester-setting-art security">🔐</div><div className="tester-setting-content"><div className="tester-panel-heading compact"><span>🔒</span><div><h2>Security Settings</h2><p>Keep your account secure</p></div></div><Link to="/reset-password" className="tester-setting-row"><span>🔑</span><span>Change Password</span><b>›</b></Link><div className="tester-setting-row"><span>🛡️</span><span>Two-Factor Authentication <em>Not configured</em></span><Toggle label="Two-factor authentication" defaultOn={false} /></div></div></section>

              <section className="tester-panel tester-setting-panel"><div className="tester-setting-art language">🌐</div><div className="tester-setting-content"><div className="tester-panel-heading compact"><span>🌐</span><div><h2>Language &amp; Preferences</h2><p>Choose your preferred settings</p></div></div><div className="tester-setting-row tester-choice-row"><span>Language</span><div className="tester-choice-group">{["English", "العربية", "Français"].map((item) => <button type="button" key={item} className={language === item ? "selected" : ""} onClick={() => setLanguage(item)}>{item}</button>)}</div></div><div className="tester-setting-row tester-choice-row"><span>Theme</span><div className="tester-choice-group">{["☀ Light", "☾ Dark"].map((item) => <button type="button" key={item} className={theme === item.replace(/^☀ |^☾ /, "") ? "selected" : ""} onClick={() => setTheme(item.replace(/^☀ |^☾ /, ""))}>{item}</button>)}</div></div></div></section>

              <section className="tester-panel tester-setting-panel"><div className="tester-setting-art notifications">🔔<i>1</i></div><div className="tester-setting-content"><div className="tester-panel-heading compact"><span>🔔</span><div><h2>Notification Preferences</h2><p>Control what notifications you receive</p></div></div><div className="tester-setting-row"><span>📧</span><span>Email Notifications</span><Toggle label="Email notifications" /></div><div className="tester-setting-row"><span>📲</span><span>Push Notifications</span><Toggle label="Push notifications" /></div></div></section>
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}
