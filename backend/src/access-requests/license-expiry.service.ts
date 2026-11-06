import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { AuditEventType, LicenseStatus } from '@prisma/client';

import { PrismaService } from '../../database/prisma.service';
import { AuditService } from '../audit/audit.service';

/*
 * Bookkeeping only. Authorization already denies a license the moment
 * validUntil passes (activeLicenseWhere compares against the clock on every
 * request); this job records the transition so the stored status, admin
 * views, and audit trail match reality even when Stripe sends no event.
 */
@Injectable()
export class LicenseExpiryService {
  private readonly logger = new Logger(LicenseExpiryService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  @Cron(CronExpression.EVERY_HOUR)
  async expireLapsedLicenses(now = new Date()): Promise<number> {
    const lapsed = await this.prisma.license.findMany({
      where: { status: LicenseStatus.ACTIVE, validUntil: { lte: now } },
      select: { id: true, organizationId: true, accessRequestId: true },
      take: 500,
    });
    let expired = 0;
    for (const license of lapsed) {
      await this.prisma.$transaction(async (tx) => {
        const moved = await tx.license.updateMany({
          where: {
            id: license.id,
            status: LicenseStatus.ACTIVE,
            validUntil: { lte: now },
          },
          data: { status: LicenseStatus.EXPIRED },
        });
        if (moved.count !== 1) return;
        expired += 1;
        await this.audit.record(
          {
            type: AuditEventType.LICENSE_EXPIRED,
            organizationId: license.organizationId,
            accessRequestId: license.accessRequestId,
            licenseId: license.id,
            metadata: { from: LicenseStatus.ACTIVE, via: 'validity-window' },
          },
          tx,
        );
      });
    }
    if (expired)
      this.logger.log(`Marked ${expired} lapsed license(s) expired.`);
    return expired;
  }
}
