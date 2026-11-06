import { ForbiddenException } from '@nestjs/common';
import { AccessRequestStatus } from '@prisma/client';

import { entitlementPolicyFor } from '../portal-organizations/entitlement-policy';
import { AuthAudience } from '../auth/constants';
import { AccountStateService } from './account-state.service';

const DAY = 86_400_000;
const client = { userId: 'user-1', audience: AuthAudience.CLIENT };

function request(status: AccessRequestStatus, createdAt = new Date()) {
  return {
    id: `req-${status}`,
    status,
    createdAt,
    declinedAt: status === 'DECLINED' ? createdAt : null,
  };
}

function membershipWithLicense(
  status: string,
  validFrom: Date,
  validUntil: Date | null,
  legacyTier: string | null = null,
  shieldReviewDecision = 'APPROVED',
) {
  return {
    role: 'SHIELD',
    organization: {
      name: 'Workspace',
      licenses: [
        {
          tier: 'SHIELD',
          status,
          validFrom,
          validUntil,
          legacyTier,
          shieldReviewDecision,
        },
      ],
    },
  };
}

describe('AccountStateService (lifecycle resolver)', () => {
  const prisma = {
    user: { findUnique: jest.fn() },
    accessRequest: { findMany: jest.fn() },
    organizationMembership: { findMany: jest.fn() },
  };
  const workspaceAccess = { activeAccessFor: jest.fn() };
  const applicants = {
    present: jest.fn((record: { id: string; status: string }) => ({
      id: record.id,
      status: record.status.toLowerCase(),
    })),
  };
  const PRICING = {
    confirmed: true,
    annual: {
      amountMinor: 29_900_000,
      currency: 'php',
      interval: 'year',
      display: '₱299,000.00 per year',
    },
    monthly: {
      amountMinor: 2_990_000,
      currency: 'php',
      interval: 'month',
      display: '₱29,900.00 per month',
    },
  };
  const pricing = { pricing: jest.fn().mockResolvedValue(PRICING) };
  const service = new AccountStateService(
    prisma as never,
    workspaceAccess as never,
    applicants as never,
    pricing as never,
  );

  const readyUser = {
    id: 'user-1',
    email: 'ana@uni.edu.ph',
    firstName: 'Ana',
    lastName: 'Santos',
    company: 'Example University',
    webRole: 'SHIELD',
    portalAccessStatus: 'ACTIVE',
    onboardingStatus: 'COMPLETE',
  };

  beforeEach(() => {
    jest.clearAllMocks();
    delete process.env.ACCESS_REQUEST_REAPPLY_COOLDOWN_DAYS;
    prisma.user.findUnique.mockResolvedValue(readyUser);
    prisma.accessRequest.findMany.mockResolvedValue([]);
    prisma.organizationMembership.findMany.mockResolvedValue([]);
    workspaceAccess.activeAccessFor.mockResolvedValue([]);
  });

  it('refuses mobile sessions', async () => {
    await expect(
      service.resolve({ userId: 'user-1', audience: AuthAudience.MOBILE }),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('routes platform admins only to the admin portal', async () => {
    prisma.user.findUnique.mockResolvedValue({
      ...readyUser,
      webRole: 'ADMIN',
    });
    const state = await service.resolve({
      userId: 'user-1',
      audience: AuthAudience.ADMIN,
    });
    expect(state).toMatchObject({
      state: 'ADMIN',
      destination: '/admin/overview',
      routeGroups: ['admin'],
    });
  });

  it('confines an unfinished account to setup, even with an active license', async () => {
    prisma.user.findUnique.mockResolvedValue({
      ...readyUser,
      onboardingStatus: 'IN_PROGRESS',
    });
    workspaceAccess.activeAccessFor.mockResolvedValue([{ tier: 'SHIELD' }]);
    const state = await service.resolve(client);
    expect(state).toMatchObject({
      state: 'SETUP_REQUIRED',
      destination: '/setup',
      routeGroups: ['setup'],
    });
  });

  it('sends a new verified account with no history to request access', async () => {
    const state = await service.resolve(client);
    expect(state).toMatchObject({
      state: 'READY_TO_REQUEST',
      destination: '/access/request',
      requestPolicy: { canRequest: true },
    });
    expect(state.routeGroups).not.toContain('workspace');
  });

  it('routes a paid legacy license awaiting contract review to an honest status page', async () => {
    prisma.organizationMembership.findMany.mockResolvedValue([
      membershipWithLicense(
        'ACTIVE',
        new Date(Date.now() - DAY),
        null,
        'RESEARCH',
        'PENDING',
      ),
    ]);
    const state = await service.resolve(client);
    expect(state).toMatchObject({
      state: 'LEGACY_REVIEW_REQUIRED',
      destination: '/access/status',
      reason: 'LEGACY_CONTRACT_REVIEW',
      previousAccess: {
        legacyTier: 'RESEARCH',
        shieldReviewDecision: 'PENDING',
      },
    });
    expect(state.routeGroups).not.toContain('workspace');
  });

  it('routes an old approved application to contract review before activation', async () => {
    prisma.accessRequest.findMany.mockResolvedValue([
      { ...request(AccessRequestStatus.APPROVED), legacyTier: 'ORGANIZATION' },
    ]);
    const state = await service.resolve(client);
    expect(state).toMatchObject({
      state: 'LEGACY_REVIEW_REQUIRED',
      destination: '/access/status',
      reason: 'LEGACY_CONTRACT_REVIEW',
    });
  });

  it.each([
    [AccessRequestStatus.RECEIVED, 'APPLICATION_PENDING', '/application'],
    [AccessRequestStatus.UNDER_REVIEW, 'APPLICATION_PENDING', '/application'],
    [
      AccessRequestStatus.MORE_INFO_REQUIRED,
      'APPLICATION_PENDING',
      '/application',
    ],
    [AccessRequestStatus.APPROVED, 'APPROVED_TERMS_REQUIRED', '/activation'],
    [
      AccessRequestStatus.AGREEMENT_ACCEPTED,
      'APPROVED_PAYMENT_REQUIRED',
      '/activation',
    ],
    [
      AccessRequestStatus.PAYMENT_PENDING,
      'APPROVED_PAYMENT_REQUIRED',
      '/activation',
    ],
  ])('maps an open %s request to %s', async (status, expected, destination) => {
    prisma.accessRequest.findMany.mockResolvedValue([request(status)]);
    const state = await service.resolve(client);
    expect(state).toMatchObject({
      state: expected,
      destination,
      requestPolicy: {
        canRequest: false,
        blockedReason: 'OPEN_REQUEST_EXISTS',
      },
    });
    expect(state.routeGroups).not.toContain('workspace');
    expect(state.routeGroups).not.toContain('request');
  });

  it.each([
    AccessRequestStatus.APPROVED,
    AccessRequestStatus.AGREEMENT_ACCEPTED,
    AccessRequestStatus.PAYMENT_PENDING,
  ])(
    'shows the real recurring price while a %s request decides on terms or payment',
    async (status) => {
      prisma.accessRequest.findMany.mockResolvedValue([
        { ...request(status), tier: 'SHIELD' },
      ]);
      const state = await service.resolve(client);
      expect(state.application).toMatchObject({ pricing: PRICING });
      expect(pricing.pricing).toHaveBeenCalledWith('SHIELD');
    },
  );

  it('does not look up prices for a request still under review', async () => {
    prisma.accessRequest.findMany.mockResolvedValue([
      request(AccessRequestStatus.UNDER_REVIEW),
    ]);
    const state = await service.resolve(client);
    expect(state.application).not.toHaveProperty('pricing');
    expect(pricing.pricing).not.toHaveBeenCalled();
  });

  it('opens the workspace for an active Shield subscription', async () => {
    workspaceAccess.activeAccessFor.mockResolvedValue([
      {
        organizationId: 'org-1',
        organizationName: 'Workspace',
        memberRole: 'SHIELD',
        licenseId: 'lic-1',
        tier: 'SHIELD',
        validUntil: null,
        policy: entitlementPolicyFor('SHIELD'),
      },
    ]);
    const state = await service.resolve(client);
    expect(state).toMatchObject({
      state: 'ACTIVE_SHIELD',
      destination: '/client/overview',
      workspace: { organizationId: 'org-1', memberRole: 'SHIELD' },
    });
    expect(state.routeGroups).toContain('workspace');
    expect(state.routeGroups).not.toContain('admin');
  });

  it('keeps an expired Shield account signed in with a re-request path', async () => {
    prisma.accessRequest.findMany.mockResolvedValue([
      request(AccessRequestStatus.ACTIVE, new Date(Date.now() - 400 * DAY)),
    ]);
    prisma.organizationMembership.findMany.mockResolvedValue([
      membershipWithLicense(
        'ACTIVE',
        new Date(Date.now() - 395 * DAY),
        new Date(Date.now() - 30 * DAY),
      ),
    ]);
    const state = await service.resolve(client);
    expect(state).toMatchObject({
      state: 'EXPIRED_SHIELD',
      destination: '/access/expired',
      previousAccess: { tier: 'shield' },
      requestPolicy: { canRequest: true },
    });
    expect(state.routeGroups).toEqual(
      expect.arrayContaining(['expired', 'request', 'application', 'account']),
    );
    expect(state.routeGroups).not.toContain('workspace');
  });

  it('treats a suspended or past-due license as suspended, not expired', async () => {
    prisma.organizationMembership.findMany.mockResolvedValue([
      membershipWithLicense('PAST_DUE', new Date(Date.now() - 30 * DAY), null),
    ]);
    const state = await service.resolve(client);
    expect(state).toMatchObject({
      state: 'SUSPENDED',
      reason: 'LICENSE_SUSPENDED',
      destination: '/access/status',
      requestPolicy: { canRequest: false, blockedReason: 'LICENSE_SUSPENDED' },
    });
  });

  it('shows a declined decision and offers a new request once any cooldown passes', async () => {
    prisma.accessRequest.findMany.mockResolvedValue([
      request(AccessRequestStatus.DECLINED, new Date(Date.now() - 20 * DAY)),
    ]);
    const open = await service.resolve(client);
    expect(open).toMatchObject({
      state: 'APPLICATION_DECLINED',
      destination: '/application',
      requestPolicy: { canRequest: true },
    });
    expect(open.routeGroups).toContain('request');

    process.env.ACCESS_REQUEST_REAPPLY_COOLDOWN_DAYS = '30';
    const cooling = await service.resolve(client);
    expect(cooling.requestPolicy).toMatchObject({
      canRequest: false,
      blockedReason: 'REAPPLY_COOLDOWN',
    });
    expect(cooling.routeGroups).not.toContain('request');
  });

  it('a newer decline outranks an older expired license', async () => {
    prisma.accessRequest.findMany.mockResolvedValue([
      request(AccessRequestStatus.DECLINED, new Date(Date.now() - 5 * DAY)),
    ]);
    prisma.organizationMembership.findMany.mockResolvedValue([
      membershipWithLicense(
        'EXPIRED',
        new Date(Date.now() - 400 * DAY),
        new Date(Date.now() - 35 * DAY),
      ),
    ]);
    expect((await service.resolve(client)).state).toBe('APPLICATION_DECLINED');
  });
});
