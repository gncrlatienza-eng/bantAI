import React, { useCallback, useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { AppShell, PageHeader } from '../../components/appshell/AppShell';
import {
  Button,
  EmptyState,
  ErrorState,
  LoadingState,
} from '../../components/primitives';
import { ROUTES } from '../../constants/routes';
import { useAccountState } from '../../context/AccountStateContext';
import { logout } from '../../services/authService';
import {
  createShieldApiKey,
  listShieldApiKeys,
  revokeShieldApiKey,
  rotateShieldApiKey,
  getShieldApiUsage,
  type ShieldApiKey,
  type ShieldApiScope,
  type ShieldApiUsage,
} from '../../services/shieldApiKeysService';
import { useClientSidebarGroups } from './clientNav';

const scopeOptions: { value: ShieldApiScope; label: string }[] = [
  { value: 'READ_CAMPAIGNS', label: 'Campaigns' },
  { value: 'READ_INDICATORS', label: 'Indicators' },
  { value: 'READ_MASKED_MESSAGES', label: 'Reviewed masked messages' },
  { value: 'EXPORT_CAMPAIGNS', label: 'Campaign exports' },
];
const displayDate = (value: string | null) =>
  value ? new Date(value).toLocaleString() : 'Never';

export function ApiPage() {
  const groups = useClientSidebarGroups();
  const navigate = useNavigate();
  const location = useLocation();
  const workspace = useAccountState().state?.workspace;
  const organizationId = workspace?.organizationId;
  // Key management is only offered when the license includes API access;
  // otherwise every key call is refused (manual QA 2026-10-01, F3).
  const apiEnabled = Boolean(workspace?.features?.API_ACCESS);
  const [keys, setKeys] = useState<ShieldApiKey[]>([]);
  const [usage, setUsage] = useState<ShieldApiUsage | null>(null);
  const [name, setName] = useState('');
  const [scopes, setScopes] = useState<ShieldApiScope[]>(['READ_CAMPAIGNS']);
  const [secret, setSecret] = useState('');
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    if (!organizationId || !apiEnabled) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setError('');
    try {
      const [nextKeys, nextUsage] = await Promise.all([
        listShieldApiKeys(organizationId),
        getShieldApiUsage(organizationId),
      ]);
      setKeys(nextKeys);
      setUsage(nextUsage);
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : 'API keys could not be loaded.',
      );
    } finally {
      setLoading(false);
    }
  }, [organizationId, apiEnabled]);
  useEffect(() => {
    void load();
  }, [load]);

  async function manage(
    action: 'create' | 'rotate' | 'revoke',
    keyId?: string,
  ) {
    if (!organizationId || !apiEnabled) return;
    setBusy(true);
    setError('');
    setSecret('');
    try {
      if (action === 'create') {
        const created = await createShieldApiKey(organizationId, name, scopes);
        setSecret(created.secret);
        setName('');
      } else if (action === 'rotate' && keyId) {
        setSecret((await rotateShieldApiKey(organizationId, keyId)).secret);
      } else if (keyId) {
        await revokeShieldApiKey(organizationId, keyId);
      }
      await load();
    } catch (caught) {
      setError(
        caught instanceof Error ? caught.message : 'API key action failed.',
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <AppShell
      role="client"
      groups={groups}
      brandInitial="S"
      brandLabel="BantAI Shield"
      currentPath={location.pathname}
      onNavigate={(path) => void navigate(path)}
      topbarContext={<span>Shield &middot; API</span>}
      topbarUtility={
        <Button
          variant="ghost"
          size="sm"
          onClick={() => {
            logout();
            void navigate('/login');
          }}
        >
          Sign out
        </Button>
      }
      footer={<span>Shield intelligence subscription</span>}
    >
      <PageHeader
        title="Shield API"
        description="Create read-only keys for published campaign intelligence. Keys belong to your Shield account."
      />
      {!organizationId ? (
        <EmptyState
          title="No active Shield account"
          description="An active Shield subscription is required for API credentials."
        />
      ) : !apiEnabled ? (
        <EmptyState
          title="API access is not included in your license yet"
          description="API keys can be created once your Shield license includes API access. Until then, campaign intelligence is available in this portal and through exports."
          action={
            <Button
              variant="secondary"
              onClick={() => void navigate(ROUTES.SHIELD.DOCUMENTATION)}
            >
              Read the API documentation
            </Button>
          }
        />
      ) : (
        <>
          {secret && (
            <section
              role="status"
              aria-label="New API secret"
              style={{
                padding: 20,
                background: 'var(--surface-raised)',
                marginBottom: 24,
              }}
            >
              <strong>Copy this secret now. It will not be shown again.</strong>
              <code
                style={{
                  display: 'block',
                  overflowWrap: 'anywhere',
                  marginTop: 12,
                }}
              >
                {secret}
              </code>
              <Button variant="secondary" onClick={() => setSecret('')}>
                I have saved it
              </Button>
            </section>
          )}
          {usage && (
            <section
              aria-label="Your API usage"
              style={{
                padding: 20,
                background: 'var(--surface-raised)',
                marginBottom: 24,
              }}
            >
              <h2>Your usage</h2>
              <p>
                This period: {usage.requestsThisPeriod.toLocaleString()} /{' '}
                {usage.monthlyQuota.toLocaleString()} requests · Today:{' '}
                {usage.requestsToday.toLocaleString()} · Limit:{' '}
                {usage.rateLimitPerKeyPerMinute} requests/minute per key
              </p>
              <p>
                Recent success rate:{' '}
                {usage.recentSuccessRate === null
                  ? 'No completed requests'
                  : `${(usage.recentSuccessRate * 100).toFixed(1)}%`}
              </p>
              {usage.recent.length > 0 && (
                <div>
                  <h3>Recent activity</h3>
                  <ul>
                    {usage.recent.map((item, index) => (
                      <li key={`${item.keyId}-${item.createdAt}-${index}`}>
                        {new Date(item.createdAt).toLocaleString()} ·{' '}
                        {item.method} {item.route} ·{' '}
                        {item.statusCode ?? 'Pending'}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </section>
          )}
          <section
            aria-labelledby="create-key-heading"
            style={{
              padding: 20,
              background: 'var(--surface-raised)',
              marginBottom: 24,
            }}
          >
            <h2 id="create-key-heading">Create API key</h2>
            <label style={{ display: 'grid', gap: 6, maxWidth: 420 }}>
              Key name
              <input
                value={name}
                maxLength={120}
                onChange={(event) => setName(event.target.value)}
              />
            </label>
            <fieldset style={{ border: 0, padding: 0, marginTop: 16 }}>
              <legend>Read scopes</legend>
              {scopeOptions.map(({ value, label }) => (
                <label key={value} style={{ display: 'block', marginTop: 8 }}>
                  <input
                    type="checkbox"
                    checked={scopes.includes(value)}
                    onChange={(event) =>
                      setScopes(
                        event.target.checked
                          ? [...scopes, value]
                          : scopes.filter((scope) => scope !== value),
                      )
                    }
                  />{' '}
                  {label}
                </label>
              ))}
            </fieldset>
            <Button
              disabled={busy || !name.trim() || scopes.length === 0}
              onClick={() => void manage('create')}
            >
              {busy ? 'Working…' : 'Create key'}
            </Button>
          </section>
          <section aria-labelledby="keys-heading">
            <h2 id="keys-heading">Your API keys</h2>
            {loading ? (
              <LoadingState label="Loading API keys…" />
            ) : error && keys.length === 0 ? (
              <ErrorState
                title="API keys unavailable"
                description={error}
                action={
                  <Button variant="secondary" onClick={() => void load()}>
                    Retry
                  </Button>
                }
              />
            ) : keys.length === 0 ? (
              <EmptyState
                title="No API keys"
                description="Create a key to access the read-only Shield API."
              />
            ) : (
              <ul
                style={{
                  listStyle: 'none',
                  margin: 0,
                  padding: 0,
                  display: 'grid',
                  gap: 12,
                }}
              >
                {keys.map((key) => (
                  <li
                    key={key.id}
                    style={{ padding: 20, background: 'var(--surface-raised)' }}
                  >
                    <strong>{key.name}</strong>{' '}
                    <span>({key.status.toLowerCase()})</span>
                    <code style={{ display: 'block', marginTop: 8 }}>
                      {key.keyPrefix}••••••••{key.keySuffix}
                    </code>
                    <p>
                      Created {displayDate(key.createdAt)} · Last used{' '}
                      {displayDate(key.lastUsedAt)} · Expires{' '}
                      {key.expiresAt ? displayDate(key.expiresAt) : 'Never'}
                    </p>
                    <p>Scopes: {key.scopes.join(', ')}</p>
                    {key.status === 'ACTIVE' && (
                      <div style={{ display: 'flex', gap: 8 }}>
                        <Button
                          variant="secondary"
                          disabled={busy}
                          onClick={() => void manage('rotate', key.id)}
                        >
                          Rotate
                        </Button>
                        <Button
                          variant="ghost"
                          disabled={busy}
                          onClick={() => void manage('revoke', key.id)}
                        >
                          Revoke
                        </Button>
                      </div>
                    )}
                  </li>
                ))}
              </ul>
            )}
            {error && keys.length > 0 && <p role="alert">{error}</p>}
          </section>
        </>
      )}
    </AppShell>
  );
}

export default ApiPage;
