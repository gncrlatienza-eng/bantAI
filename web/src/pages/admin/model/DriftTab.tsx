import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Button,
  DataTable,
  EmptyState,
  ErrorState,
  LoadingState,
  Metric,
  MetricRow,
  StatusBadge,
  type Column,
  type StatusKind,
} from '../../../components/primitives';
import {
  getDriftInvestigations,
  getRetrainingJobs,
  getRetrainingStatus,
  openDriftInvestigation,
  retrainForInvestigation,
  triggerRetraining,
  updateDriftInvestigation,
  type DriftInvestigation,
  type DriftInvestigationStatus,
  type RetrainingJob,
  type RetrainingStatus,
} from '../../../services/retrainingService';
import {
  MONO,
  MUTED,
  NoteDialog,
  Notice,
  SectionHeader,
  errorText,
  formatDateTime,
  humanize,
  type NoteRequest,
} from './shared';

const INVESTIGATION_STATUS: Record<
  DriftInvestigationStatus,
  { label: string; kind: StatusKind }
> = {
  OPEN: { label: 'Open', kind: 'suspicious' },
  INVESTIGATING: { label: 'Investigating', kind: 'suspicious' },
  RESOLVED: { label: 'Resolved', kind: 'verified' },
  DISMISSED: { label: 'Dismissed', kind: 'unknown' },
};

const JOB_STATUS: Record<RetrainingJob['status'], string> = {
  REQUESTED: 'Sending',
  ACCEPTED: 'Queued by AI service',
  FAILED: 'Not accepted',
  CANCELLED: 'Cancelled',
};

const SIGNAL_LABEL: Record<string, string> = {
  validated_report_count: 'Validated report volume',
  f1_degradation: 'Macro-F1 degradation',
  page_hinkley_drift: 'Confidence drift (Page-Hinkley)',
  manual: 'Manual review',
  drift_investigation: 'Drift investigation',
};

function signalLabel(signal: string) {
  return SIGNAL_LABEL[signal] ?? humanize(signal);
}

const isOpen = (i: DriftInvestigation) =>
  i.status === 'OPEN' || i.status === 'INVESTIGATING';

export function DriftTab() {
  const [status, setStatus] = useState<RetrainingStatus | null>(null);
  const [jobs, setJobs] = useState<RetrainingJob[]>([]);
  const [investigations, setInvestigations] = useState<DriftInvestigation[]>(
    [],
  );
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState('');
  const [actionError, setActionError] = useState('');
  const [busy, setBusy] = useState(false);
  const [noteRequest, setNoteRequest] = useState<NoteRequest | null>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      const [nextStatus, nextJobs, nextInvestigations] = await Promise.all([
        getRetrainingStatus(),
        getRetrainingJobs(),
        getDriftInvestigations(),
      ]);
      setStatus(nextStatus);
      setJobs(nextJobs);
      setInvestigations(nextInvestigations);
    } catch (e) {
      setError(errorText(e));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const run = useCallback(
    async (action: () => Promise<string>) => {
      setBusy(true);
      setNotice('');
      setActionError('');
      try {
        setNotice(await action());
        await load();
      } catch (e) {
        setActionError(errorText(e));
        await load();
      } finally {
        setBusy(false);
      }
    },
    [load],
  );

  const retrainingEnabled = status?.enabled ?? false;

  const investigationColumns = useMemo<Column<DriftInvestigation>[]>(
    () => [
      {
        key: 'opened',
        header: 'Opened',
        width: '15%',
        render: (i) => formatDateTime(i.createdAt),
      },
      {
        key: 'signal',
        header: 'Signal',
        render: (i) => (
          <span>
            {signalLabel(i.signal)}
            <span style={{ ...MUTED, display: 'block', fontSize: '0.8rem' }}>
              Model {i.modelVersionTag ?? 'none active'} ·{' '}
              {i.metrics.validatedCount ?? 0} validated report
              {i.metrics.validatedCount === 1 ? '' : 's'}
            </span>
          </span>
        ),
      },
      {
        key: 'status',
        header: 'Status',
        width: '13%',
        render: (i) => (
          <StatusBadge
            kind={INVESTIGATION_STATUS[i.status].kind}
            label={INVESTIGATION_STATUS[i.status].label}
          />
        ),
      },
      {
        key: 'finding',
        header: 'Notes and finding',
        render: (i) => (
          <span style={{ fontSize: '0.875rem' }}>
            {i.resolution ?? i.notes ?? <span style={MUTED}>No notes yet</span>}
            {i.retrainingJobId && (
              <span style={{ ...MUTED, display: 'block', fontSize: '0.8rem' }}>
                Retraining requested
              </span>
            )}
          </span>
        ),
      },
      {
        key: 'actions',
        header: 'Actions',
        align: 'right',
        render: (i) =>
          isOpen(i) ? (
            <span
              style={{
                display: 'inline-flex',
                gap: 8,
                flexWrap: 'wrap',
                justifyContent: 'flex-end',
              }}
            >
              {i.status === 'OPEN' && (
                <Button
                  size="sm"
                  variant="secondary"
                  disabled={busy}
                  onClick={() =>
                    void run(async () => {
                      await updateDriftInvestigation(i.id, {
                        status: 'INVESTIGATING',
                      });
                      return 'Investigation started.';
                    })
                  }
                >
                  Start
                </Button>
              )}
              {!i.retrainingJobId && (
                <Button
                  size="sm"
                  variant="secondary"
                  disabled={busy || !retrainingEnabled}
                  title={
                    retrainingEnabled
                      ? undefined
                      : 'Retraining is disabled for this deployment'
                  }
                  onClick={() =>
                    void run(async () => {
                      await retrainForInvestigation(i.id);
                      return 'Retraining request queued and linked to the investigation.';
                    })
                  }
                >
                  Request retraining
                </Button>
              )}
              <Button
                size="sm"
                variant="secondary"
                disabled={busy}
                onClick={() =>
                  setNoteRequest({
                    title: 'Close this investigation',
                    description:
                      'Record what was found. Closed investigations cannot be reopened; a new signal opens a new one.',
                    label: 'Finding',
                    confirmLabel: 'Resolve',
                    onConfirm: async (resolution) => {
                      await updateDriftInvestigation(i.id, {
                        status: 'RESOLVED',
                        resolution,
                      });
                      setNotice('Investigation resolved.');
                      await load();
                    },
                  })
                }
              >
                Resolve
              </Button>
              <Button
                size="sm"
                variant="ghost"
                disabled={busy}
                onClick={() =>
                  setNoteRequest({
                    title: 'Dismiss this investigation',
                    description:
                      'Dismiss a signal that does not reflect real model degradation, and say why.',
                    label: 'Reason for dismissal',
                    confirmLabel: 'Dismiss',
                    onConfirm: async (resolution) => {
                      await updateDriftInvestigation(i.id, {
                        status: 'DISMISSED',
                        resolution,
                      });
                      setNotice('Investigation dismissed.');
                      await load();
                    },
                  })
                }
              >
                Dismiss
              </Button>
            </span>
          ) : (
            <span style={{ ...MUTED, fontSize: '0.8rem' }}>
              Closed {formatDateTime(i.resolvedAt)}
            </span>
          ),
      },
    ],
    [busy, load, retrainingEnabled, run],
  );

  const jobColumns: Column<RetrainingJob>[] = [
    {
      key: 'requested',
      header: 'Requested',
      width: '17%',
      render: (j) => formatDateTime(j.createdAt),
    },
    {
      key: 'trigger',
      header: 'Trigger',
      render: (j) => signalLabel(j.trigger),
    },
    {
      key: 'status',
      header: 'Status',
      render: (j) => (
        <span>
          {JOB_STATUS[j.status]}
          {j.detail && (
            <span style={{ ...MUTED, display: 'block', fontSize: '0.8rem' }}>
              {j.detail}
            </span>
          )}
        </span>
      ),
    },
    {
      key: 'dataset',
      header: 'Dataset version',
      render: (j) =>
        j.datasetVersion ? (
          <span style={MONO}>{j.datasetVersion}</span>
        ) : (
          <span style={MUTED}>No snapshot yet</span>
        ),
    },
    {
      key: 'provider',
      header: 'AI queue id',
      render: (j) =>
        j.providerJobId ? <span style={MONO}>{j.providerJobId}</span> : '—',
    },
  ];

  if (loading) return <LoadingState label="Loading drift signal" />;
  if (error || !status) {
    return (
      <ErrorState
        title="Drift signal unavailable"
        description={error ?? 'No status returned.'}
        action={
          <Button variant="secondary" onClick={() => void load()}>
            Retry
          </Button>
        }
      />
    );
  }

  const openCount = investigations.filter(isOpen).length;

  return (
    <>
      <MetricRow columns={4}>
        <Metric
          label="Current signal"
          value={status.triggered ? signalLabel(status.reason) : 'None'}
        />
        <Metric
          label="Validated since promotion"
          value={`${status.validatedCount.toLocaleString()} / ${status.thresholds.validatedReports}`}
        />
        <Metric
          label="Serving macro-F1"
          value={status.currentF1 != null ? status.currentF1.toFixed(3) : '—'}
        />
        <Metric label="Open investigations" value={openCount} />
      </MetricRow>

      <p
        style={{
          ...MUTED,
          margin: '14px 0 0',
          fontSize: '0.9rem',
          maxWidth: '80ch',
        }}
      >
        A signal fires when {status.thresholds.validatedReports} reports are
        validated since the last promotion, when macro-F1 falls more than{' '}
        {(status.thresholds.f1Drop * 100).toFixed(0)} points below the best
        prior version, or when the Page-Hinkley test (λ ={' '}
        {status.thresholds.pageHinkleyLambda}, at least{' '}
        {status.thresholds.pageHinkleyMinSamples} trusted scores) detects a
        sustained drop in confidence. Automatic retraining is{' '}
        <strong style={{ color: 'var(--text-primary)' }}>
          {retrainingEnabled ? 'enabled' : 'disabled'}
        </strong>{' '}
        for this deployment; requests are queued with the AI service and trained
        offline, then return as new candidates on the Overview tab.
      </p>

      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 16 }}>
        <Button
          variant="primary"
          disabled={busy}
          // Creating an investigation is a recorded action, so it is named
          // as one and confirmed with a reason (manual QA 2026-10-01, F8).
          onClick={() =>
            setNoteRequest({
              title: status.triggered
                ? 'Create an investigation for this signal'
                : 'Create a manual investigation',
              description:
                'This adds an open investigation to the list below and to the audit log. It does not retrain, deploy, or change any model. Close it later with a finding or dismiss it with a reason.',
              label: 'Why are you opening it?',
              confirmLabel: 'Create investigation',
              onConfirm: async (note) => {
                await openDriftInvestigation(note);
                setNotice(
                  status.triggered
                    ? `Investigation created for ${signalLabel(status.reason).toLowerCase()}.`
                    : 'Manual investigation created.',
                );
                await load();
              },
            })
          }
        >
          {status.triggered
            ? 'Create investigation for this signal…'
            : 'Create manual investigation…'}
        </Button>
        <Button
          variant="secondary"
          disabled={busy || !retrainingEnabled}
          title={
            retrainingEnabled
              ? undefined
              : 'Retraining is disabled for this deployment'
          }
          onClick={() =>
            void run(async () => {
              const result = await triggerRetraining();
              return `Retraining request queued${result.job.datasetVersion ? ` with dataset ${result.job.datasetVersion}` : ''}.`;
            })
          }
        >
          Request retraining now
        </Button>
      </div>

      {notice && <Notice tone="status">{notice}</Notice>}
      {actionError && <Notice tone="alert">{actionError}</Notice>}

      <section
        aria-labelledby="drift-investigations-title"
        style={{ marginTop: 28 }}
      >
        <SectionHeader
          id="drift-investigations-title"
          title="Investigations"
          description="Each investigation keeps the signal and metrics that opened it, the notes taken while reviewing it, and the finding that closed it."
        />
        <DataTable<DriftInvestigation>
          ariaLabel="Drift investigations"
          rowKey={(i) => i.id}
          rows={investigations}
          columns={investigationColumns}
          emptyState={
            <EmptyState
              title="No investigations"
              description="Open one when a signal fires or when reports suggest the model is slipping."
            />
          }
        />
      </section>

      <section
        aria-labelledby="retraining-jobs-title"
        style={{ marginTop: 28 }}
      >
        <SectionHeader
          id="retraining-jobs-title"
          title="Retraining requests"
          description="Queued means the AI service accepted the request. Training happens offline; the resulting model returns as a candidate for review."
        />
        <DataTable<RetrainingJob>
          ariaLabel="Retraining requests"
          rowKey={(j) => j.id}
          rows={jobs}
          columns={jobColumns}
          emptyState={
            <EmptyState
              title="No retraining requests"
              description="Requests from the hourly check, manual triggers and investigations appear here."
            />
          }
        />
      </section>

      <NoteDialog request={noteRequest} onClose={() => setNoteRequest(null)} />
    </>
  );
}
