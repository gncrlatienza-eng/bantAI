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
  approveModel,
  confirmModelDeployment,
  getAllModels,
  getServingModelStatus,
  markModelDeploymentFailed,
  rejectModel,
  requestModelDeployment,
  type ModelCandidateStatus,
  type ModelVersionItem,
  type ServingModelStatus,
} from '../../../services/modelsService';
import {
  MONO,
  MUTED,
  NoteDialog,
  Notice,
  SectionHeader,
  errorText,
  formatDate,
  formatDateTime,
  type NoteRequest,
} from './shared';

const STATUS: Record<
  ModelCandidateStatus,
  { label: string; kind: StatusKind }
> = {
  REGISTERED: { label: 'Awaiting review', kind: 'suspicious' },
  EVALUATING: { label: 'Awaiting review', kind: 'suspicious' },
  APPROVED: { label: 'Approved', kind: 'unknown' },
  REJECTED: { label: 'Rejected', kind: 'unknown' },
  ACTIVATION_REQUESTED: { label: 'Deployment pending', kind: 'suspicious' },
  ACTIVE: { label: 'Serving', kind: 'verified' },
  FAILED: { label: 'Deployment failed', kind: 'unknown' },
};

function macroF1(version: ModelVersionItem): number {
  const value = version.evaluation?.macroF1;
  return typeof value === 'number' ? value : version.f1Score;
}

function EvidenceList({ version }: { version: ModelVersionItem }) {
  const evidence: [string, string][] = [
    ['Holdout macro-F1', macroF1(version).toFixed(4)],
    [
      'Accuracy',
      version.accuracy != null ? version.accuracy.toFixed(4) : 'Not reported',
    ],
  ];
  const display = (value: unknown) =>
    typeof value === 'string' ||
    typeof value === 'number' ||
    typeof value === 'boolean'
      ? String(value)
      : JSON.stringify(value);
  for (const [key, value] of Object.entries(version.evaluation ?? {})) {
    if (['macroF1', 'accuracy', 'source'].includes(key)) continue;
    evidence.push([key, display(value)]);
  }
  for (const [key, value] of Object.entries(version.provenance ?? {})) {
    evidence.push([`Provenance: ${key}`, display(value)]);
  }
  if (version.notes) evidence.push(['Pipeline notes', version.notes]);
  return (
    <dl
      style={{
        display: 'grid',
        gridTemplateColumns: 'minmax(120px, auto) 1fr',
        gap: '6px 12px',
        margin: 0,
        fontSize: '0.875rem',
      }}
    >
      {evidence.map(([term, value]) => (
        <div key={term} style={{ display: 'contents' }}>
          <dt style={MUTED}>{term}</dt>
          <dd style={{ margin: 0, overflowWrap: 'anywhere' }}>{value}</dd>
        </div>
      ))}
    </dl>
  );
}

export function ModelLifecycleTab() {
  const [models, setModels] = useState<ModelVersionItem[]>([]);
  const [serving, setServing] = useState<ServingModelStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState('');
  const [actionError, setActionError] = useState('');
  const [confirming, setConfirming] = useState(false);
  const [noteRequest, setNoteRequest] = useState<NoteRequest | null>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      const [all, servingStatus] = await Promise.all([
        getAllModels(),
        // Runtime availability is independent of the promotion registry.
        // A down AI service must not hide the registry from administrators.
        getServingModelStatus().catch(() => null),
      ]);
      setModels(all);
      setServing(servingStatus);
    } catch (e) {
      setError(errorText(e));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const active = models.find((m) => m.isActive) ?? null;
  const pending = models.find((m) => m.status === 'ACTIVATION_REQUESTED');
  const awaitingReview = models.filter(
    (m) => m.status === 'EVALUATING' || m.status === 'REGISTERED',
  ).length;

  const done = useCallback(
    async (message: string) => {
      setNotice(message);
      setActionError('');
      await load();
    },
    [load],
  );

  const columns = useMemo<Column<ModelVersionItem>[]>(() => {
    function ask(
      request: Omit<NoteRequest, 'details'>,
      version: ModelVersionItem,
    ) {
      setNotice('');
      setNoteRequest({
        ...request,
        details: <EvidenceList version={version} />,
      });
    }
    return [
      {
        key: 'version',
        header: 'Version',
        render: (m) => (
          <span>
            <span style={MONO}>{m.versionTag}</span>
            {m.reviewNote && (
              <span
                title={m.reviewNote}
                style={{
                  ...MUTED,
                  display: 'block',
                  fontSize: '0.8rem',
                  maxWidth: 320,
                }}
              >
                {m.reviewNote}
              </span>
            )}
          </span>
        ),
      },
      {
        key: 'f1',
        header: 'Macro-F1',
        align: 'right',
        width: '11%',
        render: (m) => {
          const value = macroF1(m);
          if (!active || active.id === m.id) return value.toFixed(3);
          const delta = value - macroF1(active);
          return (
            <span>
              {value.toFixed(3)}
              <span style={{ ...MUTED, display: 'block', fontSize: '0.8rem' }}>
                {delta >= 0 ? '+' : ''}
                {delta.toFixed(3)} vs serving
              </span>
            </span>
          );
        },
      },
      {
        key: 'accuracy',
        header: 'Accuracy',
        align: 'right',
        width: '10%',
        render: (m) => (m.accuracy != null ? m.accuracy.toFixed(3) : '—'),
      },
      {
        key: 'status',
        header: 'Status',
        width: '16%',
        render: (m) => (
          <span>
            <StatusBadge
              kind={STATUS[m.status].kind}
              label={
                m.isRollback && m.isActive
                  ? 'Serving (rollback)'
                  : STATUS[m.status].label
              }
            />
            {m.status === 'ACTIVE' && !m.runtimeActivationConfirmedAt && (
              <span
                style={{
                  ...MUTED,
                  display: 'block',
                  fontSize: '0.8rem',
                  marginTop: 4,
                }}
              >
                Promoted before runtime checks
              </span>
            )}
          </span>
        ),
      },
      {
        key: 'registered',
        header: 'Registered',
        width: '12%',
        render: (m) => formatDate(m.createdAt),
      },
      {
        key: 'actions',
        header: 'Actions',
        align: 'right',
        render: (m) => {
          const reviewable =
            m.status === 'EVALUATING' || m.status === 'REGISTERED';
          const approved = m.status === 'APPROVED' && !m.isActive;
          if (!reviewable && !approved) return null;
          return (
            <span
              style={{
                display: 'inline-flex',
                gap: 8,
                flexWrap: 'wrap',
                justifyContent: 'flex-end',
              }}
            >
              {reviewable && (
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={() =>
                    ask(
                      {
                        title: `Approve ${m.versionTag}?`,
                        description:
                          'Approval records that this candidate may be deployed. It does not change what the AI service is serving.',
                        label: 'Why is this candidate acceptable?',
                        confirmLabel: 'Approve',
                        onConfirm: async (note) => {
                          await approveModel(m.id, note);
                          await done(`${m.versionTag} approved.`);
                        },
                      },
                      m,
                    )
                  }
                >
                  Approve
                </Button>
              )}
              {approved && (
                <Button
                  size="sm"
                  variant="primary"
                  disabled={Boolean(pending)}
                  title={
                    pending
                      ? `Deployment of ${pending.versionTag} is pending`
                      : undefined
                  }
                  onClick={() =>
                    ask(
                      {
                        title: `Request deployment of ${m.versionTag}?`,
                        description:
                          'This records the request only. An operator must install the approved bundle and its approval manifest on the AI service; you then confirm the deployment here.',
                        label: 'Deployment note',
                        confirmLabel: 'Request deployment',
                        onConfirm: async (note) => {
                          await requestModelDeployment(m.id, note);
                          await done(
                            `Deployment of ${m.versionTag} requested.`,
                          );
                        },
                      },
                      m,
                    )
                  }
                >
                  {m.runtimeActivationConfirmedAt
                    ? 'Roll back to this'
                    : 'Deploy'}
                </Button>
              )}
              <Button
                size="sm"
                variant="destructive"
                onClick={() =>
                  ask(
                    {
                      title: `Reject ${m.versionTag}?`,
                      description:
                        'A rejected version can no longer be approved or deployed.',
                      label: 'Reason for rejection',
                      confirmLabel: 'Reject',
                      destructive: true,
                      onConfirm: async (note) => {
                        await rejectModel(m.id, note);
                        await done(`${m.versionTag} rejected.`);
                      },
                    },
                    m,
                  )
                }
              >
                Reject
              </Button>
            </span>
          );
        },
      },
    ];
  }, [active, done, pending]);

  async function confirmPending() {
    if (!pending) return;
    setConfirming(true);
    setActionError('');
    setNotice('');
    try {
      await confirmModelDeployment(pending.id);
      await done(`${pending.versionTag} is confirmed serving.`);
    } catch (e) {
      setActionError(errorText(e));
    } finally {
      setConfirming(false);
    }
  }

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

  return (
    <>
      <MetricRow columns={4}>
        <Metric
          label="Serving checkpoint"
          value={
            !serving || serving.status === 'unavailable'
              ? 'Unavailable'
              : serving.modelReady
                ? (serving.versionTag ?? 'Untracked')
                : 'Not ready'
          }
        />
        <Metric label="Registry active" value={active?.versionTag ?? 'None'} />
        <Metric label="Awaiting review" value={awaitingReview} />
        <Metric
          label="Pending deployment"
          value={pending?.versionTag ?? 'None'}
        />
      </MetricRow>

      <p
        aria-live="polite"
        style={{ ...MUTED, margin: '14px 0 0', fontSize: '0.9rem' }}
      >
        {serving?.status === 'ready'
          ? serving.matchesRegistry
            ? 'The serving checkpoint matches the registry’s active version and its approved files.'
            : serving.registryVersionTag &&
                serving.versionTag === serving.registryVersionTag
              ? 'The serving checkpoint has the active version’s tag, but its files could not be matched to the approved bundle.'
              : serving.registryVersionTag
                ? 'The serving checkpoint does not match the registry’s active version.'
                : 'A checkpoint is serving, but no registry version is marked active.'
          : serving?.status === 'not_ready'
            ? 'The AI service is up but has no approved, ready model to classify with.'
            : 'The AI service is unreachable. The registry below is still accurate.'}
      </p>

      {pending && (
        <section
          aria-labelledby="pending-deployment-title"
          style={{
            marginTop: 20,
            padding: 16,
            border: '1px solid var(--border-default)',
            borderRadius: 8,
            background: 'var(--surface-raised)',
          }}
        >
          <SectionHeader
            id="pending-deployment-title"
            title={`Deployment of ${pending.versionTag} is pending`}
            description={`Requested ${formatDateTime(pending.activationRequestedAt)}. Install the approved bundle and its approval manifest on the AI service and restart it. Confirming checks the AI service's /health and succeeds only when it reports ${pending.versionTag} serving with the approved files.`}
            actions={
              <>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() =>
                    setNoteRequest({
                      title: `Mark deployment of ${pending.versionTag} as failed?`,
                      description:
                        'Use this when the bundle could not be installed or did not pass the AI service readiness checks.',
                      label: 'What went wrong?',
                      confirmLabel: 'Mark failed',
                      destructive: true,
                      onConfirm: async (note) => {
                        await markModelDeploymentFailed(pending.id, note);
                        await done(
                          `Deployment of ${pending.versionTag} marked failed.`,
                        );
                      },
                    })
                  }
                >
                  Mark failed
                </Button>
                <Button
                  size="sm"
                  variant="primary"
                  disabled={confirming}
                  onClick={() => void confirmPending()}
                >
                  {confirming ? 'Checking /health…' : 'Confirm deployment'}
                </Button>
              </>
            }
          />
        </section>
      )}

      {notice && <Notice tone="status">{notice}</Notice>}
      {actionError && <Notice tone="alert">{actionError}</Notice>}

      <section aria-labelledby="model-versions-title" style={{ marginTop: 24 }}>
        <SectionHeader
          id="model-versions-title"
          title="Model versions"
          description="Candidates arrive from the training pipeline with holdout evidence. Approve or reject each one; approved versions can then be deployed or used for a rollback."
        />
        <DataTable<ModelVersionItem>
          ariaLabel="Model versions"
          rowKey={(m) => m.id}
          rows={models}
          columns={columns}
          emptyState={
            <EmptyState
              title="No model versions"
              description="Candidates appear here after the training pipeline registers them."
            />
          }
        />
      </section>

      <NoteDialog request={noteRequest} onClose={() => setNoteRequest(null)} />
    </>
  );
}
