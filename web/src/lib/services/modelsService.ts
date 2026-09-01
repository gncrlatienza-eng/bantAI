import { fetchApi } from '../api';

export interface ModelVersion {
  id: string;
  version: string;
  accuracy: number;
  f1Score: number;
  precision: number;
  recall: number;
  datasetSize: number;
  isActive: boolean;
  notes?: string;
  trainedAt: string;
  createdAt: string;
}

export interface RetrainingEvaluation {
  shouldRetrain: boolean;
  triggers: {
    name: string;
    triggered: boolean;
    currentValue: number;
    threshold: number;
  }[];
}

export async function getModels(): Promise<ModelVersion[]> {
  return fetchApi<ModelVersion[]>('/models', { useApiKey: true });
}

export async function getActiveModel(): Promise<ModelVersion> {
  return fetchApi<ModelVersion>('/models/active', { useApiKey: true });
}

export async function activateModel(id: string): Promise<ModelVersion> {
  return fetchApi<ModelVersion>(`/models/${id}/activate`, {
    method: 'POST',
    useApiKey: true,
  });
}

export async function rollbackModel(id: string): Promise<ModelVersion> {
  return fetchApi<ModelVersion>(`/models/${id}/rollback`, {
    method: 'POST',
    useApiKey: true,
  });
}

export async function triggerRetraining(): Promise<{
  triggered: boolean;
  reason: string;
}> {
  return fetchApi<{ triggered: boolean; reason: string }>(
    '/retraining/trigger',
    {
      method: 'POST',
      useApiKey: true,
    },
  );
}

export async function getRetrainingStatus(): Promise<RetrainingEvaluation> {
  return fetchApi<RetrainingEvaluation>('/retraining/status', {
    useApiKey: true,
  });
}
