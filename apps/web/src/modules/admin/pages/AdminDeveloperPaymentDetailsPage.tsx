import { Link, useParams } from "react-router-dom";
import "../styles/admin-dashboard.css";
import "../styles/admin-developer-payment-details.css";
import AdminSidebar from "../components/AdminSidebar";

export default function AdminDeveloperPaymentDetailsPage(){
 const {id}=useParams();
 const paymentId=id||"DP-2026-0874";
 const known=paymentId==="DP-2026-0874";
 return <main className="admin-dashboard dpd-page">
  <aside className="admin-sidebar"><Link className="admin-brand" to="/admin"><span className="admin-brand-mark">✓</span><span>TestDZ<small>Build · Test · Improve</small></span></Link><div className="admin-sidebar-label">Workspace</div><AdminSidebar activePath="/admin/developer-payments"/><div className="admin-sidebar-footer"><span className="admin-avatar">AD</span><div><strong>Admin</strong><small>Platform administrator</small></div><span className="admin-online"/></div></aside>
  <section className="admin-main"><header className="admin-topbar"><label className="admin-search">⌕<input aria-label="Search users, email, or ID" placeholder="Search users, email, or ID..."/></label><div className="admin-top-actions"><span>♧　✉</span><span className="admin-avatar">AD</span></div></header>
   <div className="admin-content dpd-content">
    <section className="dpd-banner"><span className="dpd-banner-icon">▣</span><div><h1>Developer Payment Details</h1><p>View payment information and status</p></div><nav><Link to="/admin">⌂</Link><span>/</span><span>Admin</span><span>/</span><Link to="/admin/developer-payments">Developer Payments</Link><span>/</span><b>Payment Details</b></nav></section>
    <div className="dpd-warning">⚠　<strong>PREVIEW DATA — No payout will be sent</strong><span>ⓘ</span></div>
    <section className="admin-panel dpd-summary">
     <div className="dpd-developer"><div className="dpd-avatar">YB<span>✓</span></div><div><small>Developer</small><h2>{known?"Yacine Boudiaf":"Developer Payment"}</h2><b>✉　{known?"yacine.b@testdz.com":"sample.developer@testdz.com"}</b><p>♟　Developer</p><p>▦　E-commerce QA Suite</p><p>♙　Milestone 03 · Final delivery</p></div></div>
     <div className="dpd-identifiers"><div><small>Payment ID</small><strong>{paymentId}</strong><span className="dpd-status">◷　Pending</span></div><div><small>Invoice Number</small><strong>INV-2026-0874 <button type="button" aria-label="Copy invoice number" onClick={()=>{if(navigator.clipboard)void navigator.clipboard.writeText("INV-2026-0874")}}>▢</button></strong></div><div className="dpd-dates"><div><small>▦　Requested Date</small><b>Dec 04, 2026</b><span>14:30</span></div><div><small>▦　Due Date</small><b>Dec 08, 2026</b></div></div></div>
     <div className="dpd-amounts"><h3>♟　Payment Amounts</h3><div><section><small>Gross Amount</small><b>$1,250.00</b></section><section><small>Platform Fee</small><b>$62.50</b></section><section><small>Net Payout</small><b>$1,187.50</b></section></div></div>
    </section>
    <div className="dpd-grid">
     <section className="admin-panel dpd-card dpd-method"><header><h2>▣　Payment Method</h2></header><div className="dpd-method-main"><span>▤</span><div><h3>Bank Transfer</h3><p>Destination Account:</p><b>**** 4821　◉</b></div></div><div className="dpd-unverified">❗　Illustrative data — Not verified</div></section>
     <section className="admin-panel dpd-card dpd-invoice"><header><h2>▤　Invoice Summary</h2></header><div className="dpd-invoice-content"><div className="dpd-invoice-art"><span>◉</span><b>TestDZ</b><i/><i/><i/><i/><i/></div><div className="dpd-invoice-copy"><p>Invoice: <b>INV-2026-0874</b></p><p>Milestone: <b>03 · Final delivery</b></p><p>Description:<br/>Final version of E-commerce QA Suite application.</p><hr/><p className="dpd-invoice-amount">Amount: <b>$1,250.00</b></p><button type="button" onClick={()=>window.print()}>⇩　Download / Print Invoice</button></div></div></section>
     <section className="admin-panel dpd-card dpd-timeline"><header><h2>◷　Payment Timeline</h2></header><div className="dpd-steps"><div className="done"><i>✓</i><span><b>Created</b><small>Dec 04, 2026 · 14:30</small></span><em>Completed</em></div><div className="active"><i>◷</i><span><b>Finance Review</b><small>Dec 04, 2026 · 16:20</small></span><em>Pending</em></div><div><i></i><span><b>Approved</b></span></div><div><i></i><span><b>Paid</b></span></div></div></section>
     <section className="admin-panel dpd-card dpd-history"><header><h2>◴　Decision History</h2></header><div><span className="dpd-info-icon">i</span><p><b>No payout execution or receipt exists yet.</b><small>The payment is still under finance review.</small></p></div></section>
     <section className="admin-panel dpd-card dpd-next"><header><h2>♟　Next Steps</h2></header><ul><li>Verify milestone approval for this payment</li><li>Confirm invoice details and platform fee</li><li>Check verified payout details</li></ul><button type="button" disabled title="Finance actions are not connected in this preview">✓　Mark as Reviewed</button></section>
    </div>
    <div className="dpd-footer"><span>Demo only · No payout, balance, or financial record is changed.</span><Link to="/admin/developer-payments">←　Back to Developer Payments</Link></div>
   </div>
  </section>
 </main>
}