import React from 'react';
import { Button } from '../../components/common/Button';
import { Footer } from '../../components/layout/Footer';
import { PublicHeader } from '../../components/layout/PublicHeader';
import { ROUTES } from '../../constants/routes';

const RESEARCH_SECTIONS = [
  {
    badge: 'Problem Statement',
    badgeColor: '#ef4444',
    title: 'Evasion Tactics in Philippine Mobile Fraud',
    desc: 'Philippine smishing attacks exploit two critical weaknesses in existing global detection systems: the use of code-switched Tagalog-English text and highly localized brand lure names (GCash, Maya, Shopee). Most commercial spam filters trained on Western datasets produce false-negative rates exceeding 47% on Filipino SMS phishing datasets — leaving millions of mobile users unprotected.',
    icon: '⚠️',
  },
  {
    badge: 'Research Objectives',
    badgeColor: '#3b82f6',
    title: 'Core Research Questions',
    desc: 'This thesis investigates: (1) Can transformer-based NLP models fine-tuned on localized Taglish data outperform traditional ML classifiers for smishing detection? (2) Is density-based clustering (HDBSCAN) effective for grouping coordinated SMS phishing campaigns? (3) Can SHAP explainability provide actionable human-readable alerts for cybersecurity analysts?',
    icon: '🔬',
    list: [
      'RQ1: XLM-RoBERTa vs. Traditional Classifiers (SVM, Random Forest, BERT-English)',
      'RQ2: HDBSCAN vs. K-Means for campaign clustering on Philippine SMS data',
      'RQ3: SHAP token attribution for analyst-level decision transparency',
    ],
  },
  {
    badge: 'Methodology',
    badgeColor: '#8b5cf6',
    title: 'Data Collection & Model Training',
    desc: 'The BantAI dataset was constructed from 14,892 SMS messages across three categories: confirmed smishing (7,241), suspicious (3,104), and benign (4,547). Messages were sourced from anonymized CICC reports, Globe Telecom flagged samples, and synthesized adversarial examples. The XLM-RoBERTa base model was fine-tuned for 5 epochs using AdamW optimizer (lr=2e-5, batch=16) with a weighted cross-entropy loss to address class imbalance.',
    icon: '⚙️',
  },
  {
    badge: 'Results',
    badgeColor: '#10b981',
    title: 'Experimental Results & Key Findings',
    desc: 'XLM-RoBERTa achieved 94.2% F1-score, outperforming BERT-English (88.7%), SVM+TF-IDF (81.3%), and Random Forest (78.1%) on the localized dataset. HDBSCAN successfully identified 31 distinct smishing campaign clusters in the test corpus with a 0.73 silhouette score. SHAP analysis confirmed that brand lure tokens and urgency markers account for 68% of smishing classification weight.',
    icon: '📊',
    stats: [
      { label: 'XLM-RoBERTa F1', value: '94.2%', color: '#10b981' },
      { label: 'BERT-English F1', value: '88.7%', color: '#3b82f6' },
      { label: 'SVM+TF-IDF F1', value: '81.3%', color: '#f59e0b' },
      { label: 'Clusters Found', value: '31', color: '#a78bfa' },
    ],
  },
  {
    badge: 'Contributions',
    badgeColor: '#f59e0b',
    title: 'Original Academic Contributions',
    desc: 'This research contributes: (1) The first publicly documented Tagalog-English smishing dataset of >10,000 samples with campaign attribution labels; (2) A production-ready XLM-RoBERTa fine-tuning pipeline for Philippine code-switched SMS classification; (3) A novel HDBSCAN-based campaign clustering architecture combining NLP embeddings with structural SMS metadata.',
    icon: '🏆',
    list: [
      'First Philippine Taglish smishing dataset with campaign labels',
      'Open-source fine-tuning pipeline for multilingual SMS classification',
      'Novel hybrid clustering: NLP embeddings + structural features',
    ],
  },
];

export const ResearchPage: React.FC = () => {
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
          <div
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 8,
              padding: '6px 18px',
              borderRadius: 20,
              background: 'rgba(245, 158, 11, 0.12)',
              border: '1px solid rgba(245, 158, 11, 0.35)',
              color: '#fbbf24',
              fontSize: '0.78125rem',
              fontWeight: 700,
              letterSpacing: '0.06em',
              textTransform: 'uppercase',
            }}
          >
            <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#f59e0b', animation: 'pulseDot 1.5s infinite' }} />
            Academic Thesis & Methodology
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
            Research Overview &{' '}
            <span
              style={{
                background: 'linear-gradient(135deg, #fbbf24 0%, #d97706 100%)',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
              }}
            >
              Technical Paper
            </span>
          </h1>

          <p style={{ fontSize: '1.1rem', color: 'var(--text-secondary)', maxWidth: 780, lineHeight: 1.65, margin: '0 auto' }}>
            Investigation into machine learning architectures for detecting code-switched Tagalog-English smishing attacks
            and syndicated campaign clustering using HDBSCAN and transformer NLP.
          </p>

          {/* Paper Citation Card */}
          <div
            style={{
              marginTop: 16,
              padding: '20px 28px',
              background: 'rgba(15, 23, 42, 0.8)',
              border: '1px solid rgba(245, 158, 11, 0.3)',
              borderRadius: 14,
              textAlign: 'left',
              maxWidth: 760,
              width: '100%',
            }}
          >
            <div style={{ fontSize: '0.72rem', fontWeight: 700, color: '#f59e0b', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 8 }}>
              📄 Thesis Reference
            </div>
            <p style={{ color: '#cbd5e1', fontSize: '0.9rem', lineHeight: 1.6, fontStyle: 'italic' }}>
              "BantAI: A Multilingual XLM-RoBERTa Based SMS Threat Intelligence and Smishing Campaign Clustering System for Philippine Mobile Subscribers"
            </p>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.8125rem', marginTop: 8 }}>
              De La Salle Lipa — School of Science & Engineering, 2024–2025
            </p>
          </div>
        </section>

        {/* Research Content */}
        <section style={{ padding: '0 24px 80px 24px', maxWidth: 1100, margin: '0 auto', width: '100%' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 28 }}>
            {RESEARCH_SECTIONS.map((section) => (
              <div
                key={section.badge}
                className="panel animate-slide-up"
                style={{
                  background: 'linear-gradient(135deg, rgba(15, 23, 42, 0.85) 0%, rgba(30, 41, 59, 0.75) 100%)',
                  backdropFilter: 'blur(16px)',
                  border: `1px solid ${section.badgeColor}28`,
                  borderLeft: `3px solid ${section.badgeColor}`,
                  borderRadius: 16,
                  padding: '32px',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 14, flexWrap: 'wrap' }}>
                  <span
                    style={{
                      padding: '4px 12px',
                      borderRadius: 8,
                      background: `${section.badgeColor}20`,
                      border: `1px solid ${section.badgeColor}40`,
                      color: section.badgeColor,
                      fontSize: '0.72rem',
                      fontWeight: 800,
                      letterSpacing: '0.06em',
                      textTransform: 'uppercase',
                    }}
                  >
                    {section.icon} {section.badge}
                  </span>
                  <h2 style={{ fontSize: '1.35rem', fontWeight: 700, color: '#ffffff' }}>{section.title}</h2>
                </div>

                <p style={{ color: 'var(--text-secondary)', lineHeight: 1.7, fontSize: '0.9375rem' }}>{section.desc}</p>

                {section.list && (
                  <ul style={{ marginTop: 16, display: 'flex', flexDirection: 'column', gap: 8 }}>
                    {section.list.map((item) => (
                      <li key={item} style={{ display: 'flex', alignItems: 'flex-start', gap: 10, color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
                        <span style={{ color: section.badgeColor, fontWeight: 700, flexShrink: 0 }}>→</span>
                        {item}
                      </li>
                    ))}
                  </ul>
                )}

                {section.stats && (
                  <div style={{ marginTop: 20, display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 12 }}>
                    {section.stats.map((stat) => (
                      <div
                        key={stat.label}
                        style={{
                          padding: '14px',
                          background: `${stat.color}10`,
                          border: `1px solid ${stat.color}30`,
                          borderRadius: 10,
                          textAlign: 'center',
                        }}
                      >
                        <div style={{ fontSize: '1.5rem', fontWeight: 800, color: stat.color, fontFamily: 'var(--font-mono)' }}>
                          {stat.value}
                        </div>
                        <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', fontWeight: 700, marginTop: 4, letterSpacing: '0.04em' }}>
                          {stat.label}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>

          {/* CTA */}
          <div
            style={{
              marginTop: 60,
              padding: '48px 40px',
              background: 'linear-gradient(135deg, rgba(245, 158, 11, 0.15) 0%, rgba(15, 15, 24, 0.9) 100%)',
              border: '1px solid rgba(245, 158, 11, 0.3)',
              borderRadius: 20,
              textAlign: 'center',
            }}
          >
            <h2 style={{ fontSize: '2rem', marginBottom: 12 }}>Explore the Full System</h2>
            <p style={{ color: 'var(--text-secondary)', fontSize: '1rem', maxWidth: 560, margin: '0 auto 28px auto' }}>
              See the complete detection pipeline in action or access the live intelligence portal.
            </p>
            <div style={{ display: 'flex', gap: 16, justifyContent: 'center', flexWrap: 'wrap' }}>
              <Button to={ROUTES.HOW_IT_WORKS} variant="primary" size="lg">
                See Detection Pipeline →
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
