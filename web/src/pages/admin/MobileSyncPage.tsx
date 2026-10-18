import React, { useCallback, useEffect, useRef, useState } from 'react';
import { PageHeader } from '../../components/appshell/AppShell';
import {
  Button,
  ConfidenceMeter,
  DataTable,
  EmptyState,
  ErrorState,
  LoadingState,
  Metric,
  Select,
  StatusBadge,
  type Column,
  type StatusKind,
  MetricRow,
  SectionHeader,
  StatPanel,
} from '../../components/primitives';
import {
  getAdminClassificationHistory,
  cloudVerificationLabel,
  getAdminMobileSync,
  type AdminClassificationItem,
  type AdminClassificationHistory,
  type AdminMobileSyncSummary,
  type ClassificationHistoryFilter,
} from '../../services/smsService';
import { HowThisWorks, NewestFirstHeader, ShortId } from './adminDisplay';
import { formatCompactDateTime } from '../../utils/dateFormat';

function errorText(error: unknown): string {
  return error instanceof Error ? error.message : 'The backend request failed.';
}

function formatDateTime(value: string | null): string {
  if (!value) return 'No sync yet';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Unknown';
  return formatCompactDateTime(date);
}

function statusKind(label: string): StatusKind {
  if (label === 'Scam') return 'threat';
  if (label === 'Spam') return 'suspicious';
  if (label === 'Ham') return 'verified';
  return 'unknown';
}

export function MobileSyncPage() {
  const [data, setData] = useState<AdminMobileSyncSummary | null>(null);
  const [history, setHistory] = useState<AdminClassificationHistory | null>(
    null,
  );
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loadMoreError, setLoadMoreError] = useState<string | null>(null);
  const [filter, setFilter] = useState<ClassificationHistoryFilter>('threats');
  const requestGeneration = useRef(0);

  const load = useCallback(async () => {
    const generation = ++requestGeneration.current;
    setLoading(true);
    setLoadingMore(false);
    setError(null);
    setLoadMoreError(null);
    try {
      const [summary, page] = await Promise.all([
        getAdminMobileSync(),
        getAdminClassificationHistory({ label: filter }),
      ]);
      if (generation !== requestGeneration.current) return;
      setData(summary);
      setHistory(page);
    } catch (requestError) {
      if (generation === requestGeneration.current) {
        setError(errorText(requestError));
      }
    } finally {
      if (generation === requestGeneration.current) setLoading(false);
    }
  }, [filter]);

  useEffect(() => {
    void load();
  }, [load]);

  const rows = history?.items ?? [];

  const loadMore = async () => {
    if (!history?.nextCursor || loadingMore) return;
    const generation = requestGeneration.current;
    setLoadingMore(true);
    setLoadMoreError(null);
    try {
      const page = await getAdminClassificationHistory({
        label: filter,
        cursor: history.nextCursor,
      });
      if (generation === requestGeneration.current) {
        setHistory((current) =>
          current
            ? {
                items: [...current.items, ...page.items],
                nextCursor: page.nextCursor,
              }
            : page,
        );
      }
    } catch (requestError) {
      if (generation === requestGeneration.current) {
        setLoadMoreError(errorText(requestError));
      }
    } finally {
      if (generation === requestGeneration.current) setLoadingMore(false);
    }
  };

  // The API pages by sync time, newest first. Showing that column first
  // explains why an old inbox message can sit above a newer one.
  const columns: Column<AdminClassificationItem>[] = [
    {
      key: 'createdAt',
      header: <NewestFirstHeader>Synced</NewestFirstHeader>,
      render: (row) => (
        <span style={{ whiteSpace: 'nowrap' }}>
          {formatDateTime(row.createdAt)}
        </span>
      ),
      width: '18%',
    },
    {
      key: 'receivedAt',
      header: 'Received on phone',
      render: (row) => formatDateTime(row.receivedAt),
      width: '18%',
    },
    {
      key: 'label',
      header: 'Classification',
      render: (row) => (
        <StatusBadge kind={statusKind(row.label)} label={row.label} />
      ),
      width: '14%',
    },
    {
      key: 'score',
      header: 'Confidence',
      render: (row) => <ConfidenceMeter value={row.score} compact />,
      align: 'right',
      width: '14%',
    },
    {
      key: 'bucket',
      header: 'Risk bucket',
      render: (row) => row.bucket ?? '—',
    },
    {
      key: 'alertStatus',
      header: 'Alert status',
      render: (row) => row.alertStatus ?? 'Not alerted',
    },
    {
      key: 'verificationStatus',
      header: 'Cloud verification',
      render: (row) => cloudVerificationLabel(row.verificationStatus),
    },
    {
      key: 'messageId',
      header: 'Record ID',
      render: (row) => <ShortId id={row.messageId} />,
    },
  ];

  return (
    <>
      <PageHeader
        title="Messages"
        description="Synced from signed-in phones. Text, senders and identities stay hidden."
        meta={
          data
            ? `Last synced ${formatDateTime(data.latestSyncAt)}`
            : 'Reading mobile sync activity…'
        }
        actions={
          <Button
            variant="secondary"
            onClick={() => void load()}
            disabled={loading}
          >
            {loading ? 'Refreshing…' : 'Refresh'}
          </Button>
        }
      />

      {error && !loading ? (
        <ErrorState
          title="Messages unavailable"
          description={error}
          action={
            <Button variant="secondary" onClick={() => void load()}>
              Retry
            </Button>
          }
        />
      ) : loading && !data ? (
        <LoadingState label="Loading synced classifications" />
      ) : data ? (
        <>
          <StatPanel label="Messages summary">
            <MetricRow columns={4}>
              <Metric
                label="Synced accounts"
                value={data.syncedAccounts.toLocaleString()}
              />
              <Metric
                label="Classified"
                value={data.classifiedMessages.toLocaleString()}
                meta={`${data.totalMessages.toLocaleString()} messages received`}
              />
              <Metric label="Scam" value={data.scamCount.toLocaleString()} />
              <Metric label="Spam" value={data.spamCount.toLocaleString()} />
            </MetricRow>
          </StatPanel>

          <section aria-labelledby="recent-mobile-sync-heading">
            <SectionHeader
              id="recent-mobile-sync-heading"
              title="Recent classifications"
              actions={
                <>
                  <HowThisWorks align="end">
                    Rows are ordered by when the server classified them, so an
                    older inbox message scanned later appears near the top.
                    Device count is not inferred because BantAI does not retain
                    a stable device identifier. A “blocked” risk bucket does not
                    mean the sender was blocked; blocking requires the user to
                    choose Block.
                  </HowThisWorks>
                  <div style={{ width: 200 }}>
                    <Select
                      label="Classification"
                      hideLabel
                      value={filter}
                      onChange={(event) =>
                        setFilter(
                          event.target.value as ClassificationHistoryFilter,
                        )
                      }
                      options={[
                        { value: 'threats', label: 'Scam and Spam' },
                        { value: 'all', label: 'All classifications' },
                        { value: 'Scam', label: 'Scam' },
                        { value: 'Spam', label: 'Spam' },
                        { value: 'Ham', label: 'Ham' },
                      ]}
                    />
                  </div>
                </>
              }
            />
            <DataTable<AdminClassificationItem>
              ariaLabel="Recent mobile classifications"
              rowKey={(row) => row.id}
              rows={rows}
              columns={columns}
              loading={loading}
              emptyState={
                <EmptyState
                  title={
                    filter === 'all' || filter === 'threats'
                      ? 'No mobile classifications yet'
                      : `No ${filter} classifications`
                  }
                  description={
                    filter === 'all' || filter === 'threats'
                      ? 'Privacy-minimized classifications will appear after a signed-in phone scans and syncs its SMS inbox.'
                      : 'Choose another classification or wait for new mobile activity.'
                  }
                />
              }
            />
            {loadMoreError && <p role="alert">{loadMoreError}</p>}
            {history?.nextCursor && (
              <Button
                variant="secondary"
                onClick={() => void loadMore()}
                disabled={loadingMore || loading}
                style={{ marginTop: 16 }}
              >
                {loadingMore
                  ? 'Loading older classifications…'
                  : 'Load older classifications'}
              </Button>
            )}
          </section>
        </>
      ) : null}
    </>
  );
}

export default MobileSyncPage;
