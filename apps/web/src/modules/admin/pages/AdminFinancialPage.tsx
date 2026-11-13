import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import "../styles/admin-dashboard.css";
import "../styles/admin-financial.css";

type Payment = { name: string; plan: string; amount: string; status: "Successful" | "Failed"; date: string };
type Withdrawal = { name: string; amount: string; method: string; status: "Completed" | "Pending" | "Rejected"; date: string };

const payments: Payment[] = [
  { name: "Ahmed Benali", plan: "Pro Plan", amount: "$49.00", status: "Successful", date: "Nov 21, 2026" },
  { name: "Karim Ait Ahmed", plan: "Pro Plan", amount: "$49.00", status: "Successful", date: "Nov 20, 2026" },
  { name: "Yacine Hadjout", plan: "Basic Plan", amount: "$19.00", status: "Failed", date: "Nov 19, 2026" },
  { name: "Mohamed Tarek", plan: "Pro Plan", amount: "$49.00", status: "Successful", date: "Nov 18, 2026" },
  { name: "Nour Chenouf", plan: "Enterprise", amount: "$99.00", status: "Successful", date: "Nov 17, 2026" },
];
const withdrawals: Withdrawal[] = [
  { name: "Sara Belkacem", amount: "$50.00", method: "PayPal", status: "Completed", date: "Nov 21, 2026" },
  { name: "Amine Tabti", amount: "$30.00", method: "Bank Transfer", status: "Pending", date: "Nov 20, 2026" },
  { name: "Rami Bensalem", amount: "$40.00", method: "PayPal", status: "Completed", date: "Nov 19, 2026" },
  { name: "Karim Saidi", amount: "$25.00", method: "Crypto", status: "Rejected", date: "Nov 18, 2026" },
  { name: "Nadia Khelifi", amount: "$60.00", method: "PayPal", status: "Completed", date: "Nov 17, 2026" },
];
const nav = [
  ["Overview", "⌂", "/admin"], ["Users", "♙", "/admin/users"], ["Developers", "⌘", "/admin/developers"],
  ["Testers", "♧", "/admin/testers"], ["Tests", "▤", "/admin/tests"], ["Assignments", "☷", "/admin/assignments"],
  ["Financial", "▣", "/admin/financial"], ["Support Center", "◉", "/admin/support"],
  ["Audit Trail", "◷", "/admin/audit-trail"], ["Settings", "⚙", "/admin/settings"],
] as const;

function Icon({ children }: { children: string }) {
  return <span className="fin-icon" aria-hidden="true">{children}</span>;
}
function Status({ value }: { value: string }) {
  return <span className={"fin-status " + value.toLowerCase()}><i />{value}</span>;
}
function TrendChart() {
  return <svg className="fin-chart" viewBox="0 0 620 190" preserveAspectRatio="none" role="img" aria-label="Illustrative successful and failed developer payments trend">
    <g stroke="#e9eef7" strokeWidth="1"><path d="M38 22H610M38 63H610M38 104H610M38 145H610" /></g>
    <g fill="#7d8ba5" fontSize="10"><text x="5" y="25">3k</text><text x="5" y="66">2k</text><text x="5" y="107">1k</text><text x="17" y="148">0</text></g>
    <path d="M38 122 C75 116 95 81 140 84 S200 91 245 63 S310 58 350 60 S410 92 455 78 S520 83 560 93 S590 102 610 107" fill="none" stroke="#1766df" strokeWidth="3.5" strokeLinecap="round" />
    <path d="M38 145 C120 145 170 144 245 144 S330 142 390 144 S510 143 610 144" fill="none" stroke="#e65b72" strokeWidth="2.5" strokeLinecap="round" />
    {[38,140,245,350,455,560,610].map((x,i)=><circle key={x} cx={x} cy={[122,84,63,60,78,93,107][i]} r="3.5" fill="#fff" stroke="#1766df" strokeWidth="2"/>)}
    <g fill="#7d8ba5" fontSize="10"><text x="40" y="170">Nov 6</text><text x="145" y="170">Nov 9</text><text x="245" y="170">Nov 12</text><text x="345" y="170">Nov 15</text><text x="450" y="170">Nov 18</text><text x="560" y="170">Nov 21</text></g>
  </svg>;
}
export default function AdminFinancialPage() {
  const [tab, setTab] = useState<"payments" | "withdrawals">("payments");
  const [period, setPeriod] = useState("Last 30 Days");
  const [query, setQuery] = useState("");
  const [notice, setNotice] = useState("");
  const filteredPayments = useMemo(() => payments.filter((p) => [p.name,p.plan,p.status,p.amount].some(v=>v.toLowerCase().includes(query.toLowerCase()))), [query]);
  const filteredWithdrawals = useMemo(() => withdrawals.filter((w) => [w.name,w.method,w.status,w.amount].some(v=>v.toLowerCase().includes(query.toLowerCase()))), [query]);
  return <main className="admin-dashboard admin-financial-page">
    <aside className="admin-sidebar">
      <Link className="admin-brand" to="/admin"><span className="admin-brand-mark">✓</span><span>TestDZ<small>Build · Test · Improve</small></span></Link>
      <div className="admin-sidebar-label">Workspace</div>
      <nav className="admin-nav" aria-label="Admin navigation">{nav.map(([label,icon,path])=><Link key={path} className={"admin-nav-item "+(path==="/admin/financial"?"active":"")} to={path}><span className="fin-nav-symbol">{icon}</span><span>{label}</span>{path==="/admin/financial"&&<i/>}</Link>)}</nav>
      <div className="admin-sidebar-label fin-system-label">System</div><Link className="admin-nav-item" to="/admin/audit-trail"><Icon>◷</Icon><span>Audit Trail</span></Link>
      <div className="admin-sidebar-footer"><span className="admin-avatar">AD</span><div><strong>Admin</strong><small>Platform administrator</small></div><span className="admin-online"/></div>
    </aside>
    <section className="admin-main">
      <header className="admin-topbar"><label className="admin-search"><span>⌕</span><input aria-label="Search financial records" placeholder="Search financial records, users, or transactions..." value={query} onChange={e=>setQuery(e.target.value)}/></label><div className="admin-top-actions"><button type="button" className="admin-icon-button" aria-label="Notifications">♧<span>3</span></button><button type="button" className="admin-icon-button" aria-label="Messages">✉<span>5</span></button><div className="admin-user-menu"><span className="admin-avatar">AD</span><span>Admin</span></div></div></header>
      <div className="admin-content fin-content">
        <section className="admin-welcome fin-welcome"><div><span className="admin-eyebrow">TESTDZ · ADMIN WORKSPACE</span><h1><Icon>▣</Icon> Financial Management</h1><p>Manage payments, subscriptions and withdrawals</p></div><label className="fin-period">▦ <select aria-label="Reporting period" value={period} onChange={e=>setPeriod(e.target.value)}><option>Last 7 Days</option><option>Last 30 Days</option><option>Last 90 Days</option><option>This Year</option></select></label></section>
        <div className="fin-demo-banner"><strong>DEMO MODE</strong><span>All financial figures and records below are illustrative sample data. No real payments, balances, subscriptions or withdrawals are read or changed.</span></div>
        {notice&&<div className="fin-notice" role="status">{notice}<button type="button" onClick={()=>setNotice("")}>Dismiss</button></div>}
        <section className="fin-overview" aria-label="Financial overview">
          <article><span className="fin-stat-icon blue">▣</span><div><strong>$4,850.00</strong><small>Total Developer Payments</small><b className="positive">↑ +12.5%</b></div><span className="fin-spark blue-spark">⌁</span></article>
          <article><span className="fin-stat-icon green">✓</span><div><strong>$4,320.00</strong><small>Successful Payments</small><b className="positive">↑ +15.3%</b></div><span className="fin-spark green-spark">⌁</span></article>
          <article><span className="fin-stat-icon purple">▣</span><div><strong>$530.00</strong><small>Failed Payments</small><b className="negative">↓ -8.1%</b></div><span className="fin-spark purple-spark">⌁</span></article>
          <article><span className="fin-stat-icon orange">⇧</span><div><strong>$2,120.00</strong><small>Total Withdrawals</small><b className="positive">↑ +20.7%</b></div><span className="fin-spark orange-spark">⌁</span></article>
        </section>
        <div className="fin-tabs" role="tablist" aria-label="Financial sections"><button type="button" role="tab" aria-selected={tab==="payments"} className={tab==="payments"?"active":""} onClick={()=>setTab("payments")}>▣ Developer Payments</button><button type="button" role="tab" aria-selected={tab==="withdrawals"} className={tab==="withdrawals"?"active":""} onClick={()=>setTab("withdrawals")}>♧ Tester Withdrawals</button></div>
        <section className="fin-panels">
          <article className="admin-panel fin-panel">
            <div className="admin-panel-heading"><div><h2><Icon>▣</Icon> Developer Payments</h2><p>Subscriptions, invoices and payments from developers</p></div><button type="button" className="fin-view-all" onClick={()=>setNotice("The full payments ledger will be connected after the financial data model and access policies are verified.")}>View All →</button></div>
            <div className="fin-mini-stats"><div><strong>248</strong><small>Total Payments</small></div><div><strong className="green-text">225</strong><small>Successful</small></div><div><strong className="red-text">23</strong><small>Failed</small></div><div><strong>$4,850</strong><small>Total Amount</small></div></div>
            <div className="fin-chart-heading"><strong>▥ Payments Trend</strong><span><i className="blue-dot"/>Successful <i className="red-dot"/>Failed</span></div><TrendChart/>
            <div className="fin-table-heading"><strong>Recent Developer Payments</strong><button type="button" onClick={()=>setNotice("Full payment history is a future integration; this table contains five sample rows.")}>View All →</button></div>
            <div className="fin-table-wrap"><table className="fin-table"><thead><tr><th>Developer</th><th>Plan</th><th>Amount</th><th>Status</th><th>Date</th><th>Actions</th></tr></thead><tbody>{filteredPayments.map((p,i)=><tr key={p.name}><td><span className="fin-person"><i>{p.name.split(" ").map(x=>x[0]).join("")}</i>{p.name}</span></td><td><span className="fin-plan">{p.plan}</span></td><td>{p.amount}</td><td><Status value={p.status}/></td><td>{p.date}</td><td><button type="button" className="fin-more" aria-label={"More actions for "+p.name} onClick={()=>setNotice("Payment actions are disabled in this UI preview; no payment can be edited or refunded.")}>•••</button></td></tr>)}{filteredPayments.length===0&&<tr><td colSpan={6} className="fin-empty">No sample payments match this search.</td></tr>}</tbody></table></div>
          </article>
          <article className="admin-panel fin-panel">
            <div className="admin-panel-heading"><div><h2><Icon>♧</Icon> Tester Withdrawals</h2><p>Manage withdrawal requests from testers</p></div><button type="button" className="fin-view-all" onClick={()=>setNotice("The full withdrawals queue will be connected after verifying the existing wallet and approval workflows.")}>View All →</button></div>
            <div className="fin-mini-stats"><div><strong>124</strong><small>Total Requests</small></div><div><strong className="green-text">98</strong><small>Completed</small></div><div><strong className="orange-text">14</strong><small>Pending</small></div><div><strong className="red-text">12</strong><small>Rejected</small></div></div>
            <div className="fin-withdraw-summary"><div className="fin-donut"><span><strong>79.0%</strong><small>Completed</small></span></div><div className="fin-status-legend"><p><i className="green-dot"/>Completed <b>98</b></p><p><i className="orange-dot"/>Pending <b>14</b></p><p><i className="red-dot"/>Rejected <b>12</b></p></div><div className="fin-paid"><span>▣</span><small>Total Amount Paid</small><strong>$2,120.00</strong><b>↑ +20.7%</b></div></div>
            <div className="fin-table-heading"><strong>Recent Withdrawal Requests</strong><button type="button" onClick={()=>setNotice("Full withdrawal history is not connected; these are illustrative sample rows.")}>View All →</button></div>
            <div className="fin-table-wrap"><table className="fin-table"><thead><tr><th>Tester</th><th>Amount</th><th>Payment Method</th><th>Status</th><th>Date</th><th>Actions</th></tr></thead><tbody>{filteredWithdrawals.map(w=><tr key={w.name}><td><span className="fin-person"><i>{w.name.split(" ").map(x=>x[0]).join("")}</i>{w.name}</span></td><td>{w.amount}</td><td>{w.method}</td><td><Status value={w.status}/></td><td>{w.date}</td><td><button type="button" className="fin-more" aria-label={"More actions for "+w.name} onClick={()=>setNotice("Withdrawal approval and rejection are intentionally disabled in this preview.")}>•••</button></td></tr>)}{filteredWithdrawals.length===0&&<tr><td colSpan={6} className="fin-empty">No sample withdrawals match this search.</td></tr>}</tbody></table></div>
          </article>
        </section>
        <p className="admin-demo-note">Financial UI preview · Do not use these sample totals for accounting or payment decisions.</p>
      </div>
    </section>
  </main>;
}
