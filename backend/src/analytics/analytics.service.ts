import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../database/prisma.service';

@Injectable()
export class AnalyticsService {
  constructor(private prisma: PrismaService) {}

  async getSummary(options?: { range?: string }) {
    const rangeStr = (options?.range || '').toLowerCase();
    let messageWhere: Prisma.SmsMessageWhereInput = { trusted: true };
    let classificationWhere: Prisma.ClassificationWhereInput = {
      message: { trusted: true },
    };
    let alertWhere: Prisma.AlertWhereInput = {
      message: { trusted: true },
    };
    let reportWhere: Prisma.UserReportWhereInput = {};

    if (rangeStr && rangeStr !== 'all') {
      const days =
        rangeStr === 'today'
          ? 1
          : rangeStr === '7d'
            ? 7
            : rangeStr === '14d'
              ? 14
              : rangeStr === '90d'
                ? 90
                : 30;
      const now = new Date();
      const startDate = new Date(
        Date.UTC(
          now.getUTCFullYear(),
          now.getUTCMonth(),
          now.getUTCDate() - (days - 1),
          0,
          0,
          0,
          0,
        ),
      );

      messageWhere = {
        trusted: true,
        receivedAt: { gte: startDate },
      };
      classificationWhere = {
        message: {
          trusted: true,
          receivedAt: { gte: startDate },
        },
      };
      alertWhere = {
        message: {
          trusted: true,
          receivedAt: { gte: startDate },
        },
      };
      reportWhere = {
        createdAt: { gte: startDate },
      };
    }

    const [totalMessages, classificationGroups, alertGroups, totalReports] =
      await Promise.all([
        this.prisma.smsMessage.count({ where: messageWhere }),
        this.prisma.classification.groupBy({
          by: ['label'],
          where: classificationWhere,
          _count: { label: true },
        }),
        this.prisma.alert.groupBy({
          by: ['status'],
          where: alertWhere,
          _count: { status: true },
        }),
        this.prisma.userReport.count({ where: reportWhere }),
      ]);

    const classificationsByLabel: Record<string, number> = {};
    for (const g of classificationGroups) {
      classificationsByLabel[g.label] = g._count.label;
    }

    const alertsByStatus: Record<string, number> = {};
    for (const g of alertGroups) {
      alertsByStatus[g.status] = g._count.status;
    }

    return {
      totalMessages,
      classificationsByLabel,
      alertsByStatus,
      totalReports,
    };
  }

  async getAdminThreatTrends(options?: { range?: string; interval?: string }) {
    const rangeStr = (options?.range || '30d').toLowerCase();
    const days =
      rangeStr === 'today'
        ? 1
        : rangeStr === '7d'
          ? 7
          : rangeStr === '14d'
            ? 14
            : rangeStr === '90d'
              ? 90
              : 30;
    const interval = options?.interval === 'week' ? 'week' : 'day';

    const now = new Date();
    const endDate = new Date(
      Date.UTC(
        now.getUTCFullYear(),
        now.getUTCMonth(),
        now.getUTCDate(),
        23,
        59,
        59,
        999,
      ),
    );
    const startDate = new Date(
      Date.UTC(
        now.getUTCFullYear(),
        now.getUTCMonth(),
        now.getUTCDate() - (days - 1),
        0,
        0,
        0,
        0,
      ),
    );

    const messages = await this.prisma.smsMessage.findMany({
      where: {
        trusted: true,
        receivedAt: {
          gte: startDate,
          lte: endDate,
        },
      },
      select: {
        receivedAt: true,
        classification: {
          select: {
            label: true,
          },
        },
        cluster: {
          select: {
            category: true,
            label: true,
          },
        },
      },
      orderBy: { receivedAt: 'asc' },
    });

    const categoryTotals: Record<string, number> = {};
    const totals = { scam: 0, spam: 0, ham: 0, total: 0 };

    // Initialize buckets
    const timeline: Array<{
      date: string;
      label: string;
      scam: number;
      spam: number;
      ham: number;
      total: number;
      byCategory: Record<string, number>;
    }> = [];

    if (days === 1) {
      for (let h = 0; h < 24; h += 4) {
        const hStr = `${String(h).padStart(2, '0')}:00`;
        timeline.push({
          date: hStr,
          label: hStr,
          scam: 0,
          spam: 0,
          ham: 0,
          total: 0,
          byCategory: {},
        });
      }
    } else if (interval === 'week') {
      const numWeeks = Math.ceil(days / 7);
      for (let w = 0; w < numWeeks; w++) {
        const wStart = new Date(startDate.getTime() + w * 7 * 86400000);
        const wEnd = new Date(
          Math.min(wStart.getTime() + 6 * 86400000, endDate.getTime()),
        );
        const startStr = wStart.toISOString().slice(5, 10);
        const endStr = wEnd.toISOString().slice(5, 10);
        timeline.push({
          date: wStart.toISOString().slice(0, 10),
          label: `${startStr} - ${endStr}`,
          scam: 0,
          spam: 0,
          ham: 0,
          total: 0,
          byCategory: {},
        });
      }
    } else {
      for (let d = 0; d < days; d++) {
        const cur = new Date(startDate.getTime() + d * 86400000);
        const dateStr = cur.toISOString().slice(0, 10);
        const monthDay = cur.toLocaleDateString('en-US', {
          month: 'short',
          day: 'numeric',
          timeZone: 'UTC',
        });
        timeline.push({
          date: dateStr,
          label: monthDay,
          scam: 0,
          spam: 0,
          ham: 0,
          total: 0,
          byCategory: {},
        });
      }
    }

    const bucketMap = new Map<string, (typeof timeline)[0]>();
    for (const item of timeline) {
      bucketMap.set(item.date, item);
    }

    for (const msg of messages) {
      const msgTime = new Date(msg.receivedAt).getTime();
      let targetBucket: (typeof timeline)[0] | undefined;

      if (days === 1) {
        const msgHour = new Date(msg.receivedAt).getUTCHours();
        const bucketIdx = Math.min(
          Math.max(0, Math.floor(msgHour / 4)),
          timeline.length - 1,
        );
        targetBucket = timeline[bucketIdx];
      } else if (interval === 'week') {
        const offsetDays = Math.floor(
          (msgTime - startDate.getTime()) / 86400000,
        );
        const weekIndex = Math.min(
          Math.max(0, Math.floor(offsetDays / 7)),
          timeline.length - 1,
        );
        targetBucket = timeline[weekIndex];
      } else {
        const dateKey = new Date(msg.receivedAt).toISOString().slice(0, 10);
        targetBucket = bucketMap.get(dateKey);
      }

      if (!targetBucket) continue;

      const label = msg.classification?.label;
      if (label === 'Scam') {
        targetBucket.scam += 1;
        totals.scam += 1;
      } else if (label === 'Spam') {
        targetBucket.spam += 1;
        totals.spam += 1;
      } else if (label === 'Ham') {
        targetBucket.ham += 1;
        totals.ham += 1;
      }
      targetBucket.total += 1;
      totals.total += 1;

      // Group scam and spam by category
      if (label === 'Scam' || label === 'Spam') {
        const cat =
          msg.cluster?.category?.trim() ||
          msg.cluster?.label?.trim() ||
          (label === 'Scam' ? 'Uncategorized Scam' : 'General Spam');

        targetBucket.byCategory[cat] = (targetBucket.byCategory[cat] || 0) + 1;
        categoryTotals[cat] = (categoryTotals[cat] || 0) + 1;
      }
    }

    const categories = Object.keys(categoryTotals).sort(
      (a, b) => categoryTotals[b] - categoryTotals[a],
    );

    return {
      range: `${days}d`,
      interval,
      startDate: startDate.toISOString(),
      endDate: endDate.toISOString(),
      categories,
      categoryTotals,
      totals,
      timeline,
    };
  }
}
