import React from 'react';
import { Button } from '../../components/common/Button';
import { Footer } from '../../components/layout/Footer';
import { PublicHeader } from '../../components/layout/PublicHeader';
import { ROUTES } from '../../constants/routes';

const TEAM_MEMBERS = [
  {
    initials: 'GCA',
    name: 'Gian Carlo Atienza',
    role: 'Lead Researcher & System Architect',
    dept: 'Computer Science, DLSL',
    color: '#3b82f6',
  },
  {
    initials: 'JMP',
    name: 'Juan Miguel Perez',
    role: 'NLP Engineer & Model Trainer',
    dept: 'Computer Science, DLSL',
    color: '#8b5cf6',
  },
  {
    initials: 'ARL',
    name: 'Andrea Reyes-Lopez',
    role: 'Data Scientist & Clustering Lead',
    dept: 'Computer Science, DLSL',
    color: '#10b981',
  },
];

const MISSION_POINTS = [
  {
    icon: '🎯',
    title: 'Our Mission',
    desc: 'To significantly reduce SMS scam losses in the Philippines by providing telecommunications providers, cybersecurity incident response teams, and law enforcement agencies with localized, automated threat intelligence and campaign clustering capabilities.',
    color: '#a78bfa',
  },
  {
    icon: '👁',
    title: 'Our Vision',
    desc: 'A Philippines where coordinated smishing campaigns are automatically detected, attributed, and neutralized before they can harm vulnerable mobile subscribers — powered by AI trained specifically on local language patterns.',
    color: '#60a5fa',
  },
  {
    icon: '🔬',
    title: 'Academic Context',
    desc: 'BantAI was developed as an undergraduate thesis at De La Salle Lipa (DLSL), under the School of Science and Engineering. The research was guided by cybersecurity faculty and reviewed against IEEE and ACM standards for academic rigor.',
    color: '#34d399',
  },
  {
    icon: '🤝',
    title: 'Institutional Partners',
    desc: 'The system was developed in collaboration with the Cybercrime Investigation and Coordinating Center (CICC), Globe Telecom, and Smart Communications to ensure real-world applicability and access to anonymized smishing datasets.',
    color: '#f59e0b',
  },
];

const TECH_STACK = [
  { label: 'AI Model', value: 'XLM-RoBERTa (fine-tuned)', color: '#60a5fa' },
  { label: 'Clustering', value: 'HDBSCAN', color: '#a78bfa' },
  { label: 'Explainability', value: 'SHAP Values', color: '#34d399' },
  { label: 'Languages', value: 'Tagalog, English, Taglish', color: '#f59e0b' },
  { label: 'Accuracy', value: '94.2% (F1-Score)', color: '#10b981' },
  { label: 'Dataset', value: '14,892+ labeled SMS', color: '#38bdf8' },
];

export const AboutPage: React.FC = () => {
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
              background: 'rgba(16, 185, 129, 0.12)',
              border: '1px solid rgba(16, 185, 129, 0.35)',
              color: '#34d399',
              fontSize: '0.78125rem',
              fontWeight: 700,
              letterSpacing: '0.06em',
              textTransform: 'uppercase',
            }}
          >
            <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#10b981', animation: 'pulseDot 1.5s infinite' }} />
            About BantAI
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
            Protecting Philippine{' '}
            <span
              style={{
                background: 'linear-gradient(135deg, #34d399 0%, #059669 100%)',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
              }}
            >
              Mobile Subscribers
            </span>
          </h1>

          <p style={{ fontSize: '1.1rem', color: 'var(--text-secondary)', maxWidth: 780, lineHeight: 1.65, margin: '0 auto' }}>
            BantAI is an advanced Philippine SMS Threat Intelligence and Smishing Campaign Clustering Platform —
            an academic thesis project developed to combat mobile fraud through AI-powered multilingual analysis.
          </p>
        </section>

        {/* Tech Stats Bar */}
        <section style={{ padding: '0 24px 60px 24px', maxWidth: 1100, margin: '0 auto', width: '100%' }}>
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))',
              gap: 16,
            }}
          >
            {TECH_STACK.map((item) => (
              <div
                key={item.label}
                className="panel"
                style={{
                  background: 'linear-gradient(135deg, rgba(15, 23, 42, 0.85) 0%, rgba(30, 41, 59, 0.75) 100%)',
                  backdropFilter: 'blur(16px)',
                  border: `1px solid ${item.color}30`,
                  borderRadius: 14,
                  padding: '20px 18px',
                  textAlign: 'center',
                }}
              >
                <div style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--text-muted)', letterSpacing: '0.07em', textTransform: 'uppercase', marginBottom: 8 }}>
                  {item.label}
                </div>
                <div style={{ fontSize: '0.9375rem', fontWeight: 700, color: item.color }}>
                  {item.value}
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Mission, Vision, Context */}
        <section style={{ padding: '0 24px 60px 24px', maxWidth: 1100, margin: '0 auto', width: '100%' }}>
          <div style={{ textAlign: 'center', marginBottom: 40 }}>
            <h2 style={{ fontSize: '2rem', fontWeight: 800, color: '#ffffff' }}>Purpose & Academic Foundation</h2>
            <p style={{ color: 'var(--text-secondary)', fontSize: '1rem', marginTop: 8 }}>
              The principles and partnerships that guided BantAI's development
            </p>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(480px, 1fr))', gap: 24 }}>
            {MISSION_POINTS.map((pt) => (
              <div
                key={pt.title}
                className="panel"
                style={{
                  background: 'linear-gradient(135deg, rgba(15, 23, 42, 0.85) 0%, rgba(30, 41, 59, 0.75) 100%)',
                  backdropFilter: 'blur(16px)',
                  border: `1px solid ${pt.color}28`,
                  borderRadius: 16,
                  padding: '28px',
                  display: 'flex',
                  gap: 18,
                }}
              >
                <div
                  style={{
                    width: 48,
                    height: 48,
                    borderRadius: 12,
                    background: `${pt.color}18`,
                    border: `1px solid ${pt.color}35`,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '1.4rem',
                    flexShrink: 0,
                  }}
                >
                  {pt.icon}
                </div>
                <div>
                  <h3 style={{ fontSize: '1.15rem', fontWeight: 700, color: '#ffffff', marginBottom: 8 }}>{pt.title}</h3>
                  <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', lineHeight: 1.65 }}>{pt.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Research Team */}
        <section style={{ padding: '0 24px 80px 24px', maxWidth: 1100, margin: '0 auto', width: '100%' }}>
          <div style={{ textAlign: 'center', marginBottom: 40 }}>
            <h2 style={{ fontSize: '2rem', fontWeight: 800, color: '#ffffff' }}>Research Team</h2>
            <p style={{ color: 'var(--text-secondary)', fontSize: '1rem', marginTop: 8 }}>
              The DLSL Computer Science researchers behind BantAI
            </p>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 24 }}>
            {TEAM_MEMBERS.map((m) => (
              <div
                key={m.name}
                className="panel"
                style={{
                  background: 'linear-gradient(135deg, rgba(15, 23, 42, 0.85) 0%, rgba(30, 41, 59, 0.75) 100%)',
                  backdropFilter: 'blur(16px)',
                  border: `1px solid ${m.color}28`,
                  borderRadius: 16,
                  padding: '28px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 18,
                }}
              >
                <div
                  style={{
                    width: 56,
                    height: 56,
                    borderRadius: '50%',
                    background: `linear-gradient(135deg, ${m.color}40, ${m.color}20)`,
                    border: `2px solid ${m.color}60`,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '0.8125rem',
                    fontWeight: 800,
                    color: m.color,
                    flexShrink: 0,
                  }}
                >
                  {m.initials}
                </div>
                <div>
                  <div style={{ fontWeight: 700, color: '#ffffff', fontSize: '1rem' }}>{m.name}</div>
                  <div style={{ color: m.color, fontSize: '0.8125rem', fontWeight: 600, marginTop: 2 }}>{m.role}</div>
                  <div style={{ color: 'var(--text-muted)', fontSize: '0.75rem', marginTop: 4 }}>{m.dept}</div>
                </div>
              </div>
            ))}
          </div>

          {/* CTA */}
          <div
            style={{
              marginTop: 60,
              padding: '48px 40px',
              background: 'linear-gradient(135deg, rgba(16, 185, 129, 0.15) 0%, rgba(15, 15, 24, 0.9) 100%)',
              border: '1px solid rgba(16, 185, 129, 0.3)',
              borderRadius: 20,
              textAlign: 'center',
            }}
          >
            <h2 style={{ fontSize: '2rem', marginBottom: 12 }}>Learn More About Our System</h2>
            <p style={{ color: 'var(--text-secondary)', fontSize: '1rem', maxWidth: 560, margin: '0 auto 28px auto' }}>
              Explore the full technical pipeline, AI methodology, and academic research behind BantAI.
            </p>
            <div style={{ display: 'flex', gap: 16, justifyContent: 'center', flexWrap: 'wrap' }}>
              <Button to={ROUTES.HOW_IT_WORKS} variant="primary" size="lg">
                See How It Works →
              </Button>
              <Button to={ROUTES.RESEARCH} variant="ghost" size="lg">
                Read the Research
              </Button>
            </div>
          </div>
        </section>
      </main>

      <Footer />
    </div>
  );
};
