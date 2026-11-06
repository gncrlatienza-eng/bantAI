import { ConflictException, Injectable } from '@nestjs/common';
import { AuditEventType } from '@prisma/client';

import { PrismaService } from '../../database/prisma.service';
import { AuditService } from '../audit/audit.service';
import type { CompleteSetupDto } from './dto/complete-setup.dto';

/*
 * Version of the BantAI account Terms of Use and Privacy Notice accepted
 * during setup. Separate from the per-license agreement (AGREEMENT_VERSION),
 * which is accepted after approval.
 */
export const ACCOUNT_TERMS_VERSION = '2026-09';

@Injectable()
export class AccountSetupService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  async complete(userId: string, dto: CompleteSetupDto) {
    if (dto.acceptedTermsVersion !== ACCOUNT_TERMS_VERSION) {
      throw new ConflictException({
        statusCode: 409,
        code: 'TERMS_VERSION_CHANGED',
        message:
          'The account terms have been updated. Reload the page to review the current version.',
      });
    }
    const now = new Date();
    await this.prisma.$transaction(async (tx) => {
      // Pinned to an unfinished, verified web account so a replay cannot
      // rewrite a completed profile or skip email verification.
      const moved = await tx.user.updateMany({
        where: {
          id: userId,
          role: 'USER',
          onboardingStatus: { not: 'COMPLETE' },
          emailVerifiedAt: { not: null },
        },
        data: {
          firstName: dto.firstName,
          lastName: dto.lastName,
          company: dto.organization,
          onboardingStatus: 'COMPLETE',
          onboardingCompletedAt: now,
        },
      });
      if (moved.count !== 1) {
        throw new ConflictException({
          statusCode: 409,
          code: 'SETUP_NOT_PENDING',
          message: 'Account setup is not pending for this account.',
        });
      }
      await this.audit.record(
        {
          type: AuditEventType.ACCOUNT_SETUP_COMPLETED,
          actorUserId: userId,
          targetUserId: userId,
          metadata: { termsVersion: ACCOUNT_TERMS_VERSION },
        },
        tx,
      );
    });
  }
}
