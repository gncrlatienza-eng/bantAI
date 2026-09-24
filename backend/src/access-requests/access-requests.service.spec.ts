import { BadRequestException, ConflictException } from '@nestjs/common';
import {
  AccessRequestStatus,
  AccessRequestTier,
  OrganizationMemberRole,
} from '@prisma/client';
import { AccessRequestsService } from './access-requests.service';

describe('AccessRequestsService security boundaries', () => {
  const prisma = {
    $transaction: jest.fn(),
    user: { findUnique: jest.fn() },
    accessRequest: {
      findFirst: jest.fn(),
      updateMany: jest.fn(),
    },
    accessRequestToken: { findUnique: jest.fn(), updateMany: jest.fn() },
    portalOrganization: {
      create: jest.fn(),
      findUniqueOrThrow: jest.fn(),
    },
    organizationMembership: {
      findUnique: jest.fn(),
      upsert: jest.fn(),
    },
  };
  const service = new AccessRequestsService(prisma as never);

  beforeEach(() => jest.resetAllMocks());

  it('rejects expired tokens even for read-only resolution', async () => {
    prisma.accessRequestToken.findUnique.mockResolvedValue({
      id: 't1',
      expiresAt: new Date(Date.now() - 1),
      usedAt: null,
      accessRequest: { status: AccessRequestStatus.APPROVED },
    });

    await expect(
      service.findApprovedByToken('a'.repeat(32)),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('atomically refuses a token already claimed by another checkout', async () => {
    prisma.accessRequestToken.findUnique.mockResolvedValue({
      id: 't1',
      expiresAt: new Date(Date.now() + 60_000),
      usedAt: null,
      accessRequest: { status: AccessRequestStatus.APPROVED },
    });
    prisma.accessRequestToken.updateMany.mockResolvedValue({ count: 0 });

    await expect(
      service.consumeApprovalToken('a'.repeat(32)),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('transitions only an approved request into payment pending', async () => {
    prisma.accessRequest.updateMany.mockResolvedValue({ count: 0 });
    await expect(
      service.attachCheckoutSession('ar1', 'cs1', 'ANNUAL'),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(prisma.accessRequest.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          status: AccessRequestStatus.APPROVED,
          stripeCheckoutSessionId: null,
        }),
      }),
    );
  });

  describe('claimActivePaidAccess', () => {
    const activeRequest = {
      id: 'access-12345678',
      tier: AccessRequestTier.ORGANIZATION,
      fullName: 'Portal Owner',
      email: 'owner@example.com',
      organization: 'Example Research',
      intendedUse: 'Research',
      reason: 'Licensed use',
      status: AccessRequestStatus.ACTIVE,
      approvedAt: new Date(),
      approvedBy: 'admin-1',
      declinedAt: null,
      declinedReason: null,
      billingPeriod: 'ANNUAL' as const,
      stripeCustomerId: 'cus_1',
      stripeCheckoutSessionId: 'cs_paid',
      stripeSubscriptionId: 'sub_1',
      activatedAt: new Date(),
      expiresAt: null,
      portalUserId: null,
      portalOrganizationId: 'org-1',
      license: {
        id: 'license-1',
        organizationId: 'org-1',
        status: 'ACTIVE',
        validUntil: null,
      },
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    beforeEach(() => {
      prisma.$transaction.mockImplementation(
        (work: (tx: typeof prisma) => unknown) => Promise.resolve(work(prisma)),
      );
      prisma.user.findUnique.mockResolvedValue({
        id: 'user-1',
        email: 'Owner@Example.com',
      });
      prisma.accessRequest.findFirst.mockResolvedValue(activeRequest);
      prisma.portalOrganization.create.mockResolvedValue({ id: 'org-1' });
      prisma.portalOrganization.findUniqueOrThrow.mockResolvedValue({
        id: 'org-1',
      });
      prisma.accessRequest.updateMany.mockResolvedValue({ count: 1 });
      prisma.organizationMembership.upsert.mockResolvedValue({
        id: 'membership-1',
        organizationId: 'org-1',
        userId: 'user-1',
        role: OrganizationMemberRole.OWNER,
      });
    });

    it('atomically claims a provisioned workspace and creates OWNER membership', async () => {
      await expect(
        service.claimActivePaidAccess({
          userId: 'user-1',
          checkoutSessionId: 'cs_paid',
        }),
      ).resolves.toEqual(
        expect.objectContaining({
          accessRequestId: activeRequest.id,
          organizationId: 'org-1',
          alreadyClaimed: false,
        }),
      );

      expect(prisma.accessRequest.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            stripeCheckoutSessionId: 'cs_paid',
            status: AccessRequestStatus.ACTIVE,
            activatedAt: { not: null },
          }),
        }),
      );
      expect(prisma.organizationMembership.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          create: expect.objectContaining({
            userId: 'user-1',
            organizationId: 'org-1',
            role: OrganizationMemberRole.OWNER,
          }),
        }),
      );
      expect(prisma.portalOrganization.create).not.toHaveBeenCalled();
      expect(prisma.$transaction).toHaveBeenCalledWith(
        expect.any(Function),
        expect.objectContaining({ isolationLevel: 'Serializable' }),
      );
    });

    it('returns the existing OWNER membership on an exact replay', async () => {
      prisma.accessRequest.findFirst.mockResolvedValue({
        ...activeRequest,
        portalUserId: 'user-1',
        portalOrganizationId: 'org-1',
      });
      prisma.organizationMembership.findUnique.mockResolvedValue({
        id: 'membership-1',
        organizationId: 'org-1',
        userId: 'user-1',
        role: OrganizationMemberRole.OWNER,
      });

      await expect(
        service.claimActivePaidAccess({
          userId: 'user-1',
          email: 'owner@example.com',
        }),
      ).resolves.toEqual(expect.objectContaining({ alreadyClaimed: true }));
      expect(prisma.portalOrganization.create).not.toHaveBeenCalled();
      expect(prisma.accessRequest.updateMany).not.toHaveBeenCalled();
    });

    it('rejects a license already claimed by another portal user', async () => {
      prisma.accessRequest.findFirst.mockResolvedValue({
        ...activeRequest,
        portalUserId: 'user-2',
        portalOrganizationId: 'org-2',
      });

      await expect(
        service.claimActivePaidAccess({
          userId: 'user-1',
          checkoutSessionId: 'cs_paid',
        }),
      ).rejects.toBeInstanceOf(ConflictException);
      expect(prisma.portalOrganization.create).not.toHaveBeenCalled();
    });

    it('rejects a checkout belonging to a different verified email', async () => {
      prisma.accessRequest.findFirst.mockResolvedValue({
        ...activeRequest,
        email: 'other@example.com',
      });

      await expect(
        service.claimActivePaidAccess({
          userId: 'user-1',
          checkoutSessionId: 'cs_paid',
        }),
      ).rejects.toBeInstanceOf(BadRequestException);
    });
  });
});
