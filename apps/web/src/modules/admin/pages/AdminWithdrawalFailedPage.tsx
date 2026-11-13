import { Link, useParams } from "react-router-dom";
import "../styles/admin-dashboard.css";
import "../styles/admin-withdrawal-failed.css";
import AdminSidebar from "../components/AdminSidebar";
import AdminIcon from "../components/AdminIcon";
import AdminPaymentMethodIcon from "../components/AdminPaymentMethodIcon";

export default function AdminWithdrawalFailedPage() {
  const { id } = useParams();
  const requestId = id || "WD-2026-1244";
  const isKnownRejected = requestId === "WD-2026-1244";
  return <main className="admin-dashboard admin-withdrawal-failed">
    <aside className="admin-sidebar">
      <Link className="admin-brand" to="/admin"><span className="admin-brand-mark">✓</span><span>TestDZ<small>Build · Test · Improve</small></span></Link>
      <div className="admin-sidebar-label">Workspace</div>
      <AdminSidebar activePath="/admin/tester-withdrawals" />
      <div className="admin-sidebar-footer"><span className="admin-avatar">AD</span><div><strong>Admin</strong><small>Platform administrator</small></div><span className="admin-online" /></div>
    </aside>
    <section className="admin-main">
      <header className="admin-topbar"><label className="admin-search"><AdminIcon name="search"/><input aria-label="Search users, email, or ID" placeholder="Search users, email, or ID..." /></label><div className="admin-top-actions"><button type="button" className="admin-icon-button" aria-label="Notifications"><AdminIcon name="bell"/><span>3</span></button><button type="button" className="admin-icon-button" aria-label="Messages"><AdminIcon name="mail"/><span>5</span></button><div className="admin-user-menu"><span className="admin-avatar">AD</span><span>Admin</span></div></div></header>
      <div className="admin-content wf-content">
        <section className="admin-welcome wf-banner"><div className="wf-banner-icon">▣</div><div><h1>Withdrawal Rejected / Failed</h1><p>Review unsuccessful withdrawal outcomes</p></div><nav><Link to="/admin">⌂</Link><span>/</span><Link to="/admin/tester-withdrawals">Withdrawals</Link><span>/</span><b>Rejected Request</b></nav></section>
        <div className="wf-alert" role="note"><strong>ⓘ　Preview only — no live payout or account changes</strong><span>!</span></div>
        <section className="admin-panel wf-hero">
          <div className="wf-person"><div className="wf-avatar">RD<span><AdminIcon name="check" size={12}/></span></div><div><h2>Rami Djaafar <span><AdminIcon name="check-circle" size={14}/></span></h2><b className="wf-role"><AdminIcon name="user" size={13}/> Tester</b><p><AdminIcon name="mail" size={13}/> rami.djaafar@testdz.dz</p><p><AdminIcon name="phone" size={13}/> +213 555 123 456</p><p><AdminIcon name="pin" size={13}/> Algeria, Algiers</p><p><AdminIcon name="calendar" size={13}/> Joined: Mar 20, 2026</p></div></div>
          <div className="wf-request-id"><small>Withdrawal Request ID</small><strong>{requestId} <button type="button" aria-label="Copy request ID" onClick={()=>{if(navigator.clipboard) void navigator.clipboard.writeText(requestId);}}>▢</button></strong><div className="wf-metrics"><div><small>Request Amount</small><b>$75.00</b></div><div><small>Method</small><b className="wf-paypal"><AdminPaymentMethodIcon method="PayPal" size={24}/> PayPal</b></div><div><small>Request Date</small><b>▦　Nov 8, 2026<br/>　　14:25</b></div></div></div>
          <div className="wf-outcome"><span>×</span><strong>{isKnownRejected?"Rejected":"Rejected / Failed"}</strong><b>Nov 8, 2026 · 15:10</b></div>
        </section>
        <div className="wf-grid">
          <div className="wf-left">
            <section className="admin-panel wf-card"><header><h2><AdminIcon name="alert" size={16}/> Failure / Rejection Details</h2></header><dl><div><dt>Reason:</dt><dd><b className="wf-reason">Payment details need verification.</b></dd></div><div><dt>Decision Date:</dt><dd><AdminIcon name="calendar" size={13}/> Nov 8, 2026 · 15:10</dd></div><div><dt>Reviewed By:</dt><dd><AdminIcon name="user" size={13}/> Admin</dd></div><div><dt>Note:</dt><dd><span className="wf-note"><AdminIcon name="info" size={13}/> Payout was not completed due to incomplete payment details.</span></dd></div></dl></section>
            <section className="admin-panel wf-card wf-payment"><header><h2>▣　Payment Attempt</h2></header><div className="wf-payment-row"><strong className="wf-paypal"><AdminPaymentMethodIcon method="PayPal" size={24}/> PayPal</strong><div><small>Status</small><b className="wf-not-paid">×　Not Paid</b></div><div><small>Attempt Date</small><b>▦　Nov 8, 2026 · 15:10</b></div></div></section>
          </div>
          <div className="wf-right">
            <section className="admin-panel wf-card wf-timeline"><header><h2><AdminIcon name="clock" size={16}/> Request Timeline</h2></header><div className="wf-steps"><div className="done"><i><AdminIcon name="check" size={10}/></i><div><b>Request Submitted</b><small>Nov 8, 2026 · 14:25</small></div><span>Completed</span></div><div className="done blue"><i><AdminIcon name="check" size={10}/></i><div><b>Under Review</b><small>Nov 8, 2026 · 14:40</small></div><span>Completed</span></div><div className="current"><i><AdminIcon name="close" size={10}/></i><div><b>Rejected</b><small>Nov 8, 2026 · 15:10</small></div><span>Current</span></div><div className="pending"><i><AdminIcon name="clock" size={10}/></i><div><b>Payment Not Sent</b><small>Nov 8, 2026 · 15:10</small></div><span>Pending</span></div></div></section>
            <section className="admin-panel wf-card wf-history"><header><h2><AdminIcon name="clock" size={16}/> Decision History</h2></header><div><b>Nov 8, 2026 · 15:10</b><b><AdminIcon name="user" size={13}/> Admin</b><b>Rejected</b><span>Payment details need verification.</span></div></section>
          </div>
        </div>
        <section className="wf-next"><div><span><AdminIcon name="user-check" size={18}/></span><div><h3>Next Steps</h3><p>The tester can correct their payment details and submit a new withdrawal request.</p></div></div><div className="wf-actions"><Link to="/admin/testers" className="wf-outline"><AdminIcon name="user" size={13}/> View Tester</Link><Link to="/admin/tester-withdrawals" className="wf-outline"><AdminIcon name="arrow-left" size={13}/> Back to Withdrawals</Link><button type="button" disabled title="Reopening a rejected request is not connected in this preview"><AdminIcon name="refresh" size={13}/> Reopen Review</button></div></section>
        <p className="admin-demo-note">Demo UI only · No payout, account balance, or financial record is changed.</p>
      </div>
    </section>
  </main>;
}