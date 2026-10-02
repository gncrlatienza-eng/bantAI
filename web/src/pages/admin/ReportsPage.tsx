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
  Dialog,
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
import { MaskedMessage } from '../../components/masked/MaskedMessage';
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

type StatusFilter = 'all' | UserReportItem['status'];

interface ReportRow {
  id: string;
  submitter: string;
  body: string | null;
  originalLabel: string;
  reportedLabel: string;
  status: string;
  isMismatch: boolean;
  createdAt: string;
  original: UserReportItem;
}

function toRow(r: UserReportItem): ReportRow {
  const submitter = r.user?.id ?? 'Account record unavailable';
  return {
    id: r.id,
    submitter,
    body: r.message?.body ?? null,
    originalLabel: r.originalLabel || 'Unlabeled',
    reportedLabel: r.reportedLabel || 'Unlabeled',
    status: r.status,
    isMismatch: r.originalLabel !== r.reportedLabel,
    createdAt: r.createdAt,
    original: r,
  };
}

function formatStatus(status: string): string {
  return status
    .toLowerCase()
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
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
  const [selected, setSelected] = useState<UserReportItem | null>(null);

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
          r.body,
          r.original.note,
        ]
          .filter(Boolean)
          .some((v) => String(v).toLowerCase().includes(needle)),
      );
    }
    mapped.sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt));
    return mapped;
  }, [reports, statusFilter, search]);

  const counts = useMemo(() => {
    let pending = 0,
      validated = 0,
      rejected = 0,
      mismatches = 0;
    for (const r of reports) {
      if (r.status === 'Pending') pending++;
      else if (r.status === 'Validated') validated++;
      else if (r.status === 'Rejected') rejected++;
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
      setSelected(null);
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
      width: '11%',
    },
    {
      key: 'body',
      header: 'Message (masked)',
      render: (r) => (
        <span
          style={{ display: 'inline-flex', flexDirection: 'column', gap: 4 }}
        >
          {r.reportedLabel === 'Scam' && (
            <span>
              <StatusBadge kind="threat" label="Reported scam" />
            </span>
          )}
          <MaskedMessage text={r.body} maxLength={90} />
        </span>
      ),
      width: '34%',
    },
    {
      key: 'originalLabel',
      header: 'Model label',
      render: (r) => (
        <StatusBadge
          kind={labelToStatusKind(r.originalLabel)}
          label={r.originalLabel}
        />
      ),
      width: '12%',
    },
    {
      key: 'reportedLabel',
      header: 'Reported label',
      render: (r) => (
        <StatusBadge
          kind={labelToStatusKind(r.reportedLabel)}
          label={r.reportedLabel}
        />
      ),
      width: '12%',
    },
    {
      key: 'status',
      header: 'Status',
      render: (r) => formatStatus(r.status),
      width: '9%',
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
    <AppShell
      role="admin"
      groups={ADMIN_SIDEBAR_GROUPS}
      brandInitial="B"
      brandLabel="BantAI Admin"
      currentPath={location.pathname}
      onNavigate={(p) => void navigate(p)}
      topbarContext={<span>Intelligence &middot; Reports</span>}
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
                onChange={(e) =>
                  setStatusFilter(e.target.value as StatusFilter)
                }
                options={[
                  { value: 'all', label: 'All' },
                  { value: 'Pending', label: 'Pending' },
                  { value: 'Validated', label: 'Approved' },
                  { value: 'Rejected', label: 'Rejected' },
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
            onRowClick={(r) => setSelected(r.original)}
            activeRowKey={selected?.id}
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
                    : 'Reports appear here when mobile users submit label corrections.'
                }
              />
            }
          />
        </>
      )}

      <Dialog
        open={selected !== null}
        title="Reported message"
        description="Privacy-masked as stored by the backend. Phone numbers, links, amounts and codes are redacted."
        onClose={() => {
          setSelected(null);
          setActionError(null);
        }}
        actions={
          selected?.status === 'Pending' ? (
            <>
              <Button
                variant="ghost"
                disabled={busyId === selected.id}
                onClick={() => void handle('reject', selected.id)}
              >
                Reject
              </Button>
              <Button
                variant="secondary"
                disabled={busyId === selected.id}
                onClick={() => void handle('validate', selected.id)}
              >
                Approve
              </Button>
            </>
          ) : (
            <Button variant="secondary" onClick={() => setSelected(null)}>
              Close
            </Button>
          )
        }
      >
        {selected && <ReportDetail report={selected} />}
        {selected && actionError && (
          <div
            role="alert"
            style={{
              marginTop: 12,
              color: 'var(--status-threat)',
              fontSize: '0.85rem',
            }}
          >
            {actionError}
          </div>
        )}
      </Dialog>
    </AppShell>
  );
}

function ReportDetail({ report }: { report: UserReportItem }) {
  const classification = report.message?.classification;
  const row: React.CSSProperties = {
    display: 'flex',
    gap: 8,
    alignItems: 'center',
    flexWrap: 'wrap',
    margin: '6px 0',
    fontSize: '0.88rem',
  };
  const muted: React.CSSProperties = { color: 'var(--text-secondary)' };
  return (
    <div>
      <div
        style={{
          padding: '12px 14px',
          borderRadius: 8,
          border: '1px solid var(--border-default)',
          background: 'var(--surface-canvas)',
          color: 'var(--text-primary)',
          marginBottom: 12,
        }}
      >
        <MaskedMessage text={report.message?.body} />
      </div>
      <div style={row}>
        <span style={muted}>Model said</span>
        <StatusBadge
          kind={labelToStatusKind(report.originalLabel)}
          label={report.originalLabel}
        />
        {classification && (
          <span style={muted}>
            {Math.round(classification.score * 100)}% confidence
            {classification.bucket ? ` · ${classification.bucket}` : ''}
          </span>
        )}
      </div>
      <div style={row}>
        <span style={muted}>User reported</span>
        <StatusBadge
          kind={labelToStatusKind(report.reportedLabel)}
          label={
            report.reportedLabel === 'Scam'
              ? 'Reported scam'
              : report.reportedLabel
          }
        />
      </div>
      {report.message?.receivedAt && (
        <div style={row}>
          <span style={muted}>Received</span>
          <span>{formatDate(report.message.receivedAt)}</span>
        </div>
      )}
      {report.note && (
        <div style={{ ...row, alignItems: 'flex-start' }}>
          <span style={muted}>Reporter note</span>
          <MaskedMessage text={report.note} />
        </div>
      )}
      {report.adminNote && (
        <div style={row}>
          <span style={muted}>Admin note</span>
          <span>{report.adminNote}</span>
        </div>
      )}
    </div>
  );
}

export default ReportsPage;
