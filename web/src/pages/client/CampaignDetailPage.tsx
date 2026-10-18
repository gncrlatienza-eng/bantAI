import React, { useCallback, useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { PageHeader } from '../../components/appshell/AppShell';
import {
  Button,
  EmptyState,
  ErrorState,
  InfoBadge,
  LoadingState,
  Metric,
  MetricRow,
  StatusBadge,
  StatPanel,
  SectionHeader,
} from '../../components/primitives';
import {
  getCampaignById,
  getCampaignMaskedMessages,
  type CampaignDetail,
  type ShieldMaskedMessage,
} from '../../services/campaignsService';
import { MaskedMessage } from '../../components/masked/MaskedMessage';
import { CampaignExportButton } from './CampaignExportButton';
import type { StatusKind } from '../../components/primitives';

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
    <>
      <PageHeader
        title={
          campaign
            ? campaign.title || campaign.label || 'Published campaign'
            : 'Campaign'
        }
        meta={
          campaign ? (
            <span
              style={{
                display: 'inline-flex',
                gap: 8,
                alignItems: 'center',
                flexWrap: 'wrap',
              }}
            >
              <StatusBadge
                kind={riskKind(campaign.risk)}
                label={
                  campaign.risk && campaign.risk !== 'UNKNOWN'
                    ? `${campaign.risk.charAt(0)}${campaign.risk.slice(1).toLowerCase()} risk`
                    : 'Risk not rated'
                }
              />
              {/* Risk is the one badge; status and id are plain text, so the
                  line doesn't stack two coloured chips. */}
              <span>
                {campaign.isActive ? 'Active' : 'Inactive'} ·{' '}
                <span style={{ fontFamily: 'var(--font-mono)' }}>
                  {campaign.id}
                </span>
              </span>
            </span>
          ) : undefined
        }
        actions={
          campaign ? (
            <CampaignExportButton campaignId={campaign.id} />
          ) : undefined
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
          <StatPanel label="Campaign summary">
            <MetricRow columns={3}>
              <Metric
                label="First observed"
                value={formatDate(campaign.firstObserved ?? campaign.createdAt)}
              />
              <Metric
                label="Last observed"
                value={formatDate(campaign.lastObserved ?? campaign.updatedAt)}
              />
              <Metric
                label="Indicators"
                value={campaign.urlDomains.length.toLocaleString()}
              />
            </MetricRow>
          </StatPanel>
          <section style={{ marginBottom: 24 }}>
            <SectionHeader
              title="Campaign pattern"
              description={
                campaign.category && campaign.category !== 'Uncategorized'
                  ? campaign.category
                  : undefined
              }
            />
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
              <SectionHeader title="Recommended mitigation" />
              <p style={{ margin: 0, maxWidth: 760 }}>{campaign.mitigation}</p>
            </section>
          )}
          <section style={{ marginBottom: 24 }}>
            <SectionHeader title="Masked message examples" />
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
            <SectionHeader title="Published indicators" />
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
    </>
  );
}

export default CampaignDetailPage;
