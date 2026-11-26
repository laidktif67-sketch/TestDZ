import { useState } from "react";
import type { FormEvent } from "react";
import { Link } from "react-router-dom";
import { grantAdminRole } from "../../../features/admin/admin-api";
import { isTesterWorkflowV2Enabled } from "../../../lib/supabase-v2";
import "./admin-role-grants.css";

type GrantableRole = "tester" | "developer" | "financial" | "support";
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export default function AdminRoleGrantsPage() {
  const [userId, setUserId] = useState("");
  const [role, setRole] = useState<GrantableRole>("developer");
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const normalizedId = userId.trim();
    const normalizedReason = reason.trim();
    if (!UUID_PATTERN.test(normalizedId)) {
      setError("Enter a valid user UUID.");
      return;
    }
    if (normalizedReason.length < 10 || normalizedReason.length > 1000) {
      setError("The audit reason must contain 10–1000 characters.");
      return;
    }

    setBusy(true);
    setError("");
    setNotice("");
    try {
      const { error: grantError } = await grantAdminRole(normalizedId, role, normalizedReason);
      if (grantError) throw grantError;
      setNotice("The request was processed. If the user did not already hold this role, it was granted and recorded in the audit log.");
      setUserId("");
      setReason("");
    } catch {
      setError("The role could not be granted. Confirm the user exists, the role is allowed, and your Admin access is still valid.");
    } finally {
      setBusy(false);
    }
  }

  if (!isTesterWorkflowV2Enabled) {
    return (
      <main className="admin-role-grants">
        <h1>Grant a role</h1>
        <p>V2 is not enabled in this environment. No V2 role data was changed.</p>
      </main>
    );
  }

  return (
    <main className="admin-role-grants">
      <Link className="admin-role-grants__back" to="/admin">← Back to Admin</Link>
      <header>
        <p className="admin-role-grants__eyebrow">ADMINISTRATION</p>
        <h1>Grant an account role</h1>
        <p>Assign one supported role to an existing account. Every new grant requires a reason and is recorded in the audit log.</p>
      </header>

      {error && <p className="admin-role-grants__alert" role="alert">{error}</p>}
      {notice && <p className="admin-role-grants__notice" role="status">{notice}</p>}

      <form className="admin-role-grants__form" onSubmit={(event) => void submit(event)}>
        <label>
          User ID
          <input
            value={userId}
            onChange={(event) => setUserId(event.target.value)}
            placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
            autoComplete="off"
            spellCheck={false}
            required
          />
          <small>Use the account UUID shown in the Developer access request queue.</small>
        </label>

        <label>
          Role to grant
          <select value={role} onChange={(event) => setRole(event.target.value as GrantableRole)}>
            <option value="tester">Tester</option>
            <option value="developer">Developer</option>
            <option value="financial">Financial</option>
            <option value="support">Support</option>
          </select>
          <small>Admin cannot be granted through this client-facing workflow.</small>
        </label>

        <label>
          Audit reason (required)
          <textarea
            value={reason}
            onChange={(event) => setReason(event.target.value)}
            minLength={10}
            maxLength={1000}
            rows={4}
            placeholder="Explain the operational reason for granting this role."
            required
          />
          <small>{reason.trim().length}/1000 characters · minimum 10</small>
        </label>

        <button type="submit" disabled={busy || !UUID_PATTERN.test(userId.trim()) || reason.trim().length < 10 || reason.trim().length > 1000}>
          {busy ? "Saving…" : "Grant role"}
        </button>
      </form>

      <p className="admin-role-grants__privacy">
        The browser never writes directly to the role table. The Admin RPC checks the actor, rejects self-grants and unsupported roles, and creates an audit event only when a new role is added.
      </p>
    </main>
  );
}
