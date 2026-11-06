import { createHash } from 'crypto';
import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  HttpException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ShieldApiScope } from '@prisma/client';

import { PrismaService } from '../../database/prisma.service';
import { entitlementPolicyFor } from '../portal-organizations/entitlement-policy';

export const SHIELD_SCOPE_KEY = 'shield-api-scope';

@Injectable()
export class ShieldApiKeyGuard implements CanActivate {
  constructor(
    private readonly prisma: PrismaService,
    private readonly reflector: Reflector,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<{
      headers: Record<string, string | string[] | undefined>;
      shieldOrganizationId?: string;
      shieldApiKeyId?: string;
      shieldApiRequestId?: string;
      route?: { path?: string };
      method?: string;
    }>();
    const required = this.reflector.getAllAndOverride<
      ShieldApiScope | undefined
    >(SHIELD_SCOPE_KEY, [context.getHandler(), context.getClass()]);
    if (!required) throw new ForbiddenException('API scope is not configured.');
    if (!entitlementPolicyFor().features.API_ACCESS) {
      throw new ForbiddenException('Shield API access is not enabled.');
    }
    const header = request.headers.authorization;
    const authorization = Array.isArray(header) ? '' : (header ?? '');
    const match = /^Bearer (bnt_live_[A-Za-z0-9_-]{32,})$/.exec(authorization);
    if (!match) throw new UnauthorizedException('Shield API key is required.');
    const secretHash = createHash('sha256')
      .update(match[1], 'utf8')
      .digest('hex');
    const now = new Date();
    const key = await this.prisma.shieldApiKey.findUnique({
      where: { secretHash },
      select: {
        id: true,
        organizationId: true,
        createdByUserId: true,
        scopes: true,
        status: true,
        expiresAt: true,
        createdBy: {
          select: { webRole: true, portalAccessStatus: true },
        },
        organization: {
          select: {
            isActive: true,
            apiMonthlyQuota: true,
            apiRateLimitPerMinute: true,
            licenses: {
              where: {
                status: 'ACTIVE',
                shieldApprovedAt: { not: null },
                shieldReviewDecision: 'APPROVED',
                validFrom: { lte: now },
                OR: [{ validUntil: null }, { validUntil: { gt: now } }],
              },
              take: 1,
              select: { id: true },
            },
          },
        },
      },
    });
    if (
      !key ||
      key.status !== 'ACTIVE' ||
      (key.expiresAt && key.expiresAt <= now) ||
      key.createdBy.webRole !== 'SHIELD' ||
      key.createdBy.portalAccessStatus !== 'ACTIVE' ||
      !key.organization.isActive ||
      key.organization.licenses.length === 0
    ) {
      throw new UnauthorizedException('Shield API key is invalid or inactive.');
    }
    const membership = await this.prisma.organizationMembership.findUnique({
      where: {
        organizationId_userId: {
          organizationId: key.organizationId,
          userId: key.createdByUserId,
        },
      },
      select: { id: true },
    });
    if (!membership) {
      throw new UnauthorizedException('Shield API key is invalid or inactive.');
    }
    if (!key.scopes.includes(required)) {
      throw new ForbiddenException('API key lacks the required scope.');
    }
    const minuteStart = new Date(now.getTime() - 60_000);
    const monthStart = new Date(
      Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1),
    );
    const requestRecord = await this.prisma.$transaction(async (tx) => {
      // Serialize all keys of one tenant before counting usage. This prevents
      // parallel keys from racing through the monthly quota check.
      // Cast void to text so Prisma can deserialize the result row.
      await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtextextended(${key.organizationId}, 0))::text AS locked`;
      const [recent, period] = await Promise.all([
        tx.shieldApiRequest.count({
          where: { keyId: key.id, createdAt: { gte: minuteStart } },
        }),
        tx.shieldApiRequest.count({
          where: {
            organizationId: key.organizationId,
            createdAt: { gte: monthStart },
          },
        }),
      ]);
      if (
        recent >= key.organization.apiRateLimitPerMinute ||
        period >= key.organization.apiMonthlyQuota
      ) {
        throw new HttpException(
          'Shield API rate limit or monthly quota exceeded.',
          429,
        );
      }
      const created = await tx.shieldApiRequest.create({
        data: {
          organizationId: key.organizationId,
          keyId: key.id,
          route: (request.route?.path ?? 'unknown').slice(0, 120),
          method: (request.method ?? 'GET').slice(0, 12),
        },
        select: { id: true },
      });
      await tx.shieldApiKey.update({
        where: { id: key.id },
        data: { lastUsedAt: now },
        select: { id: true },
      });
      return created;
    });
    request.shieldOrganizationId = key.organizationId;
    request.shieldApiKeyId = key.id;
    request.shieldApiRequestId = requestRecord.id;
    return true;
  }
}
