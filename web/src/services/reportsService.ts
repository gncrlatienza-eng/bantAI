import { fetchApi } from '../api/apiClient';

export interface UserReportItem {
  id: string;
  userId?: string;
  messageId?: string;
  originalLabel: string;
  reportedLabel: string;
  status: 'Pending' | 'Validated' | 'Rejected';
  adminNote?: string | null;
  /** Reporter's own note from the mobile Take Action sheet, masked server-side. */
  note?: string | null;
  validatedAt?: string | null;
  createdAt: string;
  updatedAt?: string;
  user?: {
    id: string;
  };
  /** Body is privacy-masked by the backend (sms-privacy-masker.ts). */
  message?: {
    id: string;
    body: string;
    receivedAt?: string;
    clusterId?: string | null;
    classification?: {
      label: string;
      score: number;
      bucket?: string | null;
    } | null;
  };
}

/** Partial row returned by the validate/reject endpoints. */
export type ReviewedReport = Pick<UserReportItem, 'id' | 'status'> &
  Partial<Pick<UserReportItem, 'adminNote' | 'validatedAt' | 'updatedAt'>>;

export async function getAllReports(): Promise<UserReportItem[]> {
  return fetchApi<UserReportItem[]>('/reports');
}

export async function getPendingReports(): Promise<UserReportItem[]> {
  return fetchApi<UserReportItem[]>('/reports/pending');
}

export async function validateReport(
  id: string,
  adminNote?: string,
): Promise<ReviewedReport> {
  return fetchApi<ReviewedReport>(`/reports/${id}/validate`, {
    method: 'PATCH',
    body: JSON.stringify({ adminNote }),
  });
}

export async function rejectReport(
  id: string,
  adminNote?: string,
): Promise<ReviewedReport> {
  return fetchApi<ReviewedReport>(`/reports/${id}/reject`, {
    method: 'PATCH',
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
