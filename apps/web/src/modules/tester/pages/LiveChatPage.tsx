import { Link } from "react-router-dom";
import { useIdentity } from "../../../shared/auth/hooks/useIdentity";
import TesterSidebar, { Icon } from "../components/TesterSidebar";
import "../styles/tester-dashboard.css";
import "../styles/live-chat.css";

export default function LiveChatPage() {
  const { user, roles = [] } = useIdentity();
  const name = user?.user_metadata?.display_name || user?.email?.split("@")[0] || "Tester";
  const firstName = name.split(/[\s._-]+/)[0] || "Tester";
  const isAdmin = roles.includes("admin");
  const isDeveloper = roles.includes("developer");
  const nav = [
    { label: "Dashboard", icon: "home", href: "/tester-dashboard" },
    { label: "My Tests", icon: "tests", href: "/my-tests" },
    { label: "Feedback History", icon: "star", href: "/feedback-history" },
    { label: "Wallet & Rewards", icon: "wallet", href: "/wallet-rewards" },
    { label: "Profile", icon: "user", href: "/profile" },
    { label: "Help & Support", icon: "headset", href: "/help", active: true },
    { label: "Notifications", icon: "bell", href: "/notifications" },
    { label: "Settings", icon: "settings", href: "/settings" },
    ...(isDeveloper ? [{ label: "Developer Dashboard", icon: "code", href: "/developer-dashboard" }] : []),
    ...(isAdmin ? [{ label: "Admin", icon: "shield", href: "/admin" }] : [])
  ];

  return <div className="td-dashboard lc-dashboard">
    <TesterSidebar nav={nav} name={name} firstName={firstName} avatar="" roles={roles} isAdmin={isAdmin} isDeveloper={isDeveloper} workspaceMenuOpen={false} setWorkspaceMenuOpen={() => {}} previewMode={false} />
    <main className="td-main lc-main">
      <header className="td-topbar lc-topbar">
        <label className="td-search lc-search"><Icon name="search" size={20}/><input placeholder="Search in TestDZ..." aria-label="Search in TestDZ"/></label>
        <div className="td-top-actions"><Link to="/notifications" className="td-notification" aria-label="Notifications"><Icon name="bell" size={21}/><span className="lc-notification-count">3</span></Link><span className="td-top-divider"/><Link to="/profile" className="td-profile-short"><span>{firstName.slice(0,2).toUpperCase()}</span><strong>{name}</strong><b>⌄</b></Link></div>
      </header>
      <div className="lc-content">
        <Link to="/support" className="lc-back"><Icon name="arrow-left" size={17}/> Back to Support</Link>
        <section className="lc-hero">
          <div className="lc-hero-icon"><Icon name="message" size={38}/></div>
          <div className="lc-hero-copy"><h1>Live Chat</h1><p>Chat instantly with our support team</p></div>
          <div className="lc-hero-status"><span><i/> Live chat setup pending</span><small>We’re preparing real-time support</small></div>
          <div className="lc-hero-art" aria-hidden="true"><Icon name="headset" size={70}/></div>
        </section>
        <div className="lc-layout">
          <section className="lc-chat-panel">
            <div className="lc-chat-heading"><div className="lc-support-avatar"><Icon name="headset" size={25}/></div><div><strong>TestDZ Support</strong><small>Live Chat</small></div><span className="lc-demo-badge">Not connected</span></div>
            <div className="lc-chat-body">
              <div className="lc-empty-chat-icon"><Icon name="message" size={35}/></div>
              <h2>Live chat is not connected yet</h2>
              <p>This page design is ready, but real-time messaging still needs to be connected to the support service. Your messages will not be sent until that integration is enabled.</p>
              <Link to="/support?new=1" className="lc-primary-link"><Icon name="receipt" size={17}/> Create a Support Ticket</Link>
            </div>
            <form className="lc-composer" onSubmit={e => e.preventDefault()}>
              <button type="button" aria-label="Attachments" disabled title="Available when live chat is connected"><Icon name="paperclip" size={22}/></button>
              <input aria-label="Your message" placeholder="Live chat is not available yet…" disabled/>
              <button type="button" className="lc-emoji" aria-label="Emoji" disabled><Icon name="smile" size={21}/></button>
              <button type="submit" className="lc-send" disabled><Icon name="send" size={17}/> Send</button>
            </form>
          </section>
          <aside className="lc-side">
            <section className="lc-side-card lc-status-card"><h2><Icon name="info" size={19}/> Chat Status</h2><div className="lc-status-line"><span className="lc-status-dot pending"/><strong>Not connected</strong></div><p>Real-time chat will appear here after the messaging service is configured.</p><div className="lc-headset-art"><Icon name="headset" size={58}/></div></section>
            <section className="lc-side-card lc-quick-card"><h2><Icon name="bolt" size={20}/> Quick Actions</h2><Link to="/help"><Icon name="book" size={17}/> View Help Center</Link><Link to="/support?new=1"><Icon name="receipt" size={17}/> Create Support Ticket</Link><Link to="/support"><Icon name="tests" size={17}/> Check My Tickets</Link></section>
            <section className="lc-side-card lc-contact-card"><h2><Icon name="info" size={19}/> Need More Help?</h2><p>Use a support ticket while live chat is being connected.</p><div><Icon name="mail" size={17}/> Support ticket center</div><Link to="/support">Open Support Center <Icon name="arrow" size={15}/></Link></section>
          </aside>
        </div>
        <section className="lc-bottom-banners">
          <article className="lc-banner help"><Icon name="book" size={32}/><div><h3>Help Center</h3><p>Find answers in our Help Center for common questions.</p><Link to="/help">Go to Help Center <Icon name="arrow" size={14}/></Link></div></article>
          <article className="lc-banner live"><Icon name="headset" size={32}/><div><h3>Live Support</h3><p>Real-time chat is being prepared for launch.</p><span className="lc-banner-note">Setup pending</span></div></article>
          <article className="lc-banner report"><Icon name="alert" size={32}/><div><h3>Report a Problem</h3><p>Found a bug or security issue? Let us know.</p><Link to="/report-problem">Report Issue <Icon name="arrow" size={14}/></Link></div></article>
          <article className="lc-banner guides"><Icon name="book" size={32}/><div><h3>Helpful Guides</h3><p>Explore our guides and tutorials.</p><Link to="/help">View Guides <Icon name="arrow" size={14}/></Link></div></article>
        </section>
      </div>
    </main>
  </div>;
}
