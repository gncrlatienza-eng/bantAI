import React from 'react';
import { Link } from 'react-router-dom';
import { Button } from '../../components/common/Button';
import { Footer } from '../../components/layout/Footer';
import { PublicHeader } from '../../components/layout/PublicHeader';
import { ROUTES } from '../../constants/routes';

const PIPELINE_STEPS = [
  {
    step: '01',
    title: 'SMS Submission & Telemetry',
    subtitle: 'User & System Report Ingestion',
    desc: 'Suspicious SMS text messages are received via user mobile app reporting or direct telecom honeypots. Raw messages are sanitized, PII phone numbers are masked, and extracted links are prepared for structural processing.',
    tags: ['Mobile Sync', 'PII Masking', 'URL Sanitization'],
    icon: '📱',
    color: '#3b82f6',
  },
  {
    step: '02',
    title: 'Preprocessing & Normalization',
    subtitle: 'Code-Switching & Typo Normalization',
    desc: 'Philippine smishing frequently mixes Tagalog, English, and intentional typo obfuscations (e.g., "G-C-a-s-h", "0TP", "B.D.O"). Text normalization standardizes homoglyphs, resolves obfuscated links, and tokenizes text.',
    tags: ['Taglish NLP', 'Homoglyph Removal', 'Tokenization'],
    icon: '🧹',
    color: '#8b5cf6',
  },
  {
    step: '03',
    title: 'Linguistic & Feature Extraction',
    subtitle: 'TF-IDF & Structural Features',
    desc: 'Extracts TF-IDF n-gram features, brand lure keywords (GCash, Maya, BDO, UnionBank, Shopee), urgency metrics, zero-width spaces, and domain registration metadata (IP, ASN, TLD).',
    tags: ['TF-IDF Vectors', 'Brand Recognition', 'Urgency Index'],
    icon: '🔍',
    color: '#06b6d4',
  },
  {
    step: '04',
    title: 'NLP & XLM-RoBERTa Classification',
    subtitle: 'Transformer Deep Learning Model',
    desc: 'Passes preprocessed embeddings through a fine-tuned XLM-RoBERTa transformer model trained on over 14,000 localized Philippine SMS samples to predict whether a message is Smishing, Suspicious, or Safe.',
    tags: ['XLM-RoBERTa', 'Deep Learning', '94.2% Accuracy'],
    icon: '🤖',
    color: '#10b981',
  },
  {
    step: '05',
    title: 'SHAP Explainability Layer',
    subtitle: 'Human-Readable Alert Justification',
    desc: 'SHAP values decompose the model decision into per-token contributions. Analysts can see exactly which words ("verify now", "GCash-OTP", "bit.ly") drove the smishing classification, enabling transparent audit trails.',
    tags: ['SHAP Values', 'Token Attribution', 'Audit Trail'],
    icon: '💡',
    color: '#f59e0b',
  },
  {
    step: '06',
    title: 'HDBSCAN Campaign Clustering',
    subtitle: 'Density-Based Threat Grouping',
    desc: 'Threat embeddings from classified messages are fed into HDBSCAN for density-based clustering — automatically grouping related attacks into distinct syndicated campaigns by shared senders, URLs, and text patterns.',
    tags: ['HDBSCAN', 'Embedding Clustering', 'Threat Grouping'],
    icon: '🔗',
    color: '#ef4444',
  },
  {
    step: '07',
    title: 'Analyst Review & Feedback Loop',
    subtitle: 'Continuous Model Improvement',
    desc: 'High-volume or ambiguous campaigns are queued in the BantAI Admin Portal for cybersecurity analyst verification, adjusting false positives/negatives to continuously improve the model.',
    tags: ['Analyst Workbench', 'Feedback Loop', 'Drift Control'],
    icon: '🛡️',
    color: '#3b82f6',
  },
  {
    step: '08',
    title: 'Automated Intelligence & Reporting',
    subtitle: 'Instant Feed & Telecom Alerting',
    desc: 'Verified campaign intelligence is broadcast to client portals (Globe, Smart, DITO, CICC) via real-time WebSocket feeds, automated CSV exports, and daily executive PDF reports.',
    tags: ['Telecom API', 'Real-Time Feed', 'Automated Export'],
    icon: '📡',
    color: '#34d399',
  },
];

export const HowItWorksPage: React.FC = () => {
  return (
    <div className="public-shell" style={{ position: 'relative' }}>
      <div className="homepage-light-bg" />
      <PublicHeader />

      <main style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
        {/* Hero */}
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
            gap: 20,
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
              background: 'rgba(124, 58, 237, 0.12)',
              border: '1px solid rgba(124, 58, 237, 0.35)',
              color: '#a78bfa',
              fontSize: '0.78125rem',
              fontWeight: 700,
              letterSpacing: '0.06em',
              textTransform: 'uppercase',
            }}
          >
            <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#8b5cf6', animation: 'pulseDot 1.5s infinite' }} />
            Technical Architecture & Workflow
          </div>

          <h1
            style={{
              fontSize: 'clamp(2.4rem, 4.5vw, 3.4rem)',
              fontWeight: 800,
              lineHeight: 1.15,
              letterSpacing: '-0.03em',
              color: '#ffffff',
              margin: '4px 0',
            }}
          >
            How BantAI Detects &{' '}
            <span
              style={{
                background: 'linear-gradient(135deg, #a78bfa 0%, #7c3aed 100%)',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
              }}
            >
              Clusters Smishing
            </span>
          </h1>

          <p style={{ fontSize: '1.1rem', color: 'var(--text-secondary)', maxWidth: 780, lineHeight: 1.65, margin: '0 auto' }}>
            A comprehensive breakdown of how raw user-reported SMS messages flow through our Taglish NLP detection pipeline,
            threat scoring engine, and campaign clustering infrastructure.
          </p>

          {/* Step Counter */}
          <div
            style={{
              display: 'flex',
              gap: 8,
              flexWrap: 'wrap',
              justifyContent: 'center',
              marginTop: 8,
            }}
          >
            {PIPELINE_STEPS.map((s) => (
              <div
                key={s.step}
                style={{
                  width: 36,
                  height: 36,
                  borderRadius: '50%',
                  background: `rgba(${s.color === '#3b82f6' ? '59,130,246' : s.color === '#8b5cf6' ? '139,92,246' : s.color === '#06b6d4' ? '6,182,212' : s.color === '#10b981' ? '16,185,129' : s.color === '#f59e0b' ? '245,158,11' : s.color === '#ef4444' ? '239,68,68' : '52,211,153'}, 0.15)`,
                  border: `1px solid ${s.color}44`,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '0.7rem',
                  fontWeight: 800,
                  color: s.color,
                }}
              >
                {s.step}
              </div>
            ))}
          </div>
        </section>

        {/* Pipeline Steps */}
        <section style={{ padding: '0 24px 80px 24px', maxWidth: 1100, margin: '0 auto', width: '100%' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
            {PIPELINE_STEPS.map((item, idx) => (
              <div
                key={item.step}
                className="panel animate-slide-up"
                style={{
                  display: 'grid',
                  gridTemplateColumns: '90px 1fr',
                  gap: 28,
                  alignItems: 'start',
                  background: 'linear-gradient(135deg, rgba(15, 23, 42, 0.85) 0%, rgba(30, 41, 59, 0.75) 100%)',
                  backdropFilter: 'blur(16px)',
                  border: `1px solid ${item.color}28`,
                  borderLeft: `3px solid ${item.color}`,
                  borderRadius: 16,
                  padding: '28px 32px',
                  boxShadow: `0 8px 32px rgba(0,0,0,0.4), 0 0 0 0 ${item.color}`,
                  transition: 'transform 0.2s ease, box-shadow 0.2s ease',
                  animationDelay: `${idx * 60}ms`,
                }}
              >
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10, paddingTop: 4 }}>
                  <div
                    style={{
                      width: 52,
                      height: 52,
                      borderRadius: 14,
                      background: `${item.color}20`,
                      border: `1px solid ${item.color}40`,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: '1.6rem',
                    }}
                  >
                    {item.icon}
                  </div>
                  <span
                    style={{
                      fontSize: '0.8rem',
                      fontWeight: 800,
                      color: item.color,
                      background: `${item.color}18`,
                      padding: '3px 10px',
                      borderRadius: 8,
                      border: `1px solid ${item.color}30`,
                      fontFamily: 'var(--font-mono)',
                    }}
                  >
                    {item.step}
                  </span>
                </div>

                <div>
                  <div style={{ marginBottom: 10 }}>
                    <h3 style={{ fontSize: '1.3rem', fontWeight: 700, color: '#ffffff', marginBottom: 4 }}>{item.title}</h3>
                    <small style={{ color: item.color, fontWeight: 600, fontSize: '0.8125rem' }}>{item.subtitle}</small>
                  </div>

                  <p style={{ color: 'var(--text-secondary)', fontSize: '0.9375rem', lineHeight: 1.65, marginBottom: 16 }}>
                    {item.desc}
                  </p>

                  <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                    {item.tags.map((t) => (
                      <span
                        key={t}
                        style={{
                          padding: '4px 12px',
                          borderRadius: 8,
                          background: `${item.color}15`,
                          border: `1px solid ${item.color}30`,
                          color: item.color,
                          fontSize: '0.75rem',
                          fontWeight: 700,
                          letterSpacing: '0.04em',
                        }}
                      >
                        {t}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* CTA */}
          <div
            style={{
              marginTop: 60,
              padding: '48px 40px',
              background: 'linear-gradient(135deg, rgba(124, 58, 237, 0.18) 0%, rgba(15, 15, 24, 0.9) 100%)',
              border: '1px solid rgba(124, 58, 237, 0.3)',
              borderRadius: 20,
              textAlign: 'center',
            }}
          >
            <h2 style={{ fontSize: '2rem', marginBottom: 12 }}>Dive Deeper into the Research</h2>
            <p style={{ color: 'var(--text-secondary)', fontSize: '1rem', maxWidth: 580, margin: '0 auto 28px auto' }}>
              Read the full academic methodology behind our XLM-RoBERTa model, HDBSCAN clustering approach, and SHAP explainability layer.
            </p>
            <div style={{ display: 'flex', gap: 16, justifyContent: 'center', flexWrap: 'wrap' }}>
              <Button to={ROUTES.RESEARCH} variant="primary" size="lg">
                Read Research Paper →
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
