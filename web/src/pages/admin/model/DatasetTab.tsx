import { useCallback, useEffect, useMemo, useState } from 'react';
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
  SearchInput,
  Select,
  StatusBadge,
  type Column,
} from '../../../components/primitives';
import {
  DATASET_LANGUAGE_LABELS,
  createDatasetSnapshot,
  curateReport,
  downloadDatasetSnapshot,
  getDatasetOverview,
  getDatasetRevisions,
  updateDatasetSample,
  type DatasetCandidate,
  type DatasetLanguage,
  type DatasetOverview,
  type DatasetRevision,
  type DatasetSample,
  type DatasetSnapshot,
  type TrainingLabel,
} from '../../../services/datasetsService';
import { saveBlob } from '../../../utils/download';
import {
  MONO,
  MUTED,
  Notice,
  SectionHeader,
  errorText,
  formatDate,
  formatDateTime,
} from './shared';

const LABELS: TrainingLabel[] = ['Ham', 'Spam', 'Scam'];
const LABEL_OPTIONS = LABELS.map((label) => ({ value: label, label }));
const LANGUAGE_OPTIONS = [
  { value: '', label: 'Not tagged' },
  ...Object.entries(DATASET_LANGUAGE_LABELS).map(([value, label]) => ({
    value,
    label,
  })),
];

type SampleFilter = 'all' | 'included' | 'excluded';

function languageName(language: string | null) {
  return language
    ? (DATASET_LANGUAGE_LABELS[language as DatasetLanguage] ?? language)
    : 'Not tagged';
}

function share(count: number, total: number) {
  return total ? `${Math.round((count / total) * 100)}%` : '—';
}

interface CandidateDraft {
  label: TrainingLabel;
  language: DatasetLanguage | '';
}

interface EditState {
  sample: DatasetSample;
  label: TrainingLabel;
  language: DatasetLanguage | '';
}

export function DatasetTab() {
  const [data, setData] = useState<DatasetOverview | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState('');
  const [actionError, setActionError] = useState('');
  const [busyId, setBusyId] = useState('');
  const [drafts, setDrafts] = useState<Record<string, CandidateDraft>>({});
  const [filter, setFilter] = useState<SampleFilter>('all');
  const [search, setSearch] = useState('');
  const [edit, setEdit] = useState<EditState | null>(null);
  const [history, setHistory] = useState<{
    sample: DatasetSample;
    revisions: DatasetRevision[] | null;
  } | null>(null);
  const [snapshotTag, setSnapshotTag] = useState('');

  const load = useCallback(async () => {
    setError(null);
    try {
      const next = await getDatasetOverview();
      setData(next);
      setDrafts((previous) =>
        Object.fromEntries(
          next.candidates.map((c) => [
            c.id,
            previous[c.id] ?? {
              label: LABELS.includes(c.label) ? c.label : 'Scam',
              language: '',
            },
          ]),
        ),
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

  const act = useCallback(
    async (id: string, action: () => Promise<string>) => {
      setBusyId(id);
      setNotice('');
      setActionError('');
      try {
        setNotice(await action());
        await load();
      } catch (e) {
        setActionError(errorText(e));
      } finally {
        setBusyId('');
      }
    },
    [load],
  );

  const samples = useMemo(() => {
    const needle = search.trim().toLowerCase();
    return (data?.samples ?? []).filter(
      (s) =>
        (filter === 'all' ||
          (filter === 'included' ? s.included : !s.included)) &&
        (!needle || s.maskedText.toLowerCase().includes(needle)),
    );
  }, [data, filter, search]);

  const candidateColumns = useMemo<Column<DatasetCandidate>[]>(
    () => [
      {
        key: 'text',
        header: 'Masked message',
        render: (c) => (
          <span
            style={{ display: 'block', maxWidth: 420, fontSize: '0.875rem' }}
          >
            {c.maskedText}
          </span>
        ),
      },
      {
        key: 'original',
        header: 'Model said',
        width: '10%',
        render: (c) => c.originalLabel,
      },
      {
        key: 'label',
        header: 'Training label',
        width: '14%',
        render: (c) => (
          <Select
            aria-label="Training label"
            value={drafts[c.id]?.label ?? c.label}
            options={LABEL_OPTIONS}
            onChange={(event) =>
              setDrafts((d) => ({
                ...d,
                [c.id]: {
                  ...d[c.id],
                  label: event.target.value as TrainingLabel,
                },
              }))
            }
          />
        ),
      },
      {
        key: 'language',
        header: 'Language',
        width: '16%',
        render: (c) => (
          <Select
            aria-label="Language"
            value={drafts[c.id]?.language ?? ''}
            options={LANGUAGE_OPTIONS}
            onChange={(event) =>
              setDrafts((d) => ({
                ...d,
                [c.id]: {
                  ...d[c.id],
                  language: event.target.value as DatasetLanguage | '',
                },
              }))
            }
          />
        ),
      },
      {
        key: 'validated',
        header: 'Validated',
        width: '11%',
        render: (c) => formatDate(c.validatedAt),
      },
      {
        key: 'action',
        header: 'Action',
        align: 'right',
        render: (c) => (
          <Button
            size="sm"
            variant="secondary"
            disabled={Boolean(busyId)}
            onClick={() =>
              void act(c.id, async () => {
                const draft = drafts[c.id];
                await curateReport(c.id, {
                  label: draft?.label,
                  language: draft?.language || undefined,
                });
                return 'Report added to the training dataset.';
              })
            }
          >
            {busyId === c.id ? 'Adding…' : 'Add to dataset'}
          </Button>
        ),
      },
    ],
    [act, busyId, drafts],
  );

  const sampleColumns = useMemo<Column<DatasetSample>[]>(
    () => [
      {
        key: 'text',
        header: 'Masked message',
        render: (s) => (
          <span
            style={{
              display: 'block',
              maxWidth: 420,
              fontSize: '0.875rem',
              ...(s.included ? {} : MUTED),
            }}
          >
            {s.maskedText}
          </span>
        ),
      },
      { key: 'label', header: 'Label', width: '8%', render: (s) => s.label },
      {
        key: 'language',
        header: 'Language',
        width: '13%',
        render: (s) => languageName(s.language),
      },
      {
        key: 'state',
        header: 'State',
        width: '12%',
        render: (s) =>
          s.included ? (
            <StatusBadge kind="verified" label="Included" />
          ) : (
            <StatusBadge kind="unknown" label="Excluded" />
          ),
      },
      {
        key: 'version',
        header: 'Version',
        width: '8%',
        align: 'right',
        render: (s) => (
          <Button
            size="sm"
            variant="ghost"
            aria-label={`Version history, currently v${s.version}`}
            onClick={() => {
              setHistory({ sample: s, revisions: null });
              getDatasetRevisions(s.id)
                .then((revisions) =>
                  setHistory((h) =>
                    h?.sample.id === s.id ? { sample: s, revisions } : h,
                  ),
                )
                .catch((e) => setActionError(errorText(e)));
            }}
          >
            v{s.version}
          </Button>
        ),
      },
      {
        key: 'actions',
        header: 'Actions',
        align: 'right',
        render: (s) => (
          <span
            style={{
              display: 'inline-flex',
              gap: 8,
              justifyContent: 'flex-end',
            }}
          >
            <Button
              size="sm"
              variant="secondary"
              disabled={Boolean(busyId)}
              onClick={() =>
                setEdit({
                  sample: s,
                  label: s.label,
                  language: s.language ?? '',
                })
              }
            >
              Edit
            </Button>
            <Button
              size="sm"
              variant={s.included ? 'destructive' : 'secondary'}
              disabled={Boolean(busyId)}
              onClick={() =>
                void act(s.id, async () => {
                  await updateDatasetSample(s.id, { included: !s.included });
                  return s.included
                    ? 'Sample excluded. It stays in history and can be restored.'
                    : 'Sample restored to the dataset.';
                })
              }
            >
              {s.included ? 'Exclude' : 'Restore'}
            </Button>
          </span>
        ),
      },
    ],
    [act, busyId],
  );

  const snapshotColumns: Column<DatasetSnapshot>[] = [
    {
      key: 'tag',
      header: 'Version',
      render: (s) => <span style={MONO}>{s.versionTag}</span>,
    },
    {
      key: 'items',
      header: 'Samples',
      align: 'right',
      width: '12%',
      render: (s) => s.itemCount.toLocaleString(),
    },
    {
      key: 'created',
      header: 'Created',
      width: '22%',
      render: (s) => formatDateTime(s.createdAt),
    },
    {
      key: 'download',
      header: 'Training export',
      align: 'right',
      render: (s) => (
        <Button
          size="sm"
          variant="secondary"
          disabled={Boolean(busyId)}
          onClick={() =>
            void act(`download-${s.id}`, async () => {
              const blob = await downloadDatasetSnapshot(s.versionTag);
              saveBlob(blob, `${s.versionTag}.jsonl`);
              return `Downloaded ${s.versionTag}. Place it in the retraining run's reports directory.`;
            })
          }
        >
          Download JSONL
        </Button>
      ),
    },
  ];

  if (loading) return <LoadingState label="Loading dataset" />;
  if (error || !data) {
    return (
      <ErrorState
        title="Dataset unavailable"
        description={error ?? 'No dataset returned.'}
        action={
          <Button variant="secondary" onClick={() => void load()}>
            Retry
          </Button>
        }
      />
    );
  }

  const { totals } = data;
  const tagValid =
    !snapshotTag || /^[a-zA-Z0-9][a-zA-Z0-9._-]{0,79}$/.test(snapshotTag);

  return (
    <>
      <MetricRow columns={4}>
        <Metric
          label="Included samples"
          value={totals.included.toLocaleString()}
        />
        <Metric label="Excluded" value={totals.excluded.toLocaleString()} />
        <Metric
          label="Awaiting curation"
          value={totals.candidates.toLocaleString()}
        />
        <Metric
          label="Portal holdout records"
          value={totals.frozenHoldout.toLocaleString()}
          meta="External holdout files are not counted"
        />
      </MetricRow>

      <p style={{ ...MUTED, margin: '14px 0 0', fontSize: '0.9rem' }}>
        Class balance:{' '}
        {LABELS.map(
          (label) =>
            `${label} ${totals.labels[label] ?? 0} (${share(totals.labels[label] ?? 0, totals.included)})`,
        ).join(' · ')}
        {' — '}Languages:{' '}
        {Object.entries(totals.languages)
          .map(
            ([lang, count]) =>
              `${lang === 'untagged' ? 'Not tagged' : languageName(lang)} ${count}`,
          )
          .join(' · ') || 'none tagged'}
      </p>
      <p
        style={{
          ...MUTED,
          margin: '6px 0 0',
          fontSize: '0.9rem',
          maxWidth: '85ch',
        }}
      >
        This tab tracks curated reports, not the historical training corpus or
        external holdout file. Phone classifications appear in Mobile sync and
        Classification log; only masked text from Admin-validated user reports
        can enter this dataset. Raw SMS never leaves the phone. Every change is
        saved as a new version, and snapshots freeze exactly what a training run
        uses.
      </p>

      {notice && <Notice tone="status">{notice}</Notice>}
      {actionError && <Notice tone="alert">{actionError}</Notice>}

      <section
        aria-labelledby="dataset-candidates-title"
        style={{ marginTop: 28 }}
      >
        <SectionHeader
          id="dataset-candidates-title"
          title="Validated reports awaiting curation"
          description="Confirm the training label and tag the language before adding a report."
        />
        <DataTable<DatasetCandidate>
          ariaLabel="Validated reports awaiting curation"
          rowKey={(c) => c.id}
          rows={data.candidates}
          columns={candidateColumns}
          emptyState={
            <EmptyState
              title="Nothing to curate"
              description="Reports appear here after they are validated on the FP / FN reviews tab."
            />
          }
        />
      </section>

      <section
        aria-labelledby="dataset-samples-title"
        style={{ marginTop: 28 }}
      >
        <SectionHeader
          id="dataset-samples-title"
          title="Training samples"
          description="Relabel, retag or exclude samples. Excluded samples stay in history and are left out of new snapshots."
          actions={
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <div style={{ width: 150 }}>
                <Select
                  aria-label="Show samples"
                  value={filter}
                  options={[
                    { value: 'all', label: 'All samples' },
                    { value: 'included', label: 'Included' },
                    { value: 'excluded', label: 'Excluded' },
                  ]}
                  onChange={(event) =>
                    setFilter(event.target.value as SampleFilter)
                  }
                />
              </div>
              <div style={{ width: 240 }}>
                <SearchInput
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  onClear={() => setSearch('')}
                  placeholder="Search masked text"
                />
              </div>
            </div>
          }
        />
        <DataTable<DatasetSample>
          ariaLabel="Training samples"
          rowKey={(s) => s.id}
          rows={samples}
          columns={sampleColumns}
          emptyState={
            <EmptyState
              title={
                search || filter !== 'all'
                  ? 'No matching samples'
                  : 'No training samples yet'
              }
              description={
                search || filter !== 'all'
                  ? 'Change the filter or search to see more.'
                  : 'Add validated reports above to start the curated dataset.'
              }
            />
          }
        />
      </section>

      <section
        aria-labelledby="dataset-snapshots-title"
        style={{ marginTop: 28 }}
      >
        <SectionHeader
          id="dataset-snapshots-title"
          title="Dataset versions"
          description="A snapshot freezes every included sample at its current version. Retraining requests record the newest snapshot, and the JSONL export plugs into the retraining pipeline's reports directory."
          actions={
            <div style={{ display: 'flex', gap: 8, alignItems: 'flex-end' }}>
              <div style={{ width: 220 }}>
                <Input
                  aria-label="Version tag (optional)"
                  placeholder="Version tag (optional)"
                  value={snapshotTag}
                  maxLength={80}
                  aria-invalid={tagValid ? undefined : 'true'}
                  onChange={(event) => setSnapshotTag(event.target.value)}
                />
              </div>
              <Button
                variant="primary"
                disabled={Boolean(busyId) || !tagValid || totals.included === 0}
                onClick={() =>
                  void act('snapshot', async () => {
                    const snapshot = await createDatasetSnapshot(
                      snapshotTag.trim() || undefined,
                    );
                    setSnapshotTag('');
                    return `Snapshot ${snapshot.versionTag} created with ${snapshot.itemCount} samples.`;
                  })
                }
              >
                Create snapshot
              </Button>
            </div>
          }
        />
        <DataTable<DatasetSnapshot>
          ariaLabel="Dataset versions"
          rowKey={(s) => s.id}
          rows={data.snapshots}
          columns={snapshotColumns}
          emptyState={
            <EmptyState
              title="No dataset versions"
              description="Create a snapshot once the dataset has included samples."
            />
          }
        />
      </section>

      <Dialog
        open={edit !== null}
        title="Edit training sample"
        description="Saving creates a new version of this sample. Earlier versions stay in its history and in any snapshot that used them."
        onClose={() => {
          if (!busyId) setEdit(null);
        }}
        actions={
          <>
            <Button
              variant="ghost"
              disabled={Boolean(busyId)}
              onClick={() => setEdit(null)}
            >
              Cancel
            </Button>
            <Button
              variant="primary"
              disabled={
                Boolean(busyId) ||
                !edit ||
                (edit.label === edit.sample.label &&
                  (edit.language || null) === edit.sample.language)
              }
              onClick={() => {
                if (!edit) return;
                void act(edit.sample.id, async () => {
                  await updateDatasetSample(edit.sample.id, {
                    label: edit.label,
                    language: edit.language || null,
                  });
                  setEdit(null);
                  return 'Sample updated.';
                });
              }}
            >
              Save new version
            </Button>
          </>
        }
      >
        {edit && (
          <>
            <p style={{ margin: 0, fontSize: '0.9rem' }}>
              {edit.sample.maskedText}
            </p>
            <Select
              label="Training label"
              value={edit.label}
              options={LABEL_OPTIONS}
              onChange={(event) =>
                setEdit({ ...edit, label: event.target.value as TrainingLabel })
              }
            />
            <Select
              label="Language"
              value={edit.language}
              options={LANGUAGE_OPTIONS}
              onChange={(event) =>
                setEdit({
                  ...edit,
                  language: event.target.value as DatasetLanguage | '',
                })
              }
            />
          </>
        )}
      </Dialog>

      <Dialog
        open={history !== null}
        title="Sample history"
        description={
          history ? `Current version v${history.sample.version}.` : undefined
        }
        onClose={() => setHistory(null)}
        actions={
          <Button variant="secondary" onClick={() => setHistory(null)}>
            Close
          </Button>
        }
      >
        {!history?.revisions ? (
          <LoadingState label="Loading history" />
        ) : (
          <ol
            style={{
              margin: 0,
              paddingLeft: 18,
              display: 'grid',
              gap: 8,
              fontSize: '0.875rem',
            }}
          >
            {history.revisions.map((r) => (
              <li key={r.id}>
                <strong>v{r.version}</strong> {r.action.toLowerCase()} ·{' '}
                {r.label} · {languageName(r.language)} ·{' '}
                {r.included ? 'included' : 'excluded'}
                <span style={{ ...MUTED, display: 'block' }}>
                  {formatDateTime(r.createdAt)}
                </span>
              </li>
            ))}
          </ol>
        )}
      </Dialog>
    </>
  );
}
