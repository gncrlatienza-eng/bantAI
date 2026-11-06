import { createHash, randomBytes } from 'crypto';
import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import {
  AccessRequest,
  AccessRequestEmailDeliveryStatus,
  AccessRequestEmailKind,
  AccessRequestStatus,
  AccessRequestTier,
  AuditEventType,
  LicenseStatus,
  OrganizationMemberRole,
  Prisma,
} from '@prisma/client';
import { PrismaService } from '../../database/prisma.service';
import { AuditService } from '../audit/audit.service';
import {
  AGREEMENT_VERSION,
  LICENSE_SCOPES,
  formatReference,
} from './license-terms';
import { assertNoOtherOpenRequest } from './application-rules';
import { AccessRequestEmailService } from './access-request-email.service';
import { sanitizedEmailDeliveryCode } from './access-request-email.service';

const TOKEN_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 days for the applicant to act on approval

/* Typical manual review window quoted to applicants on submission. */
export const REVIEW_WINDOW_BUSINESS_DAYS = { min: 3, max: 5 } as const;

/*
 * Server-enforced lifecycle. Every transition below is a conditional
 * updateMany pinned to the allowed "from" states, so the browser can never
 * skip or reorder steps:
 *
 *   RECEIVED ─┬─> UNDER_REVIEW ─┬─> MORE_INFO_REQUIRED ─> (back to review)
 *             │                 ├─> APPROVED ─> AGREEMENT_ACCEPTED ─> PAYMENT_PENDING ─> ACTIVE
 *             └─────────────────┴─> DECLINED
 *
 * PAYMENT_PENDING → ACTIVE happens only in the verified Stripe webhook.
 */
const DECIDABLE_STATUSES: AccessRequestStatus[] = [
  AccessRequestStatus.RECEIVED,
  AccessRequestStatus.UNDER_REVIEW,
  AccessRequestStatus.MORE_INFO_REQUIRED,
];

const CANCELLABLE_REQUEST_STATUSES: AccessRequestStatus[] = [
  AccessRequestStatus.RECEIVED,
  AccessRequestStatus.UNDER_REVIEW,
  AccessRequestStatus.MORE_INFO_REQUIRED,
  AccessRequestStatus.APPROVED,
  AccessRequestStatus.AGREEMENT_ACCEPTED,
  AccessRequestStatus.PAYMENT_PENDING,
];

const DELETABLE_REQUEST_STATUSES: AccessRequestStatus[] = [
  AccessRequestStatus.DECLINED,
  AccessRequestStatus.CANCELLED,
  AccessRequestStatus.EXPIRED,
];

@Injectable()
export class AccessRequestsService {
  private readonly logger = new Logger(AccessRequestsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly email: AccessRequestEmailService,
    private readonly audit: AuditService,
  ) {}

  /*
   * Submission receipt for a stored request. Delivery failure never undoes the
   * submission: the request stays reviewable and the caller is told the
   * receipt failed instead of being nudged into a duplicate submission.
   */
  async deliverSubmissionReceipt(record: {
    id: string;
    email: string;
    fullName: string;
    tier: AccessRequestTier;
    referenceNumber: number;
    createdAt: Date;
  }): Promise<boolean> {
    try {
      await this.email.sendSubmissionReceipt({
        to: record.email,
        fullName: record.fullName,
        reference: formatReference(record.referenceNumber, record.createdAt),
        tier: record.tier,
        reviewWindowBusinessDays: REVIEW_WINDOW_BUSINESS_DAYS,
      });
      await this.recordEmailDelivery(
        record.id,
        AccessRequestEmailKind.SUBMISSION,
        true,
      );
      return true;
    } catch (error) {
      await this.recordEmailDelivery(
        record.id,
        AccessRequestEmailKind.SUBMISSION,
        false,
        error,
      );
      this.logger.warn(
        `Submission receipt delivery failed for access request ${record.id}: ${(error as Error).message}`,
      );
      return false;
    }
  }

  /* RECEIVED / MORE_INFO_REQUIRED → UNDER_REVIEW. */
  async startReview(id: string) {
    return this.transition(
      id,
      [AccessRequestStatus.RECEIVED, AccessRequestStatus.MORE_INFO_REQUIRED],
      { status: AccessRequestStatus.UNDER_REVIEW },
      'Only a received request, or one awaiting more information, can move to review.',
    );
  }

  /* RECEIVED / UNDER_REVIEW → MORE_INFO_REQUIRED, with the reviewer's
     question recorded for the applicant. */
  async requestMoreInfo(id: string, message: string) {
    return this.transition(
      id,
      [AccessRequestStatus.RECEIVED, AccessRequestStatus.UNDER_REVIEW],
      {
        status: AccessRequestStatus.MORE_INFO_REQUIRED,
        infoRequestedAt: new Date(),
        infoRequestMessage: message.trim(),
      },
      'More information can only be requested before a decision is made.',
    );
  }

  async list(params: { status?: AccessRequestStatus; take?: number }) {
    const rows = await this.prisma.accessRequest.findMany({
      where: params.status ? { status: params.status } : undefined,
      include: { emailDeliveries: true },
      orderBy: { createdAt: 'desc' },
      take: Math.min(params.take ?? 100, 200),
    });
    return rows.map((r) => this.presentAdmin(r));
  }

  async getForAdmin(id: string) {
    const row = await this.prisma.accessRequest.findUnique({
      where: { id },
      include: { emailDeliveries: true },
    });
    if (!row) throw new NotFoundException('Access request not found.');
    return {
      ...this.presentAdmin(row),
      applicantHistory: await this.applicantHistory(row),
    };
  }

  /*
   * Everything a reviewer needs to recognise a returning applicant: their
   * earlier requests and the licenses those produced. Matched by account,
   * or by email for legacy requests no account has claimed.
   */
  private async applicantHistory(row: AccessRequest) {
    const earlier = await this.prisma.accessRequest.findMany({
      where: {
        id: { not: row.id },
        ...(row.portalUserId
          ? { portalUserId: row.portalUserId }
          : { email: { equals: row.email, mode: 'insensitive' } }),
      },
      orderBy: { createdAt: 'desc' },
      take: 20,
      select: {
        id: true,
        referenceNumber: true,
        tier: true,
        status: true,
        organization: true,
        createdAt: true,
        declinedAt: true,
        activatedAt: true,
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
    return {
      returningApplicant: earlier.length > 0,
      requests: earlier.map((request) => ({
        id: request.id,
        reference: formatReference(request.referenceNumber, request.createdAt),
        tier: request.tier,
        status: request.status,
        organization: request.organization,
        submittedAt: request.createdAt.toISOString(),
        declinedAt: request.declinedAt?.toISOString() ?? null,
        activatedAt: request.activatedAt?.toISOString() ?? null,
        license: request.license
          ? {
              tier: request.license.tier,
              status: request.license.status,
              validFrom: request.license.validFrom.toISOString(),
              validUntil: request.license.validUntil?.toISOString() ?? null,
            }
          : null,
      })),
    };
  }

  async approve(id: string, adminUserId: string) {
    const token = randomBytes(32).toString('base64url');
    const tokenHash = this.hashToken(token);
    const expiresAt = new Date(Date.now() + TOKEN_TTL_MS);
    const updated = await this.withSerializationRetry(() =>
      this.prisma.$transaction(
        async (tx) => {
          const existing = await tx.accessRequest.findUnique({ where: { id } });
          if (!existing)
            throw new NotFoundException('Access request not found.');
          await assertNoOtherOpenRequest(tx, {
            userId: existing.portalUserId,
            email: existing.email,
            excludeId: existing.id,
          });
          const transitioned = await tx.accessRequest.updateMany({
            where: {
              id,
              status: {
                in: DECIDABLE_STATUSES,
              },
            },
            data: {
              status: AccessRequestStatus.APPROVED,
              approvedAt: new Date(),
              approvedBy: adminUserId,
              declinedAt: null,
              declinedReason: null,
            },
          });
          if (transitioned.count !== 1) {
            throw new BadRequestException(
              'Only a request that is still under review can be approved.',
            );
          }
          // Approval makes the applicant eligible to continue activation
          // (terms, payment). It grants no data access by itself.
          await this.audit.record(
            {
              type: AuditEventType.APPLICATION_APPROVED,
              actorUserId: adminUserId,
              targetUserId: existing.portalUserId,
              accessRequestId: id,
              metadata: { tier: existing.tier },
            },
            tx,
          );
          await tx.accessRequestToken.updateMany({
            where: { accessRequestId: id, usedAt: null },
            data: { expiresAt: new Date(0) },
          });
          await tx.accessRequestToken.create({
            data: { tokenHash, accessRequestId: id, expiresAt },
          });
          const record = await tx.accessRequest.findUnique({ where: { id } });
          if (!record) throw new NotFoundException('Access request not found.');
          return record;
        },
        { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
      ),
    );

    return this.deliverApproval(updated, token, expiresAt);
  }

  /* Reissues the private link when approval succeeded but SMTP delivery did
     not. Rotating the token means a delayed or leaked previous email cannot
     be used after the retry. */
  async resendApprovalEmail(id: string) {
    const token = randomBytes(32).toString('base64url');
    const tokenHash = this.hashToken(token);
    const expiresAt = new Date(Date.now() + TOKEN_TTL_MS);
    const updated = await this.prisma.$transaction(async (tx) => {
      const existing = await tx.accessRequest.findUnique({ where: { id } });
      if (!existing) throw new NotFoundException('Access request not found.');
      if (existing.status !== AccessRequestStatus.APPROVED) {
        throw new BadRequestException(
          'Approval email can only be resent before agreement acceptance or checkout.',
        );
      }
      await tx.accessRequestToken.updateMany({
        where: { accessRequestId: id, usedAt: null },
        data: { expiresAt: new Date(0) },
      });
      await tx.accessRequestToken.create({
        data: { tokenHash, accessRequestId: id, expiresAt },
      });
      return existing;
    });
    return this.deliverApproval(updated, token, expiresAt);
  }

  async decline(id: string, adminUserId: string, reason?: string) {
    return this.prisma.$transaction(async (tx) => {
      const existing = await tx.accessRequest.findUnique({ where: { id } });
      if (!existing) throw new NotFoundException('Access request not found.');
      const transitioned = await tx.accessRequest.updateMany({
        where: {
          id,
          status: {
            in: DECIDABLE_STATUSES,
          },
        },
        data: {
          status: AccessRequestStatus.DECLINED,
          declinedAt: new Date(),
          declinedReason: reason?.trim() || null,
        },
      });
      if (transitioned.count !== 1) {
        throw new BadRequestException(
          'Only a request that is still under review can be declined.',
        );
      }
      await this.audit.record(
        {
          type: AuditEventType.APPLICATION_DECLINED,
          actorUserId: adminUserId,
          targetUserId: existing.portalUserId,
          accessRequestId: id,
          metadata: { tier: existing.tier },
        },
        tx,
      );
      await tx.accessRequestToken.updateMany({
        where: { accessRequestId: id, usedAt: null },
        data: { expiresAt: new Date(0) },
      });
      const updated = await tx.accessRequest.findUnique({ where: { id } });
      if (!updated) throw new NotFoundException('Access request not found.');
      return this.presentAdmin(updated);
    });
  }

  async getPaymentLifecycleRecord(id: string) {
    const record = await this.prisma.accessRequest.findUnique({
      where: { id },
      include: { license: true },
    });
    if (!record) throw new NotFoundException('Access request not found.');
    return record;
  }

  async cancelUnpaid(id: string, adminUserId: string, reason: string) {
    return this.withSerializationRetry(() =>
      this.prisma.$transaction(
        async (tx) => {
          const existing = await tx.accessRequest.findUnique({
            where: { id },
            include: { license: true },
          });
          if (!existing)
            throw new NotFoundException('Access request not found.');
          if (existing.license || existing.activatedAt) {
            throw new ConflictException(
              'An activated account cannot be cancelled as an application. Suspend or revoke the portal account instead.',
            );
          }
          const moved = await tx.accessRequest.updateMany({
            where: { id, status: { in: CANCELLABLE_REQUEST_STATUSES } },
            data: {
              status: AccessRequestStatus.CANCELLED,
              cancelledAt: new Date(),
              cancelledBy: adminUserId,
              cancelledReason: reason.trim(),
            },
          });
          if (moved.count !== 1) {
            throw new BadRequestException(
              'Only an unpaid request that has not reached a terminal state can be cancelled.',
            );
          }
          await tx.accessRequestToken.updateMany({
            where: { accessRequestId: id, usedAt: null },
            data: { expiresAt: new Date(0) },
          });
          const updated = await tx.accessRequest.findUniqueOrThrow({
            where: { id },
          });
          return this.presentAdmin(updated);
        },
        { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
      ),
    );
  }

  async deleteTerminal(id: string, adminUserId: string, reason: string) {
    return this.withSerializationRetry(() =>
      this.prisma.$transaction(
        async (tx) => {
          const existing = await tx.accessRequest.findUnique({
            where: { id },
            include: { license: true },
          });
          if (!existing)
            throw new NotFoundException('Access request not found.');
          if (!DELETABLE_REQUEST_STATUSES.includes(existing.status)) {
            throw new BadRequestException(
              'Only declined, cancelled, or expired requests can be deleted.',
            );
          }
          if (
            existing.license ||
            existing.portalUserId ||
            existing.portalOrganizationId ||
            existing.activatedAt
          ) {
            throw new ConflictException(
              'This request is linked to an account or license and cannot be deleted. Revoke the portal account instead.',
            );
          }
          await tx.accessRequestDeletionAudit.create({
            data: {
              accessRequestId: existing.id,
              referenceNumber: existing.referenceNumber,
              tier: existing.tier,
              terminalStatus: existing.status,
              emailHash: createHash('sha256')
                .update(existing.email.trim().toLowerCase())
                .digest('hex'),
              deletedBy: adminUserId,
              reason: reason.trim(),
            },
          });
          await tx.accessRequest.delete({ where: { id } });
          return {
            deleted: true as const,
            id: existing.id,
            reference: formatReference(
              existing.referenceNumber,
              existing.createdAt,
            ),
          };
        },
        { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
      ),
    );
  }

  async findApprovedByToken(token: string) {
    const { record } = await this.resolveToken(token, { requireUnused: false });
    return this.presentApplicant(record);
  }

  /*
   * APPROVED → AGREEMENT_ACCEPTED. Keyed by the (still unused) approval
   * token, which checkout later consumes. The applicant must echo the terms
   * version they were shown; a mismatch means the page is stale.
   * Idempotent: re-accepting the same version is a no-op.
   */
  async acceptAgreement(token: string, agreementVersion: string) {
    if (agreementVersion !== AGREEMENT_VERSION) {
      throw new ConflictException(
        'The license terms have been updated. Reload the page to review the current version.',
      );
    }
    const { record } = await this.resolveToken(token, { requireUnused: true });
    if (
      record.status === AccessRequestStatus.AGREEMENT_ACCEPTED &&
      record.agreementVersion === agreementVersion
    ) {
      return this.presentApplicant(record);
    }
    const accepted = await this.prisma.accessRequest.updateMany({
      where: { id: record.id, status: AccessRequestStatus.APPROVED },
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
    const updated = await this.prisma.accessRequest.findUniqueOrThrow({
      where: { id: record.id },
    });
    return this.presentApplicant(updated);
  }

  /*
   * Called by the payments service *only after* the Stripe SDK confirms it
   * has created a Checkout Session. Marks the token used and pins the
   * session id so a duplicate submit cannot mint another session.
   */
  async attachCheckoutSession(
    accessRequestId: string,
    stripeCheckoutSessionId: string,
    billingPeriod: 'MONTHLY' | 'ANNUAL',
  ) {
    const attached = await this.prisma.accessRequest.updateMany({
      where: {
        id: accessRequestId,
        // Payment only ever follows an accepted license agreement.
        status: AccessRequestStatus.AGREEMENT_ACCEPTED,
        stripeCheckoutSessionId: null,
      },
      data: {
        status: AccessRequestStatus.PAYMENT_PENDING,
        stripeCheckoutSessionId,
        billingPeriod,
      },
    });
    if (attached.count !== 1) {
      throw new BadRequestException(
        'This request is no longer eligible for checkout.',
      );
    }
  }

  /* Returns an unpaid, expired checkout to AGREEMENT_ACCEPTED so its owner
     can start a new session. Pinned to the exact expired session id. */
  async releaseExpiredCheckout(id: string, checkoutSessionId: string) {
    await this.prisma.accessRequest.updateMany({
      where: {
        id,
        status: AccessRequestStatus.PAYMENT_PENDING,
        stripeCheckoutSessionId: checkoutSessionId,
      },
      data: {
        status: AccessRequestStatus.AGREEMENT_ACCEPTED,
        stripeCheckoutSessionId: null,
      },
    });
  }

  /*
   * Idempotent activation used by the webhook after a payment success. Safe
   * to call multiple times: the where clause pins to PAYMENT_PENDING, and
   * activation-related fields are only overwritten if we're actually flipping
   * to ACTIVE.
   */
  async activateFromWebhook(params: {
    checkoutSessionId: string;
    expectedAccessRequestId?: string;
    stripeCustomerId?: string | null;
    stripeSubscriptionId?: string | null;
    stripeEventCreated?: number;
  }) {
    const result = await this.withSerializationRetry(() =>
      this.prisma.$transaction(
        async (tx) => {
          const request = await tx.accessRequest.findUnique({
            where: { stripeCheckoutSessionId: params.checkoutSessionId },
            include: { license: true },
          });
          if (!request) {
            throw new NotFoundException('Checkout session was not found.');
          }
          if (
            params.expectedAccessRequestId &&
            request.id !== params.expectedAccessRequestId
          ) {
            throw new BadRequestException(
              'The checkout session does not match its access request binding.',
            );
          }
          if (
            request.status === AccessRequestStatus.ACTIVE &&
            request.license
          ) {
            return {
              activated: false,
              organizationId: request.license.organizationId,
              accessRequestId: request.id,
              shieldReviewRequired: !request.license.shieldApprovedAt,
            };
          }
          if (request.status !== AccessRequestStatus.PAYMENT_PENDING) {
            return { activated: false };
          }

          // A returning applicant reactivates the workspace linked at
          // submission, so members, audit, and API history survive. A
          // workspace an administrator deactivated is never silently revived.
          const linkedWorkspace = request.portalOrganizationId
            ? await tx.portalOrganization.findUnique({
                where: { id: request.portalOrganizationId },
              })
            : null;
          const organization = linkedWorkspace?.isActive
            ? linkedWorkspace
            : await tx.portalOrganization.create({
                data: {
                  name: `${request.organization.trim()} (${request.id.slice(0, 8)})`,
                },
              });
          const now = new Date();
          const flipped = await tx.accessRequest.updateMany({
            where: {
              id: request.id,
              status: AccessRequestStatus.PAYMENT_PENDING,
            },
            data: {
              status: AccessRequestStatus.ACTIVE,
              activatedAt: now,
              portalOrganizationId: organization.id,
              stripeCustomerId: params.stripeCustomerId ?? undefined,
              stripeSubscriptionId: params.stripeSubscriptionId ?? undefined,
            },
          });
          if (flipped.count !== 1) return { activated: false };

          const license = await tx.license.upsert({
            where: { accessRequestId: request.id },
            create: {
              accessRequestId: request.id,
              organizationId: organization.id,
              tier: request.tier,
              legacyTier: request.legacyTier,
              // Billing alone cannot promote a pre-migration contract into Shield.
              shieldApprovedAt: request.legacyTier ? null : now,
              shieldReviewDecision: request.legacyTier ? 'PENDING' : 'APPROVED',
              shieldReviewedAt: request.legacyTier ? null : now,
              shieldReviewReason: request.legacyTier
                ? null
                : 'New Shield application approved through current workflow',
              status: LicenseStatus.ACTIVE,
              billingPeriod: request.billingPeriod!,
              stripeCustomerId: params.stripeCustomerId ?? undefined,
              stripeSubscriptionId: params.stripeSubscriptionId ?? undefined,
              validFrom: now,
              validUntil: request.expiresAt,
              lastStripeEventCreated: params.stripeEventCreated,
            },
            update: {
              status: LicenseStatus.ACTIVE,
              stripeCustomerId: params.stripeCustomerId ?? undefined,
              stripeSubscriptionId: params.stripeSubscriptionId ?? undefined,
              lastStripeEventCreated: params.stripeEventCreated,
            },
          });
          // Account-first: the applicant already exists, so ownership is
          // granted here instead of by a post-payment claim step.
          if (request.portalUserId) {
            await this.ensureWorkspaceOwner(
              tx,
              organization.id,
              request.portalUserId,
            );
          }
          await this.audit.record(
            {
              type: AuditEventType.LICENSE_ACTIVATED,
              targetUserId: request.portalUserId,
              organizationId: organization.id,
              accessRequestId: request.id,
              licenseId: license.id,
              metadata: {
                tier: request.tier,
                reusedWorkspace: Boolean(linkedWorkspace?.isActive),
              },
            },
            tx,
          );
          return {
            activated: true,
            organizationId: organization.id,
            accessRequestId: request.id,
            shieldReviewRequired: Boolean(request.legacyTier),
          };
        },
        { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
      ),
    );
    if (!result.activated || !result.accessRequestId) return result;
    if (result.shieldReviewRequired) return result;
    return {
      ...result,
      emailDelivery: await this.deliverActivation(result.accessRequestId),
    };
  }

  private async ensureWorkspaceOwner(
    tx: Prisma.TransactionClient,
    organizationId: string,
    userId: string,
  ) {
    const existing = await tx.organizationMembership.findUnique({
      where: { organizationId_userId: { organizationId, userId } },
      select: { id: true },
    });
    if (existing) return;
    const otherOwner = await tx.organizationMembership.findFirst({
      where: { organizationId, role: OrganizationMemberRole.SHIELD },
      select: { userId: true },
    });
    if (otherOwner) {
      // Never reassign someone else's workspace from a webhook.
      this.logger.warn(
        `Workspace ${organizationId} already has an owner; not adding ${userId}.`,
      );
      return;
    }
    await tx.organizationMembership.create({
      data: { organizationId, userId, role: OrganizationMemberRole.SHIELD },
    });
    await this.audit.record(
      {
        type: AuditEventType.MEMBER_ADDED,
        targetUserId: userId,
        organizationId,
        metadata: { role: OrganizationMemberRole.SHIELD, via: 'activation' },
      },
      tx,
    );
  }

  async resendActivationEmail(id: string) {
    const request = await this.prisma.accessRequest.findUnique({
      where: { id },
      select: { id: true, status: true, activatedAt: true },
    });
    if (!request) throw new NotFoundException('Access request not found.');
    if (request.status !== AccessRequestStatus.ACTIVE || !request.activatedAt) {
      throw new BadRequestException(
        'Activation email can only be resent for active paid access.',
      );
    }
    return this.deliverActivation(id);
  }

  async updateSubscriptionFromWebhook(params: {
    stripeSubscriptionId: string;
    status: LicenseStatus;
    stripeEventCreated: number;
    validUntil?: Date | null;
  }) {
    return this.prisma.$transaction(async (tx) => {
      const license = await tx.license.findUnique({
        where: { stripeSubscriptionId: params.stripeSubscriptionId },
      });
      if (!license) return { updated: false };
      if (
        license.lastStripeEventCreated !== null &&
        license.lastStripeEventCreated > params.stripeEventCreated
      ) {
        return { updated: false, stale: true };
      }
      await tx.license.update({
        where: { id: license.id },
        data: {
          status: params.status,
          validUntil: params.validUntil,
          lastStripeEventCreated: params.stripeEventCreated,
        },
      });
      // License state lives on the License only. The application stays
      // ACTIVE (= activated) so its history is never rewritten by billing.
      const auditType = licenseAuditType(license.status, params.status);
      if (auditType) {
        await this.audit.record(
          {
            type: auditType,
            organizationId: license.organizationId,
            accessRequestId: license.accessRequestId,
            licenseId: license.id,
            metadata: { from: license.status, to: params.status },
          },
          tx,
        );
      }
      return { updated: true };
    });
  }

  /**
   * Claims a webhook-activated license for an already verified portal user and
   * provisions its workspace owner membership atomically. Portal email-OTP
   * authentication owns user verification; this method never sends or checks
   * an OTP and therefore cannot affect the mobile/Semaphore flow.
   *
   * The caller must identify the paid request either by its Stripe Checkout
   * Session id or by the verified user's email. A checkout id is preferred
   * because it is unambiguous. Repeating the same successful claim is
   * idempotent, while attempts to claim another user's license are rejected.
   */
  async claimActivePaidAccess(params: {
    userId: string;
    email?: string;
    checkoutSessionId?: string;
  }) {
    const userId = params.userId.trim();
    const requestedEmail = params.email?.trim().toLowerCase();
    const checkoutSessionId = params.checkoutSessionId?.trim();
    if (!userId || (!requestedEmail && !checkoutSessionId)) {
      throw new BadRequestException(
        'A portal user and either an email or checkout session are required.',
      );
    }

    return this.withSerializationRetry(async () => {
      try {
        return await this.prisma.$transaction(
          async (tx) => {
            const user = await tx.user.findUnique({
              where: { id: userId },
              select: { id: true, email: true },
            });
            if (!user) throw new NotFoundException('Portal user not found.');

            const verifiedEmail = user.email?.trim().toLowerCase();
            if (!verifiedEmail) {
              throw new BadRequestException(
                'The portal user must have a verified email before claiming access.',
              );
            }
            if (requestedEmail && requestedEmail !== verifiedEmail) {
              throw new BadRequestException(
                'The access email does not match the verified portal user.',
              );
            }

            const accessRequest = await tx.accessRequest.findFirst({
              where: {
                ...(checkoutSessionId
                  ? { stripeCheckoutSessionId: checkoutSessionId }
                  : { email: verifiedEmail }),
                status: AccessRequestStatus.ACTIVE,
                activatedAt: { not: null },
              },
              orderBy: { activatedAt: 'desc' },
              include: { license: true },
            });
            if (!accessRequest) {
              throw new NotFoundException(
                'No active paid access was found for this portal account.',
              );
            }
            if (accessRequest.email.trim().toLowerCase() !== verifiedEmail) {
              throw new BadRequestException(
                'This paid access belongs to a different portal account.',
              );
            }
            if (
              !accessRequest.license ||
              accessRequest.license.status !== LicenseStatus.ACTIVE ||
              !accessRequest.license.shieldApprovedAt ||
              accessRequest.license.shieldReviewDecision !== 'APPROVED' ||
              accessRequest.license.validFrom > new Date() ||
              (accessRequest.license.validUntil &&
                accessRequest.license.validUntil <= new Date())
            ) {
              throw new BadRequestException(
                'This paid access is not currently licensed.',
              );
            }

            if (
              accessRequest.portalUserId &&
              accessRequest.portalUserId !== user.id
            ) {
              throw new ConflictException(
                'This paid access has already been claimed.',
              );
            }

            if (
              accessRequest.portalUserId === user.id &&
              accessRequest.portalOrganizationId
            ) {
              const membership = await tx.organizationMembership.findUnique({
                where: {
                  organizationId_userId: {
                    organizationId: accessRequest.portalOrganizationId,
                    userId: user.id,
                  },
                },
                select: {
                  id: true,
                  organizationId: true,
                  userId: true,
                  role: true,
                },
              });
              if (membership?.role === OrganizationMemberRole.SHIELD) {
                return {
                  accessRequestId: accessRequest.id,
                  organizationId: accessRequest.portalOrganizationId,
                  membership,
                  alreadyClaimed: true,
                };
              }
            }

            const organization = await tx.portalOrganization.findUniqueOrThrow({
              where: { id: accessRequest.license.organizationId },
              select: { id: true },
            });

            const claimed = await tx.accessRequest.updateMany({
              where: {
                id: accessRequest.id,
                status: AccessRequestStatus.ACTIVE,
                activatedAt: { not: null },
                AND: [
                  {
                    OR: [{ portalUserId: null }, { portalUserId: user.id }],
                  },
                  {
                    OR: [
                      { portalOrganizationId: null },
                      { portalOrganizationId: organization.id },
                    ],
                  },
                ],
              },
              data: {
                portalUserId: user.id,
                portalOrganizationId: organization.id,
              },
            });
            if (claimed.count !== 1) {
              throw new ConflictException(
                'This paid access has already been claimed.',
              );
            }

            const membership = await tx.organizationMembership.upsert({
              where: {
                organizationId_userId: {
                  organizationId: organization.id,
                  userId: user.id,
                },
              },
              create: {
                organizationId: organization.id,
                userId: user.id,
                role: OrganizationMemberRole.SHIELD,
              },
              update: { role: OrganizationMemberRole.SHIELD },
              select: {
                id: true,
                organizationId: true,
                userId: true,
                role: true,
              },
            });
            await tx.portalOrganization.update({
              where: { id: organization.id },
              data: { ownerId: user.id },
            });

            return {
              accessRequestId: accessRequest.id,
              organizationId: organization.id,
              membership,
              alreadyClaimed: false,
            };
          },
          { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
        );
      } catch (error) {
        if ((error as { code?: string }).code === 'P2002') {
          throw new ConflictException(
            'This paid access has already been claimed.',
          );
        }
        throw error;
      }
    });
  }

  async consumeApprovalToken(token: string) {
    return this.withSerializationRetry(() =>
      this.prisma.$transaction(
        async (tx) => {
          const { record, tokenId } = await this.resolveToken(
            token,
            { requireUnused: true },
            tx,
          );
          await assertNoOtherOpenRequest(tx, {
            userId: record.portalUserId,
            email: record.email,
            excludeId: record.id,
          });
          const claimed = await tx.accessRequestToken.updateMany({
            where: {
              id: tokenId,
              usedAt: null,
              expiresAt: { gt: new Date() },
            },
            data: { usedAt: new Date() },
          });
          if (claimed.count !== 1) {
            throw new BadRequestException(
              'This approval link has already been used or has expired.',
            );
          }
          return { record, tokenId };
        },
        { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
      ),
    );
  }

  async releaseApprovalToken(tokenId: string) {
    await this.prisma.accessRequestToken.updateMany({
      where: { id: tokenId, usedAt: { not: null } },
      data: { usedAt: null },
    });
  }

  private async resolveToken(
    token: string,
    opts: { requireUnused: boolean },
    client: Prisma.TransactionClient | PrismaService = this.prisma,
  ): Promise<{ record: AccessRequest; tokenId: string }> {
    if (!token || typeof token !== 'string') {
      throw new BadRequestException('Missing or invalid approval token.');
    }
    const match = await client.accessRequestToken.findUnique({
      where: { tokenHash: this.hashToken(token) },
      include: { accessRequest: true },
    });
    if (!match) throw new NotFoundException('Approval link is invalid.');
    if (match.accessRequest.status === AccessRequestStatus.CANCELLED) {
      throw new NotFoundException('Approval link is invalid.');
    }
    if (match.expiresAt < new Date()) {
      throw new BadRequestException('This approval link has expired.');
    }
    if (opts.requireUnused) {
      if (match.usedAt)
        throw new BadRequestException(
          'This approval link has already been used.',
        );
    }
    return { record: match.accessRequest, tokenId: match.id };
  }

  private async deliverApproval(
    record: AccessRequest,
    token: string,
    expiresAt: Date,
  ) {
    const request = this.presentAdmin(record);
    try {
      // Account-first lifecycle: activation (terms, payment) happens while
      // signed in, so the email links to the authenticated activation page.
      // The token is still minted for links sent before this change.
      void token;
      const approvalUrl = new URL('/activation', this.frontendUrl());
      await this.email.sendApproval({
        to: record.email,
        fullName: record.fullName,
        reference: request.reference,
        tier: record.tier,
        approvalUrl: approvalUrl.toString(),
        expiresAt,
      });
      await this.recordEmailDelivery(
        record.id,
        AccessRequestEmailKind.APPROVAL,
        true,
      );
      return {
        request,
        emailDelivery: {
          status: 'sent' as const,
          to: record.email,
        },
      };
    } catch (error) {
      await this.recordEmailDelivery(
        record.id,
        AccessRequestEmailKind.APPROVAL,
        false,
        error,
      );
      this.logger.warn(
        `Approval email delivery failed for access request ${record.id}: ${(error as Error).message}`,
      );
      return {
        request,
        emailDelivery: {
          status: 'failed' as const,
          to: record.email,
        },
      };
    }
  }

  private async deliverActivation(accessRequestId: string) {
    const record = await this.prisma.accessRequest.findUnique({
      where: { id: accessRequestId },
    });
    if (!record || !record.stripeCheckoutSessionId) {
      throw new NotFoundException('Active paid access was not found.');
    }
    try {
      // Account-first: the owner already has an account, so they just sign
      // in. A legacy request paid before its account existed signs up with
      // the same email, which links the paid workspace to it.
      const continueUrl = new URL(
        record.portalUserId ? '/login' : '/signup',
        this.frontendUrl(),
      );
      await this.email.sendActivation({
        to: record.email,
        fullName: record.fullName,
        reference: formatReference(record.referenceNumber, record.createdAt),
        tier: record.tier,
        continueUrl: continueUrl.toString(),
      });
      await this.recordEmailDelivery(
        record.id,
        AccessRequestEmailKind.ACTIVATION,
        true,
      );
      return { status: 'sent' as const, to: record.email };
    } catch (error) {
      await this.recordEmailDelivery(
        record.id,
        AccessRequestEmailKind.ACTIVATION,
        false,
        error,
      );
      this.logger.warn(
        `Activation email delivery failed for access request ${record.id}: ${(error as Error).message}`,
      );
      return { status: 'failed' as const, to: record.email };
    }
  }

  private async recordEmailDelivery(
    accessRequestId: string,
    kind: AccessRequestEmailKind,
    accepted: boolean,
    error?: unknown,
  ) {
    const now = new Date();
    await this.prisma.accessRequestEmailDelivery.upsert({
      where: { accessRequestId_kind: { accessRequestId, kind } },
      create: {
        accessRequestId,
        kind,
        status: accepted
          ? AccessRequestEmailDeliveryStatus.ACCEPTED
          : AccessRequestEmailDeliveryStatus.FAILED,
        attempts: 1,
        lastAttemptAt: now,
        lastAcceptedAt: accepted ? now : null,
        errorCode: accepted ? null : sanitizedEmailDeliveryCode(error),
      },
      update: {
        status: accepted
          ? AccessRequestEmailDeliveryStatus.ACCEPTED
          : AccessRequestEmailDeliveryStatus.FAILED,
        attempts: { increment: 1 },
        lastAttemptAt: now,
        ...(accepted ? { lastAcceptedAt: now, errorCode: null } : {}),
        ...(!accepted ? { errorCode: sanitizedEmailDeliveryCode(error) } : {}),
      },
    });
  }

  private frontendUrl() {
    const configured = process.env.FRONTEND_URL?.trim();
    const value =
      configured ||
      (process.env.NODE_ENV === 'production' ? '' : 'http://localhost:5173');
    if (!value) throw new Error('FRONTEND_URL is not configured.');
    const parsed = new URL(value);
    if (!['http:', 'https:'].includes(parsed.protocol)) {
      throw new Error('FRONTEND_URL must use HTTP or HTTPS.');
    }
    if (process.env.NODE_ENV === 'production' && parsed.protocol !== 'https:') {
      throw new Error('FRONTEND_URL must use HTTPS in production.');
    }
    return parsed.toString();
  }

  private hashToken(raw: string) {
    // We store the SHA-256 of the token; the raw token is only ever emailed
    // to the applicant. Timing-safe comparison happens above.
    return createHash('sha256').update(raw).digest('hex');
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

  /* Conditional single-row transition shared by the simple admin actions. */
  private async transition(
    id: string,
    from: AccessRequestStatus[],
    data: Prisma.AccessRequestUpdateManyMutationInput,
    invalidMessage: string,
  ) {
    const existing = await this.prisma.accessRequest.findUnique({
      where: { id },
    });
    if (!existing) throw new NotFoundException('Access request not found.');
    const moved = await this.prisma.accessRequest.updateMany({
      where: { id, status: { in: from } },
      data,
    });
    if (moved.count !== 1) throw new BadRequestException(invalidMessage);
    const updated = await this.prisma.accessRequest.findUniqueOrThrow({
      where: { id },
    });
    return this.presentAdmin(updated);
  }

  /* What the applicant sees via their approval token: status, the approved
     scope, and the terms version they must accept before payment. */
  private presentApplicant(record: AccessRequest) {
    return {
      id: record.id,
      reference: formatReference(record.referenceNumber, record.createdAt),
      tier: record.tier.toLowerCase() as 'research' | 'organization',
      status: this.humanStatus(record.status),
      email: record.email,
      organization: record.organization,
      billingPeriod: record.billingPeriod,
      approvedAt: record.approvedAt?.toISOString() ?? null,
      activatedAt: record.activatedAt?.toISOString() ?? null,
      scope: LICENSE_SCOPES[record.tier],
      agreementVersion: AGREEMENT_VERSION,
      agreementAcceptedAt: record.agreementAcceptedAt?.toISOString() ?? null,
    };
  }

  private presentAdmin(
    row: AccessRequest & {
      emailDeliveries?: Array<{
        kind: AccessRequestEmailKind;
        status: AccessRequestEmailDeliveryStatus;
        attempts: number;
        lastAttemptAt: Date;
        lastAcceptedAt: Date | null;
        errorCode: string | null;
      }>;
    },
  ) {
    return {
      id: row.id,
      reference: formatReference(row.referenceNumber, row.createdAt),
      tier: row.tier,
      status: row.status,
      fullName: row.fullName,
      email: row.email,
      organization: row.organization,
      applicantRole: row.applicantRole,
      intendedUse: row.intendedUse,
      reason: row.reason,
      expectedUsers: row.expectedUsers,
      details: row.details,
      pilotInterest: row.pilotInterest,
      hasAccount: Boolean(row.portalUserId),
      previousAccessRequestId: row.previousAccessRequestId,
      returningApplicant: Boolean(row.previousAccessRequestId),
      withdrawnAt: row.withdrawnAt?.toISOString() ?? null,
      productUpdatesOptIn: row.productUpdatesOptIn,
      infoRequestedAt: row.infoRequestedAt?.toISOString() ?? null,
      infoRequestMessage: row.infoRequestMessage,
      approvedAt: row.approvedAt?.toISOString() ?? null,
      declinedAt: row.declinedAt?.toISOString() ?? null,
      declinedReason: row.declinedReason,
      cancelledAt: row.cancelledAt?.toISOString() ?? null,
      cancelledBy: row.cancelledBy,
      cancelledReason: row.cancelledReason,
      agreementAcceptedAt: row.agreementAcceptedAt?.toISOString() ?? null,
      agreementVersion: row.agreementVersion,
      billingPeriod: row.billingPeriod,
      activatedAt: row.activatedAt?.toISOString() ?? null,
      emailDeliveries: (row.emailDeliveries ?? []).map((delivery) => ({
        kind: delivery.kind,
        status: delivery.status,
        attempts: delivery.attempts,
        lastAttemptAt: delivery.lastAttemptAt.toISOString(),
        lastAcceptedAt: delivery.lastAcceptedAt?.toISOString() ?? null,
        errorCode: delivery.errorCode,
      })),
      submittedAt: row.createdAt.toISOString(),
    };
  }

  private humanStatus(status: AccessRequestStatus) {
    return status.toLowerCase();
  }
}

// Re-export the tier so payments consumers can reference it without importing
// @prisma/client directly.
export { AccessRequestTier };

function licenseAuditType(
  from: LicenseStatus,
  to: LicenseStatus,
): AuditEventType | null {
  if (from === to) return null;
  if (to === LicenseStatus.EXPIRED || to === LicenseStatus.CANCELLED) {
    return AuditEventType.LICENSE_EXPIRED;
  }
  if (to === LicenseStatus.SUSPENDED || to === LicenseStatus.PAST_DUE) {
    return AuditEventType.LICENSE_SUSPENDED;
  }
  if (to === LicenseStatus.ACTIVE) return AuditEventType.LICENSE_ACTIVATED;
  return null;
}
