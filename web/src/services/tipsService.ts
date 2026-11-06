import { fetchApi } from '../api/apiClient';

export interface SafetyTip {
  id: string;
  title: string;
  body: string;
  region: string | null;
  campaign: string | null;
  isPublished: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface SafetyTipInput {
  title: string;
  body: string;
  region?: string | null;
  campaign?: string | null;
  isPublished: boolean;
}

export function getAdminTips(): Promise<SafetyTip[]> {
  return fetchApi<SafetyTip[]>('/admin/tips');
}

export function createSafetyTip(input: SafetyTipInput): Promise<SafetyTip> {
  return fetchApi<SafetyTip>('/admin/tips', {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

export function updateSafetyTip(
  id: string,
  input: Partial<SafetyTipInput>,
): Promise<SafetyTip> {
  return fetchApi<SafetyTip>(`/admin/tips/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(input),
  });
}

export function deleteSafetyTip(id: string): Promise<{ deleted: boolean }> {
  return fetchApi<{ deleted: boolean }>(`/admin/tips/${id}`, {
    method: 'DELETE',
  });
}
