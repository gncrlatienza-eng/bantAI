import { randomBytes, createHash } from 'crypto';
import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { AuditEventType, ShieldApiScope } from '@prisma/client';

import { PrismaService } from '../../database/prisma.service';
import { AuditService } from '../audit/audit.service';

const ALLOWED_SCOPES = new Set<ShieldApiScope>([
  ShieldApiScope.READ_CAMPAIGNS,
  ShieldApiScope.READ_INDICATORS,
  ShieldApiScope.READ_MASKED_MESSAGES,
  ShieldApiScope.EXPORT_CAMPAIGNS,
]);

export function hashShieldSecret(secret: string): string {
  return createHash('sha256').update(secret, 'utf8').digest('hex');
}

@Injectable()
export class ShieldApiKeyService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  list(organizationId: string) {
    return this.prisma.shieldApiKey.findMany({
      where: { organizationId },
      orderBy: { createdAt: 'desc' },
      select: SAFE_KEY_SELECT,
    });
  }

  async usage(organizationId: string) {
    const now = new Date();
    const today = new Date(
      Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()),
    );
    const periodStart = new Date(
      Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1),
    );
    const [organization, requestsToday, requestsThisPeriod, recent] =
      await Promise.all([
        this.prisma.portalOrganization.findUnique({
          where: { id: organizationId },
          select: { apiMonthlyQuota: true, apiRateLimitPerMinute: true },
        }),
        this.prisma.shieldApiRequest.count({
          where: { organizationId, createdAt: { gte: today } },
        }),
        this.prisma.shieldApiRequest.count({
          where: { organizationId, createdAt: { gte: periodStart } },
        }),
        this.prisma.shieldApiRequest.findMany({
          where: { organizationId },
          orderBy: { createdAt: 'desc' },
          take: 20,
          select: {
            keyId: true,
            route: true,
            method: true,
            statusCode: true,
            createdAt: true,
          },
        }),
      ]);
    if (!organization) throw new NotFoundException('Shield account not found');
    const completed = recent.filter((request) => request.statusCode !== null);
    const successful = completed.filter(
      (request) => request.statusCode !== null && request.statusCode < 400,
    );
    return {
      requestsToday,
      requestsThisPeriod,
      monthlyQuota: organization.apiMonthlyQuota,
      rateLimitPerKeyPerMinute: organization.apiRateLimitPerMinute,
      recentSuccessRate: completed.length
        ? successful.length / completed.length
        : null,
      recent,
    };
  }

  listForAdmin() {
    return this.prisma.shieldApiKey.findMany({
      orderBy: { createdAt: 'desc' },
      select: {
        ...SAFE_KEY_SELECT,
        organization: { select: { name: true, isActive: true } },
      },
    });
  }

  listOrganizationsForAdmin() {
    return this.prisma.portalOrganization.findMany({
      orderBy: { name: 'asc' },
      select: {
        id: true,
        name: true,
        isActive: true,
        apiMonthlyQuota: true,
        apiRateLimitPerMinute: true,
      },
    });
  }

  async usageForAdmin() {
    const now = new Date();
    const periodStart = new Date(
      Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1),
    );
    const [requestsThisPeriod, recent, byOrganization] = await Promise.all([
      this.prisma.shieldApiRequest.count({
        where: { createdAt: { gte: periodStart } },
      }),
      this.prisma.shieldApiRequest.findMany({
        orderBy: { createdAt: 'desc' },
        take: 50,
        select: {
          organizationId: true,
          keyId: true,
          route: true,
          method: true,
          statusCode: true,
          createdAt: true,
        },
      }),
      this.prisma.shieldApiRequest.groupBy({
        by: ['organizationId'],
        where: { createdAt: { gte: periodStart } },
        _count: { _all: true },
      }),
    ]);
    return {
      requestsThisPeriod,
      byOrganization: byOrganization.map((row) => ({
        organizationId: row.organizationId,
        requests: row._count._all,
      })),
      recent,
    };
  }

  async updateLimits(
    organizationId: string,
    actorUserId: string,
    monthlyQuota: number,
    rateLimitPerMinute: number,
  ) {
    return this.prisma.$transaction(async (tx) => {
      const existing = await tx.portalOrganization.findUnique({
        where: { id: organizationId },
        select: { apiMonthlyQuota: true, apiRateLimitPerMinute: true },
      });
      if (!existing) throw new NotFoundException('Shield account not found');
      const updated = await tx.portalOrganization.update({
        where: { id: organizationId },
        data: {
          apiMonthlyQuota: monthlyQuota,
          apiRateLimitPerMinute: rateLimitPerMinute,
        },
        select: {
          id: true,
          apiMonthlyQuota: true,
          apiRateLimitPerMinute: true,
        },
      });
      await this.audit.record(
        {
          type: AuditEventType.API_LIMITS_CHANGED,
          actorUserId,
          organizationId,
          metadata: {
            previousMonthlyQuota: existing.apiMonthlyQuota,
            previousRateLimitPerMinute: existing.apiRateLimitPerMinute,
            newMonthlyQuota: monthlyQuota,
            newRateLimitPerMinute: rateLimitPerMinute,
          },
        },
        tx,
      );
      return updated;
    });
  }

  async create(
    organizationId: string,
    actorUserId: string,
    input: { name: string; scopes: ShieldApiScope[]; expiresAt?: string },
  ) {
    const name = input.name?.trim();
    if (!name || name.length > 120) {
      throw new ForbiddenException(
        'A key name of 1 to 120 characters is required.',
      );
    }
    if (
      !Array.isArray(input.scopes) ||
      input.scopes.length === 0 ||
      input.scopes.some((scope) => !ALLOWED_SCOPES.has(scope))
    ) {
      throw new ForbiddenException('Only Shield read scopes are allowed.');
    }
    const expiresAt = input.expiresAt ? new Date(input.expiresAt) : null;
    if (
      expiresAt &&
      (!Number.isFinite(expiresAt.getTime()) || expiresAt <= new Date())
    ) {
      throw new ForbiddenException('Expiration must be a future date.');
    }
    const secret = `bnt_live_${randomBytes(32).toString('base64url')}`;
    const key = await this.prisma.$transaction(async (tx) => {
      const created = await tx.shieldApiKey.create({
        data: {
          organizationId,
          createdByUserId: actorUserId,
          name,
          secretHash: hashShieldSecret(secret),
          keyPrefix: secret.slice(0, 9),
          keySuffix: secret.slice(-4),
          scopes: [...new Set(input.scopes)],
          expiresAt,
        },
        select: SAFE_KEY_SELECT,
      });
      await this.audit.record(
        {
          type: AuditEventType.API_KEY_CREATED,
          actorUserId,
          organizationId,
          metadata: { keyId: created.id, scopes: created.scopes },
        },
        tx,
      );
      return created;
    });
    // Only this response contains the plaintext secret. It is never persisted.
    return { ...key, secret };
  }

  async revoke(organizationId: string, keyId: string, actorUserId: string) {
    return this.prisma.$transaction(async (tx) => {
      const existing = await tx.shieldApiKey.findFirst({
        where: { id: keyId, organizationId },
        select: { id: true },
      });
      if (!existing) throw new NotFoundException('API key not found');
      const key = await tx.shieldApiKey.update({
        where: { id: keyId },
        data: { status: 'REVOKED', revokedAt: new Date() },
        select: SAFE_KEY_SELECT,
      });
      await this.audit.record(
        {
          type: AuditEventType.API_KEY_REVOKED,
          actorUserId,
          organizationId,
          metadata: { keyId },
        },
        tx,
      );
      return key;
    });
  }

  async revokeForAdmin(keyId: string, actorUserId: string) {
    const key = await this.prisma.shieldApiKey.findUnique({
      where: { id: keyId },
      select: { organizationId: true },
    });
    if (!key) throw new NotFoundException('API key not found');
    return this.revoke(key.organizationId, keyId, actorUserId);
  }

  async rotate(organizationId: string, keyId: string, actorUserId: string) {
    const secret = `bnt_live_${randomBytes(32).toString('base64url')}`;
    const replacement = await this.prisma.$transaction(async (tx) => {
      const old = await tx.shieldApiKey.findFirst({
        where: { id: keyId, organizationId, status: 'ACTIVE' },
        select: { name: true, scopes: true, expiresAt: true },
      });
      if (!old) throw new NotFoundException('Active API key not found');
      if (old.expiresAt && old.expiresAt <= new Date()) {
        throw new ForbiddenException('Expired keys cannot be rotated.');
      }
      await tx.shieldApiKey.update({
        where: { id: keyId },
        data: { status: 'REVOKED', revokedAt: new Date() },
      });
      const created = await tx.shieldApiKey.create({
        data: {
          organizationId,
          createdByUserId: actorUserId,
          name: old.name,
          secretHash: hashShieldSecret(secret),
          keyPrefix: secret.slice(0, 9),
          keySuffix: secret.slice(-4),
          scopes: old.scopes,
          expiresAt: old.expiresAt,
        },
        select: SAFE_KEY_SELECT,
      });
      await this.audit.record(
        {
          type: AuditEventType.API_KEY_ROTATED,
          actorUserId,
          organizationId,
          metadata: { priorKeyId: keyId, replacementKeyId: created.id },
        },
        tx,
      );
      return created;
    });
    return { ...replacement, secret };
  }
}

export const SAFE_KEY_SELECT = {
  id: true,
  organizationId: true,
  name: true,
  keyPrefix: true,
  keySuffix: true,
  scopes: true,
  status: true,
  expiresAt: true,
  lastUsedAt: true,
  createdAt: true,
  revokedAt: true,
} as const;
