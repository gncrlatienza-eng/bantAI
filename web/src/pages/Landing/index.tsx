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

      {/* Direct Tech Hexagon Background Overlay (Upper-Left, Upper-Right, Sides, Bottom-Left & Bottom-Right) */}
      <svg
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          width: '100%',
          height: '950px',
          pointerEvents: 'none',
          zIndex: 2,
        }}
        viewBox="0 0 1400 950"
        preserveAspectRatio="xMidYMin meet"
      >
        <defs>
          <filter id="hexGlow" x="-30%" y="-30%" width="160%" height="160%">
            <feGaussianBlur stdDeviation="4" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>

        {/* UPPER-LEFT CLUSTER (3 Thin Regular Hexagons) */}
        <g fill="none" stroke="rgba(56, 189, 248, 0.75)" strokeWidth="2">
          <polygon points="190,140 152,205 77,205 40,140 77,75 152,75" />
          <polygon points="275,75 250,118 200,118 175,75 200,32 250,32" stroke="rgba(59, 130, 246, 0.65)" />
          <polygon points="90,260 72,290 37,290 20,260 37,230 72,230" stroke="rgba(96, 165, 250, 0.55)" />
        </g>
        <g fill="#00f0ff" filter="url(#hexGlow)">
          <circle cx="190" cy="140" r="4.5" opacity="0.95" />
          <circle cx="152" cy="205" r="5" opacity="1" />
          <circle cx="77" cy="205" r="4" opacity="0.85" />
          <circle cx="40" cy="140" r="4.5" opacity="0.95" />
          <circle cx="77" cy="75" r="4" opacity="0.8" />
          <circle cx="152" cy="75" r="5" opacity="1" />
          <circle cx="275" cy="75" r="4" opacity="0.85" />
          <circle cx="200" cy="32" r="3.5" opacity="0.75" />
        </g>

        {/* UPPER-RIGHT CLUSTER (3 Thin Regular Hexagons) */}
        <g fill="none" stroke="rgba(56, 189, 248, 0.75)" strokeWidth="2">
          <polygon points="1210,140 1172,205 1097,205 1060,140 1097,75 1172,75" />
          <polygon points="1125,75 1100,118 1050,118 1025,75 1050,32 1100,32" stroke="rgba(59, 130, 246, 0.65)" />
          <polygon points="1310,260 1292,290 1257,290 1240,260 1257,230 1292,230" stroke="rgba(96, 165, 250, 0.55)" />
        </g>
        <g fill="#00f0ff" filter="url(#hexGlow)">
          <circle cx="1210" cy="140" r="4.5" opacity="0.95" />
          <circle cx="1172" cy="205" r="5" opacity="1" />
          <circle cx="1097" cy="205" r="4" opacity="0.85" />
          <circle cx="1060" cy="140" r="4.5" opacity="0.95" />
          <circle cx="1097" cy="75" r="4" opacity="0.8" />
          <circle cx="1172" cy="75" r="5" opacity="1" />
          <circle cx="1125" cy="75" r="4" opacity="0.85" />
          <circle cx="1050" cy="32" r="3.5" opacity="0.75" />
        </g>

        {/* SUBTLE SIDE ACCENTS */}
        <g fill="none" stroke="rgba(56, 189, 248, 0.55)" strokeWidth="1.8">
          <polygon points="1350,450 1330,485 1290,485 1270,450 1290,415 1330,415" />
          <polygon points="130,470 111,503 73,503 54,470 73,437 111,437" />
        </g>
        <g fill="#00f0ff" filter="url(#hexGlow)">
          <circle cx="1350" cy="450" r="3.5" opacity="0.8" />
          <circle cx="1270" cy="450" r="3.5" opacity="0.7" />
          <circle cx="130" cy="470" r="3.5" opacity="0.8" />
          <circle cx="54" cy="470" r="3.5" opacity="0.7" />
        </g>
      </svg>

      {/* Mid-Lower Page Hexagon Accents (Fills Middle-Lower Side Margins) */}
      <svg
        style={{
          position: 'absolute',
          top: '48%',
          left: 0,
          width: '100%',
          height: '500px',
          pointerEvents: 'none',
          zIndex: 2,
        }}
        viewBox="0 0 1400 500"
        preserveAspectRatio="xMidYMid meet"
      >
        <defs>
          <filter id="midLowerGlow" x="-30%" y="-30%" width="160%" height="160%">
            <feGaussianBlur stdDeviation="4" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>

        {/* MID-LOWER LEFT FLANK */}
        <g fill="none" stroke="rgba(56, 189, 248, 0.75)" strokeWidth="2">
          <polygon points="140,240 108,295 43,295 11,240 43,185 108,185" />
          <polygon points="215,300 197,331 162,331 145,300 162,269 197,269" stroke="rgba(59, 130, 246, 0.6)" />
        </g>
        <g fill="#00f0ff" filter="url(#midLowerGlow)">
          <circle cx="140" cy="240" r="4.5" opacity="0.9" />
          <circle cx="108" cy="295" r="4" opacity="0.85" />
          <circle cx="43" cy="295" r="4.5" opacity="0.95" />
          <circle cx="215" cy="300" r="3.5" opacity="0.8" />
        </g>

        {/* MID-LOWER RIGHT FLANK */}
        <g fill="none" stroke="rgba(56, 189, 248, 0.75)" strokeWidth="2">
          <polygon points="1350,240 1318,295 1253,295 1221,240 1253,185 1318,185" />
          <polygon points="1235,300 1217,331 1182,331 1165,300 1182,269 1217,269" stroke="rgba(59, 130, 246, 0.6)" />
        </g>
        <g fill="#00f0ff" filter="url(#midLowerGlow)">
          <circle cx="1350" cy="240" r="4.5" opacity="0.9" />
          <circle cx="1318" cy="295" r="4" opacity="0.85" />
          <circle cx="1253" cy="295" r="4.5" opacity="0.95" />
          <circle cx="1235" cy="300" r="3.5" opacity="0.8" />
        </g>
      </svg>

      {/* Bottom Page Hexagon Accents (Above Footer - Framing CTA Section) */}
      <svg
        style={{
          position: 'absolute',
          bottom: '240px',
          left: 0,
          width: '100%',
          height: '500px',
          pointerEvents: 'none',
          zIndex: 2,
        }}
        viewBox="0 0 1400 500"
        preserveAspectRatio="xMidYMax meet"
      >
        <defs>
          <filter id="bottomHexGlow" x="-30%" y="-30%" width="160%" height="160%">
            <feGaussianBlur stdDeviation="4" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>

        {/* BOTTOM-LEFT ACCENT ABOVE FOOTER (2 Thin Regular Hexagons) */}
        <g fill="none" stroke="rgba(56, 189, 248, 0.75)" strokeWidth="2">
          <polygon points="170,250 135,311 65,311 30,250 65,189 135,189" />
          <polygon points="255,190 232,229 187,229 165,190 187,151 232,151" stroke="rgba(59, 130, 246, 0.65)" />
        </g>
        <g fill="#00f0ff" filter="url(#bottomHexGlow)">
          <circle cx="170" cy="250" r="4.5" opacity="0.9" />
          <circle cx="135" cy="311" r="4" opacity="0.85" />
          <circle cx="65" cy="311" r="4.5" opacity="0.95" />
          <circle cx="30" cy="250" r="4" opacity="0.8" />
          <circle cx="255" cy="190" r="3.5" opacity="0.8" />
        </g>

        {/* BOTTOM-RIGHT ACCENT ABOVE FOOTER (2 Thin Regular Hexagons) */}
        <g fill="none" stroke="rgba(56, 189, 248, 0.75)" strokeWidth="2">
          <polygon points="1370,250 1335,311 1265,311 1230,250 1265,189 1335,189" />
          <polygon points="1235,190 1212,229 1167,229 1145,190 1167,151 1212,151" stroke="rgba(59, 130, 246, 0.65)" />
        </g>
        <g fill="#00f0ff" filter="url(#bottomHexGlow)">
          <circle cx="1370" cy="250" r="4.5" opacity="0.9" />
          <circle cx="1335" cy="311" r="4" opacity="0.85" />
          <circle cx="1265" cy="311" r="4.5" opacity="0.95" />
          <circle cx="1230" cy="250" r="4" opacity="0.8" />
          <circle cx="1235" cy="190" r="3.5" opacity="0.8" />
        </g>
      </svg>
      <PublicHeader />
      
      <main style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', position: 'relative', zIndex: 2 }}>
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
            <div className="glow-card glow-card-blue">
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  padding: '4px 14px',
                  background: 'rgba(37, 99, 235, 0.22)',
                  borderRadius: 20,
                  border: '1px solid rgba(96, 165, 250, 0.4)',
                  boxShadow: '0 0 12px rgba(37, 99, 235, 0.3)',
                }}
              >
                <span style={{ fontSize: '1.3rem' }}>📬</span>
                <span style={{ color: '#93c5fd', fontSize: '0.8125rem', fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase' }}>
                  Messages Analyzed
                </span>
              </div>
              <strong style={{ fontSize: '3rem', fontWeight: 800, color: '#ffffff', fontFamily: 'var(--font-mono)', lineHeight: 1.1, textShadow: '0 0 25px rgba(96, 165, 250, 0.85), 0 0 50px rgba(37, 99, 235, 0.65)' }}>
                14,892+
              </strong>
            </div>

            {/* Card 2: Smishing Intercepted */}
            <div className="glow-card glow-card-cyan">
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  padding: '4px 14px',
                  background: 'rgba(6, 182, 212, 0.22)',
                  borderRadius: 20,
                  border: '1px solid rgba(56, 189, 248, 0.4)',
                  boxShadow: '0 0 12px rgba(6, 182, 212, 0.3)',
                }}
              >
                <span style={{ fontSize: '1.3rem' }}>🚨</span>
                <span style={{ color: '#7dd3fc', fontSize: '0.8125rem', fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase' }}>
                  Smishing Intercepted
                </span>
              </div>
              <strong style={{ fontSize: '3rem', fontWeight: 800, color: '#38bdf8', fontFamily: 'var(--font-mono)', lineHeight: 1.1, textShadow: '0 0 25px rgba(56, 189, 248, 0.9), 0 0 50px rgba(14, 165, 233, 0.7)' }}>
                1,247+
              </strong>
            </div>

            {/* Card 3: Active Campaign Clusters */}
            <div className="glow-card glow-card-emerald">
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  padding: '4px 14px',
                  background: 'rgba(16, 185, 129, 0.22)',
                  borderRadius: 20,
                  border: '1px solid rgba(52, 211, 153, 0.4)',
                  boxShadow: '0 0 12px rgba(16, 185, 129, 0.3)',
                }}
              >
                <span style={{ fontSize: '1.3rem' }}>🛡️</span>
                <span style={{ color: '#6ee7b7', fontSize: '0.8125rem', fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase' }}>
                  Active Clusters
                </span>
              </div>
              <strong style={{ fontSize: '3rem', fontWeight: 800, color: '#34d399', fontFamily: 'var(--font-mono)', lineHeight: 1.1, textShadow: '0 0 25px rgba(52, 211, 153, 0.9), 0 0 50px rgba(16, 185, 129, 0.7)' }}>
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
            <div
              className="panel card-hover-effect"
              style={{
                background: 'linear-gradient(145deg, rgba(20, 30, 60, 0.55) 0%, rgba(10, 16, 35, 0.8) 100%)',
                backdropFilter: 'blur(16px)',
                border: '1px solid rgba(59, 130, 246, 0.35)',
                boxShadow: '0 10px 30px rgba(0, 0, 0, 0.4), 0 0 20px rgba(37, 99, 235, 0.15), inset 0 1px 0 rgba(255, 255, 255, 0.1)',
                borderRadius: 18,
                padding: '28px 24px',
              }}
            >
              <div style={{ fontSize: '2rem', marginBottom: 12 }}>🛡️</div>
              <h3 style={{ fontSize: '1.25rem', marginBottom: 8, color: '#ffffff' }}>AI-Powered NLP Engine</h3>
              <p style={{ color: 'var(--text-secondary)', fontSize: '0.875rem' }}>
                XLM-RoBERTa fine-tuned on Tagalog, Taglish, and English smishing texts to accurately detect deceptive lure language, sense of urgency, and typo-squatted URLs.
              </p>
            </div>

            <div
              className="panel card-hover-effect"
              style={{
                background: 'linear-gradient(145deg, rgba(30, 25, 60, 0.55) 0%, rgba(16, 12, 35, 0.8) 100%)',
                backdropFilter: 'blur(16px)',
                border: '1px solid rgba(139, 92, 246, 0.35)',
                boxShadow: '0 10px 30px rgba(0, 0, 0, 0.4), 0 0 20px rgba(139, 92, 246, 0.15), inset 0 1px 0 rgba(255, 255, 255, 0.1)',
                borderRadius: 18,
                padding: '28px 24px',
              }}
            >
              <div style={{ fontSize: '2rem', marginBottom: 12 }}>🔗</div>
              <h3 style={{ fontSize: '1.25rem', marginBottom: 8, color: '#ffffff' }}>Automated Campaign Clustering</h3>
              <p style={{ color: 'var(--text-secondary)', fontSize: '0.875rem' }}>
                Groups isolated scam messages into broad syndicated campaign clusters using structural features, URL syntax, and timing patterns.
              </p>
            </div>

            <div
              className="panel card-hover-effect"
              style={{
                background: 'linear-gradient(145deg, rgba(14, 45, 60, 0.55) 0%, rgba(8, 22, 35, 0.8) 100%)',
                backdropFilter: 'blur(16px)',
                border: '1px solid rgba(6, 182, 212, 0.35)',
                boxShadow: '0 10px 30px rgba(0, 0, 0, 0.4), 0 0 20px rgba(6, 182, 212, 0.15), inset 0 1px 0 rgba(255, 255, 255, 0.1)',
                borderRadius: 18,
                padding: '28px 24px',
              }}
            >
              <div style={{ fontSize: '2rem', marginBottom: 12 }}>⚡</div>
              <h3 style={{ fontSize: '1.25rem', marginBottom: 8, color: '#ffffff' }}>Real-Time Threat Intelligence</h3>
              <p style={{ color: 'var(--text-secondary)', fontSize: '0.875rem' }}>
                Instant feeds and downloadable exports (CSV/API) enable telecommunications SOCs to immediately initiate SIM blocking and domain takedowns.
              </p>
            </div>
          </div>
        </section>

        <section
          style={{
            margin: '0 20px 80px 20px',
            padding: '60px 40px',
            background: 'linear-gradient(135deg, rgba(37, 99, 235, 0.25) 0%, rgba(15, 23, 42, 0.85) 100%)',
            border: '1px solid rgba(96, 165, 250, 0.45)',
            boxShadow: '0 0 50px rgba(37, 99, 235, 0.25), 0 20px 50px rgba(0, 0, 0, 0.5), inset 0 1px 1px rgba(255, 255, 255, 0.2)',
            borderRadius: 24,
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
