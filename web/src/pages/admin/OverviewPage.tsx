/*
 * Admin Overview. Sidebar reflects the consolidated routes: five ML sub-pages
 * live behind a single "Model" entry, three system sub-pages behind "System".
 * The health redundancy that was on the old Admin Overview (card grid + bullet
 * list) is collapsed here into a single "System status" section.
 */

import React, { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { PageHeader } from '../../components/appshell/AppShell';
import {
  Button,
  Metric,
  MetricRow,
  DataTable,
  StatusBadge,
  InfoBadge,
  EmptyState,
  LoadingState,
  ErrorState,
  type Column,
} from '../../components/primitives';
import {
  getPendingReports,
  type UserReportItem,
} from '../../services/reportsService';
import {
  getActiveCampaigns,
  getInactiveCampaigns,
} from '../../services/campaignsService';
import { countRecentlyActiveCampaigns } from '../../features/campaigns/campaignDisplay';
import {
  getHealthStatus,
  getReadinessStatus,
  type HealthStatus,
  type ReadinessStatus,
} from '../../services/healthService';
import { getPortalOrganizations } from '../../services/portalOrganizationsService';
import { getAnalyticsSummary } from '../../services/analyticsService';
import {
  SectionHeading,
  ShortId,
  StatusCard,
  classificationKind,
  databaseKind,
  formatUptime,
  healthKind,
} from './adminDisplay';

// Same frame as StatPanel, so every summary card in the portal matches.
const PANEL = {
  background: 'var(--surface-raised)',
  border: '1px solid var(--border-default)',
  borderRadius: 10,
  padding: 20,
} as const;
import {
  getAdminMobileSync,
  type AdminMobileSyncSummary,
} from '../../services/smsService';

function errorText(error: unknown): string {
  return error instanceof Error ? error.message : 'The backend request failed.';
}

interface ReportRow {
  id: string;
  originalLabel: string;
  reportedLabel: string;
  status: string;
  submitter: string;
  createdAt: string;
}

function toReportRow(item: UserReportItem): ReportRow {
  return {
    id: item.id,
    originalLabel: item.originalLabel,
    reportedLabel: item.reportedLabel,
    status: item.status,
    submitter: item.user?.id ?? item.userId ?? '',
    createdAt: new Date(item.createdAt).toLocaleDateString(undefined, {
      month: 'short',
      day: 'numeric',
    }),
  };
}

const REPORT_COLUMNS: Column<ReportRow>[] = [
  {
    key: 'submitter',
    header: 'Reporter',
    render: (r) =>
      r.submitter ? <ShortId id={r.submitter} /> : 'Account record unavailable',
    width: '20%',
  },
  {
    key: 'originalLabel',
    header: 'Model said',
    render: (r) => (
      <StatusBadge
        kind={classificationKind(r.originalLabel)}
        label={r.originalLabel}
      />
    ),
    width: '18%',
  },
  {
    key: 'reportedLabel',
    header: 'Reporter says',
    render: (r) => (
      <StatusBadge
        kind={classificationKind(r.reportedLabel)}
        label={r.reportedLabel}
      />
    ),
    width: '18%',
  },
  {
    key: 'status',
    header: 'Status',
    render: (r) => r.status,
    width: '14%',
  },
  {
    key: 'createdAt',
    header: 'Submitted',
    render: (r) => r.createdAt,
    align: 'right',
    width: '12%',
  },
];

interface SystemStatus {
  health: HealthStatus | null;
  readiness: ReadinessStatus | null;
  healthError: string | null;
  readinessError: string | null;
}

export function OverviewPage() {
  const navigate = useNavigate();

  // null = this staff role may not read that source (or it failed); each
  // panel degrades on its own instead of the whole Overview erroring out.
  const [totalReports, setTotalReports] = useState<number | null>(null);
  const [pending, setPending] = useState<UserReportItem[] | null>(null);
  // Same definition as the Campaigns "Active" tab: a message in 30 days.
  const [activeCampaigns, setActiveCampaigns] = useState<number | null>(null);
  const [orgCount, setOrgCount] = useState<number | null>(null);
  const [mobileSync, setMobileSync] = useState<AdminMobileSyncSummary | null>(
    null,
  );
  const [sys, setSys] = useState<SystemStatus>({
    health: null,
    readiness: null,
    healthError: null,
    readinessError: null,
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      // Each source has its own staff permission (reports:read,
      // campaigns:manage, access_requests:manage, overview:read). A role
      // without one of them still gets the rest of the Overview.
      const [summary, pendingReports, campaignLists, orgs, sync] =
        await Promise.all([
          getAnalyticsSummary().catch(() => null),
          getPendingReports().catch(() => null),
          Promise.all([getActiveCampaigns(), getInactiveCampaigns()]).catch(
            () => null,
          ),
          getPortalOrganizations().catch(() => null),
          // Mobile sync is additive telemetry. Keep the rest of the overview
          // usable if this newer endpoint is temporarily unavailable during a
          // staggered backend/web deployment.
          getAdminMobileSync().catch(() => null),
        ]);
      if (!summary && !pendingReports && !campaignLists && !sync) {
        throw new Error(
          'None of the Overview sources answered. Check the backend and your staff permissions.',
        );
      }
      // Exact all-time count (the /reports list is capped at 100 rows).
      setTotalReports(summary?.totalReports ?? null);
      setPending(pendingReports);
      setActiveCampaigns(
        campaignLists
          ? countRecentlyActiveCampaigns(campaignLists.flat(), Date.now())
          : null,
      );
      setOrgCount(Array.isArray(orgs) ? orgs.length : null);
      setMobileSync(sync);

      const [health, readiness] = await Promise.all([
        getHealthStatus().catch((e): { err: string } => ({
          err: errorText(e),
        })),
        getReadinessStatus().catch((e): { err: string } => ({
          err: errorText(e),
        })),
      ]);
      setSys({
        health: 'err' in health ? null : health,
        readiness: 'err' in readiness ? null : readiness,
        healthError: 'err' in health ? health.err : null,
        readinessError: 'err' in readiness ? readiness.err : null,
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

  const reportRows = (pending ?? []).slice(0, 5).map(toReportRow);
  const fmt = (n: number | null | undefined) =>
    n == null ? '—' : n.toLocaleString();

  return (
    <>
      <PageHeader title="Overview" />

      {error && !loading && (
        <div
          style={{
            background: 'var(--surface-raised)',
            borderRadius: 8,
            marginBottom: 24,
          }}
        >
          <ErrorState
            title="Live data unavailable"
            description={error}
            action={
              <Button variant="secondary" onClick={() => void load()}>
                Retry
              </Button>
            }
          />
        </div>
      )}

      {loading && !error && (
        <div
          style={{
            background: 'var(--surface-raised)',
            borderRadius: 8,
            marginBottom: 24,
          }}
        >
          <LoadingState label="Reading reports, campaigns, and platform health..." />
        </div>
      )}

      {!error && !loading && (
        <>
          <section style={{ marginBottom: 28 }}>
            <SectionHeading
              title="Messages"
              actionLabel="View messages"
              onAction={() => void navigate('/admin/messages')}
            />
            <div style={PANEL}>
              <MetricRow columns={4}>
                <Metric
                  label="Synced accounts"
                  value={(mobileSync?.syncedAccounts ?? 0).toLocaleString()}
                />
                <Metric
                  label="Classified"
                  value={(mobileSync?.classifiedMessages ?? 0).toLocaleString()}
                />
                <Metric
                  label="Scam"
                  value={(mobileSync?.scamCount ?? 0).toLocaleString()}
                />
                <Metric
                  label="Spam"
                  value={(mobileSync?.spamCount ?? 0).toLocaleString()}
                />
              </MetricRow>
            </div>
          </section>

          <section style={{ marginBottom: 28 }}>
            <SectionHeading
              title="Reports and campaigns"
              actionLabel="View campaigns"
              onAction={() => void navigate('/admin/campaigns')}
            />
            <div style={PANEL}>
              <MetricRow columns={4}>
                <Metric label="Reports received" value={fmt(totalReports)} />
                <Metric label="Pending review" value={fmt(pending?.length)} />
                <Metric
                  label="Active campaigns"
                  value={fmt(activeCampaigns)}
                  meta="last 30 days"
                />
                <Metric
                  label="Client organizations"
                  value={(orgCount ?? 0).toLocaleString()}
                />
              </MetricRow>
            </div>
          </section>

          <section style={{ marginBottom: 28 }}>
            <SectionHeading
              title="System status"
              actionLabel="View system"
              onAction={() => void navigate('/admin/system')}
            />
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
                gap: 12,
              }}
            >
              <StatusCard
                label="Backend API"
                detail={
                  sys.health ? formatUptime(sys.health.uptime) : undefined
                }
              >
                {sys.health ? (
                  <StatusBadge
                    kind={healthKind(sys.health.status)}
                    label={sys.health.status}
                  />
                ) : (
                  <StatusBadge
                    kind="unknown"
                    label={sys.healthError ?? 'unreachable'}
                  />
                )}
              </StatusCard>
              <StatusCard label="Database">
                {sys.readiness ? (
                  <StatusBadge
                    kind={databaseKind(
                      sys.readiness.database,
                      sys.readiness.status,
                    )}
                    label={sys.readiness.database}
                  />
                ) : (
                  <StatusBadge
                    kind="unknown"
                    label={sys.readinessError ?? 'unreachable'}
                  />
                )}
              </StatusCard>
              <StatusCard label="Model service">
                <InfoBadge>Live proxy</InfoBadge>
              </StatusCard>
            </div>
          </section>

          <section>
            <SectionHeading
              title="Pending reports"
              actionLabel="View queue"
              onAction={() => void navigate('/admin/review/reports')}
            />
            <DataTable<ReportRow>
              ariaLabel="Pending user reports"
              rowKey={(r) => r.id}
              rows={reportRows}
              columns={REPORT_COLUMNS}
              onRowClick={() => void navigate('/admin/review/reports')}
              emptyState={
                pending === null ? (
                  <EmptyState
                    title="Reports not available"
                    description="Your staff role cannot read user reports, or the reports service did not answer."
                  />
                ) : (
                  <EmptyState
                    title="No pending reports"
                    description="Analyst submissions awaiting review will appear here."
                  />
                )
              }
            />
          </section>
        </>
      )}
    </>
  );
}

export default OverviewPage;
