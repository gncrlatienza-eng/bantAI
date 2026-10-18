/*
 * System hub tabs: Health, API logs and Storage. The hub (with Audit and
 * Exports) is assembled in routes/AppRoutes.tsx from the navigation registry.
 */

import React, { useCallback, useEffect, useState } from 'react';
import {
  Button,
  DataTable,
  EmptyState,
  ErrorState,
  LoadingState,
  Metric,
  MetricRow,
  StatusBadge,
  type Column,
  StatPanel,
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
import { databaseKind, formatUptime, healthKind } from './adminDisplay';
import { formatCompactDateTime, formatLogTime } from '../../utils/dateFormat';

function errorText(e: unknown): string {
  return e instanceof Error ? e.message : 'The backend request failed.';
}

/* ------------------------------------------------------------------ */
/*  Server health tab                                                 */
/* ------------------------------------------------------------------ */

export function ServerHealthTab() {
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
      <StatPanel
        label="Server health"
        facts={[
          {
            label: 'Uptime',
            value: formatUptime(data.health.uptime).replace(/^Up /, ''),
          },
          {
            label: 'Checked',
            value: new Date(data.health.timestamp).toLocaleTimeString(
              undefined,
              { hour: 'numeric', minute: '2-digit' },
            ),
          },
        ]}
        aside={
          <Button variant="secondary" size="sm" onClick={() => void load()}>
            Recheck now
          </Button>
        }
      >
        <MetricRow columns={4}>
          <Metric
            label="Backend"
            value={
              <StatusBadge
                kind={healthKind(data.health.status)}
                label={data.health.status}
              />
            }
          />
          <Metric
            label="Database"
            value={
              <StatusBadge
                kind={databaseKind(
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
      </StatPanel>
    </>
  );
}

/* ------------------------------------------------------------------ */
/*  Placeholder tab renderer                                          */
/* ------------------------------------------------------------------ */

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

export function ApiLogsTab() {
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
      render: (entry) => formatLogTime(new Date(entry.timestamp)),
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
      <StatPanel label="API log summary">
        <MetricRow columns={2}>
          <Metric
            label="Entries retained"
            value={data.entries.length.toLocaleString()}
            meta={<span title={data.retention}>kept in memory</span>}
          />
          <Metric
            label="Privacy"
            value="Redacted"
            meta={<span title={data.redaction}>personal data removed</span>}
          />
        </MetricRow>
      </StatPanel>
      <div style={{ marginTop: 20 }}>
        <DataTable
          ariaLabel="Recent API activity"
          rowKey={(entry) => `${entry.timestamp}-${entry.method}-${entry.path}`}
          rows={data.entries}
          columns={columns}
          emptyState={
            <EmptyState
              title="No recent API activity"
              description="Collected since the backend started. Bodies, identities, IPs and queries are never kept."
            />
          }
        />
      </div>
    </>
  );
}

export function DbStorageTab() {
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
      <StatPanel label="Storage summary">
        <MetricRow columns={2}>
          <Metric
            label="Database size"
            value={formatBytes(data.databaseBytes)}
            meta={`Measured ${formatCompactDateTime(new Date(data.measuredAt))}`}
          />
        </MetricRow>
      </StatPanel>
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
