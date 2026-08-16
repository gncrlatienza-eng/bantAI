import React from 'react';
import { Badge } from '../common/Badge';

interface CampaignCardProps {
  title: string;
  messages: string;
  domains: string;
  since: string;
  status: string;
  tags: string[];
  severity?: 'Critical' | 'High' | 'Medium' | 'Low';
}

export const CampaignCard: React.FC<CampaignCardProps> = ({
  title,
  messages,
  domains,
  since,
  status,
  tags,
  severity = 'Critical',
}) => {
  const sevTone =
    severity === 'Critical' ? 'red' : severity === 'High' ? 'amber' : 'blue';

  return (
    <div
      className="panel card-hover-effect campaign-card-interactive"
      style={{
        background: 'var(--bg-card)',
        border: '1px solid var(--border-default)',
        borderRadius: 12,
        padding: 20,
        display: 'flex',
        flexDirection: 'column',
        gap: 16,
        cursor: 'pointer',
      }}
    >
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-start',
          gap: 12,
        }}
      >
        <div>
          <Badge tone={sevTone} className="mb-2">
            🚨 {severity} Severity
          </Badge>
          <h4
            style={{
              fontSize: '1.0625rem',
              marginTop: 6,
              color: 'var(--text-primary)',
            }}
          >
            {title}
          </h4>
        </div>
        <span className="badge badge-green">{status}</span>
      </div>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: '1fr 1fr 1fr',
          gap: 12,
          background: 'var(--bg-surface-elevated)',
          padding: 12,
          borderRadius: 8,
          textAlign: 'center',
        }}
      >
        <div>
          <strong
            style={{
              display: 'block',
              fontSize: '1.125rem',
              color: 'var(--text-primary)',
            }}
          >
            {messages}
          </strong>
          <small style={{ color: 'var(--text-muted)', fontSize: '0.6875rem' }}>
            Messages
          </small>
        </div>
        <div>
          <strong
            style={{
              display: 'block',
              fontSize: '1.125rem',
              color: 'var(--text-primary)',
            }}
          >
            {domains}
          </strong>
          <small style={{ color: 'var(--text-muted)', fontSize: '0.6875rem' }}>
            Domains
          </small>
        </div>
        <div>
          <strong
            style={{
              display: 'block',
              fontSize: '1.125rem',
              color: 'var(--text-primary)',
            }}
          >
            {since}
          </strong>
          <small style={{ color: 'var(--text-muted)', fontSize: '0.6875rem' }}>
            First Seen
          </small>
        </div>
      </div>

      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
        {tags.map((t) => (
          <span
            key={t}
            className="badge badge-gray"
            style={{ fontSize: '0.6875rem' }}
          >
            {t}
          </span>
        ))}
      </div>
    </div>
  );
};
