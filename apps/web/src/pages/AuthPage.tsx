import { useEffect, useRef, useState } from "react";
import type { FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import { gsap } from "gsap";
import { isSupabaseConfigured, supabase } from "../lib/supabase";
import { getPostAuthRoute, translateAuthError } from "../lib/auth-routing";
import { identityApi } from "../shared/auth/identity-api";

function AuthPage() {
  const navigate = useNavigate();
  const authRoot = useRef<HTMLElement | null>(null);
  const params = new URLSearchParams(window.location.search);
  const [mode, setMode] = useState<"signin" | "signup">(params.get("mode") === "signup" ? "signup" : "signin");
  const [email, setEmail] = useState(() => params.get("email") || "");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [accountType, setAccountType] = useState<"tester" | "developer">("tester");
  const [acceptedTerms, setAcceptedTerms] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(true);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const passwordRules = [
    { label: "At least 8 characters", valid: password.length >= 8 },
    { label: "Contains a letter", valid: /[A-Za-z]/.test(password) },
    { label: "Contains a number", valid: /[0-9]/.test(password) },
    { label: "Passwords match", valid: password.length > 0 && password === confirmPassword },
  ];
  const passwordStrength = passwordRules.slice(0, 3).filter(rule => rule.valid).length;

  // Cinematic entrance is scoped to this page and fully reverted on cleanup.
  useEffect(() => {
    const root = authRoot.current;
    if (!root) return;

    const context = gsap.context(() => {
      const media = gsap.matchMedia();
      media.add("(prefers-reduced-motion: no-preference)", () => {
        const intro = gsap.timeline({ defaults: { ease: "power3.out" } });
        intro
          .fromTo(".auth-reference-brand", { autoAlpha: 0, y: -12 }, { autoAlpha: 1, y: 0, duration: 0.52 })
          .fromTo(".auth-reference-copy", { autoAlpha: 0, y: 18 }, { autoAlpha: 1, y: 0, duration: 0.7 }, "-=0.24")
          .fromTo(".auth-illustration img", { autoAlpha: 0, y: 26, scale: 0.965 }, { autoAlpha: 1, y: 0, scale: 1, duration: 0.92, ease: "power2.out" }, "-=0.38")
          .fromTo(".auth-code-bubble", { autoAlpha: 0, scale: 0.72, rotation: -18 }, { autoAlpha: 1, scale: 1, rotation: -9, duration: 0.52, ease: "back.out(1.6)" }, "-=0.55")
          .fromTo(".auth-orbit", { autoAlpha: 0, scale: 0.6 }, { autoAlpha: 0.82, scale: 1, duration: 0.58, stagger: 0.1 }, "-=0.5")
          .fromTo(".auth-reference-form-wrap", { autoAlpha: 0, x: 26, y: 12, scale: 0.985 }, { autoAlpha: 1, x: 0, y: 0, scale: 1, duration: 0.78 }, "-=0.72")
          .fromTo(".auth-benefits li", { autoAlpha: 0, x: -10 }, { autoAlpha: 1, x: 0, duration: 0.34, stagger: 0.085 }, "-=0.38")
          .fromTo(".auth-security", { autoAlpha: 0, y: 8 }, { autoAlpha: 1, y: 0, duration: 0.3 }, "-=0.18");

        const orbitMotion = gsap.to(".auth-orbit-one", {
          rotation: 360,
          duration: 30,
          repeat: -1,
          ease: "none",
          transformOrigin: "50% 50%",
        });
        const bubbleMotion = gsap.to(".auth-code-bubble", {
          y: -6,
          duration: 2.5,
          repeat: -1,
          yoyo: true,
          ease: "sine.inOut",
        });

        return () => {
          intro.kill();
          orbitMotion.kill();
          bubbleMotion.kill();
        };
      });

      return () => media.revert();
    }, root);

    return () => context.revert();
  }, []);

  // Animate only when the user switches between Login and Register, not on first paint.
  const previousAuthMode = useRef(mode);
  useEffect(() => {
    if (previousAuthMode.current === mode) return;
    previousAuthMode.current = mode;

    const root = authRoot.current;
    if (!root) return;

    const context = gsap.context(() => {
      const media = gsap.matchMedia();
      media.add("(prefers-reduced-motion: no-preference)", () => {
        const transition = gsap.timeline({ defaults: { ease: "power2.out" } });
        transition
          .fromTo(".auth-reference-heading", { autoAlpha: 0, y: 12, filter: "blur(4px)" }, { autoAlpha: 1, y: 0, filter: "blur(0px)", duration: 0.38 })
          .fromTo(
            ".auth-reference-fields .auth-input, .auth-account-types, .auth-terms, .auth-password-guidance, .auth-form-options",
            { autoAlpha: 0, y: 9 },
            { autoAlpha: 1, y: 0, duration: 0.25, stagger: 0.035 },
            "-=0.12",
          )
          .fromTo(".auth-socials button", { autoAlpha: 0, y: 7 }, { autoAlpha: 1, y: 0, duration: 0.22, stagger: 0.045 }, "-=0.12")
          .fromTo(".auth-reference-submit", { y: 5, scale: 0.99 }, { y: 0, scale: 1, duration: 0.24 }, "-=0.12");
        return () => transition.kill();
      });
      return () => media.revert();
    }, root);

    return () => context.revert();
  }, [mode]);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage("");
    setError("");
    if (mode === "signin" && !supabase) {
      setError("Demo mode: sign-in is not connected yet. Use Register to preview the signup flow.");
      return;
    }
    if (mode === "signup" && !acceptedTerms) {
      setError("Please confirm that you understand the Terms of Service and Privacy Policy are still drafts.");
      return;
    }
    if (mode === "signup" && password !== confirmPassword) {
      setError("كلمتا المرور غير متطابقتين. تحقق من كلمة المرور وتأكيدها.");
      return;
    }
    if (mode === "signup" && (!/[A-Za-z]/.test(password) || !/[0-9]/.test(password))) {
      setError("كلمة المرور يجب أن تحتوي على حرف ورقم، وبحد أدنى 8 أحرف.");
      return;
    }
    if (mode === "signup" && !supabase) {
      navigate(`/signup-success?email=${encodeURIComponent(email.trim())}`, { replace: true });
      return;
    }
    setBusy(true);
    try {
      if (mode === "signup") {
        const { data, error: authError } = await identityApi.signUp({
          email: email.trim(),
          password,
          metadata: { full_name: fullName.trim(), phone: phone.trim() || null, account_type: accountType },
          emailRedirectTo: window.location.origin + "/auth/callback",
        });
        if (authError) throw authError;
        if (data.session) navigate(await getPostAuthRoute(data.session.user.id), { replace: true });
        else navigate(`/verify-email?email=${encodeURIComponent(email.trim())}`, { replace: true });
      } else {
        const { data, error: authError } = await identityApi.signInWithPassword(email.trim(), password);
        if (authError) throw authError;
        if (data.session) navigate(await getPostAuthRoute(data.session.user.id), { replace: true });
      }
    } catch (err) {
      setError(err instanceof Error ? translateAuthError(err.message) : "حدث خطأ غير متوقع. حاول مرة أخرى.");
    } finally {
      setBusy(false);
    }
  }

  async function socialLogin(provider: "google" | "github" | "azure") {
    setError("");
    if (!supabase) {
      setError("الاتصال بقاعدة البيانات غير مضبوط بعد. أضف متغيرات Supabase في ملف البيئة.");
      return;
    }
    setBusy(true);
    try {
      const { error: authError } = await identityApi.signInWithOAuth(provider, window.location.origin + "/auth/callback");
      if (authError) throw authError;
    } catch (err) {
      setError(err instanceof Error ? translateAuthError(err.message) : "تعذر تسجيل الدخول بهذه الخدمة.");
      setBusy(false);
    }
  }

  return <main ref={authRoot} className="auth-reference">
    <section className="auth-reference-hero">
      <header className="auth-reference-header">
        <Link to="/" className="auth-reference-brand" aria-label="TestDZ home"><span className="auth-flask" aria-hidden="true"><svg viewBox="0 0 48 48" role="img"><path d="M18 5h12M21 5v12L9 37a4 4 0 0 0 3.5 6h23a4 4 0 0 0 3.5-6L27 17V5" fill="none" stroke="currentColor" strokeWidth="3.2" strokeLinecap="round" strokeLinejoin="round"/><path d="M15 32h18l5 7a2 2 0 0 1-2 2H12a2 2 0 0 1-2-2z" fill="#55b7ff" stroke="none"/><circle cx="21" cy="35" r="1.5" fill="#fff"/><circle cx="28" cy="38" r="1.5" fill="#fff"/></svg></span><span><strong>TestDZ</strong><small>Test · Learn · Grow</small></span></Link>
        <button className="auth-language" type="button" aria-label="Language"><span>◎</span> English⌄</button>
      </header>
      <div className="auth-reference-copy">
        <span className="auth-kicker">TEST · LEARN · GROW</span>
        <h1>{mode === "signup" ? <>Join the<br/><strong>TestDZ community</strong></> : <>Welcome to<br/><strong>TestDZ</strong></>}</h1>
        <p>{mode === "signup" ? "Be part of a growing community of testers and developers, build your skills and achieve more together." : "The ultimate platform for software testing, where developers create tests and testers earn rewards."}</p>
        
        <ul className="auth-benefits">
          <li><span aria-hidden="true"><svg viewBox="0 0 24 24"><path d="m13 2-9 12h7l-1 8 10-13h-7z" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round"/></svg></span>{mode === "signup" ? "Take Tests & Earn Points" : "Take Tests & Earn Points"}</li>
          <li><span aria-hidden="true"><svg viewBox="0 0 24 24"><path d="M12 3v18M3 12h18M5.5 5.5l13 13m0-13-13 13" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round"/><path d="M8 3.8 12 2l4 1.8M8 20.2 12 22l4-1.8M3.8 8 2 12l1.8 4M20.2 8 22 12l-1.8 4" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/></svg></span>{mode === "signup" ? "Unlock Rewards & Badges" : "Unlock Rewards & Benefits"}</li>
          <li><span aria-hidden="true"><svg viewBox="0 0 24 24"><path d="M4 20V12h4v8M10 20V5h4v15M16 20V9h4v11" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/><path d="M3 21h18" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/></svg></span>{mode === "signup" ? "Connect with Community" : "Grow Your Skills"}</li>
        </ul>
        <div className="auth-illustration"><div className="auth-code-bubble">&lt;/&gt;</div><div className="auth-orbit auth-orbit-one"></div><div className="auth-orbit auth-orbit-two"></div><img src="/images/hero-dashboard.png" alt="TestDZ testing dashboard preview" /><span className="auth-points"><b aria-hidden="true">QA</b><strong>Test Lab</strong><small>Build · Test · Improve</small></span></div>
      </div>
      
    </section>
    <section className="auth-reference-form-area">
      <div className="auth-reference-form-wrap">
        <div className="auth-mode-tabs" role="tablist" aria-label="Authentication mode">
          <button type="button" role="tab" aria-selected={mode === "signin"} className={mode === "signin" ? "active" : ""} onClick={() => {setMode("signin");setError("");setMessage("");}}><span aria-hidden="true"><svg viewBox="0 0 24 24"><path d="M10 4H5a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h5M14 16l4-4-4-4M18 12H9" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg></span> Login</button>
          <button type="button" role="tab" aria-selected={mode === "signup"} className={mode === "signup" ? "active" : ""} onClick={() => {setMode("signup");setError("");setMessage("");}}><span aria-hidden="true"><svg viewBox="0 0 24 24"><circle cx="12" cy="8" r="4" fill="none" stroke="currentColor" strokeWidth="2"/><path d="M4 21a8 8 0 0 1 16 0" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/></svg></span> Register</button>
        </div>
        <div className="auth-reference-heading"><span className="auth-heading-eyebrow">{mode === "signup" ? "START YOUR JOURNEY" : "YOUR WORKSPACE AWAITS"}</span><h2>{mode === "signup" ? "Create Your Account" : "Welcome Back!"}</h2><p>{mode === "signup" ? "Join TestDZ and start earning rewards" : "Login to your TestDZ account"}</p></div>
        {!isSupabaseConfigured && <div className="notice notice-warning">الواجهة جاهزة، لكن يلزم ضبط متغيرات Supabase في ملف <code>.env</code> لتفعيل المصادقة.</div>}
        {message && <div className="notice notice-success" role="status">{message}</div>}
        {error && <div className="notice notice-error" role="alert">{error}</div>}
        <form onSubmit={submit} className={"auth-reference-fields " + (mode === "signup" ? "is-signup" : "is-signin")} key={mode}>
          {mode === "signup" && <><label className="auth-input"><span className="auth-field-icon" aria-hidden="true"><svg viewBox="0 0 24 24"><circle cx="12" cy="8" r="4" /><path d="M4 21a8 8 0 0 1 16 0" /></svg></span><input autoComplete="name" value={fullName} onChange={e => setFullName(e.target.value)} required minLength={2} placeholder="Full Name" aria-label="Full name" /></label><label className="auth-input"><span className="auth-field-icon" aria-hidden="true"><svg viewBox="0 0 24 24"><path d="M7 3h10a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2Z"/><path d="M9 6h6M10 18h4" /></svg></span><input type="tel" autoComplete="tel" value={phone} onChange={e => setPhone(e.target.value)} placeholder="Phone Number (optional)" aria-label="Phone number (optional)" dir="ltr" /></label></>}
          <label className="auth-input"><span className="auth-field-icon" aria-hidden="true"><svg viewBox="0 0 24 24"><rect x="3" y="5" width="18" height="14" rx="2"/><path d="m4 7 8 6 8-6" /></svg></span><input type="email" autoComplete="email" autoCapitalize="none" autoCorrect="off" spellCheck={false} value={email} onChange={e => setEmail(e.target.value)} required placeholder="Email Address" aria-label="Email address" dir="ltr" /></label>
          <label className="auth-input"><span className="auth-field-icon" aria-hidden="true"><svg viewBox="0 0 24 24"><rect x="4" y="10" width="16" height="11" rx="2"/><path d="M8 10V7a4 4 0 0 1 8 0v3M12 14v3" /></svg></span><input type={showPassword ? "text" : "password"} autoComplete={mode === "signup" ? "new-password" : "current-password"} value={password} onChange={e => setPassword(e.target.value)} required minLength={8} placeholder="Password" aria-label="Password" dir="ltr" /><button type="button" className="auth-show-password" onClick={() => setShowPassword(v => !v)} aria-label={showPassword ? "Hide password" : "Show password"}>{showPassword ? <svg viewBox="0 0 24 24"><path d="M3 3l18 18M10.6 10.6a2 2 0 0 0 2.8 2.8"/><path d="M9.9 5.2A10.8 10.8 0 0 1 12 5c5 0 8.5 4.5 9 7-.2 1.1-1.1 2.5-2.6 3.7M6.2 6.3C4 7.7 2.5 10 2 12c.5 2.5 4 7 10 7 1.1 0 2.1-.2 3-.5"/></svg> : <svg viewBox="0 0 24 24"><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12Z"/><circle cx="12" cy="12" r="3"/></svg>}</button></label>
          {mode === "signup" && <label className="auth-input"><span className="auth-field-icon" aria-hidden="true"><svg viewBox="0 0 24 24"><rect x="4" y="10" width="16" height="11" rx="2"/><path d="M8 10V7a4 4 0 0 1 8 0v3M9 15l2 2 4-4" /></svg></span><input type={showConfirmPassword ? "text" : "password"} autoComplete="new-password" value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)} required minLength={8} placeholder="Confirm Password" aria-label="Confirm password" aria-invalid={confirmPassword.length > 0 && password !== confirmPassword} dir="ltr" /><button type="button" className="auth-show-password" onClick={() => setShowConfirmPassword(v => !v)} aria-label={showConfirmPassword ? "Hide confirmation password" : "Show confirmation password"}>{showConfirmPassword ? <svg viewBox="0 0 24 24"><path d="M3 3l18 18M10.6 10.6a2 2 0 0 0 2.8 2.8"/><path d="M9.9 5.2A10.8 10.8 0 0 1 12 5c5 0 8.5 4.5 9 7-.2 1.1-1.1 2.5-2.6 3.7M6.2 6.3C4 7.7 2.5 10 2 12c.5 2.5 4 7 10 7 1.1 0 2.1-.2 3-.5"/></svg> : <svg viewBox="0 0 24 24"><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12Z"/><circle cx="12" cy="12" r="3"/></svg>}</button></label>}
          {mode === "signup" && <fieldset className="auth-account-types"><legend>Choose Your Account Type</legend><label className={accountType === "tester" ? "selected" : ""}><input type="radio" name="accountType" value="tester" checked={accountType === "tester"} onChange={() => setAccountType("tester")} /><span className="account-type-icon" aria-hidden="true"><svg viewBox="0 0 24 24"><path d="m5 12 4.2 4.2L19 6.5" /></svg></span><strong>Tester</strong><small>Take tests &amp;<br/> earn rewards</small></label><label className={accountType === "developer" ? "selected" : ""}><input type="radio" name="accountType" value="developer" checked={accountType === "developer"} onChange={() => setAccountType("developer")} /><span className="account-type-icon" aria-hidden="true"><svg viewBox="0 0 24 24"><path d="m8 7-5 5 5 5M16 7l5 5-5 5M14 4l-4 16" /></svg></span><strong>Developer</strong><small>Build &amp; share<br/> your solutions</small></label></fieldset>}
          {mode === "signup" && <label className="auth-terms"><input type="checkbox" checked={acceptedTerms} onChange={e => setAcceptedTerms(e.target.checked)} required /><span>I understand the <Link className="auth-terms-link" to="/terms">Terms of Service</Link> and <Link className="auth-terms-link" to="/privacy">Privacy Policy</Link> are drafts awaiting approval</span></label>}
          {mode === "signup" && password.length > 0 && <div className="auth-password-guidance" aria-live="polite"><div className="auth-strength-top"><span>Password strength</span><strong data-strength={passwordStrength}>{["Needs work", "Fair", "Good", "Strong"][passwordStrength]}</strong></div><div className="auth-strength-meter" aria-label={"Password strength " + passwordStrength + " of 3"}>{[1,2,3].map(level => <i key={level} className={passwordStrength >= level ? "filled strength-" + passwordStrength : ""} />)}</div><ul>{passwordRules.map(rule => <li key={rule.label} className={rule.valid ? "valid" : ""}><span>{rule.valid ? "✓" : "○"}</span>{rule.label}</li>)}</ul></div>}
          {mode === "signup" && confirmPassword.length > 0 && <p className={"auth-match-note " + (password === confirmPassword ? "matched" : "unmatched")} role="status">{password === confirmPassword ? "✓ Passwords match" : "Passwords do not match yet"}</p>}
          {mode === "signin" && <div className="auth-form-options"><label className="auth-remember"><input type="checkbox" checked={rememberMe} onChange={e => setRememberMe(e.target.checked)} /> <span>Remember me</span></label><Link to="/forgot-password">Forgot Password?</Link></div>}
          <button className="auth-reference-submit" type="submit" disabled={busy}><span className={busy ? "auth-submit-spinner" : ""} aria-hidden="true">{busy ? "" : mode === "signup" ? "↗" : "→"}</span>{busy ? "Securing your session…" : mode === "signup" ? "Create Account" : "Login"}<svg className="auth-submit-arrow" viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12h14m-6-6 6 6-6 6" /></svg></button>
        </form>
        <><div className="auth-or-divider"><span>{mode === "signup" ? "or sign up with" : "or continue with"}</span></div><div className={"auth-socials " + (mode === "signup" ? "auth-socials-signup" : "")}><button type="button" onClick={() => socialLogin("google")} disabled={busy}><b className="social-logo google-mark" aria-hidden="true"><svg viewBox="0 0 48 48"><path fill="#FFC107" d="M43.6 24.5c0-1.4-.1-2.8-.4-4.1H24v7.8h11a9.4 9.4 0 0 1-4.1 6.2v5.1h6.6c3.9-3.6 6.1-8.9 6.1-15z"/><path fill="#FF3D00" d="M24 44c5.5 0 10.1-1.8 13.5-4.9l-6.6-5.1c-1.8 1.2-4.1 2-6.9 2-5.3 0-9.8-3.6-11.4-8.4H5.8v5.3A20 20 0 0 0 24 44z"/><path fill="#4CAF50" d="M12.6 27.6a12 12 0 0 1 0-7.2v-5.3H5.8a20 20 0 0 0 0 17.8z"/><path fill="#1976D2" d="M24 12.1c3 0 5.7 1 7.8 3.1l5.8-5.8C34.1 6.1 29.5 4 24 4A20 20 0 0 0 5.8 15.1l6.8 5.3c1.6-4.8 6.1-8.3 11.4-8.3z"/></svg></b>Google</button><button type="button" onClick={() => socialLogin("github")} disabled={busy}><b className="social-logo github-mark" aria-hidden="true"><svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 .9a11.1 11.1 0 0 0-3.5 21.6c.6.1.8-.3.8-.6v-2.1c-3.3.7-4-1.4-4-1.4-.5-1.3-1.3-1.6-1.3-1.6-1.1-.8.1-.8.1-.8 1.2.1 1.8 1.2 1.8 1.2 1.1 1.8 2.8 1.3 3.5 1 .1-.8.4-1.3.8-1.6-2.6-.3-5.3-1.3-5.3-5.8 0-1.3.5-2.4 1.2-3.2-.1-.3-.5-1.5.1-3.2 0 0 1-.3 3.3 1.2a11.4 11.4 0 0 1 6 0C18.1 4.6 19 5 19 5c.7 1.7.3 2.9.2 3.2.8.8 1.2 1.9 1.2 3.2 0 4.5-2.7 5.5-5.3 5.8.4.4.8 1 .8 2v3c0 .3.2.7.8.6A11.1 11.1 0 0 0 12 .9z"/></svg></b>GitHub</button><button type="button" onClick={() => socialLogin("azure")} disabled={busy}><b className="social-logo microsoft-mark" aria-hidden="true"><svg viewBox="0 0 24 24"><path fill="#f35325" d="M1 1h10v10H1z"/><path fill="#81bc06" d="M13 1h10v10H13z"/><path fill="#05a6f0" d="M1 13h10v10H1z"/><path fill="#ffba08" d="M13 13h10v10H13z"/></svg></b>Microsoft</button></div></>
        <p className="auth-reference-switch">{mode === "signup" ? "Already have an account?" : "Don't have an account?"} <button type="button" onClick={() => {setMode(mode === "signup" ? "signin" : "signup");setError("");setMessage("");}}>{mode === "signup" ? "Login now" : "Create one now"}</button></p>
      </div>
      <div className="auth-security"><span aria-hidden="true"><svg viewBox="0 0 24 24"><path d="M12 3 20 6v5c0 5-3.4 8.2-8 10-4.6-1.8-8-5-8-10V6z"/><path d="m8.5 12 2.3 2.3 4.8-5"/></svg></span><div><strong>Your data is protected</strong><small>Secure authentication keeps your account and activity private.</small></div><span className="auth-security-badge">SSL</span></div>
    </section>
  </main>;
}


export default AuthPage;
