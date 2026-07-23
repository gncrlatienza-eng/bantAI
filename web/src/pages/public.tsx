import { Link, useLocation, useNavigate } from "react-router-dom";
import { MessageSquareWarning, KeyRound, Network } from "lucide-react";
import { Eyebrow, Field, Stepper } from "../components/ui";
import { Navbar } from "../components/Navbar";
import { Footer } from "../components/Footer";
import { Button } from "../components/Button";
import { SectionHeader } from "../components/SectionHeader";
import { StatCounter } from "../components/StatCounter";
import { ThreatCard } from "../components/ThreatCard";
import { StepCard } from "../components/StepCard";
import { PhoneMockup } from "../components/PhoneMockup";
import { useScrollReveal } from "../lib/useScrollReveal";
import { setSession } from "../lib/auth";

type Stage = "licensing" | "submission" | "pending" | "proposal" | "payment" | "granted";

const LANDING_STATS = [
  { value: "10,000+", label: "SMS Analyzed" },
  { value: "94%", label: "Classification Accuracy" },
  { value: "Filipino-trained", label: "Language Model" },
  { value: "3", label: "Languages Supported" },
];

export function LandingPage() {
  useScrollReveal();

  return (
    <div className="site-shell">
      <Navbar />

      <main className="hero-section">
        <div className="hero-radial" />
        <div className="hero-content">
          <span className="section-eyebrow reveal reveal-fade reveal-visible" style={{ marginBottom: 8 }}>
            Philippine SMS Threat Intelligence Platform
          </span>
          <h1 className="hero-heading reveal reveal-up reveal-visible">
            Campaign Intelligence for Philippine Smishing
          </h1>
          <p className="hero-subheading reveal reveal-up reveal-visible" style={{ transitionDelay: "80ms" }}>
            BantAI clusters coordinated smishing campaigns and tracks how scam tactics evolve across
            Tagalog, English, and Taglish messages. It delivers labeled, explainable threat intelligence
            to telecommunications and cybersecurity organizations nationwide.
          </p>
          <div className="hero-cta-row reveal reveal-up reveal-visible" style={{ transitionDelay: "150ms" }}>
            <Button to="/request-access" variant="primary">Get Started &rarr;</Button>
            <Button href="#how-it-works" variant="outline">Learn How It Works</Button>
          </div>
          <small className="hero-disclaimer reveal reveal-fade reveal-visible" style={{ transitionDelay: "220ms" }}>
            Restricted to authorized telecommunications and cybersecurity organizations. Access is by invitation only.
          </small>
        </div>
      </main>

      <section id="hero-visual" className="hero-visual-section">
        <div className="hero-phone-slot reveal reveal-scale" data-reveal>
          <PhoneMockup />
        </div>
      </section>

      <section id="stats" className="stats-bar">
        <div className="stats-bar-grid reveal-stagger" data-reveal>
          {LANDING_STATS.map((stat) => (
            <article key={stat.label}>
              <strong>
                <StatCounter value={stat.value} />
              </strong>
              <span>{stat.label}</span>
            </article>
          ))}
        </div>
      </section>

      <section id="how-it-works" className="section how-it-works-preview">
        <SectionHeader
          eyebrow="Detection Pipeline"
          title="How BantAI Detects Threats"
          subtitle="A three-stage pipeline turns a raw SMS into labeled, campaign-level threat intelligence in real time."
        />
        <div className="hiw-row reveal-stagger" data-reveal>
          <StepCard
            number="01"
            title="Intercept"
            description="BantAI runs as the default SMS app on-device, receiving every incoming message the moment it arrives."
            icon={<InterceptIcon />}
          />
          <div className="hiw-connector" aria-hidden="true" />
          <StepCard
            number="02"
            title="Classify"
            description="A fine-tuned XLM-RoBERTa model analyzes the message in Tagalog, English, or Taglish and scores the threat."
            icon={<ClassifyIcon />}
          />
          <div className="hiw-connector" aria-hidden="true" />
          <StepCard
            number="03"
            title="Cluster"
            description="HDBSCAN groups related threats into coordinated campaigns, tracking senders, domains, and tactics over time."
            icon={<ClusterIcon />}
          />
        </div>
        <div className="hiw-more reveal reveal-fade" data-reveal>
          <Link to="/how-it-works">See the full technical pipeline &rarr;</Link>
        </div>
      </section>

      <section className="section threat-section">
        <SectionHeader
          eyebrow="Threat Coverage"
          title="What BantAI Detects"
          subtitle="Three categories of SMS-based threats, continuously tracked across the Philippine mobile network."
        />
        <div className="threat-grid">
          <ThreatCard
            tone="red"
            icon={MessageSquareWarning}
            title="Smishing"
            description="Financial fraud impersonating GCash, BDO, Maya, and other Philippine banks and e-wallets to harvest credentials or trigger payments."
            badge="High Severity"
            reveal="reveal-left"
          />
          <ThreatCard
            tone="amber"
            icon={KeyRound}
            title="Credential Phishing"
            description="Fake login pages disguised as bank, telco, or government portals designed to capture usernames, passwords, and one-time codes."
            badge="Medium Severity"
            reveal="reveal-up"
          />
          <ThreatCard
            tone="blue"
            icon={Network}
            title="Campaign Attacks"
            description="Coordinated, multi-sender smishing operations that rotate numbers and domains to evade detection at scale."
            badge="Tracked"
            reveal="reveal-right"
          />
        </div>
      </section>

      <section className="section why-section">
        <div className="why-grid">
          <div className="why-copy reveal reveal-left" data-reveal>
            <span className="section-eyebrow">Why BantAI</span>
            <h2>Built for the Philippine threat landscape</h2>
            <ul className="why-list">
              <li>
                <strong>Multilingual by design</strong>
                <p>Trained on Tagalog, English, and Taglish smishing samples — not translated afterthoughts.</p>
              </li>
              <li>
                <strong>On-device classification</strong>
                <p>Messages are scored locally before anything is transmitted, minimizing exposure of message content.</p>
              </li>
              <li>
                <strong>SHAP explainability</strong>
                <p>Every alert shows exactly which words and phrases triggered the classification — no black box.</p>
              </li>
              <li>
                <strong>Campaign clustering</strong>
                <p>Individual reports are grouped into campaigns automatically, revealing coordinated attacks as they spread.</p>
              </li>
            </ul>
          </div>
          <div className="why-visual reveal reveal-right" data-reveal>
            <div className="analysis-card">
              <div className="analysis-card-head">
                <span>Sender</span>
                <strong>GCASH-OTP</strong>
              </div>
              <div className="analysis-confidence">
                <div className="analysis-confidence-top">
                  <span>Threat Confidence</span>
                  <strong className="tone-red">97%</strong>
                </div>
                <div className="rail"><span className="red" style={{ width: "97%" }} /></div>
              </div>
              <div className="analysis-indicators">
                <span className="section-label">Triggered Indicators</span>
                <div className="analysis-indicator-list">
                  <span className="badge red">"account suspended"</span>
                  <span className="badge red">"verify now"</span>
                  <span className="badge amber">shortened URL</span>
                  <span className="badge amber">urgency language</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="section cta-section">
        <div className="cta-radial" />
        <div className="cta-content reveal reveal-up" data-reveal>
          <h2>Protect Philippine Mobile Users</h2>
          <p>
            BantAI is licensed to verified telecommunications and cybersecurity organizations
            for real-time smishing campaign intelligence.
          </p>
          <Button to="/request-access" variant="primary" className="wide">Request Access</Button>
        </div>
      </section>

      <Footer />
    </div>
  );
}

function InterceptIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M4 6h16v12H4z" stroke="currentColor" strokeWidth="1.6" />
      <path d="M4 6l8 7 8-7" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function ClassifyIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <circle cx="12" cy="12" r="8" stroke="currentColor" strokeWidth="1.6" />
      <path d="M9 12l2 2 4-4" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function ClusterIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <circle cx="6" cy="7" r="2.4" stroke="currentColor" strokeWidth="1.6" />
      <circle cx="18" cy="7" r="2.4" stroke="currentColor" strokeWidth="1.6" />
      <circle cx="12" cy="18" r="2.4" stroke="currentColor" strokeWidth="1.6" />
      <path d="M8 8.5L11 16M16 8.5L13 16M8.5 7H15.5" stroke="currentColor" strokeWidth="1.4" />
    </svg>
  );
}

export function RequestAccessPage() {
  const location = useLocation();
  const navigate = useNavigate();
  const stage = (location.state?.stage as Stage | undefined) ?? "licensing";
  const setStage = (next: Stage) => navigate("/request-access", { state: { stage: next } });

  return (
    <div className="site-shell">
      <Navbar />
      <main className="flow-page">
        {stage === "licensing" ? <LicensingStage onNext={() => setStage("submission")} /> : null}
        {stage === "submission" ? <SubmissionStage onNext={() => setStage("pending")} /> : null}
        {stage === "pending" ? <PendingStage onNext={() => setStage("proposal")} /> : null}
        {stage === "proposal" ? <ProposalStage onNext={() => setStage("payment")} /> : null}
        {stage === "payment" ? <PaymentStage onNext={() => setStage("granted")} /> : null}
        {stage === "granted" ? <GrantedStage onNext={() => navigate("/client/overview")} /> : null}
      </main>
    </div>
  );
}

function LicensingStage({ onNext }: { onNext: () => void }) {
  return (
    <section className="license-stage intro">
      <Eyebrow>Verified Organization Access Only</Eyebrow>
      <h2>Intelligence Licensing</h2>
      <p>
        Premium data licensing for verified telecommunications and
        cybersecurity organizations.
      </p>
      <div className="license-grid">
        <article className="panel">
          <small className="section-label">WHO THIS IS FOR</small>
          <div className="license-cards">
            <div className="mini-panel">
              <span className="mini-icon" />
              <div>
                <strong>Telecommunications</strong>
                <small>e.g. Globe, Smart, DITO...</small>
              </div>
            </div>
            <div className="mini-panel">
              <span className="mini-icon" />
              <div>
                <strong>Cybersecurity</strong>
                <small>e.g. GIOC, NBI, IR teams...</small>
              </div>
            </div>
          </div>
        </article>
        <article className="panel">
          <small className="section-label">WHAT'S INCLUDED</small>
          <ul className="feature-list">
            <li>Campaign intelligence dashboard with live threat feed</li>
            <li>Classification log with confidence scores</li>
            <li>Campaign pattern &amp; evasion tactic breakdown</li>
            <li>Campaign timeline and cluster tracking</li>
            <li>Threat intelligence export (CSV)</li>
            <li>Daily &amp; weekly automated report notifications</li>
            <li>Analytics by campaign, tactic, and language</li>
            <li>Smishing variant tracking per campaign cluster</li>
          </ul>
          <div className="license-meta">
            <span>License Tiers</span>
            <strong>Contact Sales for Custom Quotes</strong>
          </div>
        </article>
      </div>
      <button className="primary-btn wide" type="button" onClick={onNext}>Request License -&gt;</button>
      <small>Access is not instant --- only verified organizations are approved.</small>
    </section>
  );
}

function SubmissionStage({ onNext }: { onNext: () => void }) {
  return (
    <section className="flow-stage">
      <Stepper active={1} />
      <div className="form-panel">
        <h2>Submit for Review</h2>
        <p>Fill out your organization details to begin the licensing process.</p>
        <div className="two-col">
          <Field label="Organization Name" value="Globe Telecom" />
          <Field label="Full Name" value="Maria Santos" />
        </div>
        <Field label="Work Email Address" value="analyst@globe.com.ph" />
        <div className="field">
          <span>Organization Type</span>
          <div className="choice-row">
            <button className="choice active" type="button">Telecommunications</button>
            <button className="choice" type="button">Cybersecurity</button>
          </div>
        </div>
        <Field
          label="Brief description of intended use"
          value="Monitor smishing campaigns targeting Globe subscribers for fraud prevention operations."
          area
        />
        <button className="primary-btn wide" type="button" onClick={onNext}>Submit for Review -&gt;</button>
      </div>
    </section>
  );
}

function PendingStage({ onNext }: { onNext: () => void }) {
  return (
    <section className="flow-stage">
      <Stepper active={2} completed={1} />
      <div className="status-panel">
        <div className="status-ring amber" />
        <small className="tone-amber status-overline">PENDING VERIFICATION</small>
        <h2>Submission Received</h2>
        <p>The BantAI team will verify your organization and respond within 3-5 business days.</p>
        <article className="panel narrow-card">
          <small className="section-label">AUTOMATED NOTIFICATIONS SENT</small>
          <div className="bullet-line">
            <span className="dot violet" />
            <div>
              <strong>Pending Verification email sent to you</strong>
              <small>analyst@globe.com.ph</small>
            </div>
          </div>
          <div className="bullet-line">
            <span className="dot amber" />
            <div>
              <strong>New license request alert sent to BantAI admin</strong>
              <small>Review queued in admin dashboard</small>
            </div>
          </div>
        </article>
        <div className="info-grid">
          <div><span>Organization</span><strong>Globe Telecom --- Telecommunications</strong></div>
          <div><span>Expected Response</span><strong>3-5 business days</strong></div>
        </div>
        <button className="primary-btn wide" type="button" onClick={onNext}>Admin Verifies Organization -&gt;</button>
      </div>
    </section>
  );
}

function ProposalStage({ onNext }: { onNext: () => void }) {
  return (
    <section className="flow-stage">
      <Stepper active={3} completed={2} />
      <div className="status-panel">
        <div className="status-ring green" />
        <small className="tone-green status-overline">ORGANIZATION VERIFIED</small>
        <h2>Awaiting Payment</h2>
        <p>Your Formal Licensing Proposal and Digital Invoice are ready for download.</p>
        <div className="doc-stack">
          <div className="doc-row">
            <div><strong>Formal Licensing Proposal</strong><small>PDF - Signed by BantAI Research Team</small></div>
            <button className="ghost-btn mini" type="button">Download</button>
          </div>
          <div className="doc-row">
            <div><strong>Digital Invoice</strong><small>PDF - INV-2026-0047 - Annual License</small></div>
            <button className="ghost-btn mini" type="button">Download</button>
          </div>
        </div>
        <button className="primary-btn wide" type="button" onClick={onNext}>Proceed to Payment -&gt;</button>
      </div>
    </section>
  );
}

function PaymentStage({ onNext }: { onNext: () => void }) {
  return (
    <section className="flow-stage">
      <Stepper active={4} completed={3} />
      <div className="form-panel">
        <h2>Complete Payment</h2>
        <p>Choose your preferred institutional payment method.</p>
        <div className="quote-row">
          <div>
            <strong>BantAI Intelligence License --- Annual</strong>
            <small>INV-2026-0047</small>
          </div>
          <strong className="tone-blue">Custom Quote</strong>
        </div>
        <div className="pay-card">
          <strong>Bank Transfer (Institutional)</strong>
          <small>Direct wire transfer --- recommended for government and large organizations</small>
          <div className="bank-box">
            <span>BDO Unibank, Inc.</span>
            <span>Account: BantAI Research Group 7</span>
            <span>Acc. No.: 1234 5678 9812</span>
            <span>Ref.: INV-2026-0047</span>
          </div>
        </div>
        <div className="pay-card collapsed">
          <strong>Corporate Credit Card</strong>
          <small>Secure enterprise payment gateway --- PCI-DSS compliant</small>
        </div>
        <button className="primary-btn wide" type="button" onClick={onNext}>Confirm Payment -&gt;</button>
      </div>
    </section>
  );
}

function GrantedStage({ onNext }: { onNext: () => void }) {
  return (
    <section className="flow-stage">
      <Stepper active={5} completed={4} />
      <div className="status-panel">
        <div className="status-ring green lock" />
        <small className="tone-green status-overline">LICENSE ACTIVATED</small>
        <h2>Access Granted</h2>
        <p>Payment confirmed. Your organization's portal access has been fully activated.</p>
        <article className="panel narrow-card">
          <small className="section-label">NOW UNLOCKED</small>
          <ul className="unlock-list">
            <li>Campaign intelligence dashboard</li>
            <li>Full classification log with confidence scores</li>
            <li>Threat intelligence dataset exports (CSV)</li>
            <li>Daily &amp; weekly automated report notifications</li>
          </ul>
        </article>
        <button className="primary-btn wide" type="button" onClick={onNext}>Go to Dashboard -&gt;</button>
      </div>
    </section>
  );
}

export function LoginPage({ admin }: { admin?: boolean }) {
  const navigate = useNavigate();
  return (
    <div className="auth-shell">
      <div className="auth-card">
        <div className="auth-top-mark">BantAI</div>
        <div className="auth-glyph" />
        <h1>BantAI</h1>
        <p>{admin ? "System Administration" : "Client Intelligence Portal"}</p>
        {admin ? <div className="warning-strip">Super Admin Access --- Authorized Personnel Only</div> : null}
        <div className="auth-form">
          {admin ? null : <Field label="Organization" value="Globe Telecom" />}
          <Field label={admin ? "Admin Email" : "Email address"} value={admin ? "admin@bantai.research" : "analyst@globe.com.ph"} />
          <Field label="Password" value="........" eye />
          <button className="primary-btn wide" type="button" onClick={() => navigate("/2fa", { state: { admin } })}>
            {admin ? "Sign In as Administrator" : "Sign In"}
          </button>
        </div>
        <small>{admin ? "This portal is restricted to the BantAI Research team only." : "Access is restricted to authorized organizations only."}</small>
        <div className="auth-link">
          {admin ? (
            <>Client organization? <Link to="/login">Sign In to the Client Portal ---&gt;</Link></>
          ) : (
            <>BantAI administrator? <Link to="/admin-login">Admin Portal ---&gt;</Link></>
          )}
        </div>
      </div>
    </div>
  );
}

export function TwoFactorPage() {
  const location = useLocation();
  const navigate = useNavigate();
  const admin = Boolean(location.state?.admin);
  return (
    <div className="auth-shell">
      <div className="auth-card narrow">
        <div className="auth-glyph lock" />
        <h1>Two-Factor Authentication</h1>
        <p>
          A 6-digit verification code was sent to:
          <br />
          <a href="#">{admin ? "g****@bantai.research" : "a****@globe.com.ph"}</a>
        </p>
        <div className="otp-row">
          {Array.from({ length: 6 }).map((_, index) => (
            <span key={index} className="otp-box" />
          ))}
        </div>
        <small>Code expires in <span className="tone-amber">04:47</span></small>
        <button
          className="primary-btn wide"
          type="button"
          onClick={() => {
            setSession(admin ? "admin" : "client");
            navigate(admin ? "/admin/overview" : "/client/overview");
          }}
        >
          Verify Code
        </button>
        <small>Didn't receive a code? <a href="#">Resend</a></small>
        <small>--- <Link to={admin ? "/admin-login" : "/login"}>Back to login</Link></small>
      </div>
    </div>
  );
}
