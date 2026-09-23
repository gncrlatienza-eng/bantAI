/*
 * Client Overview (migrated to mineral theme + AppShell + primitives).
 *
 * This is the Phase F step 1 target. It replaces the legacy ClientOverviewPage
 * exported from ../client.tsx. Other client pages still render from the
 * legacy megafile until they migrate individually.
 *
 * Data flow: reuses the same services the legacy page called
 * (smsService.getSmsAlerts, campaignsService.getActiveCampaigns). No behavior
 * change on the API side. Only the presentation moves onto the new system.
 */

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { AppShell, PageHeader } from '../../components/appshell/AppShell';
import type { NavGroupDef } from '../../components/appshell/AppShell';
import {
  Button,
  Metric,
  MetricRow,
  DataTable,
  StatusBadge,
  ConfidenceMeter,
  EmptyState,
  LoadingState,
  ErrorState,
  NavOverviewIcon,
  NavCampaignsIcon,
  NavMessagesIcon,
  NavAnalyticsIcon,
  NavReportsIcon,
  NavSystemIcon,
  type Column,
  type StatusKind,
} from '../../components/primitives';
import {
  getActiveCampaigns,
  type CampaignCluster,
} from '../../services/campaignsService';
import { getSmsAlerts, type SmsAlertItem } from '../../services/smsService';
import { logout } from '../../services/authService';

const SIDEBAR_GROUPS: NavGroupDef[] = [
  {
    label: 'Threat Intelligence',
    items: [
      {
        label: 'Overview',
        path: '/client/overview',
        icon: <NavOverviewIcon />,
      },
      {
        label: 'Messages',
        path: '/client/messages',
        icon: <NavMessagesIcon />,
      },
      {
        label: 'Campaigns',
        path: '/client/campaigns',
        icon: <NavCampaignsIcon />,
      },
      {
        label: 'Analytics',
        path: '/client/analytics',
        icon: <NavAnalyticsIcon />,
      },
    ],
  },
  {
    label: 'Operations',
    items: [
      {
        label: 'Help',
        path: '/client/help',
        icon: <NavReportsIcon />,
      },
      {
        label: 'Account settings',
        path: '/client/settings',
        icon: <NavSystemIcon />,
      },
    ],
  },
];

function errorText(error: unknown): string {
  return error instanceof Error ? error.message : 'The backend request failed.';
}

/*
 * Map legacy classification labels ('Scam' | 'Spam' | 'Ham' | null) onto
 * StatusKind. Keeps the mineral system's semantic vocabulary at the boundary
 * with the backend; the backend can rename Scam to Threat later without a UI
 * refactor.
 */
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

interface AlertRow {
  id: string;
  sourceId: string;
  status: string;
  kind: StatusKind;
  confidence: number | null;
  received: string;
}

function formatRelative(iso: string): string {
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return '';
  const diff = Date.now() - then;
  const min = Math.round(diff / 60000);
  if (min < 1) return 'just now';
  if (min < 60) return `${min}m ago`;
  const hr = Math.round(min / 60);
  if (hr < 24) return `${hr}h ago`;
  const day = Math.round(hr / 24);
  return `${day}d ago`;
}

function toAlertRow(item: SmsAlertItem): AlertRow {
  return {
    id: item.id,
    sourceId: item.message.sourceId || item.message.id,
    status: item.status,
    kind: toStatusKind(item.message.classification?.label),
    confidence: item.message.classification?.score ?? null,
    received: formatRelative(item.message.receivedAt),
  };
}

const ALERT_COLUMNS: Column<AlertRow>[] = [
  {
    key: 'sourceId',
    header: 'Source ID',
    render: (r) => r.sourceId,
    width: '18%',
  },
  {
    key: 'status',
    header: 'Alert status',
    render: (r) => r.status,
    truncate: true,
  },
  {
    key: 'kind',
    header: 'Classification',
    render: (r) => <StatusBadge kind={r.kind} />,
    width: '18%',
  },
  {
    key: 'confidence',
    header: 'Confidence',
    render: (r) =>
      r.confidence == null ? (
        'Unavailable'
      ) : (
        <ConfidenceMeter value={r.confidence} compact />
      ),
    align: 'right',
    width: '14%',
  },
  {
    key: 'received',
    header: 'Received',
    render: (r) => r.received,
    align: 'right',
    width: '12%',
  },
];

export function OverviewPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const [alerts, setAlerts] = useState<SmsAlertItem[]>([]);
  const [campaigns, setCampaigns] = useState<CampaignCluster[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [alertData, campaignData] = await Promise.all([
        getSmsAlerts(),
        getActiveCampaigns(),
      ]);
      setAlerts(alertData);
      setCampaigns(campaignData);
    } catch (e) {
      setError(errorText(e));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const scamCount = alerts.filter(
    (i) => i.message.classification?.label === 'Scam',
  ).length;
  const spamCount = alerts.filter(
    (i) => i.message.classification?.label === 'Spam',
  ).length;
  const pendingCount = alerts.filter((i) => i.status === 'Pending').length;

  const rows = useMemo(() => alerts.slice(0, 6).map(toAlertRow), [alerts]);

  return (
    <AppShell
      role="client"
      groups={SIDEBAR_GROUPS}
      brandInitial="B"
      brandLabel="BantAI"
      currentPath={location.pathname}
      onNavigate={(p) => void navigate(p)}
      topbarContext={<span>Threat Intelligence &middot; Overview</span>}
      topbarUtility={
        <>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              logout();
              void navigate('/login');
            }}
          >
            Sign out
          </Button>
        </>
      }
      footer={
        <span style={{ fontSize: '0.85rem' }}>Authenticated account</span>
      }
    >
      <PageHeader
        title="Overview"
        description="Situation across monitored smishing activity for your organization."
        meta={
          loading
            ? 'Loading live telemetry...'
            : `${alerts.length.toLocaleString()} alert records · ${campaigns.length.toLocaleString()} active campaigns`
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
          <LoadingState label="Reading alerts and campaigns from the BantAI API..." />
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
                label="Active campaigns"
                value={campaigns.length.toLocaleString()}
                meta={
                  campaigns.length === 0 ? 'nothing tracked yet' : undefined
                }
              />
              <Metric
                label="Likely smishing"
                value={scamCount.toLocaleString()}
                meta="scam classifications"
              />
              <Metric
                label="Suspicious"
                value={spamCount.toLocaleString()}
                meta="spam classifications"
              />
              <Metric
                label="Pending review"
                value={pendingCount.toLocaleString()}
                meta="not yet resolved"
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
                Active campaigns
              </h2>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => void navigate('/client/campaigns')}
              >
                View all
              </Button>
            </div>
            {campaigns.length === 0 ? (
              <div
                style={{
                  background: 'var(--surface-raised)',
                  borderRadius: 8,
                }}
              >
                <EmptyState
                  title="No active campaigns"
                  description="The backend returned an empty campaign list. Campaigns appear here as message clusters are detected."
                />
              </div>
            ) : (
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))',
                  gap: 12,
                }}
              >
                {campaigns.slice(0, 4).map((c) => (
                  <article
                    key={c.id}
                    style={{
                      background: 'var(--surface-raised)',
                      borderRadius: 8,
                      padding: 16,
                      display: 'flex',
                      flexDirection: 'column',
                      gap: 8,
                    }}
                  >
                    <div
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        gap: 8,
                      }}
                    >
                      <strong
                        style={{
                          fontSize: '0.95rem',
                          color: 'var(--text-primary)',
                        }}
                      >
                        {c.label || 'Unlabeled campaign'}
                      </strong>
                      <StatusBadge
                        kind={c.isActive ? 'threat' : 'unknown'}
                        label={c.isActive ? 'Active' : 'Inactive'}
                      />
                    </div>
                    <div
                      style={{
                        display: 'flex',
                        gap: 16,
                        fontFamily: 'var(--font-mono)',
                        fontSize: '0.8rem',
                        color: 'var(--text-secondary)',
                      }}
                    >
                      <span>{c.messageCount.toLocaleString()} msgs</span>
                      <span>{c.urlDomains.length} domains</span>
                      <span>
                        since{' '}
                        {new Date(c.createdAt).toLocaleDateString(undefined, {
                          month: 'short',
                          day: 'numeric',
                        })}
                      </span>
                    </div>
                  </article>
                ))}
              </div>
            )}
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
                Recent alerts
              </h2>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => void navigate('/client/messages')}
              >
                Open messages
              </Button>
            </div>
            <DataTable<AlertRow>
              ariaLabel="Recent alerts"
              rowKey={(r) => r.id}
              rows={rows}
              columns={ALERT_COLUMNS}
              onRowClick={() => void navigate('/client/messages')}
              emptyState={
                <EmptyState
                  title="No alerts yet"
                  description="Recent SMS alerts will appear here as your subscribers receive them."
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
