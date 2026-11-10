import { useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";

type Language = "en" | "ar" | "fr";

const copy = {
  en: {
    title: "Your account has been created!",
    intro: "Welcome to TestDZ. One last step: verify your email address to activate your account.",
    sent: "Verification link sent to:",
    open: "Open your email",
    home: "Back to home",
    note: "Didn't receive the message? Check your spam folder, or request a new link in a moment.",
    resend: "Resend verification link",
    resent: "Mock demo: a new verification link request was simulated.",
    brand: "Test · Learn · Grow",
    foot: "Build. Test. Reward.",
    language: "Language",
  },
  ar: {
    title: "تم إنشاء حسابك بنجاح!",
    intro: "مرحبًا بك في TestDZ. بقيت خطوة واحدة: تحقق من بريدك الإلكتروني لتفعيل حسابك.",
    sent: "تم إرسال رابط التحقق إلى:",
    open: "فتح البريد الإلكتروني",
    home: "العودة إلى الرئيسية",
    note: "لم تصلك الرسالة؟ تحقق من مجلد الرسائل غير المرغوب فيها، أو اطلب رابطًا جديدًا بعد قليل.",
    resend: "إعادة طلب رابط التحقق",
    resent: "عرض تجريبي: تمت محاكاة طلب رابط تحقق جديد.",
    brand: "اختبر · تعلّم · تطوّر",
    foot: "أنشئ. اختبر. اكسب.",
    language: "اللغة",
  },
  fr: {
    title: "Votre compte a été créé !",
    intro: "Bienvenue sur TestDZ. Dernière étape : vérifiez votre adresse e-mail pour activer votre compte.",
    sent: "Lien de vérification envoyé à :",
    open: "Ouvrir votre messagerie",
    home: "Retour à l’accueil",
    note: "Vous n’avez rien reçu ? Vérifiez les courriers indésirables ou demandez un nouveau lien dans un instant.",
    resend: "Renvoyer le lien de vérification",
    resent: "Démo simulée : une nouvelle demande de lien a été effectuée.",
    brand: "Tester · Apprendre · Progresser",
    foot: "Créer. Tester. Récompenser.",
    language: "Langue",
  },
};

export default function SignupSuccessPage() {
  const navigate = useNavigate();
  const [language, setLanguage] = useState<Language>("en");
  const [resent, setResent] = useState(false);
  const email = useMemo(() => new URLSearchParams(window.location.search).get("email")?.trim() || "your email address", []);
  const t = copy[language];
  const isRtl = language === "ar";

  return (
    <main className="signup-success-page" dir={isRtl ? "rtl" : "ltr"} lang={language}>
      <header className="signup-success-header">
        <Link to="/" className="signup-success-brand" aria-label="TestDZ home">
          <span className="signup-success-flask" aria-hidden="true">⚗</span>
          <span><strong>TestDZ</strong><small>Test · Learn · Grow</small></span>
        </Link>
        <label className="signup-success-language">
          <span>{t.language}</span>
          <select aria-label={t.language} value={language} onChange={e => { setLanguage(e.target.value as Language); setResent(false); }}>
            <option value="en">English</option>
            <option value="ar">العربية</option>
            <option value="fr">Français</option>
          </select>
        </label>
      </header>

      <div className="signup-success-layout">
        <section className="signup-success-art" aria-label="TestDZ email verification illustration">
          <div className="signup-success-orbit signup-success-orbit-one" />
          <div className="signup-success-orbit signup-success-orbit-two" />
          <div className="signup-success-envelope">
            <div className="signup-success-letter"><span>✓</span></div>
            <div className="signup-success-flap" />
            <span className="signup-success-check">✓</span>
          </div>
          <span className="signup-success-spark spark-one">✦</span>
          <span className="signup-success-spark spark-two">✧</span>
          <p className="signup-success-tagline">Test. Learn. Grow.</p>
        </section>

        <section className="signup-success-card" aria-labelledby="signup-success-title">
          <div className="signup-success-icon" aria-hidden="true">
            <svg viewBox="0 0 64 64" fill="none"><circle cx="32" cy="32" r="29" fill="#E3F8F0"/><path d="m17 32 10 10 21-23" stroke="#10B981" strokeWidth="7" strokeLinecap="round" strokeLinejoin="round"/></svg>
          </div>
          <span className="signup-success-eyebrow">TESTDZ ACCOUNT</span>
          <h1 id="signup-success-title">{t.title} 🎉</h1>
          <p className="signup-success-intro">{t.intro}</p>
          <div className="signup-success-email">
            <span className="signup-success-mail-icon" aria-hidden="true">✉</span>
            <span><small>{t.sent}</small><strong>{email}</strong></span>
          </div>
          <p className="signup-success-note">{t.note}</p>
          {resent && <p className="signup-success-feedback" role="status">{t.resent}</p>}
          <div className="signup-success-actions">
            <button type="button" className="signup-success-primary" onClick={() => { setResent(true); }}>↻ <span>{t.resend}</span></button>
            <button type="button" className="signup-success-secondary" onClick={() => navigate("/")}>⌂ <span>{t.home}</span></button>
          </div>
          <p className="signup-success-demo">Mock Data preview · No email is sent in this demo.</p>
        </section>
      </div>

      <footer className="signup-success-footer">
        <Link to="/" className="signup-success-footer-brand"><span className="signup-success-flask" aria-hidden="true">⚗</span><strong>TestDZ</strong></Link>
        <span>{t.foot}</span>
        <nav aria-label="Footer"><Link to="/">Home</Link><Link to="/auth">Login</Link></nav>
        <small>© 2026 TestDZ. All rights reserved.</small>
      </footer>
    </main>
  );
}
