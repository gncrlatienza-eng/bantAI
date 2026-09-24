import { createHash, randomBytes } from 'crypto';
import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  AccessRequest,
  AccessRequestStatus,
  AccessRequestTier,
  LicenseStatus,
  OrganizationMemberRole,
  Prisma,
} from '@prisma/client';
import { PrismaService } from '../../database/prisma.service';
import { CreateAccessRequestDto } from './dto/create-access-request.dto';

const TOKEN_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 days for the applicant to act on approval

@Injectable()
export class AccessRequestsService {
  constructor(private readonly prisma: PrismaService) {}

  async create(dto: CreateAccessRequestDto) {
    const record = await this.prisma.accessRequest.create({
      data: {
        tier: dto.tier,
        fullName: dto.fullName.trim(),
        email: dto.email.trim().toLowerCase(),
        organization: dto.organization.trim(),
        intendedUse: dto.intendedUse.trim(),
        reason: dto.reason.trim(),
      },
      select: {
        id: true,
        tier: true,
        status: true,
        createdAt: true,
      },
    });
    return {
      id: record.id,
      tier: record.tier,
      status: this.humanStatus(record.status),
      submittedAt: record.createdAt.toISOString(),
    };
  }

  async list(params: { status?: AccessRequestStatus; take?: number }) {
    const rows = await this.prisma.accessRequest.findMany({
      where: params.status ? { status: params.status } : undefined,
      orderBy: { createdAt: 'desc' },
      take: Math.min(params.take ?? 100, 200),
    });
    return rows.map((r) => this.presentAdmin(r));
  }

  async getForAdmin(id: string) {
    const row = await this.prisma.accessRequest.findUnique({ where: { id } });
    if (!row) throw new NotFoundException('Access request not found.');
    return this.presentAdmin(row);
  }

  async approve(id: string, adminUserId: string) {
    const updated = await this.prisma.$transaction(async (tx) => {
      const existing = await tx.accessRequest.findUnique({ where: { id } });
      if (!existing) throw new NotFoundException('Access request not found.');
      if (
        existing.status === AccessRequestStatus.ACTIVE ||
        existing.status === AccessRequestStatus.PAYMENT_PENDING
      ) {
        throw new BadRequestException(
          'This request has already advanced past approval.',
        );
      }

      return tx.accessRequest.update({
        where: { id },
        data: {
          status: AccessRequestStatus.APPROVED,
          approvedAt: new Date(),
          approvedBy: adminUserId,
          declinedAt: null,
          declinedReason: null,
        },
      });
    });

    const { token } = await this.mintToken(id);
    return {
      request: this.presentAdmin(updated),
      approvalToken: token,
      checkoutPath: `/request-access/checkout#token=${encodeURIComponent(token)}`,
    };
  }

  async decline(id: string, adminUserId: string, reason?: string) {
    void adminUserId; // reserved for audit-log follow-up
    const updated = await this.prisma.accessRequest.update({
      where: { id },
      data: {
        status: AccessRequestStatus.DECLINED,
        declinedAt: new Date(),
        declinedReason: reason ?? null,
      },
    });
    return this.presentAdmin(updated);
  }

  async findApprovedByToken(token: string) {
    const { record } = await this.resolveToken(token, { requireUnused: false });
    return {
      id: record.id,
      tier: record.tier,
      status: this.humanStatus(record.status),
      email: record.email,
      organization: record.organization,
      billingPeriod: record.billingPeriod,
      approvedAt: record.approvedAt?.toISOString() ?? null,
      activatedAt: record.activatedAt?.toISOString() ?? null,
    };
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
        status: AccessRequestStatus.APPROVED,
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

  /*
   * Idempotent activation used by the webhook after a payment success. Safe
   * to call multiple times: the where clause pins to PAYMENT_PENDING, and
   * activation-related fields are only overwritten if we're actually flipping
   * to ACTIVE.
   */
  async activateFromWebhook(params: {
    checkoutSessionId: string;
    stripeCustomerId?: string | null;
    stripeSubscriptionId?: string | null;
    stripeEventCreated?: number;
  }) {
    return this.withSerializationRetry(() =>
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
            request.status === AccessRequestStatus.ACTIVE &&
            request.license
          ) {
            return {
              activated: false,
              organizationId: request.license.organizationId,
            };
          }
          if (request.status !== AccessRequestStatus.PAYMENT_PENDING) {
            return { activated: false };
          }

          const organization = request.portalOrganizationId
            ? await tx.portalOrganization.findUniqueOrThrow({
                where: { id: request.portalOrganizationId },
              })
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

          await tx.license.upsert({
            where: { accessRequestId: request.id },
            create: {
              accessRequestId: request.id,
              organizationId: organization.id,
              tier: request.tier,
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
          return { activated: true, organizationId: organization.id };
        },
        { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
      ),
    );
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
      const requestStatus =
        params.status === LicenseStatus.CANCELLED
          ? AccessRequestStatus.CANCELLED
          : params.status === LicenseStatus.EXPIRED
            ? AccessRequestStatus.EXPIRED
            : AccessRequestStatus.ACTIVE;
      await tx.accessRequest.update({
        where: { id: license.accessRequestId },
        data: {
          status: requestStatus,
          expiresAt: params.validUntil,
        },
      });
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
              if (membership?.role === OrganizationMemberRole.OWNER) {
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
                role: OrganizationMemberRole.OWNER,
              },
              update: { role: OrganizationMemberRole.OWNER },
              select: {
                id: true,
                organizationId: true,
                userId: true,
                role: true,
              },
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
    const { record, tokenId } = await this.resolveToken(token, {
      requireUnused: true,
    });
    const claimed = await this.prisma.accessRequestToken.updateMany({
      where: { id: tokenId, usedAt: null, expiresAt: { gt: new Date() } },
      data: { usedAt: new Date() },
    });
    if (claimed.count !== 1) {
      throw new BadRequestException(
        'This approval link has already been used or has expired.',
      );
    }
    return { record, tokenId };
  }

  async releaseApprovalToken(tokenId: string) {
    await this.prisma.accessRequestToken.updateMany({
      where: { id: tokenId, usedAt: { not: null } },
      data: { usedAt: null },
    });
  }

  private async mintToken(accessRequestId: string) {
    const raw = randomBytes(32).toString('base64url');
    const tokenHash = this.hashToken(raw);
    const expiresAt = new Date(Date.now() + TOKEN_TTL_MS);
    await this.prisma.accessRequestToken.create({
      data: { tokenHash, accessRequestId, expiresAt },
    });
    return { token: raw, expiresAt };
  }

  private async resolveToken(
    token: string,
    opts: { requireUnused: boolean },
  ): Promise<{ record: AccessRequest; tokenId: string }> {
    if (!token || typeof token !== 'string') {
      throw new BadRequestException('Missing or invalid approval token.');
    }
    const match = await this.prisma.accessRequestToken.findUnique({
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

  private presentAdmin(row: AccessRequest) {
    return {
      id: row.id,
      tier: row.tier,
      status: row.status,
      fullName: row.fullName,
      email: row.email,
      organization: row.organization,
      intendedUse: row.intendedUse,
      reason: row.reason,
      approvedAt: row.approvedAt?.toISOString() ?? null,
      declinedAt: row.declinedAt?.toISOString() ?? null,
      declinedReason: row.declinedReason,
      billingPeriod: row.billingPeriod,
      activatedAt: row.activatedAt?.toISOString() ?? null,
      submittedAt: row.createdAt.toISOString(),
    };
  }

  private humanStatus(
    status: AccessRequestStatus,
  ): 'received' | 'under_review' {
    return status === AccessRequestStatus.RECEIVED
      ? 'received'
      : 'under_review';
  }
}

// Re-export the tier so payments consumers can reference it without importing
// @prisma/client directly.
export { AccessRequestTier };
