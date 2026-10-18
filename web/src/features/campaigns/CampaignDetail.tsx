/*
 * Shared Campaign Detail. Phase F step 4.
 *
 * Rendered by Admin. Shield has a separate intelligence-only detail page.
 *
 * The backend returns up to 25 stored masked campaign records through an
 * audited Admin path. Original SMS bodies remain on users' phones.
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
  SectionHeader,
  StatPanel,
} from '../../components/primitives';
import {
  archiveCampaign,
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
      typeof m.classification?.score === 'number'
        ? m.classification.score
        : null,
  };
}

interface CampaignDetailProps {
  role: 'client' | 'admin';
  campaignId: string;
  onArchived?: () => void;
}

export function CampaignDetail({
  role,
  campaignId,
  onArchived,
}: CampaignDetailProps) {
  const [data, setData] = useState<CampaignDetailData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [deactivateOpen, setDeactivateOpen] = useState(false);
  const [deactivating, setDeactivating] = useState(false);
  const [archiveOpen, setArchiveOpen] = useState(false);
  const [archiving, setArchiving] = useState(false);
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

  async function confirmArchive() {
    if (!data) return;
    setArchiving(true);
    setActionError(null);
    try {
      await archiveCampaign(data.id);
      setArchiveOpen(false);
      await load();
      onArchived?.();
    } catch (e) {
      setActionError(errorText(e));
    } finally {
      setArchiving(false);
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
  const canDeactivate = role === 'admin' && data.isActive && !data.archivedAt;
  const canArchive = role === 'admin' && !data.archivedAt;

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
        <StatusBadge
          kind={r.classificationKind}
          label={r.classificationLabel}
        />
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
      {/* The campaign is the page title; the breadcrumb leads back. */}
      <header className="bantai-pageheader">
        <div className="bantai-pageheader__row">
          <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
            <h1 className="bantai-pageheader__title">
              {data.label || 'Unlabeled campaign'}
            </h1>
            <StatusBadge
              kind={statusKind}
              label={
                data.archivedAt
                  ? 'Archived'
                  : data.isActive
                    ? 'Active'
                    : 'Inactive'
              }
            />
          </div>
          {(canDeactivate || canArchive) && (
            <div className="bantai-pageheader__actions">
              {canArchive && (
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => setArchiveOpen(true)}
                >
                  Archive
                </Button>
              )}
              {canDeactivate && (
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={() => setDeactivateOpen(true)}
                >
                  Deactivate
                </Button>
              )}
            </div>
          )}
        </div>
        <p
          className="bantai-pageheader__meta"
          style={{ fontFamily: 'var(--font-mono)' }}
        >
          {data.id}
        </p>
      </header>

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

      <StatPanel label="Campaign summary">
        <MetricRow columns={4}>
          <Metric
            label="Messages in cluster"
            value={
              data.countVerified === false
                ? 'Needs review'
                : (data.messageCount ?? 0).toLocaleString()
            }
          />
          <Metric label="Linked domains" value={data.urlDomains.length} />
          <Metric label="First seen" value={formatDate(data.createdAt)} />
          <Metric label="Last updated" value={formatDate(data.updatedAt)} />
        </MetricRow>
      </StatPanel>

      <section style={{ marginTop: 32 }}>
        <SectionHeader title="Linked domains" />
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
        <SectionHeader
          title="Messages in this campaign"
          description="The 25 most recent masked records. Original SMS text is never stored."
        />
        <DataTable<MessageRow>
          ariaLabel="Messages in this campaign"
          rowKey={(r) => r.id}
          rows={messageRows}
          columns={messageColumns}
          emptyState={
            <EmptyState
              title="No stored campaign records"
              description="No masked records are currently linked to this campaign."
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

      <Dialog
        open={archiveOpen}
        title="Archive campaign?"
        onClose={() => {
          if (!archiving) setArchiveOpen(false);
        }}
        actions={
          <>
            <Button
              variant="ghost"
              onClick={() => setArchiveOpen(false)}
              disabled={archiving}
            >
              Cancel
            </Button>
            <Button
              variant="destructive-confirm"
              onClick={() => void confirmArchive()}
              disabled={archiving}
            >
              {archiving ? 'Archiving…' : 'Archive campaign'}
            </Button>
          </>
        }
      >
        <p style={{ margin: 0 }}>
          Archiving stops matching and withdraws Shield publication. Admin can
          still inspect the record and its audit history.
        </p>
      </Dialog>
    </>
  );
}
