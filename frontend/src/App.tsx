import { useEffect, useState } from "react";
import BlurText from "./components/react-bits/BlurText";
import LightRays from "./components/react-bits/LightRays";
import StarBorder from "./components/react-bits/StarBorder";
import type { FormEvent } from "react";
import { Link, Navigate, Route, Routes, useNavigate, useParams } from "react-router-dom";
import imageCompression from "browser-image-compression";
import type { Session } from "@supabase/supabase-js";
import { isSupabaseConfigured, supabase } from "./lib/supabase";
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { useLenis } from "./hooks/useLenis";

function Brand() {
  return <Link className="brand" to="/" aria-label="TestDZ الصفحة الرئيسية"><span className="brand-mark">T</span><span>Test<span className="brand-accent">DZ</span></span></Link>;
}

function LpIcon({ name, size = 24 }: { name: string; size?: number }) {
  const common = { width: size, height: size, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 1.8, strokeLinecap: "round" as const, strokeLinejoin: "round" as const, "aria-hidden": true as const };
  switch (name) {
    case "flask": return <svg {...common}><path d="M9 3h6M10 3v6l-5.5 9.2A2 2 0 0 0 6.2 21h11.6a2 2 0 0 0 1.7-2.8L14 9V3"/><path d="M7.5 15h9M9 12h6"/></svg>;
    case "moon": return <svg {...common}><path d="M20.5 15.5A8.5 8.5 0 0 1 8.5 3.5 8.5 8.5 0 1 0 20.5 15.5Z"/></svg>;
    case "arrow": return <svg {...common}><path d="M4 12h15M13 6l6 6-6 6"/></svg>;
    case "play": return <svg {...common}><path d="m8 5 11 7-11 7z" fill="currentColor" stroke="none"/></svg>;
    case "code": return <svg {...common}><path d="m8 8-4 4 4 4M16 8l4 4-4 4M14 5l-4 14"/></svg>;
    case "cloud": return <svg {...common}><path d="M7 18h10a4 4 0 0 0 .4-8A6 6 0 0 0 6 9a4.5 4.5 0 0 0 1 9Z"/></svg>;
    case "shield": return <svg {...common}><path d="M12 3 20 6v5c0 5-3.4 8.5-8 10-4.6-1.5-8-5-8-10V6l8-3Z"/><path d="m8.5 12 2.3 2.3 4.8-5"/></svg>;
    case "bolt": return <svg {...common}><path d="M13 2 4 13h7l-1 9 10-13h-7l0-7Z" fill="currentColor" stroke="none"/></svg>;
    case "gift": return <svg {...common}><rect x="3" y="10" width="18" height="11" rx="2"/><path d="M12 10v11M2 7h20v3H2zM12 7H8.5a2.5 2.5 0 1 1 2.5-2.5V7Zm0 0h3.5A2.5 2.5 0 1 0 13 4.5V7Z"/></svg>;
    case "users": return <svg {...common}><path d="M16 20v-1.5a4 4 0 0 0-4-4H7a4 4 0 0 0-4 4V20M9.5 10.5a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7ZM17 4a3.5 3.5 0 0 1 0 6.8M17 14.5a4 4 0 0 1 4 4V20"/></svg>;
    case "user-plus": return <svg {...common}><circle cx="9" cy="8" r="4"/><path d="M2.5 21v-1.5A4.5 4.5 0 0 1 7 15h4a4.5 4.5 0 0 1 4.5 4.5V21M19 8v6M16 11h6"/></svg>;
    case "clipboard": return <svg {...common}><rect x="5" y="4" width="14" height="17" rx="2"/><path d="M9 4.5h6a1.5 1.5 0 0 0-1.5-1.5h-3A1.5 1.5 0 0 0 9 4.5ZM8 11h8M8 15h8"/></svg>;
    case "trophy": return <svg {...common}><path d="M8 21h8M12 17v4M7 4h10v5a5 5 0 0 1-10 0V4ZM7 6H4v2a4 4 0 0 0 4 4M17 6h3v2a4 4 0 0 1-4 4"/></svg>;
    case "hourglass": return <svg {...common}><path d="M6 3h12M6 21h12M7 3c0 5 2 6 5 9-3 3-5 4-5 9M17 3c0 5-2 6-5 9 3 3 5 4 5 9"/><path d="M9 7h6M9 17h6"/></svg>;
    case "calendar": return <svg {...common}><rect x="3" y="5" width="18" height="16" rx="2"/><path d="M16 3v4M8 3v4M3 10h18M7 14h3M14 14h3M7 17h3"/></svg>;
    case "check": return <svg {...common}><path d="m5 12 4 4L19 6"/></svg>;
    case "plus": return <svg {...common}><path d="M12 5v14M5 12h14"/></svg>;
    default: return <svg {...common}><circle cx="12" cy="12" r="9"/></svg>;
  }
}

type LandingLanguage = "en" | "fr" | "ar";

const landingCopy = {
  en: {
    home: "Home", features: "Features", developers: "For Developers", testers: "For Testers", how: "How it works", signIn: "Sign In", getStarted: "Get Started",
    heroLead: "Test. Learn.", heroAccent: "Grow.", heroBody: "One platform for developers to validate their apps and testers to shape better digital products.", developerCta: "I’m a developer", testerCta: "I’m a tester", developerPath: "Build with confidence", testerPath: "Test real products", visualLabel: "Two paths, one testing community",
    exploreTests: "Explore Tests", activeUsers: "Active Users", userRating: "User Rating", days: "Days", overview: "Overview", myTests: "My Tests", dashboard: "Dashboard", activeTests: "Active Tests", totalUsers: "Total Users", rewards: "Rewards", completed: "Test completed", feedback: "Feedback received", earned: "Reward earned",
    secure: "Secure & Fair", secureBody: "Advanced anti-fraud system for a transparent tester experience.", fourteen: "14-Day Tests", fourteenBody: "Limited-time tests to ensure real skills and knowledge.", earn: "Earn Rewards", earnBody: "Get points and rewards for your efforts.", everyone: "For Everyone", everyoneBody: "Testers, developers and admins in one platform.",
    howTitle: "How TestDZ Works?", howBody: "A simple and effective process in 3 easy steps", create: "Create Your Account", createBody: "Join TestDZ as a tester, developer or admin.", take: "Take or Create Tests", takeBody: "Participate in tests or design your own tests.", grow: "Earn & Grow", growBody: "Get rewards and track your progress.",
    promoTitle: "Tests are open for", promoAccent: "only 14 days!", promoBody: "Don’t miss your chance to participate.", exploreActive: "Join as a Tester",
    tester: "Tester", developer: "Developer", communityTitle: "Built for the testing community", communityOneTitle: "For testers", communityOneBody: "Discover real products, share useful feedback and build practical experience.", communityTwoTitle: "For developers", communityTwoBody: "Validate your ideas with structured tests and actionable feedback.", communityThreeTitle: "One shared space", communityThreeBody: "Bring product creators and testers together in one transparent workflow.", preview: "PREVIEW",
    faqTitle: "Frequently Asked Questions", faqIntro: "Find answers to common questions about TestDZ.", viewFaq: "View All FAQs", faq1q: "How does the 14-day test work?", faq1a: "Testers participate in an organized test cycle and share feedback throughout the testing period.", faq2q: "Can I earn real rewards?", faq2a: "Eligible activities can earn points and rewards according to the platform rules.", faq3q: "Is TestDZ free to use?", faq3a: "You can create an account and explore the platform. Available features may depend on your role and plan.", faq4q: "How can I become a developer?", faq4a: "Create an account and choose the developer role during onboarding.",
    about: "About", terms: "Terms of Service", privacy: "Privacy Policy", contact: "Contact", copyright: "© 2026 TestDZ. All rights reserved.", languageLabel: "Choose language", illustration: "Illustration of the TestDZ testing dashboard"
  },
  fr: {
    home: "Accueil", features: "Fonctionnalités", developers: "Développeurs", testers: "Testeurs", how: "Fonctionnement", signIn: "Connexion", getStarted: "Commencer",
    heroLead: "Tester. Apprendre.", heroAccent: "Progresser.", heroBody: "Une plateforme pour aider les développeurs à valider leurs applications et les testeurs à améliorer les produits numériques.", developerCta: "Je suis développeur", testerCta: "Je suis testeur", developerPath: "Développez en confiance", testerPath: "Testez de vrais produits", visualLabel: "Deux parcours, une communauté de test",
    exploreTests: "Découvrir les tests", activeUsers: "Utilisateurs actifs", userRating: "Note des utilisateurs", days: "Jours", overview: "Vue d’ensemble", myTests: "Mes tests", dashboard: "Tableau de bord", activeTests: "Tests actifs", totalUsers: "Utilisateurs", rewards: "Récompenses", completed: "Test terminé", feedback: "Avis reçu", earned: "Récompense obtenue",
    secure: "Sûr et équitable", secureBody: "Un système anti-fraude avancé pour une expérience transparente.", fourteen: "Tests de 14 jours", fourteenBody: "Des tests limités dans le temps pour valoriser les compétences réelles.", earn: "Gagnez des récompenses", earnBody: "Recevez des points et des récompenses pour vos efforts.", everyone: "Pour tous", everyoneBody: "Testeurs, développeurs et administrateurs sur une seule plateforme.",
    howTitle: "Comment fonctionne TestDZ ?", howBody: "Un processus simple et efficace en 3 étapes", create: "Créez votre compte", createBody: "Rejoignez TestDZ comme testeur, développeur ou administrateur.", take: "Participez ou créez des tests", takeBody: "Participez aux tests ou concevez les vôtres.", grow: "Gagnez et progressez", growBody: "Obtenez des récompenses et suivez vos progrès.",
    promoTitle: "Les tests sont ouverts", promoAccent: "pendant 14 jours !", promoBody: "Ne manquez pas votre chance de participer.", exploreActive: "Rejoindre comme testeur",
    tester: "Testeur", developer: "Développeur", communityTitle: "Pensé pour la communauté du test", communityOneTitle: "Pour les testeurs", communityOneBody: "Découvrez de vrais produits, partagez des retours utiles et gagnez en expérience.", communityTwoTitle: "Pour les développeurs", communityTwoBody: "Validez vos idées grâce à des tests structurés et des retours exploitables.", communityThreeTitle: "Un espace commun", communityThreeBody: "Réunissez créateurs de produits et testeurs dans un parcours transparent.", preview: "APERÇU",
    faqTitle: "Questions fréquentes", faqIntro: "Retrouvez les réponses aux questions courantes sur TestDZ.", viewFaq: "Toutes les questions", faq1q: "Comment fonctionne le test de 14 jours ?", faq1a: "Les testeurs suivent un cycle organisé et partagent leurs retours pendant toute la période.", faq2q: "Puis-je gagner de vraies récompenses ?", faq2a: "Les activités éligibles permettent de gagner des points et des récompenses selon les règles de la plateforme.", faq3q: "TestDZ est-elle gratuite ?", faq3a: "Vous pouvez créer un compte et découvrir la plateforme. Les fonctionnalités dépendent de votre rôle et de votre offre.", faq4q: "Comment devenir développeur ?", faq4a: "Créez un compte et choisissez le rôle développeur lors de votre inscription.",
    about: "À propos", terms: "Conditions d’utilisation", privacy: "Confidentialité", contact: "Contact", copyright: "© 2026 TestDZ. Tous droits réservés.", languageLabel: "Choisir la langue", illustration: "Illustration du tableau de bord TestDZ"
  },
  ar: {
    home: "الرئيسية", features: "المميزات", developers: "للمطورين", testers: "للمختبرين", how: "كيف تعمل المنصة", signIn: "تسجيل الدخول", getStarted: "ابدأ الآن",
    heroLead: "اختبر. تعلّم.", heroAccent: "وتطوّر.", heroBody: "منصة تجمع المطورين والمختبرين للتحقق من التطبيقات وتحسين المنتجات الرقمية من خلال تجارب وملاحظات حقيقية.", developerCta: "أنا مطور", testerCta: "أنا مختبر", developerPath: "طوّر بثقة", testerPath: "اختبر منتجات حقيقية", visualLabel: "مساران ومجتمع واحد للاختبار",
    exploreTests: "اكتشف الاختبارات", activeUsers: "مستخدم نشط", userRating: "تقييم المستخدمين", days: "يوماً", overview: "نظرة عامة", myTests: "اختباراتي", dashboard: "لوحة التحكم", activeTests: "اختبارات نشطة", totalUsers: "إجمالي المستخدمين", rewards: "المكافآت", completed: "اكتمل الاختبار", feedback: "تم استلام الملاحظات", earned: "تم كسب المكافأة",
    secure: "آمنة وعادلة", secureBody: "نظام متقدم لمكافحة الاحتيال يضمن تجربة شفافة للمختبرين.", fourteen: "اختبارات لمدة 14 يوماً", fourteenBody: "اختبارات محددة المدة لقياس المهارات والمعرفة الحقيقية.", earn: "اكسب المكافآت", earnBody: "احصل على النقاط والمكافآت مقابل جهودك.", everyone: "منصة للجميع", everyoneBody: "المختبرون والمطورون والمسؤولون في منصة واحدة.",
    howTitle: "كيف تعمل TestDZ؟", howBody: "عملية بسيطة وفعالة في ثلاث خطوات", create: "أنشئ حسابك", createBody: "انضم إلى TestDZ كمختبر أو مطور أو مسؤول.", take: "شارك أو أنشئ اختباراً", takeBody: "شارك في الاختبارات أو صمّم اختباراتك الخاصة.", grow: "اكسب وتطوّر", growBody: "احصل على المكافآت وتابع تقدمك.",
    promoTitle: "الاختبارات متاحة", promoAccent: "لمدة 14 يوماً فقط!", promoBody: "لا تفوّت فرصتك في المشاركة.", exploreActive: "انضم كمختبر",
    tester: "مختبر", developer: "مطور", communityTitle: "منصة تجمع مجتمع الاختبار", communityOneTitle: "للمختبرين", communityOneBody: "اكتشف منتجات حقيقية وشارك ملاحظات مفيدة واكتسب خبرة عملية.", communityTwoTitle: "للمطورين", communityTwoBody: "تحقق من أفكارك عبر اختبارات منظمة وملاحظات قابلة للتطبيق.", communityThreeTitle: "مساحة واحدة للجميع", communityThreeBody: "اجمع صناع المنتجات والمختبرين ضمن تجربة واضحة وشفافة.", preview: "معاينة",
    faqTitle: "الأسئلة الشائعة", faqIntro: "اعثر على إجابات لأكثر الأسئلة شيوعاً حول TestDZ.", viewFaq: "عرض جميع الأسئلة", faq1q: "كيف يعمل اختبار الـ14 يوماً؟", faq1a: "يشارك المختبرون في دورة اختبار منظمة ويقدمون ملاحظاتهم طوال فترة الاختبار.", faq2q: "هل يمكنني كسب مكافآت حقيقية؟", faq2a: "تمنح الأنشطة المؤهلة نقاطاً ومكافآت وفقاً لقواعد المنصة.", faq3q: "هل استخدام TestDZ مجاني؟", faq3a: "يمكنك إنشاء حساب واستكشاف المنصة. وقد تختلف الميزات حسب دورك وباقتك.", faq4q: "كيف أصبح مطوراً؟", faq4a: "أنشئ حساباً واختر دور المطور أثناء التسجيل.",
    about: "عن المنصة", terms: "شروط الاستخدام", privacy: "سياسة الخصوصية", contact: "اتصل بنا", copyright: "© 2026 TestDZ. جميع الحقوق محفوظة.", languageLabel: "اختر اللغة", illustration: "رسم توضيحي للوحة تحكم TestDZ"
  }
} as const;

function LandingPage() {
  useLenis();

  const [reducedMotion, setReducedMotion] = useState(() => window.matchMedia("(prefers-reduced-motion: reduce)").matches);

  useEffect(() => {
    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => setReducedMotion(media.matches);
    media.addEventListener("change", update);
    return () => media.removeEventListener("change", update);
  }, []);

  const [language, setLanguage] = useState<LandingLanguage>(() => {
    const saved = window.localStorage.getItem("testdz-landing-language");
    return saved === "fr" || saved === "ar" ? saved : "en";
  });
  const t = landingCopy[language];

  useEffect(() => {
    const html = document.documentElement;
    const previousLang = html.lang;
    const previousDir = html.dir;
    const isArabic = language === "ar";
    html.lang = language;
    html.dir = isArabic ? "rtl" : "ltr";
    window.localStorage.setItem("testdz-landing-language", language);

    return () => {
      html.lang = previousLang;
      html.dir = previousDir;
    };
  }, [language]);

  useEffect(() => {
    const root = document.querySelector<HTMLElement>(".landing-page");
    if (!root || reducedMotion) return;

    gsap.registerPlugin(ScrollTrigger);
    const context = gsap.context(() => {
      const intro = gsap.timeline({ defaults: { ease: "power3.out", duration: 0.75 } });
      intro
        .from(".lp-hero-copy h1", { y: 28, opacity: 0 })
        .from(".lp-hero-copy > p", { y: 18, opacity: 0 }, "-=0.42")
        .from(".lp-hero-buttons", { y: 16, opacity: 0 }, "-=0.38")
        .from(".lp-role-cards", { y: 12, opacity: 0, stagger: 0.1 }, "-=0.35");

      gsap.from(".lp-hero-art", {
        y: 28,
        opacity: 0,
        scale: 0.97,
        duration: 1,
        ease: "power2.out",
        delay: 0.12,
      });

      const reveal = (selector: string, trigger: string, stagger = 0.12) => {
        gsap.from(selector, {
          y: 30,
          opacity: 0,
          duration: 0.72,
          stagger,
          ease: "power2.out",
          scrollTrigger: {
            trigger,
            start: "top 84%",
            once: true,
          },
        });
      };

      reveal(".lp-features article", ".lp-features", 0.13);
      reveal(".lp-section-title", ".lp-how", 0.1);
      reveal(".lp-steps article", ".lp-steps", 0.16);
      reveal(".lp-promo > *", ".lp-promo", 0.1);
      reveal(".lp-community article", ".lp-community", 0.12);
      gsap.utils.toArray<HTMLElement>(".lp-counter").forEach((element, index) => {
        const target = Number(element.dataset.count || 0);
        gsap.fromTo(
          element,
          { textContent: 0 },
          {
            textContent: target,
            duration: 1.35,
            delay: index * 0.08,
            ease: "power2.out",
            snap: { textContent: 1 },
            scrollTrigger: {
              trigger: element,
              start: "top 90%",
              once: true,
            },
          },
        );
      });
      reveal(".lp-faq-illustration, .lp-faq-copy, .lp-faq-list details", ".lp-faq", 0.08);
      reveal(".lp-footer > *", ".lp-footer", 0.08);
    }, root);

    return () => context.revert();
  }, []);

  return (
    <main className="landing-page" dir={language === "ar" ? "rtl" : "ltr"} lang={language}>
      <header className="lp-header">
        <Link className="lp-brand" to="/" aria-label="TestDZ"><span className="lp-flask"><LpIcon name="flask" size={29} /></span><span>TestDZ</span></Link>
        <nav className="lp-nav" aria-label={t.home}>
          <a className="active" href="#home">{t.home}</a><a href="#features">{t.features}</a><a href="#developers">{t.developers}⌄</a><a href="#testers">{t.testers}⌄</a><a href="#how-it-works">{t.how}</a><a href="#faq">FAQ</a>
        </nav>
        <div className="lp-header-actions"><div className="lp-language-switch" role="group" aria-label={t.languageLabel}>{(["en", "fr", "ar"] as const).map((code) => <button key={code} type="button" className={language === code ? "active" : ""} aria-pressed={language === code} onClick={() => { setLanguage(code); window.requestAnimationFrame(() => ScrollTrigger.refresh()); }}>{code.toUpperCase()}</button>)}</div><Link className="lp-signin" to="/auth">{t.signIn}</Link><Link className="lp-cta" to="/auth?mode=signup">{t.getStarted}</Link></div>
      </header>

      <section className="lp-hero lp-hero-reference" id="home">
        {!reducedMotion && <div className="lp-hero-rays" aria-hidden="true"><LightRays
          raysOrigin="top-center"
          raysColor="#075cf5"
          raysSpeed={0.12}
          lightSpread={0.68}
          rayLength={1.7}
          rayDensity={0.75}
          tilt={-8}
          raySharpness={0.25}
          glow={0.28}
          haze={0.08}
          atmosphere={0.35}
          intensity={0.42}
          pulsating={false}
          followMouse={false}
          cursorShadow={false}
          clickPulse={false}
          noiseAmount={0}
          distortion={0}
          intro={true}
          lightMode={true}
          opacity={0.28}
          maxDevicePixelRatio={1.25}
        /></div>}
        <div className="lp-hero-copy">
          <h1 className="lp-hero-semantic-title">TestDZ</h1>
          <BlurText text="TestDZ" className="lp-hero-title" ariaHidden effect="blur" animateBy="words" direction="bottom" trigger="load" delay={65} stepDuration={0.42} blur={8} distance={14} />
          <h2>{t.heroLead} <span>{t.heroAccent}</span></h2>
          <p>{t.heroBody}</p>
          <div className="lp-hero-buttons">
            <Link className="lp-cta lp-cta-star" to="/auth?mode=signup"><StarBorder as="span" className="lp-star-border-inner" theme="light" backgroundColor="transparent" textColor="#ffffff" borderColor="rgba(255,255,255,.42)" color="#ffffff" trailColor="#d8e8ff" duration={5.2} thickness={1} radius={26} trailLength={0.22} stars={1} glow={0.38} sparkle={false} hover="brighten" clickPulse={false}>{t.getStarted} <LpIcon name="arrow" size={17}/></StarBorder></Link>
            <a className="lp-secondary" href="#features">{t.exploreTests} <LpIcon name="play" size={15}/></a>
          </div>
          <div className="lp-proof" aria-label={t.visualLabel}>
            <div className="lp-proof-symbols" aria-hidden="true"><span>✦</span><span>⌘</span><span>✓</span><span>♙</span></div>
            <div><strong><span className="lp-counter" data-count="2">0</span></strong><small>{language === "ar" ? "مساران للمشاركة" : language === "fr" ? "parcours disponibles" : "Ways to participate"}</small></div>
            <i className="lp-proof-divider"/>
            <div className="lp-proof-day"><strong><span className="lp-counter" data-count="14">0</span></strong><small>{t.days} · {language === "ar" ? "دورة الاختبار" : language === "fr" ? "cycle de test" : "test cycle"}</small></div>
          </div>
        </div>
        <div className="lp-hero-art lp-hero-image-wrap">
          <img className="lp-hero-image" src="/images/hero-dashboard.png" alt={t.illustration} fetchPriority="high" />
        </div>
      </section>

      <section className="lp-features" id="features">
        <article><span className="lp-feature-icon green"><LpIcon name="shield" size={30}/></span><h3>{t.secure}</h3><p>{t.secureBody}</p></article>
        <article><span className="lp-feature-icon blue"><LpIcon name="bolt" size={30}/></span><h3>{t.fourteen}</h3><p>{t.fourteenBody}</p></article>
        <article><span className="lp-feature-icon purple"><LpIcon name="gift" size={30}/></span><h3>{t.earn}</h3><p>{t.earnBody}</p></article>
        <article><span className="lp-feature-icon cyan"><LpIcon name="users" size={30}/></span><h3>{t.everyone}</h3><p>{t.everyoneBody}</p></article>
      </section>

      <section className="lp-how" id="how-it-works">
        <div className="lp-section-title"><h2>{t.howTitle}</h2><p>{t.howBody}</p></div>
        <div className="lp-steps">
          <article><b className="lp-step-number">1</b><span><LpIcon name="user-plus" size={32}/></span><h3>{t.create}</h3><p>{t.createBody}</p></article><i>→</i>
          <article><b className="lp-step-number">2</b><span><LpIcon name="clipboard" size={32}/></span><h3>{t.take}</h3><p>{t.takeBody}</p></article><i>→</i>
          <article><b className="lp-step-number">3</b><span><LpIcon name="trophy" size={32}/></span><h3>{t.grow}</h3><p>{t.growBody}</p></article>
        </div>
      </section>

      <section className="lp-promo" id="test-window"><div className="lp-hourglass"><LpIcon name="hourglass" size={58}/></div><div><h2>{t.promoTitle}<br/><span>{t.promoAccent}</span></h2><p>{t.promoBody}</p></div><div className="lp-promo-calendar"><LpIcon name="calendar" size={70}/></div><a href="#testers">{t.exploreActive} <LpIcon name="arrow" size={16}/></a></section>

      <section className="lp-testimonials lp-community">
        <div className="lp-section-title"><h2>{t.communityTitle}</h2></div>
        <div className="lp-quotes">
          <article id="testers"><span className="lp-person"><LpIcon name="users" size={22}/></span><div><p>{t.communityOneBody}</p><b>{t.communityOneTitle}</b><small>{t.tester}</small></div></article>
          <article id="developers"><span className="lp-person"><LpIcon name="code" size={22}/></span><div><p>{t.communityTwoBody}</p><b>{t.communityTwoTitle}</b><small>{t.developer}</small></div></article>
          <article><span className="lp-person"><LpIcon name="users" size={22}/></span><div><p>{t.communityThreeBody}</p><b>{t.communityThreeTitle}</b><small>TestDZ</small></div></article>
        </div>
      </section>

      <section className="lp-faq" id="faq">
        <div className="lp-faq-illustration"><img className="lp-faq-image" src="/images/faq-assistant.png" alt={t.illustration} loading="lazy" /></div>
        <div className="lp-faq-copy"><h2>{t.faqTitle}</h2><p>{t.faqIntro}</p><a href="#faq-questions">{t.viewFaq} <LpIcon name="arrow" size={15}/></a></div>
        <div className="lp-faq-list" id="faq-questions"><details><summary>{t.faq1q}</summary><p>{t.faq1a}</p></details><details><summary>{t.faq2q}</summary><p>{t.faq2a}</p></details><details><summary>{t.faq3q}</summary><p>{t.faq3a}</p></details><details><summary>{t.faq4q}</summary><p>{t.faq4a}</p></details></div>
      </section>

      <footer className="lp-footer"><Link className="lp-brand" to="/"><span className="lp-flask"><LpIcon name="flask" size={29}/></span><span>TestDZ</span></Link><nav aria-label={t.home}><a href="#home">{t.home}</a><a href="#features">{t.features}</a><a href="#how-it-works">{t.how}</a><a href="#faq">{t.faqTitle}</a></nav><small>{t.copyright}</small></footer>
    </main>
  );
}

function translateAuthError(message: string) {
  const value = message.toLowerCase();
  if (value.includes("already registered") || value.includes("already been registered")) return "هذا البريد مسجل بالفعل. جرّب تسجيل الدخول.";
  if (value.includes("invalid login credentials")) return "البريد الإلكتروني أو كلمة المرور غير صحيحة.";
  if (value.includes("email not confirmed")) return "يجب تأكيد بريدك الإلكتروني قبل تسجيل الدخول.";
  if (value.includes("password") && value.includes("least")) return "كلمة المرور لا تستوفي الحد الأدنى المطلوب.";
  if (value.includes("too many requests") || value.includes("rate limit")) return "محاولات كثيرة خلال وقت قصير. انتظر قليلاً ثم أعد المحاولة.";
  return "تعذر إكمال العملية. تحقق من البيانات وحاول مرة أخرى.";
}

function AuthPage() {
  const navigate = useNavigate();
  const params = new URLSearchParams(window.location.search);
  const [mode, setMode] = useState<"signin" | "signup">(params.get("mode") === "signup" ? "signup" : "signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage("");
    setError("");
    if (!supabase) {
      setError("الاتصال بقاعدة البيانات غير مضبوط بعد. أضف متغيرات Supabase في ملف البيئة.");
      return;
    }
    if (mode === "signup" && (!/[A-Za-z]/.test(password) || !/[0-9]/.test(password))) { setError("كلمة المرور يجب أن تحتوي على حرف ورقم، وبحد أدنى 8 أحرف."); return; }
    setBusy(true);
    try {
      if (mode === "signup") {
        const { data, error: authError } = await supabase.auth.signUp({
          email: email.trim(),
          password,
          options: { data: { full_name: fullName.trim(), phone: phone.trim() || null }, emailRedirectTo: window.location.origin + "/auth/callback" },
        });
        if (authError) throw authError;
        if (data.session) navigate("/dashboard");
        else setMessage("تم إنشاء الحساب. تحقق من بريدك الإلكتروني لتأكيده قبل تسجيل الدخول.");
      } else {
        const { error: authError } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
        if (authError) throw authError;
        navigate("/dashboard");
      }
    } catch (err) {
      setError(err instanceof Error ? translateAuthError(err.message) : "حدث خطأ غير متوقع. حاول مرة أخرى.");
    } finally {
      setBusy(false);
    }
  }

  return <main className="auth-layout"><div className="auth-side"><Brand /><div className="auth-side-copy"><span className="eyebrow">TESTDZ PLATFORM</span><h1>مساحة واحدة<br /><span>لاختبار أفضل.</span></h1><p>تابع مهامك، شارك ملاحظاتك، وساعد تطبيقات Android على التحسن.</p></div><span className="auth-side-foot">TestDZ · Algeria first</span></div><section className="auth-panel"><div className="auth-panel-top"><Link to="/">العودة للرئيسية</Link></div><div className="auth-form-wrap"><span className="eyebrow">{mode === "signup" ? "انضم إلى TestDZ" : "مرحباً بعودتك"}</span><h2>{mode === "signup" ? "أنشئ حسابك" : "تسجيل الدخول"}</h2><p className="form-intro">{mode === "signup" ? "ابدأ رحلتك في اختبار التطبيقات والتعاون." : "أدخل بياناتك للمتابعة إلى حسابك."}</p>
      {!isSupabaseConfigured && <div className="notice notice-warning">الواجهة جاهزة، لكن يلزم ضبط متغيرات Supabase في ملف <code>.env</code> لتفعيل المصادقة.</div>}
      {message && <div className="notice notice-success" role="status">{message}</div>}
      {error && <div className="notice notice-error" role="alert">{error}</div>}
      <form onSubmit={submit} className="auth-form">
        {mode === "signup" && <><label>الاسم الكامل<input autoComplete="name" value={fullName} onChange={e => setFullName(e.target.value)} required minLength={2} placeholder="كيف نناديك؟" /></label><label>رقم الهاتف <small>اختياري، وغير موثّق حالياً</small><input type="tel" autoComplete="tel" value={phone} onChange={e => setPhone(e.target.value)} placeholder="+213..." dir="ltr" /></label></>}
        <label>البريد الإلكتروني<input type="email" autoComplete="email" value={email} onChange={e => setEmail(e.target.value)} required placeholder="name@example.com" dir="ltr" /></label>
        <label>كلمة المرور<input type="password" autoComplete={mode === "signup" ? "new-password" : "current-password"} value={password} onChange={e => setPassword(e.target.value)} required minLength={8} placeholder="8 أحرف على الأقل" dir="ltr" /></label>
        <button className="button button-primary button-large submit-button" type="submit" disabled={busy}>{busy ? "جارٍ المعالجة..." : mode === "signup" ? "إنشاء الحساب" : "دخول"}</button>
      </form>
      <p className="switch-auth">{mode === "signin" && <Link to="/forgot-password">نسيت كلمة المرور؟</Link>}　{mode === "signup" ? "لديك حساب بالفعل؟" : "ليس لديك حساب؟"} <button type="button" onClick={() => { setMode(mode === "signup" ? "signin" : "signup"); setError(""); setMessage(""); }}>{mode === "signup" ? "سجّل الدخول" : "أنشئ حساباً"}</button></p>
      <p className="legal-note"><Link to="/verify-email">لم تصلك رسالة التأكيد؟</Link><br/>بالمتابعة، أنت توافق على استخدام TestDZ وفق شروط المنصة وسياسة الخصوصية عند نشرهما.</p>
    </div></section></main>;
}

function DashboardPage() {
  const [session, setSession] = useState<Session | null>(null);
  const [roles, setRoles] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    const client = supabase;
    if (!client) { setLoading(false); return; }
    client.auth.getSession().then(async ({ data }) => { setSession(data.session); if (data.session) { const { data: roleRows } = await client.from("user_roles").select("role").eq("user_id", data.session.user.id); setRoles((roleRows ?? []).map((row: { role: string }) => row.role)); } setLoading(false); });
    const { data } = client.auth.onAuthStateChange(async (_event, nextSession) => { setSession(nextSession); if (nextSession) { const { data: roleRows } = await client.from("user_roles").select("role").eq("user_id", nextSession.user.id); setRoles((roleRows ?? []).map((row: { role: string }) => row.role)); } else setRoles([]); });
    return () => data.subscription.unsubscribe();
  }, []);
  if (loading) return <div className="loading-screen">جارٍ تحميل حسابك...</div>;
  if (!session) return <Navigate to="/auth" replace />;
  return <main className="dashboard-shell"><header className="site-header container"><Brand /><button className="button button-quiet" onClick={async () => { await supabase?.auth.signOut(); }}>تسجيل الخروج</button></header><section className="dashboard-welcome container"><span className="eyebrow">مساحة العمل</span><h1>مرحباً بك في <span>TestDZ</span></h1><p>تم تسجيل الدخول بنجاح. نبني الآن لوحة مهام المختبر والمطور.</p><div className="dashboard-card"><strong>{session.user.email}</strong><span>الأدوار: {roles.length ? roles.join(" · ") : "غير محدد"}</span><span>حالة البريد: {session.user.email_confirmed_at ? "مؤكد" : "بانتظار التأكيد"}</span><Link to="/profile">إدارة الملف الشخصي ←</Link>{roles.includes("developer") && <><span>مساحة المطور — إدارة تطبيقاتك ودورات الاختبار.</span><Link to="/apps">إدارة تطبيقاتي ←</Link></>}{roles.includes("tester") && <span>مساحة المختبر — اكتشاف الاختبارات ستكون متاحة بعد اكتمال محرك الاختبارات.</span>}</div><p className="dashboard-note">هذه نسخة تأسيسية؛ لم نعرض بيانات وهمية أو مهام تجريبية.</p></section></main>;
}


function AuthCallbackPage() {
  const navigate = useNavigate();
  const [message, setMessage] = useState("جارٍ التحقق من رابط الدخول...");
  useEffect(() => {
    if (!supabase) { setMessage("إعداد الاتصال غير مكتمل."); return; }
    const hash = new URLSearchParams(window.location.hash.slice(1));
    const errorDescription = hash.get("error_description");
    if (errorDescription) { setMessage("تعذر تأكيد الرابط: " + errorDescription); return; }
    supabase.auth.getSession().then(({ data, error }) => {
      if (error) setMessage("تعذر إكمال المصادقة. اطلب رابطاً جديداً.");
      else if (data.session) navigate("/onboarding", { replace: true });
      else setMessage("الرابط غير صالح أو انتهت صلاحيته. ارجع لصفحة الدخول واطلب رابطاً جديداً.");
    });
  }, [navigate]);
  return <main className="auth-layout"><section className="auth-panel"><div className="auth-form-wrap"><Brand /><h2>تأكيد الحساب</h2><p>{message}</p><Link className="button button-primary" to="/auth">العودة للدخول</Link></div></section></main>;
}

function VerifyEmailPage() {
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  async function resend(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setBusy(true); setMessage(""); setError("");
    if (!supabase) { setError("إعداد Supabase غير مكتمل."); setBusy(false); return; }
    const { error: resendError } = await supabase.auth.resend({ type: "signup", email: email.trim(), options: { emailRedirectTo: window.location.origin + "/auth/callback" } });
    if (resendError) setError("تعذر إرسال الرسالة الآن. انتظر قليلاً ثم حاول مجدداً.");
    else setMessage("إذا كان الحساب يحتاج إلى تأكيد، فسيتم إرسال رسالة إلى بريدك.");
    setBusy(false);
  }
  return <main className="auth-layout"><section className="auth-panel"><div className="auth-form-wrap"><Brand /><span className="eyebrow">تأكيد البريد الإلكتروني</span><h2>تحقق من بريدك</h2><p className="form-intro">افتح رسالة TestDZ واضغط رابط التأكيد. يمكنك طلب رسالة جديدة أدناه.</p>{message && <div className="notice notice-success">{message}</div>}{error && <div className="notice notice-error">{error}</div>}<form className="auth-form" onSubmit={resend}><label>البريد الإلكتروني<input type="email" required value={email} onChange={e=>setEmail(e.target.value)} dir="ltr" /></label><button className="button button-primary button-large" disabled={busy}>{busy ? "جارٍ الإرسال..." : "إعادة إرسال رابط التأكيد"}</button></form><Link to="/auth">العودة للدخول</Link></div></section></main>;
}

function ForgotPasswordPage() {
  const [email,setEmail]=useState(""); const [message,setMessage]=useState(""); const [error,setError]=useState(""); const [busy,setBusy]=useState(false);
  async function submit(e:FormEvent<HTMLFormElement>){e.preventDefault();setBusy(true);setError("");setMessage("");if(!supabase){setError("إعداد Supabase غير مكتمل.");setBusy(false);return;}const {error:err}=await supabase.auth.resetPasswordForEmail(email.trim(),{redirectTo:window.location.origin+"/reset-password"});if(err)setError("تعذر إرسال رابط الاستعادة. حاول لاحقاً.");else setMessage("إذا كان البريد مسجلاً، ستصلك رسالة لاستعادة كلمة المرور.");setBusy(false);}
  return <main className="auth-layout"><section className="auth-panel"><div className="auth-form-wrap"><Brand /><span className="eyebrow">استعادة الحساب</span><h2>نسيت كلمة المرور؟</h2><p className="form-intro">أدخل بريدك وسنرسل رابطاً آمناً لإعادة تعيينها.</p>{message&&<div className="notice notice-success">{message}</div>}{error&&<div className="notice notice-error">{error}</div>}<form className="auth-form" onSubmit={submit}><label>البريد الإلكتروني<input type="email" required value={email} onChange={e=>setEmail(e.target.value)} dir="ltr"/></label><button className="button button-primary button-large" disabled={busy}>{busy?"جارٍ الإرسال...":"إرسال رابط الاستعادة"}</button></form><Link to="/auth">العودة للدخول</Link></div></section></main>;
}

function ResetPasswordPage() {
  const [password,setPassword]=useState("");const [confirm,setConfirm]=useState("");const [message,setMessage]=useState("");const [error,setError]=useState("");const [busy,setBusy]=useState(false);
  async function submit(e:FormEvent<HTMLFormElement>){e.preventDefault();setError("");setMessage("");if(password.length<8||!/[A-Za-z]/.test(password)||!/[0-9]/.test(password)){setError("استخدم 8 أحرف على الأقل، مع حرف ورقم.");return;}if(password!==confirm){setError("كلمتا المرور غير متطابقتين.");return;}if(!supabase){setError("إعداد Supabase غير مكتمل.");return;}setBusy(true);const {error:err}=await supabase.auth.updateUser({password});if(err)setError("الرابط غير صالح أو انتهت صلاحيته. اطلب رابطاً جديداً.");else setMessage("تم تحديث كلمة المرور. يمكنك الآن تسجيل الدخول.");setBusy(false);}
  return <main className="auth-layout"><section className="auth-panel"><div className="auth-form-wrap"><Brand /><span className="eyebrow">كلمة مرور جديدة</span><h2>أعد تعيين كلمة المرور</h2>{message&&<div className="notice notice-success">{message} <Link to="/auth">تسجيل الدخول</Link></div>}{error&&<div className="notice notice-error">{error}</div>}<form className="auth-form" onSubmit={submit}><label>كلمة المرور الجديدة<input type="password" required minLength={8} value={password} onChange={e=>setPassword(e.target.value)} dir="ltr"/></label><label>تأكيد كلمة المرور<input type="password" required value={confirm} onChange={e=>setConfirm(e.target.value)} dir="ltr"/></label><button className="button button-primary button-large" disabled={busy}>{busy?"جارٍ الحفظ...":"حفظ كلمة المرور"}</button></form></div></section></main>;
}

function OnboardingPage() {
  const navigate=useNavigate();const [choice,setChoice]=useState("tester");const [interests,setInterests]=useState<string[]>([]);const [busy,setBusy]=useState(false);const [error,setError]=useState("");
  const options=["أدوات وإنتاجية","تعليم","ألعاب","تجارة إلكترونية","صحة ولياقة","شبكات اجتماعية","أخرى"];
  useEffect(()=>{if(!supabase)return;supabase.auth.getSession().then(({data})=>{if(!data.session)navigate("/auth",{replace:true});});},[navigate]);
  function toggle(item:string){setInterests(current=>current.includes(item)?current.filter(x=>x!==item):current.length<7?[...current,item]:current);}
  async function finish(){if(!supabase){setError("إعداد Supabase غير مكتمل.");return;}setBusy(true);setError("");const roles=choice==="both"?["tester","developer"]:[choice];const {error:err}=await supabase.rpc("complete_onboarding",{p_roles:roles,p_interests:interests});if(err)setError("تعذر حفظ إعدادات الحساب. حاول مرة أخرى.");else navigate("/dashboard",{replace:true});setBusy(false);}
  return <main className="auth-layout"><section className="auth-panel"><div className="auth-form-wrap"><Brand /><span className="eyebrow">خطوة واحدة للبدء</span><h2>كيف ستستخدم TestDZ؟</h2><p className="form-intro">يمكنك الجمع بين الاختبار وتطوير التطبيقات.</p><div className="role-options">{[{value:"tester",label:"مختبر",desc:"أختبر التطبيقات وأشارك ملاحظاتي."},{value:"developer",label:"مطور",desc:"أنشر تطبيقاتي وأنظم اختبارات لها."},{value:"both",label:"كلاهما",desc:"أطور تطبيقاتي وأختبر تطبيقات الآخرين."}].map(item=><button type="button" key={item.value} className={"role-option "+(choice===item.value?"selected":"")} onClick={()=>setChoice(item.value)}><strong>{item.label}</strong><span>{item.desc}</span></button>)}</div><h3>ما المجالات التي تهمك؟ <small>اختياري</small></h3><div className="interest-options">{options.map(item=><button type="button" key={item} className={interests.includes(item)?"selected":""} onClick={()=>toggle(item)}>{item}</button>)}</div>{error&&<div className="notice notice-error">{error}</div>}<button className="button button-primary button-large submit-button" disabled={busy} onClick={finish}>{busy?"جارٍ الحفظ...":"متابعة إلى لوحة التحكم"}</button><button className="text-button" type="button" onClick={()=>{setChoice("tester");setInterests([]);}}>تخطي واستخدام الإعداد الافتراضي (مختبر)</button></div></section></main>;
}

function ProfilePage() {
  const navigate=useNavigate();
  const [userId,setUserId]=useState("");const [displayName,setDisplayName]=useState("");const [phone,setPhone]=useState("");const [bio,setBio]=useState("");const [avatarUrl,setAvatarUrl]=useState("");const [verified,setVerified]=useState(false);const [busy,setBusy]=useState(false);const [message,setMessage]=useState("");const [error,setError]=useState("");
  useEffect(()=>{const client=supabase;if(!client)return;client.auth.getUser().then(async({data,error:authError})=>{if(authError||!data.user){navigate("/auth",{replace:true});return;}setUserId(data.user.id);const {data:profile,error:profileError}=await client.from("profiles").select("display_name,phone,bio,avatar_url,is_verified").eq("id",data.user.id).single();if(profileError){setError("تعذر تحميل الملف الشخصي.");return;}setDisplayName(profile.display_name??"");setPhone(profile.phone??"");setBio(profile.bio??"");setAvatarUrl(profile.avatar_url??"");setVerified(Boolean(profile.is_verified));});},[navigate]);
  async function save(e:FormEvent<HTMLFormElement>){e.preventDefault();if(!supabase)return;setBusy(true);setMessage("");setError("");const {error:err}=await supabase.from("profiles").update({display_name:displayName.trim(),phone:phone.trim()||null,bio:bio.trim()||null}).eq("id",userId);if(err)setError("تعذر حفظ الملف الشخصي. تحقق من البيانات وحاول مجدداً.");else setMessage("تم حفظ الملف الشخصي.");setBusy(false);}
  async function upload(file?:File){if(!file||!supabase)return;setError("");setMessage("");if(file.size>8*1024*1024){setError("حجم الصورة الأصلية يجب ألا يتجاوز 8 ميغابايت.");return;}if(!["image/jpeg","image/png","image/webp"].includes(file.type)){setError("الصيغ المدعومة: JPG وPNG وWebP.");return;}setBusy(true);let compressed:File;try{const output=await imageCompression(file,{maxSizeMB:0.45,maxWidthOrHeight:512,useWebWorker:true});const ext=output.type==="image/png"?"png":output.type==="image/webp"?"webp":"jpg";compressed=new File([output],"avatar."+ext,{type:output.type||"image/jpeg"});}catch{setError("تعذر ضغط الصورة. اختر صورة أخرى.");setBusy(false);return;}const ext=compressed.type==="image/png"?"png":compressed.type==="image/webp"?"webp":"jpg";const path=userId+"/avatar."+ext;const {error:uploadError}=await supabase.storage.from("avatars").upload(path,compressed,{upsert:true,contentType:compressed.type,cacheControl:"3600"});if(uploadError){setError("تعذر رفع الصورة. حاول مرة أخرى.");setBusy(false);return;}const {data}=supabase.storage.from("avatars").getPublicUrl(path);const url=data.publicUrl+"?v="+Date.now();const {error:updateError}=await supabase.from("profiles").update({avatar_url:url}).eq("id",userId);if(updateError)setError("تم رفع الصورة لكن تعذر حفظ رابطها في الملف الشخصي.");else{setAvatarUrl(url);setMessage("تم تحديث الصورة.");}setBusy(false);}
  return <main className="dashboard-shell"><header className="site-header container"><Brand /><Link to="/dashboard">لوحة التحكم</Link></header><section className="dashboard-welcome container"><span className="eyebrow">إعدادات الحساب</span><h1>ملفي الشخصي</h1><div className="dashboard-card profile-card"><div className="profile-avatar">{avatarUrl?<img src={avatarUrl} alt="الصورة الشخصية"/>:<span>{displayName.slice(0,1)||"T"}</span>}</div><label className="button button-outline">تغيير الصورة<input type="file" accept="image/jpeg,image/png,image/webp" hidden onChange={e=>upload(e.target.files?.[0])}/></label><small>حتى 8MB قبل الضغط · 512px بعد الضغط · JPG, PNG, WebP</small></div><form className="auth-form profile-form" onSubmit={save}><label>الاسم الكامل<input required minLength={2} value={displayName} onChange={e=>setDisplayName(e.target.value)}/></label><label>رقم الهاتف (اختياري)<input type="tel" value={phone} onChange={e=>setPhone(e.target.value)} dir="ltr"/></label><label>نبذة قصيرة<textarea rows={4} maxLength={300} value={bio} onChange={e=>setBio(e.target.value)}/></label><div className="verification-line">حالة البريد: <strong>{verified?"مؤكد":"بانتظار التأكيد"}</strong></div>{message&&<div className="notice notice-success">{message}</div>}{error&&<div className="notice notice-error">{error}</div>}<button className="button button-primary button-large" disabled={busy}>{busy?"جارٍ الحفظ...":"حفظ التغييرات"}</button></form><p className="dashboard-note">الأدوار وحالة التحقق والخطة لا يمكن تعديلها من هذه الصفحة.</p></section></main>;
}



const APP_CATEGORIES = [
  { value: "games", label: "ألعاب" },
  { value: "tools", label: "أدوات" },
  { value: "education", label: "تعليم" },
  { value: "social", label: "اجتماعي" },
  { value: "health", label: "صحة" },
  { value: "other", label: "أخرى" },
] as const;

type AppRecord = {
  id: string; developer_id: string; name: string; package_name: string;
  description: string | null; category: string; icon_url: string | null;
  status: "draft" | "published" | "paused" | "archived"; created_at: string;
};

type AppLimit = { plan_code: string; max_active_apps: number; current_active_apps: number; can_create: boolean };

function appError(message: string) {
  if (message.includes("PLAN_LIMIT_REACHED")) return "وصلت إلى الحد الأقصى لتطبيقات خطتك. يمكنك أرشفة تطبيق أو ترقية خطتك.";
  if (message.includes("apps_package_name_global_unique") || message.includes("duplicate key")) return "اسم الحزمة مستخدم بالفعل في المنصة.";
  if (message.includes("DEVELOPER_ROLE_REQUIRED")) return "يلزم تفعيل دور المطوّر قبل إضافة تطبيق.";
  if (message.includes("PACKAGE_NAME_INVALID")) return "اسم الحزمة غير صالح. مثال: dz.testdz.myapp";
  return "تعذّر تنفيذ العملية. تحقق من البيانات وحاول مجدداً.";
}

function useCurrentUser() {
  const [userId,setUserId]=useState<string|null>(null);
  useEffect(()=>{supabase?.auth.getUser().then(({data})=>setUserId(data.user?.id??null));},[]);
  return userId;
}

function AppsPage() {
  const userId=useCurrentUser();
  const navigate=useNavigate();
  const [apps,setApps]=useState<AppRecord[]>([]);
  const [limit,setLimit]=useState<AppLimit|null>(null);
  const [filter,setFilter]=useState<"all"|"active"|"archived">("all");
  const [search,setSearch]=useState("");
  const [loading,setLoading]=useState(true);
  const [error,setError]=useState("");
  const [showForm,setShowForm]=useState(false);
  const [busy,setBusy]=useState(false);
  const [name,setName]=useState("");
  const [packageName,setPackageName]=useState("");
  const [description,setDescription]=useState("");
  const [category,setCategory]=useState("tools");
  const [icon,setIcon]=useState<File|null>(null);
  const [preview,setPreview]=useState("");
  const [notice,setNotice]=useState("");

  async function load(){
    if(!supabase)return;
    setLoading(true);setError("");
    const [{data:rows,error:appsError},{data:limits,error:limitError}]=await Promise.all([
      supabase.from("apps").select("id,developer_id,name,package_name,description,category,icon_url,status,created_at").order("created_at",{ascending:false}),
      supabase.rpc("get_app_limit")
    ]);
    if(appsError)setError("تعذر تحميل التطبيقات. حاول تحديث الصفحة.");
    else setApps((rows??[]) as AppRecord[]);
    if(limitError)setError("تعذر قراءة حد الخطة حالياً.");
    else setLimit(Array.isArray(limits)?limits[0]??null:limits as AppLimit);
    setLoading(false);
  }
  useEffect(()=>{if(!supabase){setError("اتصال Supabase غير مضبوط.");setLoading(false);return;}if(userId)void load();else supabase.auth.getSession().then(({data})=>{if(!data.session){navigate("/auth",{replace:true});setLoading(false);}});},[userId]);
  useEffect(()=>{if(!icon){setPreview("");return;}const url=URL.createObjectURL(icon);setPreview(url);return()=>URL.revokeObjectURL(url);},[icon]);

  async function chooseIcon(file?:File){
    if(!file)return;
    if(!["image/png","image/jpeg"].includes(file.type)){setError("الأيقونة يجب أن تكون PNG أو JPG.");return;}
    try{
      const compressed=await imageCompression(file,{maxSizeMB:0.45,maxWidthOrHeight:512,useWebWorker:true});
      setIcon(new File([compressed],file.name.replace(/\.[^.]+$/,"")+".jpg",{type:compressed.type||"image/jpeg"}));
      setError("");
    }catch{setError("تعذر تجهيز الصورة. اختر صورة أخرى.");}
  }
  function resetForm(){setName("");setPackageName("");setDescription("");setCategory("tools");setIcon(null);setPreview("");setShowForm(false);}
  async function create(event:FormEvent<HTMLFormElement>){
    event.preventDefault();if(!supabase||!userId)return;
    if(name.trim().length<3||name.trim().length>50||description.trim().length<20||description.trim().length>500){setError("الاسم 3–50 حرفاً والوصف 20–500 حرف.");return;}
    if(!/^[a-z][a-z0-9_]*(\.[a-z][a-z0-9_]*)+$/.test(packageName.trim())){setError("اسم الحزمة غير صالح. مثال: dz.testdz.myapp");return;}
    setBusy(true);setError("");setNotice("");
    const {data:appId,error:createError}=await supabase.rpc("create_app",{p_name:name,p_package_name:packageName,p_description:description,p_category:category});
    if(createError){setError(appError(createError.message));setBusy(false);return;}
    if(icon){
      const ext=icon.type==="image/png"?"png":"jpg";
      const path=userId+"/"+appId+"/icon."+ext;
      const {error:uploadError}=await supabase.storage.from("app-icons").upload(path,icon,{upsert:true,contentType:icon.type,cacheControl:"3600"});
      if(uploadError){setError("أُنشئ التطبيق، لكن تعذر رفع الأيقونة. يمكنك إضافتها لاحقاً.");}
      else{
        const {data}=supabase.storage.from("app-icons").getPublicUrl(path);
        const {error:updateError}=await supabase.rpc("update_app",{p_app_id:appId,p_name:name,p_description:description,p_category:category,p_icon_url:data.publicUrl});
        if(updateError)setError("أُنشئ التطبيق ورُفعت الأيقونة، لكن تعذر ربطها بالتطبيق.");
      }
    }
    resetForm();setNotice("تم إنشاء التطبيق كمسودة.");await load();setBusy(false);
  }
  const visible=apps.filter(a=>(filter==="all"?a.status!=="archived":filter==="active"?a.status!=="archived":a.status==="archived")&&a.name.toLowerCase().includes(search.toLowerCase()));
  return <main className="dashboard-shell"><header className="site-header container"><Brand/><nav className="header-actions"><Link to="/dashboard">لوحة التحكم</Link><Link to="/profile">الملف الشخصي</Link></nav></header><section className="dashboard-welcome container">
    <div className="apps-heading"><div><span className="eyebrow">مساحة المطوّر</span><h1>تطبيقاتي</h1><p>أدر تطبيقات Android الخاصة بك من مكان واحد.</p></div><button className="button button-primary" onClick={()=>{setError("");setShowForm(true);}} disabled={!limit||!limit.can_create}>＋ إضافة تطبيق</button></div>
    {limit&&<div className="apps-limit"><span>الخطة: <strong>{limit.plan_code.toUpperCase()}</strong></span><span>{limit.current_active_apps} / {limit.max_active_apps} تطبيق نشط</span>{limit.current_active_apps>=limit.max_active_apps&&<Link to="/pricing">ترقية الخطة</Link>}</div>}
    {notice&&<div className="notice notice-success">{notice}</div>}{error&&<div className="notice notice-error">{error}</div>}
    <div className="apps-toolbar"><div className="filter-tabs">{(["all","active","archived"] as const).map(v=><button key={v} className={filter===v?"selected":""} onClick={()=>setFilter(v)}>{v==="all"?"الكل":v==="active"?"النشطة":"المؤرشفة"}</button>)}</div><input aria-label="بحث التطبيقات" placeholder="ابحث عن تطبيق..." value={search} onChange={e=>setSearch(e.target.value)}/></div>
    {loading?<div className="loading-screen">جارٍ تحميل التطبيقات...</div>:visible.length===0?<div className="apps-empty"><div className="empty-icon">▣</div><h2>{search?"لا توجد نتائج":"لا توجد تطبيقات هنا بعد"}</h2><p>{search?"جرّب كلمة بحث أخرى.":"أضف أول تطبيق Android لبدء تنظيم اختباره."}</p>{filter!=="archived"&&<button className="button button-primary" disabled={!limit||!limit.can_create} onClick={()=>setShowForm(true)}>إضافة أول تطبيق</button>}</div>:<div className="apps-grid">{visible.map(app=><article className="app-tile" key={app.id}><button className="app-tile-main" onClick={()=>navigate("/apps/"+app.id)}>{app.icon_url?<img src={app.icon_url} alt="" className="app-tile-icon"/>:<span className="app-tile-icon app-tile-placeholder">▣</span>}<span className="app-tile-copy"><strong>{app.name}</strong><small>{app.package_name}</small><em className={"app-status status-"+app.status}>{app.status==="archived"?"مؤرشف":app.status==="published"?"منشور":app.status==="paused"?"متوقف":"مسودة"}</em></span><span className="app-chevron">←</span></button><div className="app-tile-footer"><span>{APP_CATEGORIES.find(c=>c.value===app.category)?.label??"أخرى"}</span><Link to={"/apps/"+app.id}>التفاصيل</Link></div></article>)}</div>}
  </section>
  {showForm&&<div className="modal-backdrop" role="presentation" onMouseDown={e=>{if(e.target===e.currentTarget)resetForm();}}><section className="app-modal" role="dialog" aria-modal="true" aria-labelledby="new-app-title"><div className="modal-heading"><div><span className="eyebrow">تطبيق جديد</span><h2 id="new-app-title">أضف تطبيقك</h2></div><button className="modal-close" onClick={resetForm} aria-label="إغلاق">×</button></div><form className="auth-form" onSubmit={create}><label>اسم التطبيق<input required minLength={3} maxLength={50} value={name} onChange={e=>setName(e.target.value)} placeholder="مثال: تطبيق المهام"/></label><label>اسم الحزمة<input required value={packageName} onChange={e=>setPackageName(e.target.value)} dir="ltr" placeholder="dz.example.myapp"/></label><label>الوصف<input required minLength={20} maxLength={500} value={description} onChange={e=>setDescription(e.target.value)} placeholder="اكتب وصفاً واضحاً للتطبيق (20–500 حرف)"/></label><label>الفئة<select value={category} onChange={e=>setCategory(e.target.value)}>{APP_CATEGORIES.map(c=><option value={c.value} key={c.value}>{c.label}</option>)}</select></label><label>أيقونة التطبيق <small>PNG أو JPG · 512px كحد أقصى · تُضغط قبل الرفع</small><input type="file" accept="image/png,image/jpeg" onChange={e=>chooseIcon(e.target.files?.[0])}/></label>{preview&&<img src={preview} className="icon-preview" alt="معاينة الأيقونة"/>}<p className="form-hint">سيُحفظ التطبيق كمسودة. يمكنك إكمال بياناته لاحقاً.</p><div className="modal-actions"><button type="button" className="button button-quiet" onClick={resetForm}>إلغاء</button><button type="submit" className="button button-primary" disabled={busy}>{busy?"جارٍ الإنشاء...":"إنشاء التطبيق"}</button></div></form></section></div>}
  </main>;
}

function AppDetailPage(){
  const {id}=useParams();const [app,setApp]=useState<AppRecord|null>(null);const [loading,setLoading]=useState(true);const [error,setError]=useState("");const [editing,setEditing]=useState(false);const [name,setName]=useState("");const [description,setDescription]=useState("");const [category,setCategory]=useState("other");const [busy,setBusy]=useState(false);const [notice,setNotice]=useState("");
  async function load(){if(!supabase||!id){setError("تعذر الاتصال بالتطبيق.");setLoading(false);return;}const {data,error:err}=await supabase.from("apps").select("id,developer_id,name,package_name,description,category,icon_url,status,created_at").eq("id",id).single();if(err)setError("التطبيق غير موجود أو لا تملك صلاحية عرضه.");else{const a=data as AppRecord;setApp(a);setName(a.name);setDescription(a.description??"");setCategory(a.category??"other");}setLoading(false);}
  useEffect(()=>{void load();},[id]);
  async function save(e:FormEvent<HTMLFormElement>){e.preventDefault();if(!supabase||!id)return;setBusy(true);const {error:err}=await supabase.rpc("update_app",{p_app_id:id,p_name:name,p_description:description,p_category:category,p_icon_url:null});if(err)setError(appError(err.message));else{setNotice("تم حفظ التعديلات.");setEditing(false);await load();}setBusy(false);}
  async function archive(){if(!supabase||!id||!window.confirm("هل تريد أرشفة هذا التطبيق؟ يمكنك استعادته لاحقاً."))return;setBusy(true);const {error:err}=await supabase.rpc("archive_app",{p_app_id:id});if(err)setError(appError(err.message));else{setNotice("تمت أرشفة التطبيق.");await load();}setBusy(false);}
  async function restore(){if(!supabase||!id)return;setBusy(true);const {error:err}=await supabase.rpc("restore_app",{p_app_id:id});if(err)setError(appError(err.message));else{setNotice("تمت استعادة التطبيق.");await load();}setBusy(false);}
  if(loading)return <div className="loading-screen">جارٍ تحميل التطبيق...</div>;
  if(!app)return <main className="dashboard-shell container"><p className="notice notice-error">{error||"التطبيق غير موجود."}</p><Link to="/apps">العودة إلى تطبيقاتي</Link></main>;
  return <main className="dashboard-shell"><header className="site-header container"><Brand/><Link to="/apps">← تطبيقاتي</Link></header><section className="dashboard-welcome container"><div className="detail-heading">{app.icon_url?<img src={app.icon_url} alt="" className="detail-icon"/>:<span className="detail-icon app-tile-placeholder">▣</span>}<div><span className="eyebrow">تفاصيل التطبيق</span><h1>{app.name}</h1><p dir="ltr">{app.package_name}</p></div></div>{notice&&<div className="notice notice-success">{notice}</div>}{error&&<div className="notice notice-error">{error}</div>}<div className="detail-actions">{app.status==="archived"?<button className="button button-primary" onClick={restore} disabled={busy}>استعادة التطبيق</button>:<><button className="button button-outline" onClick={()=>setEditing(!editing)}>تحرير البيانات</button><button className="button button-quiet" onClick={archive} disabled={busy}>أرشفة</button></>}</div>
    {editing&&<form className="dashboard-card auth-form detail-edit" onSubmit={save}><label>اسم التطبيق<input required minLength={3} maxLength={50} value={name} onChange={e=>setName(e.target.value)}/></label><label>الوصف<input required minLength={20} maxLength={500} value={description} onChange={e=>setDescription(e.target.value)}/></label><label>الفئة<select value={category} onChange={e=>setCategory(e.target.value)}>{APP_CATEGORIES.map(c=><option value={c.value} key={c.value}>{c.label}</option>)}</select></label><div className="modal-actions"><button type="button" className="button button-quiet" onClick={()=>setEditing(false)}>إلغاء</button><button className="button button-primary" disabled={busy}>حفظ</button></div></form>}
    <div className="detail-grid"><article className="dashboard-card"><span className="eyebrow">نظرة عامة</span><h2>معلومات التطبيق</h2><p>{app.description}</p><div className="detail-meta"><span>الفئة</span><strong>{APP_CATEGORIES.find(c=>c.value===app.category)?.label??"أخرى"}</strong><span>الحالة</span><strong>{app.status==="archived"?"مؤرشف":app.status==="published"?"منشور":app.status==="paused"?"متوقف":"مسودة"}</strong><span>تاريخ الإضافة</span><strong>{new Date(app.created_at).toLocaleDateString("ar-DZ")}</strong></div></article><article className="dashboard-card"><span className="eyebrow">قريباً</span><h2>دورات الاختبار</h2><p>إدارة دورات الاختبار والمختبرين ستتوفر عند تنفيذ Week 5.</p><div className="placeholder-panel">لا توجد دورات اختبار مرتبطة حالياً.</div><h2>المراجعات</h2><p>المراجعات الداخلية وتقارير الجودة ستتوفر بعد اكتمال محرك الاختبار.</p></article></div>
  </section></main>;
}

export default function App() {
  return <Routes><Route path="/" element={<LandingPage />} /><Route path="/auth" element={<AuthPage />} /><Route path="/auth/callback" element={<AuthCallbackPage />} /><Route path="/verify-email" element={<VerifyEmailPage />} /><Route path="/forgot-password" element={<ForgotPasswordPage />} /><Route path="/reset-password" element={<ResetPasswordPage />} /><Route path="/onboarding" element={<OnboardingPage />} /><Route path="/profile" element={<ProfilePage />} /><Route path="/dashboard" element={<DashboardPage />} /><Route path="/apps" element={<AppsPage />} /><Route path="/apps/:id" element={<AppDetailPage />} /><Route path="*" element={<Navigate to="/" replace />} /></Routes>;
}