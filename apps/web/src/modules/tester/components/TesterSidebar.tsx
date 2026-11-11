import type { Dispatch, ReactNode, SetStateAction } from "react";
import { Link } from "react-router-dom";
import { supabase } from "../../../lib/supabase";
import "../styles/tester-dashboard.css";

export function Icon({ name, size = 20 }: { name: string; size?: number }) {
  const common = {
    className: `td-icon td-icon-${name}`,
    width: size,
    height: size,
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 1.8,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    "aria-hidden": true as const
  };
  const paths: Record<string, ReactNode> = {
    user: <><circle cx="12" cy="8" r="4"/><path d="M4 21v-2a8 8 0 0 1 16 0v2"/></>,
    folder: <><path d="M3 7.5A2.5 2.5 0 0 1 5.5 5H11l2 2h5.5A2.5 2.5 0 0 1 21 9.5v8a2.5 2.5 0 0 1-2.5 2.5h-13A2.5 2.5 0 0 1 3 17.5v-10Z"/><path d="M3 10h18"/></>,
    home: <><path d="m3.5 10.5 8.5-7 8.5 7"/><path d="M5.5 9.5v10.8h13V9.5M9.3 21v-6.5h5.4V21"/></>,
    search: <><circle cx="10.8" cy="10.8" r="7.1"/><path d="m16 16 4.5 4.5"/></>,
    tests: <><rect x="5" y="3.5" width="14" height="17" rx="2.2"/><path d="M9 3.5V2.8h6v.7M8.5 10h7M8.5 13.5h4.2M8.5 17h2.2"/></>,
    wallet: <><rect x="3" y="6" width="18" height="15" rx="2.3"/><path d="M3 9.5h18M16 14h2.5"/></>,
    shield: <><path d="M12 21.5s8-3.8 8-9.6V5.2L12 2.5 4 5.2v6.7c0 5.8 8 9.6 8 9.6Z"/><path d="m8.7 12 2.1 2.1 4.6-4.7"/></>,
    chart: <><path d="M4 19.5V5M4 19.5h16"/><path d="m7.5 15 3.2-3.4 3 1.8 5.2-6"/></>,
    grid: <><rect x="3.5" y="3.5" width="7" height="7" rx="1.2"/><rect x="13.5" y="3.5" width="7" height="7" rx="1.2"/><rect x="3.5" y="13.5" width="7" height="7" rx="1.2"/><rect x="13.5" y="13.5" width="7" height="7" rx="1.2"/></>,
    smartphone: <><rect x="7" y="2.5" width="10" height="19" rx="2"/><path d="M10 5.5h4M11 18.5h2"/></>,
    globe: <><circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3a14 14 0 0 1 0 18M12 3a14 14 0 0 0 0 18"/></>,
    monitor: <><rect x="3" y="4" width="18" height="13" rx="1.8"/><path d="M8 21h8M12 17v4"/></>,
    layers: <><path d="m12 3 9 5-9 5-9-5 9-5Z"/><path d="m3 12 9 5 9-5M3 16l9 5 9-5"/></>,
    star: <path d="m12 2.8 2.8 5.7 6.3.9-4.6 4.5 1.1 6.3-5.6-3-5.6 3 1.1-6.3-4.6-4.5 6.3-.9L12 2.8Z"/>,
    bell: <><path d="M18.2 9a6.2 6.2 0 0 0-12.4 0c0 7-2.8 7.1-2.8 9h18c0-1.9-2.8-2-2.8-9Z"/><path d="M9.5 21h5"/></>,
    arrow: <><path d="M5 12h13.5"/><path d="m13 6.5 5.5 5.5-5.5 5.5"/></>,
    play: <><circle cx="12" cy="12" r="9"/><path d="m10 8.5 6 3.5-6 3.5v-7Z"/></>,
    bolt: <path d="m13.2 2.5-8 11h6l-.5 8 8.1-11h-6.1l.5-8Z"/>,
    menu: <><path d="M4 6.5h16M4 12h16M4 17.5h16"/></>,
    settings: <><circle cx="12" cy="12" r="3.1"/><path d="m19.2 13.8 1.1.9-1.7 2.9-1.4-.6a7.8 7.8 0 0 1-1.7 1l-.2 1.5h-3.4l-.2-1.5a7.8 7.8 0 0 1-1.7-1l-1.4.6-1.7-2.9 1.1-.9a7.2 7.2 0 0 1 0-2l-1.1-.9 1.7-2.9 1.4.6a7.8 7.8 0 0 1 1.7-1l.2-1.5h3.4l.2 1.5a7.8 7.8 0 0 1 1.7 1l1.4-.6 1.7 2.9-1.1.9a7.2 7.2 0 0 1 0 2Z"/></>,
    logout: <><path d="M10 17.2 15.2 12 10 6.8M15 12H3.5"/><path d="M12.5 3.5h6A2.5 2.5 0 0 1 21 6v12a2.5 2.5 0 0 1-2.5 2.5h-6"/></>,
    clock: <><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3.2 2"/></>,
    eye: <><path d="M2.5 12s3.4-6 9.5-6 9.5 6 9.5 6-3.4 6-9.5 6-9.5-6-9.5-6Z"/><circle cx="12" cy="12" r="2.5"/></>,
    calendar: <><rect x="3" y="5" width="18" height="16" rx="2"/><path d="M7 3v4m10-4v4M3 10h18"/></>,
    code: <><path d="m8.2 8-4 4 4 4M15.8 8l4 4-4 4M14 4.5l-4 15"/></>,
    trophy: <><path d="M8 3.5h8v6.2a4 4 0 0 1-8 0V3.5Z"/><path d="M8 6H4v2.2a4.2 4.2 0 0 0 4.2 4.2M16 6h4v2.2a4.2 4.2 0 0 1-4.2 4.2M12 14v5M8.5 21h7"/></>,
    rocket: <><path d="M14.5 4.2c2.2-1.3 4.1-1.5 5.3-1.5.1 1.2-.2 3.1-1.5 5.3l-5.5 8-5.2-5.2 6.9-6.6Z"/></>,
    flask: <><path d="M9 3h6M10 3v6.2l-5.4 9.1A2.4 2.4 0 0 0 6.7 22h10.6a2.4 2.4 0 0 0 2.1-3.7L14 9.2V3"/><path d="M7.8 15h8.4"/></>,
    gift: <><rect x="3" y="9" width="18" height="12" rx="1.8"/><path d="M2.5 6.5h19v3h-19zM12 6.5v14.5"/></>,
    award: <><circle cx="12" cy="8.5" r="5.5"/><path d="m8.5 13-1 8 4.5-2.5 4.5 2.5-1-8"/></>,
    check: <path d="m5 12.5 4.2 4.2L19.5 6.5"/>,
    users: <><path d="M16 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2M10 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8ZM20 8a3 3 0 0 1-2 2.8M20 21v-2a4 4 0 0 0-3-3.9"/></>,
    lightbulb: <><path d="M9 18h6m-5 3h4M8.5 14.5A7 7 0 1 1 15.5 14.5c-.8.6-1.2 1.3-1.4 2.5h-4.2c-.2-1.2-.6-1.9-1.4-2.5Z"/></>,
    help: <><circle cx="12" cy="12" r="9"/><path d="M9.5 9a2.5 2.5 0 1 1 4 2c-1.2.8-1.5 1.2-1.5 2.5M12 17h.01"/></>,
    headset: <><path d="M3.5 13v-1a8.5 8.5 0 0 1 17 0v1"/><rect x="3" y="12" width="4" height="7" rx="1.5"/><rect x="17" y="12" width="4" height="7" rx="1.5"/><path d="M17 19a5 5 0 0 1-5 3h-1"/></>,
    chevron: <path d="m7 10 5 5 5-5"/>,
  };
  return <svg {...common}>{paths[name] ?? paths.star}</svg>;
}

export type TesterSidebarNavItem = { label: string; icon: string; href: string; active?: boolean };

type TesterSidebarProps = {
  nav: TesterSidebarNavItem[];
  name: string;
  firstName: string;
  avatar: string;
  roles: string[];
  isAdmin: boolean;
  isDeveloper: boolean;
  workspaceMenuOpen: boolean;
  setWorkspaceMenuOpen: Dispatch<SetStateAction<boolean>>;
  previewMode: boolean;
  sidebarClassName?: string;
};



export default function TesterSidebar({
  nav, name, firstName, avatar, roles, isAdmin, isDeveloper,
  workspaceMenuOpen, setWorkspaceMenuOpen, previewMode, sidebarClassName
}: TesterSidebarProps) {
  return (
    <aside className={`td-sidebar ${sidebarClassName ?? ""}`.trim()}>
      <Link to="/tester-dashboard" className="td-brand"><span className="td-brand-flask"><Icon name="flask" size={31}/></span><strong>TestDZ</strong><small>Test · Learn · Grow</small></Link>
      <nav className="td-side-nav">{nav.map((item) => item.href.startsWith("#") ? <a key={item.label} href={item.href} className="td-nav-link"><Icon name={item.icon} size={20}/><span>{item.label}</span></a> : <Link key={item.label} to={item.href} className={`td-nav-link ${item.active ? "active" : ""}`}><Icon name={item.icon} size={20}/><span>{item.label}</span></Link>)}</nav>
      <div className="td-sidebar-promo"><div className="td-rocket"><Icon name="trophy" size={40}/></div><strong>Reach Your Full Potential</strong><p>Build skills, earn points and grow with TestDZ!</p><Link to="/wallet-rewards">View Rewards <Icon name="arrow" size={14}/></Link></div>
      <div className="td-user-menu-wrap"><button type="button" className="td-user-mini td-user-trigger" aria-expanded={workspaceMenuOpen} onClick={()=>setWorkspaceMenuOpen(v=>!v)}><div className="td-avatar">{avatar ? <img src={avatar} alt=""/> : firstName.slice(0,1).toUpperCase()}</div><div><strong>{name}</strong><small>{isAdmin ? "Admin" : isDeveloper ? "Developer" : roles.includes("tester") ? "Tester" : "Member"}</small></div><Icon name="chevron" size={17}/></button>{workspaceMenuOpen&&<div className="td-workspace-menu"><Link to="/profile" onClick={()=>setWorkspaceMenuOpen(false)}><Icon name="settings" size={16}/><span>Profile settings</span></Link>{((roles.includes("tester") && roles.includes("developer")) || isAdmin)&&<><span className="td-workspace-menu-label">SWITCH WORKSPACE</span><Link to="/tester-dashboard" className="selected" onClick={()=>setWorkspaceMenuOpen(false)}><Icon name="flask" size={16}/><span>Tester Dashboard</span><Icon name="check" size={14}/></Link><Link to="/developer-dashboard" onClick={()=>setWorkspaceMenuOpen(false)}><Icon name="code" size={16}/><span>Developer Dashboard</span></Link></>}</div>}</div>
      {previewMode ? <div className="td-signout td-preview-note">Preview mode · read only</div> : <button className="td-signout" onClick={async () => { await supabase?.auth.signOut(); }}><Icon name="logout"/>Sign Out</button>}
    </aside>
    );
}
