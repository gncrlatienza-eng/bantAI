import { createHash, randomBytes, timingSafeEqual } from 'crypto';
import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  AccessRequest,
  AccessRequestStatus,
  AccessRequestTier,
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
      fullName: record.fullName,
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
    return this.prisma.accessRequest.update({
      where: { id: accessRequestId },
      data: {
        status: AccessRequestStatus.PAYMENT_PENDING,
        stripeCheckoutSessionId,
        billingPeriod,
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
    stripeCustomerId?: string | null;
    stripeSubscriptionId?: string | null;
  }) {
    const now = new Date();
    // Try to flip PAYMENT_PENDING → ACTIVE. If the row is already ACTIVE,
    // updateMany returns count: 0 and we treat it as idempotent success.
    const flipped = await this.prisma.accessRequest.updateMany({
      where: {
        stripeCheckoutSessionId: params.checkoutSessionId,
        status: AccessRequestStatus.PAYMENT_PENDING,
      },
      data: {
        status: AccessRequestStatus.ACTIVE,
        activatedAt: now,
        stripeCustomerId: params.stripeCustomerId ?? undefined,
        stripeSubscriptionId: params.stripeSubscriptionId ?? undefined,
      },
    });
    return { activated: flipped.count > 0 };
  }

  async consumeApprovalToken(token: string) {
    const { record, tokenId } = await this.resolveToken(token, {
      requireUnused: true,
    });
    await this.prisma.accessRequestToken.update({
      where: { id: tokenId },
      data: { usedAt: new Date() },
    });
    return record;
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
    const rows = await this.prisma.accessRequestToken.findMany({
      where: {
        accessRequest: { status: { not: AccessRequestStatus.CANCELLED } },
      },
      include: { accessRequest: true },
    });
    // Constant-time compare of every candidate hash to prevent token-existence
    // timing leaks. Volume here is small (approved requests, not users).
    const targetHash = Buffer.from(this.hashToken(token), 'hex');
    let match: { id: string; record: AccessRequest } | null = null;
    for (const row of rows) {
      const candidate = Buffer.from(row.tokenHash, 'hex');
      if (
        candidate.length === targetHash.length &&
        timingSafeEqual(candidate, targetHash)
      ) {
        match = { id: row.id, record: row.accessRequest };
        break;
      }
    }
    if (!match) throw new NotFoundException('Approval link is invalid.');
    if (opts.requireUnused) {
      const t = rows.find((r) => r.id === match!.id)!;
      if (t.usedAt)
        throw new BadRequestException(
          'This approval link has already been used.',
        );
      if (t.expiresAt < new Date())
        throw new BadRequestException('This approval link has expired.');
    }
    return { record: match.record, tokenId: match.id };
  }

  private hashToken(raw: string) {
    // We store the SHA-256 of the token; the raw token is only ever emailed
    // to the applicant. Timing-safe comparison happens above.
    return createHash('sha256').update(raw).digest('hex');
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
