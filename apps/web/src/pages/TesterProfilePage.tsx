import { useEffect, useState } from "react";
import type { FormEvent, ReactNode } from "react";
import imageCompression from "browser-image-compression";
import { Link, useNavigate } from "react-router-dom";
import type { AvatarMimeType } from "@testdz/types";
import { profilesApi } from "../features/profiles/profiles-api";
import { identityApi } from "../features/identity/identity-api";
import { useIdentity } from "../features/identity/hooks/useIdentity";
import TesterSidebar from "../components/TesterSidebar";


type ProfileIconName =
  | "badge-check" | "camera" | "flask" | "star" | "gift" | "user"
  | "id-card" | "check-circle" | "smartphone" | "shield-check" | "log-out"
  | "trash" | "lock" | "key" | "globe" | "bell" | "mail" | "settings";

const profileIconPaths: Record<ProfileIconName, ReactNode> = {
  "badge-check": <><path d="M12 3.2 14.1 4l2.2-.1 1.1 1.9 1.9 1.1-.1 2.2.8 2.1-.8 2.1.1 2.2-1.9 1.1-1.1 1.9-2.2-.1-2.1.8-2.1-.8-2.2.1-1.1-1.9-1.9-1.1.1-2.2-.8-2.1.8-2.1-.1-2.2 1.9-1.1 1.1-1.9 2.2.1z"/><path d="m8.5 12.1 2.2 2.2 4.8-5"/> </>,
  camera: <><path d="M4 7.5h3l1.5-2h7l1.5 2h3A1.5 1.5 0 0 1 21.5 9v9A1.5 1.5 0 0 1 20 19.5H4A1.5 1.5 0 0 1 2.5 18V9A1.5 1.5 0 0 1 4 7.5Z"/><circle cx="12" cy="13" r="3.5"/></>,
  flask: <><path d="M9 3.5h6M10 3.5v6l-5.3 8.2A2 2 0 0 0 6.4 21h11.2a2 2 0 0 0 1.7-3.3L14 9.5v-6"/><path d="M8 15h8"/></>,
  star: <path d="m12 3 2.7 5.5 6.1.9-4.4 4.3 1 6.1-5.4-2.9-5.4 2.9 1-6.1-4.4-4.3 6.1-.9L12 3Z"/>,
  gift: <><rect x="3" y="9" width="18" height="12" rx="2"/><path d="M2.5 9h19M12 9v12M12 9H7.8a2.3 2.3 0 1 1 2.3-2.3V9Zm0 0h4.2a2.3 2.3 0 1 0-2.3-2.3V9Z"/></>,
  user: <><circle cx="12" cy="8" r="3.5"/><path d="M5 20v-1.5a7 7 0 0 1 14 0V20Z"/></>,
  "id-card": <><rect x="2.5" y="5" width="19" height="14" rx="2"/><circle cx="8" cy="11" r="2"/><path d="M5.5 16a3 3 0 0 1 5 0M13.5 10h5M13.5 14h5"/></>,
  "check-circle": <><circle cx="12" cy="12" r="9"/><path d="m8 12 2.5 2.5L16.5 9"/></>,
  smartphone: <><rect x="6" y="2.5" width="12" height="19" rx="2.2"/><path d="M10 5h4M10.5 18.5h3"/></>,
  "shield-check": <><path d="M12 22s8-4 8-11V5l-8-3-8 3v6c0 7 8 11 8 11Z"/><path d="m8.5 12 2.3 2.3 4.8-4.8"/></>,
  "log-out": <><path d="M10 17l5-5-5-5M15 12H3.5"/><path d="M12 3.5h6A2.5 2.5 0 0 1 20.5 6v12a2.5 2.5 0 0 1-2.5 2.5h-6"/></>,
  trash: <><path d="M3.5 6h17M9 6V3.5h6V6M6 6l1 14h10l1-14M10 10v6M14 10v6"/></>,
  lock: <><rect x="4.5" y="10" width="15" height="11" rx="2"/><path d="M8 10V7a4 4 0 0 1 8 0v3M12 14v3"/></>,
  key: <><circle cx="8" cy="15" r="4.5"/><path d="m11.3 11.8 8.2-8.2 2 2-2.2 2.2 1.5 1.5-2 2-1.5-1.5-2.7 2.7"/></>,
  globe: <><circle cx="12" cy="12" r="9"/><path d="M3.5 12h17M12 3a14 14 0 0 1 0 18M12 3a14 14 0 0 0 0 18M5.5 6.5h13M5.5 17.5h13"/></>,
  bell: <><path d="M18 9a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9M10 21h4"/></>,
  mail: <><rect x="2.5" y="4.5" width="19" height="15" rx="2"/><path d="m3.5 6 8.5 7 8.5-7"/></>,
  settings: <><circle cx="12" cy="12" r="3"/><path d="m19.4 15 .1.1 1.1 1.9-2 3.4-2.2-.5a8 8 0 0 1-1.7 1l-.7 2.1h-4l-.7-2.1a8 8 0 0 1-1.7-1l-2.2.5-2-3.4 1.1-1.9a8 8 0 0 1 0-2L3.4 11l2-3.4 2.2.5a8 8 0 0 1 1.7-1L10 5h4l.7 2.1a8 8 0 0 1 1.7 1l2.2-.5 2 3.4-1.1 2a8 8 0 0 1-.1 2Z" transform="translate(0 -1.5) scale(1 .95)"/></>
};

function ProfileIcon({ name, className = "" }: { name: ProfileIconName; className?: string }) {
  return <svg className={`profile-line-icon ${className}`} viewBox="0 0 24 24" width="1em" height="1em" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{profileIconPaths[name]}</svg>;
}

function avatarMimeType(value: string): AvatarMimeType {
  if (value === "image/png" || value === "image/webp") return value;
  return "image/jpeg";
}

function Toggle({ label }: { label: string }) {
  return <button type="button" className="tester-toggle" aria-label={`${label} — not configured`} aria-pressed={false} title="This setting is not available yet" disabled><span /></button>;
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
  const [interests, setInterests] = useState<string[]>([]);
  const [avatarUrl, setAvatarUrl] = useState("");
  const [verified, setVerified] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [editing, setEditing] = useState(false);
  const [savedProfile, setSavedProfile] = useState({ displayName: "", phone: "", bio: "" });

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
      setSavedProfile({ displayName: profile.display_name ?? "", phone: profile.phone ?? "", bio: profile.bio ?? "" });
      setInterests(Array.isArray(profile.interests) ? profile.interests.filter((item): item is string => typeof item === "string") : []);
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
      else {
        setSavedProfile({ displayName: displayName.trim(), phone: phone.trim(), bio: bio.trim() });
        setMessage("Profile updated successfully!");
        setEditing(false);
      }
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
              <div className="tester-large-avatar">{avatarUrl ? <img src={avatarUrl} alt="Profile" /> : <span className="tester-avatar-emoji" aria-label="Profile avatar">👨🏻‍💻</span>}<label className="tester-camera" title="Change profile photo"><ProfileIcon name="camera" /><input type="file" accept="image/jpeg,image/png,image/webp" onChange={(e) => upload(e.target.files?.[0])} /></label></div>
              <div className="tester-summary-copy"><h2>{displayName || "Your Name"} {verified && <span className="tester-verified-badge" title="Verified account"><ProfileIcon name="badge-check" /></span>}</h2><p>Tester ID: <strong>TST-{userId ? userId.replace(/-/g, "").slice(0, 8).toUpperCase() : "PREVIEW"}</strong> <span className="tester-level">⭐ Level 1</span></p><small>{bio || "Passionate about testing and improving apps ✨"}</small></div>
            </div>
            <div className="tester-stat"><span><ProfileIcon name="flask" /></span><strong>—</strong><small>Total Tests</small></div>
            <div className="tester-stat"><span><ProfileIcon name="star" /></span><strong>—</strong><small>Average Rating</small></div>
            <div className="tester-stat"><span><ProfileIcon name="gift" /></span><strong>—</strong><small>Total Points</small></div>
          </section>

          {(message || error) && <div className={`tester-profile-alert ${error ? "is-error" : ""}`} role="status">{error || message}<button type="button" onClick={() => { setMessage(""); setError(""); }} aria-label="Dismiss">×</button></div>}

          <div className="tester-profile-grid">
            <div className="tester-profile-left">
              <section className="tester-panel tester-personal-panel">
                <div className="tester-panel-heading"><span className="tester-panel-icon blue"><ProfileIcon name="user" /></span><div><h2>Personal Information</h2><p>Update your basic information</p></div><button className="tester-edit-button" type="button" onClick={() => {
                  if (editing) {
                    setDisplayName(savedProfile.displayName);
                    setPhone(savedProfile.phone);
                    setBio(savedProfile.bio);
                    setEditing(false);
                  } else {
                    setEditing(true);
                  }
                }}>{editing ? "Cancel" : "✎ Edit"}</button></div>
                <form className="tester-profile-form" onSubmit={save}>
                  <div className="tester-info-illustration" aria-hidden="true"><div className="tester-id-card"><ProfileIcon name="id-card" /><span /><span /><b><ProfileIcon name="check-circle" /></b></div></div>
                  <div className="tester-profile-fields">
                    <label><span>Full Name</span><input required minLength={2} value={displayName} readOnly={!editing} onChange={(e) => setDisplayName(e.target.value)} /></label>
                    <label><span>Email Address</span><strong className="tester-readonly-value">{email || "Connect account to view"} <i className={verified ? "verified" : ""}><ProfileIcon name={verified ? "check-circle" : "bell"} /></i></strong></label>
                    <label><span>Phone Number</span><input type="tel" dir="ltr" value={phone} readOnly={!editing} placeholder="Add a phone number" onChange={(e) => setPhone(e.target.value)} /></label>
                    <label className="tester-bio-field"><span>Short Bio</span><textarea rows={2} maxLength={300} value={bio} readOnly={!editing} placeholder="Tell the community about yourself" onChange={(e) => setBio(e.target.value)} /></label>
                  </div>
                  {editing && <button className="tester-save-button" type="submit" disabled={busy}>{busy ? "Saving..." : "Save changes"}</button>}
                </form>
              </section>

              <section className="tester-panel tester-device-panel"><div className="tester-device-art" aria-hidden="true"><ProfileIcon name="smartphone" /><span><ProfileIcon name="settings" /></span></div><div className="tester-device-copy"><h2>Tester Information</h2><p>Your testing details</p><div><span>Device Type</span><strong>Not collected yet</strong></div><div><span>Android Version</span><strong>Not detected</strong></div><div><span>Interests</span><strong className="tester-tags">{interests.length ? interests.map((interest) => <i key={interest}>{interest}</i>) : <i>Not set</i>}</strong></div></div></section>

              <section className="tester-panel tester-verification-panel"><span className="tester-big-shield"><ProfileIcon name="shield-check" /></span><div className="tester-verification-copy"><h2>Account Verification</h2><p>Your account security status</p><span><ProfileIcon name={verified ? "check-circle" : "bell"} /> Email address {verified ? "verified" : "verification pending"}</span><span><ProfileIcon name="check-circle" /> Keep your profile information up to date</span></div><div className={`tester-verification-status ${verified ? "verified" : ""}`}><strong><ProfileIcon name={verified ? "shield-check" : "bell"} /></strong><span><b>{verified ? "Verified" : "In progress"}</b><small>{verified ? "All good!" : "Check your email"}</small></span></div></section>

              <section className="tester-account-actions"><span className="tester-logout-icon"><ProfileIcon name="log-out" /></span><div><h2>Account Actions</h2><p>Manage your account actions</p></div><button type="button" onClick={() => void logout()}><ProfileIcon name="log-out" /> Log Out</button><button type="button" className="danger" onClick={() => setMessage("To close your account, contact TestDZ support.")}><ProfileIcon name="trash" /> Close Account</button></section>
            </div>

            <div className="tester-profile-right">
              <section className="tester-panel tester-setting-panel"><div className="tester-setting-art security"><ProfileIcon name="shield-check" /></div><div className="tester-setting-content"><div className="tester-panel-heading compact"><span><ProfileIcon name="lock" /></span><div><h2>Security Settings</h2><p>Keep your account secure</p></div></div><Link to="/reset-password" className="tester-setting-row"><span><ProfileIcon name="key" /></span><span>Change Password</span><b>›</b></Link><div className="tester-setting-row"><span><ProfileIcon name="shield-check" /></span><span>Two-Factor Authentication <em>Not configured</em></span><Toggle label="Two-factor authentication" /></div></div></section>

              <section className="tester-panel tester-setting-panel"><div className="tester-setting-art language"><ProfileIcon name="globe" /></div><div className="tester-setting-content"><div className="tester-panel-heading compact"><span><ProfileIcon name="globe" /></span><div><h2>Language &amp; Preferences</h2><p>Choose your preferred settings</p></div></div><div className="tester-setting-row tester-choice-row"><span>Language</span><span className="tester-setting-unavailable">Not available yet</span></div><div className="tester-setting-row tester-choice-row"><span>Theme</span><span className="tester-setting-unavailable">Not available yet</span></div></div></section>

              <section className="tester-panel tester-setting-panel"><div className="tester-setting-art notifications"><ProfileIcon name="bell" /><i>1</i></div><div className="tester-setting-content"><div className="tester-panel-heading compact"><span><ProfileIcon name="bell" /></span><div><h2>Notification Preferences</h2><p>Control what notifications you receive</p></div></div><div className="tester-setting-row"><span><ProfileIcon name="mail" /></span><span>Email Notifications <em>Not configured</em></span><Toggle label="Email notifications" /></div><div className="tester-setting-row"><span><ProfileIcon name="smartphone" /></span><span>Push Notifications <em>Not configured</em></span><Toggle label="Push notifications" /></div></div></section>
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}
