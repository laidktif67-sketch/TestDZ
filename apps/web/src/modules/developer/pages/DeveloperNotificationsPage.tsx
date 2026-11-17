import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useIdentity } from "../../../shared/auth/hooks/useIdentity";
import {
  getNotificationsCenterPageData,
  markAllTesterNotificationsRead,
  markTesterNotificationRead,
} from "../../../features/notifications/notifications-api";
import { isTesterWorkflowV2Enabled } from "../../../lib/supabase-v2";
import "./developer-notifications.css";

type NotificationRow = {
  id: string;
  type: string;
  title: string;
  body: string;
  data: Record<string, unknown> | null;
  read_at: string | null;
  created_at: string;
};

function formatDate(value: string) {
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? "Unknown date"
    : date.toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });
}

export default function DeveloperNotificationsPage() {
  const { user } = useIdentity();
  const [rows, setRows] = useState<NotificationRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState("");
  const [savingAll, setSavingAll] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  useEffect(() => {
    let active = true;
    async function load() {
      if (!user?.id || !isTesterWorkflowV2Enabled) {
        setLoading(false);
        return;
      }
      setLoading(true);
      setError("");
      const result = await getNotificationsCenterPageData(user.id, "developer");
      if (!active) return;
      if (result.notificationResult.error) {
        setError("We couldn't load your developer notifications. Please refresh and try again.");
      } else {
        setRows((result.notificationResult.data ?? []) as NotificationRow[]);
      }
      setLoading(false);
    }
    void load();
    return () => { active = false; };
  }, [user?.id]);

  const unread = useMemo(() => rows.filter(row => !row.read_at).length, [rows]);

  async function markRead(row: NotificationRow) {
    if (!user?.id || row.read_at || busyId) return;
    setBusyId(row.id);
    setError("");
    setNotice("");
    const readAt = new Date().toISOString();
    const result = await markTesterNotificationRead(user.id, row.id, readAt, "developer");
    setBusyId("");
    if (result.error) {
      setError("This notification could not be marked as read. Please try again.");
      return;
    }
    setRows(current => current.map(item => item.id === row.id ? { ...item, read_at: readAt } : item));
  }

  async function markAllRead() {
    if (!user?.id || unread === 0 || savingAll) return;
    setSavingAll(true);
    setError("");
    setNotice("");
    const readAt = new Date().toISOString();
    const result = await markAllTesterNotificationsRead(user.id, readAt, "developer");
    setSavingAll(false);
    if (result.error) {
      setError("Your notifications could not be updated. Please try again.");
      return;
    }
    setRows(current => current.map(row => row.read_at ? row : { ...row, read_at: readAt }));
    setNotice("All developer notifications are marked as read.");
  }

  if (!isTesterWorkflowV2Enabled) {
    return <main className="dn-page">
      <section className="dn-panel dn-unavailable">
        <span className="dn-eyebrow">DEVELOPER WORKSPACE</span>
        <h1>Developer notifications</h1>
        <p>Role-separated notification feeds are available with the V2 data workflow. This workspace is not showing the legacy shared feed, so tester and developer messages are never mixed here.</p>
        <Link className="dn-back" to="/developer-dashboard">Back to developer dashboard</Link>
      </section>
    </main>;
  }

  return <main className="dn-page">
    <header className="dn-header">
      <div>
        <span className="dn-eyebrow">DEVELOPER WORKSPACE</span>
        <h1>Notifications</h1>
        <p>Updates about your apps, tests, reviews and developer account.</p>
      </div>
      <Link className="dn-back" to="/developer-dashboard">← Dashboard</Link>
    </header>

    <section className="dn-summary" aria-live="polite">
      <div><strong>{unread}</strong><span>Unread developer notifications</span></div>
      <button type="button" onClick={() => void markAllRead()} disabled={!unread || savingAll || loading}>
        {savingAll ? "Saving…" : "Mark all as read"}
      </button>
    </section>

    {(error || notice) && <p className={error ? "dn-message dn-error" : "dn-message"} role={error ? "alert" : "status"}>{error || notice}</p>}

    <section className="dn-panel" aria-label="Developer notifications">
      {loading ? <div className="dn-empty">Loading your notifications…</div> :
        rows.length === 0 ? <div className="dn-empty"><strong>You're all caught up.</strong><span>New developer updates will appear here when an event is generated.</span></div> :
        <ul className="dn-list">{rows.map(row => <li key={row.id} className={row.read_at ? "" : "dn-unread"}>
          <button type="button" className="dn-item" onClick={() => void markRead(row)} disabled={Boolean(busyId)}>
            <span className="dn-indicator" aria-hidden="true"/>
            <span className="dn-copy"><strong>{row.title}</strong><span>{row.body}</span><small>{row.type.replace(/[_-]+/g, " ")} · {formatDate(row.created_at)}</small></span>
            <span className="dn-action">{busyId === row.id ? "Saving…" : row.read_at ? "Read" : "Mark read"}</span>
          </button>
        </li>)}</ul>}
    </section>
  </main>;
}
