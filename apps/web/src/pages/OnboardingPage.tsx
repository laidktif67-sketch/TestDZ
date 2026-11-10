import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Brand } from "../components/Brand";
import { supabase } from "../lib/supabase";
import "../styles/onboarding.css";

const roles = [
  { value: "tester", title: "مختبِر", subtitle: "شارك في اختبار التطبيقات، واكسب النقاط وساعدنا على تحسين المنتجات.", icon: "tester" },
  { value: "developer", title: "مطوّر", subtitle: "انشر تطبيقاتك وأنشئ حملات اختبار واحصل على آراء المستخدمين.", icon: "developer" },
  { value: "both", title: "كلاهما", subtitle: "استخدم المنصة كمختبِر ومطوّر في الوقت نفسه.", icon: "both" },
] as const;

const interestsList = ["أدوات وإنتاجية", "تعليم", "ألعاب", "تجارة إلكترونية", "صحة ولياقة", "شبكات اجتماعية", "أخرى"];

function RoleIllustration({ type }: { type: "tester" | "developer" | "both" }) {
  if (type === "tester") return (
    <svg viewBox="0 0 180 150" aria-hidden="true">
      <ellipse cx="88" cy="127" rx="68" ry="12" fill="#dcecff" />
      <rect x="42" y="23" width="83" height="105" rx="12" fill="#1686f8" transform="rotate(-5 42 23)" />
      <rect x="50" y="31" width="68" height="89" rx="8" fill="#fff" transform="rotate(-5 50 31)" />
      <path d="M68 55l7 7 12-15M68 79l7 7 12-15M68 102l7 7 12-15" fill="none" stroke="#1686f8" strokeWidth="5" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M94 56h12M94 80h12M94 103h9" stroke="#a9c9ef" strokeWidth="5" strokeLinecap="round" />
      <circle cx="128" cy="91" r="25" fill="#d8edff" stroke="#0875ed" strokeWidth="8" />
      <path d="M146 109l19 20" stroke="#0875ed" strokeWidth="10" strokeLinecap="round" />
      <circle cx="84" cy="19" r="7" fill="#48b7ff" />
    </svg>
  );
  if (type === "developer") return (
    <svg viewBox="0 0 180 150" aria-hidden="true">
      <ellipse cx="90" cy="127" rx="72" ry="12" fill="#dcecff" />
      <rect x="31" y="27" width="111" height="76" rx="9" fill="#0875ed" />
      <rect x="39" y="35" width="95" height="59" rx="4" fill="#1245bb" />
      <path d="M72 52l-13 11 13 11M100 52l13 11-13 11M91 47l-9 32" fill="none" stroke="#fff" strokeWidth="5" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M20 106h134l-13 12H33z" fill="#55b7ff" />
      <circle cx="143" cy="91" r="20" fill="#d6eaff" stroke="#0875ed" strokeWidth="7" />
      <circle cx="143" cy="91" r="6" fill="#0875ed" />
      <path d="M143 65v-8M143 125v-8M117 91h-8M177 91h-8M125 73l-6-6M167 115l-6-6M161 73l6-6M119 115l6-6" stroke="#0875ed" strokeWidth="5" strokeLinecap="round" />
    </svg>
  );
  return (
    <svg viewBox="0 0 180 150" aria-hidden="true">
      <ellipse cx="90" cy="128" rx="70" ry="12" fill="#dcecff" />
      <path d="M90 17l13 27 30 4-22 21 5 30-26-14-27 14 6-30-22-21 30-4z" fill="#ffbf32" stroke="#f3a900" strokeWidth="3" strokeLinejoin="round" />
      <ellipse cx="90" cy="112" rx="62" ry="18" fill="#0875ed" />
      <path d="M28 112v10c0 10 28 18 62 18s62-8 62-18v-10c-12 10-112 10-124 0z" fill="#0756cf" />
      <path d="M34 44l4 8 8 4-8 4-4 8-4-8-8-4 8-4zM145 31l4 8 8 4-8 4-4 8-4-8-8-4 8-4z" fill="#ffd45a" />
    </svg>
  );
}

function ProgressSteps() {
  return <div className="onboarding-progress" aria-label="الخطوة 3 من 4">
    <span className="done"><b>✓</b></span><i />
    <span className="done"><b>✓</b></span><i />
    <span className="current">3</span><i />
    <span className="upcoming">4</span>
  </div>;
}

function SideArtwork() {
  return <aside className="onboarding-art" aria-hidden="true">
    <div className="art-dots art-dots-top" />
    <div className="art-orbit" />
    <div className="art-rocket"><span className="rocket-window" /><i /><b /></div>
    <div className="art-laptop"><div className="laptop-screen"><span>⚗</span></div><div className="laptop-base" /></div>
    <span className="art-code">&lt;/&gt;</span><span className="art-star">★</span>
    <p>اختبر. تعلّم. انمُ.</p>
    <div className="art-dots art-dots-bottom" />
  </aside>;
}

export default function OnboardingPage() {
  const navigate = useNavigate();
  const [choice, setChoice] = useState("tester");
  const [interests, setInterests] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!supabase) return;
    supabase.auth.getSession().then(({ data }) => {
      if (!data.session) {
        navigate("/auth", { replace: true });
        return;
      }
      const preferredRole = data.session.user.user_metadata?.account_type;
      if (preferredRole === "tester" || preferredRole === "developer" || preferredRole === "both") {
        setChoice(preferredRole);
      }
    });
  }, [navigate]);

  function toggle(item: string) {
    setInterests(current => current.includes(item) ? current.filter(x => x !== item) : current.length < 7 ? [...current, item] : current);
  }

  async function finish() {
    if (!supabase) {
      setError("إعداد Supabase غير مكتمل.");
      return;
    }
    setBusy(true);
    setError("");
    const rolesToSave = choice === "both" ? ["tester", "developer"] : [choice];
    const { error: err } = await supabase.rpc("complete_onboarding", { p_roles: rolesToSave, p_interests: interests });
    if (err) setError("تعذر حفظ إعدادات الحساب. حاول مرة أخرى.");
    else navigate("/dashboard", { replace: true });
    setBusy(false);
  }

  return <main className="onboarding-page" dir="rtl">
    <header className="onboarding-header">
      <Brand />
      <div className="onboarding-language"><span>◎</span> العربية <span className="language-chevron">⌄</span></div>
    </header>
    <SideArtwork />
    <section className="onboarding-main">
      <ProgressSteps />
      <div className="onboarding-heading">
        <span className="onboarding-kicker">الخطوة الثالثة · إعداد حسابك</span>
        <h1>اختر نوع حسابك</h1>
        <p>اختر الدور الذي يصفك بشكل أفضل. يمكنك تغيير ذلك لاحقاً من إعدادات حسابك.</p>
      </div>
      <div className="onboarding-role-grid">
        {roles.map(role => <button
          type="button"
          key={role.value}
          className={`onboarding-role-card ${choice === role.value ? "is-selected" : ""}`}
          aria-pressed={choice === role.value}
          onClick={() => setChoice(role.value)}
        >
          <span className="role-check" aria-hidden="true">✓</span>
          <span className="role-art"><RoleIllustration type={role.icon} /></span>
          <strong>{role.title}</strong>
          <span className="role-description">{role.subtitle}</span>
        </button>)}
      </div>
      <section className="onboarding-interests">
        <h2>ما المجالات التي تهمك؟ <small>اختياري</small></h2>
        <div className="onboarding-interest-list">
          {interestsList.map(item => <button type="button" key={item} className={interests.includes(item) ? "active" : ""} aria-pressed={interests.includes(item)} onClick={() => toggle(item)}>{item}</button>)}
        </div>
      </section>
      {error && <div className="notice notice-error onboarding-error" role="alert">{error}</div>}
      <div className="onboarding-actions">
        <button className="onboarding-continue" disabled={busy} onClick={finish}>{busy ? "جارٍ الحفظ..." : "متابعة"} <span aria-hidden="true">←</span></button>
        <button className="onboarding-skip" type="button" onClick={() => { setChoice("tester"); setInterests([]); }}>تخطي الآن</button>
      </div>
    </section>
  </main>;
}
