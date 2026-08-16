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

      {/* About Custom Tech Hexagon Background Overlay */}
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
          <filter id="abGlow" x="-30%" y="-30%" width="160%" height="160%">
            <feGaussianBlur stdDeviation="4" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>

        {/* TOP-LEFT ACCENT */}
        <g fill="none" stroke="rgba(96, 165, 250, 0.75)" strokeWidth="2">
          <polygon points="180,120 145,181 75,181 40,120 75,59 145,59" />
          <polygon
            points="265,60 242,99 197,99 175,60 197,21 242,21"
            stroke="rgba(56, 189, 248, 0.6)"
          />
        </g>
        <g fill="#00f0ff" filter="url(#abGlow)">
          <circle cx="180" cy="120" r="4.5" opacity="0.9" />
          <circle cx="145" cy="181" r="4" opacity="0.85" />
          <circle cx="75" cy="181" r="4.5" opacity="0.95" />
          <circle cx="40" cy="120" r="4" opacity="0.8" />
          <circle cx="265" cy="60" r="3.5" opacity="0.8" />
        </g>

        {/* MID-RIGHT ACCENT */}
        <g fill="none" stroke="rgba(56, 189, 248, 0.7)" strokeWidth="2">
          <polygon points="1375,460 1342,516 1277,516 1245,460 1277,404 1342,404" />
          <polygon
            points="1260,520 1242,550 1207,550 1190,520 1207,490 1242,490"
            stroke="rgba(59, 130, 246, 0.55)"
          />
        </g>
        <g fill="#00f0ff" filter="url(#abGlow)">
          <circle cx="1375" cy="460" r="4" opacity="0.9" />
          <circle cx="1342" cy="516" r="4.5" opacity="0.95" />
          <circle cx="1277" cy="516" r="4" opacity="0.8" />
          <circle cx="1260" cy="520" r="3.5" opacity="0.85" />
        </g>

        {/* BOTTOM-LEFT ACCENT */}
        <g fill="none" stroke="rgba(96, 165, 250, 0.7)" strokeWidth="2">
          <polygon points="130,760 105,803 55,803 30,760 55,717 105,717" />
          <polygon
            points="200,810 185,836 155,836 140,810 155,784 185,784"
            stroke="rgba(56, 189, 248, 0.5)"
          />
        </g>
        <g fill="#00f0ff" filter="url(#abGlow)">
          <circle cx="130" cy="760" r="4" opacity="0.9" />
          <circle cx="105" cy="803" r="4.5" opacity="0.95" />
          <circle cx="55" cy="803" r="3.5" opacity="0.8" />
          <circle cx="200" cy="810" r="3.5" opacity="0.8" />
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
          <filter
            id="midLowerAbGlow"
            x="-30%"
            y="-30%"
            width="160%"
            height="160%"
          >
            <feGaussianBlur stdDeviation="4" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>

        {/* MID-LOWER LEFT FLANK */}
        <g fill="none" stroke="rgba(96, 165, 250, 0.75)" strokeWidth="2">
          <polygon points="140,240 108,295 43,295 11,240 43,185 108,185" />
          <polygon
            points="215,300 197,331 162,331 145,300 162,269 197,269"
            stroke="rgba(56, 189, 248, 0.6)"
          />
        </g>
        <g fill="#00f0ff" filter="url(#midLowerAbGlow)">
          <circle cx="140" cy="240" r="4.5" opacity="0.9" />
          <circle cx="108" cy="295" r="4" opacity="0.85" />
          <circle cx="43" cy="295" r="4.5" opacity="0.95" />
          <circle cx="215" cy="300" r="3.5" opacity="0.8" />
        </g>

        {/* MID-LOWER RIGHT FLANK */}
        <g fill="none" stroke="rgba(56, 189, 248, 0.75)" strokeWidth="2">
          <polygon points="1350,240 1318,295 1253,295 1221,240 1253,185 1318,185" />
          <polygon
            points="1235,300 1217,331 1182,331 1165,300 1182,269 1217,269"
            stroke="rgba(59, 130, 246, 0.6)"
          />
        </g>
        <g fill="#00f0ff" filter="url(#midLowerAbGlow)">
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
          <filter
            id="bottomAbGlow"
            x="-30%"
            y="-30%"
            width="160%"
            height="160%"
          >
            <feGaussianBlur stdDeviation="4" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>

        {/* VERY BOTTOM-LEFT CLUSTER ABOVE FOOTER */}
        <g fill="none" stroke="rgba(96, 165, 250, 0.75)" strokeWidth="2">
          <polygon points="170,250 135,311 65,311 30,250 65,189 135,189" />
          <polygon
            points="255,190 232,229 187,229 165,190 187,151 232,151"
            stroke="rgba(56, 189, 248, 0.6)"
          />
        </g>
        <g fill="#00f0ff" filter="url(#bottomAbGlow)">
          <circle cx="170" cy="250" r="4.5" opacity="0.9" />
          <circle cx="135" cy="311" r="4" opacity="0.85" />
          <circle cx="65" cy="311" r="4.5" opacity="0.95" />
          <circle cx="255" cy="190" r="3.5" opacity="0.8" />
        </g>

        {/* VERY BOTTOM-RIGHT CLUSTER ABOVE FOOTER */}
        <g fill="none" stroke="rgba(56, 189, 248, 0.75)" strokeWidth="2">
          <polygon points="1370,250 1335,311 1265,311 1230,250 1265,189 1335,189" />
          <polygon
            points="1235,190 1212,229 1167,229 1145,190 1167,151 1212,151"
            stroke="rgba(59, 130, 246, 0.6)"
          />
        </g>
        <g fill="#00f0ff" filter="url(#bottomAbGlow)">
          <circle cx="1370" cy="250" r="4.5" opacity="0.9" />
          <circle cx="1335" cy="311" r="4" opacity="0.85" />
          <circle cx="1265" cy="311" r="4.5" opacity="0.95" />
          <circle cx="1235" cy="190" r="3.5" opacity="0.8" />
        </g>
      </svg>
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
            <span
              style={{
                width: 8,
                height: 8,
                borderRadius: '50%',
                background: '#3b82f6',
                animation: 'pulseDot 1.5s infinite',
              }}
            />
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
            <span
              style={{
                background: 'linear-gradient(135deg, #60a5fa 0%, #2563eb 100%)',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
              }}
            >
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
            BantAI is a thesis-driven threat intelligence platform focused on
            multilingual SMS fraud detection, explainable AI, and campaign
            clustering for Philippine defenders.
          </p>
        </section>

        <section
          style={{
            padding: '0 24px 56px',
            maxWidth: 1120,
            margin: '0 auto',
            width: '100%',
          }}
        >
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
                  background:
                    'linear-gradient(135deg, rgba(15, 23, 42, 0.88) 0%, rgba(30, 41, 59, 0.78) 100%)',
                  border: `1px solid ${item.color}30`,
                  borderRadius: 14,
                  padding: '20px 18px',
                  textAlign: 'center',
                }}
              >
                <div
                  style={{
                    fontSize: '0.72rem',
                    fontWeight: 700,
                    color: 'var(--text-muted)',
                    letterSpacing: '0.06em',
                    textTransform: 'uppercase',
                    marginBottom: 8,
                  }}
                >
                  {item.label}
                </div>
                <div
                  style={{
                    fontSize: '0.94rem',
                    fontWeight: 700,
                    color: item.color,
                  }}
                >
                  {item.value}
                </div>
              </div>
            ))}
          </div>
        </section>

        <section
          style={{
            padding: '0 24px 56px',
            maxWidth: 1120,
            margin: '0 auto',
            width: '100%',
          }}
        >
          <div style={{ textAlign: 'center', marginBottom: 32 }}>
            <h2
              style={{ fontSize: '1.9rem', color: '#ffffff', marginBottom: 8 }}
            >
              Purpose and Foundation
            </h2>
            <p style={{ color: 'var(--text-secondary)' }}>
              The research priorities that shaped BantAI from problem framing to
              implementation.
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
                  background:
                    'linear-gradient(135deg, rgba(15, 23, 42, 0.88) 0%, rgba(30, 41, 59, 0.78) 100%)',
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
                  <h3
                    style={{
                      fontSize: '1.08rem',
                      color: '#ffffff',
                      marginBottom: 8,
                    }}
                  >
                    {point.title}
                  </h3>
                  <p
                    style={{
                      color: 'var(--text-secondary)',
                      lineHeight: 1.7,
                      fontSize: '0.92rem',
                    }}
                  >
                    {point.desc}
                  </p>
                </div>
              </article>
            ))}
          </div>
        </section>

        <section
          style={{
            padding: '0 24px 80px',
            maxWidth: 1120,
            margin: '0 auto',
            width: '100%',
          }}
        >
          <div style={{ textAlign: 'center', marginBottom: 32 }}>
            <h2
              style={{ fontSize: '1.9rem', color: '#ffffff', marginBottom: 8 }}
            >
              Research Team
            </h2>
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
                  background:
                    'linear-gradient(135deg, rgba(15, 23, 42, 0.88) 0%, rgba(30, 41, 59, 0.78) 100%)',
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
                  <div
                    style={{
                      color: '#ffffff',
                      fontWeight: 700,
                      fontSize: '1rem',
                    }}
                  >
                    {member.name}
                  </div>
                  <div
                    style={{
                      color: member.color,
                      fontWeight: 700,
                      fontSize: '0.82rem',
                      marginTop: 2,
                    }}
                  >
                    {member.role}
                  </div>
                  <div
                    style={{
                      color: 'var(--text-muted)',
                      fontSize: '0.76rem',
                      marginTop: 4,
                    }}
                  >
                    {member.dept}
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
              background:
                'linear-gradient(135deg, rgba(16, 185, 129, 0.15) 0%, rgba(15, 15, 24, 0.9) 100%)',
              border: '1px solid rgba(16, 185, 129, 0.28)',
              textAlign: 'center',
            }}
          >
            <h2 style={{ fontSize: '1.9rem', marginBottom: 10 }}>
              Explore the Full System
            </h2>
            <p
              style={{
                color: 'var(--text-secondary)',
                maxWidth: 620,
                margin: '0 auto 24px',
                lineHeight: 1.7,
              }}
            >
              Review the detection pipeline and the supporting research that
              grounds the platform.
            </p>
            <div
              style={{
                display: 'flex',
                gap: 16,
                justifyContent: 'center',
                flexWrap: 'wrap',
              }}
            >
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
