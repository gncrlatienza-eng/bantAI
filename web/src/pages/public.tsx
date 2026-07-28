import React from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { Button } from '../components/common/Button';
import { Stepper } from '../components/common/Stepper';
import { PublicHeader } from '../components/layout/PublicHeader';
import { Eyebrow, Field } from '../components/ui';
import { setSession } from '../lib/auth';

export { LandingPage } from './Landing';

type Stage = "licensing" | "submission" | "pending" | "proposal" | "payment" | "granted";

export function RequestAccessPage() {
  const location = useLocation();
  const navigate = useNavigate();
  const stage = (location.state?.stage as Stage | undefined) ?? "licensing";
  const setStage = (next: Stage) => navigate("/request-access", { state: { stage: next } });

  return (
    <div className="public-shell" style={{ height: '100vh', display: 'flex', flexDirection: 'column', background: '#0a0a0f', overflow: 'hidden' }}>
      <PublicHeader />
      <main className="flow-page" style={{ flex: 1, padding: '16px 20px', maxWidth: 900, margin: '0 auto', width: '100%', display: 'flex', flexDirection: 'column', justifyContent: 'center', boxSizing: 'border-box' }}>
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

// Stage 0: Intelligence Licensing Landing Stage
function LicensingStage({ onNext }: { onNext: () => void }) {
  const [selectedOrg, setSelectedOrg] = React.useState<'telecom' | 'cyber'>('telecom');

  return (
    <section className="animate-fade-in" style={{ textAlign: 'center', maxWidth: 860, margin: '0 auto' }}>
      {/* Top Pill Badge */}
      <div
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 8,
          padding: '4px 14px',
          borderRadius: 20,
          background: 'rgba(37, 99, 235, 0.12)',
          border: '1px solid rgba(59, 130, 246, 0.35)',
          color: '#60a5fa',
          fontSize: '0.75rem',
          fontWeight: 700,
          letterSpacing: '0.05em',
          textTransform: 'uppercase',
          marginBottom: 10,
        }}
      >
        <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#3b82f6' }} />
        Verified Organization Access Only
      </div>

      <h1 style={{ fontSize: '2.5rem', fontWeight: 800, color: '#ffffff', marginBottom: 6, letterSpacing: '-0.02em' }}>
        Intelligence Licensing
      </h1>
      <p style={{ fontSize: '1rem', color: 'var(--text-secondary)', maxWidth: 600, margin: '0 auto 24px auto' }}>
        Premium data licensing for verified telecommunications and cybersecurity organizations.
      </p>

      {/* Grid: Who this is for & What's included */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))', gap: 16, textAlign: 'left', marginBottom: 24 }}>
        {/* Card 1: Who this is for */}
        <div
          className="panel campaign-card-interactive"
          style={{
            background: 'var(--bg-surface-elevated)',
            border: '1px solid var(--border-default)',
            borderRadius: 14,
            padding: '20px 24px',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
          }}
        >
          <div>
            <small style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)', letterSpacing: '0.08em', textTransform: 'uppercase', display: 'block', marginBottom: 14 }}>
              WHO THIS IS FOR
            </small>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <div
                onClick={() => setSelectedOrg('telecom')}
                className="campaign-card-interactive"
                style={{
                  background: selectedOrg === 'telecom' ? 'rgba(37, 99, 235, 0.16)' : 'rgba(255, 255, 255, 0.03)',
                  border: `1px solid ${selectedOrg === 'telecom' ? '#3b82f6' : 'var(--border-default)'}`,
                  borderRadius: 10,
                  padding: '12px 16px',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 14,
                }}
              >
                <div style={{ width: 34, height: 34, borderRadius: 8, background: 'rgba(37, 99, 235, 0.25)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.125rem' }}>
                  📡
                </div>
                <div>
                  <strong style={{ fontSize: '0.9375rem', color: '#ffffff', display: 'block' }}>Telecommunications</strong>
                  <small style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>e.g. Globe, Smart, DITO...</small>
                </div>
              </div>

              <div
                onClick={() => setSelectedOrg('cyber')}
                className="campaign-card-interactive"
                style={{
                  background: selectedOrg === 'cyber' ? 'rgba(37, 99, 235, 0.16)' : 'rgba(255, 255, 255, 0.03)',
                  border: `1px solid ${selectedOrg === 'cyber' ? '#3b82f6' : 'var(--border-default)'}`,
                  borderRadius: 10,
                  padding: '12px 16px',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 14,
                }}
              >
                <div style={{ width: 34, height: 34, borderRadius: 8, background: 'rgba(59, 130, 246, 0.25)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.125rem' }}>
                  🛡️
                </div>
                <div>
                  <strong style={{ fontSize: '0.9375rem', color: '#ffffff', display: 'block' }}>Cybersecurity</strong>
                  <small style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>e.g. CICC, NBI, IR firms...</small>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Card 2: What's Included */}
        <div
          className="panel campaign-card-interactive"
          style={{
            background: 'var(--bg-surface-elevated)',
            border: '1px solid var(--border-default)',
            borderRadius: 14,
            padding: '20px 24px',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
          }}
        >
          <div>
            <small style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)', letterSpacing: '0.08em', textTransform: 'uppercase', display: 'block', marginBottom: 12 }}>
              WHAT'S INCLUDED
            </small>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {[
                'Campaign Intelligence dashboard with live threat feed',
                'Classification log with confidence scores',
                'Campaign pattern & evasion tactic breakdown',
                'Campaign timeline and cluster tracking',
                'Threat intelligence export (CSV)',
                'Daily & weekly automated report notifications',
                'Analytics by campaign, tactic, and language',
                'Smishing variant tracking per campaign cluster',
              ].map((item) => (
                <div key={item} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: '0.8125rem', color: 'var(--text-secondary)' }}>
                  <span style={{ color: '#3b82f6', fontWeight: 800 }}>✓</span>
                  <span>{item}</span>
                </div>
              ))}
            </div>
          </div>

          <div style={{ marginTop: 16, paddingTop: 12, borderTop: '1px solid var(--border-subtle)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>License Tiers</span>
            <strong style={{ fontSize: '0.8125rem', color: '#60a5fa', cursor: 'pointer' }}>Contact Sales for Custom Quotes</strong>
          </div>
        </div>
      </div>

      <Button
        onClick={onNext}
        variant="primary"
        size="lg"
        style={{
          width: '100%',
          maxWidth: 380,
          padding: '12px 28px',
          fontSize: '1rem',
          borderRadius: 10,
          background: 'linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%)',
          boxShadow: '0 8px 24px rgba(37, 99, 235, 0.4)',
        }}
      >
        Request License →
      </Button>
      <small style={{ display: 'block', color: 'var(--text-muted)', fontSize: '0.75rem', marginTop: 8 }}>
        Access is not instant — only verified organizations are approved.
      </small>
    </section>
  );
}

// Stage 1: Submit for Review (Removed step text, Improved Input Box UI, Blue Theme)
function SubmissionStage({ onNext }: { onNext: () => void }) {
  const [orgName, setOrgName] = React.useState('Globe Telecom');
  const [fullName, setFullName] = React.useState('Maria Santos');
  const [email, setEmail] = React.useState('analyst@globe.com.ph');
  const [orgType, setOrgType] = React.useState<'Telecommunications' | 'Cybersecurity'>('Telecommunications');
  const [description, setDescription] = React.useState('Monitor smishing campaigns targeting Globe subscribers for fraud prevention operations.');
  
  const [focusedField, setFocusedField] = React.useState<string | null>(null);
  const [touched, setTouched] = React.useState<Record<string, boolean>>({});

  const isEmailValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  const isOrgNameValid = orgName.trim().length >= 2;
  const isFullNameValid = fullName.trim().length >= 2;
  const isDescValid = description.trim().length >= 10;

  const isValid = isOrgNameValid && isFullNameValid && isEmailValid && isDescValid;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (isValid) {
      onNext();
    }
  };

  const getInputStyle = (fieldName: string, hasError: boolean) => ({
    width: '100%',
    padding: '10px 14px',
    background: 'rgba(255, 255, 255, 0.05)',
    border: `1px solid ${hasError ? '#ef4444' : focusedField === fieldName ? '#3b82f6' : 'rgba(255, 255, 255, 0.15)'}`,
    borderRadius: 10,
    color: '#ffffff',
    fontSize: '0.875rem',
    outline: 'none',
    boxShadow: focusedField === fieldName ? '0 0 14px rgba(59, 130, 246, 0.35)' : 'none',
    transition: 'all 0.2s ease',
  });

  return (
    <section className="animate-fade-in" style={{ maxWidth: 640, margin: '0 auto' }}>
      <Stepper activeStep={1} />

      <div
        className="panel"
        style={{
          background: 'linear-gradient(180deg, rgba(20, 20, 32, 0.95) 0%, rgba(12, 12, 18, 0.98) 100%)',
          border: '1px solid var(--border-default)',
          borderTop: '3px solid #2563eb',
          borderRadius: 16,
          padding: '24px 32px',
          boxShadow: '0 16px 40px rgba(0, 0, 0, 0.6), 0 0 25px rgba(37, 99, 235, 0.15)',
        }}
      >
        {/* Title without Step 1 text */}
        <h2 style={{ fontSize: '1.75rem', fontWeight: 800, color: '#ffffff', marginBottom: 4, letterSpacing: '-0.02em' }}>
          Submit for Review
        </h2>
        <p style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', marginBottom: 20 }}>
          Fill out your organization details to begin the licensing process.
        </p>

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          {/* Row 1: Org Name & Full Name */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
            <div>
              <label style={{ display: 'block', fontSize: '0.8125rem', color: 'var(--text-secondary)', fontWeight: 600, marginBottom: 4 }}>
                Organization Name *
              </label>
              <input
                type="text"
                value={orgName}
                onChange={(e) => setOrgName(e.target.value)}
                onFocus={() => setFocusedField('orgName')}
                onBlur={() => {
                  setFocusedField(null);
                  setTouched({ ...touched, orgName: true });
                }}
                style={getInputStyle('orgName', Boolean(touched.orgName && !isOrgNameValid))}
                placeholder="e.g. Globe Telecom"
              />
              {touched.orgName && !isOrgNameValid && (
                <small style={{ color: '#ef4444', fontSize: '0.75rem', marginTop: 2, display: 'block' }}>Required</small>
              )}
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '0.8125rem', color: 'var(--text-secondary)', fontWeight: 600, marginBottom: 4 }}>
                Full Name *
              </label>
              <input
                type="text"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                onFocus={() => setFocusedField('fullName')}
                onBlur={() => {
                  setFocusedField(null);
                  setTouched({ ...touched, fullName: true });
                }}
                style={getInputStyle('fullName', Boolean(touched.fullName && !isFullNameValid))}
                placeholder="e.g. Maria Santos"
              />
              {touched.fullName && !isFullNameValid && (
                <small style={{ color: '#ef4444', fontSize: '0.75rem', marginTop: 2, display: 'block' }}>Required (min 2 chars)</small>
              )}
            </div>
          </div>

          {/* Work Email Address */}
          <div>
            <label style={{ display: 'block', fontSize: '0.8125rem', color: 'var(--text-secondary)', fontWeight: 600, marginBottom: 4 }}>
              Work Email Address *
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              onFocus={() => setFocusedField('email')}
              onBlur={() => {
                setFocusedField(null);
                setTouched({ ...touched, email: true });
              }}
              style={getInputStyle('email', Boolean(touched.email && !isEmailValid))}
              placeholder="analyst@organization.com"
            />
            {touched.email && !isEmailValid && (
              <small style={{ color: '#ef4444', fontSize: '0.75rem', marginTop: 2, display: 'block' }}>Please enter a valid work email address</small>
            )}
          </div>

          {/* Organization Type Choice Cards */}
          <div>
            <label style={{ display: 'block', fontSize: '0.8125rem', color: 'var(--text-secondary)', fontWeight: 600, marginBottom: 6 }}>
              Organization Type *
            </label>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <div
                onClick={() => setOrgType('Telecommunications')}
                className="campaign-card-interactive"
                style={{
                  padding: '12px 14px',
                  borderRadius: 10,
                  background: orgType === 'Telecommunications' ? 'rgba(37, 99, 235, 0.18)' : 'rgba(255, 255, 255, 0.03)',
                  border: `1px solid ${orgType === 'Telecommunications' ? '#3b82f6' : 'rgba(255, 255, 255, 0.12)'}`,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 10,
                }}
              >
                <div style={{ width: 30, height: 30, borderRadius: 6, background: 'rgba(37, 99, 235, 0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1rem' }}>
                  📡
                </div>
                <div>
                  <strong style={{ fontSize: '0.8125rem', color: '#ffffff', display: 'block' }}>Telecommunications</strong>
                  <small style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Globe, Smart, DITO...</small>
                </div>
              </div>

              <div
                onClick={() => setOrgType('Cybersecurity')}
                className="campaign-card-interactive"
                style={{
                  padding: '12px 14px',
                  borderRadius: 10,
                  background: orgType === 'Cybersecurity' ? 'rgba(37, 99, 235, 0.18)' : 'rgba(255, 255, 255, 0.03)',
                  border: `1px solid ${orgType === 'Cybersecurity' ? '#3b82f6' : 'rgba(255, 255, 255, 0.12)'}`,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 10,
                }}
              >
                <div style={{ width: 30, height: 30, borderRadius: 6, background: 'rgba(59, 130, 246, 0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1rem' }}>
                  🛡️
                </div>
                <div>
                  <strong style={{ fontSize: '0.8125rem', color: '#ffffff', display: 'block' }}>Cybersecurity</strong>
                  <small style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>CICC, NBI, IR teams...</small>
                </div>
              </div>
            </div>
          </div>

          {/* Intended Use Description */}
          <div>
            <label style={{ display: 'block', fontSize: '0.8125rem', color: 'var(--text-secondary)', fontWeight: 600, marginBottom: 4 }}>
              Brief description of intended use *
            </label>
            <textarea
              rows={2}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              onFocus={() => setFocusedField('description')}
              onBlur={() => {
                setFocusedField(null);
                setTouched({ ...touched, description: true });
              }}
              style={{
                ...getInputStyle('description', Boolean(touched.description && !isDescValid)),
                resize: 'none',
              }}
              placeholder="Explain how your team plans to use BantAI smishing intelligence feeds..."
            />
            {touched.description && !isDescValid && (
              <small style={{ color: '#ef4444', fontSize: '0.75rem', marginTop: 2, display: 'block' }}>Description must be at least 10 characters long</small>
            )}
          </div>

          {/* Live Validation Status Pill */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '0.75rem', color: isValid ? '#10b981' : '#f59e0b', fontWeight: 600 }}>
              {isValid ? '🟢 Form status: Ready for review' : '⚠️ Please complete all required fields'}
            </span>
          </div>

          {/* Submit Button */}
          <Button
            type="submit"
            disabled={!isValid}
            variant="primary"
            size="lg"
            style={{
              width: '100%',
              padding: '12px 24px',
              fontSize: '1rem',
              borderRadius: 10,
              background: isValid ? 'linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%)' : undefined,
              boxShadow: isValid ? '0 8px 20px rgba(37, 99, 235, 0.4)' : undefined,
              opacity: isValid ? 1 : 0.45,
              cursor: isValid ? 'pointer' : 'not-allowed',
            }}
          >
            Submit for Review →
          </Button>
        </form>
      </div>
    </section>
  );
}

// Stage 2: Submission Received (Pending Verification - Compact No Scroll)
function PendingStage({ onNext }: { onNext: () => void }) {
  return (
    <section className="animate-fade-in" style={{ maxWidth: 640, margin: '0 auto', textAlign: 'center' }}>
      <Stepper activeStep={2} completedSteps={1} />

      <div
        className="panel"
        style={{
          background: 'linear-gradient(180deg, rgba(20, 20, 32, 0.95) 0%, rgba(12, 12, 18, 0.98) 100%)',
          border: '1px solid var(--border-default)',
          borderTop: '3px solid #f59e0b',
          borderRadius: 16,
          padding: '28px 32px',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          boxShadow: '0 16px 40px rgba(0, 0, 0, 0.6), 0 0 25px rgba(245, 158, 11, 0.15)',
        }}
      >
        {/* Pulsing Status Circle Icon */}
        <div
          style={{
            width: 52,
            height: 52,
            borderRadius: '50%',
            background: 'rgba(245, 158, 11, 0.15)',
            border: '2px solid rgba(245, 158, 11, 0.5)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '1.5rem',
            marginBottom: 12,
            boxShadow: '0 0 25px rgba(245, 158, 11, 0.35)',
          }}
        >
          ⏳
        </div>

        <small style={{ fontSize: '0.75rem', fontWeight: 800, color: '#f59e0b', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 4 }}>
          PENDING VERIFICATION
        </small>
        <h2 style={{ fontSize: '1.875rem', fontWeight: 800, color: '#ffffff', marginBottom: 6, letterSpacing: '-0.02em' }}>Submission Received</h2>
        <p style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', maxWidth: 480, margin: '0 auto 20px auto', lineHeight: 1.5 }}>
          The BantAI Research Team will verify your organization credentials and respond within 3–5 business days.
        </p>

        {/* Automated Notifications Stack */}
        <div
          style={{
            width: '100%',
            background: 'rgba(255, 255, 255, 0.03)',
            border: '1px solid var(--border-default)',
            borderRadius: 12,
            padding: '16px 20px',
            textAlign: 'left',
            marginBottom: 18,
          }}
        >
          <small style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)', letterSpacing: '0.08em', textTransform: 'uppercase', display: 'block', marginBottom: 12 }}>
            AUTOMATED NOTIFICATIONS DISPATCHED
          </small>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <div className="campaign-card-interactive" style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 14px', background: 'rgba(37, 99, 235, 0.1)', borderRadius: 8, border: '1px solid rgba(59, 130, 246, 0.25)' }}>
              <div style={{ width: 28, height: 28, borderRadius: 6, background: 'rgba(59, 130, 246, 0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.875rem' }}>
                ✉️
              </div>
              <div>
                <strong style={{ fontSize: '0.8125rem', color: '#ffffff', display: 'block' }}>Pending Verification email sent to you</strong>
                <small style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>analyst@globe.com.ph</small>
              </div>
            </div>

            <div className="campaign-card-interactive" style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 14px', background: 'rgba(245, 158, 11, 0.1)', borderRadius: 8, border: '1px solid rgba(245, 158, 11, 0.25)' }}>
              <div style={{ width: 28, height: 28, borderRadius: 6, background: 'rgba(245, 158, 11, 0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.875rem' }}>
                🔔
              </div>
              <div>
                <strong style={{ fontSize: '0.8125rem', color: '#ffffff', display: 'block' }}>New license request alert sent to BantAI admin</strong>
                <small style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Review queued in BantAI Security Command</small>
              </div>
            </div>
          </div>
        </div>

        {/* Verification Summary KPI Cards */}
        <div
          style={{
            width: '100%',
            display: 'grid',
            gridTemplateColumns: 'repeat(3, 1fr)',
            gap: 10,
            marginBottom: 24,
            textAlign: 'left',
          }}
        >
          <div style={{ padding: '12px 14px', background: 'rgba(255, 255, 255, 0.03)', borderRadius: 8, border: '1px solid var(--border-subtle)' }}>
            <span style={{ color: 'var(--text-muted)', fontSize: '0.75rem', display: 'block' }}>Organization</span>
            <strong style={{ color: '#ffffff', fontSize: '0.8125rem', fontWeight: 700, marginTop: 2, display: 'block' }}>Globe Telecom</strong>
          </div>
          <div style={{ padding: '12px 14px', background: 'rgba(255, 255, 255, 0.03)', borderRadius: 8, border: '1px solid var(--border-subtle)' }}>
            <span style={{ color: 'var(--text-muted)', fontSize: '0.75rem', display: 'block' }}>Sector</span>
            <strong style={{ color: '#60a5fa', fontSize: '0.8125rem', fontWeight: 700, marginTop: 2, display: 'block' }}>Telecom</strong>
          </div>
          <div style={{ padding: '12px 14px', background: 'rgba(255, 255, 255, 0.03)', borderRadius: 8, border: '1px solid var(--border-subtle)' }}>
            <span style={{ color: 'var(--text-muted)', fontSize: '0.75rem', display: 'block' }}>Review SLA</span>
            <strong style={{ color: '#f59e0b', fontSize: '0.8125rem', fontWeight: 700, marginTop: 2, display: 'block' }}>3–5 Days SLA</strong>
          </div>
        </div>

        <Button
          onClick={onNext}
          variant="primary"
          size="lg"
          style={{
            width: '100%',
            padding: '14px 24px',
            fontSize: '1rem',
            borderRadius: 10,
            background: 'linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%)',
            boxShadow: '0 8px 20px rgba(37, 99, 235, 0.4)',
          }}
        >
          Admin Verifies Organization →
        </Button>
      </div>
    </section>
  );
}

// Stage 3: Awaiting Payment & Proposal Download (Vibrant Glowing Buttons - No Overlap)
function ProposalStage({ onNext }: { onNext: () => void }) {
  const [toastMsg, setToastMsg] = React.useState<string | null>(null);

  const handleDownload = (filename: string) => {
    setToastMsg(`Downloading ${filename}...`);
    setTimeout(() => setToastMsg(null), 3000);
  };

  return (
    <section className="animate-fade-in" style={{ maxWidth: 680, margin: '0 auto', textAlign: 'center' }}>
      <Stepper activeStep={3} completedSteps={2} />

      {/* Toast Feedback Notification */}
      {toastMsg && (
        <div
          style={{
            position: 'fixed',
            bottom: 24,
            right: 24,
            background: '#10b981',
            color: '#ffffff',
            padding: '12px 20px',
            borderRadius: 10,
            fontWeight: 700,
            fontSize: '0.875rem',
            boxShadow: '0 10px 25px rgba(16, 185, 129, 0.4)',
            zIndex: 9999,
            display: 'flex',
            alignItems: 'center',
            gap: 8,
          }}
        >
          <span>✓</span> {toastMsg}
        </div>
      )}

      <div
        className="panel"
        style={{
          background: 'linear-gradient(180deg, rgba(20, 20, 32, 0.95) 0%, rgba(12, 12, 18, 0.98) 100%)',
          border: '1px solid var(--border-default)',
          borderTop: '3px solid #10b981',
          borderRadius: 16,
          padding: '28px 32px',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          boxShadow: '0 16px 40px rgba(0, 0, 0, 0.6), 0 0 25px rgba(16, 185, 129, 0.15)',
        }}
      >
        {/* Pulsing Status Circle Icon */}
        <div
          style={{
            width: 52,
            height: 52,
            borderRadius: '50%',
            background: 'rgba(16, 185, 129, 0.15)',
            border: '2px solid rgba(16, 185, 129, 0.5)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '1.5rem',
            marginBottom: 12,
            boxShadow: '0 0 25px rgba(16, 185, 129, 0.35)',
          }}
        >
          ✓
        </div>

        <small style={{ fontSize: '0.75rem', fontWeight: 800, color: '#10b981', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 4 }}>
          ORGANIZATION VERIFIED
        </small>
        <h2 style={{ fontSize: '1.875rem', fontWeight: 800, color: '#ffffff', marginBottom: 6, letterSpacing: '-0.02em' }}>Awaiting Payment</h2>
        <p style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', maxWidth: 500, margin: '0 auto 24px auto', lineHeight: 1.5 }}>
          Your Formal Licensing Proposal and Digital Invoice are approved and ready for download.
        </p>

        {/* Download Document Cards Stack with Zero Overlap Layout */}
        <div style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: 14, marginBottom: 24 }}>
          {/* Card 1 */}
          <div
            className="campaign-card-interactive"
            style={{
              background: 'rgba(255, 255, 255, 0.03)',
              border: '1px solid var(--border-default)',
              borderRadius: 12,
              padding: '16px 20px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              textAlign: 'left',
              gap: 16,
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 14, flex: 1, minWidth: 0 }}>
              <div style={{ width: 40, height: 40, borderRadius: 8, background: 'rgba(37, 99, 235, 0.2)', border: '1px solid rgba(59, 130, 246, 0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.125rem', flexShrink: 0 }}>
                📄
              </div>
              <div style={{ minWidth: 0 }}>
                <strong style={{ fontSize: '0.9375rem', color: '#ffffff', display: 'block', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  Formal Licensing Proposal
                </strong>
                <small style={{ fontSize: '0.75rem', color: 'var(--text-muted)', display: 'block', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  PDF (3.4 MB) • Signed by BantAI Research Team ✓
                </small>
              </div>
            </div>

            <button
              type="button"
              onClick={() => handleDownload('Formal_Licensing_Proposal_BantAI.pdf')}
              className="campaign-card-interactive"
              style={{
                padding: '9px 16px',
                fontSize: '0.8125rem',
                fontWeight: 700,
                borderRadius: 8,
                background: 'linear-gradient(135deg, rgba(37, 99, 235, 0.35) 0%, rgba(59, 130, 246, 0.25) 100%)',
                border: '1px solid #3b82f6',
                color: '#ffffff',
                boxShadow: '0 4px 15px rgba(37, 99, 235, 0.3)',
                cursor: 'pointer',
                whiteSpace: 'nowrap',
                flexShrink: 0,
              }}
            >
              ↓ Download Proposal
            </button>
          </div>

          {/* Card 2 */}
          <div
            className="campaign-card-interactive"
            style={{
              background: 'rgba(255, 255, 255, 0.03)',
              border: '1px solid var(--border-default)',
              borderRadius: 12,
              padding: '16px 20px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              textAlign: 'left',
              gap: 16,
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 14, flex: 1, minWidth: 0 }}>
              <div style={{ width: 40, height: 40, borderRadius: 8, background: 'rgba(16, 185, 129, 0.2)', border: '1px solid rgba(16, 185, 129, 0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.125rem', flexShrink: 0 }}>
                💳
              </div>
              <div style={{ minWidth: 0 }}>
                <strong style={{ fontSize: '0.9375rem', color: '#ffffff', display: 'block', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  Digital Invoice
                </strong>
                <small style={{ fontSize: '0.75rem', color: 'var(--text-muted)', display: 'block', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  PDF (1.2 MB) • INV-2026-0047 • Annual License
                </small>
              </div>
            </div>

            <button
              type="button"
              onClick={() => handleDownload('Digital_Invoice_INV-2026-0047.pdf')}
              className="campaign-card-interactive"
              style={{
                padding: '9px 16px',
                fontSize: '0.8125rem',
                fontWeight: 700,
                borderRadius: 8,
                background: 'linear-gradient(135deg, rgba(16, 185, 129, 0.35) 0%, rgba(52, 211, 153, 0.25) 100%)',
                border: '1px solid #10b981',
                color: '#ffffff',
                boxShadow: '0 4px 15px rgba(16, 185, 129, 0.3)',
                cursor: 'pointer',
                whiteSpace: 'nowrap',
                flexShrink: 0,
              }}
            >
              ↓ Download Invoice
            </button>
          </div>
        </div>

        <Button
          onClick={onNext}
          variant="primary"
          size="lg"
          style={{
            width: '100%',
            padding: '14px 24px',
            fontSize: '1rem',
            borderRadius: 10,
            background: 'linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%)',
            boxShadow: '0 8px 20px rgba(37, 99, 235, 0.4)',
          }}
        >
          Proceed to Payment →
        </Button>
      </div>
    </section>
  );
}

// Stage 4: Complete Payment (No Scrollbar)
function PaymentStage({ onNext }: { onNext: () => void }) {
  const [payMethod, setPayMethod] = React.useState<'bank' | 'card'>('bank');

  return (
    <section className="animate-fade-in" style={{ maxWidth: 640, margin: '0 auto' }}>
      <Stepper activeStep={4} completedSteps={3} />

      <div
        className="panel"
        style={{
          background: 'linear-gradient(180deg, rgba(20, 20, 32, 0.95) 0%, rgba(12, 12, 18, 0.98) 100%)',
          border: '1px solid var(--border-default)',
          borderTop: '3px solid #60a5fa',
          borderRadius: 16,
          padding: '28px 32px',
          boxShadow: '0 16px 40px rgba(0, 0, 0, 0.6), 0 0 25px rgba(96, 165, 250, 0.15)',
        }}
      >
        <h2 style={{ fontSize: '1.75rem', fontWeight: 800, color: '#ffffff', marginBottom: 4, letterSpacing: '-0.02em' }}>Complete Payment</h2>
        <p style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', marginBottom: 20 }}>
          Choose your preferred institutional payment method to activate access.
        </p>

        {/* Invoice Header Box */}
        <div
          style={{
            padding: '14px 18px',
            background: 'rgba(255, 255, 255, 0.03)',
            border: '1px solid var(--border-default)',
            borderRadius: 12,
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: 18,
          }}
        >
          <div>
            <strong style={{ fontSize: '0.9375rem', color: '#ffffff', display: 'block' }}>BantAI Intelligence License — Annual</strong>
            <small style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>INV-2026-0047 — Enterprise Subscription</small>
          </div>
          <strong style={{ fontSize: '1rem', color: '#60a5fa', fontFamily: 'var(--font-mono)', fontWeight: 800 }}>Custom Quote</strong>
        </div>

        {/* Payment Options Stack */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 24 }}>
          {/* Method 1: Bank Transfer */}
          <div
            onClick={() => setPayMethod('bank')}
            className="campaign-card-interactive"
            style={{
              background: payMethod === 'bank' ? 'rgba(37, 99, 235, 0.16)' : 'rgba(255, 255, 255, 0.03)',
              border: `1px solid ${payMethod === 'bank' ? '#3b82f6' : 'var(--border-default)'}`,
              borderRadius: 12,
              padding: '16px 18px',
              cursor: 'pointer',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 4 }}>
              <div style={{ width: 34, height: 34, borderRadius: 8, background: 'rgba(37, 99, 235, 0.25)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.125rem' }}>
                🏛️
              </div>
              <div>
                <strong style={{ fontSize: '0.875rem', color: '#ffffff', display: 'block' }}>Bank Transfer (Institutional)</strong>
                <small style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Direct wire transfer — recommended for government &amp; enterprise</small>
              </div>
            </div>

            {payMethod === 'bank' && (
              <div
                style={{
                  marginTop: 12,
                  padding: '12px 16px',
                  background: 'rgba(0, 0, 0, 0.4)',
                  borderRadius: 10,
                  fontFamily: 'var(--font-mono)',
                  fontSize: '0.8125rem',
                  color: 'var(--text-secondary)',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 4,
                  border: '1px solid var(--border-subtle)',
                }}
              >
                <span style={{ color: '#ffffff', fontWeight: 700 }}>Bank: BDO Unibank, Inc.</span>
                <span>Account Name: BantAI Research Group 7</span>
                <span>Account Number: 1234 5678 9012</span>
                <span style={{ color: '#60a5fa', fontWeight: 700 }}>Ref Code: INV-2026-0047</span>
              </div>
            )}
          </div>

          {/* Method 2: Credit Card */}
          <div
            onClick={() => setPayMethod('card')}
            className="campaign-card-interactive"
            style={{
              background: payMethod === 'card' ? 'rgba(37, 99, 235, 0.16)' : 'rgba(255, 255, 255, 0.03)',
              border: `1px solid ${payMethod === 'card' ? '#3b82f6' : 'var(--border-default)'}`,
              borderRadius: 12,
              padding: '16px 18px',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: 12,
            }}
          >
            <div style={{ width: 34, height: 34, borderRadius: 8, background: 'rgba(59, 130, 246, 0.25)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.125rem' }}>
              💳
            </div>
            <div>
              <strong style={{ fontSize: '0.875rem', color: '#ffffff', display: 'block' }}>Corporate Credit Card</strong>
              <small style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Secure enterprise gateway — 256-bit SSL PCI-DSS compliant</small>
            </div>
          </div>
        </div>

        <Button
          onClick={onNext}
          variant="primary"
          size="lg"
          style={{
            width: '100%',
            padding: '14px 24px',
            fontSize: '1rem',
            borderRadius: 10,
            background: 'linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%)',
            boxShadow: '0 8px 20px rgba(37, 99, 235, 0.4)',
          }}
        >
          Confirm Payment →
        </Button>
      </div>
    </section>
  );
}

// Stage 5: GrantedStage (Vibrant Energetic Green/Purple Gradient Button - No Scroll)
function GrantedStage({ onNext }: { onNext: () => void }) {
  return (
    <section className="animate-fade-in" style={{ maxWidth: 640, margin: '0 auto', textAlign: 'center' }}>
      <Stepper activeStep={5} completedSteps={5} />

      <div
        className="panel"
        style={{
          background: 'linear-gradient(180deg, rgba(20, 20, 32, 0.95) 0%, rgba(12, 12, 18, 0.98) 100%)',
          border: '1px solid var(--border-default)',
          borderTop: '3px solid #10b981',
          borderRadius: 16,
          padding: '32px 32px',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          boxShadow: '0 16px 40px rgba(0, 0, 0, 0.6), 0 0 30px rgba(16, 185, 129, 0.2)',
        }}
      >
        {/* Rewarding Success Icon Ring */}
        <div
          style={{
            width: 56,
            height: 56,
            borderRadius: '50%',
            background: 'rgba(16, 185, 129, 0.15)',
            border: '2px solid #10b981',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '1.75rem',
            marginBottom: 12,
            boxShadow: '0 0 30px rgba(16, 185, 129, 0.45)',
          }}
        >
          🎉
        </div>

        <small style={{ fontSize: '0.75rem', fontWeight: 800, color: '#10b981', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 4 }}>
          ACCESS GRANTED
        </small>
        <h2 style={{ fontSize: '2rem', fontWeight: 800, color: '#ffffff', marginBottom: 6, letterSpacing: '-0.02em' }}>Enterprise Access Activated</h2>
        <p style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', maxWidth: 480, margin: '0 auto 20px auto' }}>
          Payment confirmed. Your organization's portal access has been fully activated.
        </p>

        {/* Unlocked Features Checklist Card */}
        <div
          style={{
            width: '100%',
            background: 'rgba(16, 185, 129, 0.06)',
            border: '1px solid rgba(16, 185, 129, 0.3)',
            borderRadius: 12,
            padding: '16px 20px',
            textAlign: 'left',
            marginBottom: 24,
          }}
        >
          <small style={{ fontSize: '0.75rem', fontWeight: 800, color: '#10b981', letterSpacing: '0.08em', textTransform: 'uppercase', display: 'block', marginBottom: 10 }}>
            NOW UNLOCKED FOR YOUR ORGANIZATION
          </small>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {[
              'Campaign Intelligence Dashboard with live feeds',
              'Full classification log with confidence scores',
              'Threat intelligence dataset exports (CSV/API)',
              'Daily & weekly automated report notifications',
            ].map((feature) => (
              <div key={feature} style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: '0.8125rem', color: '#ffffff' }}>
                <span style={{ color: '#10b981', fontWeight: 800 }}>✓</span>
                <span>{feature}</span>
              </div>
            ))}
          </div>
        </div>

        <Button
          onClick={onNext}
          variant="primary"
          size="lg"
          style={{
            width: '100%',
            padding: '16px 28px',
            fontSize: '1.0625rem',
            fontWeight: 800,
            borderRadius: 12,
            background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
            border: '1px solid #34d399',
            boxShadow: '0 10px 30px rgba(16, 185, 129, 0.45)',
          }}
        >
          Go to Dashboard →
        </Button>
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
