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
    desc: 'Philippine smishing attacks exploit code-switched Tagalog-English text, local brand impersonation, and message obfuscation patterns that are often missed by globally trained spam filters.',
    icon: 'PS',
  },
  {
    badge: 'Research Questions',
    badgeColor: '#3b82f6',
    title: 'Core Thesis Questions',
    desc: 'The study evaluates whether localized transformer models outperform traditional classifiers, whether density-based clustering can group coordinated campaigns, and whether SHAP attribution is useful to defenders.',
    icon: 'RQ',
    list: [
      'RQ1: XLM-RoBERTa versus traditional classifiers on Taglish SMS',
      'RQ2: HDBSCAN versus centroid-based clustering for campaign detection',
      'RQ3: SHAP token attribution for analyst-facing explanations',
    ],
  },
  {
    badge: 'Methodology',
    badgeColor: '#8b5cf6',
    title: 'Data Collection and Model Training',
    desc: 'The dataset combines labeled smishing, suspicious, and benign SMS samples. Training uses localized preprocessing, weighted optimization, and evaluation on Philippine-specific fraud language patterns.',
    icon: 'MT',
  },
  {
    badge: 'Results',
    badgeColor: '#10b981',
    title: 'Experimental Findings',
    desc: 'The thesis reports strong classification quality from the multilingual transformer and meaningful cluster formation for coordinated campaign analysis.',
    icon: 'RS',
    stats: [
      { label: 'XLM-RoBERTa F1', value: '94.2%', color: '#10b981' },
      { label: 'BERT-English F1', value: '88.7%', color: '#3b82f6' },
      { label: 'SVM + TF-IDF', value: '81.3%', color: '#f59e0b' },
      { label: 'Clusters Found', value: '31', color: '#a78bfa' },
    ],
  },
  {
    badge: 'Contributions',
    badgeColor: '#f59e0b',
    title: 'Original Contributions',
    desc: 'BantAI contributes localized dataset work, a production-oriented multilingual classification pipeline, and a campaign clustering design tailored to Philippine SMS fraud operations.',
    icon: 'CT',
    list: [
      'Localized Taglish smishing dataset with campaign labels',
      'Fine-tuning workflow for multilingual SMS classification',
      'Hybrid campaign clustering using embeddings and message structure',
    ],
  },
];

export const ResearchPage: React.FC = () => {
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
              background: 'rgba(245, 158, 11, 0.12)',
              border: '1px solid rgba(245, 158, 11, 0.35)',
              color: '#fbbf24',
              fontSize: '0.78rem',
              fontWeight: 700,
              letterSpacing: '0.06em',
              textTransform: 'uppercase',
            }}
          >
            <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#f59e0b' }} />
            Research and methodology
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
            Research Overview and Technical Paper
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
            BantAI investigates multilingual SMS fraud detection, campaign clustering, and
            explainability for the Philippine mobile threat environment.
          </p>

        </section>

        <section style={{ padding: '0 24px 80px', maxWidth: 1120, margin: '0 auto', width: '100%' }}>
          <div style={{ display: 'grid', gap: 20 }}>
            {RESEARCH_SECTIONS.map((section) => (
              <article
                key={section.badge}
                className="panel"
                style={{
                  background: 'linear-gradient(135deg, rgba(15, 23, 42, 0.88) 0%, rgba(30, 41, 59, 0.78) 100%)',
                  border: `1px solid ${section.badgeColor}28`,
                  borderLeft: `3px solid ${section.badgeColor}`,
                  borderRadius: 16,
                  padding: '28px',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap', marginBottom: 14 }}>
                  <span
                    style={{
                      padding: '5px 12px',
                      borderRadius: 8,
                      background: `${section.badgeColor}20`,
                      border: `1px solid ${section.badgeColor}40`,
                      color: section.badgeColor,
                      fontSize: '0.74rem',
                      fontWeight: 800,
                      letterSpacing: '0.06em',
                      textTransform: 'uppercase',
                    }}
                  >
                    {section.icon} {section.badge}
                  </span>
                  <h2 style={{ fontSize: '1.2rem', color: '#ffffff' }}>{section.title}</h2>
                </div>

                <p style={{ color: 'var(--text-secondary)', lineHeight: 1.7, fontSize: '0.94rem' }}>{section.desc}</p>

                {section.list ? (
                  <ul style={{ marginTop: 16, display: 'grid', gap: 8, paddingLeft: 18, color: 'var(--text-secondary)' }}>
                    {section.list.map((item) => (
                      <li key={item} style={{ lineHeight: 1.65, fontSize: '0.9rem' }}>
                        {item}
                      </li>
                    ))}
                  </ul>
                ) : null}

                {section.stats ? (
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
                        <div style={{ fontSize: '1.45rem', fontWeight: 800, color: stat.color, fontFamily: 'var(--font-mono)' }}>
                          {stat.value}
                        </div>
                        <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', fontWeight: 700, marginTop: 4 }}>
                          {stat.label}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : null}
              </article>
            ))}
          </div>

          <div
            style={{
              marginTop: 56,
              padding: '44px 32px',
              borderRadius: 20,
              background:
                'radial-gradient(circle at top, rgba(59, 130, 246, 0.2) 0%, rgba(59, 130, 246, 0) 40%), linear-gradient(135deg, rgba(15, 23, 42, 0.96) 0%, rgba(30, 41, 59, 0.92) 52%, rgba(49, 46, 129, 0.88) 100%)',
              border: '1px solid rgba(96, 165, 250, 0.28)',
              boxShadow: '0 18px 48px rgba(0, 0, 0, 0.35), inset 0 1px 0 rgba(255, 255, 255, 0.05)',
              textAlign: 'center',
              position: 'relative',
              overflow: 'hidden',
            }}
          >
            <div
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 8,
                padding: '6px 14px',
                borderRadius: 999,
                background: 'rgba(59, 130, 246, 0.14)',
                border: '1px solid rgba(96, 165, 250, 0.3)',
                color: '#93c5fd',
                fontSize: '0.74rem',
                fontWeight: 800,
                letterSpacing: '0.06em',
                textTransform: 'uppercase',
                marginBottom: 16,
              }}
            >
              <span style={{ width: 7, height: 7, borderRadius: '50%', background: '#60a5fa' }} />
              Next step
            </div>
            <h2 style={{ fontSize: '2rem', marginBottom: 12, color: '#ffffff' }}>See the System in Context</h2>
            <p style={{ color: '#cbd5e1', maxWidth: 620, margin: '0 auto 28px', lineHeight: 1.7, fontSize: '1rem' }}>
              Move from the academic framing into the operating detection pipeline or the live portal.
            </p>
            <div style={{ display: 'flex', gap: 16, justifyContent: 'center', flexWrap: 'wrap' }}>
              <Button to={ROUTES.HOW_IT_WORKS} variant="primary" size="lg">
                See Detection Pipeline
              </Button>
              <Button
                to={ROUTES.LOGIN}
                variant="ghost"
                size="lg"
                style={{
                  background: 'rgba(15, 23, 42, 0.62)',
                  border: '1px solid rgba(148, 163, 184, 0.26)',
                  color: '#e2e8f0',
                }}
              >
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
