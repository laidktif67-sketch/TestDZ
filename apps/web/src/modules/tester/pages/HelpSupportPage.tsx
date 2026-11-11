import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useIdentity } from "../../../shared/auth/hooks/useIdentity";
import TesterSidebar from "../components/TesterSidebar";
import { Icon } from "../components/TesterSidebar";
import "../styles/tester-dashboard.css";
import "../styles/help-support.css";

type HelpCategory = "account" | "tests" | "rewards" | "security" | "payments";
type HelpItem = { id: string; category: HelpCategory; question: string; answer: string };
const categories: { id: HelpCategory; title: string; question: string; icon: string; tone: string }[] = [
  { id: "account", title: "Account & Profile", question: "How do I manage my account?", icon: "user", tone: "blue" },
  { id: "tests", title: "Tests & Reviews", question: "How do I take a test?", icon: "tests", tone: "violet" },
  { id: "rewards", title: "Rewards & Points", question: "How do I earn points?", icon: "gift", tone: "green" },
  { id: "security", title: "Security & Privacy", question: "How do I secure my account?", icon: "shield", tone: "amber" },
  { id: "payments", title: "Payments & Withdrawals", question: "How do I withdraw rewards?", icon: "wallet", tone: "purple" }
];
const helpItems: HelpItem[] = [
  { id: "profile", category: "account", question: "How can I update my profile?", answer: "Open Profile from the sidebar to review your account information. Keep your details accurate so your tester account can be identified correctly." },
  { id: "email", category: "account", question: "What if I cannot access my account?", answer: "Use the Forgot password link on the sign-in page. If you no longer have access to your email, contact the project support team through the available feedback channel." },
  { id: "join", category: "tests", question: "How do I join a testing opportunity?", answer: "Open Discover Tests, choose an available opportunity, then review its eligibility, instructions and schedule before applying or starting." },
  { id: "feedback", category: "tests", question: "Where can I see submitted feedback?", answer: "Open Feedback History to review the feedback you submitted and its current review status." },
  { id: "points", category: "rewards", question: "When are points credited?", answer: "Points are credited according to the test and feedback review rules. Check Wallet & Rewards and Feedback History for the latest recorded information." },
  { id: "withdraw", category: "payments", question: "Which withdrawal methods are supported?", answer: "The supported withdrawal methods shown in TestDZ are Binance, BaridiMob and PayPal. Availability and processing depend on the withdrawal workflow and its review status." },
  { id: "status", category: "payments", question: "How can I track a withdrawal?", answer: "Open Withdrawal Status to review the request details and any status updates available for your account." },
  { id: "password", category: "security", question: "How can I change my password?", answer: "Use Settings or the secure password reset flow. Never share your password or verification codes with anyone." },
  { id: "privacy", category: "security", question: "How is my account protected?", answer: "Use a unique password, keep your email secure and sign out on shared devices. Only provide information required for the testing task." }
];

export default function HelpSupportPage() {
  const { session, roles = [] } = useIdentity();
  const [name] = useState(session?.user?.email?.split("@")[0] || "Tester");
  const [avatar] = useState("");
  const [menuOpen, setMenuOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState<HelpCategory | "all">("all");
  const [expanded, setExpanded] = useState<string | null>(null);
  const isAdmin = roles.includes("admin");
  const isDeveloper = roles.includes("developer");
  const firstName = name.split(/[\s._-]+/)[0] || "Tester";
  const nav = [
    { label: "Dashboard", icon: "home", href: "/tester-dashboard" },
    { label: "Discover Tests", icon: "search", href: "/discover-tests" },
    { label: "My Tests", icon: "tests", href: "/my-tests" },
    { label: "Feedback History", icon: "star", href: "/feedback-history" },
    { label: "Wallet & Rewards", icon: "wallet", href: "/wallet-rewards" },
    { label: "Profile", icon: "user", href: "/profile" },
    { label: "Help & Support", icon: "headset", href: "/help-support", active: true },
    { label: "Settings", icon: "settings", href: "/settings" },
    ...(isDeveloper ? [{ label: "Developer Dashboard", icon: "code", href: "/developer-dashboard" }] : []),
    ...(isAdmin ? [{ label: "Admin", icon: "shield", href: "/admin" }] : [])
  ];
  const filtered = useMemo(() => {
    const term = query.trim().toLowerCase();
    return helpItems.filter(item => (category === "all" || item.category === category) && (!term || (item.question + " " + item.answer).toLowerCase().includes(term)));
  }, [query, category]);
  const chooseCategory = (value: HelpCategory) => { setCategory(value); setExpanded(null); document.getElementById("hs-faq")?.scrollIntoView({ behavior: "smooth", block: "start" }); };
  return <div className="td-dashboard hs-dashboard">
    <TesterSidebar nav={nav} name={name} firstName={firstName} avatar={avatar} roles={roles} isAdmin={isAdmin} isDeveloper={isDeveloper} workspaceMenuOpen={menuOpen} setWorkspaceMenuOpen={setMenuOpen} previewMode={false}/>
    <main className="td-main hs-main">
      <header className="td-topbar hs-topbar">
        <label className="td-search hs-top-search"><Icon name="search" size={19}/><input value={query} onChange={event => setQuery(event.target.value)} placeholder="Search for help…" aria-label="Search help"/></label>
        <div className="td-top-actions"><Link to="/profile" className="td-notification" aria-label="Notifications"><Icon name="bell" size={21}/></Link><span className="td-top-divider"/><Link to="/profile" className="td-profile-short"><span>{avatar ? <img src={avatar} alt=""/> : firstName.slice(0,2).toUpperCase()}</span><strong>{name}</strong><b>⌄</b></Link></div>
      </header>
      <div className="hs-content">
        <section className="hs-hero">
          <div className="hs-hero-copy">
            <span className="hs-kicker"><Icon name="headset" size={15}/> TESTDZ SUPPORT CENTER</span>
            <h1>Need Help?<br/>We’re <em>Here</em> for You!</h1>
            <p>Find answers, get support, and solve your issues quickly.</p>
            <form className="hs-hero-search" onSubmit={event => { event.preventDefault(); document.getElementById("hs-faq")?.scrollIntoView({ behavior: "smooth", block: "start" }); }}>
              <Icon name="search" size={20}/><input value={query} onChange={event => setQuery(event.target.value)} placeholder="Search in FAQs or type your question…" aria-label="Search frequently asked questions"/><button type="submit">Search</button>
            </form>
          </div>
          <div className="hs-hero-visual" aria-hidden="true"><div className="hs-orbit hs-orbit-a"/><div className="hs-orbit hs-orbit-b"/><div className="hs-bubble"><span/><span/><span/></div><div className="hs-robot"><div className="hs-robot-antenna"/><div className="hs-robot-head"><div className="hs-robot-ear"/><div className="hs-robot-face"><i/><i/><b>⌣</b></div></div><div className="hs-robot-body"><Icon name="check" size={35}/></div><div className="hs-robot-arm"/></div><div className="hs-question-mark">?</div></div>
        </section>
        <section className="hs-quick-section">
          <div className="hs-section-heading"><div><h2><Icon name="bolt" size={23}/> Quick Help</h2><p>Find quick answers to common questions</p></div><button type="button" onClick={() => { setCategory("all"); setQuery(""); document.getElementById("hs-faq")?.scrollIntoView({ behavior: "smooth" }); }}>View All FAQs <Icon name="arrow" size={16}/></button></div>
          <div className="hs-category-grid">{categories.map(item => { const count = helpItems.filter(article => article.category === item.id).length; return <button type="button" key={item.id} className={`hs-category-card ${item.tone} ${category === item.id ? "selected" : ""}`} onClick={() => chooseCategory(item.id)} aria-pressed={category === item.id} aria-label={`${item.title}: show ${count} help articles`}><span className="hs-category-icon"><Icon name={item.icon} size={27}/></span><span className="hs-category-copy"><strong>{item.title}</strong><small>{item.question}</small><span className="hs-category-meta">{count} helpful {count === 1 ? "article" : "articles"}</span></span><span className="hs-category-arrow" aria-hidden="true"><Icon name="arrow" size={17}/></span></button>; })}</div>
        </section>
        <div className="hs-lower-grid">
          <section className="hs-tickets-panel" id="hs-faq">
            <div className="hs-section-heading hs-ticket-heading"><div><h2><Icon name="receipt" size={22}/> Frequently Asked Questions</h2><p>Browse answers from the TestDZ help center</p></div><span className="hs-count">{filtered.length} articles</span></div>
            <div className="hs-faq-tools"><label><Icon name="search" size={17}/><input value={query} onChange={event => setQuery(event.target.value)} placeholder="Search questions…"/></label><button type="button" className={category === "all" ? "active" : ""} onClick={() => { setCategory("all"); setExpanded(null); }}>All topics <span>{helpItems.length}</span></button></div>
            <div className="hs-faq-list">{filtered.length ? filtered.map(item => <article className={expanded === item.id ? "open" : ""} key={item.id}><button type="button" onClick={() => setExpanded(expanded === item.id ? null : item.id)} aria-expanded={expanded === item.id}><span>{item.question}</span><Icon name="chevron" size={18}/></button>{expanded === item.id && <p>{item.answer}</p>}</article>) : <div className="hs-no-results"><Icon name="search" size={25}/><strong>No matching help articles</strong><p>Try a different keyword or select another topic.</p><button type="button" onClick={() => { setQuery(""); setCategory("all"); }}>Clear search</button></div>}</div>
          </section>
          <aside className="hs-side-column">
            <section className="hs-contact-panel"><div className="hs-section-heading"><div><h2><Icon name="send" size={21}/> Contact & Support</h2><p>Choose an available support path</p></div></div><Link to="/submit-feedback" className="hs-contact-row"><span><Icon name="mail" size={20}/></span><div><strong>Send Feedback</strong><small>Share a question or report an issue</small></div><Icon name="arrow" size={17}/></Link><Link to="/feedback-history" className="hs-contact-row"><span><Icon name="receipt" size={20}/></span><div><strong>Feedback History</strong><small>Review your previous submissions</small></div><Icon name="arrow" size={17}/></Link><div className="hs-support-note"><Icon name="info" size={17}/><p>Live chat and phone support are not connected in this version. Use the feedback form to reach the project workflow.</p></div></section>
            <section className="hs-resource-panel"><div><Icon name="book" size={25}/><div><h3>Helpful Resources</h3><p>Explore the main tester tools and guides.</p></div></div><Link to="/my-tests">My Tests <Icon name="arrow" size={15}/></Link><Link to="/wallet-rewards">Wallet & Rewards <Icon name="arrow" size={15}/></Link><Link to="/settings">Account Settings <Icon name="arrow" size={15}/></Link></section>
          </aside>
        </div>
        <section className="hs-bottom-banner"><div className="hs-bottom-support"><span><Icon name="headset" size={35}/></span><div><h3>Need a hand?</h3><p>Send us feedback and include the test or page where you need help.</p><Link to="/submit-feedback">Send a Message <Icon name="arrow" size={15}/></Link></div></div><div className="hs-bottom-report"><span><Icon name="help" size={34}/></span><div><h3>Report a Problem</h3><p>Found a bug or something not working as expected?</p><Link to="/submit-feedback">Report an Issue <Icon name="arrow" size={15}/></Link></div></div></section>
      </div>
    </main>
  </div>;
}
