import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { AppShell, PageHeader } from '../../components/appshell/AppShell';
import {
  Button,
  EmptyState,
  ErrorState,
  LoadingState,
  Metric,
  MetricRow,
  StatusBadge,
} from '../../components/primitives';
import {
  getActiveCampaigns,
  getInactiveCampaigns,
  type CampaignCluster,
} from '../../services/campaignsService';
import { logout } from '../../services/authService';
import { useClientSidebarGroups } from './clientNav';

const errorText = (error: unknown) =>
  error instanceof Error
    ? error.message
    : 'The campaign intelligence request failed.';

function formatRelative(iso: string) {
  const difference = Date.now() - new Date(iso).getTime();
  if (!Number.isFinite(difference)) return 'date unavailable';
  const minutes = Math.max(0, Math.round(difference / 60_000));
  if (minutes < 1) return 'just now';
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.round(minutes / 60);
  return hours < 24 ? `${hours}h ago` : `${Math.round(hours / 24)}d ago`;
}

const lastObserved = (c: CampaignCluster) => c.lastObserved ?? c.updatedAt;

export function OverviewPage() {
  const sidebarGroups = useClientSidebarGroups();
  const navigate = useNavigate();
  const location = useLocation();
  const [campaigns, setCampaigns] = useState<CampaignCluster[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      // Active and inactive published campaigns (the backend's 30-day rule).
      const [active, inactive] = await Promise.all([
        getActiveCampaigns(),
        getInactiveCampaigns(),
      ]);
      const seen = new Set<string>();
      setCampaigns(
        [...active, ...inactive].filter((c) =>
          seen.has(c.id) ? false : (seen.add(c.id), true),
        ),
      );
    } catch (caught) {
      setError(errorText(caught));
    } finally {
      setLoading(false);
    }
  }, []);
  useEffect(() => {
    void load();
  }, [load]);
  const activeCount = campaigns.filter((c) => c.status === 'ACTIVE').length;
  // Newest activity first: when a campaign's texts were last observed.
  const latest = useMemo(
    () =>
      [...campaigns]
        .sort(
          (a, b) =>
            new Date(lastObserved(b)).getTime() -
            new Date(lastObserved(a)).getTime(),
        )
        .slice(0, 4),
    [campaigns],
  );

  return (
    <AppShell
      role="client"
      groups={sidebarGroups}
      brandInitial="S"
      brandLabel="BantAI Shield"
      currentPath={location.pathname}
      onNavigate={(path) => void navigate(path)}
      topbarContext={<span>Shield &middot; Overview</span>}
      topbarUtility={
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
      }
      footer={
        <span style={{ fontSize: '0.85rem' }}>
          Shield intelligence subscription
        </span>
      }
    >
      <PageHeader
        title="Threat activity"
        description="Published Philippine smishing campaign intelligence relevant to your Shield subscription."
        meta={
          loading
            ? 'Loading published campaigns…'
            : 'Campaign-level intelligence only'
        }
      />
      {loading && (
        <LoadingState label="Loading published campaign intelligence…" />
      )}
      {error && !loading && (
        <ErrorState
          title="Campaign intelligence unavailable"
          description={error}
          action={
            <Button variant="secondary" onClick={() => void load()}>
              Retry
            </Button>
          }
        />
      )}
      {!loading && !error && (
        <>
          <section
            style={{
              background: 'var(--surface-raised)',
              borderRadius: 8,
              padding: '20px 24px',
              marginBottom: 24,
            }}
          >
            <MetricRow columns={3}>
              <Metric
                label="Active campaigns"
                value={activeCount.toLocaleString()}
                meta="Observed in the last 30 days"
              />
              <Metric
                label="Inactive campaigns"
                value={(campaigns.length - activeCount).toLocaleString()}
                meta="Quiet for 30+ days"
              />
              <Metric
                label="Published campaigns"
                value={campaigns.length.toLocaleString()}
                meta="All intelligence available to you"
              />
            </MetricRow>
          </section>
          <section>
            <div
              style={{
                display: 'flex',
                alignItems: 'baseline',
                justifyContent: 'space-between',
                gap: 16,
                marginBottom: 12,
              }}
            >
              <h2 style={{ margin: 0, fontSize: '1rem' }}>
                Latest intelligence updates
              </h2>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => void navigate('/shield/campaigns')}
              >
                View campaigns
              </Button>
            </div>
            {latest.length === 0 ? (
              <EmptyState
                title="No published campaigns"
                description="Published campaign intelligence will appear here when it is available."
              />
            ) : (
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
                  gap: 12,
                }}
              >
                {latest.map((campaign) => (
                  <button
                    key={campaign.id}
                    type="button"
                    onClick={() =>
                      void navigate(
                        `/shield/campaigns/${encodeURIComponent(campaign.id)}`,
                      )
                    }
                    style={{
                      appearance: 'none',
                      textAlign: 'left',
                      border: 0,
                      borderRadius: 8,
                      padding: 16,
                      background: 'var(--surface-raised)',
                      color: 'inherit',
                      cursor: 'pointer',
                    }}
                  >
                    <div
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        gap: 8,
                        alignItems: 'start',
                      }}
                    >
                      <strong>{campaign.label || 'Published campaign'}</strong>
                      {campaign.status === 'ACTIVE' ? (
                        <StatusBadge kind="threat" label="Active" />
                      ) : (
                        <StatusBadge kind="unknown" label="Inactive" />
                      )}
                    </div>
                    <p
                      style={{
                        margin: '10px 0 0',
                        color: 'var(--text-secondary)',
                        fontSize: '0.85rem',
                      }}
                    >
                      Last observed {formatRelative(lastObserved(campaign))}
                    </p>
                  </button>
                ))}
              </div>
            )}
          </section>
        </>
      )}
    </AppShell>
  );
}

export default OverviewPage;
