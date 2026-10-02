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
  getCampaignMaskedMessages,
  type CampaignDetail,
  type ShieldMaskedMessage,
} from '../../services/campaignsService';
import { MaskedMessage } from '../../components/masked/MaskedMessage';
import type { StatusKind } from '../../components/primitives';
import { logout } from '../../services/authService';
import { useClientSidebarGroups } from './clientNav';

const errorText = (error: unknown) =>
  error instanceof Error
    ? error.message
    : 'The campaign intelligence request failed.';
function riskKind(risk?: string | null): StatusKind {
  if (risk === 'CRITICAL') return 'critical';
  if (risk === 'HIGH') return 'threat';
  if (risk === 'MEDIUM') return 'suspicious';
  return 'unknown';
}

const formatDate = (iso: string | undefined) => {
  if (!iso) return 'Unavailable';
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
  // null = examples not available to this subscription (403) or failed;
  // the rest of the page does not depend on them.
  const [examples, setExamples] = useState<ShieldMaskedMessage[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const load = useCallback(async () => {
    if (!campaignId) return;
    setLoading(true);
    setError(null);
    try {
      const [detail, masked] = await Promise.all([
        getCampaignById(campaignId),
        getCampaignMaskedMessages(campaignId).catch(() => null),
      ]);
      setCampaign(detail);
      setExamples(masked);
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
        description="Published campaign patterns and indicators. Examples are admin-approved and privacy-masked; this portal never shows original SMS or personal data."
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
                  {campaign.title || campaign.label || 'Published campaign'}
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
              <span style={{ display: 'inline-flex', gap: 8 }}>
                <StatusBadge
                  kind={riskKind(campaign.risk)}
                  label={
                    campaign.risk && campaign.risk !== 'UNKNOWN'
                      ? `${campaign.risk.charAt(0)}${campaign.risk.slice(1).toLowerCase()} risk`
                      : 'Risk not rated'
                  }
                />
                <StatusBadge
                  kind="unknown"
                  label={campaign.isActive ? 'Active' : 'Dormant'}
                />
              </span>
            </div>
            <div style={{ marginTop: 20 }}>
              <MetricRow columns={3}>
                <Metric
                  label="First observed"
                  value={formatDate(
                    campaign.firstObserved ?? campaign.createdAt,
                  )}
                />
                <Metric
                  label="Last observed"
                  value={formatDate(
                    campaign.lastObserved ?? campaign.updatedAt,
                  )}
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
              {campaign.category && campaign.category !== 'Uncategorized' && (
                <span
                  style={{
                    marginLeft: 8,
                    fontWeight: 400,
                    color: 'var(--text-secondary)',
                  }}
                >
                  · {campaign.category}
                </span>
              )}
            </h2>
            <p
              style={{
                margin: 0,
                color: campaign.summary
                  ? 'var(--text-primary)'
                  : 'var(--text-secondary)',
                maxWidth: 760,
              }}
            >
              {campaign.summary ||
                'A reviewed summary has not been published for this campaign yet.'}
            </p>
          </section>
          {campaign.mitigation && (
            <section style={{ marginBottom: 24 }}>
              <h2 style={{ fontSize: '1rem', margin: '0 0 8px' }}>
                Recommended mitigation
              </h2>
              <p style={{ margin: 0, maxWidth: 760 }}>{campaign.mitigation}</p>
            </section>
          )}
          <section style={{ marginBottom: 24 }}>
            <h2 style={{ fontSize: '1rem', margin: '0 0 12px' }}>
              Masked message examples
            </h2>
            {examples === null ? (
              <EmptyState
                title="Examples not included in this subscription"
                description="Admin-approved, privacy-masked examples are available on plans with campaign intelligence."
              />
            ) : examples.length === 0 ? (
              <EmptyState
                title="No approved examples yet"
                description="Examples appear here after an analyst approves a privacy-masked sample for Shield."
              />
            ) : (
              <ul
                style={{
                  listStyle: 'none',
                  margin: 0,
                  padding: 0,
                  display: 'grid',
                  gap: 10,
                }}
              >
                {examples.map((example, index) => (
                  <li
                    key={index}
                    style={{
                      padding: '12px 14px',
                      borderRadius: 8,
                      border: '1px solid var(--border-default)',
                      background: 'var(--surface-raised)',
                    }}
                  >
                    <MaskedMessage text={example.text} />
                    {(example.classification || example.language) && (
                      <div
                        style={{
                          marginTop: 6,
                          fontSize: '0.8rem',
                          color: 'var(--text-secondary)',
                        }}
                      >
                        {[example.classification, example.language]
                          .filter(Boolean)
                          .join(' · ')}
                      </div>
                    )}
                  </li>
                ))}
              </ul>
            )}
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
