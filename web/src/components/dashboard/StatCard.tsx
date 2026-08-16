import React from 'react';

interface StatCardProps {
  title: string;
  value: string;
  subtext?: string;
  trend?: string;
  trendUp?: boolean;
  icon?: string;
  iconBg?: string;
}

export const StatCard: React.FC<StatCardProps> = ({
  title,
  value,
  subtext,
  trend,
  trendUp = true,
  icon = '📊',
  iconBg = 'rgba(124, 58, 237, 0.15)',
}) => {
  return (
    <div className="stat-card">
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-start',
        }}
      >
        <small>{title}</small>
        <div
          style={{
            width: 36,
            height: 36,
            borderRadius: 8,
            background: iconBg,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '1.125rem',
          }}
        >
          {icon}
        </div>
      </div>

      <div style={{ display: 'flex', alignItems: 'baseline', gap: 10 }}>
        <strong>{value}</strong>
        {trend && (
          <span
            style={{
              fontSize: '0.75rem',
              fontWeight: 700,
              color: trendUp ? 'var(--green-text)' : 'var(--red-text)',
              display: 'inline-flex',
              alignItems: 'center',
              gap: 2,
            }}
          >
            {trendUp ? '↑' : '↓'} {trend}
          </span>
        )}
      </div>

      {subtext && (
        <span style={{ color: 'var(--text-muted)', fontSize: '0.75rem' }}>
          {subtext}
        </span>
      )}
    </div>
  );
};
