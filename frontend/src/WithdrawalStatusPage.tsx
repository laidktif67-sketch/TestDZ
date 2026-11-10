import { Link, useParams } from "react-router-dom";
import "./withdrawal-status.css";

const stages = [
  { title: "Request Submitted", detail: "The request is received by TestDZ." },
  { title: "Under Review", detail: "The administration verifies the request." },
  { title: "Processing", detail: "The approved payout is being processed." },
  { title: "Completed", detail: "The payout is confirmed by the provider." },
];

export default function WithdrawalStatusPage() {
  const { requestId } = useParams();
  return (
    <main className="withdrawal-status-page">
      <aside className="withdrawal-status-sidebar">
        <Link to="/dashboard" className="withdrawal-status-brand"><span>✓</span><b>TestDZ<small>Test · Learn · Earn</small></b></Link>
        <nav aria-label="Tester navigation">
          <Link to="/dashboard">⌂　Dashboard</Link>
          <Link to="/dashboard">⌕　Discover Tests</Link>
          <Link to="/dashboard">▣　My Tests</Link>
          <Link to="/dashboard">♔　Rewards</Link>
          <Link to="/wallet/withdraw" className="active">▰　Wallet</Link>
          <Link to="/profile">♙　Profile</Link>
          <Link to="/dashboard">◉　Help &amp; Support</Link>
          <Link to="/profile">⚙　Settings</Link>
        </nav>
        <div className="withdrawal-status-promo"><span>🏆</span><p>Your feedback helps build a better Android experience!</p>♥</div>
      </aside>
      <section className="withdrawal-status-main">
        <header className="withdrawal-status-topbar"><div>⌕　Search tests...</div><span>♧　　│　　●　 TestDZ Tester</span></header>
        <div className="withdrawal-status-content">
          <Link className="withdrawal-status-back" to="/wallet/withdraw">←　Back to Wallet</Link>
          <section className="withdrawal-status-hero">
            <div className="withdrawal-status-hero-icon">▣</div>
            <div><h1>Withdrawal Details &amp; Status</h1><p>Track the status of your withdrawal request.</p></div>
            <div className="withdrawal-status-hero-art">＄　✓　＄</div>
          </section>
          <div className="withdrawal-status-grid">
            <section className="withdrawal-status-request">
              <div className="withdrawal-status-request-head"><strong>Request #{requestId}</strong><span>Awaiting activation</span></div>
              <div className="withdrawal-status-empty">
                <span>ⓘ</span><h2>Withdrawal tracking is not active yet</h2>
                <p>This request reference is a route identifier only. TestDZ has not created a withdrawal request or reserved points. Your points remain unchanged.</p>
                <Link to="/wallet/withdraw">Return to Wallet</Link>
              </div>
            </section>
            <aside className="withdrawal-status-summary">
              <h2>ⓘ　Request Summary</h2>
              <p>Withdrawal method <b>—</b></p><p>Points amount <b>—</b></p><p>Estimated amount <b>To be configured</b></p><p>Processing time <b>To be configured</b></p>
            </aside>
          </div>
          <section className="withdrawal-status-timeline">
            <h2>◷　Status Timeline</h2>
            <div className="withdrawal-status-stages">{stages.map((stage, index) => <article key={stage.title} className={index === 0 ? "current" : ""}><span>{index + 1}</span><b>{stage.title}</b><small>{stage.detail}</small></article>)}</div>
            <p className="withdrawal-status-note">Timeline stages are the planned workflow. No stage is marked complete until a real request record and audited status transition exist.</p>
          </section>
          <section className="withdrawal-status-history">
            <h2>▤　Recent Withdrawals</h2>
            <div className="withdrawal-status-history-empty">No withdrawal requests are available yet.</div>
          </section>
        </div>
      </section>
    </main>
  );
}
