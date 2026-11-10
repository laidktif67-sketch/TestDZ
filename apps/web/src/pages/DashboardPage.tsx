import { useEffect, useMemo, useState } from "react";
import type { CSSProperties, ReactNode } from "react";
import type { Session } from "@supabase/supabase-js";
import { Link, Navigate } from "react-router-dom";
import { supabase } from "../lib/supabase";
import "../styles/dashboard.css";

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
  const common = { width: size, height: size, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 2, strokeLinecap: "round" as const, strokeLinejoin: "round" as const, "aria-hidden": true as const };
  const paths: Record<string, ReactNode> = {
    home: <><path d="m3 10 9-7 9 7"/><path d="M5 9v12h14V9M9 21v-7h6v7"/></>,
    search: <><circle cx="10.8" cy="10.8" r="7.2"/><path d="m16 16 5 5"/></>,
    tests: <><rect x="4" y="3" width="16" height="18" rx="2"/><path d="M9 3.5h6M8 12l2.5 2.5L16 9"/></>,
    wallet: <><rect x="3" y="6" width="18" height="15" rx="2"/><path d="M3 9h18M16 14h2"/><path d="M6 6V4h12"/></>,
    shield: <><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10Z"/><path d="m9 12 2 2 4-4"/></>,
    chart: <><path d="M4 19V5M4 19h17"/><path d="m7 15 4-4 3 2 6-7"/></>,
    star: <path d="m12 3 2.7 5.5 6.1.9-4.4 4.3 1 6.1-5.4-2.9-5.4 2.9 1-6.1-4.4-4.3 6.1-.9L12 3Z"/>,
    bell: <><path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9"/><path d="M10 21h4"/></>,
    arrow: <><path d="M5 12h14"/><path d="m13 6 6 6-6 6"/></>,
    play: <path d="m8 5 12 7-12 7V5Z"/>,
    bolt: <path d="m13 2-3 9h7l-6 11 2-9H6l7-11Z"/>,
    menu: <><path d="M4 6h16M4 12h16M4 18h16"/></>,
    settings: <><circle cx="12" cy="12" r="3"/><path d="m19.4 15 .1.1 1.4 1.1-1.4 2.4-1.7-.6a8 8 0 0 1-1.6.9l-.3 1.8h-2.8l-.3-1.8a8 8 0 0 1-1.6-.9l-1.7.6-1.4-2.4 1.4-1.1a7 7 0 0 1 0-1.9l-1.4-1.1 1.4-2.4 1.7.6a8 8 0 0 1 1.6-.9l.3-1.8h2.8l.3 1.8a8 8 0 0 1 1.6.9l1.7-.6 1.4 2.4-1.4 1.1a7 7 0 0 1 0 1.9Z"/></>,
    logout: <><path d="M10 17l5-5-5-5M15 12H3"/><path d="M12 3h7a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-7"/></>,
    clock: <><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></>,
    code: <><path d="m8 8-4 4 4 4M16 8l4 4-4 4M14 5l-4 14"/></>,
    trophy: <><path d="M8 21h8M12 17v4M7 4h10v7a5 5 0 0 1-10 0V4Z"/><path d="M7 6H4v3a4 4 0 0 0 4 4M17 6h3v3a4 4 0 0 1-4 4"/></>
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

export default function DashboardPage() {
  const [session, setSession] = useState<Session | null>(null);
  const [roles, setRoles] = useState<string[]>([]);
  const [name, setName] = useState("there");
  const [avatar, setAvatar] = useState("");
  const [stats, setStats] = useState(initialStats);
  const [chartPoints, setChartPoints] = useState<number[]>([0,0,0,0,0,0,0]);
  const [tests, setTests] = useState<TestItem[]>([]);
  const [search, setSearch] = useState("");
  const [notifications, setNotifications] = useState(0);
  const [noticeOpen, setNoticeOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [range, setRange] = useState("1W");

  useEffect(() => {
    const client = supabase;
    if (!client) { setLoading(false); return; }
    let alive = true;
    const load = async (userId: string, userEmail?: string) => {
      const [roleRes, profileRes, walletRes, assignmentRes, testRes, notificationRes] = await Promise.all([
        client.from("user_roles").select("role").eq("user_id", userId),
        client.from("profiles").select("display_name,avatar_url").eq("id", userId).maybeSingle(),
        client.from("wallets").select("earned_points").eq("user_id", userId).maybeSingle(),
        client.from("assignments").select("id,status,created_at,completed_at").eq("tester_id", userId),
        client.from("tests").select("id,title,status,min_testers,app:apps(name,icon_url)", { count: "exact" }).in("status", ["recruiting","ready","running"]).order("created_at", { ascending: false }).limit(4),
        client.from("notifications").select("id", { count: "exact", head: true }).eq("user_id", userId).is("read_at", null)
      ]);
      if (!alive) return;
      const userRoles = (roleRes.data ?? []).map((r: { role: string }) => r.role);
      const assignments = assignmentRes.data ?? [];
      const completed = assignments.filter((a: { status: string }) => a.status === "completed").length;
      setRoles(userRoles);
      setName(profileRes.data?.display_name?.trim() || userEmail?.split("@")[0] || "there");
      setAvatar(profileRes.data?.avatar_url || "");
      setStats({ available: testRes.count ?? testRes.data?.length ?? 0, completed, assignments: assignments.length, points: Number(walletRes.data?.earned_points ?? 0), checkins: 0 });
      const week = Array.from({ length: 7 }, (_, index) => { const end = new Date(); end.setHours(23,59,59,999); end.setDate(end.getDate() - (6-index)); const doneByDay = assignments.filter((a: { status: string; completed_at?: string | null }) => a.status === "completed" && a.completed_at && new Date(a.completed_at).getTime() <= end.getTime()).length; return assignments.length ? Math.round(doneByDay / assignments.length * 100) : 0; });
      setChartPoints(week);
      setTests((testRes.data ?? []) as unknown as TestItem[]);
      setNotifications(notificationRes.count ?? 0);
      if (roleRes.error || profileRes.error || assignmentRes.error || testRes.error) setError("Some dashboard information could not be loaded. Check your connection and try again.");
    };
    client.auth.getSession().then(({ data }) => {
      if (!alive) return;
      setSession(data.session);
      if (data.session) void load(data.session.user.id, data.session.user.email);
      else setLoading(false);
    });
    const { data } = client.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession);
      if (nextSession) window.setTimeout(() => { if (alive) void load(nextSession.user.id, nextSession.user.email); }, 0);
      else { setRoles([]); setLoading(false); }
    });
    return () => { alive = false; data.subscription.unsubscribe(); };
  }, []);

  const filteredTests = useMemo(() => tests.filter((test) => `${test.title} ${test.app?.name ?? ""}`.toLowerCase().includes(search.toLowerCase())), [tests, search]);
  const progress = stats.assignments ? Math.round((stats.completed / stats.assignments) * 100) : 0;
  const success = stats.assignments ? progress : 0;
  const firstName = name.split(/\s+/)[0];
  const isDeveloper = roles.includes("developer");
  const isAdmin = roles.includes("admin");
  const nav = [
    { label: "Dashboard", icon: "home", href: "/dashboard", active: true },
    { label: "Discover", icon: "search", href: "/apps" },
    { label: "My Tests", icon: "tests", href: "#my-tests" },
    { label: "Billing", icon: "wallet", href: "/profile" },
    ...(isAdmin ? [{ label: "Admin", icon: "shield", href: "/profile" }] : [])
  ];

  if (loading) return <div className="td-loading"><span className="td-spinner"/>Loading your dashboard…</div>;
  if (!session) return <Navigate to="/auth" replace />;

  return <div className="td-dashboard">
    <aside className="td-sidebar">
      <Link to="/dashboard" className="td-brand"><span className="td-brand-flask">⚗️</span><strong>TestDZ</strong><small>Test · Learn · Grow</small></Link>
      <nav className="td-side-nav">{nav.map((item) => item.href.startsWith("#") ? <a key={item.label} href={item.href} className="td-nav-link"><Icon name={item.icon}/><span>{item.label}</span></a> : <Link key={item.label} to={item.href} className={`td-nav-link ${item.active ? "active" : ""}`}><Icon name={item.icon}/><span>{item.label}</span></Link>)}</nav>
      <div className="td-sidebar-promo"><div className="td-rocket">🚀</div><strong>Build Better Together</strong><p>Create tests, help the community, and grow with TestDZ!</p><Link to="/apps">Explore More <Icon name="arrow" size={15}/></Link></div>
      <div className="td-user-mini"><div className="td-avatar">{avatar ? <img src={avatar} alt=""/> : firstName.slice(0,1).toUpperCase()}</div><div><strong>{name}</strong><small>{isDeveloper ? "Developer" : roles.includes("tester") ? "Tester" : "Member"}</small></div><Link to="/profile" aria-label="Profile settings"><Icon name="settings" size={18}/></Link></div>
      <button className="td-signout" onClick={async () => { await supabase?.auth.signOut(); }}><Icon name="logout"/>Sign Out</button>
    </aside>

    <main className="td-main">
      <header className="td-topbar">
        <label className="td-search"><Icon name="search" size={21}/><input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search tests, topics, or skills…"/></label>
        <div className="td-top-actions"><button className="td-notification" onClick={() => setNoticeOpen(!noticeOpen)} aria-label="Notifications"><Icon name="bell" size={22}/>{notifications > 0 && <i>{notifications > 9 ? "9+" : notifications}</i>}</button><span className="td-top-divider"/><Link to="/profile" className="td-profile-short"><span>{firstName.slice(0,2).toUpperCase()}</span><b>⌄</b></Link></div>
        {noticeOpen && <div className="td-notice-pop"><strong>{notifications ? `${notifications} unread notifications` : "You're all caught up"}</strong><p>{notifications ? "Open your profile to review account activity." : "New updates will appear here."}</p></div>}
      </header>

      <section className="td-welcome-banner">
        <div className="td-banner-copy"><h1><span>👋</span> Welcome back, {firstName}!</h1><p>Keep going! Discover new tests and track your progress.</p><Link to="/apps">Explore Tests <Icon name="arrow" size={17}/></Link></div>
        <div className="td-banner-art"><Mascot/></div>
      </section>

      {error && <div className="td-error">{error}</div>}

      <section className="td-stat-grid" aria-label="Your statistics">
        <article className="td-stat-card lavender"><span className="td-stat-icon"><Icon name="tests" size={34}/></span><div><strong>{stats.available}</strong><b>Available Tests</b><small>Explore and start testing</small></div><Link to="/apps" aria-label="Explore tests"><Icon name="arrow"/></Link></article>
        <article className="td-stat-card mint"><span className="td-stat-icon"><Icon name="tests" size={34}/></span><div><strong>{stats.completed}</strong><b>Completed</b><small>Great job!</small></div><a href="#my-tests" aria-label="View completed"><Icon name="arrow"/></a></article>
        <article className="td-stat-card sky"><span className="td-stat-icon"><Icon name="chart" size={34}/></span><div><strong>{success}%</strong><b>Success Rate</b><small>Keep it up!</small></div><a href="#progress" aria-label="View progress"><Icon name="arrow"/></a></article>
        <article className="td-stat-card gold"><span className="td-stat-icon"><Icon name="star" size={34}/></span><div><strong>{stats.points.toLocaleString()}</strong><b>Points</b><small>Earn more points</small></div><a href="#rewards" aria-label="View rewards"><Icon name="arrow"/></a></article>
      </section>

      <section className="td-middle-grid">
        <article className="td-panel td-progress-panel" id="progress">
          <div className="td-panel-heading"><h2><Icon name="chart" size={22}/>Your Progress</h2><div className="td-range">{["1W","1M","3M","1Y"].map((item) => <button key={item} onClick={() => setRange(item)} className={range === item ? "selected" : ""}>{item}</button>)}</div></div>
          <div className="td-progress-content"><div className="td-progress-ring" style={{ "--progress": `${progress * 3.6}deg` } as CSSProperties}><div><strong>{progress}%</strong><b>Overall<br/>Progress</b></div></div><div className="td-chart-area"><div className="td-chart-labels"><span>100%</span><span>75%</span><span>50%</span><span>25%</span><span>0%</span></div><svg viewBox="0 0 560 180" preserveAspectRatio="none" className="td-line-chart" aria-label="Progress chart"><defs><linearGradient id="td-chart-fill" x1="0" x2="0" y1="0" y2="1"><stop offset="0%" stopColor="#1764ef" stopOpacity=".22"/><stop offset="100%" stopColor="#1764ef" stopOpacity=".02"/></linearGradient></defs>{[10,48,86,124,162].map(y=><line key={y} x1="0" y1={y} x2="560" y2={y} stroke="#dce6f5" strokeWidth="1"/>) }<path d={`M0 162 L560 162 L560 ${162-progress*1.35} L0 ${162-progress*1.35} Z`} fill="url(#td-chart-fill)"/><path d={`M0 ${162-progress*1.35} L112 ${162-progress*1.35} L224 ${162-progress*1.35} L336 ${162-progress*1.35} L448 ${162-progress*1.35} L560 ${162-progress*1.35}`} fill="none" stroke="#1764ef" strokeWidth="3" strokeLinecap="round"/>{[0,112,224,336,448,560].map((x)=><circle key={x} cx={x} cy={162-progress*1.35} r="5" fill="#1764ef"/>)}</svg><div className="td-chart-days">{["Mon","Tue","Wed","Thu","Fri","Sat","Sun"].map(d=><span key={d}>{d}</span>)}</div><b className="td-chart-bubble">{progress}%</b></div></div>
          <div className="td-track-pill"><span>🏆</span><div><strong>{stats.assignments ? "On track!" : "Your journey starts here"}</strong><small>{stats.assignments ? `${stats.completed} of ${stats.assignments} tests completed` : "Join a test to start building progress"}</small></div></div>
        </article>

        <article className="td-panel td-quick-panel"><div className="td-panel-heading"><h2><Icon name="bolt" size={22}/>Quick Actions</h2></div><div className="td-quick-grid">
          <Link to="/apps" className="td-quick-action blue"><span><Icon name="play" size={23}/></span><div><strong>{isDeveloper ? "Create an App" : "Start a Test"}</strong><small>{isDeveloper ? "Publish your next app" : "Begin a new test"}</small></div><Icon name="arrow" size={18}/></Link>
          <Link to="/apps" className="td-quick-action violet"><span><Icon name="search" size={25}/></span><div><strong>Discover Tests</strong><small>Find best topics</small></div><Icon name="arrow" size={18}/></Link>
          <a href="#my-tests" className="td-quick-action green"><span><Icon name="chart" size={23}/></span><div><strong>View My Tests</strong><small>Track your results</small></div><Icon name="arrow" size={18}/></a>
          <Link to="/profile" className="td-quick-action amber"><span><Icon name="wallet" size={23}/></span><div><strong>Manage Account</strong><small>Update your profile</small></div><Icon name="arrow" size={18}/></Link>
        </div></article>
      </section>

      <section className="td-bottom-grid">
        <article className="td-panel td-discover-panel" id="my-tests"><div className="td-panel-heading"><h2><Icon name="star" size={22}/>Discover New Tests</h2><Link to="/apps">View All <Icon name="arrow" size={15}/></Link></div>
          {filteredTests.length ? <div className="td-test-grid">{filteredTests.slice(0,4).map((test,index)=><article className="td-test-card" key={test.id}><div className={`td-test-art art-${index}`}>{test.app?.icon_url ? <img src={test.app.icon_url} alt=""/> : index===0 ? <Icon name="code" size={35}/> : index===1 ? <b>Py</b> : index===2 ? <b>⚛</b> : <b>▤</b>}</div><strong>{test.title}</strong><small>{test.app?.name ?? "TestDZ community"} · {test.min_testers} testers</small><div className="td-test-meta"><span>● {test.status.replace("_"," ")}</span><span><Icon name="clock" size={13}/> Open</span></div><Link to="/apps">View Test <Icon name="arrow" size={14}/></Link></article>)}</div> : <div className="td-empty-tests"><span>🧪</span><strong>{search ? "No tests match your search" : "New tests are on the way"}</strong><p>{search ? "Try another topic or skill." : "Explore the app directory and check back as developers publish new test cycles."}</p><Link to="/apps">Explore Apps <Icon name="arrow" size={15}/></Link></div>}
        </article>
        <article className="td-panel td-rewards-panel" id="rewards"><div className="td-panel-heading"><h2><span className="td-gift">🎁</span>Your Rewards</h2><a href="#rewards">View All <Icon name="arrow" size={15}/></a></div><div className="td-reward-content"><div className="td-trophy-visual">🏆<span>✦</span></div><div><strong>You've earned<br/>{stats.points.toLocaleString()} points!</strong><p>Keep going to unlock more rewards and badges.</p><Link to="/profile">View Profile <Icon name="arrow" size={14}/></Link></div></div></article>
      </section>
      <footer className="td-footer">© {new Date().getFullYear()} TestDZ · Test · Learn · Grow</footer>
    </main>
  </div>;
}
