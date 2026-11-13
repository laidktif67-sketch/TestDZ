import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import "../styles/admin-dashboard.css";

const metrics = [
  { icon: "flask", value: "4,780", label: "Active Tests", trend: "Operational snapshot", tone: "blue" },
  { icon: "file", value: "29", label: "Items Awaiting Review", trend: "Across admin queues", tone: "amber" },
  { icon: "support", value: "12", label: "Open Support Tickets", trend: "Support workload", tone: "purple" },
  { icon: "activity", value: "03", label: "Security Alerts", trend: "Requires monitoring", tone: "green" },
];

const navigation = [
  { label: "Overview", icon: "home", active: true },
  { label: "Users", icon: "users" },
  { label: "Developers", icon: "code" },
  { label: "Tests Management", icon: "flask" },
  { label: "Testers", icon: "flask" },
  { label: "Apps Management", icon: "apps" },
  { label: "Cohorts", icon: "layers" },
  { label: "Assignments", icon: "tasks" },
  { label: "Reports & Reviews", icon: "file" },
  { label: "Medical Exceptions", icon: "heart" },
  { label: "Support Center", icon: "support" },
  { label: "Suspensions & Appeals", icon: "shield" },
  { label: "Financial", icon: "card" },
  { label: "Analytics", icon: "chart" },
  { label: "Leaderboard", icon: "trophy" },
  { label: "Notifications", icon: "bell" },
  { label: "Audit Trail", icon: "history" },
  { label: "System Monitoring", icon: "activity" },
  { label: "System Logs", icon: "file" },
  { label: "Settings", icon: "settings" },
];

const tasks = [
  { title: "Medical exception requests", detail: "Waiting for an admin decision", count: "08", tone: "amber" },
  { title: "Open support tickets", detail: "Need a staff response", count: "12", tone: "blue" },
  { title: "Suspension appeals", detail: "Pending review", count: "03", tone: "red" },
];

const activities = [
  ["check", "New test campaign published", "2 minutes ago"],
  ["file", "Medical exception request submitted", "18 minutes ago"],
  ["support", "Support ticket escalated", "42 minutes ago"],
  ["users", "Developer account verified", "1 hour ago"],
  ["shield", "Suspension appeal received", "2 hours ago"],
];

const contributors = [
  { name: "Alex Morgan", role: "Developer", points: "12,450 pts", rank: "1" },
  { name: "Maya Chen", role: "Tester", points: "11,230 pts", rank: "2" },
  { name: "Amine Benali", role: "Tester", points: "10,980 pts", rank: "3" },
];

function Icon({ name, size = 19 }: { name: string; size?: number }) {
  const common = { width: size, height: size, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 1.8, strokeLinecap: "round" as const, strokeLinejoin: "round" as const, "aria-hidden": true as const };
  const shapes: Record<string, ReactNode> = {
    home: <><path d="m3 10 9-7 9 7" /><path d="M5 9v11h14V9M9 20v-6h6v6" /></>,
    users: <><circle cx="9" cy="8" r="3" /><path d="M3 20v-2a6 6 0 0 1 12 0v2M16 5a3 3 0 0 1 0 6m2 3a5 5 0 0 1 3 5v1" /></>,
    code: <><path d="m8 8-4 4 4 4m8-8 4 4-4 4m-2-11-4 14" /></>,
    flask: <><path d="M9 3h6M10 3v6l-5.5 9.2A2 2 0 0 0 6.2 21h11.6a2 2 0 0 0 1.7-2.8L14 9V3" /><path d="M8 15h8" /></>,
    apps: <><rect x="3" y="3" width="8" height="8" rx="2" /><rect x="13" y="3" width="8" height="8" rx="2" /><rect x="3" y="13" width="8" height="8" rx="2" /><rect x="13" y="13" width="8" height="8" rx="2" /></>,
    layers: <><path d="m12 3 9 5-9 5-9-5 9-5Z" /><path d="m3 12 9 5 9-5M3 16l9 5 9-5" /></>,
    tasks: <><rect x="5" y="3" width="14" height="18" rx="2" /><path d="m8 10 2 2 5-5M8 16h8" /></>,
    file: <><path d="M6 2h8l5 5v15H6z" /><path d="M14 2v6h5M9 13h7M9 17h7" /></>,
    heart: <><path d="M20.8 8.7c0 5.2-8.8 11-8.8 11s-8.8-5.8-8.8-11a4.7 4.7 0 0 1 8.8-2.2 4.7 4.7 0 0 1 8.8 2.2Z" /><path d="M7 12h3l1.5-3 2 6 1.5-3H17" /></>,
    support: <><path d="M4 13v-2a8 8 0 0 1 16 0v2" /><rect x="3" y="12" width="4" height="7" rx="2" /><rect x="17" y="12" width="4" height="7" rx="2" /><path d="M17 20h-5" /></>,
    shield: <><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10Z" /><path d="m9 12 2 2 4-4" /></>,
    wallet: <><rect x="3" y="6" width="18" height="15" rx="2" /><path d="M3 10h18M16 14h2" /></>,
    card: <><rect x="3" y="5" width="18" height="14" rx="2" /><path d="M3 10h18M7 15h3" /></>,
    chart: <><path d="M4 19V5M4 19h16" /><path d="m7 15 4-4 3 2 5-7" /></>,
    trophy: <><path d="M8 21h8m-4-4v4M7 4h10v5a5 5 0 0 1-10 0V4Z" /><path d="M7 7H4v2a4 4 0 0 0 4 4m9-6h3v2a4 4 0 0 1-4 4" /></>,
    bell: <><path d="M18 9a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9M10 21h4" /></>,
    history: <><path d="M3 12a9 9 0 1 0 3-6.7L3 8" /><path d="M3 3v5h5m4-1v5l3 2" /></>,
    activity: <><path d="M3 12h4l3-8 4 16 3-8h4" /></>,
    settings: <><circle cx="12" cy="12" r="3" /><path d="m19 13 2 1-2 4-2-1-2 1v2H9v-2l-2-1-2 1-2-4 2-1v-2l-2-1 2-4 2 1 2-1V4h6v2l2 1 2-1 2 4-2 1z" /></>,
    search: <><circle cx="10.8" cy="10.8" r="7" /><path d="m16 16 4.5 4.5" /></>,
    arrow: <><path d="M4 12h15m-6-6 6 6-6 6" /></>,
    check: <path d="m5 12 4 4L19 6" />,
    clock: <><circle cx="12" cy="12" r="9" /><path d="M12 7v5l4 2" /></>,
    bolt: <path d="m13 2-3 8h7l-6 12 1-9H5l8-11Z" />,
    menu: <><path d="M4 6h16M4 12h16M4 18h16" /></>,
  };
  return <svg {...common}>{shapes[name] ?? shapes.apps}</svg>;
}

function TrendChart() {
  return <svg className="admin-chart" viewBox="0 0 620 190" preserveAspectRatio="none" role="img" aria-label="Illustrative platform growth chart">
    <g stroke="#e9eef7" strokeWidth="1"><path d="M38 24H610M38 66H610M38 108H610M38 150H610" /></g>
    <path d="M38 137 C90 125 102 92 150 101 S218 62 265 73 S328 39 375 51 S438 27 482 39 S550 14 610 12" fill="none" stroke="#1766df" strokeWidth="3.5" />
    <path d="M38 155 C90 149 102 124 150 133 S218 103 265 112 S328 83 375 94 S438 67 482 80 S550 51 610 60" fill="none" stroke="#12b8ad" strokeWidth="3" />
    <path d="M38 170 C90 165 102 151 150 158 S218 136 265 145 S328 119 375 128 S438 105 482 116 S550 91 610 98" fill="none" stroke="#9365e9" strokeWidth="3" />
  </svg>;
}

function MetricCard({ item }: { item: typeof metrics[number] }) {
  return <article className="admin-metric-card">
    <span className={`admin-metric-icon ${item.tone}`}><Icon name={item.icon} size={22} /></span>
    <div className="admin-metric-copy"><strong>{item.value}</strong><span>{item.label}</span><small>{item.trend} vs previous period</small></div>
  </article>;
}

export default function AdminDashboardPage() {
  return <main className="admin-dashboard">
    <aside className="admin-sidebar">
      <a className="admin-brand" href="/admin"><span className="admin-brand-mark">✓</span><span>TestDZ<small>Build · Test · Improve</small></span></a>
      <div className="admin-sidebar-label">Workspace</div>
      <nav className="admin-nav" aria-label="Admin navigation">
        {navigation.map((item) => item.label === "Analytics" ? <Link key={item.label} to="/admin/analytics" className="admin-nav-item"><Icon name={item.icon} size={17} /><span>{item.label}</span></Link> : item.label === "Leaderboard" ? <Link key={item.label} to="/admin/leaderboard" className="admin-nav-item"><Icon name={item.icon} size={17} /><span>{item.label}</span></Link> : item.label === "System Monitoring" ? <Link key={item.label} to="/admin/monitoring" className="admin-nav-item"><Icon name={item.icon} size={17} /><span>{item.label}</span></Link> : item.label === "System Logs" ? <Link key={item.label} to="/admin/logs" className="admin-nav-item"><Icon name={item.icon} size={17} /><span>{item.label}</span></Link> : item.label === "Settings" ? <Link key={item.label} to="/admin/settings" className="admin-nav-item"><Icon name={item.icon} size={17} /><span>{item.label}</span></Link> : item.label === "Cohorts" ? <Link key={item.label} to="/admin/cohorts" className="admin-nav-item"><Icon name={item.icon} size={17} /><span>{item.label}</span></Link> : item.label === "Testers" ? <Link key={item.label} to="/admin/testers" className="admin-nav-item"><Icon name={item.icon} size={17} /><span>{item.label}</span></Link> : item.label === "Developers" ? <Link key={item.label} to="/admin/developers" className="admin-nav-item"><Icon name={item.icon} size={17} /><span>{item.label}</span></Link> : item.label === "Tests Management" ? <Link key={item.label} to="/admin/tests" className="admin-nav-item"><Icon name={item.icon} size={17} /><span>{item.label}</span></Link> : item.label === "Apps Management" ? <Link key={item.label} to="/admin/apps" className="admin-nav-item"><Icon name={item.icon} size={17} /><span>{item.label}</span></Link> : item.label === "Reports & Reviews" ? <Link key={item.label} to="/admin/reports" className="admin-nav-item"><Icon name={item.icon} size={17} /><span>{item.label}</span></Link> : item.label === "Notifications" ? <Link key={item.label} to="/admin/notifications" className="admin-nav-item"><Icon name={item.icon} size={17} /><span>{item.label}</span></Link> : item.label === "Assignments" ? <Link key={item.label} to="/admin/assignments" className="admin-nav-item"><Icon name={item.icon} size={17} /><span>{item.label}</span></Link> : item.label === "Medical Exceptions" ? <Link key={item.label} to="/admin/medical-exceptions" className="admin-nav-item"><Icon name={item.icon} size={17} /><span>{item.label}</span></Link> : item.label === "Support Center" ? <Link key={item.label} to="/admin/support" className="admin-nav-item"><Icon name={item.icon} size={17} /><span>{item.label}</span></Link> : item.label === "Audit Trail" ? <Link key={item.label} to="/admin/audit-trail" className="admin-nav-item"><Icon name={item.icon} size={17} /><span>{item.label}</span></Link> : item.label === "Financial" ? <div key={item.label} className="admin-financial-nav"><div className="admin-nav-item"><Icon name={item.icon} size={17} /><span>{item.label}</span></div><Link className="admin-nav-subitem" to="/admin/financial">Financial Overview</Link><Link className="admin-nav-subitem" to="/admin/tester-withdrawals">Tester Withdrawals</Link><Link className="admin-nav-subitem" to="/admin/rewards">Rewards Management</Link><Link className="admin-nav-subitem" to="/admin/transactions-ledger">Transactions Ledger</Link></div> : item.label === "Suspensions & Appeals" ? <Link key={item.label} to="/admin/users" className="admin-nav-item"><Icon name={item.icon} size={17} /><span>{item.label}</span></Link> : item.label === "Users" ? <Link key={item.label} to="/admin/users" className="admin-nav-item"><Icon name={item.icon} size={17} /><span>{item.label}</span></Link> : <div key={item.label} className={`admin-nav-item ${item.active ? "active" : ""}`} aria-current={item.active ? "page" : undefined}><Icon name={item.icon} size={17} /><span>{item.label}</span>{item.active && <i />}</div>)}
      </nav>
      <div className="admin-sidebar-footer"><span className="admin-avatar">AD</span><div><strong>Admin</strong><small>Platform administrator</small></div><span className="admin-online" /></div>
    </aside>

    <section className="admin-main">
      <header className="admin-topbar">
        <label className="admin-search"><Icon name="search" size={18} /><input aria-label="Search admin workspace" placeholder="Search users, tests, reports…" /></label>
        <div className="admin-top-actions"><button type="button" aria-label="Notifications" className="admin-icon-button"><Icon name="bell" /><span>3</span></button><button type="button" aria-label="Messages" className="admin-icon-button"><Icon name="support" /><span>5</span></button><div className="admin-user-menu"><span className="admin-avatar">AD</span><span>Admin</span><span aria-hidden="true">⌄</span></div></div>
      </header>

      <div className="admin-content">
        <section className="admin-welcome">
          <div><span className="admin-eyebrow">TESTDZ · ADMIN CONTROL CENTER</span><h1>Welcome to your Admin Panel!</h1><p>Manage your platform, monitor activity, and grow our community.</p></div>
          <div className="admin-welcome-art" aria-hidden="true"><span>✦</span><span>◈</span><span>↗</span></div>
          <div className="admin-period">▦　Last 30 days　⌄</div>
        </section>

        <section className="admin-metrics" aria-label="Platform statistics">{metrics.map((item) => <MetricCard item={item} key={item.label} />)}</section>

        <section className="admin-primary-grid">
          <article className="admin-panel admin-quick-actions">
            <div className="admin-panel-heading"><h2><Icon name="bolt" /> Quick Actions</h2><p>Open the dedicated workspace for each task</p></div>
            <div className="admin-action-grid">
              {[["users","Manage Users","/admin/users"],["file","Review Reports","/admin/reports"],["heart","Medical Requests","/admin/medical-exceptions"],["support","Support Tickets","/admin/support"],["wallet","Rewards Management","/admin/rewards"],["chart","Analytics Dashboard","/admin/analytics"]].map(([icon,label,path])=><Link className="admin-action-tile" key={label} to={path}><Icon name={icon} size={21}/><span>{label}</span></Link>)}
            </div>
          </article>
          <article className="admin-panel admin-operations-summary">
            <div className="admin-panel-heading"><h2><Icon name="activity"/> Operational Snapshot</h2><span className="admin-total-badge">Preview</span></div>
            <div className="admin-task-list">
              <div className="admin-task-row"><span className="admin-task-icon amber"><Icon name="clock" size={17}/></span><span className="admin-task-copy"><strong>Medical exception reviews</strong><small>Awaiting an admin decision</small></span><b className="admin-task-count">08</b></div>
              <div className="admin-task-row"><span className="admin-task-icon blue"><Icon name="support" size={17}/></span><span className="admin-task-copy"><strong>Open support tickets</strong><small>Need a staff response</small></span><b className="admin-task-count">12</b></div>
              <div className="admin-task-row"><span className="admin-task-icon red"><Icon name="shield" size={17}/></span><span className="admin-task-copy"><strong>Suspension appeals</strong><small>Pending review</small></span><b className="admin-task-count">03</b></div>
            </div>
            <p className="admin-demo-note">Financial approvals and reward issuance are intentionally excluded here and handled in their own modules.</p>
          </article>
        </section>

        <section className="admin-secondary-grid">
          <article className="admin-panel">
            <div className="admin-panel-heading"><h2><Icon name="clock" /> Needs Your Attention</h2><span className="admin-total-badge">23 pending</span></div>
            <div className="admin-task-list">{tasks.map((task) => <div className="admin-task-row" key={task.title}><span className={`admin-task-icon ${task.tone}`}><Icon name="file" size={17} /></span><span className="admin-task-copy"><strong>{task.title}</strong><small>{task.detail}</small></span><b className="admin-task-count">{task.count}</b></div>)}</div>
          </article>

          <article className="admin-panel">
            <div className="admin-panel-heading"><h2><Icon name="activity" /> Recent Activity</h2><Link className="admin-panel-link" to="/admin/audit-trail">View all</Link></div>
            <div className="admin-activity-list">{activities.map(([icon,title,time]) => <div className="admin-activity-row" key={title}><span className="admin-activity-icon"><Icon name={icon} size={16} /></span><span><strong>{title}</strong><small>{time}</small></span></div>)}</div>
          </article>

          <article className="admin-panel">
            <div className="admin-panel-heading"><h2><Icon name="trophy" /> Top Contributors</h2><Link className="admin-panel-link" to="/admin/leaderboard">Leaderboard</Link></div>
            <div className="admin-contributor-list">{contributors.map((person) => <div className="admin-contributor" key={person.rank}><span className="admin-rank">{person.rank}</span><span className="admin-person-avatar">{person.name.slice(0,1)}</span><span className="admin-person-copy"><strong>{person.name}</strong><small>{person.role}</small></span><b>{person.points}</b></div>)}</div>
          </article>
        </section>

        <section className="admin-panel admin-system-panel"><div className="admin-panel-heading"><h2><Icon name="activity" /> System Overview</h2><span className="admin-system-status"><i /> Preview status</span></div><div className="admin-system-metrics"><span><small>API response</small><strong>142 ms</strong></span><span><small>Database</small><strong>Healthy</strong></span><span><small>Active sessions</small><strong>2,845</strong></span><span><small>Security alerts</small><strong>03</strong></span></div></section>
        <p className="admin-demo-note">Design preview · All figures, activity entries and system indicators on this page are illustrative mock data, not live platform records.</p>
      </div>
    </section>
  </main>;
}
