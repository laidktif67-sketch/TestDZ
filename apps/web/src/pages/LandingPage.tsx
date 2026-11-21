import { lazy, Suspense, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { useLenis } from "../hooks/useLenis";
import { LpIcon } from "../shared/components/LpIcon";

const LightRays = lazy(() => import("../components/react-bits/LightRays"));
const StarBorder = lazy(() => import("../components/react-bits/StarBorder"));

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
        .from(".lp-hero-copy h2", { y: 18, opacity: 0 })
        .from(".lp-hero-copy > p:not(.lp-hero-title)", { y: 14, opacity: 0 }, "-=0.38")
        .from(".lp-hero-buttons", { y: 12, opacity: 0 }, "-=0.32")
        .from(".lp-proof", { y: 10, opacity: 0 }, "-=0.28");

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
      reveal(".lp-how .lp-section-title", ".lp-how", 0.1);
      reveal(".lp-community .lp-section-title", ".lp-community", 0.1);
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
  }, [reducedMotion]);

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
        {!reducedMotion && <div className="lp-hero-rays" aria-hidden="true"><Suspense fallback={null}><LightRays
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
        /></Suspense></div>}
        <div className="lp-hero-copy">
          <h1 className="lp-hero-semantic-title">TestDZ</h1>
          <span className="lp-hero-title" aria-hidden="true">TestDZ</span>
          <h2>{t.heroLead} <span>{t.heroAccent}</span></h2>
          <p>{t.heroBody}</p>
          <div className="lp-hero-buttons">
            <Link className="lp-cta lp-cta-star" to="/auth?mode=signup">{reducedMotion ? <span className="lp-star-border-inner lp-star-border-static">{t.getStarted} <LpIcon name="arrow" size={17}/></span> : <Suspense fallback={<span className="lp-star-border-inner lp-star-border-static">{t.getStarted} <LpIcon name="arrow" size={17}/></span>}><StarBorder as="span" className="lp-star-border-inner" theme="light" backgroundColor="transparent" textColor="#ffffff" borderColor="rgba(255,255,255,.42)" color="#ffffff" trailColor="#d8e8ff" duration={5.2} thickness={1} radius={26} trailLength={0.22} stars={1} glow={0.38} sparkle={false} hover="brighten" clickPulse={false}>{t.getStarted} <LpIcon name="arrow" size={17}/></StarBorder></Suspense>}</Link>
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
          <img className="lp-hero-image" src="/images/hero-dashboard.png" alt={t.illustration} fetchPriority="high" decoding="async" />
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
        <div className="lp-faq-illustration"><img className="lp-faq-image" src="/images/faq-assistant.png" alt={t.illustration} loading="lazy" decoding="async" /></div>
        <div className="lp-faq-copy"><h2>{t.faqTitle}</h2><p>{t.faqIntro}</p><a href="#faq-questions">{t.viewFaq} <LpIcon name="arrow" size={15}/></a></div>
        <div className="lp-faq-list" id="faq-questions"><details><summary>{t.faq1q}</summary><p>{t.faq1a}</p></details><details><summary>{t.faq2q}</summary><p>{t.faq2a}</p></details><details><summary>{t.faq3q}</summary><p>{t.faq3a}</p></details><details><summary>{t.faq4q}</summary><p>{t.faq4a}</p></details></div>
      </section>

      <footer className="lp-footer"><Link className="lp-brand" to="/"><span className="lp-flask"><LpIcon name="flask" size={29}/></span><span>TestDZ</span></Link><nav aria-label={t.home}><a href="#home">{t.home}</a><a href="#features">{t.features}</a><a href="#how-it-works">{t.how}</a><a href="#faq">{t.faqTitle}</a></nav><small>{t.copyright}</small></footer>
    </main>
  );
}



export default LandingPage;
