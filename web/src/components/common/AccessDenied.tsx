import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Button, StatusBadge } from '../primitives';
import { ErrorIcon } from '../primitives/icons';

export interface AccessDeniedProps {
  title?: string;
  reason?: string;
  currentTier?: string;
  requiredTier?: string;
  onReturn?: () => void;
  returnPath?: string;
  returnLabel?: string;
  showUpgrade?: boolean;
}

export const AccessDenied: React.FC<AccessDeniedProps> = ({
  title = 'Access Denied',
  reason = 'You do not have the required entitlements or license permissions to access this surface.',
  currentTier,
  requiredTier,
  onReturn,
  returnPath = '/client/overview',
  returnLabel = 'Return to Overview',
  showUpgrade = true,
}) => {
  const navigate = useNavigate();

  const handleReturn = () => {
    if (onReturn) {
      onReturn();
    } else {
      void navigate(returnPath);
    }
  };

  const handleUpgrade = () => {
    void navigate('/request-access');
  };

  return (
    <section
      role="region"
      aria-labelledby="access-denied-title"
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '64px 24px',
        textAlign: 'center',
        maxWidth: 580,
        margin: '0 auto',
      }}
    >
      <div
        style={{
          width: 56,
          height: 56,
          borderRadius: 28,
          background: 'var(--surface-raised)',
          border: '1px solid var(--border-default)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          marginBottom: 20,
          color: 'var(--status-critical, #dc2626)',
        }}
        aria-hidden
      >
        <ErrorIcon size={32} />
      </div>

      <div
        style={{
          fontSize: '0.75rem',
          textTransform: 'uppercase',
          letterSpacing: '0.08em',
          fontWeight: 700,
          color: 'var(--status-critical, #dc2626)',
          marginBottom: 8,
        }}
      >
        HTTP 403 Forbidden &middot; Authorization Required
      </div>

      <h1
        id="access-denied-title"
        style={{
          fontSize: '1.5rem',
          fontWeight: 700,
          color: 'var(--text-primary)',
          margin: '0 0 12px 0',
          lineHeight: 1.25,
        }}
      >
        {title}
      </h1>

      <p
        style={{
          fontSize: '0.95rem',
          color: 'var(--text-secondary)',
          lineHeight: 1.55,
          margin: '0 0 24px 0',
        }}
      >
        {reason}
      </p>

      {(currentTier || requiredTier) && (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 16,
            padding: '12px 18px',
            background: 'var(--surface-raised)',
            border: '1px solid var(--border-default)',
            borderRadius: 8,
            marginBottom: 28,
            fontSize: '0.85rem',
          }}
        >
          {currentTier && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <span style={{ color: 'var(--text-secondary)' }}>
                Current Tier:
              </span>
              <StatusBadge kind="unknown" label={currentTier} />
            </div>
          )}
          {requiredTier && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <span style={{ color: 'var(--text-secondary)' }}>
                Required Tier:
              </span>
              <StatusBadge kind="verified" label={requiredTier} />
            </div>
          )}
        </div>
      )}

      <div
        style={{
          display: 'flex',
          gap: 12,
          flexWrap: 'wrap',
          justifyContent: 'center',
        }}
      >
        <Button variant="primary" onClick={handleReturn}>
          {returnLabel}
        </Button>
        {showUpgrade && (
          <Button variant="secondary" onClick={handleUpgrade}>
            Request License Upgrade &rarr;
          </Button>
        )}
      </div>
    </section>
  );
};

export default AccessDenied;
