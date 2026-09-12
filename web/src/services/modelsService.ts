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
  return fetchApi<ModelVersionItem[]>('/models', { useApiKey: true });
}

export async function getActiveModel(): Promise<ModelVersionItem> {
  return fetchApi<ModelVersionItem>('/models/active', { useApiKey: true });
}

export async function activateModel(id: string): Promise<ModelVersionItem> {
  return fetchApi<ModelVersionItem>(`/models/${id}/activate`, {
    method: 'POST',
    useApiKey: true,
  });
}

export async function rollbackModel(id: string): Promise<ModelVersionItem> {
  return fetchApi<ModelVersionItem>(`/models/${id}/rollback`, {
    method: 'POST',
    useApiKey: true,
  });
}
