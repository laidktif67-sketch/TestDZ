import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import "../styles/invalid-otp.css";

function FlaskLogo() {
  return <svg viewBox="0 0 48 56" fill="none" aria-hidden="true"><path d="M17 4h14v8l13 29a7 7 0 0 1-6.4 10H10.4A7 7 0 0 1 4 41L17 12V4Z" fill="url(#otp-flask)"/><path d="M17 4h14v8l13 29a7 7 0 0 1-6.4 10H10.4A7 7 0 0 1 4 41L17 12V4Z" stroke="#0C65F4" strokeWidth="2"/><path d="M12 35h24l5 9H7l5-9Z" fill="#42D5FF"/><circle cx="22" cy="30" r="4" fill="white"/><defs><linearGradient id="otp-flask" x1="8" y1="5" x2="40" y2="50"><stop stopColor="#5DEBFF"/><stop offset="1" stopColor="#1647DF"/></linearGradient></defs></svg>;
}

function InvalidOtpArtwork() {
  return <div className="otp-art" aria-hidden="true">
    <div className="otp-orbit otp-orbit-a"/><div className="otp-orbit otp-orbit-b"/>
    <span className="otp-spark otp-spark-a"/><span className="otp-spark otp-spark-b"/>
    <svg className="otp-shield" viewBox="0 0 460 400" fill="none">
      <defs><linearGradient id="otpShieldFill" x1="140" y1="70" x2="330" y2="330" gradientUnits="userSpaceOnUse"><stop stopColor="#45C9FF"/><stop offset=".52" stopColor="#087BFA"/><stop offset="1" stopColor="#1246D8"/></linearGradient><filter id="otpShadow" x="35" y="40" width="390" height="350"><feGaussianBlur stdDeviation="17"/></filter></defs>
      <ellipse cx="225" cy="314" rx="150" ry="25" fill="#1675F5" fillOpacity=".26" filter="url(#otpShadow)"/>
      <path d="M230 35 360 90V205C360 282 305 343 230 382 155 343 100 282 100 205V90L230 35Z" fill="url(#otpShieldFill)" stroke="#71D9FF" strokeWidth="8"/>
      <path d="M230 63 337 108V205C337 268 290 318 230 352 170 318 123 268 123 205V108L230 63Z" stroke="#A1E8FF" strokeWidth="5"/>
      <path d="m169 151 122 122m0-122L169 273" stroke="white" strokeWidth="24" strokeLinecap="round" strokeLinejoin="round"/>
      <g transform="rotate(2 230 320)"><rect x="65" y="286" width="330" height="78" rx="35" fill="white" stroke="#D8E7FF" strokeWidth="3"/></g>
      <circle cx="332" cy="250" r="48" fill="#F04452"/><circle cx="332" cy="250" r="43" stroke="#FFB2BA" strokeWidth="3"/>
      <path d="M332 222v34" stroke="white" strokeWidth="12" strokeLinecap="round"/><circle cx="332" cy="274" r="6" fill="white"/>
      <g fill="#087BFA"><path d="m70 48 10-28M96 65l20-22M124 84l25-15M390 61l15-24M405 83l27-12"/></g>
    </svg>
    <div className="otp-stars"><span>✱</span><span>✱</span><span>✱</span><span>✱</span></div>
    <div className="otp-art-copy"><h2>Invalid or Expired OTP</h2><p>The code you entered is invalid or has expired.<br/>Please request a new code.</p></div>
    <p className="otp-script">Test. Learn. Grow.<i/></p>
  </div>;
}

export default function InvalidOtpPage() {
  const navigate = useNavigate();
  return <main className="otp-page">
    <header className="otp-header">
      <Link className="otp-brand" to="/" aria-label="TestDZ home"><FlaskLogo/><span><strong>TestDZ</strong><small>Test · Learn · Grow</small></span></Link>
      <nav className="otp-language" aria-label="Language"><svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3a14 14 0 0 1 0 18M12 3a14 14 0 0 0 0 18"/></svg><span>العربية⌄</span><i/><span>Français</span></nav>
    </header>
    <div className="otp-layout">
      <section className="otp-story"><InvalidOtpArtwork/></section>
      <section className="otp-card" aria-labelledby="otp-title">
        <div className="otp-alert-icon" aria-hidden="true"><svg viewBox="0 0 96 96" fill="none"><path d="M48 8 78 20v24c0 19-12 32-30 43C30 76 18 63 18 44V20L48 8Z" fill="#fff" stroke="#F04452" strokeWidth="5"/><path d="m36 36 24 24m0-24L36 60" stroke="#F04452" strokeWidth="7" strokeLinecap="round"/><circle cx="75" cy="23" r="14" fill="#F04452" stroke="#fff" strokeWidth="4"/><path d="M75 16v8" stroke="#fff" strokeWidth="3.5" strokeLinecap="round"/><circle cx="75" cy="28" r="1.8" fill="#fff"/></svg><i/><b/><em/></div>
        <h1 id="otp-title">Invalid or Expired OTP <span className="otp-heading-emoji" aria-hidden="true">🔐</span></h1>
        <p className="otp-description">The verification code is either incorrect<br className="otp-desktop"/> or has expired. Please try again.</p>
        <button className="otp-primary" type="button" onClick={() => navigate("/auth")}><svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M20 7v5h-5M4 17v-5h5"/><path d="M5.6 9a7 7 0 0 1 11.7-2L20 12M4 12l2.7 5a7 7 0 0 0 11.7-2"/></svg>Request a New Code</button>
        <button className="otp-secondary" type="button" onClick={() => navigate("/auth")}><svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M19 12H5m7-7-7 7 7 7"/></svg>Back to Login</button>
        <div className="otp-info"><span aria-hidden="true"><svg viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="1.8"/><path d="M12 7v5l3 2" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/></svg></span><p><strong>⏱️ Time-sensitive code</strong><br/>OTP codes are valid for a limited time (usually 5 minutes).</p></div>
      </section>
    </div>
  </main>;
}
