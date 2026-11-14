import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "../../../lib/supabase";
import { identityApi } from "../../../features/identity/identity-api";
import {
  getPrivacyPageProfile,
  getPrivacyExportProfile,
  listPrivacyExportAssignments,
  listPrivacyExportCheckins,
  listPrivacyExportFeedback,
  listPrivacyExportNotifications,
  listPrivacyExportLedger,
  listPrivacyActivityAssignments,
  listPrivacyActivityCheckins,
  listPrivacyActivityFeedback,
  listPrivacyActivityLedger
} from "../../../features/testers/privacy-data-api";
import { useIdentity } from "../../../features/identity/hooks/useIdentity";
import TesterSidebar, { Icon } from "../components/TesterSidebar";
import "../styles/tester-dashboard.css";
import "../styles/privacy-data-management.css";

type PrivacyPreferences = {
  shareActivity: boolean;
  personalizedAds: boolean;
  analytics: boolean;
};
type ExportRequest = { id: string; type: string; createdAt: string; status: "Completed" | "Processing" };
const defaultPrivacy: PrivacyPreferences = { shareActivity: true, personalizedAds: false, analytics: true };

function downloadFile(filename: string, content: string, mime: string) {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}
function csvCell(value: unknown) {
  const text = value == null ? "" : String(value);
  return '"' + text.replace(/"/g, '""') + '"';
}
function formatDate(value?: string | null) {
  if (!value) return "—";
  return new Intl.DateTimeFormat("en-US", { month: "short", day: "2-digit", year: "numeric" }).format(new Date(value));
}

export default function PrivacyDataManagementPage() {
  const { user, roles = [] } = useIdentity();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [avatar, setAvatar] = useState("");
  const [memberSince, setMemberSince] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<string | null>(null);
  const [privacy, setPrivacy] = useState<PrivacyPreferences>(defaultPrivacy);
  const [requests, setRequests] = useState<ExportRequest[]>([]);
  const [busy, setBusy] = useState<"data" | "activity" | "privacy" | "">("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [deleteDialog, setDeleteDialog] = useState(false);
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
    { label: "Settings", icon: "settings", href: "/settings" },
    { label: "Privacy", icon: "shield", href: "/tester/privacy", active: true },
    ...(isDeveloper ? [{ label: "Developer", icon: "code", href: "/developer-dashboard" }] : [])
  ];

  useEffect(() => {
    if (!user || !identityApi.isConfigured()) return;
    let alive = true;
    const metadata = user.user_metadata || {};
    const saved = metadata.testdz_privacy_preferences as Partial<PrivacyPreferences> | undefined;
    const history = metadata.testdz_privacy_export_requests as ExportRequest[] | undefined;
    Promise.all([
      getPrivacyPageProfile(user.id)
    ]).then(([profile]) => {
      if (!alive) return;
      setName(profile.data?.display_name || user.email?.split("@")[0] || "Tester");
      setAvatar(profile.data?.avatar_url || "");
      setMemberSince(profile.data?.created_at || user.created_at || null);
      setLastUpdated(profile.data?.updated_at || null);
      setEmail(user.email || "");
      if (saved) setPrivacy({ ...defaultPrivacy, ...saved });
      if (Array.isArray(history)) setRequests(history.slice(0, 8));
    }).catch(() => { if (alive) setError("Account information could not be loaded."); });
    return () => { alive = false; };
  }, [user?.id]);

  const sortedRequests = useMemo(() => [...requests].sort((a,b) => b.createdAt.localeCompare(a.createdAt)), [requests]);

  async function savePrivacy(next: PrivacyPreferences) {
    if (!identityApi.isConfigured() || !user) { setError("Sign in to save your privacy preferences."); return; }
    const previous = privacy;
    setPrivacy(next);
    setBusy("privacy"); setMessage(""); setError("");
    const result = await supabase!.auth.updateUser({ data: { testdz_privacy_preferences: next } });
    setBusy("");
    if (result.error) { setPrivacy(previous); setError("Your privacy preferences could not be saved. Please try again."); }
    else setMessage("Your privacy preferences have been saved.");
  }

  async function recordRequest(type: string, status: ExportRequest["status"]) {
    if (!identityApi.isConfigured() || !user) return;
    const entry: ExportRequest = { id: crypto.randomUUID(), type, createdAt: new Date().toISOString(), status };
    const next = [entry, ...requests].slice(0, 8);
    const result = await supabase!.auth.updateUser({ data: { testdz_privacy_export_requests: next } });
    if (!result.error) setRequests(next);
  }

  async function requestData() {
    if (!identityApi.isConfigured() || !user) return;
    setBusy("data"); setMessage(""); setError("");
    const [profile, assignments, checkins, feedback, notifications, ledger] = await Promise.all([
      getPrivacyExportProfile(user.id),
      listPrivacyExportAssignments(user.id),
      listPrivacyExportCheckins(user.id),
      listPrivacyExportFeedback(user.id),
      listPrivacyExportNotifications(user.id),
      listPrivacyExportLedger(user.id)
    ]);
    const failed = [profile, assignments, checkins, feedback, notifications, ledger].some(result => result.error);
    if (failed) {
      setBusy(""); setError("Some account data could not be retrieved. Check your access and try again."); return;
    }
    const payload = {
      exportedAt: new Date().toISOString(),
      account: { id: user.id, email: user.email, createdAt: user.created_at, lastSignInAt: user.last_sign_in_at },
      profile: profile.data,
      privacyPreferences: privacy,
      assignments: assignments.data,
      checkIns: checkins.data,
      feedback: feedback.data,
      notifications: notifications.data,
      pointsLedger: ledger.data
    };
    downloadFile("testdz-account-data.json", JSON.stringify(payload, null, 2), "application/json");
    await recordRequest("Full Account Data", "Completed");
    setBusy(""); setMessage("Your account data export has been prepared and downloaded.");
  }

  async function exportActivity() {
    if (!identityApi.isConfigured() || !user) return;
    setBusy("activity"); setMessage(""); setError("");
    const [assignments, checkins, feedback, ledger] = await Promise.all([
      listPrivacyActivityAssignments(user.id),
      listPrivacyActivityCheckins(user.id),
      listPrivacyActivityFeedback(user.id),
      listPrivacyActivityLedger(user.id)
    ]);
    if ([assignments, checkins, feedback, ledger].some(result => result.error)) {
      setBusy(""); setError("Activity history could not be exported. Please try again."); return;
    }
    const lines = [
      ["Record Type","Record ID","Related ID","Status / Category","Date","Details"].map(csvCell).join(","),
      ...(assignments.data || []).map(row => ["Assignment",row.id,row.test_id,row.status,row.created_at,row.start_date].map(csvCell).join(",")),
      ...(checkins.data || []).map(row => ["Check-in",row.id,row.assignment_id,"Recorded",row.created_at,row.note].map(csvCell).join(",")),
      ...(feedback.data || []).map(row => ["Feedback",row.id,row.assignment_id,row.quality_status,row.created_at,row.category].map(csvCell).join(",")),
      ...(ledger.data || []).map(row => ["Points",row.id,"",row.wallet_type,row.created_at, row.reason + " (" + row.amount + ")"].map(csvCell).join(","))
    ];
    downloadFile("testdz-activity-history.csv", lines.join("\n"), "text/csv;charset=utf-8");
    await recordRequest("Activity History (CSV)", "Completed");
    setBusy(""); setMessage("Your activity history export has been downloaded as a CSV file.");
  }

  function showDeleteInfo() {
    setDeleteDialog(true);
    setMessage(""); setError("");
  }

  return <div className="td-dashboard pd-dashboard">
    <TesterSidebar nav={nav} name={name || firstName} firstName={firstName} avatar={avatar} roles={roles} isAdmin={isAdmin} isDeveloper={isDeveloper} workspaceMenuOpen={menuOpen} setWorkspaceMenuOpen={setMenuOpen} previewMode={!identityApi.isConfigured()}/>
    <main className="td-main pd-main">
      <header className="pd-topbar">
        <label className="pd-search"><Icon name="search" size={21}/><input placeholder="Search in TestDZ..." aria-label="Search in TestDZ"/></label>
        <div className="pd-user"><Link to="/notifications" aria-label="Open notifications"><Icon name="bell" size={25}/><i>3</i></Link><span/><Link to="/profile"><b>{avatar ? <img src={avatar} alt=""/> : firstName.slice(0,2).toUpperCase()}</b>{name || firstName}<Icon name="chevron" size={16}/></Link></div>
      </header>
      <div className="pd-content">
        <Link to="/settings" className="pd-back"><Icon name="arrow" size={17}/>Back to Settings</Link>
        <section className="pd-hero"><div className="pd-hero-lock"><Icon name="lock" size={53}/></div><div className="pd-hero-copy"><h1>Privacy &amp; Data Management</h1><p>Control your privacy, manage your data and keep your information safe.</p></div><div className="pd-hero-art"><span><Icon name="lock" size={58}/></span><i>✦</i></div></section>
        {(message || error) && <div className={`pd-alert ${error ? "error" : ""}`} role="status">{error || message}<button type="button" onClick={() => {setMessage("");setError("");}}>×</button></div>}
        <div className="pd-grid">
          <div className="pd-left-column">
            <section className="pd-card pd-controls">
              <div className="pd-heading"><span><Icon name="shield" size={29}/></span><div><h2>Privacy Controls</h2><p>Manage who can see your activity and information.</p></div></div>
              <div className="pd-toggle-row"><span className="pd-round-icon"><Icon name="eye" size={25}/></span><div><b>Share Activity with Community</b><small>Allow sharing your participation stats (optional).</small></div><button type="button" role="switch" aria-checked={privacy.shareActivity} aria-label="Share Activity with Community" className={`pd-switch ${privacy.shareActivity ? "on" : ""}`} disabled={busy === "privacy"} onClick={() => void savePrivacy({...privacy,shareActivity:!privacy.shareActivity})}><i/></button></div>
              <div className="pd-toggle-row"><span className="pd-round-icon"><Icon name="megaphone" size={25}/></span><div><b>Personalized Ads</b><small>Allow personalized ads based on your activity.</small></div><button type="button" role="switch" aria-checked={privacy.personalizedAds} aria-label="Personalized Ads" className={`pd-switch ${privacy.personalizedAds ? "on" : ""}`} disabled={busy === "privacy"} onClick={() => void savePrivacy({...privacy,personalizedAds:!privacy.personalizedAds})}><i/></button></div>
              <div className="pd-toggle-row"><span className="pd-round-icon"><Icon name="chart" size={25}/></span><div><b>Analytics Data</b><small>Allow anonymous usage analytics.</small></div><button type="button" role="switch" aria-checked={privacy.analytics} aria-label="Analytics Data" className={`pd-switch ${privacy.analytics ? "on" : ""}`} disabled={busy === "privacy"} onClick={() => void savePrivacy({...privacy,analytics:!privacy.analytics})}><i/></button></div>
            </section>
            <section className="pd-card pd-account">
              <div className="pd-heading"><span><Icon name="info" size={29}/></span><div><h2>Account Information</h2><p>Your personal data and how it's used.</p></div></div>
              <div className="pd-account-details"><div className="pd-avatar">{avatar ? <img src={avatar} alt="Profile"/> : firstName.slice(0,2).toUpperCase()}<i><Icon name="camera" size={16}/></i></div><div className="pd-account-fields"><div><span>Full Name</span><b>{name || "—"}</b></div><div><span>Email Address</span><b>{email || "—"}</b></div><div><span>Member Since</span><b>{formatDate(memberSince)}</b></div><div><span>Last Updated</span><b>{formatDate(lastUpdated)}</b></div></div></div>
              <div className="pd-info-note"><Icon name="info" size={22}/><span>We only collect and use your data to provide and improve TestDZ services. Your privacy is important to us.</span></div>
            </section>
          </div>
          <div className="pd-right-column">
            <section className="pd-card pd-management">
              <div className="pd-heading"><span><Icon name="database" size={30}/></span><div><h2>Data Management</h2><p>Manage your data and control what happens to it.</p></div></div>
              <div className="pd-action-row"><span className="pd-round-icon blue"><Icon name="download" size={29}/></span><div><b>Download My Data</b><small>Get a copy of your account data, activity and achievements.</small></div><button type="button" onClick={() => void requestData()} disabled={busy !== ""}><Icon name="download" size={21}/>{busy === "data" ? "Preparing..." : "Request Data"}</button></div>
              <div className="pd-action-row danger"><span className="pd-round-icon red"><Icon name="trash" size={27}/></span><div><b>Delete My Account</b><small>Permanently delete your account and all data.</small></div><button type="button" onClick={showDeleteInfo}><Icon name="trash" size={20}/>Delete Account</button></div>
              <div className="pd-action-row"><span className="pd-round-icon teal"><Icon name="archive" size={27}/></span><div><b>Export Activity History</b><small>Export your activity history in CSV format.</small></div><button type="button" onClick={() => void exportActivity()} disabled={busy !== ""}><Icon name="file" size={21}/>{busy === "activity" ? "Exporting..." : "Export CSV"}</button></div>
            </section>
            <section className="pd-card pd-history">
              <div className="pd-history-heading"><div className="pd-heading"><span><Icon name="history" size={29}/></span><div><h2>Data Download Requests</h2><p>Track your previous data requests.</p></div></div><span className="pd-view-all">View All <Icon name="arrow" size={17}/></span></div>
              <div className="pd-table-wrap"><table><thead><tr><th>Date</th><th>Type</th><th>Status</th><th>Action</th></tr></thead><tbody>
                {sortedRequests.length ? sortedRequests.map(item => <tr key={item.id}><td>{formatDate(item.createdAt)} · {new Date(item.createdAt).toLocaleTimeString([], {hour:"2-digit",minute:"2-digit"})}</td><td>{item.type}</td><td><span className="pd-status"><Icon name="check" size={13}/>{item.status}</span></td><td>—</td></tr>) : <tr><td colSpan={4} className="pd-empty">No data download requests yet.</td></tr>}
              </tbody></table></div>
            </section>
          </div>
        </div>
        <section className="pd-delete-warning"><span><Icon name="alert" size={29}/></span><div><b>Delete Account Warning</b><small>Deleting your account is permanent and cannot be undone. Please make sure you no longer need your account before proceeding.</small></div><button type="button" onClick={showDeleteInfo}><Icon name="trash" size={20}/>Delete Account</button></section>
      </div>
    </main>
    {deleteDialog && <div className="pd-modal-backdrop" role="presentation" onMouseDown={event => {if(event.target === event.currentTarget) setDeleteDialog(false);}}><section className="pd-delete-dialog" role="dialog" aria-modal="true" aria-labelledby="pd-delete-title"><span><Icon name="lock" size={27}/></span><h2 id="pd-delete-title">Account deletion request</h2><p>Account deletion is permanent. This project does not currently expose a verified, secure account-deletion service, so no data will be deleted from this screen.</p><p>Please contact TestDZ support to submit a deletion request. Your account remains active unless the request is processed through the secure support workflow.</p><div><Link to="/help-support" onClick={() => setDeleteDialog(false)}>Go to Help &amp; Support</Link><button type="button" onClick={() => setDeleteDialog(false)}>Close</button></div></section></div>}
  </div>;
}
