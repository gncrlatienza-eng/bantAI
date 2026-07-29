import React, { useState } from 'react';

interface BarData {
  label: string;
  value: number;
  smishing: number;
  suspicious: number;
}

const DATA: BarData[] = [
  { label: 'Mon', value: 240, smishing: 180, suspicious: 60 },
  { label: 'Tue', value: 380, smishing: 310, suspicious: 70 },
  { label: 'Wed', value: 520, smishing: 420, suspicious: 100 },
  { label: 'Thu', value: 680, smishing: 540, suspicious: 140 },
  { label: 'Fri', value: 950, smishing: 790, suspicious: 160 },
  { label: 'Sat', value: 710, smishing: 580, suspicious: 130 },
  { label: 'Sun', value: 430, smishing: 350, suspicious: 80 },
];

export const BarChart: React.FC = () => {
  const [hoveredIdx, setHoveredIdx] = useState<number | null>(null);
  const maxVal = 1000;

  return (
    <div style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.8125rem' }}>
        <div style={{ display: 'flex', gap: 16 }}>
          <span style={{ display: 'flex', alignItems: 'center', gap: 6, color: 'var(--text-secondary)' }}>
            <span style={{ width: 10, height: 10, borderRadius: 2, background: 'linear-gradient(180deg, #f87171, #ef4444)' }} />
            Smishing
          </span>
          <span style={{ display: 'flex', alignItems: 'center', gap: 6, color: 'var(--text-secondary)' }}>
            <span style={{ width: 10, height: 10, borderRadius: 2, background: 'linear-gradient(180deg, #fbbf24, #f59e0b)' }} />
            Suspicious
          </span>
        </div>
        <span style={{ color: 'var(--text-muted)' }}>Past 7 Days</span>
      </div>

      <div style={{ height: 220, position: 'relative', display: 'flex', alignItems: 'flex-end', gap: 16, paddingTop: 20, paddingBottom: 24, borderBottom: '1px solid var(--border-subtle)' }}>
        {DATA.map((item, idx) => {
          const smishingHeight = (item.smishing / maxVal) * 160;
          const suspiciousHeight = (item.suspicious / maxVal) * 160;
          const isHovered = hoveredIdx === idx;

          return (
            <div
              key={item.label}
              onMouseEnter={() => setHoveredIdx(idx)}
              onMouseLeave={() => setHoveredIdx(null)}
              style={{
                flex: 1,
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'flex-end',
                height: '100%',
                position: 'relative',
                cursor: 'pointer',
              }}
            >
              {isHovered && (
                <div
                  className="animate-scale-in"
                  style={{
                    position: 'absolute',
                    top: -45,
                    background: '#1a1a28',
                    border: '1px solid var(--border-active)',
                    borderRadius: 6,
                    padding: '6px 10px',
                    fontSize: '0.75rem',
                    color: 'var(--text-primary)',
                    boxShadow: '0 4px 12px rgba(0,0,0,0.5)',
                    whiteSpace: 'nowrap',
                    zIndex: 10,
                  }}
                >
                  <div><strong>{item.label}:</strong> {item.value} reports</div>
                  <div style={{ color: 'var(--red-text)' }}>Smishing: {item.smishing}</div>
                </div>
              )}

              <div style={{ width: '100%', maxWidth: 36, display: 'flex', flexDirection: 'column-reverse', borderRadius: '6px 6px 0 0', overflow: 'hidden' }}>
                <div
                  style={{
                    height: `${smishingHeight}px`,
                    background: isHovered ? 'linear-gradient(180deg, #f87171, #ef4444)' : 'linear-gradient(180deg, rgba(248,113,113,0.85), rgba(239,68,68,0.7))',
                    transition: 'all 0.2s ease',
                  }}
                />
                <div
                  style={{
                    height: `${suspiciousHeight}px`,
                    background: isHovered ? 'linear-gradient(180deg, #fbbf24, #f59e0b)' : 'linear-gradient(180deg, rgba(251,191,36,0.85), rgba(245,158,11,0.7))',
                    transition: 'all 0.2s ease',
                  }}
                />
              </div>

              <span
                style={{
                  position: 'absolute',
                  bottom: -24,
                  fontSize: '0.75rem',
                  color: isHovered ? 'var(--text-primary)' : 'var(--text-muted)',
                  fontWeight: isHovered ? 700 : 500,
                }}
              >
                {item.label}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
};
