import { Injectable } from '@nestjs/common';
import {
  AccessRequestTier,
  OrganizationMemberRole,
  Prisma,
} from '@prisma/client';

import { PrismaService } from '../../database/prisma.service';
import {
  entitlementPolicyFor,
  type EntitlementPolicy,
} from '../portal-organizations/entitlement-policy';
import { shieldCan, type MemberCapability } from './member-capabilities';

export interface WorkspaceAccess {
  organizationId: string;
  organizationName: string;
  memberRole: OrganizationMemberRole;
  licenseId: string;
  tier: AccessRequestTier;
  validUntil: Date | null;
  policy: EntitlementPolicy;
}

/**
 * A license authorizes data only while it is ACTIVE and inside its validity
 * window. Evaluated against the clock on every call — never cached in a
 * session — so expiry, suspension, and revocation take effect immediately.
 */
export function activeLicenseWhere(now: Date): Prisma.LicenseWhereInput {
  return {
    status: 'ACTIVE',
    shieldApprovedAt: { not: null },
    shieldReviewDecision: 'APPROVED',
    validFrom: { lte: now },
    OR: [{ validUntil: null }, { validUntil: { gt: now } }],
  };
}

@Injectable()
export class WorkspaceAccessService {
  constructor(private readonly prisma: PrismaService) {}

  /** Workspaces where the user currently holds licensed access. */
  async activeAccessFor(
    userId: string,
    organizationId?: string,
  ): Promise<WorkspaceAccess[]> {
    const now = new Date();
    const memberships = await this.prisma.organizationMembership.findMany({
      where: {
        userId,
        ...(organizationId ? { organizationId } : {}),
        organization: { isActive: true },
      },
      orderBy: { createdAt: 'asc' },
      select: {
        role: true,
        organization: {
          select: {
            id: true,
            name: true,
            licenses: {
              where: activeLicenseWhere(now),
              orderBy: { validFrom: 'desc' },
              take: 1,
              select: { id: true, tier: true, validUntil: true },
            },
          },
        },
      },
    });
    return memberships.flatMap((membership) => {
      const license = membership.organization.licenses[0];
      if (!license) return [];
      return [
        {
          organizationId: membership.organization.id,
          organizationName: membership.organization.name,
          memberRole: membership.role,
          licenseId: license.id,
          tier: license.tier,
          validUntil: license.validUntil,
          policy: entitlementPolicyFor(),
        },
      ];
    });
  }
}

export function accessPermits(
  access: WorkspaceAccess,
  capability: MemberCapability,
  entitlement?: keyof EntitlementPolicy['features'],
): boolean {
  return (
    shieldCan(capability) &&
    (!entitlement || access.policy.features[entitlement])
  );
}
