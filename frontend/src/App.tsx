import { useEffect, useState } from "react";
import type { FormEvent } from "react";
import { Link, Navigate, Route, Routes, useNavigate, useParams } from "react-router-dom";
import imageCompression from "browser-image-compression";
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
  const [remember, setRemember] = useState(true);
  const [showPassword, setShowPassword] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setMessage(""); setError("");
    if (!supabase) { setError("الاتصال بقاعدة البيانات غير مضبوط بعد. أضف متغيرات Supabase في ملف البيئة."); return; }
    if (mode === "signup" && (!/[A-Za-z]/.test(password) || !/[0-9]/.test(password))) { setError("كلمة المرور يجب أن تحتوي على حرف ورقم، وبحد أدنى 8 أحرف."); return; }
    setBusy(true);
    try {
      if (mode === "signup") {
        const { data, error: authError } = await supabase.auth.signUp({
          email: email.trim(), password,
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
    } finally { setBusy(false); }
  }

  async function socialLogin(provider: "google" | "github" | "azure") {
    setError(""); setMessage("");
    if (!supabase) { setError("الاتصال بقاعدة البيانات غير مضبوط بعد."); return; }
    setBusy(true);
    const { error: authError } = await supabase.auth.signInWithOAuth({
      provider,
      options: { redirectTo: window.location.origin + "/auth/callback" },
    });
    if (authError) { setError(translateAuthError(authError.message)); setBusy(false); }
  }

  return <main className="auth-reference-page">
    <aside className="auth-showcase">
      <Link className="testdz-logo" to="/" aria-label="TestDZ الرئيسية"><span className="testdz-flask">⚗</span><span><strong>TestDZ</strong><small>Test · Learn · Grow</small></span></Link>
      <div className="showcase-copy">
        <span className="showcase-kicker">منصة الاختبار للمطورين</span>
        <h1>اختبر بذكاء.<br/><span>وانمُ بثقة.</span></h1>
        <p>منصة تجمع المطورين والمختبرين لتجربة تطبيقات Android وجمع ملاحظات مفيدة قبل الإطلاق.</p>
        <ul className="showcase-benefits">
          <li><span>ϟ</span><div><strong>اختبر واكسب النقاط</strong><small>شارك في دورات اختبار منظمة</small></div></li>
          <li><span>✧</span><div><strong>اكتشف فرصاً جديدة</strong><small>تعاون مع مطورين ومختبرين</small></div></li>
          <li><span>▥</span><div><strong>طوّر مهاراتك</strong><small>حوّل الملاحظات إلى تحسينات</small></div></li>
        </ul>
      </div>
      <div className="auth-illustration" aria-hidden="true">
        <div className="illustration-orbit orbit-a"></div><div className="illustration-orbit orbit-b"></div>
        <div className="rocket-bubble">🚀</div><div className="code-bubble">&lt;/&gt;</div>
        <div className="laptop-visual"><div className="laptop-screen"><div className="laptop-sidebar"><b>TestDZ</b><i>▦ Dashboard</i><i>✓ My Tests</i><i>◎ Discover</i><i>☆ Rewards</i></div><div className="laptop-content"><small>TEST OVERVIEW</small><strong>Testing progress</strong><div className="metric-row"><b>75%<small>Success rate</small></b><b>14<small>Days tracked</small></b></div><div className="chart-bars"><i/><i/><i/><i/><i/><i/><i/></div></div></div><div className="laptop-base"></div></div>
        <div className="points-float"><span>★</span><strong>450</strong><small>Points</small></div>
      </div>
      <div className="showcase-stats"><div className="stat-avatars"><i>م</i><i>س</i><i>ي</i></div><div><strong>مجتمع المطورين</strong><small>اختبار تعاوني وشفاف</small></div><span className="stat-divider"></span><span className="stat-star">★</span><div><strong>الجودة أولاً</strong><small>ملاحظات قابلة للتنفيذ</small></div></div>
      <span className="showcase-footnote">TestDZ · صُممت للمطورين الجزائريين</span>
    </aside>
    <section className="auth-reference-main">
      <div className="auth-language"><span>◎</span><select aria-label="اللغة" defaultValue="ar"><option value="ar">العربية</option><option value="en">English</option><option value="fr">Français</option></select></div>
      <div className="auth-reference-card">
        <div className="auth-tabs" role="tablist" aria-label="المصادقة">
          <button type="button" role="tab" aria-selected={mode === "signin"} className={mode === "signin" ? "active" : ""} onClick={() => {setMode("signin");setError("");setMessage("");}}>♟ <span>تسجيل الدخول</span></button>
          <button type="button" role="tab" aria-selected={mode === "signup"} className={mode === "signup" ? "active" : ""} onClick={() => {setMode("signup");setError("");setMessage("");}}>♧ <span>إنشاء حساب</span></button>
        </div>
        <div className="auth-reference-heading"><h2>{mode === "signup" ? "مرحباً بك في TestDZ!" : "مرحباً بعودتك!"}</h2><p>{mode === "signup" ? "أنشئ حسابك وابدأ رحلتك معنا" : "سجّل الدخول إلى حساب TestDZ الخاص بك"}</p></div>
        {!isSupabaseConfigured && <div className="notice notice-warning">يلزم ضبط متغيرات Supabase في ملف <code>.env</code> لتفعيل المصادقة.</div>}
        {message && <div className="notice notice-success" role="status">{message}</div>}
        {error && <div className="notice notice-error" role="alert">{error}</div>}
        <form onSubmit={submit} className="auth-reference-form">
          {mode === "signup" && <><label className="auth-input-wrap"><span aria-hidden="true">♙</span><input autoComplete="name" value={fullName} onChange={e=>setFullName(e.target.value)} required minLength={2} placeholder="الاسم الكامل" /></label><label className="auth-input-wrap"><span aria-hidden="true">⌕</span><input type="tel" autoComplete="tel" value={phone} onChange={e=>setPhone(e.target.value)} placeholder="رقم الهاتف (اختياري)" dir="ltr" /></label></>}
          <label className="auth-input-wrap"><span aria-hidden="true">✉</span><input type="email" autoComplete="email" value={email} onChange={e=>setEmail(e.target.value)} required placeholder="البريد الإلكتروني" dir="ltr" /></label>
          <label className="auth-input-wrap"><span aria-hidden="true">♙</span><input type={showPassword ? "text" : "password"} autoComplete={mode === "signup" ? "new-password" : "current-password"} value={password} onChange={e=>setPassword(e.target.value)} required minLength={8} placeholder="كلمة المرور" dir="ltr" /><button className="password-toggle" type="button" aria-label={showPassword ? "إخفاء كلمة المرور" : "إظهار كلمة المرور"} onClick={()=>setShowPassword(v=>!v)}>{showPassword ? "◉" : "◎"}</button></label>
          {mode === "signin" && <div className="auth-form-options"><label className="remember-option"><input type="checkbox" checked={remember} onChange={e=>setRemember(e.target.checked)} /> تذكرني</label><Link to="/forgot-password">نسيت كلمة المرور؟</Link></div>}
          <button className="auth-reference-submit" type="submit" disabled={busy}>{busy ? "جارٍ المعالجة..." : mode === "signup" ? "إنشاء الحساب　↗" : "↪　تسجيل الدخول"}</button>
        </form>
        <div className="auth-social-divider"><span>أو تابع باستخدام</span></div>
        <div className="auth-social-buttons"><button type="button" onClick={()=>socialLogin("google")} disabled={busy}><b className="google-g">G</b> Google</button><button type="button" onClick={()=>socialLogin("github")} disabled={busy}><b>◉</b> GitHub</button><button type="button" onClick={()=>socialLogin("azure")} disabled={busy}><b className="microsoft-mark">▦</b> Microsoft</button></div>
        <p className="auth-switch-line">{mode === "signup" ? "لديك حساب بالفعل؟" : "ليس لديك حساب؟"} <button type="button" onClick={()=>{setMode(mode === "signup" ? "signin" : "signup");setError("");setMessage("");}}>{mode === "signup" ? "سجّل الدخول" : "أنشئ حساباً الآن"}</button></p>
        <p className="auth-confirm-link"><Link to="/verify-email">لم تصلك رسالة التأكيد؟</Link></p>
      </div>
      <div className="auth-security-note"><span>♙</span><div><strong>بياناتك بأمان معنا</strong><small>نستخدم مصادقة Supabase لحماية الوصول إلى حسابك.</small></div></div>
      <p className="auth-legal-note">بالمتابعة، أنت توافق على شروط المنصة وسياسة الخصوصية عند نشرهما.</p>
    </section>
  </main>;
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