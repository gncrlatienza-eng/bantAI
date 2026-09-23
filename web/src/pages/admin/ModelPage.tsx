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
import type { NavGroupDef } from '../../components/appshell/AppShell';
import {
  Button,
  DataTable,
  EmptyState,
  ErrorState,
  InfoBadge,
  LoadingState,
  Metric,
  MetricRow,
  NavOverviewIcon,
  NavCampaignsIcon,
  NavReportsIcon,
  NavUsersIcon,
  NavModelIcon,
  NavSystemIcon,
  StatusBadge,
  Tabs,
  type Column,
  type StatusKind,
  type TabDef,
} from '../../components/primitives';
import {
  getActiveModel,
  getAllModels,
  type ModelVersionItem,
} from '../../services/modelsService';
import {
  getRetrainingStatus,
  triggerRetraining,
  type RetrainingStatus,
} from '../../services/retrainingService';
import {
  getAllReports,
  rejectReport,
  validateReport,
  type UserReportItem,
} from '../../services/reportsService';
import { logout } from '../../services/authService';

const SIDEBAR_GROUPS: NavGroupDef[] = [
  {
    label: 'Overview',
    items: [
      { label: 'Overview', path: '/admin/overview', icon: <NavOverviewIcon /> },
    ],
  },
  {
    label: 'Intelligence',
    items: [
      { label: 'Campaigns', path: '/admin/campaigns', icon: <NavCampaignsIcon /> },
      { label: 'Model', path: '/admin/model', icon: <NavModelIcon /> },
      { label: 'Reports', path: '/admin/reports', icon: <NavReportsIcon /> },
    ],
  },
  {
    label: 'Administration',
    items: [
      { label: 'Users', path: '/admin/users', icon: <NavUsersIcon /> },
      { label: 'Tips', path: '/admin/tips', icon: <NavReportsIcon /> },
      { label: 'System', path: '/admin/system', icon: <NavSystemIcon /> },
      { label: 'Settings', path: '/admin/settings', icon: <NavSystemIcon /> },
    ],
  },
];

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
/*  Overview tab                                                      */
/* ------------------------------------------------------------------ */

function ModelOverviewTab() {
  const [models, setModels] = useState<ModelVersionItem[]>([]);
  const [active, setActive] = useState<ModelVersionItem | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [all, act] = await Promise.all([
        getAllModels(),
        getActiveModel().catch(() => null),
      ]);
      setModels(all);
      setActive(act);
    } catch (e) {
      setError(errorText(e));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  if (loading) return <LoadingState label="Loading model versions" />;
  if (error) {
    return (
      <ErrorState
        title="Model registry unavailable"
        description={error}
        action={
          <Button variant="secondary" onClick={() => void load()}>
            Retry
          </Button>
        }
      />
    );
  }

  const columns: Column<ModelVersionItem>[] = [
    {
      key: 'versionTag',
      header: 'Version',
      render: (r) => (
        <span style={{ fontFamily: 'var(--font-mono, monospace)' }}>
          {r.versionTag}
        </span>
      ),
    },
    {
      key: 'f1Score',
      header: 'Macro-F1',
      render: (r) => r.f1Score.toFixed(3),
      align: 'right',
      width: '14%',
    },
    {
      key: 'accuracy',
      header: 'Accuracy',
      render: (r) => (r.accuracy != null ? r.accuracy.toFixed(3) : '—'),
      align: 'right',
      width: '14%',
    },
    {
      key: 'status',
      header: 'Status',
      render: (r) =>
        r.isActive ? (
          <StatusBadge kind="verified" label="Active" />
        ) : r.isRollback ? (
          <StatusBadge kind="suspicious" label="Rollback" />
        ) : (
          <StatusBadge kind="unknown" label="Retired" />
        ),
      width: '15%',
    },
    {
      key: 'promotedAt',
      header: 'Promoted',
      render: (r) => formatDate(r.promotedAt),
      width: '15%',
      align: 'right',
    },
  ];

  return (
    <>
      <MetricRow columns={3}>
        <Metric
          label="Active version"
          value={active?.versionTag ?? 'None promoted'}
        />
        <Metric
          label="Active macro-F1"
          value={active ? active.f1Score.toFixed(3) : '—'}
        />
        <Metric label="Versions tracked" value={models.length} />
      </MetricRow>

      <section style={{ marginTop: 24 }}>
        <h2 style={{ fontSize: '1.05rem', margin: '0 0 12px' }}>
          Version history
        </h2>
        <DataTable<ModelVersionItem>
          ariaLabel="Model versions"
          rowKey={(r) => r.id}
          rows={models}
          columns={columns}
          emptyState={
            <EmptyState
              title="No model versions"
              description="No versions have been promoted to the registry yet."
            />
          }
        />
      </section>
    </>
  );
}

/* ------------------------------------------------------------------ */
/*  Concept drift tab                                                 */
/* ------------------------------------------------------------------ */

function ConceptDriftTab() {
  const [data, setData] = useState<RetrainingStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [triggering, setTriggering] = useState(false);
  const [actionMessage, setActionMessage] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setData(await getRetrainingStatus());
    } catch (e) {
      setError(errorText(e));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function handleTrigger() {
    setTriggering(true);
    setActionMessage(null);
    try {
      const result = await triggerRetraining();
      setActionMessage(
        result.triggered
          ? `Retraining triggered: ${result.reason}`
          : `Retraining not triggered: ${result.reason}`,
      );
      await load();
    } catch (e) {
      setActionMessage(errorText(e));
    } finally {
      setTriggering(false);
    }
  }

  if (loading) return <LoadingState label="Loading retraining status" />;
  if (error) {
    return (
      <ErrorState
        title="Retraining status unavailable"
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

  return (
    <>
      <MetricRow columns={4}>
        <Metric
          label="Trigger active"
          value={data.triggered ? 'Yes' : 'No'}
        />
        <Metric
          label="Validated reports"
          value={data.validatedCount.toLocaleString()}
        />
        <Metric
          label="Current macro-F1"
          value={data.currentF1 != null ? data.currentF1.toFixed(3) : '—'}
        />
        <Metric
          label="Page-Hinkley drift"
          value={data.drift ? 'Detected' : 'None'}
        />
      </MetricRow>

      <section style={{ marginTop: 24 }}>
        <p
          style={{
            margin: '0 0 12px',
            color: 'var(--text-secondary)',
            fontSize: '0.9rem',
          }}
        >
          Reason from the last evaluation:{' '}
          <strong style={{ color: 'var(--text-primary)' }}>
            {data.reason || 'No reason returned'}
          </strong>
        </p>
        <Button
          variant="primary"
          onClick={() => void handleTrigger()}
          disabled={triggering}
        >
          {triggering ? 'Evaluating…' : 'Evaluate and trigger retraining'}
        </Button>
        {actionMessage && (
          <p
            aria-live="polite"
            style={{
              margin: '12px 0 0',
              color: 'var(--text-secondary)',
              fontSize: '0.9rem',
            }}
          >
            {actionMessage}
          </p>
        )}
      </section>
    </>
  );
}

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
  const submitter = r.user
    ? [r.user.firstName, r.user.lastName].filter(Boolean).join(' ') ||
      r.user.phone
    : 'Unknown reporter';
  return {
    id: r.id,
    messageId: r.messageId,
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
        all
          .filter((r) => r.originalLabel !== r.reportedLabel)
          .map(toReportRow),
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
        r.status === 'PENDING' ? (
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
/*  Placeholder tabs (backend endpoints not yet implemented)          */
/* ------------------------------------------------------------------ */

function NotConnectedTab({
  title,
  description,
  hint,
}: {
  title: string;
  description: string;
  hint: string;
}) {
  return (
    <EmptyState
      title={title}
      description={description}
      action={<InfoBadge>{hint}</InfoBadge>}
    />
  );
}

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
      groups={SIDEBAR_GROUPS}
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
      topbarUtility={
        <Button
          variant="ghost"
          size="sm"
          onClick={() => {
            logout();
            void navigate('/admin-login');
          }}
        >
          Sign out
        </Button>
      }
      footer={<span style={{ fontSize: '0.85rem' }}>Authenticated admin</span>}
    >
      <PageHeader
        title="Model"
        description="Registry, drift signal, dataset state, classification log, and false-positive/negative review — the model surface consolidated into one page."
      />
      <Tabs
        tabs={TABS}
        activeId={activeTab}
        onChange={selectTab}
        label="Model sections"
      >
        <div style={{ paddingTop: 20 }}>
          {activeTab === 'overview' && <ModelOverviewTab />}
          {activeTab === 'drift' && <ConceptDriftTab />}
          {activeTab === 'dataset' && (
            <NotConnectedTab
              title="Dataset management not connected"
              description="Admin dataset labeling, split ratios, and version snapshots require an authenticated endpoint that has not shipped yet."
              hint="Requires POST /admin/datasets on the backend"
            />
          )}
          {activeTab === 'classification' && (
            <NotConnectedTab
              title="Classification log not connected"
              description="Per-message classification decisions with model version and score history require an authenticated endpoint."
              hint="Requires GET /admin/classifications on the backend"
            />
          )}
          {activeTab === 'fpfn' && <FpFnTab />}
        </div>
      </Tabs>
    </AppShell>
  );
}

export default ModelPage;
