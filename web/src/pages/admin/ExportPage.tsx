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
import { csvBlob, saveBlob } from '../../utils/download';
import { ADMIN_SIDEBAR_GROUPS } from './adminNav';

function errorText(e: unknown): string {
  return e instanceof Error ? e.message : 'The backend request failed.';
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
  // Visible result of the last export (manual QA 2026-10-01, F4).
  const [notice, setNotice] = useState<{
    ok: boolean;
    text: string;
  } | null>(null);

  function exportCsv(filename: string, headers: string[], rows: unknown[][]) {
    try {
      saveBlob(csvBlob(headers, rows), filename);
      setNotice({
        ok: true,
        text: `Saved ${filename} (${rows.length.toLocaleString()} ${rows.length === 1 ? 'row' : 'rows'}). If no file appeared, check your browser's downloads list or download settings.`,
      });
    } catch (e) {
      setNotice({
        ok: false,
        text: `Could not create ${filename}: ${errorText(e)}`,
      });
    }
  }

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
                exportCsv(
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
                exportCsv(
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
                exportCsv(
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
            role="status"
            aria-live="polite"
            style={{
              margin: '16px 0 0',
              minHeight: '1.4em',
              color: notice
                ? notice.ok
                  ? 'var(--status-verified)'
                  : 'var(--status-critical)'
                : undefined,
            }}
          >
            {notice?.text}
          </p>

          <p
            style={{
              margin: '12px 0 0',
              color: 'var(--text-secondary)',
              fontSize: '0.85rem',
            }}
          >
            CSVs are generated in the browser from the records loaded on this
            page. Reload the page to export the latest records.
          </p>
        </>
      ) : null}
    </AppShell>
  );
}

export default ExportPage;
