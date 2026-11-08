import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import type { Session } from "@supabase/supabase-js";
import { supabase } from "../lib/supabase";
import "./TesterDashboard.css";

type Assignment = {
  id: string;
  status: string;
  start_date: string | null;
  completed_at: string | null;
  tests: { id: string; title: string; description: string | null; status: string; apps: { name: string } | null } | null;
};
type TestItem = {
  id: string;
  title: string;
  description: string | null;
  status: string;
  apps: { name: string } | null;
};
type Profile = { display_name: string | null; avatar_url: string | null };
type Notice = { id: string; title: string; body: string; created_at: string; read_at: string | null };

const dayNames = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const dateKey = (date: Date) => date.toISOString().slice(0, 10);
const greetingName = (name: string | null, email: string) =>
  name?.trim() || email.split("@")[0] || "Tester";

function Icon({ children }: { children: React.ReactNode }) {
  return <span className="td-icon" aria-hidden="true">{children}</span>;
}

export default function TesterDashboard({ session }: { session: Session }) {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [tests, setTests] = useState<TestItem[]>([]);
  const [notices, setNotices] = useState<Notice[]>([]);
  const [points, setPoints] = useState(0);
  const [weekly, setWeekly] = useState<number[]>(Array(7).fill(0));
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [showNotifications, setShowNotifications] = useState(false);
  const [loadError, setLoadError] = useState("");

  useEffect(() => {
    let alive = true;
    async function load() {
      if (!supabase) { setLoading(false); setLoadError("الاتصال بقاعدة البيانات غير مضبوط."); return; }
      const userId = session.user.id;
      const [profileRes, assignmentRes, testsRes, walletRes, noticeRes, checkinRes] = await Promise.all([
        supabase.from("profiles").select("display_name,avatar_url").eq("id", userId).maybeSingle(),
        supabase.from("assignments").select("id,status,start_date,completed_at,tests(id,title,description,status,apps(name))").eq("tester_id", userId).order("created_at", { ascending: false }).limit(8),
        supabase.from("tests").select("id,title,description,status,apps(name)").in("status", ["recruiting", "ready", "running"]).order("created_at", { ascending: false }).limit(8),
        supabase.from("wallets").select("earned_points").eq("user_id", userId).maybeSingle(),
        supabase.from("notifications").select("id,title,body,created_at,read_at").eq("user_id", userId).order("created_at", { ascending: false }).limit(5),
        supabase.from("checkins").select("checkin_date").eq("tester_id", userId).gte("checkin_date", dateKey(new Date(Date.now() - 6 * 86400000)))
      ]);
      if (!alive) return;
      if (profileRes.error || assignmentRes.error || testsRes.error) {
        setLoadError("تعذر تحميل بعض بيانات لوحة المختبِر. تحقق من اتصال Supabase وسياسات الوصول.");
      }
      setProfile(profileRes.data ?? null);
      setAssignments((assignmentRes.data ?? []) as unknown as Assignment[]);
      setTests((testsRes.data ?? []) as unknown as TestItem[]);
      setPoints(Number(walletRes.data?.earned_points ?? 0));
      setNotices((noticeRes.data ?? []) as Notice[]);
      const counts = Array(7).fill(0) as number[];
      const today = new Date();
      const mondayOffset = (today.getDay() + 6) % 7;
      (checkinRes.data ?? []).forEach((row: { checkin_date: string }) => {
        const d = new Date(row.checkin_date + "T12:00:00");
        const offset = (d.getDay() + 6) % 7;
        const index = 6 - ((mondayOffset - offset + 7) % 7);
        if (index >= 0 && index < 7) counts[index] += 1;
      });
      setWeekly(counts);
      setLoading(false);
    }
    load();
    return () => { alive = false; };
  }, [session.user.id]);

  const completed = assignments.filter(item => item.status === "completed").length;
  const active = assignments.filter(item => item.status === "active").length;
  const completionRate = assignments.length ? Math.round((completed / assignments.length) * 100) : 0;
  const filteredTests = useMemo(() => tests.filter(test =>
    (test.title + " " + (test.description ?? "") + " " + (test.apps?.name ?? "")).toLowerCase().includes(query.toLowerCase())
  ), [tests, query]);
  const maxWeekly = Math.max(1, ...weekly);
  const name = greetingName(profile?.display_name ?? session.user.user_metadata?.full_name ?? null, session.user.email ?? "");
  const unread = notices.filter(item => !item.read_at).length;

  async function signOut() { await supabase?.auth.signOut(); }

  if (loading) return <div className="td-loading"><span className="td-spinner" /> جارٍ تجهيز لوحة المختبِر...</div>;

  return (
    <main className="td-app">
      <aside className="td-sidebar">
        <Link className="td-brand" to="/dashboard"><span className="td-brand-mark">⚗</span><span><b>TestDZ</b><small>Test · Learn · Grow</small></span></Link>
        <nav className="td-nav" aria-label="القائمة الرئيسية">
          <a className="active" href="#top"><Icon>⌂</Icon>Dashboard</a>
          <a href="#discover-tests"><Icon>⌕</Icon>Discover</a>
          <a href="#my-tests"><Icon>▣</Icon>My Tests</a>
          <a href="#rewards"><Icon>▤</Icon>Billing & Rewards</a>
        </nav>
        <div className="td-sidebar-promo"><div className="td-rocket">🚀</div><h3>Build Better Together</h3><p>Create tests, help the community, and grow with TestDZ!</p><a href="#discover-tests">Explore More <span>→</span></a></div>
        <div className="td-sidebar-user">
          <div className="td-avatar">{profile?.avatar_url ? <img src={profile.avatar_url} alt="" /> : name.slice(0, 1).toUpperCase()}</div>
          <div className="td-user-meta"><b>{name}</b><small>Tester</small></div>
          <Link to="/profile" className="td-settings" aria-label="إعدادات الملف الشخصي">⚙</Link>
        </div>
        <button className="td-signout" onClick={signOut}><span>⇥</span> Sign Out</button>
      </aside>

      <section className="td-main" id="top">
        <header className="td-topbar">
          <label className="td-search"><span>⌕</span><input value={query} onChange={event => setQuery(event.target.value)} placeholder="Search tests, topics, or skills..." aria-label="Search tests, topics, or skills" /></label>
          <div className="td-top-actions">
            <div className="td-notice-wrap">
              <button className="td-notice-button" onClick={() => setShowNotifications(value => !value)} aria-label="Notifications">♧{unread > 0 && <i>{unread}</i>}</button>
              {showNotifications && <div className="td-notice-popover"><b>Notifications</b>{notices.length ? notices.map(item => <div className="td-notice-item" key={item.id}><strong>{item.title}</strong><span>{item.body}</span></div>) : <p>لا توجد إشعارات حالياً.</p>}</div>}
            </div>
            <span className="td-top-divider" />
            <Link to="/profile" className="td-top-avatar">{name.slice(0, 2).toUpperCase()}</Link>
            <span className="td-chevron">⌄</span>
          </div>
        </header>

        <div className="td-content">
          {loadError && <div className="td-inline-warning" role="status">{loadError}</div>}
          <section className="td-hero">
            <div className="td-hero-copy"><div className="td-hero-title">👋 Welcome back, {name}!</div><p>Keep going! Discover new tests and track your progress.</p><a href="#discover-tests" className="td-white-button">Explore Tests <span>→</span></a></div>
            <div className="td-hero-art" aria-hidden="true"><div className="td-art-orbit" /><div className="td-art-check td-art-check-one">✓ <i>Task completed</i></div><div className="td-art-check td-art-check-two">✓ <i>Great progress</i></div><div className="td-art-person"><div className="td-person-hair" /><div className="td-person-face"><span className="td-glasses">◉ ◉</span><span className="td-smile">⌣</span></div><div className="td-person-body"><b>TestDZ</b></div></div><div className="td-art-chart">▂ ▅ ▇</div></div>
          </section>

          <section className="td-stats" aria-label="Your statistics">
            <article className="td-stat td-stat-purple"><div className="td-stat-icon">⚗</div><div><strong>{tests.length}</strong><b>Available Tests</b><small>Explore and start testing</small></div><span className="td-stat-arrow">→</span></article>
            <article className="td-stat td-stat-green"><div className="td-stat-icon">✓</div><div><strong>{completed}</strong><b>Completed</b><small>Great job!</small></div><span className="td-stat-arrow">→</span></article>
            <article className="td-stat td-stat-blue"><div className="td-stat-icon">▥</div><div><strong>{assignments.length ? completionRate + "%" : "—"}</strong><b>Success Rate</b><small>{assignments.length ? "Your completion rate" : "No test data yet"}</small></div><span className="td-stat-arrow">→</span></article>
            <article className="td-stat td-stat-yellow"><div className="td-stat-icon">★</div><div><strong>{points.toLocaleString()}</strong><b>Points</b><small>Earn more points</small></div><span className="td-stat-arrow">→</span></article>
          </section>

          <section className="td-middle-grid">
            <article className="td-panel td-progress-panel">
              <div className="td-panel-heading"><h2><span>⌁</span> Your Progress</h2><span className="td-period-pill">Last 7 days</span></div>
              <div className="td-progress-content"><div className="td-ring-wrap"><div className="td-progress-ring" style={{ "--progress": completionRate } as React.CSSProperties}><div><strong>{assignments.length ? completionRate + "%" : "—"}</strong><b>Overall<br />Progress</b></div></div><span className="td-track-label">🏆 {active ? "On track!" : "Keep going!"}</span></div><div className="td-chart" role="img" aria-label="Daily check-ins over the last seven days"><div className="td-chart-y"><span>{maxWeekly}</span><span>{Math.ceil(maxWeekly * .66)}</span><span>{Math.ceil(maxWeekly * .33)}</span><span>0</span></div><div className="td-chart-plot"><div className="td-chart-grid"><i /><i /><i /><i /></div><svg viewBox="0 0 600 180" preserveAspectRatio="none"><defs><linearGradient id="tdChartFill" x1="0" x2="0" y1="0" y2="1"><stop offset="0%" stopColor="#1769ed" stopOpacity=".22" /><stop offset="100%" stopColor="#1769ed" stopOpacity="0" /></linearGradient></defs><polygon points={weekly.map((value, index) => `${index * 100},${165 - (value / maxWeekly) * 135}`).join(" ") + " 600,180 0,180"} fill="url(#tdChartFill)" /><polyline points={weekly.map((value, index) => `${index * 100},${165 - (value / maxWeekly) * 135}`).join(" ")} fill="none" stroke="#1769ed" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" />{weekly.map((value, index) => <circle key={index} cx={index * 100} cy={165 - (value / maxWeekly) * 135} r="5" fill="#fff" stroke="#1769ed" strokeWidth="4" />)}</svg><div className="td-chart-days">{dayNames.map(day => <span key={day}>{day}</span>)}</div></div></div></div>
            </article>
            <article className="td-panel td-quick-panel"><div className="td-panel-heading"><h2><span>ϟ</span> Quick Actions</h2></div><div className="td-quick-grid"><a href="#discover-tests" className="td-quick td-quick-blue"><span>▶</span><b>Discover Tests<small>Find best topics</small></b><i>→</i></a><a href="#my-tests" className="td-quick td-quick-purple"><span>⌕</span><b>View My Tests<small>Track your results</small></b><i>→</i></a><a href="#rewards" className="td-quick td-quick-green"><span>▥</span><b>My Progress<small>Keep your streak</small></b><i>→</i></a><Link to="/profile" className="td-quick td-quick-yellow"><span>▤</span><b>My Profile<small>Manage your account</small></b><i>→</i></Link></div></article>
          </section>

          <section className="td-bottom-grid">
            <article className="td-panel td-discover-panel" id="discover-tests"><div className="td-panel-heading"><h2><span>☆</span> Discover New Tests</h2><span className="td-section-count">{filteredTests.length} available</span></div>{filteredTests.length ? <div className="td-test-grid">{filteredTests.slice(0, 4).map((test, index) => <div className="td-test-card" key={test.id}><div className={"td-test-logo td-test-logo-" + (index % 4)}>{["⌘","Py","⚛","▤"][index % 4]}</div><h3>{test.title}</h3><p>{test.apps?.name ?? "Android app test"}</p><div className="td-test-meta"><span>● {test.status.replace("_", " ")}</span><span>◷ Test cycle</span></div><Link to="/dashboard#my-tests" className="td-test-button">View test <span>→</span></Link></div>)}</div> : <div className="td-empty"><span>⚗</span><b>No tests available yet</b><p>When developers publish test cycles, they will appear here.</p></div>}</article>
            <article className="td-panel td-rewards-panel" id="rewards"><div className="td-panel-heading"><h2><span>♔</span> Your Rewards</h2></div><div className="td-reward-content"><div className="td-trophy">🏆</div><div><strong>{points.toLocaleString()} points earned!</strong><p>Keep going to unlock more rewards and badges.</p><span className="td-reward-caption">Your points balance from TestDZ</span></div></div></article>
          </section>

          <section className="td-panel td-my-tests" id="my-tests"><div className="td-panel-heading"><h2><span>▣</span> My Tests</h2><span className="td-section-count">{assignments.length} assignments</span></div>{assignments.length ? <div className="td-assignment-list">{assignments.map(item => <article className="td-assignment" key={item.id}><div className="td-assignment-icon">⚗</div><div className="td-assignment-copy"><b>{item.tests?.title ?? "Assigned test"}</b><small>{item.tests?.apps?.name ?? "Android application"}</small></div><span className={"td-status td-status-" + item.status}>{item.status.replace("_", " ")}</span></article>)}</div> : <div className="td-empty td-empty-compact"><b>No assigned tests yet</b><p>Your assignments will appear here when you join a test cohort.</p></div>}</section>
          <footer className="td-footer">© 2026 TestDZ · Test · Learn · Grow</footer>
        </div>
      </section>
    </main>
  );
}
