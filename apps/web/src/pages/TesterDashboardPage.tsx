import { useEffect, useMemo, useState } from "react";
import type { CSSProperties, ReactNode } from "react";
import { Link } from "react-router-dom";
import { gsap } from "gsap";
import { supabase } from "../lib/supabase";
import { useIdentity } from "../features/identity/hooks/useIdentity";
import { RoleAccessNotice } from "../features/identity/guards/RoleGuard";
import "../styles/tester-dashboard.css";

type TestItem = {
  id: string;
  title: string;
  status: string;
  min_testers: number;
  app?: { name?: string; icon_url?: string | null } | null;
};
type DashboardStats = { available: number; completed: number; assignments: number; points: number; checkins: number };
const initialStats: DashboardStats = { available: 0, completed: 0, assignments: 0, points: 0, checkins: 0 };

function Icon({ name, size = 20 }: { name: string; size?: number }) {
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
    home: <><path d="m3.5 10.5 8.5-7 8.5 7"/><path d="M5.5 9.5v10.8a.7.7 0 0 0 .7.7h11.6a.7.7 0 0 0 .7-.7V9.5"/><path d="M9.3 21v-6.5h5.4V21"/></>,
    search: <><circle cx="10.8" cy="10.8" r="7.1"/><path d="m16 16 4.5 4.5"/></>,
    tests: <><rect x="5" y="3.5" width="14" height="17" rx="2.2"/><path d="M9 3.5V2.8h6v.7M8.5 10h7M8.5 13.5h4.2M8.5 17h2.2"/><path d="m14.5 15.7 1.3 1.3 2.6-3"/></>,
    wallet: <><rect x="3" y="6" width="18" height="15" rx="2.3"/><path d="M3 9.5h18M16 14h2.5M6 6V4.5a1.5 1.5 0 0 1 1.5-1.5H18"/></>,
    shield: <><path d="M12 21.5s8-3.8 8-9.6V5.2L12 2.5 4 5.2v6.7c0 5.8 8 9.6 8 9.6Z"/><path d="m8.7 12 2.1 2.1 4.6-4.7"/></>,
    chart: <><path d="M4 19.5V5M4 19.5h16"/><path d="m7.5 15 3.2-3.4 3 1.8 5.2-6"/><path d="M15.8 7.4h3.1v3.1"/></>,
    star: <path d="m12 2.8 2.8 5.7 6.3.9-4.6 4.5 1.1 6.3-5.6-3-5.6 3 1.1-6.3-4.6-4.5 6.3-.9L12 2.8Z"/>,
    bell: <><path d="M18.2 9a6.2 6.2 0 0 0-12.4 0c0 7-2.8 7.1-2.8 9h18c0-1.9-2.8-2-2.8-9Z"/><path d="M9.5 21h5"/><path d="M19.5 4.5 21 3"/></>,
    arrow: <><path d="M5 12h13.5"/><path d="m13 6.5 5.5 5.5-5.5 5.5"/></>,
    play: <><circle cx="12" cy="12" r="9"/><path d="m10 8.5 6 3.5-6 3.5v-7Z" fill="currentColor" stroke="none"/></>,
    bolt: <path d="m13.2 2.5-8 11h6l-.5 8 8.1-11h-6.1l.5-8Z"/>,
    menu: <><path d="M4 6.5h16M4 12h16M4 17.5h16"/></>,
    settings: <><circle cx="12" cy="12" r="3.1"/><path d="m19.2 13.8 1.1.9-1.7 2.9-1.4-.6a7.8 7.8 0 0 1-1.7 1l-.2 1.5h-3.4l-.2-1.5a7.8 7.8 0 0 1-1.7-1l-1.4.6-1.7-2.9 1.1-.9a7.2 7.2 0 0 1 0-2l-1.1-.9 1.7-2.9 1.4.6a7.8 7.8 0 0 1 1.7-1l.2-1.5h3.4l.2 1.5a7.8 7.8 0 0 1 1.7 1l1.4-.6 1.7 2.9-1.1.9a7.2 7.2 0 0 1 0 2Z"/></>,
    logout: <><path d="M10 17.2 15.2 12 10 6.8M15 12H3.5"/><path d="M12.5 3.5h6A2.5 2.5 0 0 1 21 6v12a2.5 2.5 0 0 1-2.5 2.5h-6"/></>,
    clock: <><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3.2 2"/></>,
    code: <><path d="m8.2 8-4 4 4 4M15.8 8l4 4-4 4M14 4.5l-4 15"/></>,
    trophy: <><path d="M8 3.5h8v6.2a4 4 0 0 1-8 0V3.5Z"/><path d="M8 6H4v2.2a4.2 4.2 0 0 0 4.2 4.2M16 6h4v2.2a4.2 4.2 0 0 1-4.2 4.2M12 14v5M8.5 21h7M9 18.8h6"/></>,
    rocket: <><path d="M14.5 4.2c2.2-1.3 4.1-1.5 5.3-1.5.1 1.2-.2 3.1-1.5 5.3l-5.5 8-5.2-5.2 6.9-6.6Z"/><path d="m8.2 10.5-3.4.8-2.1 4.1 5.4-.3M13.5 15.8l-.8 3.4-4.1 2.1.3-5.4"/><circle cx="15.7" cy="7.7" r="1.5"/><path d="M5.8 18.2c-1.4.2-2.3 1.1-2.5 2.5 1.4-.2 2.3-1.1 2.5-2.5Z"/></>,
    flask: <><path d="M9 3h6M10 3v6.2l-5.4 9.1A2.4 2.4 0 0 0 6.7 22h10.6a2.4 2.4 0 0 0 2.1-3.7L14 9.2V3"/><path d="M7.8 15h8.4M10 18.2h.1M14 17.5h.1"/></>,
    gift: <><rect x="3" y="9" width="18" height="12" rx="1.8"/><path d="M2.5 6.5h19v3h-19zM12 6.5v14.5"/><path d="M12 6.5H8.3a2.3 2.3 0 1 1 2.3-2.3c0 1.2 1.4 2.3 1.4 2.3ZM12 6.5h3.7a2.3 2.3 0 1 0-2.3-2.3c0 1.2-1.4 2.3-1.4 2.3Z"/></>,
    award: <><circle cx="12" cy="8.5" r="5.5"/><path d="m8.5 13-1 8 4.5-2.5 4.5 2.5-1-8"/><path d="m10 8.5 1.3 1.3 2.7-2.7"/></>,
    check: <path d="m5 12.5 4.2 4.2L19.5 6.5"/>,
    chevron: <path d="m7 10 5 5 5-5"/>
  };
  return <svg {...common}>{paths[name] ?? paths.star}</svg>;
}
function Mascot() {
  return <svg className="td-mascot" viewBox="0 0 420 220" role="img" aria-label="TestDZ student mascot">
    <circle cx="220" cy="108" r="104" fill="#ffffff" opacity=".12"/>
    <rect x="26" y="83" width="94" height="57" rx="12" fill="#fff" opacity=".96"/>
    <path d="M43 102h17m-17 12h48m-48 12h34" stroke="#8bbdff" strokeWidth="6" strokeLinecap="round"/>
    <circle cx="56" cy="101" r="7" fill="#20c997"/>
    <rect x="306" y="35" width="86" height="68" rx="12" fill="#fff" opacity=".96"/>
    <path d="M326 84V68m18 16V55m18 29V46" stroke="#1684f8" strokeWidth="9" strokeLinecap="round"/>
    <path d="M153 173c8-42 30-57 67-57s62 17 73 57l8 47H142l11-47Z" fill="#0757c9"/>
    <path d="M180 163c8-24 23-34 41-34s34 10 43 34l-12 57h-61l-11-57Z" fill="#0b78ee"/>
    <path d="M190 117c-8-10-12-22-12-38 0-39 21-62 51-62 34 0 54 25 54 61 0 19-6 34-17 45l-16 16h-43l-17-22Z" fill="#f1b58e"/>
    <path d="M178 76c-7-42 17-67 50-67 34 0 55 21 56 56-12-7-20-18-24-31-18 17-44 24-78 21l-4 21Z" fill="#39241f"/>
    <path d="M184 52c13-23 40-34 66-23" fill="none" stroke="#5a3027" strokeWidth="13" strokeLinecap="round"/>
    <rect x="188" y="62" width="33" height="26" rx="10" fill="none" stroke="#142a50" strokeWidth="5"/>
    <rect x="228" y="62" width="33" height="26" rx="10" fill="none" stroke="#142a50" strokeWidth="5"/>
    <path d="M221 73h7" stroke="#142a50" strokeWidth="5"/>
    <circle cx="205" cy="75" r="4" fill="#172b4d"/><circle cx="245" cy="75" r="4" fill="#172b4d"/>
    <path d="M215 99q14 12 28 0" fill="none" stroke="#a54d46" strokeWidth="4" strokeLinecap="round"/>
    <path d="M282 123q25-16 35-1l15 31q-4 15-20 11l-30-16" fill="#f1b58e"/>
    <path d="M319 111q-12-17-4-22 8-3 14 10 7-18 15-13 8 5-3 25l-11 15-11-15Z" fill="#f1b58e"/>
    <rect x="123" y="176" width="184" height="36" rx="8" fill="#142b59"/>
    <rect x="134" y="181" width="162" height="24" rx="4" fill="#d9ecff"/>
    <path d="M106 214h220l-14 6H120l-14-6Z" fill="#a9c7e9"/>
    <path d="m212 181 10 14 10-14" fill="none" stroke="#176ce1" strokeWidth="4"/>
  </svg>;
}

export default function TesterDashboardPage() {
  const { roles: identityRoles } = useIdentity();
  const [name, setName] = useState("there");
  const [avatar, setAvatar] = useState("");
  const [stats, setStats] = useState(initialStats);
  const [chartPoints, setChartPoints] = useState<number[]>([0,0,0,0,0,0,0]);
  const [chartLabels, setChartLabels] = useState<string[]>(["Mon","Tue","Wed","Thu","Fri","Sat","Sun"]);
  const [tests, setTests] = useState<TestItem[]>([]);
  const [search, setSearch] = useState("");
  const [notifications, setNotifications] = useState(0);
  const [noticeOpen, setNoticeOpen] = useState(false);
  const [workspaceMenuOpen,setWorkspaceMenuOpen]=useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [range, setRange] = useState("1W");
  const [animatedStats, setAnimatedStats] = useState({ available: 0, completed: 0, success: 0, points: 0 });
  const previewMode = import.meta.env.DEV && new URLSearchParams(window.location.search).get("preview") === "1";
  const roles = previewMode ? ["tester", "developer"] : identityRoles;

  useEffect(() => {
    if (previewMode) {
      setName("John Doe");
      setStats({ available: 12, completed: 8, assignments: 10, points: 450, checkins: 0 });
      setChartPoints([40, 48, 55, 61, 68, 72, 75]);
      setChartLabels(["Mon","Tue","Wed","Thu","Fri","Sat","Sun"]);
      setNotifications(3);
      setTests([
        { id: "preview-js", title: "JavaScript Basics", status: "recruiting", min_testers: 5, app: { name: "JavaScript", icon_url: null } },
        { id: "preview-python", title: "Python Fundamentals", status: "recruiting", min_testers: 5, app: { name: "Python", icon_url: null } },
        { id: "preview-react", title: "React Essentials", status: "ready", min_testers: 4, app: { name: "React", icon_url: null } },
        { id: "preview-sql", title: "SQL Advanced", status: "running", min_testers: 3, app: { name: "SQL", icon_url: null } }
      ]);
      setLoading(false);
      return;
    }
    const client = supabase;
    if (!client) { setLoading(false); return; }
    let alive = true;
    const load = async (userId: string, userEmail?: string) => {
      const [profileRes, walletRes, assignmentRes, testRes, notificationRes] = await Promise.all([
        client.from("profiles").select("display_name,avatar_url").eq("id", userId).maybeSingle(),
        client.from("wallets").select("earned_points").eq("user_id", userId).maybeSingle(),
        client.from("assignments").select("id,status,created_at,completed_at").eq("tester_id", userId),
        client.from("tests").select("id,title,status,min_testers,app:apps(name,icon_url)", { count: "exact" }).in("status", ["recruiting","ready","running"]).order("created_at", { ascending: false }).limit(4),
        client.from("notifications").select("id", { count: "exact", head: true }).eq("user_id", userId).is("read_at", null)
      ]);
      if (!alive) return;
      const assignments = assignmentRes.data ?? [];
      const completed = assignments.filter((a: { status: string }) => a.status === "completed").length;
      setName(profileRes.data?.display_name?.trim() || userEmail?.split("@")[0] || "there");
      setAvatar(profileRes.data?.avatar_url || "");
      setStats({ available: testRes.count ?? testRes.data?.length ?? 0, completed, assignments: assignments.length, points: Number(walletRes.data?.earned_points ?? 0), checkins: 0 });
      const completedAssignments = assignments.filter((a: { status: string; completed_at?: string | null }) => a.status === "completed" && a.completed_at);
      const now = new Date();
      const bucketCount = range === "1W" ? 7 : range === "1M" ? 5 : 12;
      const labels = range === "1W" ? ["Mon","Tue","Wed","Thu","Fri","Sat","Sun"] : range === "1M" ? ["W1","W2","W3","W4","W5"] : range === "3M" ? Array.from({length:12},(_,i)=>"W"+(i+1)) : ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
      const points = Array.from({length:bucketCount},(_,index) => {
        let end: Date;
        if (range === "1W") {
          const monday = new Date(now); monday.setHours(0,0,0,0); monday.setDate(monday.getDate()-((monday.getDay()+6)%7));
          end = new Date(monday); end.setDate(end.getDate()+index+1);
        } else if (range === "1M") {
          end = new Date(now.getFullYear(),now.getMonth(),1+(index+1)*7);
        } else if (range === "3M") {
          const first = new Date(now); first.setDate(first.getDate()-83);
          end = new Date(first); end.setDate(end.getDate()+(index+1)*7);
        } else {
          end = new Date(now.getFullYear(),index+1,1);
        }
        const cumulative = completedAssignments.filter((a: {completed_at?:string|null}) => new Date(a.completed_at as string) < end).length;
        return assignments.length ? Math.round(cumulative / assignments.length * 100) : 0;
      });
      setChartLabels(labels); setChartPoints(points);
      setTests((testRes.data ?? []) as unknown as TestItem[]);
      setNotifications(notificationRes.count ?? 0);
      if (profileRes.error || assignmentRes.error || testRes.error) setError("Some dashboard information could not be loaded. Check your connection and try again.");
    };
    client.auth.getSession().then(({ data }) => {
      if (!alive) return;
      if (data.session) void load(data.session.user.id, data.session.user.email);
      else setLoading(false);
    });
    const { data } = client.auth.onAuthStateChange((_event, nextSession) => {
      if (nextSession) window.setTimeout(() => { if (alive) void load(nextSession.user.id, nextSession.user.email); }, 0);
      else { setLoading(false); }
    });
    return () => { alive = false; data.subscription.unsubscribe(); };
  }, [previewMode, range]);

  const filteredTests = useMemo(() => tests.filter((test) => `${test.title} ${test.app?.name ?? ""}`.toLowerCase().includes(search.toLowerCase())), [tests, search]);
  const progress = previewMode ? 75 : stats.assignments ? Math.round((stats.completed / stats.assignments) * 100) : 0;
  const chartLine = chartPoints.map((point, index) => (index ? "L" : "M") + " " + (index * 93.33) + " " + (162 - point * 1.35)).join(" ");
  const chartArea = "M0 162 L" + chartPoints.map((point, index) => (index * 93.33) + " " + (162 - point * 1.35)).join(" L ") + " L560 162 Z";
  const success = stats.assignments ? progress : 0;
  useEffect(() => {
    const values = { available: stats.available, completed: stats.completed, success, points: stats.points };
    const counter = { available: 0, completed: 0, success: 0, points: 0 };
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reducedMotion) { setAnimatedStats(values); return; }
    const tween = gsap.to(counter, {
      ...values,
      duration: 1.35,
      ease: "power3.out",
      onUpdate: () => setAnimatedStats({
        available: Math.round(counter.available),
        completed: Math.round(counter.completed),
        success: Math.round(counter.success),
        points: Math.round(counter.points)
      })
    });
    return () => { tween.kill(); };
  }, [stats.available, stats.completed, stats.points, success]);
  const firstName = name.split(/\s+/)[0];
  const isDeveloper = roles.includes("developer");
  const isAdmin = roles.includes("admin");
  const nav = [
    { label: "Tester Dashboard", icon: "home", href: "/tester-dashboard", active: true },
    ...(isDeveloper || isAdmin ? [{ label: "Developer", icon: "code", href: "/developer-dashboard" }] : []),
    ...(isDeveloper || isAdmin ? [{ label: "Discover", icon: "search", href: "/apps" }] : []),
    { label: "My Tests", icon: "tests", href: "/my-tests" },
    { label: "Billing", icon: "wallet", href: "/profile" },
    ...(isAdmin ? [{ label: "Admin", icon: "shield", href: "/profile" }] : [])
  ];

  if (loading) return <div className="td-loading"><span className="td-spinner"/>Loading your dashboard…</div>;

  return <div className="td-dashboard">
    <aside className="td-sidebar">
      <Link to="/tester-dashboard" className="td-brand"><span className="td-brand-flask"><Icon name="tests" size={32}/></span><strong>TestDZ</strong><small>Test · Learn · Grow</small></Link>
      <nav className="td-side-nav">{nav.map((item) => item.href.startsWith("#") ? <a key={item.label} href={item.href} className="td-nav-link"><Icon name={item.icon}/><span>{item.label}</span></a> : <Link key={item.label} to={item.href} className={`td-nav-link ${item.active ? "active" : ""}`}><Icon name={item.icon}/><span>{item.label}</span></Link>)}</nav>
      <div className="td-sidebar-promo"><div className="td-rocket"><Icon name="rocket" size={42}/></div><strong>Build Better Together</strong><p>Create tests, help the community, and grow with TestDZ!</p><Link to="#my-tests">Explore More <Icon name="arrow" size={15}/></Link></div>
      <div className="td-user-menu-wrap"><button type="button" className="td-user-mini td-user-trigger" aria-expanded={workspaceMenuOpen} onClick={()=>setWorkspaceMenuOpen(v=>!v)}><div className="td-avatar">{avatar ? <img src={avatar} alt=""/> : firstName.slice(0,1).toUpperCase()}</div><div><strong>{name}</strong><small>{isAdmin ? "Admin" : isDeveloper ? "Developer" : roles.includes("tester") ? "Tester" : "Member"}</small></div><Icon name="chevron" size={17}/></button>{workspaceMenuOpen&&<div className="td-workspace-menu"><Link to="/profile" onClick={()=>setWorkspaceMenuOpen(false)}><Icon name="settings" size={16}/><span>Profile settings</span></Link>{((roles.includes("tester") && roles.includes("developer")) || isAdmin)&&<><span className="td-workspace-menu-label">SWITCH WORKSPACE</span><Link to="/tester-dashboard" className="selected" onClick={()=>setWorkspaceMenuOpen(false)}><Icon name="flask" size={16}/><span>Tester Dashboard</span><Icon name="check" size={14}/></Link><Link to="/developer-dashboard" onClick={()=>setWorkspaceMenuOpen(false)}><Icon name="code" size={16}/><span>Developer Dashboard</span></Link></>}</div>}</div>
      {previewMode ? <div className="td-signout td-preview-note">Preview mode · read only</div> : <button className="td-signout" onClick={async () => { await supabase?.auth.signOut(); }}><Icon name="logout"/>Sign Out</button>}
    </aside>

    <main className="td-main">
      <RoleAccessNotice />
      <header className="td-topbar">
        <label className="td-search"><Icon name="search" size={21}/><input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search tests, topics, or skills…"/></label>
        <div className="td-top-actions"><button className="td-notification" onClick={() => setNoticeOpen(!noticeOpen)} aria-label="Notifications"><Icon name="bell" size={22}/>{notifications > 0 && <i>{notifications > 9 ? "9+" : notifications}</i>}</button><span className="td-top-divider"/><Link to="/profile" className="td-profile-short"><span>{avatar ? <img src={avatar} alt=""/> : firstName.slice(0,2).toUpperCase()}</span><b>⌄</b></Link></div>
        {noticeOpen && <div className="td-notice-pop"><strong>{notifications ? `${notifications} unread notifications` : "You're all caught up"}</strong><p>{notifications ? "Open your profile to review account activity." : "New updates will appear here."}</p></div>}
      </header>

      <section className="td-welcome-banner">
        <div className="td-banner-copy"><h1><span>👋</span> Welcome back, {firstName}!</h1><p>Keep going! Discover new tests and track your progress.</p><Link to="#my-tests">Explore Tests <Icon name="arrow" size={17}/></Link></div>
        <div className="td-banner-art"><Mascot/></div>
      </section>

      {error && <div className="td-error">{error}</div>}

      <section className="td-stat-grid" aria-label="Your statistics">
        <article className="td-stat-card lavender"><span className="td-stat-icon"><Icon name="tests" size={34}/></span><div><strong>{animatedStats.available}</strong><b>Available Tests</b><small>Explore and start testing</small></div><Link to="#my-tests" aria-label="Explore tests"><Icon name="arrow"/></Link></article>
        <article className="td-stat-card mint"><span className="td-stat-icon"><Icon name="tests" size={34}/></span><div><strong>{animatedStats.completed}</strong><b>Completed</b><small>Great job!</small></div><a href="#my-tests" aria-label="View completed"><Icon name="arrow"/></a></article>
        <article className="td-stat-card sky"><span className="td-stat-icon"><Icon name="chart" size={34}/></span><div><strong>{animatedStats.success}%</strong><b>Success Rate</b><small>Keep it up!</small></div><a href="#progress" aria-label="View progress"><Icon name="arrow"/></a></article>
        <article className="td-stat-card gold"><span className="td-stat-icon"><Icon name="star" size={34}/></span><div><strong>{animatedStats.points.toLocaleString()}</strong><b>Points</b><small>Earn more points</small></div><a href="#rewards" aria-label="View rewards"><Icon name="arrow"/></a></article>
      </section>

      <section className="td-middle-grid">
        <article className="td-panel td-progress-panel" id="progress">
          <div className="td-panel-heading"><h2><Icon name="chart" size={22}/>Your Progress</h2><div className="td-range">{["1W","1M","3M","1Y"].map((item) => <button key={item} onClick={() => setRange(item)} className={range === item ? "selected" : ""}>{item}</button>)}</div></div>
          <div className="td-progress-content"><div className="td-progress-ring" style={{ "--progress": `${progress * 3.6}deg` } as CSSProperties & { "--progress": string }}><div><strong>{animatedStats.success}%</strong><b>Overall<br/>Progress</b></div></div><div className="td-chart-area"><div className="td-chart-labels"><span>100%</span><span>75%</span><span>50%</span><span>25%</span><span>0%</span></div><svg viewBox="0 0 560 180" preserveAspectRatio="none" className="td-line-chart" aria-label="Progress chart"><defs><linearGradient id="td-chart-fill" x1="0" x2="0" y1="0" y2="1"><stop offset="0%" stopColor="#1764ef" stopOpacity=".22"/><stop offset="100%" stopColor="#1764ef" stopOpacity=".02"/></linearGradient></defs>{[10,48,86,124,162].map(y=><line key={y} x1="0" y1={y} x2="560" y2={y} stroke="#dce6f5" strokeWidth="1"/>) }<path d={chartArea} fill="url(#td-chart-fill)"/><path d={chartLine} fill="none" stroke="#1764ef" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"/>{chartPoints.map((point,index)=><circle key={index} cx={index*93.33} cy={162-point*1.35} r="5" fill="#1764ef"/>)}</svg><div className="td-chart-days">{chartLabels.map(d=><span key={d}>{d}</span>)}</div><b className="td-chart-bubble">{progress}%</b></div></div>
          <div className="td-track-pill"><span>🏆</span><div><strong>{stats.assignments ? "On track!" : "Your journey starts here"}</strong><small>{stats.assignments ? `${stats.completed} of ${stats.assignments} tests completed` : "Join a test to start building progress"}</small></div></div>
        </article>

        <article className="td-panel td-quick-panel"><div className="td-panel-heading"><h2><Icon name="bolt" size={22}/>Quick Actions</h2></div><div className="td-quick-grid">
          <Link to="/apps" className="td-quick-action blue"><span><Icon name="play" size={23}/></span><div><strong>{isDeveloper ? "Create an App" : "Start a Test"}</strong><small>{isDeveloper ? "Publish your next app" : "Begin a new test"}</small></div><Icon name="arrow" size={18}/></Link>
          <Link to={isDeveloper || isAdmin ? "/apps" : "#my-tests"} className="td-quick-action violet"><span><Icon name="search" size={25}/></span><div><strong>Discover Tests</strong><small>Find best topics</small></div><Icon name="arrow" size={18}/></Link>
          <a href="#my-tests" className="td-quick-action green"><span><Icon name="chart" size={23}/></span><div><strong>View My Tests</strong><small>Track your results</small></div><Icon name="arrow" size={18}/></a>
          <Link to="/profile" className="td-quick-action amber"><span><Icon name="wallet" size={23}/></span><div><strong>Manage Account</strong><small>Update your profile</small></div><Icon name="arrow" size={18}/></Link>
        </div></article>
      </section>

      <section className="td-bottom-grid">
        <article className="td-panel td-discover-panel" id="my-tests"><div className="td-panel-heading"><h2><Icon name="star" size={22}/>Discover New Tests</h2><Link to="/my-tests">View All <Icon name="arrow" size={15}/></Link></div>
          {filteredTests.length ? <div className="td-test-grid">{filteredTests.slice(0,4).map((test,index)=><article className="td-test-card" key={test.id}><div className={`td-test-art art-${index}`}>{test.app?.icon_url ? <img src={test.app.icon_url} alt=""/> : index===0 ? <Icon name="code" size={35}/> : index===1 ? <b>Py</b> : index===2 ? <b>⚛</b> : <b>▤</b>}</div><strong>{test.title}</strong><small>{test.app?.name ?? "TestDZ community"} · {test.min_testers} testers</small><div className="td-test-meta"><span>● {test.status.replace("_"," ")}</span><span><Icon name="clock" size={13}/> Open</span></div><Link to="/my-tests">View Test <Icon name="arrow" size={14}/></Link></article>)}</div> : <div className="td-empty-tests"><span><Icon name="flask" size={28}/></span><strong>{search ? "No tests match your search" : "New tests are on the way"}</strong><p>{search ? "Try another topic or skill." : "Explore the app directory and check back as developers publish new test cycles."}</p><Link to="/my-tests">Explore Tests <Icon name="arrow" size={15}/></Link></div>}
        </article>
        <article className="td-panel td-rewards-panel" id="rewards"><div className="td-panel-heading"><h2><span className="td-gift"><Icon name="gift" size={20}/></span>Your Rewards</h2><a href="#rewards">View All <Icon name="arrow" size={15}/></a></div><div className="td-reward-content"><div className="td-trophy-visual"><Icon name="trophy" size={76}/><span>✦</span></div><div><strong>You've earned<br/>{animatedStats.points.toLocaleString()} points!</strong><p>Keep going to unlock more rewards and badges.</p><Link to="/profile">View Profile <Icon name="arrow" size={14}/></Link></div></div></article>
      </section>
      <footer className="td-footer">{previewMode ? "Preview only · sample data · no account changes" : `© ${new Date().getFullYear()} TestDZ · Test · Learn · Grow`}</footer>
    </main>
  </div>;
}
