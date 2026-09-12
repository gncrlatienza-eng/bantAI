import { fetchApi } from '../api/apiClient';

export interface UserReportItem {
  id: string;
  userId: string;
  messageId: string;
  originalLabel: string;
  reportedLabel: string;
  status: string;
  adminNote?: string | null;
  validatedAt?: string | null;
  createdAt: string;
  updatedAt: string;
  user?: {
    id: string;
    phone: string;
    firstName?: string | null;
    lastName?: string | null;
  };
  message?: {
    id: string;
    sender: string;
    body: string;
    receivedAt: string;
  };
}

export async function getAllReports(): Promise<UserReportItem[]> {
  return fetchApi<UserReportItem[]>('/reports', { useApiKey: true });
}

export async function getPendingReports(): Promise<UserReportItem[]> {
  return fetchApi<UserReportItem[]>('/reports/pending', { useApiKey: true });
}

export async function validateReport(
  id: string,
  adminNote?: string,
): Promise<UserReportItem> {
  return fetchApi<UserReportItem>(`/reports/${id}/validate`, {
    method: 'PATCH',
    useApiKey: true,
    body: JSON.stringify({ adminNote }),
  });
}

export async function rejectReport(
  id: string,
  adminNote?: string,
): Promise<UserReportItem> {
  return fetchApi<UserReportItem>(`/reports/${id}/reject`, {
    method: 'PATCH',
    useApiKey: true,
    body: JSON.stringify({ adminNote }),
  });
}

export async function submitReport(
  messageId: string,
  reportedLabel: string,
): Promise<UserReportItem> {
  return fetchApi<UserReportItem>('/reports', {
    method: 'POST',
    body: JSON.stringify({ messageId, reportedLabel }),
  });
}
