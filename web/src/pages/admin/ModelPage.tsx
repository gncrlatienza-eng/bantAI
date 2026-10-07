/*
 * Admin Model page. Phase F step 7 + Phase A step 4.
 *
 * Consolidates five legacy admin routes (/admin/model, /admin/concept-drift,
 * /admin/dataset, /admin/classification, /admin/fpfn) into one page with
 * tabs synced to the URL query string (?tab=). Legacy routes still register
 * so external deep links redirect via AppRoutes.
 */

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { AppShell, PageHeader } from '../../components/appshell/AppShell';
import {
  Button,
  ConfidenceMeter,
  DataTable,
  EmptyState,
  ErrorState,
  LoadingState,
  StatusBadge,
  Tabs,
  type Column,
  type StatusKind,
  type TabDef,
} from '../../components/primitives';
import {
  getAllReports,
  rejectReport,
  validateReport,
  type UserReportItem,
} from '../../services/reportsService';
import {
  getAdminClassificationHistory,
  cloudVerificationLabel,
  type AdminClassificationItem,
} from '../../services/smsService';
import { ADMIN_SIDEBAR_GROUPS } from './adminNav';
import { DatasetTab } from './model/DatasetTab';
import { DriftTab } from './model/DriftTab';
import { ModelLifecycleTab } from './model/ModelLifecycleTab';

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

function labelToStatusKind(label: string): StatusKind {
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

const TABS: TabDef[] = [
  { id: 'overview', label: 'Overview' },
  { id: 'drift', label: 'Concept drift' },
  { id: 'dataset', label: 'Dataset' },
  { id: 'classification', label: 'Classification log' },
  { id: 'fpfn', label: 'FP / FN reviews' },
];

/* ------------------------------------------------------------------ */
/*  FP / FN reviews tab                                               */
/*  Shows admin reports where reportedLabel differs from original.    */
/* ------------------------------------------------------------------ */

interface ReportRow {
  id: string;
  messageId: string;
  originalLabel: string;
  reportedLabel: string;
  status: string;
  submittedBy: string;
  createdAt: string;
  original: UserReportItem;
}

function toReportRow(r: UserReportItem): ReportRow {
  const submitter = r.user?.id ?? 'Account record unavailable';
  return {
    id: r.id,
    messageId: r.message?.id ?? r.messageId ?? 'Unavailable',
    originalLabel: r.originalLabel,
    reportedLabel: r.reportedLabel,
    status: r.status,
    submittedBy: submitter,
    createdAt: r.createdAt,
    original: r,
  };
}

function FpFnTab() {
  const [rows, setRows] = useState<ReportRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const all = await getAllReports();
      setRows(
        all.filter((r) => r.originalLabel !== r.reportedLabel).map(toReportRow),
      );
    } catch (e) {
      setError(errorText(e));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function handle(action: 'validate' | 'reject', id: string) {
    setBusyId(id);
    setActionError(null);
    try {
      if (action === 'validate') await validateReport(id);
      else await rejectReport(id);
      await load();
    } catch (e) {
      setActionError(errorText(e));
    } finally {
      setBusyId(null);
    }
  }

  if (loading) return <LoadingState label="Loading corrections" />;
  if (error) {
    return (
      <ErrorState
        title="Reports unavailable"
        description={error}
        action={
          <Button variant="secondary" onClick={() => void load()}>
            Retry
          </Button>
        }
      />
    );
  }

  const columns: Column<ReportRow>[] = [
    {
      key: 'createdAt',
      header: 'Submitted',
      render: (r) => formatDate(r.createdAt),
      width: '14%',
    },
    {
      key: 'submittedBy',
      header: 'By',
      render: (r) => r.submittedBy,
      width: '18%',
    },
    {
      key: 'originalLabel',
      header: 'Model said',
      render: (r) => (
        <StatusBadge
          kind={labelToStatusKind(r.originalLabel)}
          label={r.originalLabel}
        />
      ),
      width: '15%',
    },
    {
      key: 'reportedLabel',
      header: 'User says',
      render: (r) => (
        <StatusBadge
          kind={labelToStatusKind(r.reportedLabel)}
          label={r.reportedLabel}
        />
      ),
      width: '15%',
    },
    {
      key: 'status',
      header: 'Status',
      render: (r) => r.status,
      width: '12%',
    },
    {
      key: 'actions',
      header: '',
      align: 'right',
      render: (r) =>
        r.status === 'Pending' ? (
          <span style={{ display: 'inline-flex', gap: 6 }}>
            <Button
              size="sm"
              variant="secondary"
              disabled={busyId === r.id}
              onClick={(e) => {
                e.stopPropagation();
                void handle('validate', r.id);
              }}
            >
              Approve
            </Button>
            <Button
              size="sm"
              variant="ghost"
              disabled={busyId === r.id}
              onClick={(e) => {
                e.stopPropagation();
                void handle('reject', r.id);
              }}
            >
              Reject
            </Button>
          </span>
        ) : null,
    },
  ];

  return (
    <>
      {actionError && (
        <div
          role="alert"
          style={{
            marginBottom: 12,
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
      <DataTable<ReportRow>
        ariaLabel="False positive and negative reviews"
        rowKey={(r) => r.id}
        rows={rows}
        columns={columns}
        emptyState={
          <EmptyState
            title="No mismatched reports"
            description="Every user correction currently matches the model's original label."
          />
        }
      />
    </>
  );
}

/* ------------------------------------------------------------------ */
/*  Classification log tab                                            */
/* ------------------------------------------------------------------ */

function ClassificationLogTab() {
  const [rows, setRows] = useState<AdminClassificationItem[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loadMoreError, setLoadMoreError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const page = await getAdminClassificationHistory({ label: 'all' });
      setRows(page.items);
      setNextCursor(page.nextCursor);
    } catch (e) {
      setError(errorText(e));
    } finally {
      setLoading(false);
    }
  }, []);

  const loadMore = async () => {
    if (!nextCursor || loadingMore) return;
    setLoadingMore(true);
    setLoadMoreError(null);
    try {
      const page = await getAdminClassificationHistory({
        label: 'all',
        cursor: nextCursor,
      });
      setRows((current) => [...current, ...page.items]);
      setNextCursor(page.nextCursor);
    } catch (requestError) {
      setLoadMoreError(errorText(requestError));
    } finally {
      setLoadingMore(false);
    }
  };

  useEffect(() => {
    void load();
  }, [load]);

  if (error && !loading) {
    return (
      <ErrorState
        title="Classification log unavailable"
        description={error}
        action={
          <Button variant="secondary" onClick={() => void load()}>
            Retry
          </Button>
        }
      />
    );
  }

  const columns: Column<AdminClassificationItem>[] = [
    {
      key: 'receivedAt',
      header: 'Received',
      render: (r) => formatDateTime(r.receivedAt),
      width: '20%',
    },
    {
      key: 'label',
      header: 'Classification',
      render: (r) => (
        <StatusBadge kind={labelToStatusKind(r.label)} label={r.label} />
      ),
      width: '17%',
    },
    {
      key: 'score',
      header: 'Confidence',
      render: (r) => <ConfidenceMeter value={r.score} compact />,
      align: 'right',
      width: '20%',
    },
    {
      key: 'bucket',
      header: 'Risk bucket',
      render: (r) => r.bucket ?? '—',
      width: '14%',
    },
    {
      key: 'verificationStatus',
      header: 'Cloud verification',
      render: (r) => cloudVerificationLabel(r.verificationStatus),
    },
    {
      key: 'alertStatus',
      header: 'Alert',
      render: (r) => r.alertStatus ?? '—',
      width: '12%',
    },
    {
      key: 'messageId',
      header: 'Record ID',
      render: (r) => (
        <span style={{ fontFamily: 'var(--font-mono, monospace)' }}>
          {r.messageId}
        </span>
      ),
      truncate: true,
    },
  ];

  return (
    <>
      <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
        Browse classifications synced from phones, including older inbox
        messages after they are scanned. A “blocked” risk bucket does not mean
        the sender was blocked.
      </p>
      <DataTable<AdminClassificationItem>
        ariaLabel="Classification history"
        rowKey={(r) => r.id}
        rows={rows}
        columns={columns}
        loading={loading}
        emptyState={
          <EmptyState
            title="No classifications yet"
            description="Synced SMS classifications will appear here after a signed-in phone scans and syncs its inbox."
          />
        }
      />
      {loadMoreError && <p role="alert">{loadMoreError}</p>}
      {nextCursor && (
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
    </>
  );
}

/* ------------------------------------------------------------------ */
/*  Placeholder tabs (backend endpoints not yet implemented)          */
/* ------------------------------------------------------------------ */
/*  Page shell                                                        */
/* ------------------------------------------------------------------ */

export function ModelPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams, setSearchParams] = useSearchParams();

  const activeTab = useMemo(() => {
    const t = searchParams.get('tab') ?? 'overview';
    return TABS.some((tab) => tab.id === t) ? t : 'overview';
  }, [searchParams]);

  function selectTab(id: string) {
    const next = new URLSearchParams(searchParams);
    if (id === 'overview') next.delete('tab');
    else next.set('tab', id);
    setSearchParams(next, { replace: true });
  }

  return (
    <AppShell
      role="admin"
      groups={ADMIN_SIDEBAR_GROUPS}
      brandInitial="B"
      brandLabel="BantAI Admin"
      currentPath={
        location.pathname.startsWith('/admin/model') ||
        location.pathname === '/admin/concept-drift' ||
        location.pathname === '/admin/dataset' ||
        location.pathname === '/admin/classification' ||
        location.pathname === '/admin/fpfn'
          ? '/admin/model'
          : location.pathname
      }
      onNavigate={(p) => void navigate(p)}
      topbarContext={<span>Intelligence &middot; Model</span>}
      footer={<span style={{ fontSize: '0.85rem' }}>Authenticated admin</span>}
    >
      <PageHeader
        title="Model"
        description="Candidate review and deployment, drift investigations, the curated training dataset, the classification log, and false-positive/negative review."
      />
      <Tabs
        tabs={TABS}
        activeId={activeTab}
        onChange={selectTab}
        label="Model sections"
      >
        <div style={{ paddingTop: 20 }}>
          {activeTab === 'overview' && <ModelLifecycleTab />}
          {activeTab === 'drift' && <DriftTab />}
          {activeTab === 'dataset' && <DatasetTab />}
          {activeTab === 'classification' && <ClassificationLogTab />}
          {activeTab === 'fpfn' && <FpFnTab />}
        </div>
      </Tabs>
    </AppShell>
  );
}

export default ModelPage;
