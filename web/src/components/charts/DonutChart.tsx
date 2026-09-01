import React from 'react';

export interface DonutChartProps {
  totalMessages?: number;
  smishingCount?: number;
  suspiciousCount?: number;
  safeCount?: number;
}

export const DonutChart: React.FC<DonutChartProps> = ({
  totalMessages,
  smishingCount,
  suspiciousCount,
  safeCount,
}) => {
  const total = totalMessages ?? 14892;
  const smishing = smishingCount ?? 1247;
  const suspicious = suspiciousCount ?? 389;
  const safe = safeCount ?? (total > 0 ? Math.max(0, total - smishing - suspicious) : 13256);

  const safePctVal = total > 0 ? (safe / total) * 100 : 89.1;
  const smishingPctVal = total > 0 ? (smishing / total) * 100 : 8.3;
  const suspiciousPctVal = total > 0 ? (suspicious / total) * 100 : 2.6;

  const safePct = safePctVal.toFixed(1);
  const smishingPct = smishingPctVal.toFixed(1);
  const suspiciousPct = suspiciousPctVal.toFixed(1);

  const safeDash = `${safePct} ${(100 - safePctVal).toFixed(1)}`;
  const smishingDash = `${smishingPct} ${(100 - smishingPctVal).toFixed(1)}`;
  const suspiciousDash = `${suspiciousPct} ${(100 - suspiciousPctVal).toFixed(1)}`;

  const smishingOffset = (25 - safePctVal).toFixed(1);
  const suspiciousOffset = (25 - safePctVal - smishingPctVal).toFixed(1);

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: 18,
        flex: 1,
        justifyContent: 'space-between',
        height: '100%',
      }}
    >
      {/* Top Section: Centered Clean Donut Graphic */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          padding: '8px 0',
        }}
      >
        <div
          style={{
            position: 'relative',
            width: 180,
            height: 180,
            flexShrink: 0,
          }}
        >
          <svg width="180" height="180" viewBox="0 0 42 42">
            {/* Background Track Ring */}
            <circle
              cx="21"
              cy="21"
              r="15.91549430918954"
              fill="transparent"
              stroke="var(--bg-surface-elevated)"
              strokeWidth="5"
            />

            {/* Safe Segment - Emerald */}
            <circle
              cx="21"
              cy="21"
              r="15.91549430918954"
              fill="transparent"
              stroke="#10b981"
              strokeWidth="5"
              strokeDasharray={safeDash}
              strokeDashoffset="25"
            />

            {/* Smishing Segment - Crimson */}
            <circle
              cx="21"
              cy="21"
              r="15.91549430918954"
              fill="transparent"
              stroke="#ef4444"
              strokeWidth="5.5"
              strokeDasharray={smishingDash}
              strokeDashoffset={smishingOffset}
            />

            {/* Suspicious Segment - Amber */}
            <circle
              cx="21"
              cy="21"
              r="15.91549430918954"
              fill="transparent"
              stroke="#f59e0b"
              strokeWidth="5.5"
              strokeDasharray={suspiciousDash}
              strokeDashoffset={suspiciousOffset}
            />
          </svg>

          <div
            style={{
              position: 'absolute',
              inset: 0,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              textAlign: 'center',
            }}
          >
            <strong
              style={{
                fontSize: '1.65rem',
                lineHeight: 1.1,
                color: '#ffffff',
                fontWeight: 800,
                fontFamily: 'var(--font-mono)',
                letterSpacing: '-0.02em',
              }}
            >
              {total.toLocaleString()}
            </strong>
            <span
              className="badge badge-gray"
              style={{
                fontSize: '0.6875rem',
                marginTop: 4,
                padding: '2px 8px',
              }}
            >
              📊 Total Reports
            </span>
          </div>
        </div>
      </div>

      {/* Middle Section: Uniformly Formatted Status Cards */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {/* Card 1: Likely Smishing */}
        <div
          style={{
            height: 58,
            padding: '0 16px',
            background:
              'linear-gradient(145deg, rgba(239, 68, 68, 0.14) 0%, rgba(15, 23, 42, 0.85) 100%)',
            border: '1px solid rgba(239, 68, 68, 0.35)',
            borderRadius: 12,
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            boxShadow: '0 4px 16px rgba(239, 68, 68, 0.1)',
            boxSizing: 'border-box',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <span style={{ fontSize: '1.15rem' }}>🚨</span>
            <div>
              <strong
                style={{
                  color: '#ffffff',
                  fontSize: '0.875rem',
                  display: 'block',
                  lineHeight: 1.2,
                }}
              >
                Likely Smishing
              </strong>
              <small
                style={{ color: 'var(--text-muted)', fontSize: '0.6875rem' }}
              >
                Flagged Threats
              </small>
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <strong
              style={{
                color: '#f87171',
                fontSize: '1.15rem',
                fontFamily: 'var(--font-mono)',
                fontWeight: 800,
                minWidth: 55,
                textAlign: 'right',
              }}
            >
              {smishing.toLocaleString()}
            </strong>
            <span
              className="badge badge-red"
              style={{
                fontSize: '0.75rem',
                fontWeight: 800,
                minWidth: 52,
                textAlign: 'center',
                padding: '4px 8px',
              }}
            >
              {smishingPct}%
            </span>
          </div>
        </div>

        {/* Card 2: Suspicious */}
        <div
          style={{
            height: 58,
            padding: '0 16px',
            background:
              'linear-gradient(145deg, rgba(245, 158, 11, 0.14) 0%, rgba(15, 23, 42, 0.85) 100%)',
            border: '1px solid rgba(245, 158, 11, 0.35)',
            borderRadius: 12,
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            boxShadow: '0 4px 16px rgba(245, 158, 11, 0.1)',
            boxSizing: 'border-box',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <span style={{ fontSize: '1.15rem' }}>⚠️</span>
            <div>
              <strong
                style={{
                  color: '#ffffff',
                  fontSize: '0.875rem',
                  display: 'block',
                  lineHeight: 1.2,
                }}
              >
                Suspicious
              </strong>
              <small
                style={{ color: 'var(--text-muted)', fontSize: '0.6875rem' }}
              >
                Pending Review
              </small>
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <strong
              style={{
                color: '#fbbf24',
                fontSize: '1.15rem',
                fontFamily: 'var(--font-mono)',
                fontWeight: 800,
                minWidth: 55,
                textAlign: 'right',
              }}
            >
              {suspicious.toLocaleString()}
            </strong>
            <span
              className="badge badge-amber"
              style={{
                fontSize: '0.75rem',
                fontWeight: 800,
                minWidth: 52,
                textAlign: 'center',
                padding: '4px 8px',
              }}
            >
              {suspiciousPct}%
            </span>
          </div>
        </div>

        {/* Card 3: Safe / Legitimate */}
        <div
          style={{
            height: 58,
            padding: '0 16px',
            background:
              'linear-gradient(145deg, rgba(16, 185, 129, 0.14) 0%, rgba(15, 23, 42, 0.85) 100%)',
            border: '1px solid rgba(16, 185, 129, 0.35)',
            borderRadius: 12,
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            boxShadow: '0 4px 16px rgba(16, 185, 129, 0.1)',
            boxSizing: 'border-box',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <span style={{ fontSize: '1.15rem' }}>🛡️</span>
            <div>
              <strong
                style={{
                  color: '#ffffff',
                  fontSize: '0.875rem',
                  display: 'block',
                  lineHeight: 1.2,
                }}
              >
                Safe / Legitimate
              </strong>
              <small
                style={{ color: 'var(--text-muted)', fontSize: '0.6875rem' }}
              >
                Verified Normal
              </small>
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <strong
              style={{
                color: '#34d399',
                fontSize: '1.15rem',
                fontFamily: 'var(--font-mono)',
                fontWeight: 800,
                minWidth: 55,
                textAlign: 'right',
              }}
            >
              {safe.toLocaleString()}
            </strong>
            <span
              className="badge badge-green"
              style={{
                fontSize: '0.75rem',
                fontWeight: 800,
                minWidth: 52,
                textAlign: 'center',
                padding: '4px 8px',
              }}
            >
              {safePct}%
            </span>
          </div>
        </div>
      </div>

      {/* Bottom Section: Model Inference Metrics */}
      <div
        style={{
          background: 'linear-gradient(145deg, #101524 0%, #0a0d17 100%)',
          border: '1px solid var(--border-default)',
          borderRadius: 14,
          padding: '16px 18px',
          display: 'flex',
          flexDirection: 'column',
          gap: 12,
        }}
      >
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
          }}
        >
          <span
            style={{
              fontSize: '0.75rem',
              fontWeight: 700,
              color: 'var(--text-secondary)',
              textTransform: 'uppercase',
              letterSpacing: '0.06em',
            }}
          >
            Model Inference Metrics
          </span>
          <span
            className="badge badge-purple"
            style={{ fontSize: '0.6875rem', fontWeight: 700 }}
          >
            XLM-RoBERTa v3.1
          </span>
        </div>

        <div
          style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}
        >
          <div
            style={{
              background: 'rgba(0, 0, 0, 0.35)',
              padding: '10px 12px',
              borderRadius: 10,
              border: '1px solid var(--border-subtle)',
            }}
          >
            <small
              style={{
                color: 'var(--text-muted)',
                display: 'block',
                fontSize: '0.6875rem',
                fontWeight: 600,
                textTransform: 'uppercase',
              }}
            >
              Confidence Accuracy
            </small>
            <strong
              style={{
                color: '#34d399',
                fontSize: '1.05rem',
                fontFamily: 'var(--font-mono)',
                fontWeight: 800,
              }}
            >
              94.2%
            </strong>
          </div>

          <div
            style={{
              background: 'rgba(0, 0, 0, 0.35)',
              padding: '10px 12px',
              borderRadius: 10,
              border: '1px solid var(--border-subtle)',
            }}
          >
            <small
              style={{
                color: 'var(--text-muted)',
                display: 'block',
                fontSize: '0.6875rem',
                fontWeight: 600,
                textTransform: 'uppercase',
              }}
            >
              Avg Inference Speed
            </small>
            <strong
              style={{
                color: '#60a5fa',
                fontSize: '1.05rem',
                fontFamily: 'var(--font-mono)',
                fontWeight: 800,
              }}
            >
              42ms / msg
            </strong>
          </div>
        </div>

        <div>
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              fontSize: '0.75rem',
              marginBottom: 6,
            }}
          >
            <span style={{ color: 'var(--text-secondary)', fontWeight: 600 }}>
              Smishing Precision Ratio
            </span>
            <strong
              style={{ color: '#ffffff', fontFamily: 'var(--font-mono)' }}
            >
              96.8%
            </strong>
          </div>
          <div
            style={{
              height: 6,
              background: 'rgba(255, 255, 255, 0.08)',
              borderRadius: 4,
              overflow: 'hidden',
            }}
          >
            <div
              style={{
                width: '96.8%',
                height: '100%',
                background: 'linear-gradient(90deg, #2563eb 0%, #10b981 100%)',
                borderRadius: 4,
              }}
            />
          </div>
        </div>
      </div>
    </div>
  );
};
