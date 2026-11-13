import { Link } from "react-router-dom";
import "../styles/admin-sidebar.css";

type AdminSidebarProps = { activePath: string };

const primaryItems = [
  ["Overview", "/admin", "⌂"],
  ["Users", "/admin/users", "♙"],
  ["Developers", "/admin/developers", "⌘"],
  ["Testers", "/admin/testers", "♧"],
  ["Tests", "/admin/tests", "▤"],
  ["Apps Management", "/admin/apps", "▦"],
  ["Assignments", "/admin/assignments", "☷"],
  ["Reports & Reviews", "/admin/reports", "▧"],
  ["Leaderboard", "/admin/leaderboard", "♜"],
  ["Cohorts", "/admin/cohorts", "◫"],
  ["Medical Exceptions", "/admin/medical-exceptions", "♡"],
  ["Support Center", "/admin/support", "✉"],
  ["Notifications", "/admin/notifications", "♢"],
];

const systemItems = [
  ["Analytics", "/admin/analytics", "▥"],
  ["System Monitoring", "/admin/monitoring", "⌁"],
  ["System Logs", "/admin/logs", "◈"],
  ["Audit Trail", "/admin/audit-trail", "◷"],
  ["Settings", "/admin/settings", "⚙"],
];

const financialItems = [
  ["Financial Overview", "/admin/financial"],
  ["Tester Withdrawals", "/admin/tester-withdrawals"],
  ["Rewards Management", "/admin/rewards"],
  ["Transactions Ledger", "/admin/transactions-ledger"],
  ["Developer Payments", "/admin/developer-payments"],
];

export default function AdminSidebar({ activePath }: AdminSidebarProps) {
  return (
    <nav className="admin-nav admin-sidebar-nav" aria-label="Admin navigation">
      <div className="admin-sidebar-section-label">WORKSPACE</div>
      {primaryItems.map(([label, path, icon]) => (
        <Link key={path} to={path} aria-current={(activePath === path || (path !== "/admin" && activePath.startsWith(path + "/"))) ? "page" : undefined}
          className={"admin-nav-item" + ((activePath === path || (path !== "/admin" && activePath.startsWith(path + "/"))) ? " active" : "")}>
          <span className="admin-sidebar-icon" aria-hidden="true">{icon}</span><span>{label}</span>
        </Link>
      ))}
      <div className="admin-sidebar-section-label">FINANCE</div>
      <div className={"admin-sidebar-group" + (financialItems.some(([,path]) => path === activePath) ? " is-active" : "")}>
        <div className="admin-sidebar-group-title"><span className="admin-sidebar-icon">▣</span><span>Financial</span><span className="admin-sidebar-chevron">⌄</span></div>
        {financialItems.map(([label,path]) => (
          <Link key={path} to={path} aria-current={activePath === path ? "page" : undefined}
            className={"admin-sidebar-subitem" + (activePath === path ? " active" : "")}>{label}</Link>
        ))}

      </div>
      <div className="admin-sidebar-section-label">SYSTEM</div>
      {systemItems.map(([label,path,icon]) => (
        <Link key={path} to={path} aria-current={activePath === path ? "page" : undefined}
          className={"admin-nav-item" + (activePath === path ? " active" : "")}>
          <span className="admin-sidebar-icon" aria-hidden="true">{icon}</span><span>{label}</span>
        </Link>
      ))}
    </nav>
  );
}
