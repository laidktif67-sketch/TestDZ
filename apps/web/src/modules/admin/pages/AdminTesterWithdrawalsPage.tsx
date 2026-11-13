import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import "../styles/admin-dashboard.css";
import "../styles/admin-tester-withdrawals.css";

type Withdrawal = {
  id: string; name: string; email: string; amount: number; method: "Bank Transfer" | "PayPal" | "Cryptocurrency";
  date: string; status: "Pending" | "Completed" | "Rejected"; initials: string; note: string;
};

const requests: Withdrawal[] = [
  { id: "WD-2026-1247", name: "Sara Benali", email: "sara.benali@testdz.com", amount: 120, method: "Bank Transfer", date: "Dec 4, 2026 · 14:32", status: "Pending", initials: "SB", note: "Please process my withdrawal. Thank you!" },
  { id: "WD-2026-1246", name: "Mohamed Amine", email: "amine.mohamed@testdz.com", amount: 85, method: "PayPal", date: "Dec 4, 2026 · 13:45", status: "Completed", initials: "MA", note: "Standard withdrawal request." },
  { id: "WD-2026-1245", name: "Fatima Zahra", email: "fatima.zahra@testdz.com", amount: 200, method: "Cryptocurrency", date: "Dec 4, 2026 · 12:20", status: "Completed", initials: "FZ", note: "USDT wallet payout request." },
  { id: "WD-2026-1244", name: "Rami Djaafar", email: "rami.djaafar@testdz.com", amount: 75, method: "PayPal", date: "Dec 4, 2026 · 11:50", status: "Rejected", initials: "RD", note: "Payment details need verification." },
  { id: "WD-2026-1243", name: "Nadia Bensalem", email: "nadia.bensalem@testdz.com", amount: 150, method: "Bank Transfer", date: "Dec 4, 2026 · 10:30", status: "Pending", initials: "NB", note: "Please review my bank details." },
  { id: "WD-2026-1242", name: "Yacine Haddad", email: "yacine.haddad@testdz.com", amount: 60, method: "PayPal", date: "Dec 3, 2026 · 17:05", status: "Pending", initials: "YH", note: "Thank you." },
];

function Icon({ children }: { children: string }) { return <span className="tw-icon" aria-hidden="true">{children}</span>; }
function Status({ value }: { value: Withdrawal["status"] }) { return <span className={"tw-status " + value.toLowerCase()}><i />{value}</span>; }

export default function AdminTesterWithdrawalsPage() {
  const [selectedId, setSelectedId] = useState(requests[0].id);
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("All Statuses");
  const [method, setMethod] = useState("All Methods");
  const [period, setPeriod] = useState("Last 30 Days");
  const [notice, setNotice] = useState("");
  const selected = requests.find((item) => item.id === selectedId) ?? requests[0];
  const filtered = useMemo(() => requests.filter((item) =>
    [item.name, item.email, item.id, item.method].some((value) => value.toLowerCase().includes(query.toLowerCase())) &&
    (status === "All Statuses" || item.status === status) &&
    (method === "All Methods" || item.method === method)
  ), [query, status, method]);

  return <main className="admin-dashboard admin-tester-withdrawals">
    <aside className="admin-sidebar">
      <Link className="admin-brand" to="/admin"><span className="admin-brand-mark">✓</span><span>TestDZ<small>Build · Test · Improve</small></span></Link>
      <div className="admin-sidebar-label">Workspace</div>
      <nav className="admin-nav" aria-label="Admin navigation">
        {[["Overview","⌂","/admin"],["Users","♙","/admin/users"],["Developers","⌘","/admin/developers"],["Testers","♧","/admin/testers"],["Tests","▤","/admin/tests"],["Apps Management","▦","/admin/apps"],["Assignments","☷","/admin/assignments"],["Reports & Reviews","▤","/admin/reports"],["Financial Overview","▣","/admin/financial"],["Tester Withdrawals","↧","/admin/tester-withdrawals"],["Transactions Ledger","▤","/admin/transactions-ledger"],["Leaderboard","♜","/admin/leaderboard"],["Notifications","♧","/admin/notifications"],["System Monitoring","⌁","/admin/monitoring"],["System Logs","▤","/admin/logs"],["Audit Trail","◷","/admin/audit-trail"],["Settings","⚙","/admin/settings"]].map(([label,icon,path]) =>
          <Link key={path} to={path} className={"admin-nav-item " + (path === "/admin/tester-withdrawals" ? "active" : "")}><span>{icon}</span><span>{label}</span></Link>
        )}
      </nav>
      <div className="admin-sidebar-footer"><span className="admin-avatar">AD</span><div><strong>Admin</strong><small>Platform administrator</small></div><span className="admin-online" /></div>
    </aside>
    <section className="admin-main">
      <header className="admin-topbar"><label className="admin-search"><span>⌕</span><input aria-label="Search withdrawal requests" placeholder="Search users, withdrawal requests, or transaction IDs..." value={query} onChange={(event) => setQuery(event.target.value)} /></label><div className="admin-top-actions"><button type="button" className="admin-icon-button" aria-label="Notifications">♧<span>3</span></button><button type="button" className="admin-icon-button" aria-label="Messages">✉<span>5</span></button><div className="admin-user-menu"><span className="admin-avatar">AD</span><span>Admin</span></div></div></header>
      <div className="admin-content tw-content">
        <section className="admin-welcome tw-welcome"><div><span className="admin-eyebrow">TESTDZ · FINANCIAL OPERATIONS</span><h1><Icon>▣</Icon> Tester Withdrawals Management</h1><p>Manage tester withdrawal requests and track payouts</p></div><div className="tw-toolbar"><select aria-label="Reporting period" value={period} onChange={(event) => setPeriod(event.target.value)}><option>Last 7 Days</option><option>Last 30 Days</option><option>Last 90 Days</option><option>This Year</option></select><button type="button" onClick={() => setNotice("Report export is a preview action. No live financial records are available yet.")}>⇩ Export Report</button></div></section>
        <div className="tw-demo"><strong>DEMO MODE</strong><span>All names, balances, request records and chart values are illustrative. No real wallet, payout or financial record is read or changed.</span></div>
        {notice && <div className="tw-notice" role="status">{notice}<button type="button" onClick={() => setNotice("")}>Dismiss</button></div>}
        <section className="tw-stats">
          <article><span className="tw-stat-icon blue">♟</span><div><strong>1,248</strong><small>Total Testers</small><b>↑ 8.2%</b></div><em>⌁</em></article>
          <article><span className="tw-stat-icon green">▣</span><div><strong>$24,680</strong><small>Total Withdrawals</small><b>↑ 12.5%</b></div><em>⌁</em></article>
          <article><span className="tw-stat-icon purple">◷</span><div><strong>$2,340</strong><small>Pending Requests</small><b>↑ 5.1%</b></div><em>⌁</em></article>
          <article><span className="tw-stat-icon emerald">✓</span><div><strong>$21,420</strong><small>Completed</small><b>↑ 14.7%</b></div><em>⌁</em></article>
        </section>
        <section className="tw-insights">
          <article className="admin-panel tw-trends"><div className="admin-panel-heading"><h2>▥　Withdrawal Trends</h2><span>Completed · Pending · Rejected</span></div><div className="tw-chart"><div className="tw-y-labels"><span>15K</span><span>10K</span><span>5K</span><span>0</span></div><svg viewBox="0 0 600 190" preserveAspectRatio="none" role="img" aria-label="Illustrative withdrawal trends"><g stroke="#e8eef8"><path d="M0 20H600M0 70H600M0 120H600M0 170H600"/></g><path d="M0 125L55 115 110 108 165 96 220 83 275 85 330 72 385 57 440 45 495 50 550 32 600 25" fill="none" stroke="#1767e8" strokeWidth="4"/><path d="M0 145L55 140 110 135 165 130 220 136 275 120 330 118 385 108 440 112 495 102 550 96 600 90" fill="none" stroke="#ed9b31" strokeWidth="3"/><path d="M0 165L55 160 110 158 165 155 220 153 275 151 330 148 385 144 440 142 495 145 550 140 600 138" fill="none" stroke="#e05265" strokeWidth="3"/></svg></div><div className="tw-axis"><span>Nov 7</span><span>Nov 13</span><span>Nov 19</span><span>Nov 25</span><span>Dec 1</span><span>Dec 4</span></div></article>
          <article className="admin-panel tw-methods"><div className="admin-panel-heading"><h2>◔　Withdrawal Methods</h2></div><div className="tw-method-body"><div className="tw-donut"><strong>$24,680</strong><small>Total</small></div><div><p><i className="bank"/>Bank Transfer <b>46.8%</b></p><p><i className="paypal"/>PayPal <b>32.5%</b></p><p><i className="crypto"/>Cryptocurrency <b>20.7%</b></p></div></div></article>
          <article className="admin-panel tw-quick"><div className="admin-panel-heading"><h2>ϟ　Quick Actions</h2></div><div className="tw-quick-grid"><button onClick={() => setNotice("Pending queue opened in this preview. Connect the secure payout service before processing requests.")}>➤ Process Pending (12)</button><button onClick={() => setNotice("Bulk approval is disabled in preview mode.")}>✓ Bulk Approve</button><button onClick={() => setNotice("Request export is a preview action.")}>▤ Export Requests</button><button onClick={() => setNotice("Withdrawal settings are not connected to production configuration.")}>⚙ Configure Settings</button></div></article>
        </section>
        <section className="tw-workspace">
          <article className="admin-panel tw-requests"><div className="admin-panel-heading"><div><h2>▤　Withdrawal Requests <span>(147)</span></h2><p>Review and manage tester payout requests</p></div><button type="button" onClick={() => setNotice("List refreshed from local illustrative sample data.")}>↻ Refresh</button></div>
            <div className="tw-filters"><label>⌕ <input placeholder="Search by user, request ID..." value={query} onChange={(event) => setQuery(event.target.value)} /></label><select value={status} onChange={(event) => setStatus(event.target.value)} aria-label="Filter by status"><option>All Statuses</option><option>Pending</option><option>Completed</option><option>Rejected</option></select><select value={method} onChange={(event) => setMethod(event.target.value)} aria-label="Filter by method"><option>All Methods</option><option>Bank Transfer</option><option>PayPal</option><option>Cryptocurrency</option></select></div>
            <div className="tw-table-wrap"><table><thead><tr><th>#</th><th>Tester</th><th>Amount</th><th>Method</th><th>Request Date</th><th>Status</th><th>Actions</th></tr></thead><tbody>{filtered.map((item,index)=><tr key={item.id} className={selectedId===item.id?"selected":""} onClick={()=>setSelectedId(item.id)}><td>{index+1}</td><td><span className="tw-person"><i>{item.initials}</i><span><b>{item.name}</b><small>{item.email}</small></span></span></td><td><b>${item.amount.toFixed(2)}</b></td><td>{item.method}</td><td>{item.date}</td><td><Status value={item.status}/></td><td><button type="button" aria-label={"View "+item.id} onClick={(event)=>{event.stopPropagation();setSelectedId(item.id);}}>◉</button></td></tr>)}{filtered.length===0&&<tr><td colSpan={7} className="tw-empty">No requests match these filters.</td></tr>}</tbody></table></div>
            <div className="tw-pagination"><span>Showing {filtered.length ? 1 : 0}–{filtered.length} of {filtered.length} sample requests</span><button type="button" onClick={()=>setNotice("Pagination is limited to the sample records in this preview.")}>‹　1　2　3　›</button><select aria-label="Rows per page"><option>10 / page</option><option>25 / page</option><option>50 / page</option></select></div>
          </article>
          <aside className="admin-panel tw-details"><div className="admin-panel-heading"><h2>ⓘ　Request Details</h2><span>Selected</span></div><div className="tw-profile"><span>{selected.initials}</span><div><b>{selected.name}　✓</b><small>{selected.email}</small><em>Tester</em></div></div><dl><div><dt>Request ID</dt><dd>{selected.id}</dd></div><div><dt>Amount</dt><dd>${selected.amount.toFixed(2)}</dd></div><div><dt>Method</dt><dd>{selected.method}</dd></div><div><dt>Request Date</dt><dd>{selected.date}</dd></div><div><dt>Current Status</dt><dd><Status value={selected.status}/></dd></div></dl><div className="tw-note"><b>ⓘ　Notes</b><p>{selected.note}</p></div><div className="tw-decision"><button type="button" onClick={()=>setNotice("Approve is disabled in this UI preview. A future implementation must verify available balance, prevent duplicate payouts and write an audited server-side decision.")}>✓ Approve Request</button><button type="button" onClick={()=>setNotice("Reject is disabled in this UI preview. A future implementation must require a reason and record an audited server-side decision.")}>× Reject Request</button></div></aside>
        </section>
        <p className="admin-demo-note">UI preview only · Approval, rejection, bulk processing and payouts are not connected to a backend.</p>
      </div>
    </section>
  </main>;
}
