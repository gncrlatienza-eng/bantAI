/*
 * Shared Analytics view. Phase F step 6.
 *
 * Both client and admin analytics call GET /analytics/summary and render the
 * same four totals + two breakdowns. Nothing here fabricates precision — the
 * backend returns integer counts, we render integer counts. No fake sparklines.
 */

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Button,
  ErrorState,
  LoadingState,
  Metric,
  MetricRow,
  StatusBadge,
  DataTable,
  type Column,
  type StatusKind,
} from '../../components/primitives';
import {
  getAnalyticsSummary,
  type AnalyticsSummary,
} from '../../services/analyticsService';

function errorText(e: unknown): string {
  return e instanceof Error ? e.message : 'The backend request failed.';
}

function labelToStatusKind(label: string): StatusKind {
  switch (label) {
    case 'Scam':
      return 'threat';
    case 'Spam':
      return 'suspicious';
    case 'Ham':
      return 'verified';
    default:
      return 'unknown';
  }
}

interface LabelRow {
  label: string;
  count: number;
  share: number;
  kind: StatusKind;
}

interface StatusRow {
  status: string;
  count: number;
  share: number;
}

export function AnalyticsView() {
  const [data, setData] = useState<AnalyticsSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setData(await getAnalyticsSummary());
    } catch (e) {
      setError(errorText(e));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const labelRows = useMemo<LabelRow[]>(() => {
    if (!data) return [];
    const entries = Object.entries(data.classificationsByLabel);
    const total = entries.reduce((sum, [, count]) => sum + count, 0);
    return entries
      .map(([label, count]) => ({
        label,
        count,
        share: total > 0 ? count / total : 0,
        kind: labelToStatusKind(label),
      }))
      .sort((a, b) => b.count - a.count);
  }, [data]);

  const statusRows = useMemo<StatusRow[]>(() => {
    if (!data) return [];
    const entries = Object.entries(data.alertsByStatus);
    const total = entries.reduce((sum, [, count]) => sum + count, 0);
    return entries
      .map(([status, count]) => ({
        status,
        count,
        share: total > 0 ? count / total : 0,
      }))
      .sort((a, b) => b.count - a.count);
  }, [data]);

  if (loading) return <LoadingState label="Loading analytics" />;

  if (error) {
    return (
      <ErrorState
        title="Analytics unavailable"
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

  const labelColumns: Column<LabelRow>[] = [
    {
      key: 'label',
      header: 'Classification',
      render: (r) => <StatusBadge kind={r.kind} label={r.label} />,
    },
    {
      key: 'count',
      header: 'Messages',
      render: (r) => r.count.toLocaleString(),
      align: 'right',
      width: '25%',
    },
    {
      key: 'share',
      header: 'Share',
      render: (r) => `${(r.share * 100).toFixed(r.share >= 0.1 ? 0 : 1)}%`,
      align: 'right',
      width: '20%',
    },
  ];

  const statusColumns: Column<StatusRow>[] = [
    {
      key: 'status',
      header: 'Alert status',
      render: (r) => r.status,
    },
    {
      key: 'count',
      header: 'Alerts',
      render: (r) => r.count.toLocaleString(),
      align: 'right',
      width: '25%',
    },
    {
      key: 'share',
      header: 'Share',
      render: (r) => `${(r.share * 100).toFixed(r.share >= 0.1 ? 0 : 1)}%`,
      align: 'right',
      width: '20%',
    },
  ];

  return (
    <>
      <MetricRow columns={3}>
        <Metric
          label="Messages classified"
          value={data.totalMessages.toLocaleString()}
        />
        <Metric
          label="User reports submitted"
          value={data.totalReports.toLocaleString()}
        />
        <Metric label="Distinct classifications" value={labelRows.length} />
      </MetricRow>

      <section style={{ marginTop: 32 }}>
        <h2 style={{ fontSize: '1.05rem', margin: '0 0 6px' }}>
          Classification breakdown
        </h2>
        <p
          style={{
            margin: '0 0 12px',
            color: 'var(--text-secondary)',
            fontSize: '0.85rem',
          }}
        >
          How the classifier labeled the {data.totalMessages.toLocaleString()}{' '}
          messages the backend has processed.
        </p>
        <DataTable<LabelRow>
          ariaLabel="Classification breakdown"
          rowKey={(r) => r.label}
          rows={labelRows}
          columns={labelColumns}
        />
      </section>

      <section style={{ marginTop: 32 }}>
        <h2 style={{ fontSize: '1.05rem', margin: '0 0 6px' }}>
          Alert lifecycle
        </h2>
        <p
          style={{
            margin: '0 0 12px',
            color: 'var(--text-secondary)',
            fontSize: '0.85rem',
          }}
        >
          Distribution of alert statuses across the account.
        </p>
        <DataTable<StatusRow>
          ariaLabel="Alert lifecycle"
          rowKey={(r) => r.status}
          rows={statusRows}
          columns={statusColumns}
        />
      </section>
    </>
  );
}
