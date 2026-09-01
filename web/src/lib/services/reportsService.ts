import { fetchApi } from '../api';

export interface UserReportItem {
  id: string;
  userId: string;
  messageId: string;
  reportType: string;
  notes?: string;
  adminNote?: string;
  status: string;
  createdAt: string;
  updatedAt: string;
  user?: {
    id: string;
    email: string;
    fullName?: string;
  };
  message?: {
    id: string;
    sender: string;
    body: string;
    receivedAt: string;
  };
}

export async function getReports(): Promise<UserReportItem[]> {
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
