import { fetchApi } from '../api/apiClient';

export interface AnalyticsSummary {
  totalMessages: number;
  classificationsByLabel: Record<string, number>;
  alertsByStatus: Record<string, number>;
  totalReports: number;
}

export async function getAnalyticsSummary(): Promise<AnalyticsSummary> {
  return fetchApi<AnalyticsSummary>('/analytics/summary', { useApiKey: true });
}
