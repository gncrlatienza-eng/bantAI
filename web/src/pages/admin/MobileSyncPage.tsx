import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { AppShell, PageHeader } from '../../components/appshell/AppShell';
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
import { ADMIN_SIDEBAR_GROUPS } from './adminNav';

function errorText(error: unknown): string {
  return error instanceof Error ? error.message : 'The backend request failed.';
}

function formatDateTime(value: string | null): string {
  if (!value) return 'No sync yet';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Unknown';
  return date.toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

function statusKind(label: string): StatusKind {
  if (label === 'Scam') return 'threat';
  if (label === 'Spam') return 'suspicious';
  if (label === 'Ham') return 'verified';
  return 'unknown';
}

export function MobileSyncPage() {
  const navigate = useNavigate();
  const location = useLocation();
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

  const columns: Column<AdminClassificationItem>[] = [
    {
      key: 'verificationStatus',
      header: 'Cloud verification',
      render: (row) => cloudVerificationLabel(row.verificationStatus),
    },
    {
      key: 'receivedAt',
      header: 'Received on phone',
      render: (row) => formatDateTime(row.receivedAt),
      width: '26%',
    },
    {
      key: 'label',
      header: 'Classification',
      render: (row) => (
        <StatusBadge kind={statusKind(row.label)} label={row.label} />
      ),
      width: '18%',
    },
    {
      key: 'score',
      header: 'Confidence',
      render: (row) => <ConfidenceMeter value={row.score} compact />,
      align: 'right',
      width: '22%',
    },
    {
      key: 'bucket',
      header: 'Risk bucket',
      render: (row) => row.bucket ?? '—',
      width: '16%',
    },
    {
      key: 'alertStatus',
      header: 'Alert status',
      render: (row) => row.alertStatus ?? 'Not alerted',
    },
  ];

  return (
    <AppShell
      role="admin"
      groups={ADMIN_SIDEBAR_GROUPS}
      brandInitial="B"
      brandLabel="BantAI Admin"
      currentPath={location.pathname}
      onNavigate={(path) => void navigate(path)}
      topbarContext={<span>Intelligence &middot; Mobile sync</span>}
      footer={<span style={{ fontSize: '0.85rem' }}>Authenticated admin</span>}
    >
      <PageHeader
        title="Mobile sync"
        description="Privacy-minimized classification activity received from signed-in mobile accounts. SMS text is masked before transfer, and this admin view omits message content, senders, contacts, and user identity."
        meta={
          data
            ? `Last server classification: ${formatDateTime(data.latestSyncAt)}`
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
          title="Mobile sync unavailable"
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
          <section
            aria-label="Mobile sync summary"
            style={{
              background: 'var(--surface-raised)',
              borderRadius: 8,
              padding: '20px 24px',
              marginBottom: 24,
            }}
          >
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))',
                gap: 24,
              }}
            >
              <Metric
                label="Synced accounts"
                value={data.syncedAccounts.toLocaleString()}
                meta="accounts with mobile SMS metadata"
              />
              <Metric
                label="Classified"
                value={data.classifiedMessages.toLocaleString()}
                meta={`${data.totalMessages.toLocaleString()} messages received`}
              />
              <Metric
                label="Scam"
                value={data.scamCount.toLocaleString()}
                meta="privacy-safe detections"
              />
              <Metric
                label="Spam"
                value={data.spamCount.toLocaleString()}
                meta="privacy-safe detections"
              />
            </div>
          </section>

          <section aria-labelledby="recent-mobile-sync-heading">
            <div
              style={{
                display: 'flex',
                alignItems: 'flex-end',
                justifyContent: 'space-between',
                gap: 16,
                flexWrap: 'wrap',
                marginBottom: 12,
              }}
            >
              <div>
                <h2
                  id="recent-mobile-sync-heading"
                  style={{ margin: 0, fontSize: '1.05rem' }}
                >
                  Recent classifications
                </h2>
                <p
                  style={{
                    margin: '6px 0 0',
                    color: 'var(--text-secondary)',
                    fontSize: '0.85rem',
                  }}
                >
                  Browse all synced classifications, including older messages
                  scanned from the phone. Device count is not inferred because
                  BantAI does not retain a stable device identifier. A “blocked”
                  risk bucket does not mean the sender was blocked; blocking
                  requires the user to choose Block.
                </p>
              </div>
              <div style={{ width: 200 }}>
                <Select
                  label="Classification"
                  value={filter}
                  onChange={(event) =>
                    setFilter(event.target.value as ClassificationHistoryFilter)
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
            </div>
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
    </AppShell>
  );
}

export default MobileSyncPage;
