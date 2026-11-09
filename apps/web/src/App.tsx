import { useEffect, useRef, useState } from "react";
import type { FormEvent } from "react";
import { Link, Navigate, Route, Routes, useNavigate, useParams } from "react-router-dom";
import imageCompression from "browser-image-compression";
import type { Session } from "@supabase/supabase-js";
import type { AppLimit, AppRecord } from "@testdz/types";
import { supabase } from "./lib/supabase";
import { getPostAuthRoute, translateAuthError } from "./lib/auth-routing";
import { Brand } from "./components/Brand";
import { useLenis } from "./hooks/useLenis";
import AuthPage from "./pages/AuthPage";
import LandingPage from "./pages/LandingPage";

function DashboardPage() {
  const [session, setSession] = useState<Session | null>(null);
  const [roles, setRoles] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const roleRequest = useRef(0);
  const authEventSeen = useRef(false);

  useEffect(() => {
    const client = supabase;
    if (!client) {
      setLoading(false);
      return;
    }

    const loadRoles = async (userId: string) => {
      const requestId = ++roleRequest.current;
      const { data: roleRows } = await client
        .from("user_roles")
        .select("role")
        .eq("user_id", userId);
      if (requestId === roleRequest.current) {
        setRoles((roleRows ?? []).map((row: { role: string }) => row.role));
      }
    };

    client.auth.getSession().then(({ data }) => {
      if (!authEventSeen.current) {
        setSession(data.session);
        if (data.session) {
          void loadRoles(data.session.user.id);
        } else {
          roleRequest.current += 1;
          setRoles([]);
        }
      }
      setLoading(false);
    });

    const { data } = client.auth.onAuthStateChange((_event, nextSession) => {
      authEventSeen.current = true;
      setSession(nextSession);
      if (nextSession) {
        // Supabase advises against awaiting another Supabase request inside this callback.
        window.setTimeout(() => {
          void loadRoles(nextSession.user.id);
        }, 0);
      } else {
        roleRequest.current += 1;
        setRoles([]);
      }
      setLoading(false);
    });

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
    supabase.auth.getSession().then(async ({ data, error }) => {
      if (error) {
        setMessage("تعذر إكمال المصادقة. اطلب رابطاً جديداً.");
        return;
      }
      if (!data.session) {
        setMessage("الرابط غير صالح أو انتهت صلاحيته. ارجع لصفحة الدخول واطلب رابطاً جديداً.");
        return;
      }
      try {
        navigate(await getPostAuthRoute(data.session.user.id), { replace: true });
      } catch {
        setMessage("تم تسجيل الدخول، لكن تعذر التحقق من إعداد الحساب. حدّث الصفحة أو حاول مجدداً.");
      }
    });
  }, [navigate]);
  return <main className="auth-layout"><section className="auth-panel"><div className="auth-form-wrap"><Brand /><h2>تأكيد الحساب</h2><p>{message}</p><Link className="button button-primary" to="/auth">العودة للدخول</Link></div></section></main>;
}

function VerifyEmailPage() {
  useLenis();
  const navigate = useNavigate();
  const [email] = useState(() => new URLSearchParams(window.location.search).get("email") || "");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [seconds, setSeconds] = useState(120);
  const [copied, setCopied] = useState(false);

  async function copyEmail() {
    if (!email.trim()) return;
    try {
      await navigator.clipboard.writeText(email.trim());
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
    } catch {
      setError("Copy is unavailable in this browser. Select the email address and copy it manually.");
    }
  }

  useEffect(() => {
    if (seconds <= 0) return;
    const timer = window.setInterval(() => setSeconds(value => Math.max(0, value - 1)), 1000);
    return () => window.clearInterval(timer);
  }, [seconds > 0]);
  useEffect(() => {
    const root = document.querySelector<HTMLElement>(".verify-page");
    if (!root || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    const responsive = gsap.matchMedia();
    const context = gsap.context(() => {

      responsive.add("(min-width: 701px)", () => {
        const intro = gsap.timeline({ defaults: { ease: "power3.out" } });
        intro
          .from(".verify-header", { y: -16, opacity: 0, duration: 0.55 })
          .from(".verify-story .verify-kicker", { y: 14, opacity: 0, duration: 0.48 }, "-=0.2")
          .from(".verify-story h1", { y: 26, opacity: 0, duration: 0.72 }, "-=0.2")
          .from(".verify-story-lead, .verify-story-note", { y: 14, opacity: 0, duration: 0.5, stagger: 0.1 }, "-=0.35")
          .from(".verify-art", { y: 22, scale: 0.96, opacity: 0, duration: 0.75 }, "-=0.3")
          .from(".verify-signature, .verify-story-foot", { y: 10, opacity: 0, duration: 0.42, stagger: 0.08 }, "-=0.35")
          .from(".verify-card", { x: 34, y: 12, opacity: 0, duration: 0.82 }, 0.12)
          .from(".verify-icon", { scale: 0.78, opacity: 0, duration: 0.55, ease: "back.out(1.6)" }, "-=0.45")
          .from(".verify-card > :not(.verify-icon)", { y: 12, opacity: 0, duration: 0.42, stagger: 0.055 }, "-=0.28")
          .from(".verify-footer", { y: 10, opacity: 0, duration: 0.42 }, "-=0.2");

        gsap.to(".verify-envelope", { y: -8, rotation: -3, duration: 3.2, repeat: -1, yoyo: true, ease: "sine.inOut", delay: 0.8 });
        gsap.to(".verify-orbit-one", { rotation: 8, duration: 16, repeat: -1, yoyo: true, ease: "sine.inOut" });
        gsap.to(".verify-orbit-two", { rotation: 58, duration: 19, repeat: -1, yoyo: true, ease: "sine.inOut" });
        return () => intro.kill();
      });

      responsive.add("(max-width: 700px)", () => {
        const intro = gsap.timeline({ defaults: { ease: "power3.out" } });
        intro
          .from(".verify-header", { y: -10, opacity: 0, duration: 0.42 })
          .from(".verify-card", { y: 22, opacity: 0, duration: 0.62 }, "-=0.12")
          .from(".verify-icon", { scale: 0.82, opacity: 0, duration: 0.48, ease: "back.out(1.5)" }, "-=0.35")
          .from(".verify-card > :not(.verify-icon)", { y: 9, opacity: 0, duration: 0.36, stagger: 0.045 }, "-=0.24")
          .from(".verify-story .verify-kicker, .verify-story h1, .verify-story-lead, .verify-story-note", { y: 14, opacity: 0, duration: 0.42, stagger: 0.08 }, "-=0.18")
          .from(".verify-art", { y: 16, scale: 0.97, opacity: 0, duration: 0.58 }, "-=0.2")
          .from(".verify-signature, .verify-story-foot", { y: 8, opacity: 0, duration: 0.35, stagger: 0.07 }, "-=0.2");

        gsap.to(".verify-envelope", { y: -6, rotation: -3, duration: 3.4, repeat: -1, yoyo: true, ease: "sine.inOut", delay: 0.7 });
        return () => intro.kill();
      });

    }, root);

    return () => {
      responsive.revert();
      context.revert();
    };
  }, []);


  const countdown = `${String(Math.floor(seconds / 60)).padStart(2, "0")}:${String(seconds % 60).padStart(2, "0")}`;

  async function resend(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!supabase || !email.trim()) { setError("Enter a valid email address first."); return; }
    setBusy(true); setMessage(""); setError("");
    try {
      const { error: resendError } = await supabase.auth.resend({
        type: "signup",
        email: email.trim(),
        options: { emailRedirectTo: window.location.origin + "/auth/callback" },
      });
      if (resendError) throw resendError;
      setMessage("A new verification link has been requested. Check your inbox and spam folder.");
      setSeconds(120);
    } catch (err) {
      setError(err instanceof Error ? translateAuthError(err.message) : "We couldn't send the email right now. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  function changeEmail() {
    navigate(`/auth?mode=signup&email=${encodeURIComponent(email.trim())}`);
  }

  return <main className="verify-page">
    <header className="verify-header">
      <span className="verify-language"><span aria-hidden="true">⌄</span> English <span className="verify-globe" aria-hidden="true">◎</span></span>
      <Brand />
    </header>

    <div className="verify-layout">
      <section className="verify-card" aria-labelledby="verify-card-title">
        <div className="verify-icon" aria-hidden="true">
          <svg viewBox="0 0 72 72" fill="none">
            <circle cx="34" cy="34" r="32" fill="#EAF1FF"/>
            <rect x="11" y="19" width="45" height="34" rx="8" fill="#1767E9"/>
            <path d="m14 23 19.5 16L53 23" stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"/>
            <circle cx="52" cy="52" r="13" fill="white" stroke="#1767E9" strokeWidth="2.5"/>
            <path d="m46 52 4 4 8-9" stroke="#1767E9" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </div>
        <p className="verify-eyebrow">ONE LAST STEP</p>
        <h2 id="verify-card-title">Check Your Email</h2>
        <p className="verify-card-intro">We’ve sent a verification link to</p>
        <div className="verify-email">
          <strong dir="ltr">{email || "Your email address"}</strong>
          <button className="verify-copy" type="button" onClick={copyEmail} disabled={!email.trim()} aria-label="Copy email address" title="Copy email address">
            {copied ? "Copied" : "Copy"}
          </button>
        </div>
        <p className="verify-instruction">Open the message and click the verification link to activate your TestDZ account.</p>

        {message && <div className="verify-feedback success" role="status">{message}</div>}
        {error && <div className="verify-feedback error" role="alert">{error}</div>}

        <div className="verify-countdown" aria-live="polite">
          <span className="verify-clock" aria-hidden="true"><svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></svg></span>
          <div><small>{seconds > 0 ? "You can request another email in" : "You can request another email now"}</small><strong>{seconds > 0 ? countdown : "Ready"}</strong></div>
        </div>

        <form onSubmit={resend} className="verify-actions">
          <button className="verify-primary" type="submit" disabled={busy || seconds > 0 || !email.trim()}>
            <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M20 7v5h-5"/><path d="M19 12a7 7 0 1 1-2-5"/></svg>
            {busy ? "Sending…" : "Resend verification email"}
          </button>
        </form>
        <button className="verify-secondary" type="button" onClick={changeEmail}>
          <svg viewBox="0 0 24 24" aria-hidden="true"><path d="m14 5 5 5"/><path d="M4 20h4l11-11a2.1 2.1 0 0 0-4-4L4 16z"/></svg>
          Change email address
        </button>
        <div className="verify-or"><span>OR</span></div>
        <button className="verify-secondary verify-back" type="button" onClick={() => navigate("/auth")}>
          <svg viewBox="0 0 24 24" aria-hidden="true"><path d="m14 18-6-6 6-6"/><path d="M8 12h12"/></svg>
          Back to sign in
        </button>
        <p className="verify-help">No email yet? Check your spam or junk folder.</p>
      </section>

      <section className="verify-story" aria-label="Email verification information">
        <span className="verify-kicker"><span className="verify-kicker-dot"/> TEST · LEARN · GROW</span>
        <h1>Verify your<br/><strong>email address</strong></h1>
        <p className="verify-story-lead">You’re almost ready to join the TestDZ community.</p>
        <p className="verify-story-note">Confirm your email to unlock your tester profile, discover new apps, and start earning rewards.</p>
        <div className="verify-art" aria-hidden="true">
          <div className="verify-art-glow"/>
          <div className="verify-orbit verify-orbit-one"/>
          <div className="verify-orbit verify-orbit-two"/>
          <div className="verify-envelope">
            <div className="verify-letter"><span>✓</span></div>
            <div className="verify-flap"/>
          </div>
          <div className="verify-mail-bubble"><svg viewBox="0 0 24 24"><rect x="3" y="5" width="18" height="14" rx="2"/><path d="m4 7 8 6 8-6"/></svg></div>
          <span className="verify-spark verify-spark-one">✦</span><span className="verify-spark verify-spark-two">✧</span>
        </div>
        <div className="verify-signature">Test. Learn. Grow.</div>
        <div className="verify-story-foot"><span/> A better way to test, learn and grow <span/></div>
      </section>
    </div>

    <footer className="verify-footer">
      <Brand/><span>Build. Test. Reward.</span>
      <nav><a href="/">About</a><a href="/">Terms of Service</a><a href="/">Privacy Policy</a><a href="/">Contact</a></nav>
      <small>© 2026 TestDZ. All rights reserved.</small>
    </footer>
  </main>;
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
    let postCreateWarning = "";
    if(icon){
      const ext=icon.type==="image/png"?"png":"jpg";
      const path=userId+"/"+appId+"/icon."+ext;
      const {error:uploadError}=await supabase.storage.from("app-icons").upload(path,icon,{upsert:true,contentType:icon.type,cacheControl:"3600"});
      if(uploadError){postCreateWarning="أُنشئ التطبيق، لكن تعذر رفع الأيقونة. يمكنك إضافتها لاحقاً.";}
      else{
        const {data}=supabase.storage.from("app-icons").getPublicUrl(path);
        const {error:updateError}=await supabase.rpc("update_app",{p_app_id:appId,p_name:name,p_description:description,p_category:category,p_icon_url:data.publicUrl});
        if(updateError)postCreateWarning="أُنشئ التطبيق ورُفعت الأيقونة، لكن تعذر ربطها بالتطبيق.";
      }
    }
    resetForm();setNotice("تم إنشاء التطبيق كمسودة.");await load();if(postCreateWarning)setError(postCreateWarning);setBusy(false);
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
  async function save(e:FormEvent<HTMLFormElement>){e.preventDefault();if(!supabase||!id)return;setBusy(true);const {error:err}=await supabase.rpc("update_app",{p_app_id:id,p_name:name,p_description:description,p_category:category});if(err)setError(appError(err.message));else{setNotice("تم حفظ التعديلات.");setEditing(false);await load();}setBusy(false);}
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