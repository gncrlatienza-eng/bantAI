/*
 * Admin System page. Phase F step 8 + Phase A step 5.
 *
 * Consolidates three legacy admin routes (/admin/server, /admin/api-logs,
 * /admin/db-storage) into one page with tabs synced to ?tab=. Legacy paths
 * redirect via AppRoutes so old deep links still land.
 */

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { AppShell, PageHeader } from '../../components/appshell/AppShell';
import {
  Button,
  DataTable,
  EmptyState,
  ErrorState,
  LoadingState,
  Metric,
  MetricRow,
  StatusBadge,
  Tabs,
  type StatusKind,
  type TabDef,
  type Column,
} from '../../components/primitives';
import {
  getHealthStatus,
  getReadinessStatus,
  type HealthStatus,
  type ReadinessStatus,
} from '../../services/healthService';
import {
  getAdminApiLogs,
  getAdminDbStorage,
  type ApiLogEntry,
  type ApiLogResponse,
  type DbStorageResponse,
} from '../../services/adminSystemService';
import { ADMIN_SIDEBAR_GROUPS } from './adminNav';

function errorText(e: unknown): string {
  return e instanceof Error ? e.message : 'The backend request failed.';
}

const TABS: TabDef[] = [
  { id: 'server', label: 'Server health' },
  { id: 'api-logs', label: 'API logs' },
  { id: 'db-storage', label: 'DB storage' },
];

function statusToKind(status: string): StatusKind {
  const s = status.toLowerCase();
  if (s === 'ok' || s === 'up' || s === 'ready' || s === 'healthy')
    return 'verified';
  if (s === 'degraded' || s === 'warning') return 'suspicious';
  if (s === 'down' || s === 'error' || s === 'failed') return 'threat';
  return 'unknown';
}

/* ------------------------------------------------------------------ */
/*  Server health tab                                                 */
/* ------------------------------------------------------------------ */

function ServerHealthTab() {
  const [data, setData] = useState<{
    health: HealthStatus;
    readiness: ReadinessStatus;
    latencyMs: number;
  } | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const started = performance.now();
      const [health, readiness] = await Promise.all([
        getHealthStatus(),
        getReadinessStatus(),
      ]);
      setData({
        health,
        readiness,
        latencyMs: Math.round(performance.now() - started),
      });
    } catch (e) {
      setError(errorText(e));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  if (loading) return <LoadingState label="Checking backend health" />;
  if (error) {
    return (
      <ErrorState
        title="Health check failed"
        description={error}
        action={
          <Button variant="secondary" onClick={() => void load()}>
            Retry
          </Button>
        }
      />
    );
  }
  if (!data) return null;

  return (
    <>
      <MetricRow columns={4}>
        <Metric
          label="Backend"
          value={
            <StatusBadge
              kind={statusToKind(data.health.status)}
              label={data.health.status}
            />
          }
        />
        <Metric
          label="Database"
          value={
            <StatusBadge
              kind={databaseStatusToKind(
                data.readiness.database,
                data.readiness.status,
              )}
              label={data.readiness.database}
            />
          }
        />
        <Metric label="Version" value={data.health.version} />
        <Metric
          label="Round-trip"
          value={`${data.latencyMs.toLocaleString()} ms`}
        />
      </MetricRow>

      <p
        style={{
          margin: '20px 0 0',
          color: 'var(--text-secondary)',
          fontSize: '0.85rem',
        }}
      >
        Backend uptime: {Math.floor(data.health.uptime).toLocaleString()}{' '}
        seconds &middot; Reported at{' '}
        {new Date(data.health.timestamp).toLocaleString()} &middot; Service{' '}
        {data.health.service}
      </p>

      <div style={{ marginTop: 16 }}>
        <Button variant="secondary" onClick={() => void load()}>
          Recheck now
        </Button>
      </div>
    </>
  );
}

/* ------------------------------------------------------------------ */
/*  Placeholder tab renderer                                          */
/* ------------------------------------------------------------------ */

function databaseStatusToKind(database: string, readiness: string): StatusKind {
  if (
    readiness.toLowerCase() === 'ok' &&
    ['reachable', 'ready', 'ok'].includes(database.toLowerCase())
  )
    return 'verified';
  return statusToKind(database);
}

function formatBytes(value: string): string {
  const bytes = Number(value);
  if (!Number.isFinite(bytes) || bytes < 0) return 'Unavailable';
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  let size = bytes;
  let unit = 0;
  while (size >= 1024 && unit < units.length - 1) {
    size /= 1024;
    unit++;
  }
  return `${size >= 10 || unit === 0 ? size.toFixed(0) : size.toFixed(1)} ${units[unit]}`;
}

function ApiLogsTab() {
  const [data, setData] = useState<ApiLogResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setData(await getAdminApiLogs());
    } catch (caught) {
      setError(errorText(caught));
    } finally {
      setLoading(false);
    }
  }, []);
  useEffect(() => {
    void load();
  }, [load]);
  const columns: Column<ApiLogEntry>[] = [
    {
      key: 'timestamp',
      header: 'Timestamp',
      render: (entry) => new Date(entry.timestamp).toLocaleString(),
      width: '22%',
    },
    {
      key: 'method',
      header: 'Method',
      render: (entry) => entry.method,
      width: '10%',
    },
    {
      key: 'path',
      header: 'Path',
      render: (entry) => entry.path,
      truncate: true,
    },
    {
      key: 'status',
      header: 'Status',
      render: (entry) => (
        <StatusBadge
          kind={
            entry.status >= 500
              ? 'threat'
              : entry.status >= 400
                ? 'suspicious'
                : 'verified'
          }
          label={String(entry.status)}
        />
      ),
      width: '12%',
    },
    {
      key: 'latencyMs',
      header: 'Latency',
      render: (entry) => `${entry.latencyMs} ms`,
      align: 'right',
      width: '12%',
    },
  ];
  if (loading) return <LoadingState label="Loading recent API activity" />;
  if (error)
    return (
      <ErrorState
        title="API activity unavailable"
        description={error}
        action={
          <Button variant="secondary" onClick={() => void load()}>
            Retry
          </Button>
        }
      />
    );
  if (!data) return null;
  return (
    <>
      <MetricRow columns={2}>
        <Metric
          label="Entries retained"
          value={data.entries.length.toLocaleString()}
          meta={data.retention}
        />
        <Metric
          label="Privacy protection"
          value="Redacted"
          meta={data.redaction}
        />
      </MetricRow>
      <div style={{ marginTop: 20 }}>
        <DataTable
          ariaLabel="Recent API activity"
          rowKey={(entry) => `${entry.timestamp}-${entry.method}-${entry.path}`}
          rows={data.entries}
          columns={columns}
          emptyState={
            <EmptyState
              title="No recent API activity"
              description="This in-memory view begins collecting after the backend starts. Request bodies, identities, IP addresses, and query strings are not retained."
            />
          }
        />
      </div>
    </>
  );
}

function DbStorageTab() {
  const [data, setData] = useState<DbStorageResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setData(await getAdminDbStorage());
    } catch (caught) {
      setError(errorText(caught));
    } finally {
      setLoading(false);
    }
  }, []);
  useEffect(() => {
    void load();
  }, [load]);
  if (loading) return <LoadingState label="Measuring database storage" />;
  if (error)
    return (
      <ErrorState
        title="Database storage unavailable"
        description={error}
        action={
          <Button variant="secondary" onClick={() => void load()}>
            Retry
          </Button>
        }
      />
    );
  if (!data) return null;
  const rows: Array<{ table: string; count: number }> = (
    Object.entries(data.rows) as Array<[string, number]>
  ).map(([table, count]) => ({
    table,
    count,
  }));
  const columns: Column<{ table: string; count: number }>[] = [
    {
      key: 'table',
      header: 'Table',
      render: (row) =>
        row.table
          .replace(/([A-Z])/g, ' $1')
          .replace(/^./, (letter) => letter.toUpperCase()),
    },
    {
      key: 'count',
      header: 'Rows',
      render: (row) => row.count.toLocaleString(),
      align: 'right',
      width: '30%',
    },
  ];
  return (
    <>
      <MetricRow columns={2}>
        <Metric label="Database size" value={formatBytes(data.databaseBytes)} />
        <Metric
          label="Measured"
          value={new Date(data.measuredAt).toLocaleString()}
        />
      </MetricRow>
      <div style={{ marginTop: 20 }}>
        <DataTable
          ariaLabel="Database row counts"
          rowKey={(row) => row.table}
          rows={rows}
          columns={columns}
        />
      </div>
    </>
  );
}

/* ------------------------------------------------------------------ */
/*  Page shell                                                        */
/* ------------------------------------------------------------------ */

export function SystemPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams, setSearchParams] = useSearchParams();

  const activeTab = useMemo(() => {
    const t = searchParams.get('tab') ?? 'server';
    return TABS.some((tab) => tab.id === t) ? t : 'server';
  }, [searchParams]);

  function selectTab(id: string) {
    const next = new URLSearchParams(searchParams);
    if (id === 'server') next.delete('tab');
    else next.set('tab', id);
    setSearchParams(next, { replace: true });
  }

  return (
    <AppShell
      role="admin"
      groups={ADMIN_SIDEBAR_GROUPS}
      brandInitial="B"
      brandLabel="BantAI Admin"
      currentPath={
        location.pathname.startsWith('/admin/system') ||
        location.pathname === '/admin/server' ||
        location.pathname === '/admin/api-logs' ||
        location.pathname === '/admin/db-storage'
          ? '/admin/system'
          : location.pathname
      }
      onNavigate={(p) => void navigate(p)}
      topbarContext={<span>Administration &middot; System</span>}
      footer={<span style={{ fontSize: '0.85rem' }}>Authenticated admin</span>}
    >
      <PageHeader
        title="System"
        description="Backend health, API request logs, and database storage — one page, three tabs. Only the tabs whose backend endpoints exist show live data."
      />
      <Tabs
        tabs={TABS}
        activeId={activeTab}
        onChange={selectTab}
        label="System sections"
      >
        <div style={{ paddingTop: 20 }}>
          {activeTab === 'server' && <ServerHealthTab />}
          {activeTab === 'api-logs' && <ApiLogsTab />}
          {activeTab === 'db-storage' && <DbStorageTab />}
        </div>
      </Tabs>
    </AppShell>
  );
}

export default SystemPage;
