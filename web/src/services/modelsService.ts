import { fetchApi } from '../api/apiClient';

export interface ModelVersionItem {
  id: string;
  versionTag: string;
  f1Score: number;
  accuracy?: number | null;
  isActive: boolean;
  isRollback: boolean;
  notes?: string | null;
  promotedAt: string;
  rolledBackAt?: string | null;
  createdAt: string;
}

export async function getAllModels(): Promise<ModelVersionItem[]> {
  return fetchApi<ModelVersionItem[]>('/models');
}

export async function getActiveModel(): Promise<ModelVersionItem> {
  return fetchApi<ModelVersionItem>('/models/active');
}

export async function activateModel(id: string): Promise<ModelVersionItem> {
  return fetchApi<ModelVersionItem>(`/models/${id}/activate`, {
    method: 'POST',
  });
}

export async function rollbackModel(id: string): Promise<ModelVersionItem> {
  return fetchApi<ModelVersionItem>(`/models/${id}/rollback`, {
    method: 'POST',
  });
}

/*
 * Public-safe aggregate for the landing page. Returns nulls when no active
 * model exists so the frontend hides the metric rather than showing a fake
 * placeholder.
 */
export interface PublicModelSummary {
  macroF1: number | null;
  accuracy: number | null;
  versionTag: string | null;
  promotedAt: string | null;
}

export async function getPublicModelSummary(): Promise<PublicModelSummary> {
  return fetchApi<PublicModelSummary>('/models/public-summary');
}
