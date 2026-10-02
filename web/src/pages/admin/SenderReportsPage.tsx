/*
 * Admin Sender reports page. Mobile users can report a scam sender's number
 * from the Take Action sheet; the backend keeps only an HMAC pseudonym and
 * will not mark a sender as fraud for everyone until at least
 * MINIMUM_CORROBORATING_REPORTS distinct users reported it in the same window
 * and a staff member confirms. This page is that review queue.
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
  Input,
  LoadingState,
  Metric,
  MetricRow,
  StatusBadge,
  type Column,
} from '../../components/primitives';
import { useStaffPermission } from '../../components/common/StaffPermissionGate';
import {
  confirmSenderFraud,
  getPendingSenderReports,
  MINIMUM_CORROBORATING_REPORTS,
  type PendingSenderReport,
} from '../../services/senderReportsService';
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

interface SenderGroup {
  key: string;
  /** Short, stable pseudonym label. Never a phone number. */
  alias: string;
  reportWindow: string;
  count: number;
  firstReportedAt: string;
  lastReportedAt: string;
  /** Any pending report id in the group; confirming one confirms the window. */
  reportId: string;
}

function groupReports(reports: PendingSenderReport[]): SenderGroup[] {
  const groups = new Map<string, SenderGroup>();
  for (const r of reports) {
    const key = `${r.sender}|${r.reportWindow}`;
    const existing = groups.get(key);
    if (existing) {
      existing.count += 1;
      if (r.createdAt < existing.firstReportedAt)
        existing.firstReportedAt = r.createdAt;
      if (r.createdAt > existing.lastReportedAt)
        existing.lastReportedAt = r.createdAt;
    } else {
      groups.set(key, {
        key,
        alias: `Sender ${r.sender.slice(0, 8)}`,
        reportWindow: r.reportWindow,
        count: 1,
        firstReportedAt: r.createdAt,
        lastReportedAt: r.createdAt,
        reportId: r.id,
      });
    }
  }
  return [...groups.values()].sort(
    (a, b) =>
      b.count - a.count || b.lastReportedAt.localeCompare(a.lastReportedAt),
  );
}

export function SenderReportsPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const canManage = useStaffPermission('verification:manage');

  const [reports, setReports] = useState<PendingSenderReport[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [confirming, setConfirming] = useState<SenderGroup | null>(null);
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setReports(await getPendingSenderReports());
    } catch (e) {
      setError(errorText(e));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const groups = useMemo(() => groupReports(reports), [reports]);
  const corroborated = groups.filter(
    (g) => g.count >= MINIMUM_CORROBORATING_REPORTS,
  ).length;

  async function confirm() {
    if (!confirming) return;
    setBusy(true);
    setActionError(null);
    try {
      const result = await confirmSenderFraud(
        confirming.reportId,
        reason.trim(),
      );
      setNotice(
        `${confirming.alias} confirmed as fraud from ${result.reportCount} reports. Every user now sees this sender as confirmed fraud.`,
      );
      setConfirming(null);
      setReason('');
      await load();
    } catch (e) {
      setActionError(errorText(e));
    } finally {
      setBusy(false);
    }
  }

  const columns: Column<SenderGroup>[] = [
    {
      key: 'alias',
      header: 'Sender (pseudonym)',
      render: (g) => (
        <span style={{ fontFamily: 'var(--font-mono)' }}>{g.alias}</span>
      ),
      width: '26%',
    },
    {
      key: 'count',
      header: 'Independent reports',
      render: (g) => (
        <span style={{ display: 'inline-flex', gap: 8, alignItems: 'center' }}>
          {g.count.toLocaleString()}
          {g.count >= MINIMUM_CORROBORATING_REPORTS ? (
            <StatusBadge kind="threat" label="Corroborated" />
          ) : (
            <StatusBadge kind="unknown" label="Awaiting more reports" />
          )}
        </span>
      ),
      width: '30%',
    },
    {
      key: 'window',
      header: 'Window',
      render: (g) => g.reportWindow,
      width: '14%',
    },
    {
      key: 'last',
      header: 'Last reported',
      render: (g) => formatDate(g.lastReportedAt),
      width: '14%',
    },
    {
      key: 'actions',
      header: '',
      align: 'right',
      render: (g) =>
        canManage ? (
          <Button
            size="sm"
            variant="secondary"
            disabled={g.count < MINIMUM_CORROBORATING_REPORTS}
            title={
              g.count < MINIMUM_CORROBORATING_REPORTS
                ? `Needs at least ${MINIMUM_CORROBORATING_REPORTS} independent reports`
                : undefined
            }
            onClick={() => {
              setActionError(null);
              setConfirming(g);
            }}
          >
            Confirm fraud
          </Button>
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
      topbarContext={<span>Intelligence &middot; Sender reports</span>}
      footer={<span style={{ fontSize: '0.85rem' }}>Authenticated admin</span>}
    >
      <PageHeader
        title="Sender reports"
        description={`Numbers reported as scam senders from the mobile app. Senders are pseudonymous. A sender can be confirmed as fraud once ${MINIMUM_CORROBORATING_REPORTS} or more different users report it in the same window.`}
      />

      {error && !loading ? (
        <ErrorState
          title="Sender reports unavailable"
          description={error}
          action={
            <Button variant="secondary" onClick={() => void load()}>
              Retry
            </Button>
          }
        />
      ) : loading ? (
        <LoadingState label="Loading sender reports" />
      ) : (
        <>
          <MetricRow columns={3}>
            <Metric
              label="Pending reports"
              value={reports.length.toLocaleString()}
            />
            <Metric
              label="Reported senders"
              value={groups.length.toLocaleString()}
            />
            <Metric
              label="Ready to confirm"
              value={corroborated.toLocaleString()}
              meta={`${MINIMUM_CORROBORATING_REPORTS}+ independent reports`}
            />
          </MetricRow>

          {notice && (
            <div
              role="status"
              style={{
                margin: '16px 0 0',
                padding: '10px 12px',
                borderRadius: 6,
                background: 'var(--surface-selected)',
                fontSize: '0.85rem',
              }}
            >
              {notice}
            </div>
          )}

          <div style={{ marginTop: 20 }}>
            <DataTable<SenderGroup>
              ariaLabel="Pending sender reports"
              rowKey={(g) => g.key}
              rows={groups}
              columns={columns}
              emptyState={
                <EmptyState
                  title="No pending sender reports"
                  description="Reports appear here when mobile users report a scam sender's number."
                />
              }
            />
          </div>
        </>
      )}

      <Dialog
        open={confirming !== null}
        title="Confirm sender as fraud"
        description="This marks the sender as confirmed fraud for every BantAI user. It cannot be applied to a verified organization."
        onClose={() => {
          if (!busy) setConfirming(null);
        }}
        actions={
          <>
            <Button
              variant="ghost"
              disabled={busy}
              onClick={() => setConfirming(null)}
            >
              Cancel
            </Button>
            <Button
              variant="destructive-confirm"
              disabled={busy || reason.trim().length < 3}
              onClick={() => void confirm()}
            >
              Confirm fraud
            </Button>
          </>
        }
      >
        {confirming && (
          <div>
            <p style={{ margin: '0 0 12px', fontSize: '0.9rem' }}>
              {confirming.alias} · {confirming.count} independent reports in{' '}
              {confirming.reportWindow}
            </p>
            <Input
              label="Reason (recorded in the audit log)"
              value={reason}
              maxLength={500}
              onChange={(e) => setReason(e.target.value)}
              error={actionError ?? undefined}
            />
          </div>
        )}
      </Dialog>
    </AppShell>
  );
}

export default SenderReportsPage;
