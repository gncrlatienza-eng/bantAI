import React from 'react';
import { Button } from '../../components/common/Button';
import { Footer } from '../../components/layout/Footer';
import { PublicHeader } from '../../components/layout/PublicHeader';
import { ROUTES } from '../../constants/routes';

const PIPELINE_STEPS = [
  {
    step: '01',
    title: 'SMS Submission and Telemetry',
    subtitle: 'User and system report ingestion',
    desc: 'Suspicious SMS messages are received from the mobile app or telecom feeds. Raw text is sanitized, phone identifiers are masked, and links are prepared for downstream analysis.',
    tags: ['Mobile Sync', 'PII Masking', 'URL Sanitization'],
    icon: '📲',
    color: '#3b82f6',
  },
  {
    step: '02',
    title: 'Preprocessing and Normalization',
    subtitle: 'Code-switching and typo normalization',
    desc: 'Tagalog, English, and Taglish text is normalized to handle homoglyphs, spacing tricks, and obfuscated brand names before tokenization.',
    tags: ['Taglish NLP', 'Homoglyph Removal', 'Tokenization'],
    icon: '⚙️',
    color: '#8b5cf6',
  },
  {
    step: '03',
    title: 'Feature Extraction',
    subtitle: 'Language and structure signals',
    desc: 'The pipeline extracts n-grams, lure keywords, urgency markers, zero-width character patterns, and domain metadata that help separate legitimate traffic from fraud.',
    tags: ['TF-IDF', 'Brand Recognition', 'Urgency Index'],
    icon: '🔍',
    color: '#06b6d4',
  },
  {
    step: '04',
    title: 'XLM-RoBERTa Classification',
    subtitle: 'Transformer-based prediction',
    desc: 'A fine-tuned multilingual transformer scores each message against localized Philippine SMS samples to classify it as smishing, suspicious, or safe.',
    tags: ['XLM-RoBERTa', 'Deep Learning', 'Localized Model'],
    icon: '🧠',
    color: '#10b981',
  },
  {
    step: '05',
    title: 'SHAP Explainability',
    subtitle: 'Human-readable alert justification',
    desc: 'SHAP attribution highlights which words, phrases, and structures pushed the classifier toward a smishing verdict so analysts can inspect the reasoning.',
    tags: ['SHAP Values', 'Token Attribution', 'Audit Trail'],
    icon: '📊',
    color: '#f59e0b',
  },
  {
    step: '06',
    title: 'Campaign Clustering',
    subtitle: 'Density-based threat grouping',
    desc: 'Threat embeddings are grouped with HDBSCAN so separately reported messages can be surfaced as a single coordinated campaign.',
    tags: ['HDBSCAN', 'Embedding Clustering', 'Threat Grouping'],
    icon: '🌐',
    color: '#ef4444',
  },
  {
    step: '07',
    title: 'Analyst Review Loop',
    subtitle: 'False positive and drift control',
    desc: 'High-volume or ambiguous cases are reviewed in the admin portal, where analyst feedback is used to track drift and improve model quality over time.',
    tags: ['Analyst Review', 'Feedback Loop', 'Drift Control'],
    icon: '🛡️',
    color: '#60a5fa',
  },
  {
    step: '08',
    title: 'Intelligence Delivery',
    subtitle: 'Portal feeds and reporting',
    desc: 'Verified campaign intelligence is published to client dashboards, exports, and scheduled reports so partner teams can act quickly.',
    tags: ['Portal Feed', 'Exports', 'Reporting'],
    icon: '🚀',
    color: '#34d399',
  },
];

export const HowItWorksPage: React.FC = () => {
  const [activeStepHover, setActiveStepHover] = React.useState<string | null>(null);

  return (
    <div className="public-shell" style={{ position: 'relative' }}>
      <div className="homepage-light-bg" />

      {/* HowItWorks Custom Tech Hexagon Background Overlay */}
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
          <filter id="hwGlow" x="-30%" y="-30%" width="160%" height="160%">
            <feGaussianBlur stdDeviation="4" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>

        {/* TOP-RIGHT ACCENT */}
        <g fill="none" stroke="rgba(56, 189, 248, 0.75)" strokeWidth="2">
          <polygon points="1275,110 1242,166 1177,166 1145,110 1177,54 1242,54" />
          <polygon points="1340,180 1320,215 1280,215 1260,180 1280,145 1320,145" stroke="rgba(59, 130, 246, 0.6)" />
        </g>
        <g fill="#00f0ff" filter="url(#hwGlow)">
          <circle cx="1275" cy="110" r="4" opacity="0.9" />
          <circle cx="1242" cy="166" r="4.5" opacity="0.95" />
          <circle cx="1177" cy="166" r="4" opacity="0.8" />
          <circle cx="1145" cy="110" r="4" opacity="0.9" />
          <circle cx="1340" cy="180" r="3.5" opacity="0.8" />
        </g>

        {/* MID-LEFT ACCENT */}
        <g fill="none" stroke="rgba(56, 189, 248, 0.7)" strokeWidth="2">
          <polygon points="115,420 87,468 32,468 5,420 32,372 87,372" />
          <polygon points="180,480 162,510 127,510 110,480 127,450 162,450" stroke="rgba(96, 165, 250, 0.55)" />
        </g>
        <g fill="#00f0ff" filter="url(#hwGlow)">
          <circle cx="115" cy="420" r="4" opacity="0.9" />
          <circle cx="87" cy="468" r="4.5" opacity="0.95" />
          <circle cx="32" cy="468" r="3.5" opacity="0.8" />
          <circle cx="180" cy="480" r="3.5" opacity="0.85" />
        </g>

        {/* BOTTOM-RIGHT ACCENT */}
        <g fill="none" stroke="rgba(56, 189, 248, 0.75)" strokeWidth="2">
          <polygon points="1330,780 1300,832 1240,832 1210,780 1240,728 1300,728" />
          <polygon points="1200,840 1182,870 1147,870 1130,840 1147,810 1182,810" stroke="rgba(59, 130, 246, 0.55)" />
        </g>
        <g fill="#00f0ff" filter="url(#hwGlow)">
          <circle cx="1330" cy="780" r="4" opacity="0.9" />
          <circle cx="1300" cy="832" r="4.5" opacity="0.95" />
          <circle cx="1240" cy="832" r="4" opacity="0.8" />
          <circle cx="1200" cy="840" r="3.5" opacity="0.85" />
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
          <filter id="midLowerHwGlow" x="-30%" y="-30%" width="160%" height="160%">
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
        <g fill="#00f0ff" filter="url(#midLowerHwGlow)">
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
        <g fill="#00f0ff" filter="url(#midLowerHwGlow)">
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
          <filter id="bottomHwGlow" x="-30%" y="-30%" width="160%" height="160%">
            <feGaussianBlur stdDeviation="4" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>

        {/* VERY BOTTOM-LEFT CLUSTER ABOVE FOOTER */}
        <g fill="none" stroke="rgba(56, 189, 248, 0.75)" strokeWidth="2">
          <polygon points="170,250 135,311 65,311 30,250 65,189 135,189" />
          <polygon points="255,190 232,229 187,229 165,190 187,151 232,151" stroke="rgba(59, 130, 246, 0.6)" />
        </g>
        <g fill="#00f0ff" filter="url(#bottomHwGlow)">
          <circle cx="170" cy="250" r="4.5" opacity="0.9" />
          <circle cx="135" cy="311" r="4" opacity="0.85" />
          <circle cx="65" cy="311" r="4.5" opacity="0.95" />
          <circle cx="255" cy="190" r="3.5" opacity="0.8" />
        </g>

        {/* VERY BOTTOM-RIGHT CLUSTER ABOVE FOOTER */}
        <g fill="none" stroke="rgba(56, 189, 248, 0.75)" strokeWidth="2">
          <polygon points="1370,250 1335,311 1265,311 1230,250 1265,189 1335,189" />
          <polygon points="1235,190 1212,229 1167,229 1145,190 1167,151 1212,151" stroke="rgba(59, 130, 246, 0.6)" />
        </g>
        <g fill="#00f0ff" filter="url(#bottomHwGlow)">
          <circle cx="1370" cy="250" r="4.5" opacity="0.9" />
          <circle cx="1335" cy="311" r="4" opacity="0.85" />
          <circle cx="1265" cy="311" r="4.5" opacity="0.95" />
          <circle cx="1235" cy="190" r="3.5" opacity="0.8" />
        </g>
      </svg>
      <PublicHeader />

      <main style={{ flex: 1, position: 'relative', zIndex: 1 }}>
        {/* Hero Section */}
        <section
          className="animate-fade-in"
          style={{
            padding: '80px 24px 40px',
            maxWidth: 1160,
            margin: '0 auto',
            width: '100%',
            textAlign: 'center',
          }}
        >
          {/* Eyebrow Pill */}
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
            Technical Architecture & Detection Pipeline
          </div>

          <h1
            style={{
              margin: '16px 0 14px',
              fontSize: 'clamp(2.4rem, 4.8vw, 3.6rem)',
              fontWeight: 800,
              lineHeight: 1.15,
              color: '#ffffff',
              letterSpacing: '-0.03em',
            }}
          >
            How BantAI Detects & Clusters <br />
            <span style={{ background: 'linear-gradient(135deg, #60a5fa 0%, #2563eb 100%)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
              Philippine Smishing Threats
            </span>
          </h1>

          <p
            style={{
              maxWidth: 780,
              margin: '0 auto 36px auto',
              color: 'var(--text-secondary)',
              fontSize: '1.1rem',
              lineHeight: 1.65,
            }}
          >
            From raw SMS telemetry to campaign surfacing, BantAI combines multilingual Taglish NLP, SHAP explainability, and HDBSCAN density clustering into an automated end-to-end threat intelligence pipeline.
          </p>

          {/* Quick Metrics & Highlights Bar */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
              gap: 16,
              maxWidth: 1060,
              margin: '0 auto',
              textAlign: 'left',
            }}
          >
            <div
              className="panel card-hover-effect"
              style={{
                background: 'linear-gradient(145deg, rgba(30, 41, 75, 0.5) 0%, rgba(15, 23, 42, 0.75) 100%)',
                backdropFilter: 'blur(16px)',
                border: '1px solid rgba(96, 165, 250, 0.3)',
                borderRadius: 14,
                padding: '18px 22px',
                display: 'flex',
                alignItems: 'center',
                gap: 14,
              }}
            >
              <div style={{ width: 42, height: 42, borderRadius: 10, background: 'rgba(59, 130, 246, 0.2)', border: '1px solid rgba(96, 165, 250, 0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.2rem', flexShrink: 0 }}>
                ⚡
              </div>
              <div>
                <strong style={{ color: '#ffffff', fontSize: '0.9375rem', display: 'block' }}>Latency &lt; 120ms</strong>
                <small style={{ color: 'var(--text-secondary)', fontSize: '0.78125rem' }}>Real-time telemetry ingestion and inference</small>
              </div>
            </div>

            <div
              className="panel card-hover-effect"
              style={{
                background: 'linear-gradient(145deg, rgba(40, 30, 75, 0.5) 0%, rgba(18, 15, 42, 0.75) 100%)',
                backdropFilter: 'blur(16px)',
                border: '1px solid rgba(168, 85, 247, 0.3)',
                borderRadius: 14,
                padding: '18px 22px',
                display: 'flex',
                alignItems: 'center',
                gap: 14,
              }}
            >
              <div style={{ width: 42, height: 42, borderRadius: 10, background: 'rgba(168, 85, 247, 0.2)', border: '1px solid rgba(192, 132, 252, 0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.2rem', flexShrink: 0 }}>
                🧠
              </div>
              <div>
                <strong style={{ color: '#ffffff', fontSize: '0.9375rem', display: 'block' }}>Multilingual NLP</strong>
                <small style={{ color: 'var(--text-secondary)', fontSize: '0.78125rem' }}>Fine-tuned on Tagalog, Taglish & English lures</small>
              </div>
            </div>

            <div
              className="panel card-hover-effect"
              style={{
                background: 'linear-gradient(145deg, rgba(16, 45, 40, 0.5) 0%, rgba(10, 24, 22, 0.75) 100%)',
                backdropFilter: 'blur(16px)',
                border: '1px solid rgba(52, 211, 153, 0.3)',
                borderRadius: 14,
                padding: '18px 22px',
                display: 'flex',
                alignItems: 'center',
                gap: 14,
              }}
            >
              <div style={{ width: 42, height: 42, borderRadius: 10, background: 'rgba(16, 185, 129, 0.2)', border: '1px solid rgba(52, 211, 153, 0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.2rem', flexShrink: 0 }}>
                🛡️
              </div>
              <div>
                <strong style={{ color: '#ffffff', fontSize: '0.9375rem', display: 'block' }}>HDBSCAN Clustering</strong>
                <strong style={{ color: 'var(--text-secondary)', fontSize: '0.78125rem', fontWeight: 400, display: 'block' }}>Syndicated threat group identification</strong>
              </div>
            </div>
          </div>
        </section>

        {/* Pipeline Connected Flow Roadmap Bar */}
        <section style={{ maxWidth: 1120, margin: '10px auto 44px auto', padding: '0 24px' }}>
          <div
            className="panel"
            style={{
              background: 'linear-gradient(145deg, rgba(15, 23, 42, 0.7) 0%, rgba(10, 16, 30, 0.9) 100%)',
              backdropFilter: 'blur(20px)',
              border: '1px solid rgba(59, 130, 246, 0.3)',
              borderRadius: 18,
              padding: '20px 24px',
              boxShadow: '0 12px 30px rgba(0, 0, 0, 0.5)',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14, flexWrap: 'wrap', gap: 10 }}>
              <span style={{ color: '#ffffff', fontSize: '0.875rem', fontWeight: 700, letterSpacing: '0.04em', textTransform: 'uppercase' }}>
                Pipeline Workflow Stages (01 → 08)
              </span>
              <span style={{ color: '#60a5fa', fontSize: '0.78125rem', fontWeight: 600 }}>
                Hover a step below to inspect detailed specifications
              </span>
            </div>

            {/* Stage Quick Nodes Grid */}
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(8, 1fr)',
                gap: 8,
                position: 'relative',
              }}
            >
              {PIPELINE_STEPS.map((item) => {
                const isHovered = activeStepHover === item.step;
                return (
                  <a
                    href={`#step-${item.step}`}
                    key={item.step}
                    onMouseEnter={() => setActiveStepHover(item.step)}
                    onMouseLeave={() => setActiveStepHover(null)}
                    style={{
                      padding: '10px 6px',
                      borderRadius: 10,
                      background: isHovered ? `${item.color}25` : 'rgba(255, 255, 255, 0.03)',
                      border: `1px solid ${isHovered ? item.color : 'rgba(255, 255, 255, 0.08)'}`,
                      textAlign: 'center',
                      transition: 'all 0.2s ease',
                      textDecoration: 'none',
                      boxShadow: isHovered ? `0 0 16px ${item.color}45` : 'none',
                    }}
                  >
                    <span style={{ fontSize: '0.75rem', fontWeight: 800, color: item.color, display: 'block', fontFamily: 'var(--font-mono)' }}>
                      {item.step}
                    </span>
                    <small style={{ fontSize: '0.6875rem', color: isHovered ? '#ffffff' : 'var(--text-secondary)', display: 'block', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', marginTop: 2 }}>
                      {item.title.split(' ')[0]}
                    </small>
                  </a>
                );
              })}
            </div>
          </div>
        </section>

        {/* Connected Vertical Timeline Steps */}
        <section style={{ maxWidth: 1120, margin: '0 auto 80px auto', padding: '0 24px', position: 'relative' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 28, position: 'relative' }}>
            {PIPELINE_STEPS.map((item, idx) => {
              const isHovered = activeStepHover === item.step;
              return (
                <div
                  id={`step-${item.step}`}
                  key={item.step}
                  onMouseEnter={() => setActiveStepHover(item.step)}
                  onMouseLeave={() => setActiveStepHover(null)}
                  style={{ position: 'relative' }}
                >
                  <article
                    className="panel card-hover-effect"
                    style={{
                      display: 'grid',
                      gridTemplateColumns: 'minmax(0, 1fr)',
                      gap: 20,
                      background: isHovered
                        ? `linear-gradient(145deg, rgba(20, 32, 60, 0.85) 0%, rgba(12, 20, 42, 0.95) 100%)`
                        : 'linear-gradient(145deg, rgba(15, 23, 42, 0.75) 0%, rgba(10, 16, 32, 0.88) 100%)',
                      backdropFilter: 'blur(20px)',
                      border: `1px solid ${isHovered ? item.color : 'rgba(255, 255, 255, 0.12)'}`,
                      borderLeft: `4px solid ${item.color}`,
                      borderRadius: 18,
                      padding: '28px 32px',
                      boxShadow: isHovered
                        ? `0 18px 40px rgba(0, 0, 0, 0.6), 0 0 30px ${item.color}35, inset 0 1px 0 rgba(255, 255, 255, 0.2)`
                        : '0 10px 30px rgba(0, 0, 0, 0.4), inset 0 1px 0 rgba(255, 255, 255, 0.08)',
                      transition: 'all 0.3s cubic-bezier(0.16, 1, 0.3, 1)',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap', gap: 16 }}>
                      {/* Left: Icon, Step Number & Header */}
                      <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                        <div
                          style={{
                            width: 52,
                            height: 52,
                            borderRadius: 14,
                            background: `${item.color}22`,
                            border: `1px solid ${item.color}55`,
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            fontSize: '1.5rem',
                            boxShadow: `0 0 18px ${item.color}30`,
                            flexShrink: 0,
                          }}
                        >
                          {item.icon}
                        </div>

                        <div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 2 }}>
                            <span
                              style={{
                                padding: '2px 8px',
                                borderRadius: 6,
                                background: `${item.color}25`,
                                border: `1px solid ${item.color}45`,
                                color: item.color,
                                fontSize: '0.75rem',
                                fontWeight: 800,
                                fontFamily: 'var(--font-mono)',
                              }}
                            >
                              STEP {item.step}
                            </span>
                            <span style={{ color: item.color, fontSize: '0.8125rem', fontWeight: 700 }}>
                              {item.subtitle}
                            </span>
                          </div>
                          <h2 style={{ fontSize: '1.35rem', fontWeight: 800, color: '#ffffff', letterSpacing: '-0.01em' }}>
                            {item.title}
                          </h2>
                        </div>
                      </div>

                      {/* Technology Tag Pills */}
                      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
                        {item.tags.map((tag) => (
                          <span
                            key={tag}
                            style={{
                              padding: '5px 12px',
                              borderRadius: 20,
                              background: `${item.color}18`,
                              border: `1px solid ${item.color}35`,
                              color: item.color,
                              fontSize: '0.75rem',
                              fontWeight: 700,
                              letterSpacing: '0.02em',
                            }}
                          >
                            {tag}
                          </span>
                        ))}
                      </div>
                    </div>

                    {/* Step Detailed Description */}
                    <p style={{ color: 'var(--text-secondary)', fontSize: '0.96875rem', lineHeight: 1.7, margin: '4px 0 0 0' }}>
                      {item.desc}
                    </p>
                  </article>
                </div>
              );
            })}
          </div>

          {/* Bottom Research Paper CTA Card */}
          <div
            className="panel"
            style={{
              marginTop: 64,
              padding: '48px 40px',
              borderRadius: 22,
              background: 'linear-gradient(135deg, rgba(124, 58, 237, 0.22) 0%, rgba(37, 99, 235, 0.18) 50%, rgba(10, 14, 28, 0.95) 100%)',
              border: '1px solid rgba(139, 92, 246, 0.4)',
              boxShadow: '0 0 40px rgba(124, 58, 237, 0.2), 0 20px 50px rgba(0, 0, 0, 0.5), inset 0 1px 0 rgba(255, 255, 255, 0.15)',
              textAlign: 'center',
            }}
          >
            <div
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 8,
                padding: '4px 14px',
                borderRadius: 20,
                background: 'rgba(168, 85, 247, 0.2)',
                border: '1px solid rgba(192, 132, 252, 0.4)',
                color: '#c084fc',
                fontSize: '0.75rem',
                fontWeight: 700,
                letterSpacing: '0.06em',
                textTransform: 'uppercase',
                marginBottom: 14,
              }}
            >
              📖 Peer-Reviewed Methodology & Publication
            </div>

            <h2 style={{ fontSize: '2.1rem', fontWeight: 800, color: '#ffffff', marginBottom: 12 }}>
              Dive Deeper Into the Research Methodology
            </h2>
            <p style={{ color: 'var(--text-secondary)', fontSize: '1.05rem', maxWidth: 680, margin: '0 auto 28px auto', lineHeight: 1.7 }}>
              Explore the detailed benchmarks, loss functions, tokenization schemas, and clustering metrics behind our fine-tuned XLM-RoBERTa model and HDBSCAN pipeline.
            </p>
            
            <div style={{ display: 'flex', gap: 16, justifyContent: 'center', flexWrap: 'wrap' }}>
              <Button to={ROUTES.RESEARCH} variant="primary" size="lg" style={{ padding: '14px 32px', borderRadius: 10, boxShadow: '0 8px 24px rgba(124, 58, 237, 0.4)' }}>
                Read Research Paper →
              </Button>
              <Button to={ROUTES.LOGIN} variant="ghost" size="lg" style={{ padding: '14px 28px', borderRadius: 10, border: '1px solid var(--border-default)' }}>
                Access Client Portal
              </Button>
            </div>
          </div>
        </section>
      </main>

      <Footer />
    </div>
  );
};

