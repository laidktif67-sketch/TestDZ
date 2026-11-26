import { useState } from "react";
import { Link, useLocation } from "react-router-dom";
import TesterSidebar from "../components/TesterSidebar";
import { useIdentity } from "../../../shared/auth/hooks/useIdentity";

const sections: Record<string, { title: string; subtitle: string; icon: string; items: { title: string; description: string; href: string }[] }> = {
  "/feedback-history": {
    title: "Feedback History", subtitle: "Review the feedback you have submitted.", icon: "star",
    items: [{ title: "Your test activity", description: "See your assigned tests and open a test to review its current status.", href: "/my-tests" }]
  },
  "/wallet-rewards": {
    title: "Wallet & Rewards", subtitle: "Your rewards and tester progress in one place.", icon: "wallet",
    items: [{ title: "Tester profile", description: "Review your account details and profile information.", href: "/profile" }, { title: "Available tests", description: "Find testing opportunities and continue earning through participation.", href: "/tester-dashboard" }]
  },
  "/help-support": {
    title: "Help & Support", subtitle: "Find the right place to get help with your TestDZ account.", icon: "bell",
    items: [{ title: "Account and security", description: "Manage your profile or update your password.", href: "/profile" }, { title: "Password help", description: "Open the secure password reset flow.", href: "/reset-password" }]
  },
  "/settings": {
    title: "Settings", subtitle: "Manage your account preferences and security.", icon: "settings",
    items: [{ title: "Profile & preferences", description: "Edit your personal information, language, theme, and notification preferences.", href: "/profile" }, { title: "Password & security", description: "Change your password using the secure reset flow.", href: "/reset-password" }]
  },
  "/admin": {
    title: "Admin", subtitle: "Administrator workspace.", icon: "shield",
    items: [{ title: "Developer review queue", description: "Review submitted apps and tests. Approval and rejection decisions require an audit reason.", href: "/admin/developer-reviews" }, { title: "Role requests", description: "Review Tester and Developer access requests. Every decision requires a reason and is audited.", href: "/admin/role-requests" }]
  }
};

export default function TesterSectionPage() {
  const location = useLocation();
  const { roles = [] } = useIdentity();
  const [workspaceMenuOpen, setWorkspaceMenuOpen] = useState(false);
  const section = sections[location.pathname] ?? sections["/settings"];
  const isAdmin = roles.includes("admin");
  const isDeveloper = roles.includes("developer");
  const nav = [
    { label: "Dashboard", icon: "home", href: "/tester-dashboard" },
    { label: "My Tests", icon: "tests", href: "/my-tests" },
    { label: "Feedback History", icon: "star", href: "/feedback-history", active: location.pathname === "/feedback-history" },
    { label: "Wallet & Rewards", icon: "wallet", href: "/wallet-rewards", active: location.pathname === "/wallet-rewards" },
    { label: "Profile", icon: "user", href: "/profile" },
    { label: "Help & Support", icon: "bell", href: "/help-support", active: location.pathname === "/help-support" },
    { label: "Settings", icon: "settings", href: "/settings", active: location.pathname === "/settings" },
    ...(isDeveloper || isAdmin ? [{ label: "Discover Apps", icon: "search", href: "/apps" }] : []),
    ...(isDeveloper || isAdmin ? [{ label: "Developer Dashboard", icon: "code", href: "/developer-dashboard" }] : []),
    ...(isAdmin ? [{ label: "Admin", icon: "shield", href: "/admin", active: location.pathname === "/admin" }, { label: "Review Queue", icon: "check", href: "/admin/developer-reviews", active: location.pathname === "/admin/developer-reviews" }, { label: "Role Requests", icon: "users", href: "/admin/role-requests", active: location.pathname === "/admin/role-requests" }] : [])
  ];
  return <main className="tester-profile-page">
    <TesterSidebar nav={nav} name="TestDZ Member" firstName="T" avatar="" roles={roles} isAdmin={isAdmin} isDeveloper={isDeveloper} workspaceMenuOpen={workspaceMenuOpen} setWorkspaceMenuOpen={setWorkspaceMenuOpen} previewMode={false} sidebarClassName="tester-sidebar" />
    <section className="tester-profile-main">
      <header className="tester-topbar"><label className="tester-search"><span>⌕</span><input aria-label="Search" placeholder="Search anything..." /></label><div className="tester-top-actions"><strong>TestDZ Workspace</strong></div></header>
      <div className="tester-profile-content">
        <section className="tester-profile-hero"><div><h1>{section.title}</h1><p>{section.subtitle}</p></div><div className="tester-hero-art" aria-hidden="true">✦</div></section>
        <div className="tester-section-cards">{section.items.map((item) => <article className="tester-panel tester-section-card" key={item.title}><div className="tester-panel-heading"><span className="tester-panel-icon blue">✓</span><div><h2>{item.title}</h2><p>{item.description}</p></div></div><Link className="tester-edit-button" to={item.href}>Open <span aria-hidden="true">→</span></Link></article>)}</div>
        <p className="tester-section-note">This section is connected to the available TestDZ workflows. Detailed history, wallet balances, and support-ticket data will appear when their backend features are available.</p>
      </div>
    </section>
  </main>;
}
