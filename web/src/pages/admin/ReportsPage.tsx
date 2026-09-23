/*
 * Admin Reports page. Migrates the legacy dark-themed reports table into the
 * mineral AppShell with proper StatusBadge/DataTable primitives.
 */

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { AppShell, PageHeader } from '../../components/appshell/AppShell';
import {
  Button,
  DataTable,
  EmptyState,
  ErrorState,
  LoadingState,
  Metric,
  MetricRow,
  SearchInput,
  Select,
  StatusBadge,
  type Column,
  type StatusKind,
} from '../../components/primitives';
import {
  getAllReports,
  rejectReport,
  validateReport,
  type UserReportItem,
} from '../../services/reportsService';
import { logout } from '../../services/authService';
import { ADMIN_SIDEBAR_GROUPS } from './adminNav';

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

type StatusFilter = 'all' | 'PENDING' | 'VALIDATED' | 'REJECTED';

interface ReportRow {
  id: string;
  submitter: string;
  originalLabel: string;
  reportedLabel: string;
  status: string;
  isMismatch: boolean;
  createdAt: string;
  original: UserReportItem;
}

function toRow(r: UserReportItem): ReportRow {
  const submitter = r.user
    ? [r.user.firstName, r.user.lastName].filter(Boolean).join(' ') ||
      r.user.phone
    : 'Unknown';
  return {
    id: r.id,
    submitter,
    originalLabel: r.originalLabel,
    reportedLabel: r.reportedLabel,
    status: r.status,
    isMismatch: r.originalLabel !== r.reportedLabel,
    createdAt: r.createdAt,
    original: r,
  };
}

export function ReportsPage() {
  const navigate = useNavigate();
  const location = useLocation();

  const [reports, setReports] = useState<UserReportItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [busyId, setBusyId] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setReports(await getAllReports());
    } catch (e) {
      setError(errorText(e));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const rows = useMemo(() => {
    let mapped = reports.map(toRow);
    if (statusFilter !== 'all') {
      mapped = mapped.filter((r) => r.status === statusFilter);
    }
    const needle = search.trim().toLowerCase();
    if (needle) {
      mapped = mapped.filter((r) =>
        [
          r.id,
          r.submitter,
          r.originalLabel,
          r.reportedLabel,
          r.status,
        ]
          .filter(Boolean)
          .some((v) => String(v).toLowerCase().includes(needle)),
      );
    }
    mapped.sort(
      (a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt),
    );
    return mapped;
  }, [reports, statusFilter, search]);

  const counts = useMemo(() => {
    let pending = 0,
      validated = 0,
      rejected = 0,
      mismatches = 0;
    for (const r of reports) {
      if (r.status === 'PENDING') pending++;
      else if (r.status === 'VALIDATED') validated++;
      else if (r.status === 'REJECTED') rejected++;
      if (r.originalLabel !== r.reportedLabel) mismatches++;
    }
    return { pending, validated, rejected, mismatches };
  }, [reports]);

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

  const columns: Column<ReportRow>[] = [
    {
      key: 'createdAt',
      header: 'Submitted',
      render: (r) => formatDate(r.createdAt),
      width: '14%',
    },
    {
      key: 'submitter',
      header: 'Submitted by',
      render: (r) => r.submitter,
      width: '18%',
    },
    {
      key: 'originalLabel',
      header: 'Model',
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
      header: 'User',
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
    <AppShell
      role="admin"
      groups={ADMIN_SIDEBAR_GROUPS}
      brandInitial="B"
      brandLabel="BantAI Admin"
      currentPath={location.pathname}
      onNavigate={(p) => void navigate(p)}
      topbarContext={<span>Intelligence &middot; Reports</span>}
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
        title="User reports"
        description="Corrections submitted by users on classifier output. Approve to feed the retraining queue; reject if the user's label is wrong."
      />

      {error && !loading ? (
        <ErrorState
          title="Reports unavailable"
          description={error}
          action={
            <Button variant="secondary" onClick={() => void load()}>
              Retry
            </Button>
          }
        />
      ) : loading ? (
        <LoadingState label="Loading reports" />
      ) : (
        <>
          <MetricRow columns={4}>
            <Metric label="Pending" value={counts.pending.toLocaleString()} />
            <Metric
              label="Approved"
              value={counts.validated.toLocaleString()}
            />
            <Metric label="Rejected" value={counts.rejected.toLocaleString()} />
            <Metric
              label="Mismatches"
              value={counts.mismatches.toLocaleString()}
            />
          </MetricRow>

          <div
            style={{
              display: 'flex',
              gap: 12,
              flexWrap: 'wrap',
              alignItems: 'flex-end',
              margin: '20px 0 16px',
            }}
          >
            <div style={{ flex: '1 1 320px', minWidth: 260 }}>
              <SearchInput
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                onClear={() => setSearch('')}
                placeholder="Search reporter, label, or status"
              />
            </div>
            <div style={{ minWidth: 180 }}>
              <Select
                label="Status"
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value as StatusFilter)}
                options={[
                  { value: 'all', label: 'All' },
                  { value: 'PENDING', label: 'Pending' },
                  { value: 'VALIDATED', label: 'Approved' },
                  { value: 'REJECTED', label: 'Rejected' },
                ]}
              />
            </div>
          </div>

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
            ariaLabel="User reports"
            rowKey={(r) => r.id}
            rows={rows}
            columns={columns}
            emptyState={
              <EmptyState
                title={
                  search || statusFilter !== 'all'
                    ? 'No reports match the current filters'
                    : 'No user reports yet'
                }
                description={
                  search || statusFilter !== 'all'
                    ? 'Clear filters to see more results.'
                    : 'Reports appear here when users submit label corrections from the client portal.'
                }
              />
            }
          />
        </>
      )}
    </AppShell>
  );
}

export default ReportsPage;
