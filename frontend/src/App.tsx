import { useEffect, useState } from "react";
import { Link, Navigate, Route, Routes, useNavigate } from "react-router-dom";
import type { Session } from "@supabase/supabase-js";
import { isSupabaseConfigured, supabase } from "./lib/supabase";

function Brand() {
  return <Link className="brand" to="/" aria-label="TestDZ الصفحة الرئيسية"><span className="brand-mark">T</span><span>Test<span className="brand-accent">DZ</span></span></Link>;
}

function LandingPage() {
  return (
    <main>
      <header className="site-header container">
        <Brand />
        <nav className="header-actions" aria-label="التنقل الرئيسي">
          <a href="#how-it-works">كيف تعمل المنصة</a>
          <a href="#principles">مبادئنا</a>
          <Link className="button button-quiet" to="/auth">تسجيل الدخول</Link>
          <Link className="button button-primary" to="/auth?mode=signup">ابدأ الآن <span aria-hidden="true">↗</span></Link>
        </nav>
      </header>

      <section className="hero container">
        <div className="hero-copy">
          <div className="eyebrow"><span className="status-dot" /> منصة اختبار Android للمطورين في الجزائر</div>
          <h1>اختبر تطبيقك<br /><span>بثقة أكبر.</span></h1>
          <p className="hero-lead">نظّم اختبارات تطبيقك، تعاون مع مختبرين حقيقيين، واجمع ملاحظات واضحة تساعدك على تحسين تجربتك قبل الإطلاق.</p>
          <div className="hero-actions">
            <Link className="button button-primary button-large" to="/auth?mode=signup">أنشئ حسابك مجاناً <span aria-hidden="true">←</span></Link>
            <a className="button button-outline button-large" href="#how-it-works">اكتشف كيف تعمل</a>
          </div>
          <p className="hero-note">لا نبيعك وعوداً بعدد مختبرين مضمون. نبني عملية اختبار منظمة وشفافة.</p>
        </div>
        <div className="hero-visual" aria-label="تصميم توضيحي لعملية الاختبار">
          <div className="visual-glow" />
          <div className="orbit orbit-one" />
          <div className="orbit orbit-two" />
          <div className="test-card">
            <div className="card-topline"><span className="mini-label">TEST CYCLE</span><span className="live-pill"><i /> منظّم</span></div>
            <div className="app-symbol">A</div>
            <h3>تطبيقك القادم</h3>
            <p>مجموعة اختبار مغلقة</p>
            <div className="progress-label"><span>تقدّم الاختبار</span><strong>قيد الإعداد</strong></div>
            <div className="progress-track"><span /></div>
            <div className="tester-row"><div className="avatar-stack"><i>م</i><i>س</i><i>ي</i><i>+</i></div><span>مختبرون وملاحظات في مكان واحد</span></div>
          </div>
          <div className="floating-chip chip-top"><span>✓</span> تقارير مفيدة</div>
          <div className="floating-chip chip-bottom"><span>14</span> يوماً من المتابعة اليومية*</div>
          <p className="visual-disclaimer">*مدة برنامج TestDZ المقترحة؛ لا تمثل إثباتاً مستقلاً لمتطلبات Google Play.</p>
        </div>
      </section>

      <section className="trust-strip">
        <div className="container trust-inner"><span>مبني للمطورين الجزائريين</span><b /> <span>متابعة يومية</span><b /> <span>ملاحظات قابلة للتنفيذ</span><b /> <span>شفافية في التقدم</span></div>
      </section>

      <section className="section container" id="how-it-works">
        <div className="section-heading"><span className="eyebrow">طريقة العمل</span><h2>من أول اختبار إلى<br /><span>قرار إطلاق أوضح.</span></h2><p>كل خطوة موثقة، وكل طرف يعرف ما المطلوب منه.</p></div>
        <div className="steps-grid">
          <article className="step-card"><span className="step-number">01</span><div className="step-icon">↗</div><h3>أضف تطبيقك</h3><p>أنشئ صفحة لتطبيق Android وحدد دورة الاختبار ومتطلباتها.</p></article>
          <article className="step-card"><span className="step-number">02</span><div className="step-icon">◎</div><h3>نظّم مجموعة الاختبار</h3><p>تعاون ضمن Cohort مع مطورين ومختبرين وفق قواعد واضحة.</p></article>
          <article className="step-card"><span className="step-number">03</span><div className="step-icon">✓</div><h3>تابع واجمع الملاحظات</h3><p>سجّل التقدم اليومي واستلم تقارير تساعدك على تحسين التطبيق.</p></article>
        </div>
      </section>

      <section className="principles-section" id="principles"><div className="container principles-inner"><div><span className="eyebrow">الثقة قبل الأرقام</span><h2>اختبار حقيقي.<br /><span>بدون وعود مضللة.</span></h2></div><p>TestDZ تنظّم التعاون والمتابعة، لكنها لا تدّعي أنها تتحكم في قرارات Google Play أو تثبت وحدها استمرار الاشتراك في الاختبار المغلق. نعرض ما تم إنجازه بوضوح، ونفصل بين Check-ins داخل المنصة وإثباتات Google Play.</p></div></section>

      <footer className="site-footer container"><Brand /><span>© 2026 TestDZ. منصة قيد التطوير.</span><Link to="/auth">الدخول إلى المنصة</Link></footer>
    </main>
  );
}

function AuthPage() {
  const navigate = useNavigate();
  const params = new URLSearchParams(window.location.search);
  const [mode, setMode] = useState<"signin" | "signup">(params.get("mode") === "signup" ? "signup" : "signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage("");
    setError("");
    if (!supabase) {
      setError("الاتصال بقاعدة البيانات غير مضبوط بعد. أضف متغيرات Supabase في ملف البيئة.");
      return;
    }
    setBusy(true);
    try {
      if (mode === "signup") {
        const { data, error: authError } = await supabase.auth.signUp({
          email: email.trim(),
          password,
          options: { data: { full_name: fullName.trim() }, emailRedirectTo: window.location.origin + "/auth" },
        });
        if (authError) throw authError;
        if (data.session) navigate("/dashboard");
        else setMessage("تم إنشاء الطلب. تحقق من بريدك الإلكتروني لتأكيد الحساب قبل تسجيل الدخول.");
      } else {
        const { error: authError } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
        if (authError) throw authError;
        navigate("/dashboard");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "حدث خطأ غير متوقع. حاول مرة أخرى.");
    } finally {
      setBusy(false);
    }
  }

  return <main className="auth-layout"><div className="auth-side"><Brand /><div className="auth-side-copy"><span className="eyebrow">TESTDZ PLATFORM</span><h1>مساحة واحدة<br /><span>لاختبار أفضل.</span></h1><p>تابع مهامك، شارك ملاحظاتك، وساعد تطبيقات Android على التحسن.</p></div><span className="auth-side-foot">TestDZ · Algeria first</span></div><section className="auth-panel"><div className="auth-panel-top"><Link to="/">العودة للرئيسية</Link></div><div className="auth-form-wrap"><span className="eyebrow">{mode === "signup" ? "انضم إلى TestDZ" : "مرحباً بعودتك"}</span><h2>{mode === "signup" ? "أنشئ حسابك" : "تسجيل الدخول"}</h2><p className="form-intro">{mode === "signup" ? "ابدأ رحلتك في اختبار التطبيقات والتعاون." : "أدخل بياناتك للمتابعة إلى حسابك."}</p>
      {!isSupabaseConfigured && <div className="notice notice-warning">الواجهة جاهزة، لكن يلزم ضبط متغيرات Supabase في ملف <code>.env</code> لتفعيل المصادقة.</div>}
      {message && <div className="notice notice-success" role="status">{message}</div>}
      {error && <div className="notice notice-error" role="alert">{error}</div>}
      <form onSubmit={submit} className="auth-form">
        {mode === "signup" && <label>الاسم الكامل<input autoComplete="name" value={fullName} onChange={e => setFullName(e.target.value)} required minLength={2} placeholder="كيف نناديك؟" /></label>}
        <label>البريد الإلكتروني<input type="email" autoComplete="email" value={email} onChange={e => setEmail(e.target.value)} required placeholder="name@example.com" dir="ltr" /></label>
        <label>كلمة المرور<input type="password" autoComplete={mode === "signup" ? "new-password" : "current-password"} value={password} onChange={e => setPassword(e.target.value)} required minLength={8} placeholder="8 أحرف على الأقل" dir="ltr" /></label>
        <button className="button button-primary button-large submit-button" type="submit" disabled={busy}>{busy ? "جارٍ المعالجة..." : mode === "signup" ? "إنشاء الحساب" : "دخول"}</button>
      </form>
      <p className="switch-auth">{mode === "signup" ? "لديك حساب بالفعل؟" : "ليس لديك حساب؟"} <button type="button" onClick={() => { setMode(mode === "signup" ? "signin" : "signup"); setError(""); setMessage(""); }}>{mode === "signup" ? "سجّل الدخول" : "أنشئ حساباً"}</button></p>
      <p className="legal-note">بالمتابعة، أنت توافق على استخدام TestDZ وفق شروط المنصة وسياسة الخصوصية عند نشرهما.</p>
    </div></section></main>;
}

function DashboardPage() {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    if (!supabase) { setLoading(false); return; }
    supabase.auth.getSession().then(({ data }) => { setSession(data.session); setLoading(false); });
    const { data } = supabase.auth.onAuthStateChange((_event, nextSession) => setSession(nextSession));
    return () => data.subscription.unsubscribe();
  }, []);
  if (loading) return <div className="loading-screen">جارٍ تحميل حسابك...</div>;
  if (!session) return <Navigate to="/auth" replace />;
  return <main className="dashboard-shell"><header className="site-header container"><Brand /><button className="button button-quiet" onClick={async () => { await supabase?.auth.signOut(); }}>تسجيل الخروج</button></header><section className="dashboard-welcome container"><span className="eyebrow">مساحة العمل</span><h1>مرحباً بك في <span>TestDZ</span></h1><p>تم تسجيل الدخول بنجاح. نبني الآن لوحة مهام المختبر والمطور.</p><div className="dashboard-card"><strong>{session.user.email}</strong><span>حساب موثّق بواسطة Supabase Auth</span></div><p className="dashboard-note">هذه نسخة تأسيسية؛ لم نعرض بيانات وهمية أو مهام تجريبية.</p></section></main>;
}

export default function App() {
  return <Routes><Route path="/" element={<LandingPage />} /><Route path="/auth" element={<AuthPage />} /><Route path="/dashboard" element={<DashboardPage />} /><Route path="*" element={<Navigate to="/" replace />} /></Routes>;
}