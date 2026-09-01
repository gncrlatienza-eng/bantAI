import { fetchApi } from '../api/apiClient';

export interface RetrainingStatus {
  triggered: boolean;
  reason: string;
  validatedCount: number;
  currentF1: number | null;
  drift: boolean;
}

export async function getRetrainingStatus(): Promise<RetrainingStatus> {
  return fetchApi<RetrainingStatus>('/retraining/status', { useApiKey: true });
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
