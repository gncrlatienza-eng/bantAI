/*
 * Admin Export page — generate CSVs from live backend records.
 * No export history is displayed because no history endpoint exists.
 */

import React, { useCallback, useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { AppShell, PageHeader } from '../../components/appshell/AppShell';
import {
  Button,
  ErrorState,
  LoadingState,
  Metric,
  MetricRow,
} from '../../components/primitives';
import {
  getActiveCampaigns,
  getInactiveCampaigns,
  type CampaignCluster,
} from '../../services/campaignsService';
import {
  getAllModels,
  type ModelVersionItem,
} from '../../services/modelsService';
import {
  getAllReports,
  type UserReportItem,
} from '../../services/reportsService';
import { logout } from '../../services/authService';
import { ADMIN_SIDEBAR_GROUPS } from './adminNav';

function errorText(e: unknown): string {
  return e instanceof Error ? e.message : 'The backend request failed.';
}

function csvCell(value: unknown): string {
  const text =
    value == null
      ? ''
      : typeof value === 'object'
        ? JSON.stringify(value)
        : typeof value === 'string'
          ? value
          : typeof value === 'number' ||
              typeof value === 'boolean' ||
              typeof value === 'bigint'
            ? value.toString()
            : '';
  return `"${text.replaceAll('"', '""')}"`;
}

function downloadCsv(filename: string, headers: string[], rows: unknown[][]) {
  const csv = [headers, ...rows]
    .map((row) => row.map(csvCell).join(','))
    .join('\n');
  const url = URL.createObjectURL(
    new Blob([csv], { type: 'text/csv;charset=utf-8' }),
  );
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

interface Bundle {
  reports: UserReportItem[];
  models: ModelVersionItem[];
  campaigns: CampaignCluster[];
}

export function ExportPage() {
  const navigate = useNavigate();
  const location = useLocation();

  const [bundle, setBundle] = useState<Bundle | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [reports, models, active, inactive] = await Promise.all([
        getAllReports(),
        getAllModels(),
        getActiveCampaigns(),
        getInactiveCampaigns(),
      ]);
      setBundle({ reports, models, campaigns: [...active, ...inactive] });
    } catch (e) {
      setError(errorText(e));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <AppShell
      role="admin"
      groups={ADMIN_SIDEBAR_GROUPS}
      brandInitial="B"
      brandLabel="BantAI Admin"
      currentPath={location.pathname}
      onNavigate={(p) => void navigate(p)}
      topbarContext={<span>Administration &middot; Export</span>}
      topbarUtility={
        <Button
          variant="ghost"
          size="sm"
          onClick={() => {
            logout();
            void navigate('/admin-login');
          }}
        >
          Sign out
        </Button>
      }
      footer={<span style={{ fontSize: '0.85rem' }}>Authenticated admin</span>}
    >
      <PageHeader
        title="Export"
        description="Generate CSVs from live backend records. No export history is displayed — the backend does not expose one."
      />

      {loading ? (
        <LoadingState label="Loading exportable records" />
      ) : error ? (
        <ErrorState
          title="Export data unavailable"
          description={error}
          action={
            <Button variant="secondary" onClick={() => void load()}>
              Retry
            </Button>
          }
        />
      ) : bundle ? (
        <>
          <MetricRow columns={3}>
            <Metric
              label="Reports available"
              value={bundle.reports.length.toLocaleString()}
            />
            <Metric
              label="Model versions"
              value={bundle.models.length.toLocaleString()}
            />
            <Metric
              label="Campaigns"
              value={bundle.campaigns.length.toLocaleString()}
            />
          </MetricRow>

          <div
            style={{
              display: 'flex',
              gap: 10,
              flexWrap: 'wrap',
              marginTop: 24,
            }}
          >
            <Button
              variant="primary"
              onClick={() =>
                downloadCsv(
                  'bantai-reports.csv',
                  [
                    'id',
                    'originalLabel',
                    'reportedLabel',
                    'status',
                    'createdAt',
                  ],
                  bundle.reports.map((item) => [
                    item.id,
                    item.originalLabel,
                    item.reportedLabel,
                    item.status,
                    item.createdAt,
                  ]),
                )
              }
            >
              Export reports
            </Button>
            <Button
              variant="secondary"
              onClick={() =>
                downloadCsv(
                  'bantai-models.csv',
                  ['id', 'versionTag', 'f1Score', 'accuracy', 'isActive'],
                  bundle.models.map((item) => [
                    item.id,
                    item.versionTag,
                    item.f1Score,
                    item.accuracy,
                    item.isActive,
                  ]),
                )
              }
            >
              Export models
            </Button>
            <Button
              variant="secondary"
              onClick={() =>
                downloadCsv(
                  'bantai-campaigns.csv',
                  ['id', 'label', 'isActive', 'messageCount', 'domains'],
                  bundle.campaigns.map((item) => [
                    item.id,
                    item.label ?? '',
                    item.isActive,
                    item.messageCount,
                    item.urlDomains.join(';'),
                  ]),
                )
              }
            >
              Export campaigns
            </Button>
          </div>

          <p
            style={{
              margin: '20px 0 0',
              color: 'var(--text-secondary)',
              fontSize: '0.85rem',
            }}
          >
            CSVs are generated in the browser from the current live records.
            Files download immediately with no server round-trip.
          </p>
        </>
      ) : null}
    </AppShell>
  );
}

export default ExportPage;
