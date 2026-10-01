import { useCallback, useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { AppShell, PageHeader } from '../../components/appshell/AppShell';
import {
  Button,
  DataTable,
  Dialog,
  EmptyState,
  ErrorState,
  Input,
  LoadingState,
  Metric,
  MetricRow,
  type Column,
} from '../../components/primitives';
import {
  getAdminShieldUsage,
  listAdminShieldApiKeys,
  revokeAdminShieldApiKey,
  listAdminShieldOrganizations,
  updateAdminShieldApiLimits,
  type AdminShieldApiKey,
  type AdminShieldOrganization,
  type AdminShieldUsage,
} from '../../services/adminShieldApiKeysService';
import { ADMIN_SIDEBAR_GROUPS } from './adminNav';

// Mirrors backend UpdateShieldApiLimitsDto bounds.
const MAX_MONTHLY_QUOTA = 10_000_000;
const MAX_RATE_PER_MINUTE = 10_000;

type RecentRequest = AdminShieldUsage['recent'][number] & { rowId: string };

interface LimitDraft {
  monthlyQuota: string;
  rateLimitPerMinute: string;
}

const MUTED = { color: 'var(--text-secondary)' } as const;
const MONO = { fontFamily: 'var(--font-mono)', fontSize: '0.85rem' } as const;
const SECTION_TITLE = { margin: 0, fontSize: '1rem', fontWeight: 600 } as const;

function errorText(error: unknown, fallback: string): string {
  return error instanceof Error ? error.message : fallback;
}

function formatDateTime(value: string | null): string {
  if (!value) return 'Never';
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? '—'
    : date.toLocaleString(undefined, {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
      });
}

function formatScope(scope: string): string {
  return scope.toLowerCase().replace(/_/g, ' ');
}

function isWholeNumberInRange(value: string, max: number): boolean {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed >= 1 && parsed <= max;
}

function SectionHeader({
  id,
  title,
  description,
}: {
  id: string;
  title: string;
  description: string;
}) {
  return (
    <div style={{ marginBottom: 12 }}>
      <h2 id={id} style={SECTION_TITLE}>
        {title}
      </h2>
      <p style={{ ...MUTED, margin: '4px 0 0', fontSize: '0.9rem' }}>
        {description}
      </p>
    </div>
  );
}

export function ApiKeysPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const [keys, setKeys] = useState<AdminShieldApiKey[]>([]);
  const [organizations, setOrganizations] = useState<AdminShieldOrganization[]>(
    [],
  );
  const [draftLimits, setDraftLimits] = useState<Record<string, LimitDraft>>(
    {},
  );
  const [usage, setUsage] = useState<AdminShieldUsage | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [actionError, setActionError] = useState('');
  const [notice, setNotice] = useState('');
  const [busyId, setBusyId] = useState('');
  const [pendingRevoke, setPendingRevoke] = useState<AdminShieldApiKey | null>(
    null,
  );

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError('');
    try {
      const [nextKeys, nextUsage, nextOrganizations] = await Promise.all([
        listAdminShieldApiKeys(),
        getAdminShieldUsage(),
        listAdminShieldOrganizations(),
      ]);
      setKeys(nextKeys);
      setUsage(nextUsage);
      setOrganizations(nextOrganizations);
      setDraftLimits(
        Object.fromEntries(
          nextOrganizations.map((organization) => [
            organization.id,
            {
              monthlyQuota: String(organization.apiMonthlyQuota),
              rateLimitPerMinute: String(organization.apiRateLimitPerMinute),
            },
          ]),
        ),
      );
    } catch (caught) {
      setLoadError(errorText(caught, 'API management is unavailable.'));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const organizationNames = useMemo(
    () => new Map(organizations.map((org) => [org.id, org.name])),
    [organizations],
  );

  const requestsByOrganization = useMemo(
    () =>
      new Map(
        (usage?.byOrganization ?? []).map((entry) => [
          entry.organizationId,
          entry.requests,
        ]),
      ),
    [usage],
  );

  const recentRequests = useMemo<RecentRequest[]>(
    () =>
      (usage?.recent ?? []).map((item, index) => ({
        ...item,
        rowId: `${item.keyId}-${item.createdAt}-${index}`,
      })),
    [usage],
  );

  const activeKeyCount = keys.filter((key) => key.status === 'ACTIVE').length;

  function updateDraft(
    organizationId: string,
    field: keyof LimitDraft,
    value: string,
  ) {
    setDraftLimits((previous) => ({
      ...previous,
      [organizationId]: {
        monthlyQuota: previous[organizationId]?.monthlyQuota ?? '',
        rateLimitPerMinute: previous[organizationId]?.rateLimitPerMinute ?? '',
        [field]: value,
      },
    }));
  }

  async function saveLimits(organization: AdminShieldOrganization) {
    const draft = draftLimits[organization.id];
    if (!draft) return;
    setBusyId(organization.id);
    setActionError('');
    setNotice('');
    try {
      const updated = await updateAdminShieldApiLimits(
        organization.id,
        Number(draft.monthlyQuota),
        Number(draft.rateLimitPerMinute),
      );
      setOrganizations((current) =>
        current.map((org) =>
          org.id === updated.id
            ? {
                ...org,
                apiMonthlyQuota: updated.apiMonthlyQuota,
                apiRateLimitPerMinute: updated.apiRateLimitPerMinute,
              }
            : org,
        ),
      );
      setDraftLimits((previous) => ({
        ...previous,
        [updated.id]: {
          monthlyQuota: String(updated.apiMonthlyQuota),
          rateLimitPerMinute: String(updated.apiRateLimitPerMinute),
        },
      }));
      setNotice(`Limits saved for ${organization.name}.`);
    } catch (caught) {
      setActionError(errorText(caught, 'API limits could not be updated.'));
    } finally {
      setBusyId('');
    }
  }

  async function confirmRevoke() {
    if (!pendingRevoke) return;
    const target = pendingRevoke;
    setBusyId(target.id);
    setActionError('');
    setNotice('');
    try {
      const revoked = await revokeAdminShieldApiKey(target.id);
      setKeys((current) =>
        current.map((key) =>
          key.id === target.id ? { ...key, status: revoked.status } : key,
        ),
      );
      setPendingRevoke(null);
      setNotice(`Revoked "${target.name}" for ${target.organization.name}.`);
    } catch (caught) {
      setActionError(errorText(caught, 'The key could not be revoked.'));
    } finally {
      setBusyId('');
    }
  }

  const limitColumns: Column<AdminShieldOrganization>[] = [
    {
      key: 'account',
      header: 'Account',
      render: (org) => (
        <span>
          <strong>{org.name}</strong>
          <br />
          <span style={MUTED}>{org.isActive ? 'Active' : 'Inactive'}</span>
        </span>
      ),
    },
    {
      key: 'used',
      header: 'Used this month',
      align: 'right',
      render: (org) => {
        const used = requestsByOrganization.get(org.id) ?? 0;
        return (
          <span>
            {used.toLocaleString()}
            <br />
            <span style={{ ...MUTED, fontSize: '0.8rem' }}>
              of {org.apiMonthlyQuota.toLocaleString()}
            </span>
          </span>
        );
      },
    },
    {
      key: 'quota',
      header: 'Monthly quota',
      width: '180px',
      render: (org) => {
        const value = draftLimits[org.id]?.monthlyQuota ?? '';
        return (
          <Input
            aria-label={`Monthly quota for ${org.name}`}
            type="number"
            inputMode="numeric"
            min={1}
            max={MAX_MONTHLY_QUOTA}
            value={value}
            aria-invalid={
              isWholeNumberInRange(value, MAX_MONTHLY_QUOTA)
                ? undefined
                : 'true'
            }
            onChange={(event) =>
              updateDraft(org.id, 'monthlyQuota', event.target.value)
            }
          />
        );
      },
    },
    {
      key: 'rate',
      header: 'Per-key requests / min',
      width: '180px',
      render: (org) => {
        const value = draftLimits[org.id]?.rateLimitPerMinute ?? '';
        return (
          <Input
            aria-label={`Per-key requests per minute for ${org.name}`}
            type="number"
            inputMode="numeric"
            min={1}
            max={MAX_RATE_PER_MINUTE}
            value={value}
            aria-invalid={
              isWholeNumberInRange(value, MAX_RATE_PER_MINUTE)
                ? undefined
                : 'true'
            }
            onChange={(event) =>
              updateDraft(org.id, 'rateLimitPerMinute', event.target.value)
            }
          />
        );
      },
    },
    {
      key: 'save',
      header: 'Action',
      align: 'right',
      render: (org) => {
        const draft = draftLimits[org.id];
        const dirty =
          !!draft &&
          (draft.monthlyQuota !== String(org.apiMonthlyQuota) ||
            draft.rateLimitPerMinute !== String(org.apiRateLimitPerMinute));
        const valid =
          !!draft &&
          isWholeNumberInRange(draft.monthlyQuota, MAX_MONTHLY_QUOTA) &&
          isWholeNumberInRange(draft.rateLimitPerMinute, MAX_RATE_PER_MINUTE);
        return (
          <Button
            size="sm"
            variant={dirty ? 'primary' : 'secondary'}
            disabled={!dirty || !valid || Boolean(busyId)}
            onClick={() => void saveLimits(org)}
          >
            {busyId === org.id ? 'Saving…' : 'Save'}
          </Button>
        );
      },
    },
  ];

  const keyColumns: Column<AdminShieldApiKey>[] = [
    {
      key: 'key',
      header: 'Key',
      render: (key) => (
        <span>
          <strong>{key.name}</strong>
          <br />
          <code style={{ ...MONO, ...MUTED }}>
            {key.keyPrefix}••••••••{key.keySuffix}
          </code>
        </span>
      ),
    },
    {
      key: 'account',
      header: 'Account',
      render: (key) => key.organization.name,
    },
    {
      key: 'status',
      header: 'Status',
      render: (key) => (
        <span
          style={
            key.status === 'ACTIVE'
              ? { fontWeight: 600 }
              : { ...MUTED, textDecoration: 'line-through' }
          }
        >
          {key.status === 'ACTIVE' ? 'Active' : 'Revoked'}
        </span>
      ),
    },
    {
      key: 'scopes',
      header: 'Scopes',
      render: (key) => (
        <span style={{ ...MUTED, fontSize: '0.85rem' }}>
          {key.scopes.map(formatScope).join(', ') || '—'}
        </span>
      ),
    },
    {
      key: 'lastUsed',
      header: 'Last used',
      render: (key) => formatDateTime(key.lastUsedAt),
    },
    {
      key: 'expires',
      header: 'Expires',
      render: (key) => formatDateTime(key.expiresAt),
    },
    {
      key: 'action',
      header: 'Action',
      align: 'right',
      render: (key) =>
        key.status === 'ACTIVE' ? (
          <Button
            size="sm"
            variant="destructive"
            disabled={Boolean(busyId)}
            onClick={() => {
              setActionError('');
              setPendingRevoke(key);
            }}
          >
            Revoke
          </Button>
        ) : null,
    },
  ];

  const requestColumns: Column<RecentRequest>[] = [
    {
      key: 'time',
      header: 'Time',
      render: (item) => formatDateTime(item.createdAt),
    },
    {
      key: 'request',
      header: 'Request',
      render: (item) => (
        <code style={MONO}>
          {item.method} {item.route}
        </code>
      ),
    },
    {
      key: 'status',
      header: 'Status',
      align: 'right',
      render: (item) => (
        <span
          style={
            item.statusCode !== null && item.statusCode >= 400
              ? { fontWeight: 600 }
              : MUTED
          }
        >
          {item.statusCode ?? 'Pending'}
        </span>
      ),
    },
    {
      key: 'account',
      header: 'Account',
      render: (item) =>
        organizationNames.get(item.organizationId) ?? (
          <code style={MONO}>{item.organizationId.slice(0, 8)}…</code>
        ),
    },
  ];

  return (
    <AppShell
      role="admin"
      groups={ADMIN_SIDEBAR_GROUPS}
      brandInitial="B"
      brandLabel="BantAI Admin"
      currentPath={location.pathname}
      onNavigate={(path) => void navigate(path)}
      topbarContext={<span>Administration &middot; Shield API</span>}
      footer={<span style={{ fontSize: '0.85rem' }}>Authenticated admin</span>}
    >
      <PageHeader
        title="Shield API management"
        description="Inspect tenant usage, tune per-account limits, and revoke subscriber credentials. Plaintext secrets are never available here."
      />

      {loading ? (
        <LoadingState label="Loading Shield API activity…" />
      ) : loadError ? (
        <ErrorState
          title="API management unavailable"
          description={loadError}
          action={
            <Button variant="secondary" onClick={() => void load()}>
              Retry
            </Button>
          }
        />
      ) : (
        <>
          <MetricRow columns={4}>
            <Metric
              label="Requests this month"
              value={(usage?.requestsThisPeriod ?? 0).toLocaleString()}
            />
            <Metric
              label="Shield accounts"
              value={organizations.length.toLocaleString()}
            />
            <Metric
              label="Accounts with traffic"
              value={(usage?.byOrganization.length ?? 0).toLocaleString()}
            />
            <Metric
              label="Active keys"
              value={activeKeyCount.toLocaleString()}
            />
          </MetricRow>

          {notice && (
            <p role="status" style={{ margin: '16px 0 0' }}>
              {notice}
            </p>
          )}
          {actionError && !pendingRevoke && (
            <p role="alert" style={{ margin: '16px 0 0', fontWeight: 600 }}>
              {actionError}
            </p>
          )}

          <section
            aria-labelledby="admin-api-limits-heading"
            style={{ marginTop: 32 }}
          >
            <SectionHeader
              id="admin-api-limits-heading"
              title="Account limits"
              description={`Monthly quota (1–${MAX_MONTHLY_QUOTA.toLocaleString()}) applies to the whole account; the per-minute rate (1–${MAX_RATE_PER_MINUTE.toLocaleString()}) applies to each key. Changes are audited.`}
            />
            <DataTable<AdminShieldOrganization>
              ariaLabel="Shield account API limits"
              rowKey={(org) => org.id}
              rows={organizations}
              columns={limitColumns}
              emptyState={
                <EmptyState
                  title="No Shield accounts yet"
                  description="Accounts appear here once a Shield license is active."
                />
              }
            />
          </section>

          <section
            aria-labelledby="admin-api-keys-heading"
            style={{ marginTop: 32 }}
          >
            <SectionHeader
              id="admin-api-keys-heading"
              title="Subscriber keys"
              description="Only the key prefix and suffix are stored for display. Revoking a key stops it immediately and cannot be undone."
            />
            <DataTable<AdminShieldApiKey>
              ariaLabel="Shield subscriber API keys"
              rowKey={(key) => key.id}
              rows={keys}
              columns={keyColumns}
              emptyState={
                <EmptyState
                  title="No Shield API keys"
                  description="Subscriber credentials will appear here when issued."
                />
              }
            />
          </section>

          <section
            aria-labelledby="admin-api-activity-heading"
            style={{ marginTop: 32 }}
          >
            <SectionHeader
              id="admin-api-activity-heading"
              title="Recent requests"
              description="The latest calls made with subscriber keys across all accounts."
            />
            <DataTable<RecentRequest>
              ariaLabel="Recent Shield API requests"
              rowKey={(item) => item.rowId}
              rows={recentRequests}
              columns={requestColumns}
              emptyState={
                <EmptyState
                  title="No requests recorded yet"
                  description="Requests show up here as soon as a subscriber key is used."
                />
              }
            />
          </section>
        </>
      )}

      <Dialog
        open={pendingRevoke !== null}
        title="Revoke this API key?"
        description={
          pendingRevoke
            ? `"${pendingRevoke.name}" (${pendingRevoke.keyPrefix}••••${pendingRevoke.keySuffix}) for ${pendingRevoke.organization.name} will stop working immediately. This cannot be undone.`
            : undefined
        }
        onClose={() => {
          if (!busyId) setPendingRevoke(null);
        }}
        actions={
          <>
            <Button
              variant="ghost"
              disabled={Boolean(busyId)}
              onClick={() => setPendingRevoke(null)}
            >
              Cancel
            </Button>
            <Button
              variant="destructive-confirm"
              disabled={Boolean(busyId)}
              onClick={() => void confirmRevoke()}
            >
              {busyId ? 'Revoking…' : 'Revoke key'}
            </Button>
          </>
        }
      >
        {actionError && pendingRevoke && <p role="alert">{actionError}</p>}
      </Dialog>
    </AppShell>
  );
}

export default ApiKeysPage;
