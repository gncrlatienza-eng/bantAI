/*
 * Admin Overview. Sidebar reflects the consolidated routes: five ML sub-pages
 * live behind a single "Model" entry, three system sub-pages behind "System".
 * The health redundancy that was on the old Admin Overview (card grid + bullet
 * list) is collapsed here into a single "System status" section.
 */

import React, { useCallback, useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { AppShell, PageHeader } from '../../components/appshell/AppShell';
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
  type StatusKind,
} from '../../components/primitives';
import {
  getPendingReports,
  type UserReportItem,
} from '../../services/reportsService';
import {
  getActiveCampaigns,
  type CampaignCluster,
} from '../../services/campaignsService';
import {
  getHealthStatus,
  getReadinessStatus,
  type HealthStatus,
  type ReadinessStatus,
} from '../../services/healthService';
import { getPortalOrganizations } from '../../services/portalOrganizationsService';
import { getAnalyticsSummary } from '../../services/analyticsService';
import { ADMIN_SIDEBAR_GROUPS } from './adminNav';
import {
  getAdminMobileSync,
  type AdminMobileSyncSummary,
} from '../../services/smsService';

function errorText(error: unknown): string {
  return error instanceof Error ? error.message : 'The backend request failed.';
}

function toStatusKind(label: string | null | undefined): StatusKind {
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
    submitter: item.user?.id ?? item.userId ?? 'Account record unavailable',
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
    render: (r) => r.submitter,
    width: '20%',
  },
  {
    key: 'originalLabel',
    header: 'Model said',
    render: (r) => <StatusBadge kind={toStatusKind(r.originalLabel)} />,
    width: '18%',
  },
  {
    key: 'reportedLabel',
    header: 'Reporter says',
    render: (r) => <StatusBadge kind={toStatusKind(r.reportedLabel)} />,
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

function isOk(status: string | undefined | null): boolean {
  if (!status) return false;
  return /(ok|ready|healthy|operational|up)/i.test(status);
}

export function OverviewPage() {
  const navigate = useNavigate();
  const location = useLocation();

  // null = this staff role may not read that source (or it failed); each
  // panel degrades on its own instead of the whole Overview erroring out.
  const [totalReports, setTotalReports] = useState<number | null>(null);
  const [pending, setPending] = useState<UserReportItem[] | null>(null);
  const [campaigns, setCampaigns] = useState<CampaignCluster[] | null>(null);
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
      const [summary, pendingReports, activeCampaigns, orgs, sync] =
        await Promise.all([
          getAnalyticsSummary().catch(() => null),
          getPendingReports().catch(() => null),
          getActiveCampaigns().catch(() => null),
          getPortalOrganizations().catch(() => null),
          // Mobile sync is additive telemetry. Keep the rest of the overview
          // usable if this newer endpoint is temporarily unavailable during a
          // staggered backend/web deployment.
          getAdminMobileSync().catch(() => null),
        ]);
      if (!summary && !pendingReports && !activeCampaigns && !sync) {
        throw new Error(
          'None of the Overview sources answered. Check the backend and your staff permissions.',
        );
      }
      // Exact all-time count (the /reports list is capped at 100 rows).
      setTotalReports(summary?.totalReports ?? null);
      setPending(pendingReports);
      setCampaigns(activeCampaigns);
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
    <AppShell
      role="admin"
      groups={ADMIN_SIDEBAR_GROUPS}
      brandInitial="B"
      brandLabel="BantAI Admin"
      currentPath={location.pathname}
      onNavigate={(p) => void navigate(p)}
      topbarContext={<span>System Administration &middot; Overview</span>}
      footer={<span style={{ fontSize: '0.85rem' }}>Authenticated admin</span>}
    >
      <PageHeader
        title="System Administration Overview"
        description="Situation across BantAI's threat intelligence pipeline, model reviews, and platform health."
        meta={
          loading
            ? 'Loading live telemetry...'
            : `${fmt(mobileSync?.classifiedMessages)} mobile classifications · ${fmt(totalReports)} reports · ${fmt(campaigns?.length)} active campaigns · ${fmt(
                orgCount,
              )} organizations`
        }
        actions={
          <Button
            variant="secondary"
            onClick={() => void navigate('/admin/reports')}
          >
            Open reports queue
          </Button>
        }
      />

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
          <section style={{ marginBottom: 20 }}>
            <div
              style={{
                display: 'flex',
                alignItems: 'baseline',
                justifyContent: 'space-between',
                marginBottom: 12,
              }}
            >
              <h2 style={{ margin: 0, fontSize: '1rem', fontWeight: 600 }}>
                Mobile sync activity
              </h2>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => void navigate('/admin/mobile-sync')}
              >
                Open mobile sync
              </Button>
            </div>
            <div
              style={{
                background: 'var(--surface-raised)',
                borderRadius: 8,
                padding: '20px 24px',
              }}
            >
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))',
                  gap: 24,
                }}
              >
                <Metric
                  label="Synced accounts"
                  value={(mobileSync?.syncedAccounts ?? 0).toLocaleString()}
                  meta="with mobile SMS metadata"
                />
                <Metric
                  label="Classified"
                  value={(mobileSync?.classifiedMessages ?? 0).toLocaleString()}
                  meta="received from mobile"
                />
                <Metric
                  label="Scam"
                  value={(mobileSync?.scamCount ?? 0).toLocaleString()}
                  meta="privacy-safe detections"
                />
                <Metric
                  label="Spam"
                  value={(mobileSync?.spamCount ?? 0).toLocaleString()}
                  meta="privacy-safe detections"
                />
              </div>
            </div>
          </section>

          <section
            style={{
              background: 'var(--surface-raised)',
              borderRadius: 8,
              padding: '20px 24px',
              marginBottom: 20,
            }}
          >
            <MetricRow columns={4}>
              <Metric
                label="Reports received"
                value={fmt(totalReports)}
                meta="all-time submissions"
              />
              <Metric
                label="Pending review"
                value={fmt(pending?.length)}
                meta="not yet resolved"
              />
              <Metric
                label="Active campaigns"
                value={fmt(campaigns?.length)}
                meta="clusters detected"
              />
              <Metric
                label="Client organizations"
                value={(orgCount ?? 0).toLocaleString()}
                meta="portal accounts"
              />
            </MetricRow>
          </section>

          <section style={{ marginBottom: 20 }}>
            <div
              style={{
                display: 'flex',
                alignItems: 'baseline',
                justifyContent: 'space-between',
                marginBottom: 12,
              }}
            >
              <h2
                style={{
                  margin: 0,
                  fontSize: '1rem',
                  fontWeight: 600,
                  color: 'var(--text-primary)',
                }}
              >
                System status
              </h2>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => void navigate('/admin/system')}
              >
                Open system
              </Button>
            </div>
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
                gap: 12,
              }}
            >
              <article
                style={{
                  background: 'var(--surface-raised)',
                  borderRadius: 8,
                  padding: 16,
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 6,
                }}
              >
                <span
                  style={{
                    fontSize: '0.7rem',
                    fontWeight: 600,
                    letterSpacing: '0.08em',
                    textTransform: 'uppercase',
                    color: 'var(--text-secondary)',
                  }}
                >
                  Backend API
                </span>
                {sys.health ? (
                  <>
                    <StatusBadge
                      kind={isOk(sys.health.status) ? 'verified' : 'threat'}
                      label={sys.health.status}
                    />
                    <span
                      style={{
                        fontSize: '0.75rem',
                        color: 'var(--text-secondary)',
                        fontFamily: 'var(--font-mono)',
                      }}
                    >
                      {sys.health.service} v{sys.health.version} · uptime{' '}
                      {Math.round(sys.health.uptime)}s
                    </span>
                  </>
                ) : (
                  <StatusBadge
                    kind="unknown"
                    label={sys.healthError ?? 'unreachable'}
                  />
                )}
              </article>

              <article
                style={{
                  background: 'var(--surface-raised)',
                  borderRadius: 8,
                  padding: 16,
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 6,
                }}
              >
                <span
                  style={{
                    fontSize: '0.7rem',
                    fontWeight: 600,
                    letterSpacing: '0.08em',
                    textTransform: 'uppercase',
                    color: 'var(--text-secondary)',
                  }}
                >
                  Database
                </span>
                {sys.readiness ? (
                  <>
                    <StatusBadge
                      kind={
                        isOk(sys.readiness.database) ? 'verified' : 'threat'
                      }
                      label={sys.readiness.database}
                    />
                    <span
                      style={{
                        fontSize: '0.75rem',
                        color: 'var(--text-secondary)',
                        fontFamily: 'var(--font-mono)',
                      }}
                    >
                      readiness: {sys.readiness.status}
                    </span>
                  </>
                ) : (
                  <StatusBadge
                    kind="unknown"
                    label={sys.readinessError ?? 'unreachable'}
                  />
                )}
              </article>

              <article
                style={{
                  background: 'var(--surface-raised)',
                  borderRadius: 8,
                  padding: 16,
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 6,
                }}
              >
                <span
                  style={{
                    fontSize: '0.7rem',
                    fontWeight: 600,
                    letterSpacing: '0.08em',
                    textTransform: 'uppercase',
                    color: 'var(--text-secondary)',
                  }}
                >
                  Model service
                </span>
                <InfoBadge>Live proxy</InfoBadge>
                <span
                  style={{
                    fontSize: '0.75rem',
                    color: 'var(--text-secondary)',
                  }}
                >
                  Backend proxies classification to the Python AI service.
                </span>
              </article>
            </div>
          </section>

          <section>
            <div
              style={{
                display: 'flex',
                alignItems: 'baseline',
                justifyContent: 'space-between',
                marginBottom: 12,
              }}
            >
              <h2
                style={{
                  margin: 0,
                  fontSize: '1rem',
                  fontWeight: 600,
                  color: 'var(--text-primary)',
                }}
              >
                Pending reports
              </h2>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => void navigate('/admin/reports')}
              >
                Open queue
              </Button>
            </div>
            <DataTable<ReportRow>
              ariaLabel="Pending user reports"
              rowKey={(r) => r.id}
              rows={reportRows}
              columns={REPORT_COLUMNS}
              onRowClick={() => void navigate('/admin/reports')}
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
    </AppShell>
  );
}

export default OverviewPage;
