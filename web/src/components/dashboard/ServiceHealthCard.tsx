import React from 'react';

interface ServiceHealthCardProps {
  name: string;
  status: 'Operational' | 'Warning' | 'Critical' | 'Maintenance';
  latency: number;
  uptime: string;
  icon?: string;
}

export const ServiceHealthCard: React.FC<ServiceHealthCardProps> = ({
  name,
  status,
  latency,
  uptime,
  icon = '⚡',
}) => {
  const isOk = status === 'Operational';
  const isWarn = status === 'Warning';

  const badgeClass = isOk ? 'badge-green' : isWarn ? 'badge-amber' : 'badge-red';
  const statusIcon = isOk ? '🟢' : isWarn ? '🟡' : '🔴';

  return (
    <div
      style={{
        background: 'var(--bg-surface-elevated)',
        border: '1px solid var(--border-default)',
        borderRadius: 10,
        padding: '16px 18px',
        display: 'flex',
        flexDirection: 'column',
        gap: 12,
        transition: 'transform 0.2s ease, border-color 0.2s ease',
        minWidth: 0,
        boxSizing: 'border-box',
      }}
      className="panel-hover"
    >
      {/* Top Header Row */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0, flex: 1 }}>
          <span style={{ fontSize: '1.25rem', flexShrink: 0 }}>{icon}</span>
          <strong
            style={{
              fontSize: '0.9375rem',
              color: 'var(--text-primary)',
              lineHeight: 1.2,
              wordBreak: 'break-word',
            }}
          >
            {name}
          </strong>
        </div>

        <span
          className={`badge ${badgeClass}`}
          style={{
            fontSize: '0.75rem',
            padding: '4px 10px',
            flexShrink: 0,
            whiteSpace: 'nowrap',
            alignSelf: 'flex-start',
          }}
        >
          {statusIcon} {status}
        </span>
      </div>

      {/* Metrics Row */}
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8125rem', color: 'var(--text-muted)', paddingTop: 4 }}>
        <span>
          Latency: <strong style={{ color: 'var(--text-secondary)' }}>{latency}ms</strong>
        </span>
        <span>
          Uptime: <strong style={{ color: 'var(--green-text)' }}>{uptime}</strong>
        </span>
      </div>

      {/* Progress Bar */}
      <div style={{ height: 4, width: '100%', background: 'var(--bg-input)', borderRadius: 2, overflow: 'hidden' }}>
        <div
          style={{
            height: '100%',
            width: uptime,
            background: isOk ? 'var(--green-text)' : isWarn ? 'var(--amber-text)' : 'var(--red-text)',
            borderRadius: 2,
          }}
        />
      </div>
    </div>
  );
};
