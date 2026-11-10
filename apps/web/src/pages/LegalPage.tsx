import { Link } from "react-router-dom";
import "../styles/legal-pages.css";

type LegalKind = "terms" | "privacy";

type LegalSection = {
  title: string;
  paragraphs: string[];
  bullets?: string[];
};

const contentByKind: Record<LegalKind, {
  eyebrow: string;
  title: string;
  subtitle: string;
  icon: string;
  summary: string;
  sections: LegalSection[];
}> = {
  terms: {
    eyebrow: "LEGAL CENTER",
    title: "Terms of Service",
    subtitle: "The rules for using TestDZ to organize Android closed-testing activities.",
    icon: "§",
    summary: "TestDZ is being developed to help Android developers and testers coordinate test cycles, tester assignments, daily check-ins and feedback. These draft terms describe the product's current intended scope; they are not yet the final contract for a launched service.",
    sections: [
      {
        title: "Who these terms cover",
        paragraphs: [
          "These draft terms are intended for people who access TestDZ as testers, developers, or other authorized platform users. The platform is still in active development and is not documented as launch-ready.",
          "Before launch, TestDZ must publish the legal name of the service operator, its registered address, an official contact channel, and the governing law and dispute process. Those details have not been verified in the repository and are deliberately not invented here."
        ]
      },
      {
        title: "What TestDZ does",
        paragraphs: [
          "The current product design focuses on Android application closed-testing workflows: developer app records, testing cycles, cohorts, tester assignments, check-ins, feedback, and administrative review.",
          "TestDZ check-ins are records within TestDZ only. They do not prove continuous opt-in in Google Play Console, and TestDZ does not guarantee Google Play eligibility, approval, installs, a particular tester count, or a specific testing outcome."
        ]
      },
      {
        title: "Accounts and account security",
        paragraphs: [
          "You must provide information that is accurate to the best of your knowledge and keep your sign-in credentials confidential. Contact the service through its officially published support channel if you suspect unauthorized access.",
          "Authentication is implemented with Supabase Auth. Tester/developer roles are managed through the platform's authorization system; users must not attempt to obtain privileged roles or bypass access controls."
        ]
      },
      {
        title: "Developer and tester responsibilities",
        paragraphs: [
          "Developers should submit app details and materials they own or are authorized to use, keep test instructions accurate, and avoid uploading secrets or personal information that is not needed for a test.",
          "Testers should follow the applicable test instructions, make truthful check-ins, and submit relevant, honest feedback. A TestDZ check-in or internal feedback item must not be represented as a Google Play review or as proof of Play Console opt-in.",
          "Do not impersonate others, fabricate activity or feedback, interfere with tests, upload malicious or unlawful content, harass other users, or attempt to access data or functions without authorization."
        ]
      },
      {
        title: "Apps, submissions and uploaded content",
        paragraphs: [
          "The web client lets developers create app records with a name, Android package name, description, category and optional app icon. Users remain responsible for having the rights needed to submit the materials they provide.",
          "App icons and profile avatars use public storage buckets in the current database migrations. Do not upload confidential or sensitive material to those image fields. Report evidence is designed for restricted access by the report submitter, the developer responsible for the tested app, and administrators."
        ]
      },
      {
        title: "Points, credits, plans and payments",
        paragraphs: [
          "The product design separates earned points from purchased credits. Earned points are not a cash balance and are not designed to be purchased or cashed out; purchased credits are intended for eligible platform services.",
          "The repository states that payments, trials and referrals are disabled by default until their workflows are implemented and verified. Do not assume that a plan, payment, refund, subscription or reward feature is currently available just because it appears in product plans or database structures.",
          "If paid features are enabled in the future, the applicable price, limits, payment provider, cancellation and refund terms must be shown before the relevant transaction and documented in approved supplemental terms."
        ]
      },
      {
        title: "Safety, reports and platform changes",
        paragraphs: [
          "TestDZ's design includes reporting, dispute handling and administrative trust-and-safety review. Reports and technical signals may require human review; a signal alone should not be treated as conclusive proof of misconduct.",
          "Features, limits and workflows may change during development. No uptime, uninterrupted availability, or launch date is promised by this draft. The final terms must describe any applicable suspension, appeal, complaint and dispute procedures before public launch."
        ]
      },
      {
        title: "Legal operator and contact — required before launch",
        paragraphs: [
          "The repository does not establish a verified legal operator name, registered address, public privacy contact, retention schedule, or final governing-law clause. These are unresolved publication requirements, not details users should have to guess.",
          "This document is an implementation-informed draft, not legal advice or a finalized agreement. It must be reviewed and approved by the service operator and qualified counsel for the jurisdictions in which TestDZ will operate before it is used as binding terms."
        ]
      }
    ]
  },
  privacy: {
    eyebrow: "PRIVACY CENTER",
    title: "Privacy Policy",
    subtitle: "What the current TestDZ implementation handles, and what still needs confirmation.",
    icon: "◈",
    summary: "This draft is based on the repository's current web client, Supabase configuration and database migrations. It distinguishes implemented account and testing data from payment and other features that the project documentation says are not yet enabled.",
    sections: [
      {
        title: "Information you provide",
        paragraphs: [
          "When you register, the web client sends your email address and password to Supabase Auth. Registration also supplies a full name and an optional phone number as account metadata. The profile model supports a display name, phone, biography, locale, avatar image and selected interests.",
          "Developers may submit an app name, Android package name, description, category and app icon. Depending on the features used, TestDZ records may also include testing cycles, cohorts, assignments, check-ins, feedback, reports and report attachments."
        ]
      },
      {
        title: "Account and authentication information",
        paragraphs: [
          "Supabase Auth is the configured authentication service. The web client enables persistent sessions and automatic token refresh. Authentication credentials are handled by Supabase Auth; the application code does not need to read or display your password.",
          "The database stores profile attributes and backend-managed roles separately from the authentication identity. Role and verification fields are protected from ordinary profile edits."
        ]
      },
      {
        title: "Testing activity and submitted material",
        paragraphs: [
          "The database schema includes records for apps, tests, cohorts, assignments, check-ins, feedback, Google Play opt-in events, notifications, reports, disputes and administrative audit history. These records support coordinating tests, reviewing submitted feedback, operating the account and handling reports or disputes. Report-attachment metadata and the separate test-evidence storage rules appear in a migration explicitly marked staging-only; they must not be assumed active in the deployed database.",
          "Only provide content needed for the relevant test. Do not upload passwords, private keys, confidential business information or unrelated personal information into app descriptions, feedback or report attachments."
        ]
      },
      {
        title: "Images, storage and visibility",
        paragraphs: [
          "The current migrations configure profile avatars and app icons in public storage buckets. Files stored in those buckets may be accessible publicly; do not treat those image locations as private.",
          "A separate migration proposes a test-evidence bucket and report-attachment metadata with restricted access for the reporting tester, the developer responsible for the tested app, and administrators. That migration is explicitly marked staging-only and says not to apply it without separate approval, so this draft does not claim that private evidence storage is active in production. Do not assume that every uploaded file is private; visibility depends on the specific storage feature and deployed configuration."
        ]
      },
      {
        title: "How information is used",
        paragraphs: [
          "The documented purposes include creating and securing accounts, maintaining profiles and roles, organizing apps and testing cycles, recording check-ins and feedback, showing relevant platform activity, sending platform notifications, enforcing access rules, investigating reports, and maintaining administrative and financial audit records where those features are enabled.",
          "The repository's design includes device-related and fraud-review data domains, but the exact live collection of device identifiers, IP addresses, analytics, cookies and similar signals has not been fully verified from the reviewed client code. That inventory must be confirmed against the deployed backend and hosting configuration before publication."
        ]
      },
      {
        title: "Plans, credits and payment data",
        paragraphs: [
          "The database schema includes plans, subscriptions, payments, refunds, wallets and a points ledger. However, the README and architecture documentation say payments, trials and referrals are disabled by default until their workflows are implemented and verified.",
          "This draft therefore does not claim that TestDZ currently processes live payments or collects payment-card details. If paid features are activated, the operator must update this notice with the provider, data fields received, purposes, retention and refund handling before launch."
        ]
      },
      {
        title: "Service providers, location and security",
        paragraphs: [
          "The repository configures Supabase for authentication, database and storage. Project documentation specifies the Supabase region as eu-west-3 (Paris) and identifies Vercel as the intended web host. The live project settings and actual production hosting must be checked before these details are treated as a definitive statement about deployed processing locations.",
          "The implementation uses database access controls and row-level security for protected data, and restricts some privileged operations to server-side or administrative paths. No system can promise absolute security; the final policy should describe confirmed safeguards without making an unconditional guarantee."
        ]
      },
      {
        title: "Retention, access, correction and deletion",
        paragraphs: [
          "The profile screen currently shows a Close Account action that tells the user to contact TestDZ support, but the reviewed repository does not establish a public support contact or a complete, verified account-deletion workflow. The repository also does not establish a retention schedule. Some testing, financial, report and audit records may need different retention rules, but the applicable periods and legal grounds have not yet been approved.",
          "Before launch, TestDZ must publish a working contact channel and explain how users can request access to, correction of, or deletion of their information, how identity is verified for such requests, and which records may need to be retained under applicable law. This draft does not promise that a request can already be completed through the current UI."
        ]
      },
      {
        title: "Privacy contact and unresolved publication checks",
        paragraphs: [
          "No verified public privacy email address, registered operator address, or dedicated public privacy-request route was found in the reviewed repository. No contact details have been invented for this page.",
          "Before launch, the operator must confirm the deployed Supabase region and hosting providers; the actual device/IP, cookie and analytics inventory; retention and deletion behavior; data-subprocessor terms; applicable user rights; and the official contact details. This implementation-informed draft is not legal advice and must be reviewed and approved before publication as the final Privacy Policy."
        ]
      }
    ]
  }
};

export default function LegalPage({ kind }: { kind: LegalKind }) {
  const page = contentByKind[kind];
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
          <div className="legal-meta"><span className="legal-meta-icon">{page.icon}</span><span><strong>TestDZ · Implementation-informed draft</strong><small>Code reviewed · legal approval still required</small></span></div>
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
          {page.sections.map((section, index) => <a key={section.title} href={`#section-${index + 1}`}><span>{String(index + 1).padStart(2, "0")}</span>{section.title}</a>)}
          <div className="legal-toc-help"><span>Important</span><p>This is a working draft. Confirm the unresolved publication items before launch.</p><Link to="/">Back to TestDZ <span aria-hidden="true">↗</span></Link></div>
        </aside>
        <article className="legal-document">
          <div className="legal-draft-notice" role="status"><span className="legal-notice-icon">!</span><div><strong>Working draft — not yet approved for legal use</strong><p>The text below is based on the repository's current implementation and product documentation. Items that could not be verified, such as the legal operator, public contact, retention periods and some deployed settings, are identified rather than guessed. Obtain legal and operator approval before treating this page as binding or publishing it as final.</p></div></div>
          <p className="legal-intro">{page.summary}</p>
          {page.sections.map((section, index) => <section className="legal-section" id={`section-${index + 1}`} key={section.title}><span className="legal-section-number">{String(index + 1).padStart(2, "0")}</span><div><h2>{section.title}</h2>{section.paragraphs.map((paragraph, paragraphIndex) => <p key={paragraphIndex}>{paragraph}</p>)}{section.bullets && <ul>{section.bullets.map((bullet) => <li key={bullet}>{bullet}</li>)}</ul>}</div></section>)}
          <div className="legal-switch"><span>{kind === "terms" ? "Looking for privacy details?" : "Looking for the service terms?"}</span><Link to={kind === "terms" ? "/privacy" : "/terms"}>{kind === "terms" ? "Read Privacy Policy" : "Read Terms of Service"} <span aria-hidden="true">→</span></Link></div>
        </article>
      </div>

      <footer className="legal-footer"><Link to="/" className="legal-footer-brand">TestDZ <span>Test · Learn · Grow</span></Link><span>© 2026 TestDZ. All rights reserved.</span><nav><Link to="/terms">Terms of Service</Link><Link to="/privacy">Privacy Policy</Link><Link to="/auth">Account</Link></nav></footer>
    </main>
  );
}
