import { useEffect, useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import { supabase } from "../../../lib/supabase";
import { useIdentity } from "../../../shared/auth/hooks/useIdentity";
import TesterSidebar from "../components/TesterSidebar";
import "../styles/withdrawal-request.css";

type Wallet = { earned_points: number; purchased_credits: number };

export default function WithdrawalRequestPage() {
  const { roles = [] } = useIdentity();
  const [name, setName] = useState("Tester");
  const [avatar, setAvatar] = useState("");
  const [workspaceMenuOpen, setWorkspaceMenuOpen] = useState(false);
  const [wallet, setWallet] = useState<Wallet>({ earned_points: 0, purchased_credits: 0 });
  const [method, setMethod] = useState("baridimob");
  const [amount, setAmount] = useState("");
  const [accountName, setAccountName] = useState("");
  const [accountNumber, setAccountNumber] = useState("");
  const [note, setNote] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const isAdmin = roles.includes("admin");
  const isDeveloper = roles.includes("developer");
  const firstName = name.split(/\\s+/)[0] || "Tester";

  useEffect(() => {
    let alive = true;
    async function load() {
      if (!supabase) { if (alive) setLoading(false); return; }
      try {
        const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
        if (sessionError) throw sessionError;
        const user = sessionData.session?.user;
        if (!user) { if (alive) setLoading(false); return; }
        const [profileRes, walletRes] = await Promise.all([
          supabase.from("profiles").select("display_name,avatar_url").eq("id", user.id).maybeSingle(),
          supabase.from("wallets").select("earned_points,purchased_credits").eq("user_id", user.id).maybeSingle()
        ]);
        if (!alive) return;
        setName(profileRes.data?.display_name?.trim() || user.email?.split("@")[0] || "Tester");
        setAvatar(profileRes.data?.avatar_url || "");
        setWallet({
          earned_points: Number(walletRes.data?.earned_points ?? 0),
          purchased_credits: Number(walletRes.data?.purchased_credits ?? 0)
        });
        if (profileRes.error || walletRes.error) setLoadError("Some wallet details could not be loaded.");
      } catch {
        if (alive) setLoadError("We couldn't load your wallet details. Please refresh and try again.");
      } finally {
        if (alive) setLoading(false);
      }
    }
    void load();
    return () => { alive = false; };
  }, []);

  const nav = [
    { label: "Dashboard", icon: "home", href: "/tester-dashboard" },
    { label: "My Tests", icon: "tests", href: "/my-tests" },
    { label: "Feedback History", icon: "star", href: "/feedback-history" },
    { label: "Wallet & Rewards", icon: "wallet", href: "/wallet-rewards" },
    { label: "Profile", icon: "user", href: "/profile" },
    { label: "Help & Support", icon: "bell", href: "/help-support" },
    { label: "Settings", icon: "settings", href: "/settings" },
    ...(isDeveloper || isAdmin ? [{ label: "Discover Apps", icon: "search", href: "/apps" }] : []),
    ...(isDeveloper || isAdmin ? [{ label: "Developer Dashboard", icon: "code", href: "/developer-dashboard" }] : []),
    ...(isAdmin ? [{ label: "Admin", icon: "shield", href: "/admin" }] : [])
  ];

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitted(true);
  }

  if (loading) return <div className="twr-loading"><span className="td-spinner" />Loading withdrawal form…</div>;

  return <div className="td-dashboard twr-page">
    <TesterSidebar nav={nav} name={name} firstName={firstName} avatar={avatar} roles={roles} isAdmin={isAdmin} isDeveloper={isDeveloper} workspaceMenuOpen={workspaceMenuOpen} setWorkspaceMenuOpen={setWorkspaceMenuOpen} previewMode={false} />
    <main className="td-main twr-main">
      <header className="twr-topbar">
        <div><span className="twr-eyebrow">WALLET · PAYOUTS</span><h1>Withdrawal Request <span>💸</span></h1><p>Request a payout of your TestDZ rewards.</p></div>
        <Link to="/wallet-rewards" className="twr-back">← Back to Wallet</Link>
      </header>

      {loadError && <div className="twr-alert twr-alert-warning" role="alert">{loadError}</div>}
      <section className="twr-balance">
        <div className="twr-balance-icon">👛</div>
        <div><span>YOUR AVAILABLE POINTS</span><strong>{wallet.earned_points.toLocaleString()} <small>pts</small></strong><p>Your points balance. The DA conversion rate has not been configured yet.</p></div>
        <span className="twr-balance-spark">✦</span>
      </section>

      <div className="twr-content-grid">
        <form className="twr-form-card" onSubmit={handleSubmit}>
          <div className="twr-card-heading"><span className="twr-heading-icon">🧾</span><div><h2>Request a payout</h2><p>Enter your preferred payment details below.</p></div></div>
          <div className="twr-demo-notice"><span>ℹ️</span><p><strong>Temporary preview</strong>This form is for interface testing only. No real withdrawal request will be sent or saved.</p></div>

          <label className="twr-field-label" htmlFor="twr-amount">Withdrawal amount <span>(DA)</span></label>
          <div className="twr-input-wrap twr-amount-wrap"><input id="twr-amount" type="number" min="1" step="1" required value={amount} onChange={(event) => { setAmount(event.target.value); setSubmitted(false); }} placeholder="e.g. 1000" /><b>DA</b></div>
          <small className="twr-field-hint">The points-to-DA exchange rate and minimum withdrawal are not set yet.</small>

          <label className="twr-field-label" htmlFor="twr-method">Payment method</label>
          <div className="twr-methods">
            <label className={method === "baridimob" ? "twr-method selected" : "twr-method"}><input type="radio" name="method" value="baridimob" checked={method === "baridimob"} onChange={() => { setMethod("baridimob"); setSubmitted(false); }} /><span className="twr-method-logo">📱</span><span><strong>BaridiMob</strong><small>CCP / Postal account</small></span><i>✓</i></label>
            <label className={method === "ccp" ? "twr-method selected" : "twr-method"}><input type="radio" name="method" value="ccp" checked={method === "ccp"} onChange={() => { setMethod("ccp"); setSubmitted(false); }} /><span className="twr-method-logo">🏤</span><span><strong>CCP</strong><small>Postal transfer</small></span><i>✓</i></label>
            <label className={method === "bank" ? "twr-method selected" : "twr-method"}><input type="radio" name="method" value="bank" checked={method === "bank"} onChange={() => { setMethod("bank"); setSubmitted(false); }} /><span className="twr-method-logo">🏦</span><span><strong>Bank Transfer</strong><small>Bank account</small></span><i>✓</i></label>
          </div>

          <label className="twr-field-label" htmlFor="twr-account-name">Account holder name</label>
          <input className="twr-input" id="twr-account-name" required value={accountName} onChange={(event) => { setAccountName(event.target.value); setSubmitted(false); }} placeholder="Full name as registered" />

          <label className="twr-field-label" htmlFor="twr-account-number">{method === "bank" ? "RIB / Account number" : "CCP account / RIP number"}</label>
          <input className="twr-input" id="twr-account-number" required value={accountNumber} onChange={(event) => { setAccountNumber(event.target.value); setSubmitted(false); }} placeholder="Enter your payment account details" />

          <label className="twr-field-label" htmlFor="twr-note">Additional note <span>(optional)</span></label>
          <textarea className="twr-input twr-textarea" id="twr-note" rows={3} value={note} onChange={(event) => { setNote(event.target.value); setSubmitted(false); }} placeholder="Anything we should know?" />

          <button className="twr-submit" type="submit">Preview Withdrawal Request <span>→</span></button>
          {submitted && <div className="twr-alert twr-alert-success" role="status"><strong>✅ Preview created!</strong><span>Your {Number(amount).toLocaleString()} DA {method === "baridimob" ? "BaridiMob" : method === "ccp" ? "CCP" : "bank transfer"} request is only a local preview. It has not been submitted or saved.</span></div>}
          <p className="twr-secure-note">🔒 Your payment details are not stored by this temporary page.</p>
        </form>

        <aside className="twr-side-column">
          <article className="twr-info-card"><div className="twr-info-art">✨</div><span className="twr-eyebrow">HOW IT WORKS</span><h2>Simple and transparent</h2><ol><li><b>01</b><span>Earn points by completing tests.</span></li><li><b>02</b><span>Convert points to DA once the official rate is announced.</span></li><li><b>03</b><span>Choose a payment method and submit a request.</span></li><li><b>04</b><span>Track approval and payout status in your wallet.</span></li></ol></article>
          <article className="twr-info-card twr-help-card"><span className="twr-help-icon">💡</span><h3>Before you continue</h3><p>The official conversion rate, minimum payout, request history and admin approval process will be connected in a later release.</p><Link to="/wallet-rewards">Review my wallet ↗</Link></article>
        </aside>
      </div>
      <footer className="twr-footer">TestDZ · Secure rewards experience <span>💙</span></footer>
    </main>
  </div>;
}
