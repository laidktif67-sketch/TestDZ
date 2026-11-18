import { useCallback, useEffect, useMemo, useState } from "react";
import { getFinancialOperationsPageData, type FinancialLedgerEntry, type FinancialPayment, type FinancialRefund } from "../../../features/admin/admin-api";
import { isTesterWorkflowV2Enabled } from "../../../lib/supabase-v2";
import { useIdentity } from "../../../shared/auth/hooks/useIdentity";
import TesterSidebar from "../../tester/components/TesterSidebar";
import "./financial-operations.css";

type Tab = "payments" | "refunds" | "ledger";
const money = (value: number) => new Intl.NumberFormat(undefined, { style: "currency", currency: "DZD", maximumFractionDigits: 0 }).format(Number(value || 0));
const dateTime = (value: string) => { const date = new Date(value); return Number.isNaN(date.getTime()) ? "—" : date.toLocaleString(); };
const shortId = (value: string | null | undefined) => value ? value.slice(-8).toUpperCase() : "—";
const statusClass = (value: string) => value.toLowerCase().replace(/[^a-z0-9_-]/g, "-");

export default function FinancialOperationsPage() {
  const { roles = [] } = useIdentity();
  const [payments, setPayments] = useState<FinancialPayment[]>([]);
  const [refunds, setRefunds] = useState<FinancialRefund[]>([]);
  const [ledger, setLedger] = useState<FinancialLedgerEntry[]>([]);
  const [tab, setTab] = useState<Tab>("payments");
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [workspaceMenuOpen, setWorkspaceMenuOpen] = useState(false);
  const isAdmin = roles.includes("admin");
  const isDeveloper = roles.includes("developer");

  const load = useCallback(async () => {
    if (!isTesterWorkflowV2Enabled) { setLoading(false); return; }
    setLoading(true);
    setError("");
    try {
      const result = await getFinancialOperationsPageData();
      setPayments((result.payments.data ?? []) as FinancialPayment[]);
      setRefunds((result.refunds.data ?? []) as FinancialRefund[]);
      setLedger((result.ledger.data ?? []) as FinancialLedgerEntry[]);
      const failures = [result.payments.error, result.refunds.error, result.ledger.error].filter(Boolean);
      if (failures.length) setError("Some financial records could not be loaded. Your access remains read-only; refresh to retry.");
    } catch {
      setError("Financial records could not be loaded. Check your connection and try again.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const filteredPayments = useMemo(() => payments.filter(row => [row.status, row.provider, row.currency, row.user_id, row.subscription_id].join(" ").toLowerCase().includes(search.toLowerCase())), [payments, search]);
  const filteredRefunds = useMemo(() => refunds.filter(row => [row.status, row.refund_method, row.reason, row.user_id, row.payment_id, row.approved_by].join(" ").toLowerCase().includes(search.toLowerCase())), [refunds, search]);
  const filteredLedger = useMemo(() => ledger.filter(row => [row.entry_type, row.wallet_type, row.reason, row.user_id, row.reference_type, row.reference_id, row.actor_id].join(" ").toLowerCase().includes(search.toLowerCase())), [ledger, search]);
  const successfulTotal = payments.filter(row => row.status === "succeeded").reduce((sum, row) => sum + Number(row.amount_dzd), 0);
  const pendingPayments = payments.filter(row => row.status === "pending" || row.status === "processing").length;
  const pendingRefunds = refunds.filter(row => row.status === "requested").length;
  const nav = [
    { label: "Financial Operations", icon: "wallet", href: "/financial-operations", active: true },
    ...(isAdmin ? [{ label: "Admin Workspace", icon: "shield", href: "/admin" }] : []),
    { label: "Profile", icon: "user", href: "/profile" },
    { label: "Settings", icon: "settings", href: "/settings" },
  ];

  if (!isTesterWorkflowV2Enabled) return <main className="financial-operations"><h1>Financial operations</h1><p>V2 is not enabled in this environment. No V2 financial records were loaded.</p></main>;

  return <div className="td-dashboard fo-shell">
    <TesterSidebar nav={nav} name="TestDZ Finance" firstName="F" avatar="" roles={roles} isAdmin={isAdmin} isDeveloper={isDeveloper} workspaceMenuOpen={workspaceMenuOpen} setWorkspaceMenuOpen={setWorkspaceMenuOpen} previewMode={false} />
    <main className="fo-main">
      <header className="fo-header"><div><span className="fo-eyebrow">SECURE WORKSPACE · READ ONLY</span><h1>Financial operations</h1><p>Monitor recorded payments, refund requests and wallet ledger activity.</p></div><button type="button" onClick={() => void load()} disabled={loading}>↻ Refresh</button></header>
      {error && <p className="fo-error" role="alert">{error}</p>}
      <section className="fo-stats" aria-label="Financial summary">
        <article><span>Successful payments</span><strong>{money(successfulTotal)}</strong><small>Sum of the latest {payments.length} loaded payment records</small></article>
        <article><span>Payments awaiting processing</span><strong>{pendingPayments}</strong><small>Pending or processing · latest {payments.length}</small></article>
        <article><span>Refund requests</span><strong>{pendingRefunds}</strong><small>Requested · latest {refunds.length}</small></article>
        <article><span>Ledger entries</span><strong>{ledger.length}</strong><small>Latest records loaded · read only</small></article>
      </section>
      <section className="fo-panel">
        <div className="fo-toolbar"><div className="fo-tabs" role="tablist" aria-label="Financial record type">
          <button type="button" role="tab" aria-selected={tab === "payments"} className={tab === "payments" ? "active" : ""} onClick={() => setTab("payments")}>Payments <span>{payments.length}</span></button>
          <button type="button" role="tab" aria-selected={tab === "refunds"} className={tab === "refunds" ? "active" : ""} onClick={() => setTab("refunds")}>Refunds <span>{refunds.length}</span></button>
          <button type="button" role="tab" aria-selected={tab === "ledger"} className={tab === "ledger" ? "active" : ""} onClick={() => setTab("ledger")}>Wallet ledger <span>{ledger.length}</span></button>
        </div><input value={search} onChange={event => setSearch(event.target.value)} aria-label="Search financial records" placeholder="Search status, reference or reason…" /></div>
        {loading ? <div className="fo-empty">Loading financial records…</div> : tab === "payments" ? <div className="fo-table-wrap"><table><thead><tr><th>Created</th><th>Payment</th><th>Account</th><th>Subscription</th><th>Provider</th><th>Amount</th><th>Status</th><th>Verified</th><th>Last updated</th></tr></thead><tbody>{filteredPayments.map(row => <tr key={row.id}><td>{dateTime(row.created_at)}</td><td><code>{shortId(row.id)}</code></td><td><code>{shortId(row.user_id)}</code></td><td><code>{shortId(row.subscription_id)}</code></td><td>{row.provider || "—"}</td><td>{money(row.amount_dzd)}</td><td><span className={"fo-status " + statusClass(row.status)}>{row.status}</span></td><td>{row.verified_at ? dateTime(row.verified_at) : "—"}</td><td>{dateTime(row.updated_at)}</td></tr>)}{!filteredPayments.length && <tr><td colSpan={9} className="fo-empty">No matching payment records.</td></tr>}</tbody></table></div> : tab === "refunds" ? <div className="fo-table-wrap"><table><thead><tr><th>Created</th><th>Refund</th><th>Payment</th><th>Account</th><th>Method</th><th>Amount</th><th>Status</th><th>Approved by</th><th>Last updated</th></tr></thead><tbody>{filteredRefunds.map(row => <tr key={row.id}><td>{dateTime(row.created_at)}</td><td><code>{shortId(row.id)}</code></td><td><code>{shortId(row.payment_id)}</code></td><td><code>{shortId(row.user_id)}</code></td><td>{row.refund_method.replace("_", " ")}</td><td>{money(row.amount_dzd)}</td><td><span className={"fo-status " + statusClass(row.status)}>{row.status}</span></td><td><code>{shortId(row.approved_by)}</code></td><td>{dateTime(row.updated_at)}</td></tr>)}{!filteredRefunds.length && <tr><td colSpan={9} className="fo-empty">No matching refund records.</td></tr>}</tbody></table></div> : <div className="fo-table-wrap"><table><thead><tr><th>Created</th><th>Entry</th><th>Account</th><th>Wallet</th><th>Type</th><th>Amount</th><th>Reference type</th><th>Reference ID</th><th>Reason</th><th>Actor</th></tr></thead><tbody>{filteredLedger.map(row => <tr key={row.id}><td>{dateTime(row.created_at)}</td><td><code>{shortId(row.id)}</code></td><td><code>{shortId(row.user_id)}</code></td><td>{row.wallet_type.replace("_", " ")}</td><td>{row.entry_type}</td><td className={row.amount < 0 ? "negative" : "positive"}>{row.amount > 0 ? "+" : ""}{Number(row.amount).toLocaleString()}</td><td>{row.reference_type || "—"}</td><td><code>{shortId(row.reference_id)}</code></td><td>{row.reason || "—"}</td><td><code>{shortId(row.actor_id)}</code></td></tr>)}{!filteredLedger.length && <tr><td colSpan={10} className="fo-empty">No matching ledger entries.</td></tr>}</tbody></table></div>}
        <footer className="fo-footer">Showing up to 100 most recent rows per record type. This screen does not approve refunds, issue payouts, or change balances.</footer>
      </section>
      <p className="fo-safety"><strong>Financial safety:</strong> This workspace is read-only. Refund approval, payment verification, payout execution and wallet adjustments remain unavailable until their audited backend workflows are implemented and separately tested.</p>
    </main>
  </div>;
}
