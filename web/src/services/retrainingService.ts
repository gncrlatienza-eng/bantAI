import { fetchApi } from '../api/apiClient';

export interface RetrainingStatus {
  triggered: boolean;
  reason: string;
  validatedCount: number;
  currentF1: number | null;
  drift: boolean;
  enabled: boolean;
  thresholds: {
    validatedReports: number;
    f1Drop: number;
    pageHinkleyDelta: number;
    pageHinkleyLambda: number;
    pageHinkleyMinSamples: number;
  };
}

export type RetrainingJobStatus =
  'REQUESTED' | 'ACCEPTED' | 'FAILED' | 'CANCELLED';

export interface RetrainingJob {
  id: string;
  trigger: string;
  status: RetrainingJobStatus;
  datasetVersion: string | null;
  requestedByUserId: string | null;
  providerJobId: string | null;
  detail: string | null;
  createdAt: string;
  updatedAt: string;
}

export type DriftInvestigationStatus =
  'OPEN' | 'INVESTIGATING' | 'RESOLVED' | 'DISMISSED';

export interface DriftInvestigation {
  id: string;
  signal: string;
  status: DriftInvestigationStatus;
  modelVersionTag: string | null;
  metrics: Partial<RetrainingStatus>;
  notes: string | null;
  resolution: string | null;
  retrainingJobId: string | null;
  openedByUserId: string;
  resolvedByUserId: string | null;
  resolvedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export async function getRetrainingStatus(): Promise<RetrainingStatus> {
  return fetchApi<RetrainingStatus>('/retraining/status');
}

export async function triggerRetraining(): Promise<{
  triggered: boolean;
  reason: string;
  job: RetrainingJob;
}> {
  return fetchApi('/retraining/trigger', { method: 'POST' });
}

export const getRetrainingJobs = () =>
  fetchApi<RetrainingJob[]>('/retraining/jobs');

export const getDriftInvestigations = () =>
  fetchApi<DriftInvestigation[]>('/retraining/investigations');

export const openDriftInvestigation = (notes?: string) =>
  fetchApi<DriftInvestigation>('/retraining/investigations', {
    method: 'POST',
    body: JSON.stringify(notes ? { notes } : {}),
  });

export const updateDriftInvestigation = (
  id: string,
  update: {
    status?: DriftInvestigationStatus;
    notes?: string;
    resolution?: string;
  },
) =>
  fetchApi<DriftInvestigation>(
    `/retraining/investigations/${encodeURIComponent(id)}`,
    { method: 'PATCH', body: JSON.stringify(update) },
  );

export const retrainForInvestigation = (id: string) =>
  fetchApi<RetrainingJob>(
    `/retraining/investigations/${encodeURIComponent(id)}/retrain`,
    { method: 'POST' },
  );
