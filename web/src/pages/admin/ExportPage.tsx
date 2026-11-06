/*
 * Admin Export page — generate CSVs from live backend records.
 * No export history is displayed because no history endpoint exists.
 */

import React, { useCallback, useEffect, useState } from 'react';
import { PageHeader } from '../../components/appshell/AppShell';
import {
  Button,
  ErrorState,
  LoadingState,
  Metric,
  MetricRow,
  StatPanel,
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

function errorText(e: unknown): string {
  return e instanceof Error ? e.message : 'The backend request failed.';
}

interface Bundle {
  reports: UserReportItem[];
  models: ModelVersionItem[];
  campaigns: CampaignCluster[];
}

export function ExportPage() {
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
    <>
      <PageHeader
        title="Export"
        description="CSV files of the records loaded on this page. Reload the page for the newest records."
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
          <StatPanel
            label="Export summary"
            aside={
              <>
                <Button
                  size="sm"
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
                  size="sm"
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
                  size="sm"
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
              </>
            }
          >
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
          </StatPanel>

          <p
            role="status"
            aria-live="polite"
            style={{
              margin: notice ? '0 0 16px' : 0,
              color: notice
                ? notice.ok
                  ? 'var(--status-verified)'
                  : 'var(--status-critical)'
                : undefined,
            }}
          >
            {notice?.text}
          </p>
        </>
      ) : null}
    </>
  );
}

export default ExportPage;
