import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { supabase } from "../../../lib/supabase";
import { useIdentity } from "../../../shared/auth/hooks/useIdentity";
import TesterSidebar, { Icon } from "../components/TesterSidebar";
import "../styles/tester-dashboard.css";
import "../styles/discover-tests.css";

type TestDetails = {
  id: string;
  title: string;
  description: string | null;
  status: string;
  min_testers: number;
  start_date: string | null;
  end_date: string | null;
  app: { name: string; icon_url: string | null; category: string | null } | null;
};

function dateLabel(value: string | null) {
  if (!value) return "To be announced";
  const date = new Date(value + "T00:00:00");
  return Number.isNaN(date.getTime()) ? "To be announced" : date.toLocaleDateString();
}

export default function TestDetailsPage() {
  const { id } = useParams();
  const { roles = [] } = useIdentity();
  const [test, setTest] = useState<TestDetails | null>(null);
  const [name, setName] = useState("Tester");
  const [avatar, setAvatar] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    setLoading(true);
    setError("");
    setTest(null);

    const client = supabase;
    if (!client || !id) {
      setError("This test could not be loaded.");
      setLoading(false);
      return;
    }

    let alive = true;
    const load = async () => {
      try {
        const { data: sessionData, error: sessionError } = await client.auth.getSession();
        if (sessionError) throw sessionError;
        const currentUserId = sessionData.session?.user.id;
        if (sessionData.session) {
          const { data: profile } = await client
            .from("profiles")
            .select("display_name,avatar_url")
            .eq("id", sessionData.session.user.id)
            .maybeSingle();
          if (alive && profile) {
            setName(profile.display_name?.trim() || sessionData.session.user.email?.split("@")[0] || "Tester");
            setAvatar(profile.avatar_url || "");
          }
        }

        const { data, error: queryError } = await client
          .from("tests")
          .select("id,title,description,status,min_testers,start_date,end_date,app:apps(name,icon_url,category)")
          .eq("id", id)
          .maybeSingle();

        if (queryError) throw queryError;
        if (!alive) return;
        if (!data) {
          setError("This opportunity is no longer available.");
          setTest(null);
        } else if (data.status === "recruiting" || data.status === "ready") {
          setTest(data as unknown as TestDetails);
        } else if (data.status === "running" && currentUserId) {
          const { data: assignment, error: assignmentError } = await client
            .from("assignments")
            .select("id")
            .eq("tester_id", currentUserId)
            .eq("test_id", id)
            .eq("status", "active")
            .maybeSingle();

          if (assignmentError) throw assignmentError;
          if (!alive) return;
          if (assignment) {
            setTest(data as unknown as TestDetails);
          } else {
            setError("This opportunity is no longer available.");
            setTest(null);
          }
        } else {
          setError("This opportunity is no longer available.");
          setTest(null);
        }
      } catch {
        if (alive) setError("We couldn’t load this test. Return to opportunities and try again.");
      } finally {
        if (alive) setLoading(false);
      }
    };

    void load();
    return () => {
      alive = false;
    };
  }, [id]);

  const isAdmin = roles.includes("admin");
  const isDeveloper = roles.includes("developer");
  const nav = [
    { label: "Dashboard", icon: "flask", href: "/tester-dashboard" },
    { label: "Discover Tests", icon: "search", href: "/discover-tests" },
    { label: "My Tests", icon: "tests", href: "/my-tests" },
    { label: "Wallet & Rewards", icon: "wallet", href: "/wallet-rewards" }
  ];

  return (
    <div className="td-dashboard dt-page">
      <TesterSidebar
        nav={nav}
        name={name}
        firstName={name.split(/\s+/)[0] || "T"}
        avatar={avatar}
        roles={roles}
        isAdmin={isAdmin}
        isDeveloper={isDeveloper}
        workspaceMenuOpen={menuOpen}
        setWorkspaceMenuOpen={setMenuOpen}
        previewMode={false}
      />
      <main className="td-main dt-main">
        <header className="td-topbar">
          <Link className="dt-detail-back" to="/discover-tests">
            <Icon name="arrow" size={17} />
            Back to opportunities
          </Link>
        </header>
        <div className="dt-content">
          <section className="dt-hero">
            <div className="dt-hero-copy">
              <span className="dt-kicker"><i /> TEST OPPORTUNITY</span>
              <h1>Test details</h1>
              <p>Review the opportunity, requirements, and schedule before continuing your tester journey.</p>
            </div>
          </section>

          <div className="dt-detail-layout">
            {loading ? (
              <div className="dt-skeleton-grid" aria-busy="true" aria-label="Loading test details">
                <div className="dt-skeleton"><i /><b /><span /><span /></div>
              </div>
            ) : error ? (
              <div className="dt-empty" role="alert">
                <span><Icon name="search" size={25} /></span>
                <h3>Test unavailable</h3>
                <p>{error}</p>
                <Link className="dt-detail-action" to="/discover-tests">Browse opportunities</Link>
              </div>
            ) : test ? (
              <article className="dt-card dt-detail-card">
                <div className="dt-card-top">
                  <div className="dt-app-icon">
                    {test.app?.icon_url ? <img src={test.app.icon_url} alt="" /> : <span><Icon name="flask" size={22} /></span>}
                  </div>
                  <span className={"dt-status " + (test.status === "ready" ? "upcoming" : test.status === "running" ? "running" : "recruiting")}>
                    <i />{test.status === "ready" ? "Coming soon" : test.status === "running" ? "In progress" : "Recruiting"}
                  </span>
                </div>
                <div className="dt-card-heading">
                  <span>{test.app?.name || "TestDZ application"}</span>
                  <h2>{test.title}</h2>
                </div>
                <p className="dt-detail-description">
                  {test.description || "No additional description has been provided for this opportunity."}
                </p>
                <div className="dt-detail-meta">
                  <div><span>Minimum testers</span><strong>{test.min_testers}</strong></div>
                  <div><span>Start date</span><strong>{dateLabel(test.start_date)}</strong></div>
                  <div><span>End date</span><strong>{dateLabel(test.end_date)}</strong></div>
                </div>
                <p className="dt-detail-note">
                  {test.status === "running"
                    ? "This test is assigned to your account. This page shows the test brief; use My Tests to review your assignment."
                    : "Test assignments appear in My Tests when they are assigned to your account. Viewing this page does not enroll you in a test."}
                </p>
                <div className="dt-detail-actions">
                  <Link to="/discover-tests">Back to opportunities</Link>
                  <Link className="secondary" to="/my-tests">My tests</Link>
                </div>
              </article>
            ) : null}
          </div>
          <footer className="dt-footer">TestDZ <span>·</span> Test with purpose. Grow with every experience.</footer>
        </div>
      </main>
    </div>
  );
}
