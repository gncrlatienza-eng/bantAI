import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { AuditEventType, Prisma, ShieldReviewDecision } from '@prisma/client';

import { PrismaService } from '../../database/prisma.service';
import { formatReference } from '../access-requests/license-terms';
import { AuditService } from '../audit/audit.service';
import { ReviewLegacyLicenseDto } from './dto/review-legacy-license.dto';

@Injectable()
export class LegacyLicenseReviewService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  /**
   * Historical licenses awaiting a contract decision, with the account and
   * request they belong to so a reviewer cannot act on the wrong subscriber
   * (manual QA 2026-10-01, F6).
   */
  async list() {
    const rows = await this.prisma.license.findMany({
      where: { legacyTier: { not: null } },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        organizationId: true,
        accessRequestId: true,
        legacyTier: true,
        status: true,
        validFrom: true,
        validUntil: true,
        shieldReviewDecision: true,
        shieldReviewedAt: true,
        shieldReviewedByUserId: true,
        shieldReviewReason: true,
        shieldApprovedAt: true,
        organization: { select: { name: true } },
        accessRequest: {
          select: {
            email: true,
            fullName: true,
            referenceNumber: true,
            createdAt: true,
          },
        },
      },
    });
    return rows.map(({ organization, accessRequest, ...license }) => ({
      ...license,
      organizationName: organization.name,
      accountEmail: accessRequest.email,
      applicantName: accessRequest.fullName,
      requestReference: formatReference(
        accessRequest.referenceNumber,
        accessRequest.createdAt,
      ),
    }));
  }

  async review(
    licenseId: string,
    actorUserId: string,
    dto: ReviewLegacyLicenseDto,
  ) {
    if (dto.decision === ShieldReviewDecision.PENDING) {
      throw new BadRequestException('A final review decision is required.');
    }
    const reason = dto.reason.trim();
    const evidenceReference = dto.evidenceReference.trim();
    if (reason.length < 15 || evidenceReference.length < 5) {
      throw new BadRequestException(
        'A reason and contract evidence reference are required.',
      );
    }
    const reviewedAt = new Date();
    return this.prisma.$transaction(
      async (tx) => {
        const existing = await tx.license.findUnique({
          where: { id: licenseId },
          select: {
            id: true,
            legacyTier: true,
            shieldReviewDecision: true,
            organizationId: true,
            accessRequestId: true,
          },
        });
        if (!existing) throw new NotFoundException('License not found.');
        if (!existing.legacyTier) {
          throw new BadRequestException(
            'Only legacy licenses require reconciliation.',
          );
        }
        if (existing.shieldReviewDecision === dto.decision) {
          throw new ConflictException(
            'This license already has that review decision.',
          );
        }
        const moved = await tx.license.updateMany({
          where: {
            id: licenseId,
            shieldReviewDecision: existing.shieldReviewDecision,
          },
          data: {
            shieldReviewDecision: dto.decision,
            shieldApprovedAt:
              dto.decision === ShieldReviewDecision.APPROVED
                ? reviewedAt
                : null,
            shieldReviewedAt: reviewedAt,
            shieldReviewedByUserId: actorUserId,
            shieldReviewReason: reason,
          },
        });
        if (moved.count !== 1) {
          throw new ConflictException(
            'License review changed; reload and try again.',
          );
        }
        await this.audit.record(
          {
            type: AuditEventType.LICENSE_SHIELD_REVIEWED,
            actorUserId,
            licenseId,
            organizationId: existing.organizationId,
            accessRequestId: existing.accessRequestId,
            metadata: {
              from: existing.shieldReviewDecision,
              to: dto.decision,
              legacyTier: existing.legacyTier,
              evidenceReference,
              reason,
            },
          },
          tx,
        );
        return {
          licenseId,
          decision: dto.decision,
          reviewedAt,
          shieldApprovedAt:
            dto.decision === ShieldReviewDecision.APPROVED ? reviewedAt : null,
        };
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    );
  }
}
