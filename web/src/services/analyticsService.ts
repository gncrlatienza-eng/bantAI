import { fetchApi } from '../api/apiClient';

export interface AnalyticsSummary {
  totalMessages: number;
  classificationsByLabel: Record<string, number>;
  alertsByStatus: Record<string, number>;
  totalReports: number;
}

function getDevMockSummary(range: string = '30d'): AnalyticsSummary {
  const multiplier =
    range === 'today'
      ? 0.06
      : range === '7d'
        ? 0.25
        : range === '14d'
          ? 0.5
          : range === '90d'
            ? 3.0
            : range === 'all'
              ? 4.2
              : 1.0;

  return {
    totalMessages: Math.round(12480 * multiplier),
    classificationsByLabel: {
      Scam: Math.round(4120 * multiplier),
      Spam: Math.round(3210 * multiplier),
      Ham: Math.round(5150 * multiplier),
    },
    alertsByStatus: {
      RECEIVED: Math.max(1, Math.round(42 * multiplier)),
      UNDER_REVIEW: Math.max(1, Math.round(18 * multiplier)),
      RESOLVED: Math.round(389 * multiplier),
      DISMISSED: Math.round(65 * multiplier),
    },
    totalReports: Math.round(514 * multiplier),
  };
}

export async function getAnalyticsSummary(
  range: string = '30d',
): Promise<AnalyticsSummary> {
  const query =
    range && range !== 'all' ? `?range=${encodeURIComponent(range)}` : '';
  try {
    return await fetchApi<AnalyticsSummary>(`/analytics/summary${query}`);
  } catch (err) {
    if (import.meta.env.DEV) {
      return getDevMockSummary(range);
    }
    throw err;
  }
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

function generateDevMockTrends(
  range: TrendRange,
  interval: 'day' | 'week',
): AdminThreatTrendsResponse {
  const days =
    range === 'today'
      ? 1
      : range === '7d'
        ? 7
        : range === '14d'
          ? 14
          : range === '90d'
            ? 90
            : 30;
  const now = new Date();
  const timeline: TrendPeriodItem[] = [];
  const categories = [
    'Gambling',
    'Prize Lures',
    'Fake Job Offers',
    'Bank Phishing',
    'General Spam',
  ];
  const categoryTotals: Record<string, number> = {
    Gambling: 0,
    'Prize Lures': 0,
    'Fake Job Offers': 0,
    'Bank Phishing': 0,
    'General Spam': 0,
  };
  const totals = { scam: 0, spam: 0, ham: 0, total: 0 };

  if (range === 'today') {
    const hours = ['00:00', '04:00', '08:00', '12:00', '16:00', '20:00'];
    hours.forEach((h, idx) => {
      const seed = (idx * 5 + 7) % 11;
      const scamCount = 12 + seed * 2;
      const spamCount = 8 + seed;
      const hamCount = 35 + seed * 3;
      const periodTotal = scamCount + spamCount + hamCount;

      const gambling = Math.floor(scamCount * 0.45);
      const prizeLures = Math.floor(scamCount * 0.3);
      const fakeJobs = Math.floor(scamCount * 0.15);
      const bankPhishing = scamCount - gambling - prizeLures - fakeJobs;

      categoryTotals.Gambling += gambling;
      categoryTotals['Prize Lures'] += prizeLures;
      categoryTotals['Fake Job Offers'] += fakeJobs;
      categoryTotals['Bank Phishing'] += bankPhishing;
      categoryTotals['General Spam'] += spamCount;

      totals.scam += scamCount;
      totals.spam += spamCount;
      totals.ham += hamCount;
      totals.total += periodTotal;

      timeline.push({
        date: h,
        label: h,
        scam: scamCount,
        spam: spamCount,
        ham: hamCount,
        total: periodTotal,
        byCategory: {
          Gambling: gambling,
          'Prize Lures': prizeLures,
          'Fake Job Offers': fakeJobs,
          'Bank Phishing': bankPhishing,
          'General Spam': spamCount,
        },
      });
    });
  } else {
    for (let i = days - 1; i >= 0; i--) {
      const d = new Date(now.getTime() - i * 86400000);
      const dateStr = d.toISOString().slice(0, 10);
      const monthDay = d.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
      });

      // Deterministic realistic numbers based on day index
      const seed = (i * 7 + 13) % 17;
      const scamCount = 8 + (seed % 15);
      const spamCount = 3 + (seed % 8);
      const hamCount = 35 + (seed % 20);

      const gambling = Math.floor(scamCount * 0.45);
      const prizeLures = Math.floor(scamCount * 0.3);
      const fakeJobs = Math.floor(scamCount * 0.15);
      const bankPhishing = scamCount - gambling - prizeLures - fakeJobs;

      categoryTotals.Gambling += gambling;
      categoryTotals['Prize Lures'] += prizeLures;
      categoryTotals['Fake Job Offers'] += fakeJobs;
      categoryTotals['Bank Phishing'] += bankPhishing;
      categoryTotals['General Spam'] += spamCount;

      totals.scam += scamCount;
      totals.spam += spamCount;
      totals.ham += hamCount;
      totals.total += scamCount + spamCount + hamCount;

      timeline.push({
        date: dateStr,
        label: monthDay,
        scam: scamCount,
        spam: spamCount,
        ham: hamCount,
        total: scamCount + spamCount + hamCount,
        byCategory: {
          Gambling: gambling,
          'Prize Lures': prizeLures,
          'Fake Job Offers': fakeJobs,
          'Bank Phishing': bankPhishing,
          'General Spam': spamCount,
        },
      });
    }
  }

  return {
    range,
    interval,
    startDate: timeline[0]?.date || now.toISOString(),
    endDate: timeline[timeline.length - 1]?.date || now.toISOString(),
    categories,
    categoryTotals,
    totals,
    timeline,
  };
}

export async function getAdminThreatTrends(
  range: TrendRange = '30d',
  interval: 'day' | 'week' = 'day',
): Promise<AdminThreatTrendsResponse> {
  try {
    return await fetchApi<AdminThreatTrendsResponse>(
      `/analytics/admin/trends?range=${encodeURIComponent(range)}&interval=${encodeURIComponent(interval)}`,
    );
  } catch (err) {
    if (import.meta.env.DEV) {
      return generateDevMockTrends(range, interval);
    }
    throw err;
  }
}
