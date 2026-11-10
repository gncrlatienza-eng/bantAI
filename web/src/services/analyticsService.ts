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
    'General Spam',
    'Gambling',
    'Prize Lures',
    'Bank Phishing',
    'Fake Job Offers',
  ];
  const categoryTotals: Record<string, number> = {
    'General Spam': 0,
    Gambling: 0,
    'Prize Lures': 0,
    'Bank Phishing': 0,
    'Fake Job Offers': 0,
  };
  const totals = { scam: 0, spam: 0, ham: 0, total: 0 };

  if (range === 'today') {
    const hours = ['00:00', '04:00', '08:00', '12:00', '16:00', '20:00'];
    const hourlyScam = [3, 1, 8, 14, 18, 11];
    const hourlySpam = [2, 1, 4, 7, 9, 6];
    const hourlyHam = [10, 4, 28, 45, 52, 38];

    hours.forEach((h, idx) => {
      const scamCount = hourlyScam[idx];
      const spamCount = hourlySpam[idx];
      const hamCount = hourlyHam[idx];
      const periodTotal = scamCount + spamCount + hamCount;

      const gambling = Math.round(scamCount * 0.35);
      const prizeLures = Math.round(scamCount * 0.25);
      const fakeJobs = Math.round(scamCount * 0.15);
      const bankPhishing = Math.max(0, scamCount - gambling - prizeLures - fakeJobs);

      categoryTotals['General Spam'] += spamCount;
      categoryTotals.Gambling += gambling;
      categoryTotals['Prize Lures'] += prizeLures;
      categoryTotals['Bank Phishing'] += bankPhishing;
      categoryTotals['Fake Job Offers'] += fakeJobs;

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
          'General Spam': spamCount,
          Gambling: gambling,
          'Prize Lures': prizeLures,
          'Bank Phishing': bankPhishing,
          'Fake Job Offers': fakeJobs,
        },
      });
    });
  } else {
    // Realistic daily telemetry with weekday volume curves and campaign surges
    for (let i = days - 1; i >= 0; i--) {
      const d = new Date(now.getTime() - i * 86400000);
      const dayOfWeek = d.getDay(); // 0 = Sun, 6 = Sat
      const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
      const dateStr = d.toISOString().slice(0, 10);
      const monthDay = d.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
      });

      // Authentic SOC variance: higher mid-week (Tue-Thu), realistic lull on Sun
      const dayFactor = isWeekend ? 0.65 : dayOfWeek === 3 || dayOfWeek === 4 ? 1.25 : 1.0;
      // Deterministic pseudo-random variation based on date
      const hash = (d.getFullYear() * 372 + (d.getMonth() + 1) * 31 + d.getDate()) % 13;
      const variation = ((hash - 6) / 10); // -0.6 to +0.6

      // Occasional campaign burst spikes (realistic incident waves)
      const isCampaignSpike = i === 4 || i === 12 || i === 23;
      const spikeBonus = isCampaignSpike ? 8 : 0;

      const baseScam = 14 * dayFactor + variation * 4 + spikeBonus;
      const baseSpam = 7 * dayFactor + variation * 2 + (isCampaignSpike ? 3 : 0);
      const baseHam = 38 * dayFactor + variation * 8;

      const scamCount = Math.max(4, Math.round(baseScam));
      const spamCount = Math.max(2, Math.round(baseSpam));
      const hamCount = Math.max(12, Math.round(baseHam));

      const gambling = Math.round(scamCount * 0.38);
      const prizeLures = Math.round(scamCount * 0.28);
      const bankPhishing = Math.round(scamCount * 0.18);
      const fakeJobs = Math.max(0, scamCount - gambling - prizeLures - bankPhishing);

      categoryTotals['General Spam'] += spamCount;
      categoryTotals.Gambling += gambling;
      categoryTotals['Prize Lures'] += prizeLures;
      categoryTotals['Bank Phishing'] += bankPhishing;
      categoryTotals['Fake Job Offers'] += fakeJobs;

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
          'General Spam': spamCount,
          Gambling: gambling,
          'Prize Lures': prizeLures,
          'Bank Phishing': bankPhishing,
          'Fake Job Offers': fakeJobs,
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
