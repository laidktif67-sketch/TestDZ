import type { ReactNode } from "react";
import { Link, useLocation } from "react-router-dom";
import "./developer-sidebar.css";

type Props = { footer?: ReactNode };

const links = [
  { to: "/developer-dashboard", label: "Dashboard", icon: "home", section: "WORKSPACE" },
  { to: "/apps", label: "My Apps", icon: "apps" },
  { to: "/developer/tests/new", label: "Create Test", icon: "plus" },
  { to: "/developer/tests", label: "My Tests", icon: "tests" },
  { to: "/developer/testers", label: "Testers Management", icon: "users" },
  { to: "/developer/results", label: "Test Results", icon: "results" },
  { to: "/developer/analytics", label: "Analytics", icon: "chart" },
  { to: "/developer/feedback", label: "Feedback", icon: "feedback", section: "ACCOUNT" },
  { to: "/developer/notifications", label: "Notifications", icon: "bell" },
  { to: "/developer/subscription", label: "Subscription", icon: "crown" },
  { to: "/developer/settings", label: "Settings", icon: "settings" },
  { to: "/developer/help", label: "Help & Support", icon: "help" },
  { to: "/developer/support", label: "Support Tickets", icon: "support" },
];

const iconPaths: Record<string, ReactNode> = {
  home: <><path d="m3 10 9-7 9 7"/><path d="M5 9v11h14V9M9 20v-6h6v6"/></>,
  apps: <><rect x="3" y="3" width="8" height="8" rx="2"/><rect x="13" y="3" width="8" height="8" rx="2"/><rect x="3" y="13" width="8" height="8" rx="2"/><rect x="13" y="13" width="8" height="8" rx="2"/></>,
  plus: <><path d="M12 5v14M5 12h14"/></>,
  tests: <><path d="M9 3h6M10 3v5l-5 9a3 3 0 0 0 3 4h8a3 3 0 0 0 3-4l-5-9V3"/><path d="M8 14h8"/></>,
  users: <><circle cx="9" cy="8" r="3"/><path d="M3 20v-2a6 6 0 0 1 12 0v2m1-14a3 3 0 0 1 0 6m2 2a5 5 0 0 1 3 5"/></>,
  results: <><path d="M4 4h16v16H4z"/><path d="m7 12 3 3 7-7"/></>,
  chart: <><path d="M4 20V10M10 20V4M16 20v-7M22 20H2"/></>,
  feedback: <><path d="M4 5h16v12H9l-5 4V5Z"/><path d="M8 9h8M8 13h5"/></>,
  bell: <><path d="M18 9a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9m-8 12h4"/></>,
  crown: <><path d="m2 8 5 4 5-8 5 8 5-4-2 12H4L2 8Z"/></>,
  settings: <><circle cx="12" cy="12" r="3"/><path d="m19 13 2 1-2 4-2-1-2 1v2H9v-2l-2-1-2 1-2-4 2-1v-2l-2-1 2-4 2 1 2-1V4h6v2l2 1 2-1 2 4-2 1z"/></>,
  help: <><circle cx="12" cy="12" r="9"/><path d="M9.5 9a2.6 2.6 0 1 1 4.3 2c-1.2 1-1.8 1.3-1.8 3M12 17h.01"/></>,
  support: <><path d="M4 13v-2a8 8 0 0 1 16 0v2"/><path d="M4 13H3v4h4v-5H4m16 1h1v4h-4v-5h3M12 20h3"/></>,
};

function isCurrent(pathname: string, to: string) {
  if (to === "/apps") return pathname === "/apps" || pathname.startsWith("/apps/");
  if (to === "/developer/tests/new") return pathname === to;
  if (to === "/developer/tests") return pathname.startsWith("/developer/tests") && pathname !== "/developer/tests/new";
  if (to === "/developer/feedback") return pathname === to || /^\/developer\/feedback\/[^/]+$/.test(pathname);
  if (to === "/developer/support") return pathname === to || pathname.startsWith("/developer/support/");
  return pathname === to;
}

export default function DeveloperSidebar({ footer }: Props) {
  const { pathname } = useLocation();
  return <aside className="developer-sidebar">
    <Link to="/developer-dashboard" className="developer-sidebar-brand" aria-label="TestDZ Developer Dashboard">
      <span className="developer-sidebar-brand-mark"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="m5 12 4 4L19 6"/></svg></span>
      <span><strong>TestDZ</strong><small>Build · Test · Improve</small></span>
    </Link>
    <div className="developer-sidebar-workspace"><span className="developer-sidebar-code">&lt;/&gt;</span><strong>Developer</strong><span className="developer-sidebar-plan">PRO</span></div>
    <nav className="developer-sidebar-nav" aria-label="Developer navigation">
      {links.map((item) => <span className="developer-sidebar-nav-item" key={item.to}>
        {item.section && <span className="developer-sidebar-section">{item.section}</span>}
        <Link to={item.to} className={isCurrent(pathname, item.to) ? "active" : undefined} aria-current={isCurrent(pathname, item.to) ? "page" : undefined}>
          <svg viewBox="0 0 24 24" aria-hidden="true">{iconPaths[item.icon] ?? iconPaths.apps}</svg><span>{item.label}</span>
        </Link>
      </span>)}
    </nav>
    <div className="developer-sidebar-promo"><span className="developer-sidebar-rocket">🚀</span><strong>Build, test and grow with TestDZ</strong><Link to="/developer/subscription">Explore plans <span aria-hidden="true">→</span></Link></div>
    {footer && <div className="developer-sidebar-footer">{footer}</div>}
  </aside>;
}
