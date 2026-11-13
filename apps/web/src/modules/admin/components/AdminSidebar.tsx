import { useState, type ReactNode } from "react";
import { Link } from "react-router-dom";
import "../styles/admin-sidebar.css";

type AdminSidebarProps = { activePath: string; locale?: "ar" | "en" };
type SidebarIconName =
  | "layout" | "users" | "code" | "user-check" | "flask" | "grid"
  | "clipboard" | "message-square" | "trophy" | "layers" | "heart-pulse"
  | "life-buoy" | "bell" | "chart" | "activity" | "file-text" | "shield-check"
  | "settings" | "wallet" | "banknote" | "gift" | "receipt" | "credit-card"
  | "chevron-down";

const primaryItems: [string, string, SidebarIconName][] = [
  ["Overview", "/admin", "layout"],
  ["Users", "/admin/users", "users"],
  ["Developers", "/admin/developers", "code"],
  ["Testers", "/admin/testers", "user-check"],
  ["Tests", "/admin/tests", "flask"],
  ["Apps Management", "/admin/apps", "grid"],
  ["Assignments", "/admin/assignments", "clipboard"],
  ["Reports & Reviews", "/admin/reports", "message-square"],
  ["Leaderboard", "/admin/leaderboard", "trophy"],
  ["Cohorts", "/admin/cohorts", "layers"],
  ["Medical Exceptions", "/admin/medical-exceptions", "heart-pulse"],
  ["Support Center", "/admin/support", "life-buoy"],
  ["Notifications", "/admin/notifications", "bell"],
];

const systemItems: [string, string, SidebarIconName][] = [
  ["Analytics", "/admin/analytics", "chart"],
  ["System Monitoring", "/admin/monitoring", "activity"],
  ["System Logs", "/admin/logs", "file-text"],
  ["Audit Trail", "/admin/audit-trail", "shield-check"],
  ["Settings", "/admin/settings", "settings"],
];

const financialItems: [string, string, SidebarIconName][] = [
  ["Financial Overview", "/admin/financial", "wallet"],
  ["Tester Withdrawals", "/admin/tester-withdrawals", "banknote"],
  ["Rewards Management", "/admin/rewards", "gift"],
  ["Transactions Ledger", "/admin/transactions-ledger", "receipt"],
  ["Developer Payments", "/admin/developer-payments", "credit-card"],
];

function SidebarIcon({ name }: { name: SidebarIconName }) {
  const common = {
    width: 18,
    height: 18,
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 1.8,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    "aria-hidden": true as const,
    focusable: false as const,
  };

  const shapes: Record<SidebarIconName, ReactNode> = {
    layout: <><rect x="3" y="3" width="8" height="8" rx="2" /><rect x="13" y="3" width="8" height="5" rx="1.5" /><rect x="13" y="10" width="8" height="11" rx="2" /><rect x="3" y="13" width="8" height="8" rx="2" /></>,
    users: <><path d="M16 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" /><circle cx="10" cy="7" r="4" /><path d="M20 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" /></>,
    code: <><path d="m8 8-4 4 4 4M16 8l4 4-4 4M14 4l-4 16" /></>,
    "user-check": <><path d="M16 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" /><circle cx="10" cy="7" r="4" /><path d="m16 11 2 2 4-4" /></>,
    flask: <><path d="M9 3h6M10 3v6l-5 9a2.4 2.4 0 0 0 2.1 3.6h9.8A2.4 2.4 0 0 0 19 18l-5-9V3" /><path d="M7.5 15h9" /></>,
    grid: <><rect x="3" y="3" width="8" height="8" rx="1.5" /><rect x="13" y="3" width="8" height="8" rx="1.5" /><rect x="3" y="13" width="8" height="8" rx="1.5" /><rect x="13" y="13" width="8" height="8" rx="1.5" /></>,
    clipboard: <><rect x="5" y="5" width="14" height="16" rx="2" /><path d="M9 5.5V4a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v1.5M9 12h6M9 16h6" /></>,
    "message-square": <><path d="M21 11.5a8.4 8.4 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.4 8.4 0 0 1-3.8-.9L3 21l1.9-5.7a8.4 8.4 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.4 8.4 0 0 1 3.8-.9h.5a8.5 8.5 0 0 1 8 8z" /></>,
    trophy: <><path d="M8 21h8M12 17v4M7 4h10v5a5 5 0 0 1-10 0zM7 6H4v2a4 4 0 0 0 4 4M17 6h3v2a4 4 0 0 1-4 4" /></>,
    layers: <><path d="m12 3 9 5-9 5-9-5 9-5zM3 12l9 5 9-5M3 16l9 5 9-5" /></>,
    "heart-pulse": <><path d="M20.8 8.6c0 5.1-8.8 11-8.8 11s-8.8-5.9-8.8-11A4.6 4.6 0 0 1 12 6.1a4.6 4.6 0 0 1 8.8 2.5z" /><path d="M4.5 12h4l2-3 3 6 2-3h4" /></>,
    "life-buoy": <><circle cx="12" cy="12" r="9" /><circle cx="12" cy="12" r="3" /><path d="m5.6 5.6 4.3 4.3M14.1 14.1l4.3 4.3M18.4 5.6l-4.3 4.3M9.9 14.1l-4.3 4.3" /></>,
    bell: <><path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9M10 21h4" /></>,
    chart: <><path d="M3 3v18h18M8 15l4-4 4 3 5-7" /></>,
    activity: <><path d="M22 12h-4l-3 8L9 4l-3 8H2" /></>,
    "file-text": <><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><path d="M14 2v6h6M8 13h8M8 17h8" /></>,
    "shield-check": <><path d="M12 22s8-4 8-11V5l-8-3-8 3v6c0 7 8 11 8 11z" /><path d="m9 12 2 2 4-4" /></>,
    settings: <><circle cx="12" cy="12" r="3" /><path d="m19.4 15 .1.1 1.4 1.1-1.4 2.4-1.7-.6a8 8 0 0 1-1.7 1l-.3 1.8h-2.8l-.3-1.8a8 8 0 0 1-1.7-1l-1.7.6-1.4-2.4 1.4-1.1a7 7 0 0 1 0-2l-1.4-1.1 1.4-2.4 1.7.6a8 8 0 0 1 1.7-1l.3-1.8h2.8l.3 1.8a8 8 0 0 1 1.7 1l1.7-.6 1.4 2.4-1.4 1.1a7 7 0 0 1 0 2z" transform="translate(-1 -1) scale(1.08)" /></>,
    wallet: <><rect x="3" y="5" width="18" height="15" rx="2" /><path d="M3 9h18M16 14h2" /><path d="M6 5V3h12v2" /></>,
    banknote: <><rect x="3" y="5" width="18" height="14" rx="2" /><circle cx="12" cy="12" r="3" /><path d="M7 9h.01M17 15h.01" /></>,
    gift: <><rect x="3" y="8" width="18" height="13" rx="2" /><path d="M12 8v13M3 12h18M12 8H7.5a2.5 2.5 0 1 1 2.5-2.5V8zM12 8h4.5A2.5 2.5 0 1 0 14 5.5V8z" /></>,
    receipt: <><path d="M4 3h16v18l-3-2-3 2-2-2-3 2-5-2z" /><path d="M8 8h8M8 12h8M8 16h4" /></>,
    "credit-card": <><rect x="2" y="5" width="20" height="14" rx="2" /><path d="M2 10h20M6 15h4" /></>,
    "chevron-down": <path d="m6 9 6 6 6-6" />,
  };

  return <svg {...common}>{shapes[name]}</svg>;
}

export default function AdminSidebar({ activePath, locale = "en" }: AdminSidebarProps) {
  const isArabic = locale === "ar";
  const labels: Record<string, string> = { Overview:"نظرة عامة", Users:"المستخدمون", Developers:"المطورون", Testers:"المختبرون", Tests:"الاختبارات", "Apps Management":"إدارة التطبيقات", Assignments:"التكليفات", "Reports & Reviews":"التقارير والمراجعات", Leaderboard:"لوحة المتصدرين", Cohorts:"مجموعات المختبرين", "Medical Exceptions":"الاستثناءات الطبية", "Support Center":"مركز الدعم", Notifications:"الإشعارات", Analytics:"التحليلات", "System Monitoring":"مراقبة النظام", "System Logs":"سجلات النظام", "Audit Trail":"سجل التدقيق", Settings:"الإعدادات", "Financial Overview":"نظرة عامة مالية", "Tester Withdrawals":"سحوبات المختبرين", "Rewards Management":"إدارة المكافآت", "Transactions Ledger":"سجل المعاملات", "Developer Payments":"مدفوعات المطورين", Financial:"الشؤون المالية", WORKSPACE:"مساحة العمل", FINANCE:"المالية", SYSTEM:"النظام", Menu:"القائمة", "Close menu":"إغلاق القائمة", "Open admin navigation":"فتح قائمة الإدارة", "Close admin navigation":"إغلاق قائمة الإدارة", "Admin navigation":"قائمة الإدارة" };
  const labelText = (value: string) => isArabic ? (labels[value] ?? value) : value;
  const [mobileOpen, setMobileOpen] = useState(false);
  const isActive = (path: string) =>
    activePath === path || (path !== "/admin" && activePath.startsWith(path + "/"));

  return (
    <nav className={"admin-nav admin-sidebar-nav" + (mobileOpen ? " is-mobile-open" : "")} aria-label={labelText("Admin navigation")}>
      <button type="button" className="admin-sidebar-mobile-toggle" aria-expanded={mobileOpen} aria-label={labelText(mobileOpen ? "Close admin navigation" : "Open admin navigation")} onClick={() => setMobileOpen(open => !open)}><svg className="admin-sidebar-menu-icon" viewBox="0 0 24 24" aria-hidden="true" focusable="false">{mobileOpen ? <path d="m6 6 12 12M18 6 6 18" /> : <path d="M3 6h18M3 12h18M3 18h18" />}</svg><span>{labelText(mobileOpen ? "Close menu" : "Menu")}</span></button>
      <div className="admin-sidebar-section-label">{labelText("WORKSPACE")}</div>
      {primaryItems.map(([label, path, icon]) => (
        <Link key={path} to={path} aria-current={isActive(path) ? "page" : undefined}
          onClick={() => setMobileOpen(false)} className={"admin-nav-item" + (isActive(path) ? " active" : "")}>
          <span className="admin-sidebar-icon" aria-hidden="true"><SidebarIcon name={icon} /></span>
          <span>{labelText(label)}</span>
        </Link>
      ))}
      <div className="admin-sidebar-section-label">{labelText("FINANCE")}</div>
      <div className={"admin-sidebar-group" + (financialItems.some(([, path]) => path === activePath) ? " is-active" : "")}>
        <div className="admin-sidebar-group-title">
          <span className="admin-sidebar-icon" aria-hidden="true"><SidebarIcon name="wallet" /></span>
          <span>{labelText("Financial")}</span>
          <span className="admin-sidebar-chevron" aria-hidden="true"><SidebarIcon name="chevron-down" /></span>
        </div>
        {financialItems.map(([label, path, icon]) => (
          <Link key={path} to={path} aria-current={activePath === path ? "page" : undefined}
            onClick={() => setMobileOpen(false)} className={"admin-sidebar-subitem" + (activePath === path ? " active" : "")}>
            <span className="admin-sidebar-icon" aria-hidden="true"><SidebarIcon name={icon} /></span>
            <span>{labelText(label)}</span>
          </Link>
        ))}
      </div>
      <div className="admin-sidebar-section-label">{labelText("SYSTEM")}</div>
      {systemItems.map(([label, path, icon]) => (
        <Link key={path} to={path} aria-current={isActive(path) ? "page" : undefined}
          className={"admin-nav-item" + (isActive(path) ? " active" : "")}>
          <span className="admin-sidebar-icon" aria-hidden="true"><SidebarIcon name={icon} /></span>
          <span>{labelText(label)}</span>
        </Link>
      ))}
    </nav>
  );
}
