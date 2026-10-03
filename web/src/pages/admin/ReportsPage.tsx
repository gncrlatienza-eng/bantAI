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

/*
 * One row per report as the user filed it: messages selected and reported
 * together on the phone share a groupId and show as one row. Each message is
 * still its own report, approved or rejected on its own in the dialog.
 */
interface ReportRow {
  id: string;
  submitter: string;
  body: string | null;
  originalLabel: string;
  reportedLabel: string;
  status: string;
  isMismatch: boolean;
  createdAt: string;
  reports: UserReportItem[];
  pendingIds: string[];
}

function groupStatus(reports: UserReportItem[]): string {
  const statuses = new Set(reports.map((r) => r.status));
  if (statuses.size === 1) return reports[0].status;
  const pending = reports.filter((r) => r.status === 'Pending').length;
  return pending ? `${pending} of ${reports.length} pending` : 'Reviewed';
}

function toRow(reports: UserReportItem[]): ReportRow {
  const sorted = [...reports].sort(
    (a, b) => Date.parse(a.createdAt) - Date.parse(b.createdAt),
  );
  const first = sorted[0];
  const originalLabels = new Set(sorted.map((r) => r.originalLabel));
  return {
    id: first.groupId ?? first.id,
    submitter: first.user?.id ?? 'Account record unavailable',
    body: first.message?.body ?? null,
    originalLabel:
      originalLabels.size > 1 ? 'Mixed' : first.originalLabel || 'Unlabeled',
    reportedLabel: first.reportedLabel || 'Unlabeled',
    status: groupStatus(sorted),
    isMismatch: sorted.some((r) => r.originalLabel !== r.reportedLabel),
    createdAt: first.createdAt,
    reports: sorted,
    pendingIds: sorted.filter((r) => r.status === 'Pending').map((r) => r.id),
  };
}

function groupReports(reports: UserReportItem[]): UserReportItem[][] {
  const groups = new Map<string, UserReportItem[]>();
  for (const r of reports) {
    const key = r.groupId ?? r.id;
    const group = groups.get(key);
    if (group) group.push(r);
    else groups.set(key, [r]);
  }
  return [...groups.values()];
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
  const [selectedKey, setSelectedKey] = useState<string | null>(null);

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

  const allRows = useMemo(() => groupReports(reports).map(toRow), [reports]);

  const rows = useMemo(() => {
    let mapped = allRows;
    // A grouped row stays while any of its messages matches the filter.
    if (statusFilter !== 'all') {
      mapped = mapped.filter((row) =>
        row.reports.some((r) => r.status === statusFilter),
      );
    }
    const needle = search.trim().toLowerCase();
    if (needle) {
      mapped = mapped.filter((row) =>
        row.reports.some((r) =>
          [
            r.id,
            r.groupId,
            r.user?.id,
            r.originalLabel,
            r.reportedLabel,
            r.status,
            r.message?.body,
            r.note,
          ]
            .filter(Boolean)
            .some((v) => String(v).toLowerCase().includes(needle)),
        ),
      );
    }
    return [...mapped].sort(
      (a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt),
    );
  }, [allRows, statusFilter, search]);

  const selected = allRows.find((row) => row.id === selectedKey) ?? null;

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

  // `busyKey` is the report id, or the group's row id for "all" actions.
  async function handle(
    action: 'validate' | 'reject',
    ids: string[],
    busyKey: string,
  ) {
    setBusyId(busyKey);
    setActionError(null);
    try {
      for (const id of ids) {
        if (action === 'validate') await validateReport(id);
        else await rejectReport(id);
      }
      await load();
    } catch (e) {
      setActionError(errorText(e));
      await load();
    } finally {
      setBusyId(null);
    }
  }

  const columns: Column<ReportRow>[] = [
    {
      key: 'createdAt',
      header: 'Submitted',
      render: (r) => (
        <span style={{ whiteSpace: 'nowrap' }}>{formatDate(r.createdAt)}</span>
      ),
      width: '11%',
    },
    {
      // The reported label and message count have their own columns, so
      // the message cell carries only the text.
      key: 'body',
      header: 'Message (masked)',
      render: (r) => <MaskedMessage text={r.body} maxLength={90} />,
      width: '35%',
    },
    {
      key: 'messageCount',
      header: 'Messages',
      align: 'center',
      render: (r) => r.reports.length.toLocaleString(),
      width: '8%',
    },
    {
      key: 'originalLabel',
      align: 'center',
      header: 'Model label',
      render: (r) => (
        <StatusBadge
          kind={labelToStatusKind(r.originalLabel)}
          label={r.originalLabel}
        />
      ),
      width: '10%',
    },
    {
      key: 'reportedLabel',
      align: 'center',
      header: 'Reported label',
      render: (r) => (
        <StatusBadge
          kind={labelToStatusKind(r.reportedLabel)}
          label={r.reportedLabel}
        />
      ),
      width: '11%',
    },
    {
      key: 'status',
      align: 'center',
      header: 'Status',
      render: (r) => formatStatus(r.status),
      width: '11%',
    },
    {
      // Same two buttons on every row so they line up; for a grouped row
      // they act on all of its pending messages (the count is in Messages,
      // and the accessible name says so).
      key: 'actions',
      header: '',
      align: 'right',
      width: '14%',
      render: (r) =>
        r.pendingIds.length ? (
          <span
            style={{
              display: 'inline-flex',
              gap: 6,
              justifyContent: 'flex-end',
              whiteSpace: 'nowrap',
            }}
          >
            <Button
              size="sm"
              variant="secondary"
              disabled={busyId !== null}
              aria-label={
                r.pendingIds.length > 1
                  ? `Approve all ${r.pendingIds.length} pending`
                  : undefined
              }
              title={
                r.pendingIds.length > 1
                  ? `Approves all ${r.pendingIds.length} pending messages in this report`
                  : undefined
              }
              onClick={(e) => {
                e.stopPropagation();
                void handle('validate', r.pendingIds, r.id);
              }}
            >
              Approve
            </Button>
            <Button
              size="sm"
              variant="ghost"
              disabled={busyId !== null}
              aria-label={
                r.pendingIds.length > 1
                  ? `Reject all ${r.pendingIds.length} pending`
                  : undefined
              }
              title={
                r.pendingIds.length > 1
                  ? `Rejects all ${r.pendingIds.length} pending messages in this report`
                  : undefined
              }
              onClick={(e) => {
                e.stopPropagation();
                void handle('reject', r.pendingIds, r.id);
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
            onRowClick={(r) => setSelectedKey(r.id)}
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
        size="lg"
        open={selected !== null}
        title={
          selected && selected.reports.length > 1
            ? `Reported together · ${selected.reports.length} messages`
            : 'Reported message'
        }
        description="Privacy-masked as stored by the backend. Phone numbers, links, amounts and codes are redacted."
        onClose={() => {
          setSelectedKey(null);
          setActionError(null);
        }}
        actions={
          selected && selected.pendingIds.length ? (
            <>
              <Button
                variant="ghost"
                disabled={busyId !== null}
                onClick={() =>
                  void handle('reject', selected.pendingIds, selected.id)
                }
              >
                {selected.reports.length > 1 ? 'Reject all pending' : 'Reject'}
              </Button>
              <Button
                variant="secondary"
                disabled={busyId !== null}
                onClick={() =>
                  void handle('validate', selected.pendingIds, selected.id)
                }
              >
                {selected.reports.length > 1
                  ? 'Approve all pending'
                  : 'Approve'}
              </Button>
            </>
          ) : (
            <Button variant="secondary" onClick={() => setSelectedKey(null)}>
              Close
            </Button>
          )
        }
      >
        {selected &&
          (selected.reports.length === 1 ? (
            <ReportDetail report={selected.reports[0]} />
          ) : (
            <GroupDetail
              reports={selected.reports}
              busy={busyId !== null}
              onReview={(action, id) => void handle(action, [id], id)}
            />
          ))}
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

/*
 * Messages reported together: what they share (labels, date, note) once at
 * the top, then one compact row per message with its own Approve/Reject, so
 * a 4-message report reads as a short list rather than four full cards.
 */
function GroupDetail({
  reports,
  busy,
  onReview,
}: {
  reports: UserReportItem[];
  busy: boolean;
  onReview: (action: 'validate' | 'reject', id: string) => void;
}) {
  const first = reports[0];
  const same = (pick: (r: UserReportItem) => string | null | undefined) =>
    reports.every((r) => pick(r) === pick(first));
  const sameModel = same((r) => r.originalLabel);
  const sameDay = same((r) =>
    r.message?.receivedAt ? formatDate(r.message.receivedAt) : null,
  );
  const muted: React.CSSProperties = { color: 'var(--text-secondary)' };
  const summary: React.CSSProperties = {
    display: 'flex',
    gap: 8,
    alignItems: 'center',
    flexWrap: 'wrap',
    fontSize: '0.88rem',
    marginBottom: 12,
  };
  return (
    <div>
      <div style={summary}>
        {sameModel && (
          <>
            <span style={muted}>Model said</span>
            <StatusBadge
              kind={labelToStatusKind(first.originalLabel)}
              label={first.originalLabel}
            />
          </>
        )}
        <span style={muted}>User reported</span>
        <StatusBadge
          kind={labelToStatusKind(first.reportedLabel)}
          label={
            first.reportedLabel === 'Scam'
              ? 'Reported scam'
              : first.reportedLabel
          }
        />
        {sameDay && first.message?.receivedAt && (
          <span style={muted}>
            · Received {formatDate(first.message.receivedAt)}
          </span>
        )}
      </div>
      {first.note && (
        <div style={{ ...summary, alignItems: 'flex-start' }}>
          <span style={muted}>Reporter note</span>
          <MaskedMessage text={first.note} />
        </div>
      )}
      <div
        style={{
          border: '1px solid var(--border-default)',
          borderRadius: 8,
          // A large report scrolls here; the labels above and the
          // Approve/Reject all buttons below stay in view.
          maxHeight: 'min(400px, 50dvh)',
          overflowY: 'auto',
          overscrollBehavior: 'contain',
        }}
        // Focusable so a keyboard user can scroll a long list.
        className="bantai-p-scroll"
        role="region"
        aria-label="Reported messages"
        tabIndex={0}
      >
        {reports.map((report, index) => (
          <div
            key={report.id}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 10,
              padding: '8px 12px',
              background: 'var(--surface-canvas)',
              borderTop: index ? '1px solid var(--border-default)' : undefined,
            }}
          >
            <div style={{ flex: 1, minWidth: 0, fontSize: '0.88rem' }}>
              <MaskedMessage text={report.message?.body} maxLength={120} />
              {(!sameModel || !sameDay) && (
                <div style={{ ...muted, fontSize: '0.78rem', marginTop: 2 }}>
                  {!sameModel && `Model said ${report.originalLabel}`}
                  {!sameModel && !sameDay && ' · '}
                  {!sameDay &&
                    report.message?.receivedAt &&
                    formatDate(report.message.receivedAt)}
                </div>
              )}
            </div>
            {report.status === 'Pending' ? (
              <span style={{ display: 'inline-flex', gap: 4, flexShrink: 0 }}>
                <Button
                  size="sm"
                  variant="secondary"
                  disabled={busy}
                  onClick={() => onReview('validate', report.id)}
                >
                  Approve
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  disabled={busy}
                  onClick={() => onReview('reject', report.id)}
                >
                  Reject
                </Button>
              </span>
            ) : (
              <span style={{ ...muted, fontSize: '0.82rem', flexShrink: 0 }}>
                {formatStatus(report.status)}
              </span>
            )}
          </div>
        ))}
      </div>
    </div>
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
