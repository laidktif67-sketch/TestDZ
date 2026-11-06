import { useEffect, useState } from "react";
import type { FormEvent } from "react";
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
    if (!supabase) { setLoading(false); return; }
    supabase.auth.getSession().then(async ({ data }) => { setSession(data.session); if (data.session) { const { data: roleRows } = await supabase.from("user_roles").select("role").eq("user_id", data.session.user.id); setRoles((roleRows ?? []).map((row: { role: string }) => row.role)); } setLoading(false); });
    const { data } = supabase.auth.onAuthStateChange(async (_event, nextSession) => { setSession(nextSession); if (nextSession) { const { data: roleRows } = await supabase.from("user_roles").select("role").eq("user_id", nextSession.user.id); setRoles((roleRows ?? []).map((row: { role: string }) => row.role)); } else setRoles([]); });
    return () => data.subscription.unsubscribe();
  }, []);
  if (loading) return <div className="loading-screen">جارٍ تحميل حسابك...</div>;
  if (!session) return <Navigate to="/auth" replace />;
  return <main className="dashboard-shell"><header className="site-header container"><Brand /><button className="button button-quiet" onClick={async () => { await supabase?.auth.signOut(); }}>تسجيل الخروج</button></header><section className="dashboard-welcome container"><span className="eyebrow">مساحة العمل</span><h1>مرحباً بك في <span>TestDZ</span></h1><p>تم تسجيل الدخول بنجاح. نبني الآن لوحة مهام المختبر والمطور.</p><div className="dashboard-card"><strong>{session.user.email}</strong><span>الأدوار: {roles.length ? roles.join(" · ") : "غير محدد"}</span><span>حالة البريد: {session.user.email_confirmed_at ? "مؤكد" : "بانتظار التأكيد"}</span><Link to="/profile">إدارة الملف الشخصي ←</Link>{roles.includes("developer") && <span>مساحة المطور — نشر التطبيقات ستكون متاحة بعد اكتمال Week 3.</span>}{roles.includes("tester") && <span>مساحة المختبر — اكتشاف الاختبارات ستكون متاحة بعد اكتمال محرك الاختبارات.</span>}</div><p className="dashboard-note">هذه نسخة تأسيسية؛ لم نعرض بيانات وهمية أو مهام تجريبية.</p></section></main>;
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
  const [userId,setUserId]=useState("");const [displayName,setDisplayName]=useState("");const [phone,setPhone]=useState("");const [bio,setBio]=useState("");const [avatarUrl,setAvatarUrl]=useState("");const [verified,setVerified]=useState(false);const [busy,setBusy]=useState(false);const [message,setMessage]=useState("");const [error,setError]=useState("");
  useEffect(()=>{const client=supabase;if(!client)return;client.auth.getUser().then(async({data,error:authError})=>{if(authError||!data.user)return;setUserId(data.user.id);const {data:profile,error:profileError}=await client.from("profiles").select("display_name,phone,bio,avatar_url,is_verified").eq("id",data.user.id).single();if(profileError){setError("تعذر تحميل الملف الشخصي.");return;}setDisplayName(profile.display_name??"");setPhone(profile.phone??"");setBio(profile.bio??"");setAvatarUrl(profile.avatar_url??"");setVerified(Boolean(profile.is_verified));});},[]);
  async function save(e:FormEvent<HTMLFormElement>){e.preventDefault();if(!supabase)return;setBusy(true);setMessage("");setError("");const {error:err}=await supabase.from("profiles").update({display_name:displayName.trim(),phone:phone.trim()||null,bio:bio.trim()||null}).eq("id",userId);if(err)setError("تعذر حفظ الملف الشخصي. تحقق من البيانات وحاول مجدداً.");else setMessage("تم حفظ الملف الشخصي.");setBusy(false);}
  async function upload(file?:File){if(!file||!supabase)return;setError("");setMessage("");if(file.size>2*1024*1024){setError("حجم الصورة يجب ألا يتجاوز 2 ميغابايت.");return;}if(!["image/jpeg","image/png","image/webp"].includes(file.type)){setError("الصيغ المدعومة: JPG وPNG وWebP.");return;}const ext=file.type==="image/png"?"png":file.type==="image/webp"?"webp":"jpg";setBusy(true);const path=userId+"/avatar."+ext;const {error:uploadError}=await supabase.storage.from("avatars").upload(path,file,{upsert:true,contentType:file.type,cacheControl:"3600"});if(uploadError){setError("تعذر رفع الصورة. حاول مرة أخرى.");setBusy(false);return;}const {data}=supabase.storage.from("avatars").getPublicUrl(path);const url=data.publicUrl+"?v="+Date.now();const {error:updateError}=await supabase.from("profiles").update({avatar_url:url}).eq("id",userId);if(updateError)setError("تم رفع الصورة لكن تعذر حفظ رابطها في الملف الشخصي.");else{setAvatarUrl(url);setMessage("تم تحديث الصورة.");}setBusy(false);}
  return <main className="dashboard-shell"><header className="site-header container"><Brand /><Link to="/dashboard">لوحة التحكم</Link></header><section className="dashboard-welcome container"><span className="eyebrow">إعدادات الحساب</span><h1>ملفي الشخصي</h1><div className="dashboard-card profile-card"><div className="profile-avatar">{avatarUrl?<img src={avatarUrl} alt="الصورة الشخصية"/>:<span>{displayName.slice(0,1)||"T"}</span>}</div><label className="button button-outline">تغيير الصورة<input type="file" accept="image/jpeg,image/png,image/webp" hidden onChange={e=>upload(e.target.files?.[0])}/></label><small>حتى 2MB · JPG, PNG, WebP</small></div><form className="auth-form profile-form" onSubmit={save}><label>الاسم الكامل<input required minLength={2} value={displayName} onChange={e=>setDisplayName(e.target.value)}/></label><label>رقم الهاتف (اختياري)<input type="tel" value={phone} onChange={e=>setPhone(e.target.value)} dir="ltr"/></label><label>نبذة قصيرة<textarea rows={4} maxLength={300} value={bio} onChange={e=>setBio(e.target.value)}/></label><div className="verification-line">حالة البريد: <strong>{verified?"مؤكد":"بانتظار التأكيد"}</strong></div>{message&&<div className="notice notice-success">{message}</div>}{error&&<div className="notice notice-error">{error}</div>}<button className="button button-primary button-large" disabled={busy}>{busy?"جارٍ الحفظ...":"حفظ التغييرات"}</button></form><p className="dashboard-note">الأدوار وحالة التحقق والخطة لا يمكن تعديلها من هذه الصفحة.</p></section></main>;
}

export default function App() {
  return <Routes><Route path="/" element={<LandingPage />} /><Route path="/auth" element={<AuthPage />} /><Route path="/auth/callback" element={<AuthCallbackPage />} /><Route path="/verify-email" element={<VerifyEmailPage />} /><Route path="/forgot-password" element={<ForgotPasswordPage />} /><Route path="/reset-password" element={<ResetPasswordPage />} /><Route path="/onboarding" element={<OnboardingPage />} /><Route path="/profile" element={<ProfilePage />} /><Route path="/dashboard" element={<DashboardPage />} /><Route path="*" element={<Navigate to="/" replace />} /></Routes>;
}