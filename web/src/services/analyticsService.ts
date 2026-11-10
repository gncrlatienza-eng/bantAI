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
  const multiplier =
    range === 'today'
      ? 0.06
      : range === '7d'
        ? 0.25
        : range === '14d'
          ? 0.5
          : range === '90d'
            ? 3.0
            : 1.0;

  // Exact target totals matching getDevMockSummary(range)
  const targetScam = Math.round(4120 * multiplier);
  const targetSpam = Math.round(3210 * multiplier);
  const targetHam = Math.round(5150 * multiplier);
  const targetTotal = Math.round(12480 * multiplier);

  // Exact category targets matching Threats by Category
  const targetGambling = Math.round(1854 * multiplier);
  const targetPrizeLures = Math.round(1154 * multiplier);
  const targetFakeJobs = Math.round(618 * multiplier);
  const targetBankPhishing = Math.max(
    0,
    targetScam - targetGambling - targetPrizeLures - targetFakeJobs,
  );

  const categories = [
    'General Spam',
    'Gambling',
    'Prize Lures',
    'Bank Phishing',
    'Fake Job Offers',
  ];

  const categoryTotals: Record<string, number> = {
    'General Spam': targetSpam,
    Gambling: targetGambling,
    'Prize Lures': targetPrizeLures,
    'Bank Phishing': targetBankPhishing,
    'Fake Job Offers': targetFakeJobs,
  };

  const isWeekly = interval === 'week' || range === '90d';
  const numPoints =
    range === 'today'
      ? 6
      : range === '7d'
        ? 7
        : range === '14d'
          ? 14
          : isWeekly
            ? 13
            : 30;

  const now = new Date();
  const timeline: TrendPeriodItem[] = [];

  if (range === 'today') {
    const hours = ['00:00', '04:00', '08:00', '12:00', '16:00', '20:00'];
    const hourlyWeights = [0.08, 0.04, 0.18, 0.28, 0.26, 0.16];
    let scamAcc = 0;
    let spamAcc = 0;
    let hamAcc = 0;

    hours.forEach((h, idx) => {
      const isLast = idx === hours.length - 1;
      const scamCount = isLast
        ? targetScam - scamAcc
        : Math.round(targetScam * hourlyWeights[idx]);
      const spamCount = isLast
        ? targetSpam - spamAcc
        : Math.round(targetSpam * hourlyWeights[idx]);
      const hamCount = isLast
        ? targetHam - hamAcc
        : Math.round(targetHam * hourlyWeights[idx]);

      scamAcc += scamCount;
      spamAcc += spamCount;
      hamAcc += hamCount;

      const gambling = Math.round(scamCount * 0.45);
      const prizeLures = Math.round(scamCount * 0.28);
      const fakeJobs = Math.round(scamCount * 0.15);
      const bankPhishing = Math.max(
        0,
        scamCount - gambling - prizeLures - fakeJobs,
      );

      timeline.push({
        date: h,
        label: h,
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
    });
  } else if (isWeekly) {
    // 90D Weekly: 13 weekly points spanning August to November
    const weights: number[] = [];
    for (let i = 0; i < numPoints; i++) {
      const seed = i * 37 + 101;
      const noise = deterministicNoise(seed) * 0.18;
      const wave =
        0.25 *
        Math.exp(
          -Math.pow(i - numPoints * 0.7, 2) / (numPoints * 0.15 + 2),
        );
      weights.push(Math.max(0.4, 1.0 + noise + wave));
    }
    const weightSum = weights.reduce((a, b) => a + b, 0);

    let scamAcc = 0;
    let spamAcc = 0;
    let hamAcc = 0;

    for (let i = 0; i < numPoints; i++) {
      const isLast = i === numPoints - 1;
      const wDaysAgo = (numPoints - 1 - i) * 7;
      const d = new Date(now.getTime() - wDaysAgo * 86400000);
      const dateStr = d.toISOString().slice(0, 10);
      const monthDay = d.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
      });

      const scamCount = isLast
        ? targetScam - scamAcc
        : Math.round((weights[i] / weightSum) * targetScam);
      const spamCount = isLast
        ? targetSpam - spamAcc
        : Math.round((weights[i] / weightSum) * targetSpam);
      const hamCount = isLast
        ? targetHam - hamAcc
        : Math.round((weights[i] / weightSum) * targetHam);

      scamAcc += scamCount;
      spamAcc += spamCount;
      hamAcc += hamCount;

      const gambling = Math.round(scamCount * 0.45);
      const prizeLures = Math.round(scamCount * 0.28);
      const fakeJobs = Math.round(scamCount * 0.15);
      const bankPhishing = Math.max(
        0,
        scamCount - gambling - prizeLures - fakeJobs,
      );

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
  } else {
    // 7D, 14D, 30D Daily
    const weekdayWeights = [0.65, 0.95, 1.25, 1.3, 1.15, 0.9, 0.7]; // Sun(0) to Sat(6)
    const weights: number[] = [];

    for (let i = numPoints - 1; i >= 0; i--) {
      const d = new Date(now.getTime() - i * 86400000);
      const dayOfWeek = d.getDay();
      const dayFactor = weekdayWeights[dayOfWeek];
      const seed =
        (d.getFullYear() * 10000 + (d.getMonth() + 1) * 31 + d.getDate()) *
          19 +
        i * 37;
      const noise = deterministicNoise(seed) * 0.22;
      const wave = 0.3 * Math.exp(-Math.pow(i - 6, 2) / 8);
      weights.push(Math.max(0.35, dayFactor + noise + wave));
    }

    const weightSum = weights.reduce((a, b) => a + b, 0);
    let scamAcc = 0;
    let spamAcc = 0;
    let hamAcc = 0;

    for (let i = 0; i < numPoints; i++) {
      const isLast = i === numPoints - 1;
      const daysAgo = numPoints - 1 - i;
      const d = new Date(now.getTime() - daysAgo * 86400000);
      const dateStr = d.toISOString().slice(0, 10);
      const monthDay = d.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
      });

      const scamCount = isLast
        ? targetScam - scamAcc
        : Math.round((weights[i] / weightSum) * targetScam);
      const spamCount = isLast
        ? targetSpam - spamAcc
        : Math.round((weights[i] / weightSum) * targetSpam);
      const hamCount = isLast
        ? targetHam - hamAcc
        : Math.round((weights[i] / weightSum) * targetHam);

      scamAcc += scamCount;
      spamAcc += spamCount;
      hamAcc += hamCount;

      const gambling = Math.round(scamCount * 0.45);
      const prizeLures = Math.round(scamCount * 0.28);
      const fakeJobs = Math.round(scamCount * 0.15);
      const bankPhishing = Math.max(
        0,
        scamCount - gambling - prizeLures - fakeJobs,
      );

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
    interval: isWeekly ? 'week' : 'day',
    startDate: timeline[0]?.date || now.toISOString(),
    endDate: timeline[timeline.length - 1]?.date || now.toISOString(),
    categories,
    categoryTotals,
    totals: {
      scam: targetScam,
      spam: targetSpam,
      ham: targetHam,
      total: targetTotal,
    },
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
