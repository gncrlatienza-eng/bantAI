/*
 * Client Messages inbox. Phase F step 5.
 *
 * Analyst inbox pattern per redesign Section 19: list on the left, detail
 * panel on the right. On narrow viewports the detail collapses below the
 * list. The detail panel absorbs the legacy "Review classification" modal
 * (indicator list + correction submission) so the workflow is one continuous
 * surface, not a modal round-trip.
 *
 * Privacy: raw SMS body stays on the device. This portal exposes only
 * classification metadata, alert lifecycle, and per-message indicator tags
 * the backend was willing to return.
 */

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import './messages.css';
import {
  Button,
  ConfidenceMeter,
  DataTable,
  EmptyState,
  ErrorState,
  InfoBadge,
  LoadingState,
  SearchInput,
  Select,
  StatusBadge,
  type Column,
  type StatusKind,
} from '../../components/primitives';
import {
  getSmsAlerts,
  getMessageIndicators,
  type SmsAlertItem,
} from '../../services/smsService';
import { submitReport } from '../../services/reportsService';

function errorText(e: unknown): string {
  return e instanceof Error ? e.message : 'The backend request failed.';
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

type LabelFilter = 'all' | 'Scam' | 'Spam' | 'Ham' | 'Unknown';

interface InboxRow {
  id: string;
  messageId: string;
  sourceId: string;
  status: string;
  classificationLabel: string;
  classificationKind: StatusKind;
  confidence: number | null;
  receivedAt: string;
  original: SmsAlertItem;
}

function toRow(item: SmsAlertItem): InboxRow {
  const label = item.message.classification?.label ?? 'Unknown';
  return {
    id: item.id,
    messageId: item.message.id,
    sourceId: item.message.sourceId,
    status: item.status,
    classificationLabel: label,
    classificationKind: labelToStatusKind(item.message.classification?.label),
    confidence:
      typeof item.message.classification?.score === 'number'
        ? item.message.classification.score
        : null,
    receivedAt: item.message.receivedAt,
    original: item,
  };
}

export function MessagesInbox() {
  const [alerts, setAlerts] = useState<SmsAlertItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [labelFilter, setLabelFilter] = useState<LabelFilter>('all');

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [indicators, setIndicators] = useState<
    Array<{ tag: string; weight: number }>
  >([]);
  const [indicatorsLoading, setIndicatorsLoading] = useState(false);

  const [reportSubmitting, setReportSubmitting] = useState(false);
  const [reportMessage, setReportMessage] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await getSmsAlerts();
      setAlerts(data);
    } catch (e) {
      setError(errorText(e));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const rows = useMemo<InboxRow[]>(() => {
    let mapped = alerts.map(toRow);

    if (labelFilter !== 'all') {
      mapped = mapped.filter((r) => r.classificationLabel === labelFilter);
    }

    const needle = search.trim().toLowerCase();
    if (needle) {
      mapped = mapped.filter((r) =>
        [r.id, r.messageId, r.sourceId, r.status, r.classificationLabel]
          .filter(Boolean)
          .some((value) => String(value).toLowerCase().includes(needle)),
      );
    }

    mapped.sort((a, b) => Date.parse(b.receivedAt) - Date.parse(a.receivedAt));
    return mapped;
  }, [alerts, labelFilter, search]);

  const selected = useMemo(
    () => rows.find((r) => r.id === selectedId) ?? null,
    [rows, selectedId],
  );

  useEffect(() => {
    setIndicators([]);
    setReportMessage(null);
    if (!selected) return;
    setIndicatorsLoading(true);
    void getMessageIndicators(selected.messageId)
      .then((r) => setIndicators(r.indicators))
      .catch(() => setIndicators([]))
      .finally(() => setIndicatorsLoading(false));
  }, [selected]);

  async function reportCorrection(label: 'Ham' | 'Spam' | 'Scam') {
    if (!selected) return;
    setReportSubmitting(true);
    setReportMessage(null);
    try {
      await submitReport(selected.messageId, label);
      setReportMessage(`Correction submitted to the backend as ${label}.`);
    } catch (e) {
      setReportMessage(errorText(e));
    } finally {
      setReportSubmitting(false);
    }
  }

  if (error && !loading) {
    return (
      <ErrorState
        title="Alerts unavailable"
        description={error}
        action={
          <Button variant="secondary" onClick={() => void load()}>
            Retry
          </Button>
        }
      />
    );
  }

  const columns: Column<InboxRow>[] = [
    {
      key: 'receivedAt',
      header: 'Received',
      render: (r) => formatDateTime(r.receivedAt),
      width: '20%',
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
      width: '18%',
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
      width: '20%',
    },
    {
      key: 'sourceId',
      header: 'Source',
      render: (r) => (
        <span
          style={{
            fontFamily: 'var(--font-mono, monospace)',
            fontSize: '0.85rem',
          }}
        >
          {r.sourceId || r.messageId}
        </span>
      ),
    },
  ];

  return (
    <>
      <div
        style={{
          display: 'flex',
          gap: 12,
          flexWrap: 'wrap',
          alignItems: 'flex-end',
          marginBottom: 16,
        }}
      >
        <div style={{ flex: '1 1 320px', minWidth: 260 }}>
          <SearchInput
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onClear={() => setSearch('')}
            placeholder="Search alert id, message id, source, or status"
          />
        </div>
        <div style={{ minWidth: 200 }}>
          <Select
            label="Classification"
            value={labelFilter}
            onChange={(e) => setLabelFilter(e.target.value as LabelFilter)}
            options={[
              { value: 'all', label: 'All labels' },
              { value: 'Scam', label: 'Scam' },
              { value: 'Spam', label: 'Spam' },
              { value: 'Ham', label: 'Ham' },
              { value: 'Unknown', label: 'Unknown' },
            ]}
          />
        </div>
      </div>

      <div className="bantai-inbox-layout">
        <div className="bantai-inbox-list">
          <DataTable<InboxRow>
            ariaLabel="Message alerts"
            rowKey={(r) => r.id}
            rows={rows}
            columns={columns}
            loading={loading}
            activeRowKey={selected?.id}
            onRowClick={(r) => setSelectedId(r.id)}
            emptyState={
              <EmptyState
                title={
                  search || labelFilter !== 'all'
                    ? 'No alerts match the current filters'
                    : 'No alert records'
                }
                description={
                  search || labelFilter !== 'all'
                    ? 'Clear a filter or broaden the search to see more results.'
                    : 'Alerts appear here as the backend classifies incoming SMS on your device.'
                }
                action={
                  search || labelFilter !== 'all' ? (
                    <Button
                      variant="secondary"
                      onClick={() => {
                        setSearch('');
                        setLabelFilter('all');
                      }}
                    >
                      Clear filters
                    </Button>
                  ) : undefined
                }
              />
            }
          />
        </div>

        <aside
          className="bantai-inbox-detail"
          aria-label="Selected alert detail"
        >
          {!selected ? (
            <div
              style={{
                padding: 24,
                background: 'var(--surface-raised)',
                border: '1px solid var(--border-default)',
                borderRadius: 8,
                color: 'var(--text-secondary)',
              }}
            >
              <p style={{ margin: 0 }}>
                Select an alert on the left to review the classification and
                submit a correction.
              </p>
            </div>
          ) : (
            <div
              style={{
                padding: 20,
                background: 'var(--surface-raised)',
                border: '1px solid var(--border-default)',
                borderRadius: 8,
                display: 'grid',
                gap: 16,
              }}
            >
              <div>
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    gap: 8,
                    marginBottom: 6,
                  }}
                >
                  <StatusBadge
                    kind={selected.classificationKind}
                    label={selected.classificationLabel}
                  />
                  <span
                    style={{
                      fontSize: '0.8rem',
                      color: 'var(--text-secondary)',
                    }}
                  >
                    {selected.status}
                  </span>
                </div>
                <p
                  style={{
                    margin: 0,
                    fontSize: '0.85rem',
                    color: 'var(--text-secondary)',
                  }}
                >
                  {formatDateTime(selected.receivedAt)}
                </p>
              </div>

              <p
                style={{
                  margin: 0,
                  fontSize: '0.85rem',
                  color: 'var(--text-secondary)',
                }}
              >
                BantAI keeps raw sender and SMS body on the device. This portal
                exposes only server-side classification metadata.
              </p>

              <dl
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'max-content 1fr',
                  gap: '6px 12px',
                  margin: 0,
                  fontSize: '0.85rem',
                }}
              >
                <dt style={{ color: 'var(--text-secondary)' }}>Alert ID</dt>
                <dd
                  style={{
                    margin: 0,
                    fontFamily: 'var(--font-mono, monospace)',
                  }}
                >
                  {selected.id}
                </dd>
                <dt style={{ color: 'var(--text-secondary)' }}>Message ID</dt>
                <dd
                  style={{
                    margin: 0,
                    fontFamily: 'var(--font-mono, monospace)',
                  }}
                >
                  {selected.messageId}
                </dd>
                <dt style={{ color: 'var(--text-secondary)' }}>Source</dt>
                <dd
                  style={{
                    margin: 0,
                    fontFamily: 'var(--font-mono, monospace)',
                  }}
                >
                  {selected.sourceId || '—'}
                </dd>
                <dt style={{ color: 'var(--text-secondary)' }}>Confidence</dt>
                <dd style={{ margin: 0 }}>
                  {selected.confidence == null ? (
                    '—'
                  ) : (
                    <ConfidenceMeter value={selected.confidence} compact />
                  )}
                </dd>
              </dl>

              <div>
                <h3
                  style={{
                    margin: '0 0 8px',
                    fontSize: '0.95rem',
                  }}
                >
                  Indicators
                </h3>
                {indicatorsLoading ? (
                  <LoadingState label="Loading indicators" />
                ) : indicators.length === 0 ? (
                  <p
                    style={{
                      margin: 0,
                      fontSize: '0.85rem',
                      color: 'var(--text-secondary)',
                    }}
                  >
                    No indicators returned by the backend for this message.
                  </p>
                ) : (
                  <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                    {indicators.map((it) => (
                      <InfoBadge key={it.tag}>
                        {it.tag} · {Math.round(it.weight * 100)}%
                      </InfoBadge>
                    ))}
                  </div>
                )}
              </div>

              <div>
                <h3
                  style={{
                    margin: '0 0 8px',
                    fontSize: '0.95rem',
                  }}
                >
                  Submit a correction
                </h3>
                <p
                  style={{
                    margin: '0 0 10px',
                    fontSize: '0.8rem',
                    color: 'var(--text-secondary)',
                  }}
                >
                  Corrections feed the retraining queue after admin validation.
                </p>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  {(['Ham', 'Spam', 'Scam'] as const).map((label) => (
                    <Button
                      key={label}
                      variant="secondary"
                      size="sm"
                      disabled={reportSubmitting}
                      onClick={() => void reportCorrection(label)}
                    >
                      Report as {label}
                    </Button>
                  ))}
                </div>
                {reportMessage && (
                  <p
                    aria-live="polite"
                    style={{
                      margin: '10px 0 0',
                      fontSize: '0.85rem',
                      color: 'var(--text-secondary)',
                    }}
                  >
                    {reportMessage}
                  </p>
                )}
              </div>
            </div>
          )}
        </aside>
      </div>
    </>
  );
}
