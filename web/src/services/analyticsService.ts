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

// Deterministic pseudo-random float generator in range [-1, 1]
function deterministicNoise(seed: number): number {
  const x = Math.sin(seed * 12.9898 + 78.233) * 43758.5453;
  return (x - Math.floor(x)) * 2 - 1;
}

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
    // Authentic SOC telemetry: weekday volume curves, organic daily variance, and multi-day campaign waves
    const weekdayWeights = [0.65, 0.95, 1.25, 1.3, 1.15, 0.9, 0.7]; // Sun(0) to Sat(6)
    const wavePeaks = [6, 21, 39, 57, 76];

    for (let i = days - 1; i >= 0; i--) {
      const d = new Date(now.getTime() - i * 86400000);
      const dayOfWeek = d.getDay(); // 0 = Sun, 6 = Sat
      const dayFactor = weekdayWeights[dayOfWeek];
      const dateStr = d.toISOString().slice(0, 10);
      const monthDay = d.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
      });

      // Multi-day campaign surge (Gaussian bell curve over ~4 days per wave)
      let campaignSurge = 0;
      for (const peak of wavePeaks) {
        const dist = Math.abs(i - peak);
        if (dist <= 3) {
          campaignSurge += 10 * Math.exp(-(dist * dist) / 2.5);
        }
      }

      // Independent organic daily variation to prevent flat plateaus
      const seedBase =
        (d.getFullYear() * 10000 + (d.getMonth() + 1) * 31 + d.getDate()) * 19 +
        i * 37;
      const noiseScam = deterministicNoise(seedBase);
      const noiseSpam = deterministicNoise(seedBase + 313);
      const noiseHam = deterministicNoise(seedBase + 709);

      const baseScam = 13.5 * dayFactor + campaignSurge + noiseScam * 2.8;
      const baseSpam = 6.5 * dayFactor + campaignSurge * 0.4 + noiseSpam * 1.8;
      const baseHam = 38 * dayFactor + noiseHam * 5;

      const scamCount = Math.max(3, Math.round(baseScam));
      const spamCount = Math.max(2, Math.round(baseSpam));
      const hamCount = Math.max(10, Math.round(baseHam));

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
