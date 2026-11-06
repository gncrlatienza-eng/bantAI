import { fetchApi, fetchApiBlob } from '../api/apiClient';

export type TrainingLabel = 'Ham' | 'Spam' | 'Scam';
/** "mixed" covers code-switched Taglish. */
export type DatasetLanguage = 'en' | 'fil' | 'mixed' | 'other';

export const DATASET_LANGUAGE_LABELS: Record<DatasetLanguage, string> = {
  en: 'English',
  fil: 'Filipino',
  mixed: 'Mixed (Taglish)',
  other: 'Other',
};

export interface DatasetSample {
  id: string;
  sourceReportId: string | null;
  maskedText: string;
  label: TrainingLabel;
  language: DatasetLanguage | null;
  split: 'TRAIN' | 'HOLDOUT';
  included: boolean;
  provenance: string;
  consentConfirmed: boolean;
  reviewedAt: string | null;
  version: number;
  createdAt: string;
  updatedAt: string;
}

export interface DatasetCandidate {
  id: string;
  label: TrainingLabel;
  originalLabel: string;
  maskedText: string;
  validatedAt: string | null;
}

export interface DatasetSnapshot {
  id: string;
  versionTag: string;
  createdAt: string;
  createdByUserId: string;
  itemCount: number;
}

export interface DatasetOverview {
  samples: DatasetSample[];
  candidates: DatasetCandidate[];
  snapshots: DatasetSnapshot[];
  totals: {
    included: number;
    excluded: number;
    candidates: number;
    frozenHoldout: number;
    labels: Record<TrainingLabel, number>;
    languages: Record<string, number>;
  };
}

export interface DatasetRevision {
  id: string;
  version: number;
  action: 'CURATED' | 'UPDATED' | 'EXCLUDED' | 'RESTORED';
  label: TrainingLabel;
  language: DatasetLanguage | null;
  included: boolean;
  actorUserId: string;
  createdAt: string;
}

export const getDatasetOverview = () => fetchApi<DatasetOverview>('/datasets');

export const curateReport = (
  reportId: string,
  input: { label?: TrainingLabel; language?: DatasetLanguage },
) =>
  fetchApi<DatasetSample>(`/datasets/reports/${encodeURIComponent(reportId)}`, {
    method: 'POST',
    body: JSON.stringify(input),
  });

export const updateDatasetSample = (
  id: string,
  input: {
    label?: TrainingLabel;
    language?: DatasetLanguage | null;
    included?: boolean;
  },
) =>
  fetchApi<DatasetSample>(`/datasets/samples/${encodeURIComponent(id)}`, {
    method: 'PATCH',
    body: JSON.stringify(input),
  });

export const getDatasetRevisions = (id: string) =>
  fetchApi<DatasetRevision[]>(
    `/datasets/samples/${encodeURIComponent(id)}/revisions`,
  );

export const createDatasetSnapshot = (versionTag?: string) =>
  fetchApi<DatasetSnapshot>('/datasets/snapshots', {
    method: 'POST',
    body: JSON.stringify(versionTag ? { versionTag } : {}),
  });

/** JSONL in the retraining pipeline's FileReportSource format. Audited. */
export const downloadDatasetSnapshot = (versionTag: string) =>
  fetchApiBlob(
    `/datasets/snapshots/${encodeURIComponent(versionTag)}/export.jsonl`,
  );

/*
 * Detection review queue: messages the model classified on its own, from
 * users who opted in to training. Nothing enters the dataset until an admin
 * labels it here.
 */
export type ReviewKind = 'detected' | 'uncertain' | 'spot_check';

export interface ReviewCandidate {
  messageId: string;
  kind: ReviewKind;
  /** Server-masked text; the sender is never sent. */
  maskedText: string;
  /** What the model said. */
  label: string | null;
  score: number | null;
  bucket: string | null;
  clusterId: string | null;
  receivedAt: string;
}

export const getReviewQueue = (kind: ReviewKind) =>
  fetchApi<ReviewCandidate[]>(
    `/datasets/review-queue?kind=${encodeURIComponent(kind)}`,
  );

export const confirmReviewCandidate = (
  messageId: string,
  label: TrainingLabel,
) =>
  fetchApi<DatasetSample>(
    `/datasets/review-queue/${encodeURIComponent(messageId)}`,
    { method: 'POST', body: JSON.stringify({ label }) },
  );

export const skipReviewCandidate = (messageId: string) =>
  fetchApi<{ messageId: string; skipped: true }>(
    `/datasets/review-queue/${encodeURIComponent(messageId)}/skip`,
    { method: 'POST' },
  );
