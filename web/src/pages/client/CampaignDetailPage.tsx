import React, { useCallback, useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { AppShell, PageHeader } from '../../components/appshell/AppShell';
import {
  Button,
  EmptyState,
  ErrorState,
  InfoBadge,
  LoadingState,
  Metric,
  MetricRow,
  StatusBadge,
} from '../../components/primitives';
import {
  getCampaignById,
  type CampaignDetail,
} from '../../services/campaignsService';
import { logout } from '../../services/authService';
import { useClientSidebarGroups } from './clientNav';

const errorText = (error: unknown) =>
  error instanceof Error
    ? error.message
    : 'The campaign intelligence request failed.';
const formatDate = (iso: string) => {
  const date = new Date(iso);
  return Number.isNaN(date.getTime())
    ? 'Unavailable'
    : date.toLocaleDateString(undefined, {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
      });
};

export function CampaignDetailPage() {
  const sidebarGroups = useClientSidebarGroups();
  const navigate = useNavigate();
  const campaignId = useParams<{ id: string }>().id ?? '';
  const [campaign, setCampaign] = useState<CampaignDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const load = useCallback(async () => {
    if (!campaignId) return;
    setLoading(true);
    setError(null);
    try {
      setCampaign(await getCampaignById(campaignId));
    } catch (caught) {
      setError(errorText(caught));
    } finally {
      setLoading(false);
    }
  }, [campaignId]);
  useEffect(() => {
    void load();
  }, [load]);

  return (
    <AppShell
      role="client"
      groups={sidebarGroups}
      brandInitial="S"
      brandLabel="BantAI Shield"
      currentPath="/shield/campaigns"
      onNavigate={(path) => void navigate(path)}
      topbarContext={<span>Shield &middot; Campaigns &middot; Detail</span>}
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
        title="Campaign intelligence"
        description="Published campaign patterns and indicators. This portal does not display SMS messages or personal data."
        actions={
          <Button
            variant="ghost"
            size="sm"
            onClick={() => void navigate('/shield/campaigns')}
          >
            Back to campaigns
          </Button>
        }
      />
      {!campaignId ? (
        <ErrorState
          title="Campaign unavailable"
          description="No campaign identifier was supplied."
        />
      ) : loading ? (
        <LoadingState label="Loading campaign intelligence…" />
      ) : error ? (
        <ErrorState
          title="Campaign intelligence unavailable"
          description={error}
          action={
            <Button variant="secondary" onClick={() => void load()}>
              Retry
            </Button>
          }
        />
      ) : campaign ? (
        <>
          <section
            style={{
              background: 'var(--surface-raised)',
              borderRadius: 8,
              padding: '20px 24px',
              marginBottom: 24,
            }}
          >
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                gap: 12,
                flexWrap: 'wrap',
                alignItems: 'start',
              }}
            >
              <div>
                <h2 style={{ margin: 0, fontSize: '1.2rem' }}>
                  {campaign.label || 'Published campaign'}
                </h2>
                <p
                  style={{
                    margin: '6px 0 0',
                    color: 'var(--text-secondary)',
                    fontFamily: 'var(--font-mono, monospace)',
                    fontSize: '0.85rem',
                  }}
                >
                  {campaign.id}
                </p>
              </div>
              <StatusBadge
                kind={campaign.isActive ? 'threat' : 'unknown'}
                label={campaign.isActive ? 'Active' : 'Inactive'}
              />
            </div>
            <div style={{ marginTop: 20 }}>
              <MetricRow columns={3}>
                <Metric
                  label="First observed"
                  value={formatDate(campaign.createdAt)}
                />
                <Metric
                  label="Last updated"
                  value={formatDate(campaign.updatedAt)}
                />
                <Metric
                  label="Indicators"
                  value={campaign.urlDomains.length.toLocaleString()}
                  meta="Published domains"
                />
              </MetricRow>
            </div>
          </section>
          <section style={{ marginBottom: 24 }}>
            <h2 style={{ fontSize: '1rem', margin: '0 0 8px' }}>
              Campaign pattern
            </h2>
            <p
              style={{
                margin: 0,
                color: 'var(--text-secondary)',
                maxWidth: 760,
              }}
            >
              BantAI publishes campaign-level behavior and indicators after
              review. SMS examples, sender details, recipient information, and
              raw classification records remain outside Shield.
            </p>
          </section>
          <section>
            <h2 style={{ fontSize: '1rem', margin: '0 0 12px' }}>
              Published indicators
            </h2>
            {campaign.urlDomains.length === 0 ? (
              <EmptyState
                title="No published indicators"
                description="Indicators will appear when they have been reviewed and approved for Shield distribution."
              />
            ) : (
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                {campaign.urlDomains.map((domain) => (
                  <InfoBadge key={domain}>{domain}</InfoBadge>
                ))}
              </div>
            )}
          </section>
        </>
      ) : null}
    </AppShell>
  );
}

export default CampaignDetailPage;
