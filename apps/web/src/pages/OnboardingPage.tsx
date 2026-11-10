import { useEffect, useRef, useState } from "react";
import { gsap } from "gsap";
import { useNavigate } from "react-router-dom";
import { supabase } from "../lib/supabase";
import BlurText from "../components/react-bits/BlurText";
import { useLenis } from "../hooks/useLenis";
import "../styles/onboarding.css";

type OnboardingLanguage = "en" | "fr" | "ar";

const onboardingCopy = {
  en: {
    language: "Choose language", roleLabel: "Choose your account role", trustNote: "Your choice can be changed later in account settings.", step: "Step 3 · Set up your account", title: "Choose Your Account Type",
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
    language: "Choisir la langue", roleLabel: "Choisissez votre type de compte", trustNote: "Vous pourrez modifier votre choix dans les paramètres.", step: "Étape 3 · Configurez votre compte", title: "Choisissez votre type de compte",
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
    language: "اختر اللغة", roleLabel: "اختر نوع الحساب", trustNote: "يمكنك تغيير اختيارك لاحقاً من إعدادات الحساب.", step: "الخطوة الثالثة · إعداد حسابك", title: "اختر نوع حسابك",
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

function TestDZLogo() {
  return <a className="onboarding-logo" href="/" aria-label="TestDZ home">
    <svg viewBox="0 0 64 76" aria-hidden="true"><defs><linearGradient id="flaskBlue" x1="0" y1="0" x2="1" y2="1"><stop stopColor="#36c5ff"/><stop offset=".55" stopColor="#0878f5"/><stop offset="1" stopColor="#0646ce"/></linearGradient></defs><path d="M22 5h20v7h-4v18l19 31c4 7 0 12-8 12H15C7 73 3 68 7 61l19-31V12h-4z" fill="url(#flaskBlue)"/><path d="M27 12h10v22L18 62h29L37 34V12" fill="#75d5ff" opacity=".28"/><path d="M14 56h36l7 9c2 3 0 5-5 5H13c-5 0-7-2-5-5z" fill="#0b5de2"/><circle cx="25" cy="48" r="3" fill="#b9f1ff"/><circle cx="34" cy="57" r="2" fill="#d8f7ff"/><path d="M17 22l4 4-4 4-4-4z" fill="#b9f1ff" opacity=".9"/></svg>
    <span><strong>TestDZ</strong><small>Test · Learn · Grow</small></span>
  </a>;
}

function SideArtwork() {
  return <aside className="onboarding-art" aria-hidden="true">
    <svg className="onboarding-scene" viewBox="0 0 620 650" role="presentation">
      <defs>
        <linearGradient id="rocketBody" x1="0" y1="0" x2="1" y2="1"><stop stopColor="#fff"/><stop offset=".48" stopColor="#d9efff"/><stop offset="1" stopColor="#1680f4"/></linearGradient>
        <linearGradient id="rocketFin" x1="0" y1="0" x2="1" y2="1"><stop stopColor="#29aaff"/><stop offset="1" stopColor="#064acb"/></linearGradient>
        <linearGradient id="screenBlue" x1="0" y1="0" x2="1" y2="1"><stop stopColor="#e7f7ff"/><stop offset="1" stopColor="#8dcaff"/></linearGradient>
        <linearGradient id="laptopMetal" x1="0" y1="0" x2="0" y2="1"><stop stopColor="#dff5ff"/><stop offset="1" stopColor="#5799e8"/></linearGradient>
        <filter id="sceneShadow" x="-30%" y="-30%" width="160%" height="170%"><feGaussianBlur stdDeviation="13"/></filter>
      </defs>
      <g fill="#fff" opacity=".8"><ellipse cx="94" cy="554" rx="105" ry="39"/><ellipse cx="178" cy="570" rx="102" ry="45"/><ellipse cx="35" cy="590" rx="92" ry="38"/><ellipse cx="320" cy="586" rx="95" ry="35"/></g>
      <ellipse cx="278" cy="483" rx="280" ry="115" fill="#8bcaff" opacity=".14"/>
      <ellipse cx="268" cy="470" rx="270" ry="105" fill="none" stroke="#55b9ff" strokeWidth="4" opacity=".6" transform="rotate(-13 268 470)"/>
      <ellipse cx="265" cy="470" rx="244" ry="82" fill="none" stroke="#fff" strokeWidth="5" opacity=".7" transform="rotate(-13 265 470)"/>
      <g transform="translate(22 295) rotate(-13)">
        <ellipse cx="204" cy="226" rx="190" ry="22" fill="#3a8fe8" opacity=".2" filter="url(#sceneShadow)"/>
        <path d="M36 22h324a15 15 0 0 1 15 15v174H21V37a15 15 0 0 1 15-15" fill="#092b68"/>
        <rect x="32" y="33" width="332" height="165" rx="8" fill="url(#screenBlue)"/>
        <path d="M185 80c-14 0-22 10-22 22v43c0 10 7 17 17 17h32c10 0 17-7 17-17v-43c0-12-8-22-22-22z" fill="url(#flaskBlue)"/>
        <path d="M188 69h17v15h-17z" fill="#0875ed"/><path d="M179 129h48l8 19h-64z" fill="#0b68e6"/>
        <path d="M10 209h365l-35 22H46z" fill="url(#laptopMetal)" stroke="#478ee0" strokeWidth="2"/>
        <path d="M145 209h93l-8 8h-77z" fill="#397bc7" opacity=".5"/>
      </g>
      <g transform="translate(90 32) rotate(35 120 120)">
        <path d="M120 8c-42 40-54 94-47 162l47 83 47-83c7-68-5-122-47-162" fill="url(#rocketBody)" stroke="#1678eb" strokeWidth="5"/>
        <path d="M75 145 26 197l55 5M165 145l49 52-55 5" fill="url(#rocketFin)" stroke="#0755c8" strokeWidth="5" strokeLinejoin="round"/>
        <path d="M98 206 120 278l22-72" fill="#0b5bdb"/>
        <circle cx="120" cy="111" r="34" fill="#0755d4" stroke="#5cbcff" strokeWidth="9"/>
        <circle cx="120" cy="111" r="22" fill="#138ef5"/><circle cx="110" cy="101" r="8" fill="#d9f7ff" opacity=".9"/>
        <path d="M105 258q15 38 30 0l-15 65z" fill="#ffb73e"/>
        <path d="M111 260q9 28 18 0l-9 47z" fill="#ffdf70"/>
      </g>
      <g transform="translate(390 290) rotate(12)"><rect width="106" height="82" rx="15" fill="#0785f6"/><text x="53" y="55" textAnchor="middle" fill="#fff" fontSize="38" fontWeight="800">&lt;/&gt;</text></g>
      <g transform="translate(418 440) rotate(12)"><rect width="72" height="72" rx="14" fill="#1688f5"/><path d="m36 13 7 15 16 2-12 11 3 17-14-8-14 8 3-17-12-11 16-2z" fill="#fff"/></g>
      <circle cx="490" cy="220" r="8" fill="#8ad5ff"/><circle cx="525" cy="235" r="5" fill="#35aaff"/>
    </svg>
    <p>Test. Learn. Grow.</p>
    <div className="art-dots art-dots-top"/><div className="art-dots art-dots-bottom"/>
  </aside>;
}

export default function OnboardingPage() {
  useLenis();
  const pageRef = useRef<HTMLElement>(null);
  const navigate = useNavigate();
  const [language, setLanguage] = useState<OnboardingLanguage>(() => {
    const saved = window.localStorage.getItem("testdz-landing-language");
    return saved === "fr" || saved === "ar" ? saved : "en";
  });
  const t = onboardingCopy[language];
  const [choice, setChoice] = useState("tester");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    const root = pageRef.current;
    if (!root) return;
    const context = gsap.context(() => {
      if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
      const entrance = gsap.timeline({ defaults: { ease: "power3.out" } });
      entrance
        .fromTo(".onboarding-progress", { y: 18, autoAlpha: 0 }, { y: 0, autoAlpha: 1, duration: 0.55 })
        .fromTo(".onboarding-heading h1", { y: 24, autoAlpha: 0, filter: "blur(8px)" }, { y: 0, autoAlpha: 1, filter: "blur(0px)", duration: 0.72 }, "-=0.28")
        .fromTo(".onboarding-intro-motion", { y: 14, autoAlpha: 0 }, { y: 0, autoAlpha: 1, duration: 0.55 }, "-=0.42")
        .fromTo(".onboarding-role-card", { y: 30, autoAlpha: 0, scale: 0.97 }, { y: 0, autoAlpha: 1, scale: 1, duration: 0.62, stagger: 0.12 }, "-=0.2")
        .fromTo(".onboarding-trust-note, .onboarding-actions", { y: 16, autoAlpha: 0 }, { y: 0, autoAlpha: 1, duration: 0.5, stagger: 0.1 }, "-=0.25");
      gsap.to(".onboarding-art", { y: -11, duration: 3.8, ease: "sine.inOut", yoyo: true, repeat: -1 });
      gsap.to(".onboarding-bg-top", { rotate: -12, scale: 1.04, duration: 7, ease: "sine.inOut", yoyo: true, repeat: -1 });
    }, root);
    return () => context.revert();
  }, []);

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

  async function finish() {
    if (!supabase) {
      setError(t.errorConfig);
      return;
    }
    setBusy(true);
    setError("");
    const rolesToSave = choice === "both" ? ["tester", "developer"] : [choice];
    const { error: err } = await supabase.rpc("complete_onboarding", { p_roles: rolesToSave, p_interests: [] });
    if (err) setError(t.errorSave);
    else navigate("/dashboard", { replace: true });
    setBusy(false);
  }

  return <main ref={pageRef} className="onboarding-page" dir={language === "ar" ? "rtl" : "ltr"} lang={language}>
    <div className="onboarding-bg-shape onboarding-bg-top"/><div className="onboarding-bg-shape onboarding-bg-bottom"/>
    <header className="onboarding-header">
      <TestDZLogo />
      <div className="onboarding-language-switch" role="group" aria-label={t.language}>{(["en", "fr", "ar"] as const).map(code => <button key={code} type="button" className={language === code ? "active" : ""} aria-pressed={language === code} onClick={() => setLanguage(code)}>{code.toUpperCase()}</button>)}</div>
    </header>
    <SideArtwork />
    <section className="onboarding-main">
      <ProgressSteps label={t.progress} />
      <div className="onboarding-heading">
        <span className="onboarding-kicker">{t.step}</span>
        <h1>{t.title}</h1>
        <BlurText text={t.intro} className="onboarding-intro-motion" animateBy="words" delay={45} direction="top" effect="focus" stepDuration={0.32} trigger="load" />
      </div>
      <div className="onboarding-role-grid" role="group" aria-label={t.roleLabel}>
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
      {error && <div className="notice notice-error onboarding-error" role="alert">{error}</div>}
      <p className="onboarding-trust-note"><span aria-hidden="true">✓</span>{t.trustNote}</p>
      <div className="onboarding-actions">
        <button className="onboarding-continue" disabled={busy} onClick={finish}>{busy ? t.saving : t.continue} <span aria-hidden="true">{language === "ar" ? "←" : "→"}</span></button>
        <button className="onboarding-skip" type="button" onClick={() => setChoice("tester")}>{t.skip}</button>
      </div>
    </section>
  </main>;
}
