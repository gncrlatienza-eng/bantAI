import React, { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { PageHeader } from '../../components/appshell/AppShell';
import {
  Button,
  DataTable,
  EmptyState,
  ErrorState,
  Input,
  Metric,
  MetricRow,
  SectionHeader,
  StatPanel,
  StatusBadge,
  type Column,
} from '../../components/primitives';
import { ROUTES } from '../../constants/routes';
import { formatCompactDateTime } from '../../utils/dateFormat';
import { useAccountState } from '../../context/AccountStateContext';
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

const scopeOptions: { value: ShieldApiScope; label: string }[] = [
  { value: 'READ_CAMPAIGNS', label: 'Campaigns' },
  { value: 'READ_INDICATORS', label: 'Indicators' },
  { value: 'READ_MASKED_MESSAGES', label: 'Reviewed masked messages' },
  { value: 'EXPORT_CAMPAIGNS', label: 'Campaign exports' },
];
const SCOPE_LABEL = Object.fromEntries(
  scopeOptions.map((option) => [option.value, option.label]),
) as Record<string, string>;
const displayDate = (value: string | null) =>
  value ? formatCompactDateTime(new Date(value)) : 'Never';

export function ApiPage() {
  const navigate = useNavigate();
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

  const keyColumns: Column<ShieldApiKey>[] = [
    {
      key: 'name',
      header: 'Name',
      render: (key) => (
        <span style={{ display: 'grid', gap: 4, justifyItems: 'start' }}>
          <strong style={{ fontWeight: 600 }}>{key.name}</strong>
          <StatusBadge
            kind={key.status === 'ACTIVE' ? 'verified' : 'unknown'}
            label={key.status.charAt(0) + key.status.slice(1).toLowerCase()}
          />
        </span>
      ),
    },
    {
      key: 'key',
      header: 'Key',
      render: (key) => (
        <code style={{ fontFamily: 'var(--font-mono)', fontSize: '0.85rem' }}>
          {key.keyPrefix}••••{key.keySuffix}
        </code>
      ),
    },
    {
      key: 'scopes',
      header: 'Scopes',
      render: (key) =>
        key.scopes
          .map((scope) => SCOPE_LABEL[scope] ?? scope.toLowerCase())
          .join(', '),
    },
    {
      key: 'lastUsedAt',
      header: 'Last used',
      render: (key) => displayDate(key.lastUsedAt),
    },
    {
      key: 'expiresAt',
      header: 'Expires',
      render: (key) => (key.expiresAt ? displayDate(key.expiresAt) : 'Never'),
    },
    {
      key: 'actions',
      header: 'Actions',
      align: 'right',
      render: (key) =>
        key.status === 'ACTIVE' ? (
          <span style={{ display: 'inline-flex', gap: 8 }}>
            <Button
              variant="secondary"
              size="sm"
              disabled={busy}
              onClick={() => void manage('rotate', key.id)}
            >
              Rotate
            </Button>
            <Button
              variant="ghost"
              size="sm"
              disabled={busy}
              onClick={() => void manage('revoke', key.id)}
            >
              Revoke
            </Button>
          </span>
        ) : null,
    },
  ];

  const recentColumns: Column<ShieldApiUsage['recent'][number]>[] = [
    {
      key: 'createdAt',
      header: 'Time',
      render: (item) => displayDate(item.createdAt),
    },
    {
      key: 'route',
      header: 'Request',
      render: (item) => (
        <code style={{ fontFamily: 'var(--font-mono)', fontSize: '0.85rem' }}>
          {item.method} {item.route}
        </code>
      ),
    },
    {
      key: 'statusCode',
      header: 'Status',
      align: 'right',
      render: (item) => item.statusCode ?? 'Pending',
    },
  ];

  return (
    <>
      <PageHeader
        title="Shield API"
        description="Read-only keys for published campaign intelligence."
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
              className="bantai-secret"
            >
              <SectionHeader
                title="Copy this secret now"
                description="It is shown once. Store it in your secrets manager before leaving this page."
                actions={
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => setSecret('')}
                  >
                    I’ve saved it
                  </Button>
                }
              />
              <code className="bantai-secret__value">{secret}</code>
            </section>
          )}
          {usage && (
            <StatPanel
              label="API usage"
              facts={[
                {
                  label: 'Rate limit',
                  value: `${usage.rateLimitPerKeyPerMinute} requests / min per key`,
                },
              ]}
            >
              <MetricRow columns={3}>
                <Metric
                  label="This period"
                  value={usage.requestsThisPeriod.toLocaleString()}
                  meta={`of ${usage.monthlyQuota.toLocaleString()} requests`}
                />
                <Metric
                  label="Today"
                  value={usage.requestsToday.toLocaleString()}
                />
                <Metric
                  label="Success rate"
                  value={
                    usage.recentSuccessRate === null
                      ? '—'
                      : `${(usage.recentSuccessRate * 100).toFixed(1)}%`
                  }
                  meta={
                    usage.recentSuccessRate === null
                      ? 'No completed requests yet'
                      : 'Recent requests'
                  }
                />
              </MetricRow>
            </StatPanel>
          )}
          <section aria-labelledby="keys-heading" style={{ marginBottom: 32 }}>
            <SectionHeader id="keys-heading" title="API keys" />
            {error && keys.length === 0 && !loading ? (
              <ErrorState
                title="API keys unavailable"
                description={error}
                action={
                  <Button variant="secondary" onClick={() => void load()}>
                    Retry
                  </Button>
                }
              />
            ) : (
              <DataTable<ShieldApiKey>
                ariaLabel="Your API keys"
                rowKey={(key) => key.id}
                rows={keys}
                columns={keyColumns}
                loading={loading}
                emptyState={
                  <EmptyState
                    title="No API keys"
                    description="Create a key below to call the read-only Shield API."
                  />
                }
              />
            )}
            {error && keys.length > 0 && (
              <p role="alert" style={{ color: 'var(--status-threat)' }}>
                {error}
              </p>
            )}
          </section>
          <section
            aria-labelledby="create-key-heading"
            className="bantai-formcard"
          >
            <SectionHeader
              id="create-key-heading"
              title="Create API key"
              description="Keys are read-only. Give each integration only the scopes it needs."
            />
            <div style={{ display: 'grid', gap: 16, maxWidth: 420 }}>
              <Input
                label="Key name"
                value={name}
                maxLength={120}
                onChange={(event) => setName(event.target.value)}
              />
              <fieldset className="bantai-checkgroup">
                <legend>Read scopes</legend>
                {scopeOptions.map(({ value, label }) => (
                  <label key={value}>
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
                    />
                    {label}
                  </label>
                ))}
              </fieldset>
              <div>
                <Button
                  disabled={busy || !name.trim() || scopes.length === 0}
                  onClick={() => void manage('create')}
                >
                  {busy ? 'Working…' : 'Create key'}
                </Button>
              </div>
            </div>
          </section>
          {usage && usage.recent.length > 0 && (
            <section
              aria-labelledby="recent-requests-heading"
              style={{ marginTop: 32 }}
            >
              <SectionHeader
                id="recent-requests-heading"
                title="Recent requests"
              />
              <DataTable<ShieldApiUsage['recent'][number]>
                ariaLabel="Recent API requests"
                rowKey={(item) =>
                  `${item.keyId}-${item.createdAt}-${item.route}`
                }
                rows={usage.recent}
                columns={recentColumns}
              />
            </section>
          )}
        </>
      )}
    </>
  );
}

export default ApiPage;
