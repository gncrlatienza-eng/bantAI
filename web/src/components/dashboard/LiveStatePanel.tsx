import React from 'react';

interface LiveStatePanelProps {
  title: string;
  message: string;
  tone?: 'neutral' | 'error';
  action?: React.ReactNode;
}

export const LiveStatePanel: React.FC<LiveStatePanelProps> = ({
  title,
  message,
  tone = 'neutral',
  action,
}) => (
  <section
    className="panel"
    role={tone === 'error' ? 'alert' : 'status'}
    aria-live={tone === 'error' ? 'assertive' : 'polite'}
    style={{
      minHeight: 180,
      display: 'grid',
      placeItems: 'center',
      padding: 32,
      textAlign: 'center',
    }}
  >
    <div style={{ maxWidth: 560 }}>
      <h2
        style={{
          margin: 0,
          color: tone === 'error' ? 'var(--red-text)' : 'var(--text-primary)',
          fontSize: '1.125rem',
        }}
      >
        {title}
      </h2>
      <p
        style={{
          color: 'var(--text-secondary)',
          margin: '10px 0 0',
          lineHeight: 1.6,
        }}
      >
        {message}
      </p>
      {action ? <div style={{ marginTop: 18 }}>{action}</div> : null}
    </div>
  </section>
);
