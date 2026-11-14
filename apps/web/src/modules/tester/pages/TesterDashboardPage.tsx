import { useEffect, useMemo, useState } from "react";
import type { CSSProperties } from "react";
import { Link } from "react-router-dom";
import { gsap } from "gsap";
import { identityApi } from "../../../features/identity/identity-api";
import { getTesterHeaderProfile } from "../../../features/profile/profile-api";
import { listTesterDashboardAssignments, listTesterDashboardAvailableTests } from "../../../features/testers/tester-dashboard-api";
import { getTesterEarnedPointsWallet } from "../../../features/testers/wallet-rewards-api";
import { countTesterUnreadNotifications } from "../../../features/notifications/notifications-api";
import { useIdentity } from "../../../features/identity/hooks/useIdentity";
import { RoleAccessNotice } from "../../../shared/guards/RoleGuard";
import "../styles/tester-dashboard.css";
import TesterSidebar, { Icon } from "../components/TesterSidebar";

type TestItem = {
  id: string;
  title: string;
  status: string;
  min_testers: number;
  app?: { name?: string; icon_url?: string | null } | null;
};
type DashboardStats = { available: number; active: number; completed: number; assignments: number; points: number; checkins: number };
type ActiveAssignment = { id: string; status: string; start_date: string | null; test?: { title?: string; end_date?: string | null; app?: { name?: string } | null } | null; checkins?: { id: string; checkin_date?: string }[] | null };
const initialStats: DashboardStats = { available: 0, active: 0, completed: 0, assignments: 0, points: 0, checkins: 0 };


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
  const [activeAssignments, setActiveAssignments] = useState<ActiveAssignment[]>([]);
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
      setStats({ available: 12, active: 2, completed: 8, assignments: 10, points: 450, checkins: 18 });
      setChartPoints([40, 48, 55, 61, 68, 72, 75]);
      setChartLabels(["Mon","Tue","Wed","Thu","Fri","Sat","Sun"]);
      setNotifications(3);
      setActiveAssignments([
        { id: "preview-a1", status: "active", start_date: new Date(Date.now() - 8 * 86400000).toISOString().slice(0,10), test: { title: "Mobile App Usability Test", end_date: new Date(Date.now() + 6 * 86400000).toISOString().slice(0,10), app: { name: "TestDZ Demo" } }, checkins: Array.from({ length: 8 }, (_, i) => ({ id: `preview-c${i}`, checkin_date: new Date(Date.now() - (7-i) * 86400000).toISOString().slice(0,10) })) },
        { id: "preview-a2", status: "active", start_date: new Date(Date.now() - 4 * 86400000).toISOString().slice(0,10), test: { title: "Website Performance Review", end_date: new Date(Date.now() + 10 * 86400000).toISOString().slice(0,10), app: { name: "TestDZ Demo" } }, checkins: Array.from({ length: 4 }, (_, i) => ({ id: `preview-d${i}`, checkin_date: new Date(Date.now() - (3-i) * 86400000).toISOString().slice(0,10) })) }
      ]);
      setTests([
        { id: "preview-js", title: "JavaScript Basics", status: "recruiting", min_testers: 5, app: { name: "JavaScript", icon_url: null } },
        { id: "preview-python", title: "Python Fundamentals", status: "recruiting", min_testers: 5, app: { name: "Python", icon_url: null } },
        { id: "preview-react", title: "React Essentials", status: "ready", min_testers: 4, app: { name: "React", icon_url: null } },
        { id: "preview-sql", title: "SQL Advanced", status: "running", min_testers: 3, app: { name: "SQL", icon_url: null } }
      ]);
      setLoading(false);
      return;
    }
    if (!identityApi.isConfigured()) { setLoading(false); return; }
    let alive = true;
    const load = async (userId: string, userEmail?: string) => {
      try {
        const [profileRes, walletRes, assignmentRes, testRes, notificationRes] = await Promise.all([
        getTesterHeaderProfile(userId),
        getTesterEarnedPointsWallet(userId),
        listTesterDashboardAssignments(userId),
        listTesterDashboardAvailableTests(),
        countTesterUnreadNotifications(userId)
      ]);
      if (!alive) return;
      const assignments = assignmentRes.data ?? [];
      setActiveAssignments((assignments.filter((a: { status: string }) => a.status === "active") as unknown as ActiveAssignment[]).slice(0, 4));
      const completed = assignments.filter((a: { status: string }) => a.status === "completed").length;
      const checkins = assignments.reduce((total: number, assignment: { checkins?: { id: string }[] | null }) => total + (assignment.checkins?.length ?? 0), 0);
      setName(profileRes.data?.display_name?.trim() || userEmail?.split("@")[0] || "there");
      setAvatar(profileRes.data?.avatar_url || "");
      setStats({ available: testRes.count ?? testRes.data?.length ?? 0, active: assignments.filter((a: { status: string }) => a.status === "active").length, completed, assignments: assignments.length, points: Number(walletRes.data?.earned_points ?? 0), checkins });
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
      if (profileRes.error || walletRes.error || assignmentRes.error || testRes.error || notificationRes.error) setError("Some dashboard information could not be loaded. Check your connection and try again.");
      } catch {
        if (alive) setError("We couldn’t load your dashboard. Check your connection and try again.");
      } finally {
        if (alive) setLoading(false);
      }
    };
    identityApi.getSession().then(({ data }) => {
      if (!alive) return;
      if (data.session) void load(data.session.user.id, data.session.user.email);
      else setLoading(false);
    }).catch(() => {
      if (alive) {
        setError("We couldn’t verify your session. Please refresh and try again.");
        setLoading(false);
      }
    });
    const { data } = identityApi.onAuthStateChange((_event, nextSession) => {
      if (nextSession) {
        setLoading(true);
        window.setTimeout(() => { if (alive) void load(nextSession.user.id, nextSession.user.email); }, 0);
      } else { setLoading(false); }
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
    ...(isDeveloper || isAdmin
      ? [{ label: "Discover Apps", icon: "search", href: "/apps" }]
      : [{ label: "Discover Tests", icon: "search", href: "/discover-tests" }]),
    { label: "My Tests", icon: "tests", href: "/my-tests" },
    { label: "Leaderboard", icon: "trophy", href: "/leaderboard" },
    { label: "Activity & History", icon: "chart", href: "/activity-history" },
    { label: "Check-in History", icon: "calendar", href: "/check-in-history" },
    { label: "Feedback History", icon: "star", href: "/feedback-history" },
    { label: "Notifications", icon: "bell", href: "/notifications" },
    { label: "Wallet & Rewards", icon: "wallet", href: "/wallet-rewards" },
    { label: "Referral Program", icon: "users", href: "/referral-program" },
    ...(isAdmin ? [{ label: "Admin", icon: "shield", href: "/admin" }] : [])
  ];

  if (loading) return <div className="td-loading"><span className="td-spinner"/>Loading your dashboard…</div>;

  return <div className="td-dashboard">
    <TesterSidebar nav={nav} name={name} firstName={firstName} avatar={avatar} roles={roles} isAdmin={isAdmin} isDeveloper={isDeveloper} workspaceMenuOpen={workspaceMenuOpen} setWorkspaceMenuOpen={setWorkspaceMenuOpen} previewMode={previewMode} />

    <main className="td-main">
      <RoleAccessNotice />
      <header className="td-topbar">
        <label className="td-search"><Icon name="search" size={21}/><input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search tests, topics, or skills…"/></label>
        <div className="td-top-actions"><button className="td-notification" onClick={() => setNoticeOpen(!noticeOpen)} aria-label="Notifications"><Icon name="bell" size={22}/>{notifications > 0 && <i>{notifications > 9 ? "9+" : notifications}</i>}</button><span className="td-top-divider"/><Link to="/profile" className="td-profile-short"><span>{avatar ? <img src={avatar} alt=""/> : firstName.slice(0,2).toUpperCase()}</span><b>⌄</b></Link></div>
        {noticeOpen && <div className="td-notice-pop"><strong>{notifications ? `${notifications} unread notifications` : "You're all caught up"}</strong><p>{notifications ? "Open your notifications center to review updates." : "New updates will appear here."}</p><Link to="/notifications">View all notifications <Icon name="arrow" size={14}/></Link></div>}
      </header>

      <section className="td-welcome-banner">
        <div className="td-banner-copy"><h1><span>👋</span> Welcome back, {firstName}!</h1><p>Keep going! Discover new tests and track your progress.</p><Link to="/discover-tests">Discover Tests <Icon name="arrow" size={17}/></Link></div>
        <div className="td-banner-art"><Mascot/></div>
      </section>

      {error && <div className="td-error">{error}</div>}

      <section className="td-stat-grid" aria-label="Your statistics">
        <article className="td-stat-card lavender"><span className="td-stat-icon"><Icon name="tests" size={34}/></span><div><strong>{animatedStats.available}</strong><b>Available Tests</b><small>Explore and start testing</small></div><Link to="#my-tests" aria-label="Explore tests"><Icon name="arrow"/></Link></article>
        <article className="td-stat-card mint"><span className="td-stat-icon"><Icon name="tests" size={34}/></span><div><strong>{animatedStats.completed}</strong><b>Completed</b><small>Great job · {stats.checkins} check-ins</small></div><a href="#my-tests" aria-label="View completed"><Icon name="arrow"/></a></article>
        <article className="td-stat-card sky"><span className="td-stat-icon"><Icon name="play" size={34}/></span><div><strong>{stats.active}</strong><b>Active Assignments</b><small>Continue your current tests</small></div><Link to="/my-tests" aria-label="View active tests"><Icon name="arrow"/></Link></article>
        <article className="td-stat-card gold"><span className="td-stat-icon"><Icon name="star" size={34}/></span><div><strong>{animatedStats.points.toLocaleString()}</strong><b>Points</b><small>Earn more points</small></div><a href="#rewards" aria-label="View rewards"><Icon name="arrow"/></a></article>
      </section>

      <section className="td-active-summary" aria-label="Your testing journey">
        <div className="td-active-summary-icon"><Icon name="calendar" size={22}/></div>
        <div className="td-active-summary-copy">
          <strong>Your testing journey</strong>
          <p>{stats.active ? `You have ${stats.active} active assignment${stats.active === 1 ? "" : "s"}. Keep up with each required daily check-in and submit useful feedback.` : "You don’t have an active assignment yet. Discover a test cycle and join when you’re ready."}</p>
          <small>TestDZ completion is based on the required consecutive daily check-ins and feedback for each assignment.</small>
        </div>
        <Link to={stats.active ? "/my-tests" : "/discover-tests"}>{stats.active ? "Continue testing" : "Find a test"} <Icon name="arrow" size={15}/></Link>
      </section>

      <section className="td-assignment-journey-grid" aria-label="Active testing assignments and check-in progress">
        <article className="td-panel td-assignments-panel">
          <div className="td-panel-heading"><h2><Icon name="tests" size={22}/>Active Testing Assignments</h2><Link to="/my-tests">View All <Icon name="arrow" size={15}/></Link></div>
          {activeAssignments.length ? <div className="td-assignment-list">{activeAssignments.map((assignment) => { const count = assignment.checkins?.length ?? 0; const pct = Math.min(100, Math.round(count / 14 * 100)); return <div className="td-assignment-row" key={assignment.id}><span className="td-assignment-app"><Icon name="play" size={22}/></span><div className="td-assignment-info"><strong>{assignment.test?.title || "Active test assignment"}</strong><small>{assignment.test?.app?.name || "TestDZ"} · {count}/14 daily check-ins</small><div className="td-assignment-progress"><i style={{ width: `${pct}%` }}/></div></div><div className="td-assignment-percent"><b>{pct}%</b><small>{assignment.test?.end_date ? `${Math.max(0, Math.ceil((new Date(`${assignment.test.end_date}T23:59:59`).getTime()-Date.now())/86400000))} days left` : "In progress"}</small></div></div>; })}</div> : <div className="td-empty-assignment"><strong>No active assignments yet</strong><p>Join a test cycle to see your tasks and daily check-in progress here.</p><Link to="/discover-tests">Discover Tests <Icon name="arrow" size={14}/></Link></div>}
        </article>
        <article className="td-panel td-journey-panel"><div className="td-panel-heading"><h2><Icon name="trophy" size={22}/>Testing Milestones</h2></div><div className="td-milestone-progress"><div className="td-milestone-ring" style={{ "--milestone-progress": `${Math.min(100, Math.round(stats.checkins / 14 * 100)) * 3.6}deg` } as CSSProperties & { "--milestone-progress": string }}><strong>{Math.min(100, Math.round(stats.checkins / 14 * 100))}%</strong></div><div className="td-milestone-list"><div className={stats.checkins >= 14 ? "done" : "current"}><span><Icon name={stats.checkins >= 14 ? "check" : "calendar"} size={16}/></span><p><b>Complete 14 daily check-ins</b><small>{Math.min(stats.checkins,14)} of 14 recorded</small></p></div><div className={stats.completed >= 10 ? "done" : ""}><span><Icon name="tests" size={16}/></span><p><b>Finish 10 tests</b><small>{stats.completed} completed</small></p></div><div className={stats.points >= 1000 ? "done" : ""}><span><Icon name="star" size={16}/></span><p><b>Reach 1,000 points</b><small>{stats.points.toLocaleString()} points earned</small></p></div></div></div><Link className="td-milestone-cta" to="/check-in-history">View Check-in History <Icon name="arrow" size={14}/></Link></article>
      </section>

      <section className="td-middle-grid">
        <article className="td-panel td-progress-panel" id="progress">
          <div className="td-panel-heading"><h2><Icon name="chart" size={22}/>Completion Progress</h2><div className="td-range">{["1W","1M","3M","1Y"].map((item) => <button key={item} onClick={() => setRange(item)} className={range === item ? "selected" : ""}>{item}</button>)}</div></div>
          <div className="td-progress-content"><div className="td-progress-ring" style={{ "--progress": `${progress * 3.6}deg` } as CSSProperties & { "--progress": string }}><div><strong>{animatedStats.success}%</strong><b>Overall<br/>Progress</b></div></div><div className="td-chart-area"><div className="td-chart-labels"><span>100%</span><span>75%</span><span>50%</span><span>25%</span><span>0%</span></div><svg viewBox="0 0 560 180" preserveAspectRatio="none" className="td-line-chart" aria-label="Progress chart"><defs><linearGradient id="td-chart-fill" x1="0" x2="0" y1="0" y2="1"><stop offset="0%" stopColor="#1764ef" stopOpacity=".22"/><stop offset="100%" stopColor="#1764ef" stopOpacity=".02"/></linearGradient></defs>{[10,48,86,124,162].map(y=><line key={y} x1="0" y1={y} x2="560" y2={y} stroke="#dce6f5" strokeWidth="1"/>) }<path d={chartArea} fill="url(#td-chart-fill)"/><path d={chartLine} fill="none" stroke="#1764ef" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"/>{chartPoints.map((point,index)=><circle key={index} cx={index*93.33} cy={162-point*1.35} r="5" fill="#1764ef"/>)}</svg><div className="td-chart-days">{chartLabels.map(d=><span key={d}>{d}</span>)}</div><b className="td-chart-bubble">{progress}%</b></div></div>
          <div className="td-track-pill"><span>🏆</span><div><strong>{stats.assignments ? "On track!" : "Your journey starts here"}</strong><small>{stats.assignments ? `${stats.completed} of ${stats.assignments} tests completed` : "Join a test to start building progress"}</small></div></div>
        </article>

        <article className="td-panel td-quick-panel"><div className="td-panel-heading"><h2><Icon name="bolt" size={22}/>Quick Actions</h2></div><div className="td-quick-grid">
          <Link to={isDeveloper || isAdmin ? "/apps" : "/my-tests"} className="td-quick-action blue"><span><Icon name="play" size={23}/></span><div><strong>{isDeveloper ? "Create an App" : "Start a Test"}</strong><small>{isDeveloper ? "Publish your next app" : "Begin a new test"}</small></div><Icon name="arrow" size={18}/></Link>
          <Link to={isDeveloper || isAdmin ? "/apps" : "/discover-tests"} className="td-quick-action violet"><span><Icon name="search" size={25}/></span><div><strong>Discover Tests</strong><small>Find best topics</small></div><Icon name="arrow" size={18}/></Link>
          <a href="#my-tests" className="td-quick-action green"><span><Icon name="chart" size={23}/></span><div><strong>View My Tests</strong><small>Track your results</small></div><Icon name="arrow" size={18}/></a>
          <Link to="/profile" className="td-quick-action amber"><span><Icon name="wallet" size={23}/></span><div><strong>Manage Account</strong><small>Update your profile</small></div><Icon name="arrow" size={18}/></Link>
        </div></article>
      </section>

      <section className="td-bottom-grid">
        <article className="td-panel td-discover-panel" id="my-tests"><div className="td-panel-heading"><h2><Icon name="star" size={22}/>Available Test Cycles</h2><Link to="/discover-tests">View All <Icon name="arrow" size={15}/></Link></div>
          {filteredTests.length ? <div className="td-test-grid">{filteredTests.slice(0,4).map((test,index)=><article className="td-test-card" key={test.id}><div className={`td-test-art art-${index}`}>{test.app?.icon_url ? <img src={test.app.icon_url} alt=""/> : index===0 ? <Icon name="code" size={35}/> : index===1 ? <b>Py</b> : index===2 ? <b>⚛</b> : <b>▤</b>}</div><strong>{test.title}</strong><small>{test.app?.name ?? "TestDZ community"} · {test.min_testers} testers</small><div className="td-test-meta"><span>● {test.status.replace("_"," ")}</span><span><Icon name="clock" size={13}/> Open</span></div><Link to="/my-tests">My Tests <Icon name="arrow" size={14}/></Link></article>)}</div> : <div className="td-empty-tests"><span><Icon name="flask" size={28}/></span><strong>{search ? "No tests match your search" : "New tests are on the way"}</strong><p>{search ? "Try another topic or skill." : "Explore the app directory and check back as developers publish new test cycles."}</p><Link to="/discover-tests">Discover Tests <Icon name="arrow" size={15}/></Link></div>}
        </article>
        <article className="td-panel td-rewards-panel" id="rewards"><div className="td-panel-heading"><h2><span className="td-gift"><Icon name="gift" size={20}/></span>Your Rewards</h2><a href="#rewards">View All <Icon name="arrow" size={15}/></a></div><div className="td-reward-content"><div className="td-trophy-visual"><Icon name="trophy" size={76}/><span>✦</span></div><div><strong>You've earned<br/>{animatedStats.points.toLocaleString()} points!</strong><p>Keep going to unlock more rewards and badges.</p><Link to="/profile">View Profile <Icon name="arrow" size={14}/></Link></div></div></article>
      </section>
      <footer className="td-footer">{previewMode ? "Preview only · sample data · no account changes" : `© ${new Date().getFullYear()} TestDZ · Test · Learn · Grow`}</footer>
    </main>
  </div>;
}
