import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  AccessRequest,
  AccessRequestStatus,
  AccessRequestTier,
  AuditEventType,
  LicenseStatus,
  OrganizationMemberRole,
  Prisma,
} from '@prisma/client';

import { PrismaService } from '../../database/prisma.service';
import { activeLicenseWhere } from '../access-control/workspace-access.service';
import { AuditService } from '../audit/audit.service';
import { AccessRequestsService } from './access-requests.service';
import {
  assertNoOtherOpenRequest,
  reapplyCooldownDays,
  WITHDRAWABLE_STATUSES,
} from './application-rules';
import type { SubmitApplicationDto } from './dto/submit-application.dto';
import {
  AGREEMENT_VERSION,
  LICENSE_SCOPES,
  formatReference,
} from './license-terms';

function refuse(
  status: 'forbidden' | 'conflict',
  code: string,
  message: string,
): never {
  const body = {
    statusCode: status === 'forbidden' ? 403 : 409,
    code,
    message,
  };
  throw status === 'forbidden'
    ? new ForbiddenException(body)
    : new ConflictException(body);
}

/**
 * Applications owned by a signed-in account (account-first lifecycle,
 * docs/backend/ACCESS_LIFECYCLE_AUDIT_2026-09-29.md §A.1-A.3). Every rule here
 * is enforced server-side; the web UI only mirrors it.
 */
@Injectable()
export class ApplicantRequestsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly accessRequests: AccessRequestsService,
    private readonly audit: AuditService,
  ) {}

  async submit(userId: string, dto: SubmitApplicationDto) {
    const details = { ...dto.organizationDetails };
    const record = await this.withSerializationRetry(() =>
      this.prisma.$transaction(
        async (tx) => {
          const user = await this.requireApplicant(tx, userId);
          await assertNoOtherOpenRequest(tx, { userId, email: user.email });
          await this.assertNotAlreadyActive(tx, userId, dto.tier);
          await this.assertNotLicenseSuspended(tx, userId);

          const previous = await tx.accessRequest.findFirst({
            where: { portalUserId: userId },
            orderBy: { createdAt: 'desc' },
            select: { id: true, status: true, declinedAt: true },
          });
          this.assertCooldownElapsed(previous);

          // Reuse the applicant's own active workspace so a renewal or
          // re-request reactivates it. Workspaces they merely belong to are
          // someone else's and are never linked.
          const ownedWorkspace = await tx.organizationMembership.findFirst({
            where: {
              userId,
              role: OrganizationMemberRole.SHIELD,
              organization: { isActive: true },
            },
            orderBy: { createdAt: 'desc' },
            select: { organizationId: true },
          });

          const created = await tx.accessRequest.create({
            data: {
              tier: dto.tier,
              fullName: dto.fullName.trim(),
              email: user.email,
              organization: dto.organization.trim(),
              applicantRole: dto.applicantRole.trim(),
              intendedUse: dto.intendedUse.trim(),
              reason: dto.reason.trim(),
              expectedUsers: dto.expectedUsers,
              details,
              accuracyConfirmedAt: new Date(),
              productUpdatesOptIn: dto.productUpdatesOptIn ?? false,
              pilotInterest: dto.pilotInterest ?? false,
              portalUserId: userId,
              portalOrganizationId: ownedWorkspace?.organizationId ?? null,
              previousAccessRequestId: previous?.id ?? null,
            },
          });
          await this.audit.record(
            {
              type: AuditEventType.APPLICATION_SUBMITTED,
              actorUserId: userId,
              targetUserId: userId,
              accessRequestId: created.id,
              organizationId: ownedWorkspace?.organizationId ?? null,
              metadata: {
                tier: dto.tier,
                returningApplicant: Boolean(previous),
                previousAccessRequestId: previous?.id ?? null,
              },
            },
            tx,
          );
          return created;
        },
        { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
      ),
    );
    const confirmationEmailSent =
      await this.accessRequests.deliverSubmissionReceipt(record);
    return { ...this.present(record), confirmationEmailSent };
  }

  async list(userId: string) {
    const rows = await this.prisma.accessRequest.findMany({
      where: { portalUserId: userId },
      orderBy: { createdAt: 'desc' },
      take: 50,
      include: {
        license: {
          select: {
            tier: true,
            status: true,
            validFrom: true,
            validUntil: true,
          },
        },
      },
    });
    return rows.map((row) => ({
      ...this.present(row),
      license: row.license
        ? {
            tier: row.license.tier.toLowerCase(),
            status: row.license.status,
            validFrom: row.license.validFrom.toISOString(),
            validUntil: row.license.validUntil?.toISOString() ?? null,
          }
        : null,
    }));
  }

  /*
   * Safe, still-relevant facts from the latest request. Purpose statements,
   * use cases, and durations are deliberately left out: the applicant must
   * restate them rather than silently re-submit old claims as current.
   */
  async prefill(userId: string) {
    const [user, previous] = await Promise.all([
      this.prisma.user.findUnique({
        where: { id: userId },
        select: {
          email: true,
          firstName: true,
          lastName: true,
          company: true,
        },
      }),
      this.prisma.accessRequest.findFirst({
        where: { portalUserId: userId },
        orderBy: { createdAt: 'desc' },
      }),
    ]);
    if (!user) throw new NotFoundException('Account not found.');
    const profileName = [user.firstName, user.lastName]
      .filter(Boolean)
      .join(' ');
    const details = (previous?.details ?? {}) as Record<string, unknown>;
    return {
      email: user.email,
      previous: previous
        ? {
            id: previous.id,
            reference: formatReference(
              previous.referenceNumber,
              previous.createdAt,
            ),
            tier: previous.tier.toLowerCase(),
            status: previous.status.toLowerCase(),
            submittedAt: previous.createdAt.toISOString(),
          }
        : null,
      fields: {
        tier: previous?.tier.toLowerCase() ?? null,
        fullName: previous?.fullName ?? (profileName || null),
        organization: previous?.organization ?? user.company ?? null,
        applicantRole: previous?.applicantRole ?? null,
        expectedUsers: previous?.expectedUsers ?? null,
        research: null,
        organizationDetails:
          previous?.tier === AccessRequestTier.SHIELD
            ? {
                website: stringOrNull(details.website),
                contactPerson: stringOrNull(details.contactPerson),
              }
            : null,
      },
    };
  }

  async withdraw(userId: string, id: string) {
    return this.prisma.$transaction(async (tx) => {
      const moved = await tx.accessRequest.updateMany({
        where: {
          id,
          portalUserId: userId,
          status: { in: WITHDRAWABLE_STATUSES },
        },
        data: {
          status: AccessRequestStatus.WITHDRAWN,
          withdrawnAt: new Date(),
        },
      });
      if (moved.count !== 1) {
        throw new BadRequestException(
          'Only your own request can be withdrawn, and only before payment starts.',
        );
      }
      await tx.accessRequestToken.updateMany({
        where: { accessRequestId: id, usedAt: null },
        data: { expiresAt: new Date(0) },
      });
      await this.audit.record(
        {
          type: AuditEventType.APPLICATION_WITHDRAWN,
          actorUserId: userId,
          targetUserId: userId,
          accessRequestId: id,
        },
        tx,
      );
      const updated = await tx.accessRequest.findUniqueOrThrow({
        where: { id },
      });
      return this.present(updated);
    });
  }

  /* APPROVED → AGREEMENT_ACCEPTED for the owner of the request. */
  async acceptAgreement(userId: string, id: string, agreementVersion: string) {
    if (agreementVersion !== AGREEMENT_VERSION) {
      refuse(
        'conflict',
        'AGREEMENT_VERSION_CHANGED',
        'The license terms have been updated. Reload the page to review the current version.',
      );
    }
    const record = await this.findOwned(userId, id);
    if (
      record.status === AccessRequestStatus.AGREEMENT_ACCEPTED &&
      record.agreementVersion === agreementVersion
    ) {
      return this.present(record);
    }
    const accepted = await this.prisma.accessRequest.updateMany({
      where: {
        id,
        portalUserId: userId,
        status: AccessRequestStatus.APPROVED,
      },
      data: {
        status: AccessRequestStatus.AGREEMENT_ACCEPTED,
        agreementAcceptedAt: new Date(),
        agreementVersion,
      },
    });
    if (accepted.count !== 1) {
      throw new BadRequestException(
        'This request is not awaiting license acceptance.',
      );
    }
    return this.present(await this.findOwned(userId, id));
  }

  /** Ownership-scoped lookup; a foreign or unknown id is simply not found. */
  async findOwned(userId: string, id: string): Promise<AccessRequest> {
    const record = await this.prisma.accessRequest.findFirst({
      where: { id, portalUserId: userId },
    });
    if (!record) throw new NotFoundException('Access request not found.');
    return record;
  }

  present(record: AccessRequest) {
    return {
      id: record.id,
      reference: formatReference(record.referenceNumber, record.createdAt),
      tier: record.tier.toLowerCase() as 'research' | 'organization',
      status: record.status.toLowerCase(),
      submittedAt: record.createdAt.toISOString(),
      fullName: record.fullName,
      organization: record.organization,
      applicantRole: record.applicantRole,
      intendedUse: record.intendedUse,
      reason: record.reason,
      expectedUsers: record.expectedUsers,
      details: record.details,
      // The reviewer's question is meant for the applicant; the decline
      // reason may hold internal notes and is not exposed.
      infoRequestedAt: record.infoRequestedAt?.toISOString() ?? null,
      infoRequestMessage: record.infoRequestMessage,
      approvedAt: record.approvedAt?.toISOString() ?? null,
      declinedAt: record.declinedAt?.toISOString() ?? null,
      withdrawnAt: record.withdrawnAt?.toISOString() ?? null,
      agreementAcceptedAt: record.agreementAcceptedAt?.toISOString() ?? null,
      agreementVersion: record.agreementVersion,
      currentAgreementVersion: AGREEMENT_VERSION,
      scope: LICENSE_SCOPES[record.tier],
      billingPeriod: record.billingPeriod,
      activatedAt: record.activatedAt?.toISOString() ?? null,
      returningApplicant: Boolean(record.previousAccessRequestId),
    };
  }

  private async requireApplicant(tx: Prisma.TransactionClient, userId: string) {
    const user = await tx.user.findUnique({
      where: { id: userId },
      select: {
        email: true,
        webRole: true,
        portalAccessStatus: true,
        emailVerifiedAt: true,
        onboardingStatus: true,
      },
    });
    if (!user || user.webRole !== 'SHIELD' || !user.email) {
      refuse(
        'forbidden',
        'ACCOUNT_NOT_ELIGIBLE',
        'This account cannot request access.',
      );
    }
    if (user.portalAccessStatus !== 'ACTIVE') {
      refuse(
        'forbidden',
        'ACCOUNT_RESTRICTED',
        'This account is restricted. Contact support.',
      );
    }
    if (!user.emailVerifiedAt) {
      refuse('forbidden', 'EMAIL_NOT_VERIFIED', 'Verify your email first.');
    }
    if (user.onboardingStatus !== 'COMPLETE') {
      refuse(
        'forbidden',
        'SETUP_REQUIRED',
        'Finish account setup before requesting access.',
      );
    }
    return { email: user.email };
  }

  private async assertNotAlreadyActive(
    tx: Prisma.TransactionClient,
    userId: string,
    tier: AccessRequestTier,
  ) {
    const active = await tx.license.findFirst({
      where: {
        ...activeLicenseWhere(new Date()),
        tier,
        organization: {
          isActive: true,
          members: {
            some: { userId, role: OrganizationMemberRole.SHIELD },
          },
        },
      },
      select: { id: true },
    });
    if (active) {
      refuse(
        'conflict',
        'ALREADY_ACTIVE',
        `You already hold active ${tier.toLowerCase()} access.`,
      );
    }
  }

  /*
   * A billing or administrative suspension is not an expiry: it is resolved
   * through support or payment, not by filing another request.
   */
  private async assertNotLicenseSuspended(
    tx: Prisma.TransactionClient,
    userId: string,
  ) {
    const now = new Date();
    const latest = await tx.license.findFirst({
      where: {
        organization: {
          members: { some: { userId, role: OrganizationMemberRole.SHIELD } },
        },
      },
      orderBy: { validFrom: 'desc' },
      select: { status: true, validUntil: true },
    });
    const suspended =
      latest &&
      (latest.status === LicenseStatus.SUSPENDED ||
        latest.status === LicenseStatus.PAST_DUE) &&
      (!latest.validUntil || latest.validUntil > now);
    if (suspended) {
      refuse(
        'forbidden',
        'LICENSE_SUSPENDED',
        'Your current license is suspended. Resolve it before requesting access again.',
      );
    }
  }

  private assertCooldownElapsed(
    previous: { status: AccessRequestStatus; declinedAt: Date | null } | null,
  ) {
    const days = reapplyCooldownDays();
    if (
      !days ||
      previous?.status !== AccessRequestStatus.DECLINED ||
      !previous.declinedAt
    ) {
      return;
    }
    const eligibleAt = new Date(
      previous.declinedAt.getTime() + days * 86_400_000,
    );
    if (eligibleAt > new Date()) {
      refuse(
        'conflict',
        'REAPPLY_COOLDOWN',
        `You can submit a new request after ${eligibleAt.toISOString().slice(0, 10)}.`,
      );
    }
  }

  private async withSerializationRetry<T>(work: () => Promise<T>): Promise<T> {
    for (let attempt = 0; attempt < 3; attempt += 1) {
      try {
        return await work();
      } catch (error) {
        if ((error as { code?: string }).code !== 'P2034' || attempt === 2) {
          throw error;
        }
      }
    }
    throw new Error('Unreachable serialization retry state.');
  }
}

function stringOrNull(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value : null;
}
