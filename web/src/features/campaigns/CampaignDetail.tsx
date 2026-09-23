/*
 * Shared Campaign Detail. Phase F step 4.
 *
 * Rendered by both client (/client/campaigns/:id) and admin (/admin/campaigns/:id).
 * Absorbs the legacy Timeline drill-down: the header + message table shows the
 * campaign's activity in one place instead of a separate route.
 *
 * Note: GET /campaigns/:id scopes messages to the requesting JWT user
 * (see CampaignsService.findOne in the backend). Admins therefore see only
 * their own view of a cluster's messages, not every user's — this is stated
 * in the messages panel description so admin viewers are not confused.
 */

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Button,
  ConfidenceMeter,
  DataTable,
  Dialog,
  EmptyState,
  ErrorState,
  InfoBadge,
  LoadingState,
  Metric,
  MetricRow,
  StatusBadge,
  type Column,
  type StatusKind,
} from '../../components/primitives';
import {
  deactivateCampaign,
  getCampaignById,
  type CampaignDetail as CampaignDetailData,
  type CampaignMessageSummary,
} from '../../services/campaignsService';

function errorText(e: unknown): string {
  return e instanceof Error ? e.message : 'The backend request failed.';
}

function formatDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

function formatDateTime(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

function labelToStatusKind(label?: string | null): StatusKind {
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

interface MessageRow {
  id: string;
  bodyPreview: string;
  fullBody: string;
  receivedAt: string;
  classificationLabel: string;
  classificationKind: StatusKind;
  confidence: number | null;
}

function toMessageRow(m: CampaignMessageSummary): MessageRow {
  const label = m.classification?.label ?? 'Unclassified';
  const preview =
    m.body.length > 140 ? `${m.body.slice(0, 137).trimEnd()}…` : m.body;
  return {
    id: m.id,
    bodyPreview: preview,
    fullBody: m.body,
    receivedAt: m.receivedAt,
    classificationLabel: label,
    classificationKind: labelToStatusKind(m.classification?.label),
    confidence:
      typeof m.classification?.score === 'number' ? m.classification.score : null,
  };
}

interface CampaignDetailProps {
  role: 'client' | 'admin';
  campaignId: string;
}

export function CampaignDetail({ role, campaignId }: CampaignDetailProps) {
  const [data, setData] = useState<CampaignDetailData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [deactivateOpen, setDeactivateOpen] = useState(false);
  const [deactivating, setDeactivating] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const detail = await getCampaignById(campaignId);
      setData(detail);
    } catch (e) {
      setError(errorText(e));
    } finally {
      setLoading(false);
    }
  }, [campaignId]);

  useEffect(() => {
    void load();
  }, [load]);

  const messageRows = useMemo<MessageRow[]>(
    () => (data?.messages ?? []).map(toMessageRow),
    [data],
  );

  async function confirmDeactivate() {
    if (!data) return;
    setDeactivating(true);
    setActionError(null);
    try {
      await deactivateCampaign(data.id);
      setDeactivateOpen(false);
      await load();
    } catch (e) {
      setActionError(errorText(e));
    } finally {
      setDeactivating(false);
    }
  }

  if (loading) return <LoadingState label="Loading campaign" />;

  if (error) {
    return (
      <ErrorState
        title="Campaign unavailable"
        description={error}
        action={
          <Button variant="secondary" onClick={() => void load()}>
            Retry
          </Button>
        }
      />
    );
  }

  if (!data) return null;

  const statusKind: StatusKind = data.isActive ? 'threat' : 'unknown';
  const canDeactivate = role === 'admin' && data.isActive;

  const messageColumns: Column<MessageRow>[] = [
    {
      key: 'receivedAt',
      header: 'Received',
      render: (r) => formatDateTime(r.receivedAt),
      width: '18%',
    },
    {
      key: 'body',
      header: 'Message',
      render: (r) => (
        <span style={{ whiteSpace: 'pre-wrap' }} title={r.fullBody}>
          {r.bodyPreview}
        </span>
      ),
    },
    {
      key: 'classification',
      header: 'Classification',
      render: (r) => (
        <StatusBadge kind={r.classificationKind} label={r.classificationLabel} />
      ),
      width: '16%',
    },
    {
      key: 'confidence',
      header: 'Confidence',
      render: (r) =>
        r.confidence == null ? (
          <span style={{ color: 'var(--text-secondary)' }}>&mdash;</span>
        ) : (
          <ConfidenceMeter value={r.confidence} compact />
        ),
      align: 'right',
      width: '18%',
    },
  ];

  return (
    <>
      <div
        style={{
          display: 'flex',
          gap: 16,
          alignItems: 'flex-start',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          marginBottom: 20,
        }}
      >
        <div style={{ minWidth: 0, flex: '1 1 auto' }}>
          <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
            <h1 style={{ margin: 0, fontSize: '1.5rem' }}>
              {data.label || 'Unlabeled campaign'}
            </h1>
            <StatusBadge
              kind={statusKind}
              label={data.isActive ? 'Active' : 'Inactive'}
            />
          </div>
          <p
            style={{
              margin: '6px 0 0',
              color: 'var(--text-secondary)',
              fontSize: '0.9rem',
              fontFamily: 'var(--font-mono, monospace)',
            }}
          >
            {data.id}
          </p>
        </div>
        {canDeactivate && (
          <Button
            variant="destructive"
            onClick={() => setDeactivateOpen(true)}
          >
            Deactivate
          </Button>
        )}
      </div>

      {actionError && (
        <div
          role="alert"
          style={{
            marginBottom: 16,
            padding: '10px 12px',
            borderRadius: 6,
            background:
              'color-mix(in srgb, var(--status-threat) 12%, var(--surface-raised))',
            color: 'var(--status-threat)',
            fontSize: '0.85rem',
          }}
        >
          {actionError}
        </div>
      )}

      <MetricRow columns={4}>
        <Metric
          label="Messages in cluster"
          value={data.messageCount.toLocaleString()}
        />
        <Metric label="Linked domains" value={data.urlDomains.length} />
        <Metric label="First seen" value={formatDate(data.createdAt)} />
        <Metric label="Last updated" value={formatDate(data.updatedAt)} />
      </MetricRow>

      <section style={{ marginTop: 32 }}>
        <h2 style={{ fontSize: '1.05rem', margin: '0 0 12px' }}>
          Linked domains
        </h2>
        {data.urlDomains.length === 0 ? (
          <p style={{ color: 'var(--text-secondary)', margin: 0 }}>
            No domains associated with this cluster yet.
          </p>
        ) : (
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {data.urlDomains.map((domain) => (
              <InfoBadge key={domain}>{domain}</InfoBadge>
            ))}
          </div>
        )}
      </section>

      <section style={{ marginTop: 32 }}>
        <h2 style={{ fontSize: '1.05rem', margin: '0 0 6px' }}>
          Messages in this campaign
        </h2>
        <p
          style={{
            margin: '0 0 12px',
            color: 'var(--text-secondary)',
            fontSize: '0.85rem',
          }}
        >
          Showing your view of this cluster. Up to 25 most recent messages you
          own are returned by the backend.
        </p>
        <DataTable<MessageRow>
          ariaLabel="Messages in this campaign"
          rowKey={(r) => r.id}
          rows={messageRows}
          columns={messageColumns}
          emptyState={
            <EmptyState
              title="No messages in your view"
              description="You have not received any messages that fall under this cluster."
            />
          }
        />
      </section>

      <Dialog
        open={deactivateOpen}
        title="Deactivate campaign?"
        onClose={() => {
          if (!deactivating) setDeactivateOpen(false);
        }}
        actions={
          <>
            <Button
              variant="ghost"
              onClick={() => setDeactivateOpen(false)}
              disabled={deactivating}
            >
              Cancel
            </Button>
            <Button
              variant="destructive-confirm"
              onClick={() => void confirmDeactivate()}
              disabled={deactivating}
            >
              {deactivating ? 'Deactivating…' : 'Deactivate campaign'}
            </Button>
          </>
        }
      >
        <p style={{ margin: 0 }}>
          New messages will stop clustering under{' '}
          <strong>{data.label || 'this campaign'}</strong>. Existing messages
          already assigned to it stay linked. This does not delete the cluster
          record.
        </p>
      </Dialog>
    </>
  );
}
