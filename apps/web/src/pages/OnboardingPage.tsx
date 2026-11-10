import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Brand } from "../components/Brand";
import { supabase } from "../lib/supabase";
import "../styles/onboarding.css";

type OnboardingLanguage = "en" | "fr" | "ar";

const onboardingCopy = {
  en: {
    language: "Language", step: "Step 3 · Set up your account", title: "Choose Your Account Type",
    intro: "Select the role that best describes you. You can always change this later in your account settings.",
    tester: "Tester", testerBody: "Participate in tests, earn points and help improve products.",
    developer: "Developer", developerBody: "Publish your applications, create testing campaigns and get useful feedback.",
    both: "Both", bothBody: "Use the platform as both a tester and a developer.",
    interests: "What are you interested in?", optional: "Optional",
    interestNames: ["Tools & Productivity", "Education", "Gaming", "E-commerce", "Health & Fitness", "Social Media", "Other"],
    continue: "Continue", saving: "Saving...", skip: "Skip for now", errorConfig: "Supabase is not configured.",
    errorSave: "Could not save your account setup. Please try again.", progress: "Step 3 of 4"
  },
  fr: {
    language: "Langue", step: "Étape 3 · Configurez votre compte", title: "Choisissez votre type de compte",
    intro: "Sélectionnez le rôle qui vous décrit le mieux. Vous pourrez le modifier plus tard dans les paramètres.",
    tester: "Testeur", testerBody: "Participez aux tests, gagnez des points et contribuez à améliorer les produits.",
    developer: "Développeur", developerBody: "Publiez vos applications, créez des campagnes de test et recevez des avis utiles.",
    both: "Les deux", bothBody: "Utilisez la plateforme comme testeur et développeur.",
    interests: "Quels sont vos centres d’intérêt ?", optional: "Facultatif",
    interestNames: ["Outils et productivité", "Éducation", "Jeux", "E-commerce", "Santé et fitness", "Réseaux sociaux", "Autre"],
    continue: "Continuer", saving: "Enregistrement...", skip: "Passer pour le moment", errorConfig: "Supabase n’est pas configuré.",
    errorSave: "Impossible d’enregistrer votre compte. Veuillez réessayer.", progress: "Étape 3 sur 4"
  },
  ar: {
    language: "اختر اللغة", step: "الخطوة الثالثة · إعداد حسابك", title: "اختر نوع حسابك",
    intro: "اختر الدور الذي يصفك بشكل أفضل. يمكنك تغيير ذلك لاحقاً من إعدادات حسابك.",
    tester: "مختبِر", testerBody: "شارك في اختبار التطبيقات، واكسب النقاط وساعد على تحسين المنتجات.",
    developer: "مطوّر", developerBody: "انشر تطبيقاتك وأنشئ حملات اختبار واحصل على آراء مفيدة.",
    both: "كلاهما", bothBody: "استخدم المنصة كمختبِر ومطوّر في الوقت نفسه.",
    interests: "ما المجالات التي تهمك؟", optional: "اختياري",
    interestNames: ["أدوات وإنتاجية", "تعليم", "ألعاب", "تجارة إلكترونية", "صحة ولياقة", "شبكات اجتماعية", "أخرى"],
    continue: "متابعة", saving: "جارٍ الحفظ...", skip: "تخطي الآن", errorConfig: "إعداد Supabase غير مكتمل.",
    errorSave: "تعذر حفظ إعدادات الحساب. حاول مرة أخرى.", progress: "الخطوة 3 من 4"
  }
} as const;

const roles = [
  { value: "tester", icon: "tester" },
  { value: "developer", icon: "developer" },
  { value: "both", icon: "both" },
] as const;

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

function ProgressSteps({ label }: { label: string }) {
  return <div className="onboarding-progress" aria-label={label}>
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
  const [language, setLanguage] = useState<OnboardingLanguage>(() => {
    const saved = window.localStorage.getItem("testdz-landing-language");
    return saved === "fr" || saved === "ar" ? saved : "en";
  });
  const t = onboardingCopy[language];
  const [choice, setChoice] = useState("tester");
  const [interests, setInterests] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    const html = document.documentElement;
    html.lang = language;
    html.dir = language === "ar" ? "rtl" : "ltr";
    window.localStorage.setItem("testdz-landing-language", language);
  }, [language]);

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
      setError(t.errorConfig);
      return;
    }
    setBusy(true);
    setError("");
    const rolesToSave = choice === "both" ? ["tester", "developer"] : [choice];
    const { error: err } = await supabase.rpc("complete_onboarding", { p_roles: rolesToSave, p_interests: interests });
    if (err) setError(t.errorSave);
    else navigate("/dashboard", { replace: true });
    setBusy(false);
  }

  return <main className="onboarding-page" dir={language === "ar" ? "rtl" : "ltr"} lang={language}>
    <header className="onboarding-header">
      <Brand />
      <div className="onboarding-language-switch" role="group" aria-label={t.language}>{(["en", "fr", "ar"] as const).map(code => <button key={code} type="button" className={language === code ? "active" : ""} aria-pressed={language === code} onClick={() => setLanguage(code)}>{code.toUpperCase()}</button>)}</div>
    </header>
    <SideArtwork />
    <section className="onboarding-main">
      <ProgressSteps label={t.progress} />
      <div className="onboarding-heading">
        <span className="onboarding-kicker">{t.step}</span>
        <h1>{t.title}</h1>
        <p>{t.intro}</p>
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
          <strong>{t[role.value]}</strong>
          <span className="role-description">{t[`${role.value}Body` as "testerBody" | "developerBody" | "bothBody"]}</span>
        </button>)}
      </div>
      <section className="onboarding-interests">
        <h2>{t.interests} <small>{t.optional}</small></h2>
        <div className="onboarding-interest-list">
          {t.interestNames.map((item, index) => <button type="button" key={index} className={interests.includes(String(index)) ? "active" : ""} aria-pressed={interests.includes(String(index))} onClick={() => toggle(String(index))}>{item}</button>)}
        </div>
      </section>
      {error && <div className="notice notice-error onboarding-error" role="alert">{error}</div>}
      <div className="onboarding-actions">
        <button className="onboarding-continue" disabled={busy} onClick={finish}>{busy ? t.saving : t.continue} <span aria-hidden="true">←</span></button>
        <button className="onboarding-skip" type="button" onClick={() => { setChoice("tester"); setInterests([]); }}>{t.skip}</button>
      </div>
    </section>
  </main>;
}
