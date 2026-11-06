import { fetchApi } from '../api/apiClient';

/**
 * REGISTERED  – older row from before the lifecycle; reviewed like EVALUATING
 * EVALUATING  – holdout evaluation received, awaiting an Admin decision
 * APPROVED    – approved; may be deployed (or re-deployed as a rollback)
 * REJECTED    – declined with a recorded reason
 * ACTIVATION_REQUESTED – deployment requested; waiting for the AI service
 *                        to report this version serving
 * ACTIVE      – confirmed serving by the AI service /health check
 * FAILED      – a requested deployment could not be completed
 */
export type ModelCandidateStatus =
  | 'REGISTERED'
  | 'EVALUATING'
  | 'APPROVED'
  | 'REJECTED'
  | 'ACTIVATION_REQUESTED'
  | 'ACTIVE'
  | 'FAILED';

export interface ModelEvaluation {
  macroF1?: number;
  accuracy?: number | null;
  source?: string;
  [key: string]: unknown;
}

export interface ModelVersionItem {
  id: string;
  versionTag: string;
  f1Score: number;
  accuracy?: number | null;
  isActive: boolean;
  isRollback: boolean;
  status: ModelCandidateStatus;
  evaluation: ModelEvaluation | null;
  provenance: Record<string, unknown> | null;
  reviewNote: string | null;
  reviewedAt: string | null;
  activationRequestedAt: string | null;
  runtimeActivationConfirmedAt: string | null;
  notes?: string | null;
  promotedAt: string;
  rolledBackAt?: string | null;
  createdAt: string;
}

export interface ServingModelStatus {
  status: 'ready' | 'not_ready' | 'unavailable';
  modelReady: boolean;
  versionTag: string | null;
  /** Digest of the files the AI service verified; null if unreported. */
  bundleDigest: string | null;
  registryVersionTag: string | null;
  registryBundleDigest: string | null;
  /** Same version tag and the same artifact bytes as the registry. */
  matchesRegistry: boolean;
}

export async function getAllModels(): Promise<ModelVersionItem[]> {
  return fetchApi<ModelVersionItem[]>('/models');
}

export async function getActiveModel(): Promise<ModelVersionItem> {
  return fetchApi<ModelVersionItem>('/models/active');
}

export async function getServingModelStatus(): Promise<ServingModelStatus> {
  return fetchApi<ServingModelStatus>('/models/serving');
}

function lifecycle(id: string, action: string, note?: string) {
  return fetchApi<ModelVersionItem>(
    `/models/${encodeURIComponent(id)}/${action}`,
    {
      method: 'POST',
      ...(note !== undefined ? { body: JSON.stringify({ note }) } : {}),
    },
  );
}

export const approveModel = (id: string, note: string) =>
  lifecycle(id, 'approve', note);
export const rejectModel = (id: string, note: string) =>
  lifecycle(id, 'reject', note);
/** Records a deployment request; the AI service still has to be switched. */
export const requestModelDeployment = (id: string, note: string) =>
  lifecycle(id, 'deploy', note);
/** Succeeds only when the AI service reports this version serving. */
export const confirmModelDeployment = (id: string) =>
  lifecycle(id, 'confirm-deployment');
export const markModelDeploymentFailed = (id: string, note: string) =>
  lifecycle(id, 'deployment-failed', note);
