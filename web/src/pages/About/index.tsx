import React from 'react';
import { Button } from '../../components/common/Button';
import { Footer } from '../../components/layout/Footer';
import { PublicHeader } from '../../components/layout/PublicHeader';
import { ROUTES } from '../../constants/routes';

const TEAM_MEMBERS = [
  {
    initials: 'GA',
    name: 'Gian Atienza',
    role: 'Machine Learning and NLP Pipeline',
    dept: 'Group 7, DLSL CITE',
    color: '#3b82f6',
  },
  {
    initials: 'RD',
    name: 'Reymark De Castro',
    role: 'Mobile Application and Systems Integration',
    dept: 'Group 7, DLSL CITE',
    color: '#8b5cf6',
  },
  {
    initials: 'DD',
    name: 'Daryl De Castro',
    role: 'Frontend and Portal Experience',
    dept: 'Group 7, DLSL CITE',
    color: '#06b6d4',
  },
  {
    initials: 'MS',
    name: 'Maxene Sofia Mendoza',
    role: 'Backend, Data, and Threat Clustering',
    dept: 'Group 7, DLSL CITE',
    color: '#10b981',
  },
];

const FOUNDATION_POINTS = [
  {
    icon: 'MS',
    title: 'Mission',
    desc: 'Reduce SMS scam losses in the Philippines by giving telecom, incident response, and public-sector teams localized, explainable threat intelligence.',
    color: '#34d399',
  },
  {
    icon: 'VS',
    title: 'Vision',
    desc: 'Surface coordinated smishing campaigns early enough for defenders to block, attribute, and respond before they spread across large subscriber bases.',
    color: '#60a5fa',
  },
  {
    icon: 'AC',
    title: 'Academic Context',
    desc: 'BantAI was developed as an undergraduate thesis at De La Salle Lipa and shaped by faculty guidance, evaluation, and applied cybersecurity research goals.',
    color: '#a78bfa',
  },
  {
    icon: 'TH',
    title: 'Threat Focus',
    desc: 'The system is tuned for Philippine smishing patterns, including Tagalog, English, and Taglish lure language targeting banks, e-wallets, and telecom brands.',
    color: '#f59e0b',
  },
];

const TECH_STACK = [
  { label: 'AI Model', value: 'XLM-RoBERTa fine-tuned', color: '#60a5fa' },
  { label: 'Clustering', value: 'HDBSCAN', color: '#a78bfa' },
  { label: 'Explainability', value: 'SHAP', color: '#34d399' },
  { label: 'Languages', value: 'Tagalog, English, Taglish', color: '#f59e0b' },
  { label: 'Dataset', value: '14,892 labeled SMS', color: '#38bdf8' },
  { label: 'Frontend', value: 'React and Vite', color: '#10b981' },
];

export const AboutPage: React.FC = () => {
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
            About BantAI Platform
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
            Built for the Philippine <br />
            <span style={{ background: 'linear-gradient(135deg, #60a5fa 0%, #2563eb 100%)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
              Smishing Threat Landscape
            </span>
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
            BantAI is a thesis-driven threat intelligence platform focused on multilingual SMS fraud
            detection, explainable AI, and campaign clustering for Philippine defenders.
          </p>
        </section>

        <section style={{ padding: '0 24px 56px', maxWidth: 1120, margin: '0 auto', width: '100%' }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 16 }}>
            {TECH_STACK.map((item) => (
              <div
                key={item.label}
                className="panel"
                style={{
                  background: 'linear-gradient(135deg, rgba(15, 23, 42, 0.88) 0%, rgba(30, 41, 59, 0.78) 100%)',
                  border: `1px solid ${item.color}30`,
                  borderRadius: 14,
                  padding: '20px 18px',
                  textAlign: 'center',
                }}
              >
                <div style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--text-muted)', letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: 8 }}>
                  {item.label}
                </div>
                <div style={{ fontSize: '0.94rem', fontWeight: 700, color: item.color }}>{item.value}</div>
              </div>
            ))}
          </div>
        </section>

        <section style={{ padding: '0 24px 56px', maxWidth: 1120, margin: '0 auto', width: '100%' }}>
          <div style={{ textAlign: 'center', marginBottom: 32 }}>
            <h2 style={{ fontSize: '1.9rem', color: '#ffffff', marginBottom: 8 }}>Purpose and Foundation</h2>
            <p style={{ color: 'var(--text-secondary)' }}>
              The research priorities that shaped BantAI from problem framing to implementation.
            </p>
          </div>

          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
              gap: 20,
            }}
          >
            {FOUNDATION_POINTS.map((point) => (
              <article
                key={point.title}
                className="panel"
                style={{
                  background: 'linear-gradient(135deg, rgba(15, 23, 42, 0.88) 0%, rgba(30, 41, 59, 0.78) 100%)',
                  border: `1px solid ${point.color}28`,
                  borderRadius: 16,
                  padding: '24px',
                  display: 'flex',
                  gap: 16,
                }}
              >
                <div
                  style={{
                    width: 48,
                    height: 48,
                    borderRadius: 12,
                    background: `${point.color}18`,
                    border: `1px solid ${point.color}35`,
                    color: point.color,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '0.8rem',
                    fontWeight: 800,
                    flexShrink: 0,
                  }}
                >
                  {point.icon}
                </div>
                <div>
                  <h3 style={{ fontSize: '1.08rem', color: '#ffffff', marginBottom: 8 }}>{point.title}</h3>
                  <p style={{ color: 'var(--text-secondary)', lineHeight: 1.7, fontSize: '0.92rem' }}>{point.desc}</p>
                </div>
              </article>
            ))}
          </div>
        </section>

        <section style={{ padding: '0 24px 80px', maxWidth: 1120, margin: '0 auto', width: '100%' }}>
          <div style={{ textAlign: 'center', marginBottom: 32 }}>
            <h2 style={{ fontSize: '1.9rem', color: '#ffffff', marginBottom: 8 }}>Research Team</h2>
            <p style={{ color: 'var(--text-secondary)' }}>Group 7, DLSL CITE</p>
          </div>

          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
              gap: 20,
            }}
          >
            {TEAM_MEMBERS.map((member) => (
              <article
                key={member.name}
                className="panel"
                style={{
                  background: 'linear-gradient(135deg, rgba(15, 23, 42, 0.88) 0%, rgba(30, 41, 59, 0.78) 100%)',
                  border: `1px solid ${member.color}28`,
                  borderRadius: 16,
                  padding: '24px',
                  display: 'flex',
                  gap: 16,
                  alignItems: 'center',
                }}
              >
                <div
                  style={{
                    width: 56,
                    height: 56,
                    borderRadius: '50%',
                    background: `linear-gradient(135deg, ${member.color}38, ${member.color}16)`,
                    border: `2px solid ${member.color}55`,
                    color: member.color,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '0.82rem',
                    fontWeight: 800,
                    flexShrink: 0,
                  }}
                >
                  {member.initials}
                </div>
                <div>
                  <div style={{ color: '#ffffff', fontWeight: 700, fontSize: '1rem' }}>{member.name}</div>
                  <div style={{ color: member.color, fontWeight: 700, fontSize: '0.82rem', marginTop: 2 }}>{member.role}</div>
                  <div style={{ color: 'var(--text-muted)', fontSize: '0.76rem', marginTop: 4 }}>{member.dept}</div>
                </div>
              </article>
            ))}
          </div>

          <div
            style={{
              marginTop: 56,
              padding: '40px 32px',
              borderRadius: 18,
              background: 'linear-gradient(135deg, rgba(16, 185, 129, 0.15) 0%, rgba(15, 15, 24, 0.9) 100%)',
              border: '1px solid rgba(16, 185, 129, 0.28)',
              textAlign: 'center',
            }}
          >
            <h2 style={{ fontSize: '1.9rem', marginBottom: 10 }}>Explore the Full System</h2>
            <p style={{ color: 'var(--text-secondary)', maxWidth: 620, margin: '0 auto 24px', lineHeight: 1.7 }}>
              Review the detection pipeline and the supporting research that grounds the platform.
            </p>
            <div style={{ display: 'flex', gap: 16, justifyContent: 'center', flexWrap: 'wrap' }}>
              <Button to={ROUTES.HOW_IT_WORKS} variant="primary" size="lg">
                See How It Works
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
