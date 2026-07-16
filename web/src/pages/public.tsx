import { Link, useLocation, useNavigate } from "react-router-dom";
import { Button, Eyebrow, Field, PublicHeader, Stepper } from "../components/ui";
import { publicMetrics } from "../mocks/referenceData";

type Stage = "licensing" | "submission" | "pending" | "proposal" | "payment" | "granted";

export function LandingPage() {
  return (
    <div className="public-shell">
      <PublicHeader />
      <main className="landing-page">
        <section className="hero-block">
          <Eyebrow>Philippine SMS Threat Intelligence Platform</Eyebrow>
          <h1>
            Campaign Intelligence
            <br />
            <span>for Philippine Smishing</span>
          </h1>
          <p>
            BantAI clusters coordinated smishing campaigns, tracks how
            scam tactics evolve, and delivers labeled threat intelligence to
            telecommunications and cybersecurity organizations.
          </p>
          <div className="hero-actions">
            <Link to="/request-access" className="primary-btn">Licensing -&gt;</Link>
            <a href="#" className="ghost-btn dark">Learn How It Works</a>
          </div>
          <small>
            Restricted to authorized telecommunications and cybersecurity organizations.
            Access is by invitation only.
          </small>
        </section>
      </main>
      <section className="metric-strip">
        {publicMetrics.map((metric) => (
          <article key={metric.label}>
            <strong>{metric.value}</strong>
            <span>{metric.label}</span>
          </article>
        ))}
      </section>
    </div>
  );
}

export function RequestAccessPage() {
  const location = useLocation();
  const navigate = useNavigate();
  const stage = (location.state?.stage as Stage | undefined) ?? "licensing";
  const setStage = (next: Stage) => navigate("/request-access", { state: { stage: next } });

  return (
    <div className="public-shell">
      <PublicHeader />
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
        <button className="primary-btn wide" type="button" onClick={() => navigate(admin ? "/admin/overview" : "/client/overview")}>Verify Code</button>
        <small>Didn't receive a code? <a href="#">Resend</a></small>
        <small>--- <Link to={admin ? "/admin-login" : "/login"}>Back to login</Link></small>
      </div>
    </div>
  );
}
