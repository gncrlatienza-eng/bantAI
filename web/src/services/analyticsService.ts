import { fetchApi } from '../api/apiClient';

export interface AnalyticsSummary {
  totalMessages: number;
  classificationsByLabel: Record<string, number>;
  alertsByStatus: Record<string, number>;
  totalReports: number;
}

export async function getAnalyticsSummary(
  range: string = '30d',
): Promise<AnalyticsSummary> {
  const query =
    range && range !== 'all' ? `?range=${encodeURIComponent(range)}` : '';
  return fetchApi<AnalyticsSummary>(`/analytics/summary${query}`);
}

export interface TrendPeriodItem {
  date: string;
  label: string;
  scam: number;
  spam: number;
  ham: number;
  total: number;
  byCategory: Record<string, number>;
}

export interface AdminThreatTrendsResponse {
  range: string;
  interval: 'day' | 'week';
  startDate: string;
  endDate: string;
  categories: string[];
  categoryTotals: Record<string, number>;
  totals: {
    scam: number;
    spam: number;
    ham: number;
    total: number;
  };
  timeline: TrendPeriodItem[];
}

export type TrendRange = 'today' | '7d' | '14d' | '30d' | '90d';

export async function getAdminThreatTrends(
  range: TrendRange = '30d',
  interval: 'day' | 'week' = 'day',
): Promise<AdminThreatTrendsResponse> {
  return fetchApi<AdminThreatTrendsResponse>(
    `/analytics/admin/trends?range=${encodeURIComponent(range)}&interval=${encodeURIComponent(interval)}`,
  );
}
