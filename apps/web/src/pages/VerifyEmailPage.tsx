import { useEffect, useState } from "react";
import type { FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { Brand } from "../components/Brand";
import { useLenis } from "../hooks/useLenis";
import { translateAuthError } from "../lib/auth-routing";
import { supabase } from "../lib/supabase";

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

