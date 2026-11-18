import { useState } from "react";
import { Link } from "react-router-dom";
import { useIdentity } from "../../../shared/auth/hooks/useIdentity";
import TesterSidebar from "../../tester/components/TesterSidebar";
import "./admin-dashboard.css";

const adminLinks = [
  { title: "User directory", description: "Review account status and assigned roles. Role grants are audited and cannot grant Admin.", href: "/admin/users", label: "Account management", icon: "users" },
  { title: "Role requests", description: "Review Developer access requests with a required decision reason.", href: "/admin/role-requests", label: "Access governance", icon: "key" },
  { title: "Developer reviews", description: "Review submitted applications and tests using the existing review workflow.", href: "/admin/developer-reviews", label: "Product operations", icon: "code" },
  { title: "Audit log", description: "Inspect immutable records of privileged administrative actions.", href: "/admin/audit-log", label: "Governance", icon: "file-text" },
  { title: "Fraud reviews", description: "Review risk summaries. This queue remains read-only until a trusted decision workflow is approved.", href: "/admin/fraud-reviews", label: "Trust & safety", icon: "shield-alert" },
  { title: "Cases", description: "View report and dispute queues with role-scoped, read-only case metadata.", href: "/admin/cases", label: "Case oversight", icon: "folder" },
];

const workspaces = [
  { title: "Financial operations", description: "Read-only payments, refund requests and wallet ledger monitoring.", href: "/financial-operations", icon: "wallet", state: "Read only" },
  { title: "Support workspace", description: "Support queue, public replies, ticket status and priority changes with audit reasons.", href: "/support-workspace", icon: "headset", state: "Audited actions" },
  { title: "Developer workspace", description: "Inspect apps, tests and developer feedback using the Developer workspace.", href: "/developer-dashboard", icon: "code", state: "Role workspace" },
  { title: "Tester workspace", description: "Open the tester experience to inspect discovery, assignments and submissions.", href: "/tester-dashboard", icon: "flask", state: "Role workspace" },
];

export default function AdminDashboardPage() {
  const { roles = [] } = useIdentity();
  const [workspaceMenuOpen, setWorkspaceMenuOpen] = useState(false);
  const nav = [
    { label: "Admin overview", icon: "shield", href: "/admin", active: true },
    { label: "User directory", icon: "users", href: "/admin/users" },
    { label: "Role requests", icon: "lock", href: "/admin/role-requests" },
    { label: "Developer reviews", icon: "check", href: "/admin/developer-reviews" },
    { label: "Financial operations", icon: "wallet", href: "/financial-operations" },
    { label: "Support workspace", icon: "headset", href: "/support-workspace" },
    { label: "Audit log", icon: "file", href: "/admin/audit-log" },
    { label: "Fraud reviews", icon: "alert", href: "/admin/fraud-reviews" },
    { label: "Cases", icon: "folder", href: "/admin/cases" },
    { label: "Profile", icon: "user", href: "/profile" },
  ];

  return <div className="td-dashboard ad-shell">
    <TesterSidebar nav={nav} name="TestDZ Administration" firstName="A" avatar="" roles={roles} isAdmin={roles.includes("admin")} isDeveloper={roles.includes("developer")} workspaceMenuOpen={workspaceMenuOpen} setWorkspaceMenuOpen={setWorkspaceMenuOpen} previewMode={false} homeHref="/admin" />
    <main className="ad-main">
      <header className="ad-header">
        <div><span className="ad-eyebrow">TESTDZ · CONTROL CENTER</span><h1>Administration workspace</h1><p>Manage access, review operational queues and move between authorized workspaces.</p></div>
        <span className="ad-role-pill">Administrator</span>
      </header>
      <section className="ad-notice"><strong>Access boundary</strong><p>Admin navigation is not the security boundary. Every data operation remains subject to server-side authorization, database policies and audited RPC checks.</p></section>
      <section className="ad-section">
        <div className="ad-section-title"><div><h2>Administration</h2><p>Privileged oversight and account governance</p></div><span>{adminLinks.length} areas</span></div>
        <div className="ad-card-grid">{adminLinks.map(item => <article className="ad-card" key={item.href}>
          <div className="ad-card-icon" aria-hidden="true">{item.icon === "users" ? "♙" : item.icon === "key" ? "⌘" : item.icon === "code" ? "</>" : item.icon === "file-text" ? "▤" : item.icon === "shield-alert" ? "◇" : "▦"}</div>
          <span className="ad-card-label">{item.label}</span><h3>{item.title}</h3><p>{item.description}</p><Link to={item.href}>Open workspace <span aria-hidden="true">→</span></Link>
        </article>)}</div>
      </section>
      <section className="ad-section">
        <div className="ad-section-title"><div><h2>Other role workspaces</h2><p>Administrator access can inspect these separate workspaces</p></div><span>{workspaces.length} workspaces</span></div>
        <div className="ad-workspace-list">{workspaces.map(item => <Link className="ad-workspace-row" to={item.href} key={item.href}>
          <span className="ad-workspace-icon" aria-hidden="true">{item.icon === "wallet" ? "◫" : item.icon === "headset" ? "◉" : item.icon === "code" ? "</>" : "✓"}</span>
          <span className="ad-workspace-copy"><strong>{item.title}</strong><small>{item.description}</small></span>
          <span className="ad-workspace-state">{item.state}</span><span className="ad-workspace-arrow" aria-hidden="true">→</span>
        </Link>)}</div>
      </section>
      <footer className="ad-footer">Restricted operations such as refund execution, payouts, fraud decisions and report/dispute resolution remain disabled until their backend contracts and approval rules are complete.</footer>
    </main>
  </div>;
}
