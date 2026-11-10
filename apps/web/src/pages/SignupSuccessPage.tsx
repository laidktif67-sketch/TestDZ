import { useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";

type Language = "en" | "ar" | "fr";

function Icon({ name, size = 22 }: { name: "flask" | "mail" | "home" | "refresh" | "check" | "sparkles" | "shield"; size?: number }) {
  const common = { width: size, height: size, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 1.8, strokeLinecap: "round" as const, strokeLinejoin: "round" as const, "aria-hidden": true as const };
  switch (name) {
    case "flask": return <svg {...common}><path d="M9 3h6M10 3v6.2L4.8 18a2 2 0 0 0 1.7 3h11a2 2 0 0 0 1.7-3L14 9.2V3"/><path d="M7.5 16h9M9 13.5h.01M14.5 18h.01"/></svg>;
    case "mail": return <svg {...common}><rect x="3" y="5" width="18" height="14" rx="2.5"/><path d="m4 7 8 6 8-6"/></svg>;
    case "home": return <svg {...common}><path d="m3 10 9-7 9 7"/><path d="M5.5 9v11h13V9M9.5 20v-6h5v6"/></svg>;
    case "refresh": return <svg {...common}><path d="M20 7v5h-5M4 17v-5h5"/><path d="M5.6 9A7 7 0 0 1 18 6l2 6M4 12l2 6a7 7 0 0 0 12.4-3"/></svg>;
    case "check": return <svg {...common}><path d="m5 12 4.2 4.2L19 6.5"/></svg>;
    case "sparkles": return <svg {...common}><path d="m12 3 1.7 5.3L19 10l-5.3 1.7L12 17l-1.7-5.3L5 10l5.3-1.7L12 3Z"/><path d="m19 15 .9 2.1L22 18l-2.1.9L19 21l-.9-2.1L16 18l2.1-.9L19 15Z"/></svg>;
    case "shield": return <svg {...common}><path d="M12 3 20 6v5c0 5-3.4 8.4-8 10-4.6-1.6-8-5-8-10V6l8-3Z"/><path d="m8.5 12 2.2 2.2 4.8-5"/></svg>;
  }
}

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
  function openMailbox() {
    const domain = email.split("@")[1]?.toLowerCase();
    const mailbox = domain === "gmail.com" ? "https://mail.google.com/" :
      domain === "outlook.com" || domain === "hotmail.com" || domain === "live.com" ? "https://outlook.live.com/mail/" :
      domain === "yahoo.com" ? "https://mail.yahoo.com/" : "mailto:" + encodeURIComponent(email);
    window.open(mailbox, "_blank", "noopener,noreferrer");
  }

  return (
    <main className="signup-success-page" dir={isRtl ? "rtl" : "ltr"} lang={language}>
      <header className="signup-success-header">
        <Link to="/" className="signup-success-brand" aria-label="TestDZ home">
          <span className="signup-success-flask"><Icon name="flask" size={34} /></span>
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
            <span className="signup-success-check"><Icon name="check" size={43} /></span>
          </div>
          <span className="signup-success-spark spark-one"><Icon name="sparkles" size={32} /></span>
          <span className="signup-success-spark spark-two">✦</span>
          <p className="signup-success-tagline">Test. Learn. Grow.</p>
        </section>

        <section className="signup-success-card" aria-labelledby="signup-success-title">
          <div className="signup-success-icon" aria-hidden="true">
            <svg viewBox="0 0 64 64" fill="none"><circle cx="32" cy="32" r="29" fill="#E3F8F0"/><path d="m17 32 10 10 21-23" stroke="#10B981" strokeWidth="7" strokeLinecap="round" strokeLinejoin="round"/></svg>
          </div>
          <span className="signup-success-eyebrow">TESTDZ ACCOUNT</span>
          <h1 id="signup-success-title">{t.title} <span className="signup-success-celebration" aria-hidden="true">🎉</span></h1>
          <p className="signup-success-intro">{t.intro}</p>
          <div className="signup-success-email">
            <span className="signup-success-mail-icon"><Icon name="mail" size={27} /></span>
            <span><small>{t.sent}</small><strong>{email}</strong></span>
          </div>
          <p className="signup-success-note">{t.note}</p>
          {resent && <p className="signup-success-feedback" role="status">{t.resent}</p>}
          <div className="signup-success-actions">
            <button type="button" className="signup-success-primary" onClick={openMailbox}><Icon name="mail" size={19} /> <span>{t.open}</span></button>
            <button type="button" className="signup-success-secondary" onClick={() => navigate("/")}><Icon name="home" size={19} /> <span>{t.home}</span></button>
          </div>
          <button type="button" className="signup-success-resend" onClick={() => setResent(true)}><Icon name="refresh" size={16} /> {t.resend}</button>
          <p className="signup-success-demo"><Icon name="shield" size={13} /> Mock Data preview · No email is sent in this demo.</p>
        </section>
      </div>

      <footer className="signup-success-footer">
        <Link to="/" className="signup-success-footer-brand"><span className="signup-success-flask"><Icon name="flask" size={25} /></span><strong>TestDZ</strong></Link>
        <span>{t.foot}</span>
        <nav aria-label="Footer"><Link to="/">Home</Link><Link to="/auth">Login</Link></nav>
        <small>© 2026 TestDZ. All rights reserved.</small>
      </footer>
    </main>
  );
}
