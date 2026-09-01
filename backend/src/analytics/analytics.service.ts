import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';

@Injectable()
export class AnalyticsService {
  constructor(private prisma: PrismaService) {}

  async getSummary() {
    const [totalMessages, classificationGroups, alertGroups, totalReports] =
      await Promise.all([
        this.prisma.smsMessage.count(),
        this.prisma.classification.groupBy({
          by: ['label'],
          _count: { label: true },
        }),
        this.prisma.alert.groupBy({
          by: ['status'],
          _count: { status: true },
        }),
        this.prisma.userReport.count(),
      ]);

    const classificationsByLabel = Object.fromEntries(
      classificationGroups.map((g) => [g.label, g._count.label]),
    );

    const alertsByStatus = Object.fromEntries(
      alertGroups.map((g) => [g.status, g._count.status]),
    );

    return {
      totalMessages,
      classificationsByLabel,
      alertsByStatus,
      totalReports,
    };
  }
}
