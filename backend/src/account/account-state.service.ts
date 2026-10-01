import {
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import {
  AccessRequest,
  AccessRequestStatus,
  AccessRequestTier,
  LicenseStatus,
  OrganizationMemberRole,
} from '@prisma/client';

import { PrismaService } from '../../database/prisma.service';
import { shieldCapabilities } from '../access-control/member-capabilities';
import {
  WorkspaceAccessService,
  type WorkspaceAccess,
} from '../access-control/workspace-access.service';
import { ApplicantRequestsService } from '../access-requests/applicant-requests.service';
import {
  OPEN_REQUEST_STATUSES,
  PENDING_REVIEW_STATUSES,
  reapplyCooldownDays,
} from '../access-requests/application-rules';
import { AuthAudience } from '../auth/constants';
import { LicensePricingService } from '../payments/license-pricing.service';

/* Statuses where the applicant is deciding on terms or payment and must see
   the real recurring price (manual QA 2026-10-01, F1). */
const PRICED_STATUSES: AccessRequestStatus[] = [
  AccessRequestStatus.APPROVED,
  AccessRequestStatus.AGREEMENT_ACCEPTED,
  AccessRequestStatus.PAYMENT_PENDING,
];

export type AccountLifecycleState =
  | 'ADMIN'
  | 'SETUP_REQUIRED'
  | 'READY_TO_REQUEST'
  | 'APPLICATION_PENDING'
  | 'APPLICATION_DECLINED'
  | 'APPROVED_TERMS_REQUIRED'
  | 'APPROVED_PAYMENT_REQUIRED'
  | 'ACTIVE_SHIELD'
  | 'EXPIRED_SHIELD'
  | 'LEGACY_REVIEW_REQUIRED'
  | 'SUSPENDED'
  | 'REVOKED';

/** Web route groups; the frontend maps each group to its route prefix. */
export type RouteGroup =
  | 'admin'
  | 'setup'
  | 'request'
  | 'application'
  | 'activation'
  | 'expired'
  | 'status'
  | 'account'
  | 'workspace';

/*
 * The one allowed destination and the route groups each state may reach.
 * Anything not listed is denied (the web redirects to `destination`).
 */
const ROUTES: Record<
  AccountLifecycleState,
  { destination: string; groups: RouteGroup[] }
> = {
  ADMIN: { destination: '/admin/overview', groups: ['admin'] },
  SETUP_REQUIRED: { destination: '/setup', groups: ['setup'] },
  READY_TO_REQUEST: {
    destination: '/access/request',
    groups: ['request', 'application', 'account'],
  },
  APPLICATION_PENDING: {
    destination: '/application',
    groups: ['application', 'account'],
  },
  APPLICATION_DECLINED: {
    destination: '/application',
    groups: ['application', 'account'],
  },
  APPROVED_TERMS_REQUIRED: {
    destination: '/activation',
    groups: ['activation', 'application', 'account'],
  },
  APPROVED_PAYMENT_REQUIRED: {
    destination: '/activation',
    groups: ['activation', 'application', 'account'],
  },
  ACTIVE_SHIELD: {
    destination: '/client/overview',
    groups: ['workspace', 'application', 'account'],
  },
  EXPIRED_SHIELD: {
    destination: '/access/expired',
    groups: ['expired', 'request', 'application', 'account'],
  },
  LEGACY_REVIEW_REQUIRED: {
    destination: '/access/status',
    groups: ['status', 'application', 'account'],
  },
  SUSPENDED: {
    destination: '/access/status',
    groups: ['status', 'application', 'account'],
  },
  REVOKED: { destination: '/access/status', groups: ['status'] },
};

type LicenseHistory = {
  tier: AccessRequestTier;
  status: LicenseStatus;
  validFrom: Date;
  validUntil: Date | null;
  organizationName: string;
  memberRole: OrganizationMemberRole;
  legacyTier: string | null;
  shieldReviewDecision: string;
};

/**
 * Authoritative account lifecycle resolver
 * (docs/backend/ACCESS_LIFECYCLE_AUDIT_2026-09-29.md §3, §A.10 phase 3).
 * Precedence: admin → account restriction → setup → active license →
 * open application → license suspension → decline → expiry → ready.
 * Everything is read from the database on each call; nothing is trusted
 * from the session beyond the user id and audience.
 */
@Injectable()
export class AccountStateService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly workspaceAccess: WorkspaceAccessService,
    private readonly applicants: ApplicantRequestsService,
    private readonly pricing: LicensePricingService,
  ) {}

  /** The applicant-facing request, with prices while terms/payment are open. */
  private async presentApplication(record: AccessRequest) {
    const presented = this.applicants.present(record);
    if (!PRICED_STATUSES.includes(record.status)) return presented;
    return { ...presented, pricing: await this.pricing.pricing(record.tier) };
  }

  async resolve(session: { userId: string; audience: AuthAudience }) {
    if (
      session.audience !== AuthAudience.CLIENT &&
      session.audience !== AuthAudience.ADMIN
    ) {
      throw new ForbiddenException('Web account state requires a web session.');
    }
    const user = await this.prisma.user.findUnique({
      where: { id: session.userId },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        company: true,
        webRole: true,
        portalAccessStatus: true,
        onboardingStatus: true,
      },
    });
    if (!user) throw new UnauthorizedException('Session is no longer valid.');
    const account = {
      id: user.id,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      organization: user.company,
      onboardingStatus: user.onboardingStatus,
    };

    if (user.webRole === 'ADMIN') {
      return this.result('ADMIN', { account });
    }
    // Sessions for restricted accounts are refused by JwtStrategy; these
    // branches keep the resolver correct for every caller.
    if (user.portalAccessStatus === 'REVOKED') {
      return this.result('REVOKED', { account, reason: 'ACCOUNT_REVOKED' });
    }
    if (user.portalAccessStatus === 'SUSPENDED') {
      return this.result('SUSPENDED', { account, reason: 'ACCOUNT_SUSPENDED' });
    }
    if (user.onboardingStatus !== 'COMPLETE') {
      return this.result('SETUP_REQUIRED', { account });
    }

    const [active, requests, licenses] = await Promise.all([
      this.workspaceAccess.activeAccessFor(user.id),
      this.prisma.accessRequest.findMany({
        where: { portalUserId: user.id },
        orderBy: { createdAt: 'desc' },
        take: 20,
      }),
      this.licenseHistory(user.id),
    ]);
    const open = requests.find((request) =>
      OPEN_REQUEST_STATUSES.includes(request.status),
    );
    const latestRequest = requests[0] ?? null;
    const latestLicense = licenses[0] ?? null;
    const requestPolicy = this.requestPolicy({
      active,
      open,
      latestRequest,
      latestLicense,
    });
    const common = {
      account,
      application: open
        ? await this.presentApplication(open)
        : latestRequest
          ? await this.presentApplication(latestRequest)
          : null,
      previousAccess: latestLicense && {
        tier: latestLicense.tier.toLowerCase(),
        status: latestLicense.status,
        validFrom: latestLicense.validFrom.toISOString(),
        validUntil: latestLicense.validUntil?.toISOString() ?? null,
        organizationName: latestLicense.organizationName,
        memberRole: latestLicense.memberRole,
        legacyTier: latestLicense.legacyTier,
        shieldReviewDecision: latestLicense.shieldReviewDecision,
      },
      requestPolicy,
    };

    if (active.length > 0) {
      const workspace = active[0];
      return this.result(
        'ACTIVE_SHIELD',
        {
          ...common,
          workspace: this.presentWorkspace(workspace),
          application: open ? await this.presentApplication(open) : null,
        },
        requestPolicy.canRequest ? ['request'] : [],
      );
    }
    if (
      open?.legacyTier ||
      (latestLicense?.legacyTier &&
        latestLicense.shieldReviewDecision !== 'APPROVED')
    ) {
      return this.result('LEGACY_REVIEW_REQUIRED', {
        ...common,
        reason: 'LEGACY_CONTRACT_REVIEW',
      });
    }
    if (open) {
      const state: AccountLifecycleState = PENDING_REVIEW_STATUSES.includes(
        open.status,
      )
        ? 'APPLICATION_PENDING'
        : open.status === AccessRequestStatus.APPROVED
          ? 'APPROVED_TERMS_REQUIRED'
          : 'APPROVED_PAYMENT_REQUIRED';
      return this.result(state, common);
    }
    if (latestLicense && isSuspension(latestLicense)) {
      return this.result('SUSPENDED', {
        ...common,
        reason: 'LICENSE_SUSPENDED',
      });
    }
    if (
      latestRequest?.status === AccessRequestStatus.DECLINED &&
      (!latestLicense || latestRequest.createdAt > latestLicense.validFrom)
    ) {
      return this.result(
        'APPLICATION_DECLINED',
        common,
        requestPolicy.canRequest ? ['request'] : [],
      );
    }
    if (latestLicense) {
      return this.result('EXPIRED_SHIELD', common);
    }
    return this.result('READY_TO_REQUEST', common);
  }

  /** Server-side gate for application actions that follow setup. */
  async assertSetupComplete(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { onboardingStatus: true },
    });
    if (user?.onboardingStatus !== 'COMPLETE') {
      throw new ForbiddenException({
        statusCode: 403,
        code: 'SETUP_REQUIRED',
        message: 'Finish account setup first.',
      });
    }
  }

  private result(
    state: AccountLifecycleState,
    payload: Record<string, unknown>,
    extraGroups: RouteGroup[] = [],
  ) {
    const route = ROUTES[state];
    return {
      state,
      destination: route.destination,
      routeGroups: [...new Set([...route.groups, ...extraGroups])],
      account: null,
      workspace: null,
      application: null,
      previousAccess: null,
      requestPolicy: null,
      reason: null,
      ...payload,
    };
  }

  private presentWorkspace(access: WorkspaceAccess) {
    return {
      organizationId: access.organizationId,
      name: access.organizationName,
      tier: access.tier.toLowerCase(),
      memberRole: access.memberRole,
      capabilities: shieldCapabilities(),
      validUntil: access.validUntil?.toISOString() ?? null,
      features: access.policy.features,
      limits: access.policy.limits,
      freshnessDelayMinutes: access.policy.freshnessDelayMinutes,
    };
  }

  /* Most recent license on any workspace the user belongs to. */
  private async licenseHistory(userId: string): Promise<LicenseHistory[]> {
    const memberships = await this.prisma.organizationMembership.findMany({
      where: { userId },
      select: {
        role: true,
        organization: {
          select: {
            name: true,
            licenses: {
              orderBy: { validFrom: 'desc' },
              take: 1,
              select: {
                tier: true,
                status: true,
                validFrom: true,
                validUntil: true,
                legacyTier: true,
                shieldReviewDecision: true,
              },
            },
          },
        },
      },
    });
    return memberships
      .flatMap((membership) =>
        membership.organization.licenses.map((license) => ({
          ...license,
          organizationName: membership.organization.name,
          memberRole: membership.role,
        })),
      )
      .sort((a, b) => b.validFrom.getTime() - a.validFrom.getTime());
  }

  /* Mirrors ApplicantRequestsService.submit so the UI never offers an action
     the server would refuse. The server remains the enforcement point. */
  private requestPolicy(params: {
    active: WorkspaceAccess[];
    open: AccessRequest | undefined;
    latestRequest: AccessRequest | null;
    latestLicense: LicenseHistory | null;
  }) {
    const hasActiveShield = params.active.length > 0;
    const requestableTiers: string[] = hasActiveShield ? [] : ['SHIELD'];
    let blockedReason: string | null = null;
    let eligibleAt: string | null = null;
    if (params.open) blockedReason = 'OPEN_REQUEST_EXISTS';
    else if (params.latestLicense && isSuspension(params.latestLicense)) {
      blockedReason = 'LICENSE_SUSPENDED';
    } else if (
      params.latestRequest?.status === AccessRequestStatus.DECLINED &&
      params.latestRequest.declinedAt
    ) {
      const days = reapplyCooldownDays();
      const at = new Date(
        params.latestRequest.declinedAt.getTime() + days * 86_400_000,
      );
      if (days && at > new Date()) {
        blockedReason = 'REAPPLY_COOLDOWN';
        eligibleAt = at.toISOString();
      }
    }
    if (!blockedReason && requestableTiers.length === 0) {
      blockedReason = 'ALREADY_ACTIVE';
    }
    return {
      canRequest: !blockedReason && requestableTiers.length > 0,
      requestableTiers: requestableTiers.map((tier) => tier.toLowerCase()),
      blockedReason,
      eligibleAt,
    };
  }
}

function isSuspension(license: {
  status: LicenseStatus;
  validUntil: Date | null;
}) {
  return (
    (license.status === LicenseStatus.SUSPENDED ||
      license.status === LicenseStatus.PAST_DUE) &&
    (!license.validUntil || license.validUntil > new Date())
  );
}
