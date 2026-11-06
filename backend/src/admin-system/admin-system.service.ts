import { Injectable } from '@nestjs/common';
import { AuditEventType } from '@prisma/client';

import { PrismaService } from '../../database/prisma.service';

@Injectable()
export class AdminSystemService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Recent audit events. Routine restricted-content reads (every Admin view
   * of reports or campaign members) are recorded but hidden by default so
   * decisions and access changes stay findable (manual QA 2026-10-01, F5).
   */
  getAuditEvents(
    options: { includeReads?: boolean; type?: AuditEventType } = {},
  ) {
    return this.prisma.auditEvent.findMany({
      where: options.type
        ? { type: options.type }
        : options.includeReads
          ? undefined
          : { type: { not: AuditEventType.RESTRICTED_MESSAGE_ACCESSED } },
      orderBy: { createdAt: 'desc' },
      take: 100,
      select: {
        id: true,
        type: true,
        actorUserId: true,
        targetUserId: true,
        organizationId: true,
        accessRequestId: true,
        licenseId: true,
        createdAt: true,
      },
    });
  }

  async getDatabaseStorage() {
    const [
      users,
      organizations,
      messages,
      classifications,
      alerts,
      campaigns,
      reports,
      tips,
      sizeRows,
    ] = await Promise.all([
      this.prisma.user.count(),
      this.prisma.portalOrganization.count(),
      this.prisma.smsMessage.count(),
      this.prisma.classification.count(),
      this.prisma.alert.count(),
      this.prisma.campaignCluster.count(),
      this.prisma.userReport.count(),
      this.prisma.safetyTip.count(),
      this.prisma.$queryRaw<Array<{ database_size: bigint }>>`
        SELECT pg_database_size(current_database()) AS database_size
      `,
    ]);

    return {
      measuredAt: new Date().toISOString(),
      databaseBytes: (sizeRows[0]?.database_size ?? 0n).toString(),
      rows: {
        users,
        organizations,
        messages,
        classifications,
        alerts,
        campaigns,
        reports,
        safetyTips: tips,
      },
    };
  }
}
