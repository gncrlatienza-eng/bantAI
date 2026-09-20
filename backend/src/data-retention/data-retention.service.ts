import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';

import { PrismaService } from '../../database/prisma.service';

const TELEMETRY_RETENTION_MS = 90 * 24 * 60 * 60 * 1000;
const SENDER_REPORT_RETENTION_MS = 90 * 24 * 60 * 60 * 1000;

@Injectable()
export class DataRetentionService {
  private readonly logger = new Logger(DataRetentionService.name);

  constructor(private readonly prisma: PrismaService) {}

  @Cron(CronExpression.EVERY_DAY_AT_3AM)
  async purgeExpiredData() {
    const now = Date.now();
    const telemetryBefore = new Date(now - TELEMETRY_RETENTION_MS);
    const reportBefore = new Date(now - SENDER_REPORT_RETENTION_MS);

    // Delete relational children before message rows because this project has
    // restrictive legacy foreign keys rather than universal DB cascades.
    const staleMessages = { receivedAt: { lt: telemetryBefore } };
    await this.prisma.$transaction(async (tx) => {
      await tx.explainableIndicator.deleteMany({
        where: { classification: { message: staleMessages } },
      });
      await tx.alert.deleteMany({ where: { message: staleMessages } });
      await tx.messageFeature.deleteMany({ where: { message: staleMessages } });
      await tx.classification.deleteMany({ where: { message: staleMessages } });
      await tx.userReport.deleteMany({ where: { message: staleMessages } });
      const affectedClusters = await tx.smsMessage.findMany({
        where: { ...staleMessages, clusterId: { not: null } },
        select: { clusterId: true },
      });
      await tx.smsMessage.deleteMany({ where: staleMessages });
      // Contacts are deleted on the next complete device snapshot or account
      // deletion. Removing a still-present contact merely because the user has
      // not opened the app in 90 days would be incorrect.
      await tx.senderReport.deleteMany({
        where: { createdAt: { lt: reportBefore } },
      });
      await tx.senderVerificationCache.deleteMany({
        where: { expiresAt: { lt: new Date() } },
      });
      const clusterIds = [
        ...new Set(
          affectedClusters.flatMap(({ clusterId }) =>
            clusterId ? [clusterId] : [],
          ),
        ),
      ];
      for (const clusterId of clusterIds) {
        const messageCount = await tx.smsMessage.count({
          where: { clusterId, trusted: true },
        });
        await tx.campaignCluster.update({
          where: { id: clusterId },
          data: { messageCount },
        });
      }
    });
    this.logger.log('Completed scheduled privacy-retention purge.');
  }
}
