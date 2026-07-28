import React from 'react';
import { Button } from '../../components/common/Button';
import { Footer } from '../../components/layout/Footer';
import { PublicHeader } from '../../components/layout/PublicHeader';
import { ROUTES } from '../../constants/routes';

export const LandingPage: React.FC = () => {
  return (
    <div className="public-shell" style={{ position: 'relative' }}>
      {/* Homepage Light Ambient Background Glow */}
      <div className="homepage-light-bg" />
      <PublicHeader />
      
      <main style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
        {/* Hero Section */}
        <section
          className="animate-fade-in"
          style={{
            padding: '80px 24px 60px 24px',
            maxWidth: 1200,
            margin: '0 auto',
            textAlign: 'center',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: 24,
            width: '100%',
          }}
        >
          {/* Pill Badge */}
          <div
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 8,
              padding: '6px 18px',
              borderRadius: 20,
              background: 'rgba(37, 99, 235, 0.12)',
              border: '1px solid rgba(59, 130, 246, 0.35)',
              color: '#60a5fa',
              fontSize: '0.78125rem',
              fontWeight: 700,
              letterSpacing: '0.06em',
              textTransform: 'uppercase',
            }}
          >
            <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#3b82f6', animation: 'pulseDot 1.5s infinite' }} />
            Philippine SMS Threat Intelligence Platform
          </div>

          {/* Headline */}
          <h1 style={{ fontSize: 'clamp(2.8rem, 5.2vw, 3.8rem)', fontWeight: 800, lineHeight: 1.15, letterSpacing: '-0.03em', color: '#ffffff', margin: '4px 0' }}>
            Campaign Intelligence <br />
            <span style={{ background: 'linear-gradient(135deg, #60a5fa 0%, #2563eb 100%)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
              for Philippine Smishing
            </span>
          </h1>

          {/* Supporting Paragraph */}
          <p style={{ fontSize: '1.15rem', color: 'var(--text-secondary)', maxWidth: 780, lineHeight: 1.65, margin: '0 auto' }}>
            BantAI clusters coordinated smishing campaigns, tracks how scam tactics evolve, and delivers labeled threat intelligence to telecommunications and cybersecurity organizations.
          </p>

          {/* Hero Action Buttons */}
          <div style={{ display: 'flex', gap: 18, marginTop: 10, flexWrap: 'wrap', justifyContent: 'center' }}>
            <Button to={ROUTES.LICENSING} variant="primary" size="lg" style={{ padding: '14px 34px', fontSize: '1rem', borderRadius: 10, boxShadow: '0 8px 24px rgba(37, 99, 235, 0.4)' }}>
              Licensing →
            </Button>
            <Button to={ROUTES.HOW_IT_WORKS} variant="ghost" size="lg" style={{ padding: '14px 30px', fontSize: '1rem', borderRadius: 10, border: '1px solid var(--border-default)' }}>
              Learn How It Works
            </Button>
          </div>

          {/* Disclaimer Text */}
          <small style={{ color: 'var(--text-muted)', fontSize: '0.8125rem', marginTop: 6, maxWidth: 600 }}>
            Restricted to authorized telecommunications and cybersecurity organizations. Access is by invitation only.
          </small>

          {/* 3 Spacious, Uncompressed High-Tech Statistic Cards Grid */}
          <div
            style={{
              width: '100%',
              maxWidth: 1160,
              margin: '44px auto 0 auto',
              display: 'grid',
              gridTemplateColumns: 'repeat(3, 1fr)',
              gap: 24,
              textAlign: 'center',
            }}
          >
            {/* Card 1: Messages Analyzed */}
            <div
              className="panel card-hover-effect campaign-card-interactive"
              style={{
                background: 'linear-gradient(135deg, rgba(15, 23, 42, 0.85) 0%, rgba(30, 41, 59, 0.75) 100%)',
                backdropFilter: 'blur(16px)',
                border: '1px solid rgba(59, 130, 246, 0.35)',
                borderRadius: 20,
                padding: '30px 28px',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 10,
                boxShadow: '0 18px 40px rgba(0, 0, 0, 0.5), inset 0 1px 0 rgba(255, 255, 255, 0.1)',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ fontSize: '1.4rem' }}>📬</span>
                <span style={{ color: '#94a3b8', fontSize: '0.8125rem', fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase' }}>
                  Messages Analyzed
                </span>
              </div>
              <strong style={{ fontSize: '2.85rem', fontWeight: 800, color: '#ffffff', fontFamily: 'var(--font-mono)', lineHeight: 1.1, textShadow: '0 0 20px rgba(255, 255, 255, 0.2)' }}>
                14,892+
              </strong>
            </div>

            {/* Card 2: Smishing Intercepted */}
            <div
              className="panel card-hover-effect campaign-card-interactive"
              style={{
                background: 'linear-gradient(135deg, rgba(15, 23, 42, 0.85) 0%, rgba(30, 41, 59, 0.75) 100%)',
                backdropFilter: 'blur(16px)',
                border: '1px solid rgba(59, 130, 246, 0.35)',
                borderRadius: 20,
                padding: '30px 28px',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 10,
                boxShadow: '0 18px 40px rgba(0, 0, 0, 0.5), inset 0 1px 0 rgba(255, 255, 255, 0.1)',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ fontSize: '1.4rem' }}>🚨</span>
                <span style={{ color: '#94a3b8', fontSize: '0.8125rem', fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase' }}>
                  Smishing Intercepted
                </span>
              </div>
              <strong style={{ fontSize: '2.85rem', fontWeight: 800, color: '#38bdf8', fontFamily: 'var(--font-mono)', lineHeight: 1.1, textShadow: '0 0 24px rgba(56, 189, 248, 0.4)' }}>
                1,247+
              </strong>
            </div>

            {/* Card 3: Active Campaign Clusters */}
            <div
              className="panel card-hover-effect campaign-card-interactive"
              style={{
                background: 'linear-gradient(135deg, rgba(15, 23, 42, 0.85) 0%, rgba(30, 41, 59, 0.75) 100%)',
                backdropFilter: 'blur(16px)',
                border: '1px solid rgba(59, 130, 246, 0.35)',
                borderRadius: 20,
                padding: '30px 28px',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 10,
                boxShadow: '0 18px 40px rgba(0, 0, 0, 0.5), inset 0 1px 0 rgba(255, 255, 255, 0.1)',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ fontSize: '1.4rem' }}>🛡️</span>
                <span style={{ color: '#94a3b8', fontSize: '0.8125rem', fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase' }}>
                  Active Clusters
                </span>
              </div>
              <strong style={{ fontSize: '2.85rem', fontWeight: 800, color: '#34d399', fontFamily: 'var(--font-mono)', lineHeight: 1.1, textShadow: '0 0 24px rgba(52, 211, 153, 0.4)' }}>
                31
              </strong>
            </div>
          </div>
        </section>

        {/* Highlight Cards Section */}
        <section style={{ padding: '80px 20px', maxWidth: 1200, margin: '0 auto', width: '100%' }}>
          <div style={{ textAlign: 'center', marginBottom: 50 }}>
            <h2 style={{ fontSize: '2rem', marginBottom: 12 }}>Built Specifically for the Philippine Threat Landscape</h2>
            <p style={{ color: 'var(--text-secondary)', fontSize: '1rem', maxWidth: 600, margin: '0 auto' }}>
              Targeting GCash, Maya, BDO, UnionBank, LBC, and e-commerce impersonation tactics using natural language processing and campaign clustering.
            </p>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 24 }}>
            <div className="panel">
              <div style={{ fontSize: '2rem', marginBottom: 12 }}>🛡️</div>
              <h3 style={{ fontSize: '1.25rem', marginBottom: 8 }}>AI-Powered NLP Engine</h3>
              <p style={{ color: 'var(--text-secondary)', fontSize: '0.875rem' }}>
                XLM-RoBERTa fine-tuned on Tagalog, Taglish, and English smishing texts to accurately detect deceptive lure language, sense of urgency, and typo-squatted URLs.
              </p>
            </div>

            <div className="panel">
              <div style={{ fontSize: '2rem', marginBottom: 12 }}>🔗</div>
              <h3 style={{ fontSize: '1.25rem', marginBottom: 8 }}>Automated Campaign Clustering</h3>
              <p style={{ color: 'var(--text-secondary)', fontSize: '0.875rem' }}>
                Groups isolated scam messages into broad syndicated campaign clusters using structural features, URL syntax, and timing patterns.
              </p>
            </div>

            <div className="panel">
              <div style={{ fontSize: '2rem', marginBottom: 12 }}>⚡</div>
              <h3 style={{ fontSize: '1.25rem', marginBottom: 8 }}>Real-Time Threat Intelligence</h3>
              <p style={{ color: 'var(--text-secondary)', fontSize: '0.875rem' }}>
                Instant feeds and downloadable exports (CSV/API) enable telecommunications SOCs to immediately initiate SIM blocking and domain takedowns.
              </p>
            </div>
          </div>
        </section>

        {/* CTA Section */}
        <section
          style={{
            margin: '0 20px 80px 20px',
            padding: '60px 40px',
            background: 'linear-gradient(135deg, rgba(37, 99, 235, 0.18) 0%, rgba(15, 15, 24, 0.9) 100%)',
            border: '1px solid var(--border-accent)',
            borderRadius: 20,
            textAlign: 'center',
            maxWidth: 1100,
            alignSelf: 'center',
            width: '100%',
          }}
        >
          <h2 style={{ fontSize: '2.25rem', marginBottom: 16 }}>Ready to Protect Your Organization's Subscribers?</h2>
          <p style={{ color: 'var(--text-secondary)', fontSize: '1.125rem', maxWidth: 650, margin: '0 auto 32px auto' }}>
            Access the threat intelligence portal today to monitor live smishing campaign feeds for your security team.
          </p>
          <Button to={ROUTES.LOGIN} variant="primary" size="lg">
            Sign In to Intelligence Portal →
          </Button>
        </section>
      </main>

      <Footer />
    </div>
  );
};
