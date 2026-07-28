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
    icon: 'SMS',
    color: '#3b82f6',
  },
  {
    step: '02',
    title: 'Preprocessing and Normalization',
    subtitle: 'Code-switching and typo normalization',
    desc: 'Tagalog, English, and Taglish text is normalized to handle homoglyphs, spacing tricks, and obfuscated brand names before tokenization.',
    tags: ['Taglish NLP', 'Homoglyph Removal', 'Tokenization'],
    icon: 'NLP',
    color: '#8b5cf6',
  },
  {
    step: '03',
    title: 'Feature Extraction',
    subtitle: 'Language and structure signals',
    desc: 'The pipeline extracts n-grams, lure keywords, urgency markers, zero-width character patterns, and domain metadata that help separate legitimate traffic from fraud.',
    tags: ['TF-IDF', 'Brand Recognition', 'Urgency Index'],
    icon: 'FX',
    color: '#06b6d4',
  },
  {
    step: '04',
    title: 'XLM-RoBERTa Classification',
    subtitle: 'Transformer-based prediction',
    desc: 'A fine-tuned multilingual transformer scores each message against localized Philippine SMS samples to classify it as smishing, suspicious, or safe.',
    tags: ['XLM-RoBERTa', 'Deep Learning', 'Localized Model'],
    icon: 'AI',
    color: '#10b981',
  },
  {
    step: '05',
    title: 'SHAP Explainability',
    subtitle: 'Human-readable alert justification',
    desc: 'SHAP attribution highlights which words, phrases, and structures pushed the classifier toward a smishing verdict so analysts can inspect the reasoning.',
    tags: ['SHAP Values', 'Token Attribution', 'Audit Trail'],
    icon: 'SH',
    color: '#f59e0b',
  },
  {
    step: '06',
    title: 'Campaign Clustering',
    subtitle: 'Density-based threat grouping',
    desc: 'Threat embeddings are grouped with HDBSCAN so separately reported messages can be surfaced as a single coordinated campaign.',
    tags: ['HDBSCAN', 'Embedding Clustering', 'Threat Grouping'],
    icon: 'CL',
    color: '#ef4444',
  },
  {
    step: '07',
    title: 'Analyst Review Loop',
    subtitle: 'False positive and drift control',
    desc: 'High-volume or ambiguous cases are reviewed in the admin portal, where analyst feedback is used to track drift and improve model quality over time.',
    tags: ['Analyst Review', 'Feedback Loop', 'Drift Control'],
    icon: 'AR',
    color: '#60a5fa',
  },
  {
    step: '08',
    title: 'Intelligence Delivery',
    subtitle: 'Portal feeds and reporting',
    desc: 'Verified campaign intelligence is published to client dashboards, exports, and scheduled reports so partner teams can act quickly.',
    tags: ['Portal Feed', 'Exports', 'Reporting'],
    icon: 'RT',
    color: '#34d399',
  },
];

const sectionStyle: React.CSSProperties = {
  padding: '0 24px 80px',
  maxWidth: 1120,
  margin: '0 auto',
  width: '100%',
};

export const HowItWorksPage: React.FC = () => {
  return (
    <div className="public-shell" style={{ position: 'relative' }}>
      <div className="homepage-light-bg" />
      <PublicHeader />

      <main style={{ flex: 1 }}>
        <section
          className="animate-fade-in"
          style={{
            padding: '80px 24px 56px',
            maxWidth: 1120,
            margin: '0 auto',
            width: '100%',
            textAlign: 'center',
          }}
        >
          <div
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 8,
              padding: '6px 18px',
              borderRadius: 999,
              background: 'rgba(124, 58, 237, 0.12)',
              border: '1px solid rgba(124, 58, 237, 0.35)',
              color: '#a78bfa',
              fontSize: '0.78rem',
              fontWeight: 700,
              letterSpacing: '0.06em',
              textTransform: 'uppercase',
            }}
          >
            <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#8b5cf6' }} />
            Technical pipeline
          </div>

          <h1
            style={{
              margin: '18px 0 14px',
              fontSize: 'clamp(2.35rem, 4.8vw, 3.4rem)',
              fontWeight: 800,
              lineHeight: 1.1,
              color: '#ffffff',
            }}
          >
            How BantAI Detects and Clusters Smishing
          </h1>

          <p
            style={{
              maxWidth: 780,
              margin: '0 auto',
              color: 'var(--text-secondary)',
              fontSize: '1.05rem',
              lineHeight: 1.7,
            }}
          >
            From ingestion to campaign surfacing, BantAI combines multilingual NLP, explainability,
            and clustering to turn isolated reports into actionable Philippine threat intelligence.
          </p>
        </section>

        <section style={sectionStyle}>
          <div style={{ display: 'grid', gap: 20 }}>
            {PIPELINE_STEPS.map((item) => (
              <article
                key={item.step}
                className="panel"
                style={{
                  display: 'grid',
                  gridTemplateColumns: '84px minmax(0, 1fr)',
                  gap: 24,
                  alignItems: 'start',
                  background: 'linear-gradient(135deg, rgba(15, 23, 42, 0.88) 0%, rgba(30, 41, 59, 0.78) 100%)',
                  border: `1px solid ${item.color}28`,
                  borderLeft: `3px solid ${item.color}`,
                  borderRadius: 16,
                  padding: '28px',
                }}
              >
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10 }}>
                  <div
                    style={{
                      width: 54,
                      height: 54,
                      borderRadius: 14,
                      background: `${item.color}20`,
                      border: `1px solid ${item.color}44`,
                      color: item.color,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: '0.82rem',
                      fontWeight: 800,
                    }}
                  >
                    {item.icon}
                  </div>
                  <span
                    style={{
                      fontSize: '0.78rem',
                      fontWeight: 800,
                      color: item.color,
                      fontFamily: 'var(--font-mono)',
                    }}
                  >
                    {item.step}
                  </span>
                </div>

                <div>
                  <div style={{ marginBottom: 12 }}>
                    <h2 style={{ fontSize: '1.25rem', marginBottom: 4, color: '#ffffff' }}>{item.title}</h2>
                    <div style={{ color: item.color, fontSize: '0.82rem', fontWeight: 700 }}>{item.subtitle}</div>
                  </div>

                  <p style={{ color: 'var(--text-secondary)', fontSize: '0.94rem', lineHeight: 1.7, marginBottom: 16 }}>
                    {item.desc}
                  </p>

                  <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                    {item.tags.map((tag) => (
                      <span
                        key={tag}
                        style={{
                          padding: '5px 12px',
                          borderRadius: 8,
                          background: `${item.color}16`,
                          border: `1px solid ${item.color}2f`,
                          color: item.color,
                          fontSize: '0.75rem',
                          fontWeight: 700,
                        }}
                      >
                        {tag}
                      </span>
                    ))}
                  </div>
                </div>
              </article>
            ))}
          </div>

          <div
            style={{
              marginTop: 56,
              padding: '40px 32px',
              borderRadius: 18,
              background: 'linear-gradient(135deg, rgba(124, 58, 237, 0.18) 0%, rgba(15, 15, 24, 0.9) 100%)',
              border: '1px solid rgba(124, 58, 237, 0.28)',
              textAlign: 'center',
            }}
          >
            <h2 style={{ fontSize: '1.9rem', marginBottom: 10 }}>Dive Deeper Into the Research</h2>
            <p style={{ color: 'var(--text-secondary)', maxWidth: 620, margin: '0 auto 24px', lineHeight: 1.7 }}>
              Read the methodology behind the localized XLM-RoBERTa model, SHAP attribution, and
              HDBSCAN campaign clustering.
            </p>
            <div style={{ display: 'flex', gap: 16, justifyContent: 'center', flexWrap: 'wrap' }}>
              <Button to={ROUTES.RESEARCH} variant="primary" size="lg">
                Read Research Paper
              </Button>
              <Button to={ROUTES.LOGIN} variant="ghost" size="lg">
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
