import React from 'react';

export const DonutChart: React.FC = () => {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 24, padding: '12px 0' }}>
      <div style={{ position: 'relative', width: 140, height: 140 }}>
        <svg width="140" height="140" viewBox="0 0 42 42">
          {/* Background Ring */}
          <circle cx="21" cy="21" r="15.91549430918954" fill="transparent" stroke="var(--bg-surface-elevated)" strokeWidth="5" />

          {/* Safe Segment (89%) - Green */}
          <circle
            cx="21"
            cy="21"
            r="15.91549430918954"
            fill="transparent"
            stroke="#10b981"
            strokeWidth="5"
            strokeDasharray="89 11"
            strokeDashoffset="25"
          />

          {/* Smishing Segment (8.3%) - Red */}
          <circle
            cx="21"
            cy="21"
            r="15.91549430918954"
            fill="transparent"
            stroke="#ef4444"
            strokeWidth="5.5"
            strokeDasharray="8.3 91.7"
            strokeDashoffset="-64"
          />

          {/* Suspicious Segment (2.7%) - Yellow */}
          <circle
            cx="21"
            cy="21"
            r="15.91549430918954"
            fill="transparent"
            stroke="#f59e0b"
            strokeWidth="5.5"
            strokeDasharray="2.7 97.3"
            strokeDashoffset="-72.3"
          />
        </svg>

        <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', textAlign: 'center' }}>
          <strong style={{ fontSize: '1.25rem', lineHeight: 1 }}>14,892</strong>
          <small style={{ fontSize: '0.6875rem', color: 'var(--text-muted)' }}>Total Reports</small>
        </div>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 10, fontSize: '0.8125rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ width: 10, height: 10, borderRadius: '50%', background: '#ef4444' }} />
          <span>Likely Smishing: <strong style={{ color: 'var(--red-text)' }}>1,247 (8.3%)</strong></span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ width: 10, height: 10, borderRadius: '50%', background: '#f59e0b' }} />
          <span>Suspicious: <strong style={{ color: 'var(--amber-text)' }}>389 (2.6%)</strong></span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ width: 10, height: 10, borderRadius: '50%', background: '#10b981' }} />
          <span>Safe / Unknown: <strong style={{ color: 'var(--green-text)' }}>13,256 (89.1%)</strong></span>
        </div>
      </div>
    </div>
  );
};
