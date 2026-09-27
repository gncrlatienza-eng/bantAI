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
  getAllReports,
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
import { logout } from '../../services/authService';
import { useAdminNavGroups } from './adminNav';
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
    submitter: item.user?.firstName
      ? `${item.user.firstName} ${item.user.lastName ?? ''}`.trim()
      : (item.user?.id ?? item.userId),
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

  const [reports, setReports] = useState<UserReportItem[]>([]);
  const [pending, setPending] = useState<UserReportItem[]>([]);
  const [campaigns, setCampaigns] = useState<CampaignCluster[]>([]);
  const [orgCount, setOrgCount] = useState<number | null>(null);
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
      const [allReports, pendingReports, activeCampaigns, orgs] =
        await Promise.all([
          getAllReports(),
          getPendingReports(),
          getActiveCampaigns(),
          getPortalOrganizations(),
        ]);
      setReports(allReports);
      setPending(pendingReports);
      setCampaigns(activeCampaigns);
      setOrgCount(Array.isArray(orgs) ? orgs.length : null);

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

  const navGroups = useAdminNavGroups();
  const reportRows = pending.slice(0, 5).map(toReportRow);

  return (
    <AppShell
      role="admin"
      groups={navGroups}
      brandInitial="B"
      brandLabel="BantAI Admin"
      currentPath={location.pathname}
      onNavigate={(p) => void navigate(p)}
      topbarContext={<span>System Administration &middot; Overview</span>}
      topbarUtility={
        <>
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
        </>
      }
      footer={<span style={{ fontSize: '0.85rem' }}>Authenticated admin</span>}
    >
      <PageHeader
        title="System Administration Overview"
        description="Situation across BantAI's threat intelligence pipeline, model reviews, and platform health."
        meta={
          loading
            ? 'Loading live telemetry...'
            : `${reports.length.toLocaleString()} reports · ${campaigns.length.toLocaleString()} active campaigns · ${
                orgCount ?? 0
              } organizations`
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
                value={reports.length.toLocaleString()}
                meta="all-time submissions"
              />
              <Metric
                label="Pending review"
                value={pending.length.toLocaleString()}
                meta="not yet resolved"
              />
              <Metric
                label="Active campaigns"
                value={campaigns.length.toLocaleString()}
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
                <EmptyState
                  title="No pending reports"
                  description="Analyst submissions awaiting review will appear here."
                />
              }
            />
          </section>
        </>
      )}
    </AppShell>
  );
}

export default OverviewPage;
