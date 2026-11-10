import { useEffect, useMemo, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { gsap } from "gsap";
import { supabase } from "../lib/supabase";
import { useLenis } from "../hooks/useLenis";
import "../styles/interests.css";

type Language = "en" | "fr" | "ar";
type GroupKey = "testing" | "skills" | "other";

const copy = {
  en: {
    language: "Choose language", progress: "Step 3 of 4", title: "Tell Us About Your Interests",
    intro: "Select the areas and skills that match your interests. This will help us recommend the best tests, projects and opportunities for you.",
    testing: "Testing Interests", testingHint: "Choose the areas you like to test",
    skills: "Development Skills", skillsHint: "Select your technical skills",
    other: "Other Interests", optional: "Optional", continue: "Continue", saving: "Saving...",
    skip: "Skip for now", back: "Back", error: "We couldn't save your interests. Please try again.",
    config: "Supabase is not configured.", footer: "Build. Test. Reward.", rights: "© 2026 TestDZ. All rights reserved.",
    about: "About", terms: "Terms of Service", privacy: "Privacy Policy", contact: "Contact",
    testingItems: ["Android", "UI/UX", "Performance", "Security"],
    skillItems: ["Java", "Kotlin", "Flutter", "React"],
    otherItems: ["Web Development", "Mobile Apps", "AI / Machine Learning", "Game Development", "Open Source"],
  },
  fr: {
    language: "Choisir la langue", progress: "Étape 3 sur 4", title: "Parlez-nous de vos intérêts",
    intro: "Sélectionnez les domaines et compétences qui vous intéressent. Nous pourrons vous recommander les meilleurs tests, projets et opportunités.",
    testing: "Intérêts en test", testingHint: "Choisissez les domaines que vous aimez tester",
    skills: "Compétences en développement", skillsHint: "Sélectionnez vos compétences techniques",
    other: "Autres centres d’intérêt", optional: "Facultatif", continue: "Continuer", saving: "Enregistrement...",
    skip: "Passer pour le moment", back: "Retour", error: "Impossible d’enregistrer vos intérêts. Réessayez.",
    config: "Supabase n’est pas configuré.", footer: "Créer. Tester. Récompenser.", rights: "© 2026 TestDZ. Tous droits réservés.",
    about: "À propos", terms: "Conditions d’utilisation", privacy: "Confidentialité", contact: "Contact",
    testingItems: ["Android", "UI/UX", "Performance", "Sécurité"],
    skillItems: ["Java", "Kotlin", "Flutter", "React"],
    otherItems: ["Développement Web", "Applications mobiles", "IA / Machine Learning", "Jeux vidéo", "Open Source"],
  },
  ar: {
    language: "اختر اللغة", progress: "الخطوة 3 من 4", title: "أخبرنا عن اهتماماتك",
    intro: "اختر المجالات والمهارات التي تناسب اهتماماتك. سيساعدنا ذلك على اقتراح أفضل الاختبارات والمشاريع والفرص لك.",
    testing: "اهتمامات الاختبار", testingHint: "اختر المجالات التي تحب اختبارها",
    skills: "مهارات التطوير", skillsHint: "حدد مهاراتك التقنية",
    other: "اهتمامات أخرى", optional: "اختياري", continue: "متابعة", saving: "جارٍ الحفظ...",
    skip: "تخطي الآن", back: "رجوع", error: "تعذر حفظ اهتماماتك. حاول مرة أخرى.",
    config: "إعداد Supabase غير مكتمل.", footer: "ابنِ. اختبر. اكسب.", rights: "© 2026 TestDZ. جميع الحقوق محفوظة.",
    about: "من نحن", terms: "شروط الخدمة", privacy: "سياسة الخصوصية", contact: "اتصل بنا",
    testingItems: ["Android", "UI/UX", "الأداء", "الأمان"],
    skillItems: ["Java", "Kotlin", "Flutter", "React"],
    otherItems: ["تطوير الويب", "تطبيقات الهاتف", "الذكاء الاصطناعي", "تطوير الألعاب", "المصادر المفتوحة"],
  },
} as const;

const testingIcons = ["▣", "▤", "◉", "⬟"];
const skillIcons = ["♨", "K", "ϟ", "⚛"];

function Brand() {
  return <a className="interest-brand" href="/" aria-label="TestDZ home">
    <span className="interest-flask" aria-hidden="true">⚗</span>
    <span><strong>TestDZ</strong><small>Test · Learn · Grow</small></span>
  </a>;
}

function Progress() {
  return <div className="interest-progress" aria-label="Step 3 of 4">
    <span className="complete">✓</span><i /><span className="complete">✓</span><i /><span className="active">3</span><i /><span className="future">4</span>
  </div>;
}

function SelectionCard({ label, icon, selected, onClick }: { label: string; icon: string; selected: boolean; onClick: () => void }) {
  return <button type="button" className={"interest-option" + (selected ? " selected" : "")} aria-pressed={selected} onClick={onClick}>
    <span className="interest-option-icon" aria-hidden="true">{icon}</span><strong>{label}</strong><span className="interest-option-check" aria-hidden="true">{selected ? "✓" : ""}</span>
  </button>;
}

export default function InterestsPage() {
  useLenis();
  const rootRef = useRef<HTMLElement>(null);
  const navigate = useNavigate();
  const location = useLocation();
  const [language, setLanguage] = useState<Language>(() => {
    const saved = window.localStorage.getItem("testdz-landing-language");
    return saved === "fr" || saved === "ar" ? saved : "en";
  });
  const t = copy[language];
  const roleFromState = (location.state as { choice?: string } | null)?.choice;
  const [role, setRole] = useState<"tester" | "developer" | "both">(
    roleFromState === "developer" || roleFromState === "both" ? roleFromState : "tester"
  );
  const [testing, setTesting] = useState<string[]>(["Android", "UI/UX", "Security"]);
  const [skills, setSkills] = useState<string[]>(["Java", "Flutter"]);
  const [other, setOther] = useState<string[]>(["Web Development"]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;
    const context = gsap.context(() => {
      if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
      gsap.timeline({ defaults: { ease: "power3.out" } })
        .fromTo(".interest-progress", { y: 14, autoAlpha: 0 }, { y: 0, autoAlpha: 1, duration: .45 })
        .fromTo(".interest-heading", { y: 18, autoAlpha: 0, filter: "blur(5px)" }, { y: 0, autoAlpha: 1, filter: "blur(0)", duration: .6 }, "-=.2")
        .fromTo(".interest-panel", { y: 22, autoAlpha: 0 }, { y: 0, autoAlpha: 1, duration: .55, stagger: .1 }, "-=.25")
        .fromTo(".interest-footer-actions", { y: 12, autoAlpha: 0 }, { y: 0, autoAlpha: 1, duration: .4 }, "-=.15");
    }, root);
    return () => context.revert();
  }, []);

  useEffect(() => {
    document.documentElement.lang = language;
    document.documentElement.dir = language === "ar" ? "rtl" : "ltr";
    window.localStorage.setItem("testdz-landing-language", language);
  }, [language]);

  useEffect(() => {
    if (!supabase) return;
    supabase.auth.getSession().then(({ data }) => {
      if (!data.session) {
        navigate("/auth", { replace: true });
        return;
      }
      const savedRole = data.session.user.user_metadata?.account_type;
      if (!roleFromState && (savedRole === "tester" || savedRole === "developer" || savedRole === "both")) setRole(savedRole);
    });
  }, [navigate, roleFromState]);

  const selected = useMemo(() => [...testing, ...skills, ...other], [testing, skills, other]);
  function toggle(group: GroupKey, item: string) {
    const setter = group === "testing" ? setTesting : group === "skills" ? setSkills : setOther;
    setter(current => current.includes(item) ? current.filter(value => value !== item) : [...current, item]);
  }

  async function finish(skip = false) {
    if (!supabase) { setError(t.config); return; }
    setBusy(true);
    setError("");
    const roles = role === "both" ? ["tester", "developer"] : [role];
    const interests = skip ? [] : selected;
    const { error: saveError } = await supabase.rpc("complete_onboarding", { p_roles: roles, p_interests: interests });
    if (saveError) setError(t.error);
    else navigate("/dashboard", { replace: true });
    setBusy(false);
  }

  return <main ref={rootRef} className="interests-page" dir={language === "ar" ? "rtl" : "ltr"} lang={language}>
    <div className="interest-bg interest-bg-top" /><div className="interest-bg interest-bg-bottom" />
    <header className="interest-header"><Brand /><div className="interest-language" role="group" aria-label={t.language}>
      {(["en", "fr", "ar"] as const).map(code => <button key={code} type="button" className={language === code ? "active" : ""} aria-pressed={language === code} onClick={() => setLanguage(code)}>{code.toUpperCase()}</button>)}
    </div></header>
    <div className="interest-layout">
      <aside className="interest-art" aria-hidden="true">
        <div className="interest-orbit" /><div className="interest-bulb">✦</div>
        <div className="interest-laptop"><div className="interest-screen"><span>⚗</span></div><div className="interest-keyboard" /></div>
        <div className="interest-gear">⚙</div><div className="interest-code">&lt;/&gt;</div>
        <div className="interest-art-dots" />
      </aside>
      <section className="interest-content">
        <Progress />
        <div className="interest-heading"><h1>{t.title}</h1><p>{t.intro}</p></div>
        <div className="interest-panels">
          <section className="interest-panel">
            <div className="interest-panel-heading"><span className="interest-panel-symbol">◎</span><span><strong>{t.testing}</strong><small>{t.testingHint}</small></span></div>
            <div className="interest-options-grid">{t.testingItems.map((item, index) => <SelectionCard key={item} label={item} icon={testingIcons[index]} selected={testing.includes(item)} onClick={() => toggle("testing", item)} />)}</div>
          </section>
          <section className="interest-panel">
            <div className="interest-panel-heading"><span className="interest-panel-symbol code-symbol">&lt;/&gt;</span><span><strong>{t.skills}</strong><small>{t.skillsHint}</small></span></div>
            <div className="interest-options-grid">{t.skillItems.map((item, index) => <SelectionCard key={item} label={item} icon={skillIcons[index]} selected={skills.includes(item)} onClick={() => toggle("skills", item)} />)}</div>
          </section>
        </div>
        <section className="interest-other">
          <h2><span>★</span> {t.other} <small>({t.optional})</small></h2>
          <div className="interest-chips">{t.otherItems.map(item => <button type="button" key={item} className={other.includes(item) ? "selected" : ""} aria-pressed={other.includes(item)} onClick={() => toggle("other", item)}>{item}</button>)}</div>
        </section>
        {error && <div className="interest-error" role="alert">{error}</div>}
        <div className="interest-footer-actions">
          <button className="interest-back" type="button" onClick={() => navigate("/onboarding", { state: { choice: role } })}>← {t.back}</button>
          <button className="interest-skip" type="button" disabled={busy} onClick={() => finish(true)}>{t.skip}</button>
          <button className="interest-continue" type="button" disabled={busy} onClick={() => finish(false)}>{busy ? t.saving : t.continue}<span>→</span></button>
        </div>
      </section>
    </div>
    <footer className="interest-footer"><Brand /><span className="interest-tagline">{t.footer}</span><nav><a href="/">{t.about}</a><a href="/terms">{t.terms}</a><a href="/privacy">{t.privacy}</a><a href="mailto:support@testdz.com">{t.contact}</a></nav><small>{t.rights}</small></footer>
  </main>;
}
