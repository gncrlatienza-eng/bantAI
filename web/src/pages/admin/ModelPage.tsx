/*
 * Model → Errors: user corrections that disagree with the model's label
 * (false positives and false negatives). The other Model tabs live in
 * ./model/; the hub and its routes are in routes/AppRoutes.tsx.
 */

import React, { useCallback, useEffect, useState } from 'react';
import {
  Button,
  DataTable,
  EmptyState,
  ErrorState,
  LoadingState,
  StatusBadge,
  type Column,
  type StatusKind,
} from '../../components/primitives';
import {
  getAllReports,
  rejectReport,
  type ReviewedLabel,
  validateReport,
  type UserReportItem,
} from '../../services/reportsService';
import { ShortId } from './adminDisplay';
import { RejectReportDialog } from './RejectReportDialog';

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

export function FpFnTab() {
  const [rows, setRows] = useState<ReportRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  // Report id waiting for the reviewer to say what the text really is.
  const [rejectingId, setRejectingId] = useState<string | null>(null);

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

  async function handle(
    action: 'validate' | 'reject',
    id: string,
    reviewedLabel?: ReviewedLabel,
  ) {
    // Reject first asks what the text really is (RejectReportDialog).
    if (action === 'reject' && !reviewedLabel) {
      setRejectingId(id);
      return;
    }
    setBusyId(id);
    setActionError(null);
    try {
      if (action === 'validate') await validateReport(id);
      else if (reviewedLabel) await rejectReport(id, reviewedLabel);
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
      render: (r) =>
        r.original.user?.id ? (
          <ShortId id={r.original.user.id} />
        ) : (
          r.submittedBy
        ),
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
      <RejectReportDialog
        open={rejectingId !== null}
        count={1}
        busy={busyId !== null}
        onCancel={() => setRejectingId(null)}
        onConfirm={(label) => {
          const id = rejectingId;
          setRejectingId(null);
          if (id) void handle('reject', id, label);
        }}
      />
    </>
  );
}
