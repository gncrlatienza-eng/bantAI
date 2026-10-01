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
