import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';

import { PrismaService } from '../../database/prisma.service';
import { activeLicenseWhere } from '../access-control/workspace-access.service';
import { AddOrganizationMemberDto } from './dto/add-organization-member.dto';
import { CreatePortalOrganizationDto } from './dto/create-portal-organization.dto';
import { entitlementPolicyFor } from './entitlement-policy';
import {
  type AccessRequestTier,
  PortalAccessStatus,
  PortalEnforcementAction,
  Prisma,
  UserRole,
} from '@prisma/client';

@Injectable()
export class PortalOrganizationsService {
  constructor(private readonly prisma: PrismaService) {}

  create(dto: CreatePortalOrganizationDto) {
    return this.prisma.portalOrganization.create({
      data: { name: dto.name.trim() },
      select: { id: true, name: true, isActive: true, createdAt: true },
    });
  }

  list() {
    return this.prisma.portalOrganization.findMany({
      orderBy: { name: 'asc' },
      select: {
        id: true,
        name: true,
        isActive: true,
        createdAt: true,
        _count: { select: { members: true } },
      },
    });
  }

  async listAdministrativeAccounts() {
    const now = new Date();
    const organizations = await this.prisma.portalOrganization.findMany({
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        name: true,
        isActive: true,
        createdAt: true,
        _count: {
          select: { licenses: { where: activeLicenseWhere(now) } },
        },
        accessRequests: {
          orderBy: { createdAt: 'desc' },
          take: 1,
          select: {
            id: true,
            referenceNumber: true,
            tier: true,
            status: true,
            email: true,
            activatedAt: true,
          },
        },
        licenses: {
          orderBy: { validFrom: 'desc' },
          take: 1,
          select: {
            id: true,
            tier: true,
            status: true,
            legacyTier: true,
            shieldReviewDecision: true,
            billingPeriod: true,
            validFrom: true,
            validUntil: true,
          },
        },
        members: {
          orderBy: { createdAt: 'asc' },
          select: {
            id: true,
            role: true,
            createdAt: true,
            user: {
              select: {
                id: true,
                email: true,
                company: true,
                portalAccessStatus: true,
                portalAccessReason: true,
                portalAccessUpdatedAt: true,
                portalAccessUpdatedBy: true,
              },
            },
          },
        },
      },
    });
    // A workspace can now carry many requests over time; the admin view keeps
    // showing the most recent one under its established field name.
    return organizations.map(({ accessRequests, _count, ...organization }) => ({
      ...organization,
      shieldLicensed: organization.isActive && _count.licenses > 0,
      licensedAccessRequest: accessRequests[0] ?? null,
    }));
  }

  async enforcePortalAccount(params: {
    targetUserId: string;
    actorUserId: string;
    action: PortalEnforcementAction;
    reason: string;
  }) {
    const reason = params.reason.trim();
    if (!reason) {
      throw new BadRequestException('An enforcement reason is required.');
    }
    if (params.targetUserId === params.actorUserId) {
      throw new ForbiddenException(
        'Administrators cannot take portal enforcement action on themselves.',
      );
    }
    return this.withSerializationRetry(() =>
      this.prisma.$transaction(
        async (tx) => {
          const [actor, target] = await Promise.all([
            tx.user.findUnique({
              where: { id: params.actorUserId },
              select: { id: true, role: true },
            }),
            tx.user.findUnique({
              where: { id: params.targetUserId },
              select: {
                id: true,
                email: true,
                role: true,
                portalAccessStatus: true,
              },
            }),
          ]);
          if (!actor || actor.role !== UserRole.ADMIN) {
            throw new ForbiddenException('Administrator access is required.');
          }
          if (!target) throw new NotFoundException('Portal account not found.');
          if (target.role === UserRole.ADMIN) {
            throw new ForbiddenException(
              'Staff accounts cannot be changed through client enforcement.',
            );
          }
          const newStatus = this.portalStatusForAction(params.action);
          if (target.portalAccessStatus === newStatus) {
            throw new BadRequestException(
              `This portal account is already ${newStatus.toLowerCase()}.`,
            );
          }
          const now = new Date();
          const user = await tx.user.update({
            where: { id: target.id },
            data: {
              portalAccessStatus: newStatus,
              portalAccessReason: reason,
              portalAccessUpdatedAt: now,
              portalAccessUpdatedBy: actor.id,
            },
            select: {
              id: true,
              email: true,
              portalAccessStatus: true,
              portalAccessReason: true,
              portalAccessUpdatedAt: true,
              portalAccessUpdatedBy: true,
            },
          });
          const audit = await tx.portalAccessAudit.create({
            data: {
              targetUserId: target.id,
              actorUserId: actor.id,
              action: params.action,
              previousStatus: target.portalAccessStatus,
              newStatus,
              reason,
            },
            select: {
              id: true,
              action: true,
              previousStatus: true,
              newStatus: true,
              reason: true,
              createdAt: true,
            },
          });
          return { user, audit };
        },
        { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
      ),
    );
  }

  async addMember(organizationId: string, dto: AddOrganizationMemberDto) {
    const organization = await this.prisma.portalOrganization.findUnique({
      where: { id: organizationId },
      select: {
        id: true,
        _count: { select: { members: true } },
        licenses: {
          where: {
            status: 'ACTIVE',
            shieldApprovedAt: { not: null },
            shieldReviewDecision: 'APPROVED',
            validFrom: { lte: new Date() },
            OR: [{ validUntil: null }, { validUntil: { gt: new Date() } }],
          },
          orderBy: { validFrom: 'desc' },
          take: 1,
          select: { tier: true },
        },
      },
    });
    if (!organization) throw new NotFoundException('Organization not found.');
    const license = organization.licenses[0];
    if (!license) {
      throw new ForbiddenException(
        'An active organization license is required.',
      );
    }
    const user = await this.prisma.user.findUnique({
      where: { id: dto.userId },
      select: { id: true },
    });
    if (!user) throw new NotFoundException('User not found.');
    const existing = await this.prisma.organizationMembership.findUnique({
      where: { organizationId_userId: { organizationId, userId: dto.userId } },
      select: { id: true },
    });
    const maximumMembers = entitlementPolicyFor(license.tier).limits
      .maximumMembers;
    if (!existing && organization._count.members >= maximumMembers) {
      throw new ForbiddenException(
        `This license permits at most ${maximumMembers} organization members.`,
      );
    }
    return this.prisma.organizationMembership.upsert({
      where: { organizationId_userId: { organizationId, userId: dto.userId } },
      create: { organizationId, userId: dto.userId, role: dto.role },
      update: { role: dto.role },
      select: { id: true, organizationId: true, userId: true, role: true },
    });
  }

  async listForUser(userId: string) {
    const memberships = await this.prisma.organizationMembership.findMany({
      where: {
        userId,
        organization: {
          isActive: true,
          licenses: {
            some: {
              status: 'ACTIVE',
              shieldApprovedAt: { not: null },
              shieldReviewDecision: 'APPROVED',
              validFrom: { lte: new Date() },
              OR: [{ validUntil: null }, { validUntil: { gt: new Date() } }],
            },
          },
        },
      },
      orderBy: { createdAt: 'asc' },
      select: {
        role: true,
        organization: {
          select: {
            id: true,
            name: true,
            licenses: {
              where: {
                status: 'ACTIVE',
                shieldApprovedAt: { not: null },
                shieldReviewDecision: 'APPROVED',
                validFrom: { lte: new Date() },
                OR: [{ validUntil: null }, { validUntil: { gt: new Date() } }],
              },
              orderBy: { validFrom: 'desc' },
              take: 1,
              select: { tier: true, validUntil: true },
            },
          },
        },
      },
    });
    return memberships.flatMap((membership) => {
      const license = membership.organization.licenses[0];
      return license
        ? [
            {
              id: membership.organization.id,
              name: membership.organization.name,
              role: membership.role,
              validUntil: license.validUntil,
              policy: entitlementPolicyFor(license.tier),
            },
          ]
        : [];
    });
  }

  async entitlements(organizationId: string) {
    const organization = await this.prisma.portalOrganization.findUnique({
      where: { id: organizationId },
      select: {
        id: true,
        name: true,
        licenses: {
          where: {
            status: 'ACTIVE',
            shieldApprovedAt: { not: null },
            shieldReviewDecision: 'APPROVED',
            validFrom: { lte: new Date() },
            OR: [{ validUntil: null }, { validUntil: { gt: new Date() } }],
          },
          orderBy: { validFrom: 'desc' },
          take: 1,
          select: { tier: true, validUntil: true },
        },
      },
    });
    const license = organization?.licenses[0];
    if (!organization || !license) {
      throw new ForbiddenException(
        'An active organization license is required.',
      );
    }
    return {
      organization: { id: organization.id, name: organization.name },
      validUntil: license.validUntil,
      policy: entitlementPolicyFor(license.tier),
    };
  }

  async exportMaskedAlerts(
    organizationId: string,
    tier: AccessRequestTier,
    requestedLimit: number,
  ) {
    const maximum =
      entitlementPolicyFor(tier).limits.maximumExportRowsPerRequest;
    if (requestedLimit > maximum) {
      throw new ForbiddenException(
        `This license permits at most ${maximum} rows per export request.`,
      );
    }
    const freshnessDelayMinutes =
      entitlementPolicyFor(tier).freshnessDelayMinutes;
    const latestVisibleAt = new Date(
      Date.now() - freshnessDelayMinutes * 60_000,
    );
    const records = await this.prisma.alert.findMany({
      where: {
        ...(freshnessDelayMinutes > 0
          ? { createdAt: { lte: latestVisibleAt } }
          : {}),
        message: {
          user: {
            organizationMemberships: { some: { organizationId } },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
      take: requestedLimit,
      select: {
        status: true,
        createdAt: true,
        message: {
          select: {
            receivedAt: true,
            classification: {
              select: { label: true, score: true, bucket: true },
            },
          },
        },
      },
    });
    return records.map((record) => ({
      alertStatus: record.status,
      alertCreatedAt: record.createdAt,
      receivedAt: record.message.receivedAt,
      label: record.message.classification?.label ?? null,
      score: record.message.classification?.score ?? null,
      bucket: record.message.classification?.bucket ?? null,
    }));
  }

  // Tier-2 staff can see only aggregate, masked metadata for users explicitly
  // enrolled in their organization; no raw sender/body content crosses this API.
  scopedAlertSummary(
    organizationId: string,
    tier: AccessRequestTier = 'SHIELD',
  ) {
    const freshnessDelayMinutes =
      entitlementPolicyFor(tier).freshnessDelayMinutes;
    const latestVisibleAt = new Date(
      Date.now() - freshnessDelayMinutes * 60_000,
    );
    return this.prisma.alert.findMany({
      // Same smishing-only rule as SmsService.getAlerts: legacy promo alerts
      // (model bucket "spam") are excluded rather than deleted.
      where: {
        ...(freshnessDelayMinutes > 0
          ? { createdAt: { lte: latestVisibleAt } }
          : {}),
        message: {
          user: {
            organizationMemberships: { some: { organizationId } },
          },
          NOT: { classification: { is: { bucket: 'spam' } } },
        },
      },
      orderBy: { createdAt: 'desc' },
      take: 500,
      select: {
        id: true,
        status: true,
        createdAt: true,
        message: {
          select: {
            id: true,
            receivedAt: true,
            classification: {
              select: { label: true, score: true, bucket: true },
            },
          },
        },
      },
    });
  }

  private portalStatusForAction(action: PortalEnforcementAction) {
    switch (action) {
      case PortalEnforcementAction.SUSPEND:
        return PortalAccessStatus.SUSPENDED;
      case PortalEnforcementAction.REVOKE:
        return PortalAccessStatus.REVOKED;
      case PortalEnforcementAction.RESTORE:
        return PortalAccessStatus.ACTIVE;
    }
  }

  private async withSerializationRetry<T>(work: () => Promise<T>) {
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
