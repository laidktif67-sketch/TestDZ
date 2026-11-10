import { Link } from "react-router-dom";
import "../styles/legal-pages.css";

type LegalKind = "terms" | "privacy";

const content = {
  terms: {
    eyebrow: "LEGAL CENTER",
    title: "Terms of Service",
    subtitle: "The rules and conditions for using the TestDZ platform.",
    icon: "§",
    nav: ["Acceptance of terms", "Platform services", "Accounts and responsibilities", "Rewards and payments", "Changes and contact"],
    summary: "These terms explain the proposed framework for using TestDZ as a tester or developer.",
  },
  privacy: {
    eyebrow: "PRIVACY CENTER",
    title: "Privacy Policy",
    subtitle: "Understand how privacy information will be presented for TestDZ.",
    icon: "◈",
    nav: ["Information collected", "How information is used", "Storage and security", "Your choices", "Questions and contact"],
    summary: "This page is reserved for the approved explanation of TestDZ data practices.",
  },
} as const;

export default function LegalPage({ kind }: { kind: LegalKind }) {
  const page = content[kind];
  return (
    <main className="legal-page">
      <header className="legal-header">
        <Link to="/" className="legal-brand" aria-label="TestDZ home">
          <span className="legal-logo" aria-hidden="true"><svg viewBox="0 0 48 56" fill="none"><path d="M17 4h14v8l13 29a7 7 0 0 1-6.4 10H10.4A7 7 0 0 1 4 41L17 12V4Z" fill="url(#legal-flask)"/><path d="M17 4h14v8l13 29a7 7 0 0 1-6.4 10H10.4A7 7 0 0 1 4 41L17 12V4Z" stroke="#0C65F4" strokeWidth="2"/><path d="M12 35h24l5 9H7l5-9Z" fill="#42D5FF"/><defs><linearGradient id="legal-flask" x1="8" y1="5" x2="40" y2="50"><stop stopColor="#5DEBFF"/><stop offset="1" stopColor="#1647DF"/></linearGradient></defs></svg></span>
          <span><strong>TestDZ</strong><small>Test · Learn · Grow</small></span>
        </Link>
        <nav className="legal-header-links" aria-label="Legal navigation">
          <Link to="/">Home</Link>
          <Link to="/terms" aria-current={kind === "terms" ? "page" : undefined}>Terms</Link>
          <Link to="/privacy" aria-current={kind === "privacy" ? "page" : undefined}>Privacy</Link>
          <Link className="legal-back" to="/auth">Sign in <span aria-hidden="true">↗</span></Link>
        </nav>
      </header>

      <section className="legal-hero">
        <div className="legal-hero-copy">
          <span className="legal-eyebrow"><i />{page.eyebrow}</span>
          <h1>{page.title}</h1>
          <p>{page.subtitle}</p>
          <div className="legal-meta"><span className="legal-meta-icon">{page.icon}</span><span><strong>TestDZ · Policy document</strong><small>Draft layout · awaiting approved content</small></span></div>
        </div>
        <div className="legal-hero-art" aria-hidden="true">
          <div className="legal-orbit legal-orbit-a" /><div className="legal-orbit legal-orbit-b" />
          <div className="legal-doc"><span className="legal-doc-mark">{page.icon}</span><i /><i /><i /><i className="short" /><div className="legal-doc-check">✓</div></div>
          <span className="legal-float legal-float-top">Test · Learn · Grow</span><span className="legal-float legal-float-bottom">TESTDZ / {kind === "terms" ? "TERMS" : "PRIVACY"}</span>
        </div>
      </section>

      <div className="legal-content-wrap">
        <aside className="legal-toc">
          <span className="legal-toc-label">ON THIS PAGE</span>
          {page.nav.map((item, index) => <a key={item} href={`#section-${index + 1}`}><span>{String(index + 1).padStart(2, "0")}</span>{item}</a>)}
          <div className="legal-toc-help"><span>Need help?</span><p>Contact the TestDZ team for questions about this draft.</p><Link to="/help-support">Help &amp; support <span aria-hidden="true">↗</span></Link></div>
        </aside>
        <article className="legal-document">
          <div className="legal-draft-notice" role="status"><span className="legal-notice-icon">!</span><div><strong>Draft — content requires approval</strong><p>This page is not a finalized legal document. We have not filled in binding legal language or invented data-handling promises. The approved policy text must be added before launch.</p></div></div>
          <p className="legal-intro">{page.summary}</p>
          {page.nav.map((item, index) => <section className="legal-section" id={`section-${index + 1}`} key={item}><span className="legal-section-number">{String(index + 1).padStart(2, "0")}</span><div><h2>{item}</h2><p>Approved TestDZ wording for this section is pending review. This placeholder is shown intentionally and should be replaced before these pages are treated as final policy documents.</p></div></section>)}
          <div className="legal-switch"><span>{kind === "terms" ? "Looking for privacy details?" : "Looking for the service terms?"}</span><Link to={kind === "terms" ? "/privacy" : "/terms"}>{kind === "terms" ? "Read Privacy Policy" : "Read Terms of Service"} <span aria-hidden="true">→</span></Link></div>
        </article>
      </div>

      <footer className="legal-footer"><Link to="/" className="legal-footer-brand">TestDZ <span>Test · Learn · Grow</span></Link><span>© 2026 TestDZ. All rights reserved.</span><nav><Link to="/terms">Terms of Service</Link><Link to="/privacy">Privacy Policy</Link><Link to="/auth">Account</Link></nav></footer>
    </main>
  );
}
