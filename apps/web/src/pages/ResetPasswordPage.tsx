import { useState } from "react";
import type { FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import { supabase } from "../lib/supabase";
import { identityApi } from "../features/identity/identity-api";
import "../styles/reset-password.css";

export default function ResetPasswordPage() {
  const navigate = useNavigate();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const hasLength = password.length >= 8;
  const hasLetter = /[A-Za-z]/.test(password);
  const hasNumber = /[0-9]/.test(password);
  const isStrong = hasLength && hasLetter && hasNumber;
  const strength = password.length === 0 ? 0 : [hasLength, hasLetter, hasNumber, password.length >= 12].filter(Boolean).length;

  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError("");
    setMessage("");
    if (!isStrong) {
      setError("Use at least 8 characters, including a letter and a number.");
      return;
    }
    if (password !== confirm) {
      setError("The passwords do not match.");
      return;
    }
    if (!supabase) {
      setError("Supabase is not configured. Please try again later.");
      return;
    }
    setBusy(true);
    const { error: err } = await identityApi.updatePassword(password);
    if (err) setError("This reset link is invalid or has expired. Please request a new one.");
    else {
      setPassword("");
      setConfirm("");
      navigate("/password-reset-success");
    }
    setBusy(false);
  }

  return (
    <main className="reset-page">
      <header className="reset-topbar">
        <Link className="reset-brand" to="/" aria-label="TestDZ home">
          <span className="reset-brand-mark" aria-hidden="true">
            <svg viewBox="0 0 48 56" fill="none"><path d="M17 4h14v8l13 29a7 7 0 0 1-6.4 10H10.4A7 7 0 0 1 4 41L17 12V4Z" fill="url(#resetFlask)"/><path d="M17 4h14v8l13 29a7 7 0 0 1-6.4 10H10.4A7 7 0 0 1 4 41L17 12V4Z" stroke="#0C65F4" strokeWidth="2"/><path d="M12 35h24l5 9H7l5-9Z" fill="#42D5FF"/><circle cx="22" cy="30" r="4" fill="#fff" fillOpacity=".85"/><circle cx="30" cy="40" r="2.5" fill="#0C65F4"/><defs><linearGradient id="resetFlask" x1="8" y1="5" x2="40" y2="50" gradientUnits="userSpaceOnUse"><stop stopColor="#5DEBFF"/><stop offset=".55" stopColor="#087DFF"/><stop offset="1" stopColor="#1647DF"/></linearGradient></defs></svg>
          </span>
          <span className="reset-brand-copy"><strong>TestDZ</strong><small>Test · Learn · Grow</small></span>
        </Link>
        <nav className="reset-language" aria-label="Language">
          <span className="reset-globe" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3a14 14 0 0 1 0 18M12 3a14 14 0 0 0 0 18"/></svg></span>
          <span className="reset-language-option reset-language-active">العربية⌄</span>
          <i aria-hidden="true" />
          <span className="reset-language-option">Français</span>
        </nav>
      </header>

      <div className="reset-content">
        <section className="reset-intro" aria-label="Reset password">
          <div className="reset-intro-copy">
            <h1>Reset<br /><span>Password</span></h1>
            <p>Enter your new password to<br className="reset-desktop-break" /> regain access to your account.</p>
          </div>
          <div className="reset-lock-art" aria-hidden="true">
            <div className="reset-art-orbit reset-art-orbit-one" />
            <div className="reset-art-orbit reset-art-orbit-two" />
            <div className="reset-spark reset-spark-one" />
            <div className="reset-spark reset-spark-two" />
            <svg className="reset-lock-svg" viewBox="0 0 360 390" fill="none">
              <defs>
                <linearGradient id="lockBody" x1="90" y1="145" x2="260" y2="315" gradientUnits="userSpaceOnUse"><stop stopColor="#45C9FF"/><stop offset=".48" stopColor="#087BFA"/><stop offset="1" stopColor="#1246D8"/></linearGradient>
                <linearGradient id="lockShackle" x1="130" y1="55" x2="220" y2="165" gradientUnits="userSpaceOnUse"><stop stopColor="#4CCFFF"/><stop offset="1" stopColor="#0754E8"/></linearGradient>
                <filter id="lockShadow" x="20" y="60" width="330" height="330" filterUnits="userSpaceOnUse"><feGaussianBlur stdDeviation="13"/></filter>
              </defs>
              <ellipse cx="181" cy="306" rx="120" ry="24" fill="#1675F5" fillOpacity=".22" filter="url(#lockShadow)"/>
              <path d="M112 155V116C112 78 139 51 176 51C213 51 240 78 240 116V155" stroke="url(#lockShackle)" strokeWidth="25" strokeLinecap="round"/>
              <path d="M95 147H257C271 147 282 158 282 172V285C282 302 269 315 252 315H100C83 315 70 302 70 285V172C70 158 81 147 95 147Z" fill="url(#lockBody)"/>
              <path d="M92 160H255" stroke="#9DE8FF" strokeOpacity=".75" strokeWidth="4" strokeLinecap="round"/>
              <circle cx="176" cy="218" r="26" fill="#F5FBFF"/>
              <path d="M163 234H189L195 264H157L163 234Z" fill="#F5FBFF"/>
              <circle cx="111" cy="184" r="4" fill="#fff" fillOpacity=".45"/><circle cx="241" cy="285" r="5" fill="#fff" fillOpacity=".3"/>
            </svg>
            <div className="reset-password-pill"><span>✱</span><span>✱</span><span>✱</span><span>✱</span><span>✱</span><span>✱</span></div>
          </div>
          <p className="reset-script">Test. Learn. Grow.<span /></p>
        </section>

        <section className="reset-card" aria-labelledby="reset-card-title">
          <div className="reset-card-icon" aria-hidden="true">
            <span className="reset-icon-halo" />
            <svg viewBox="0 0 100 100" fill="none"><path d="M31 43V30a19 19 0 0 1 38 0v13" stroke="currentColor" strokeWidth="8" strokeLinecap="round"/><rect x="20" y="40" width="60" height="43" rx="9" fill="currentColor"/><circle cx="50" cy="59" r="6" fill="white"/><path d="M50 64v8" stroke="white" strokeWidth="5" strokeLinecap="round"/><path d="M76 67a20 20 0 0 1-17 20M76 59l1 9 8-2" stroke="#38BDF8" strokeWidth="5" strokeLinecap="round" strokeLinejoin="round"/></svg>
            <span className="reset-icon-check"><svg viewBox="0 0 24 24" fill="none"><path d="m5 12 4 4L19 6"/></svg></span>
          </div>
          <h2 id="reset-card-title">Create New Password</h2>
          <p className="reset-card-subtitle">Your new password must be secure and easy to remember.</p>

          {message && <div className="reset-feedback reset-feedback-success" role="status">{message} <Link to="/auth">Back to Login</Link></div>}
          {error && <div className="reset-feedback reset-feedback-error" role="alert">{error}</div>}

          <form className="reset-form" onSubmit={submit}>
            <label className="reset-input-wrap">
              <svg viewBox="0 0 24 24" aria-hidden="true"><rect x="5" y="10" width="14" height="11" rx="2"/><path d="M8 10V7a4 4 0 1 1 8 0v3M12 14v3"/></svg>
              <span className="sr-only">New Password</span>
              <input autoComplete="new-password" type={showPassword ? "text" : "password"} placeholder="New Password" value={password} onChange={e => setPassword(e.target.value)} required minLength={8} aria-describedby="reset-password-strength" />
              <button type="button" className="reset-eye" onClick={() => setShowPassword(v => !v)} aria-label={showPassword ? "Hide password" : "Show password"}><svg viewBox="0 0 24 24" fill="none" aria-hidden="true">{showPassword ? <><path d="M3 3l18 18"/><path d="M10.6 10.6a2 2 0 0 0 2.8 2.8"/><path d="M9.9 5.2A10.8 10.8 0 0 1 12 5c5.2 0 8.5 5.1 9 6-.3.5-1.4 2.2-3.4 3.7M6.2 6.2C4.1 7.6 2.9 9.6 2 11c.5.9 3.8 8 10 8 1 0 1.9-.2 2.8-.6"/></> : <><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12Z"/><circle cx="12" cy="12" r="3"/></>}</svg></button>
            </label>
            <div className="reset-strength" id="reset-password-strength" aria-live="polite">
              <div className="reset-strength-bars">{[1, 2, 3, 4].map(n => <span key={n} className={strength >= n ? (isStrong ? "filled strong" : "filled") : ""} />)}</div>
              <span className={isStrong ? "reset-strength-label is-strong" : "reset-strength-label"}>{password.length === 0 ? "Use 8+ characters, a letter and a number" : isStrong ? "Strong" : "Keep going"}</span>
            </div>
            <label className="reset-input-wrap">
              <svg viewBox="0 0 24 24" aria-hidden="true"><rect x="5" y="10" width="14" height="11" rx="2"/><path d="M8 10V7a4 4 0 1 1 8 0v3M12 14v3"/></svg>
              <span className="sr-only">Confirm New Password</span>
              <input autoComplete="new-password" type={showConfirm ? "text" : "password"} placeholder="Confirm New Password" value={confirm} onChange={e => setConfirm(e.target.value)} required />
              <button type="button" className="reset-eye" onClick={() => setShowConfirm(v => !v)} aria-label={showConfirm ? "Hide confirmation password" : "Show confirmation password"}><svg viewBox="0 0 24 24" fill="none" aria-hidden="true">{showConfirm ? <><path d="M3 3l18 18"/><path d="M10.6 10.6a2 2 0 0 0 2.8 2.8"/><path d="M9.9 5.2A10.8 10.8 0 0 1 12 5c5.2 0 8.5 5.1 9 6-.3.5-1.4 2.2-3.4 3.7M6.2 6.2C4.1 7.6 2.9 9.6 2 11c.5.9 3.8 8 10 8 1 0 1.9-.2 2.8-.6"/></> : <><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12Z"/><circle cx="12" cy="12" r="3"/></>}</svg></button>
            </label>
            <button className="reset-submit" disabled={busy || Boolean(message)}>{busy ? <><span className="reset-spinner" /> Updating Password…</> : <><span className="reset-submit-icon" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none"><path d="M20 7v5h-5M4 17v-5h5"/><path d="M5.6 9a7 7 0 0 1 11.7-2L20 12M4 12l2.7 5a7 7 0 0 0 11.7-2"/></svg></span> Reset Password</>}</button>
          </form>

          <div className="reset-password-tip"><span className="reset-info-icon" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="9"/><path d="M12 11v5M12 8h.01"/></svg></span><p>Your password must be at least 8 characters, including a number and a letter.</p></div>
          <Link className="reset-back-link" to="/auth"><span aria-hidden="true"><svg viewBox="0 0 24 24" fill="none"><path d="M19 12H5M12 19l-7-7 7-7"/></svg></span> Back to Login</Link>
        </section>
      </div>
    </main>
  );
}
