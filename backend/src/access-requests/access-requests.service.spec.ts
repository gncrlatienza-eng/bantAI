import { BadRequestException, ConflictException } from '@nestjs/common';
import {
  AccessRequestStatus,
  AccessRequestTier,
  OrganizationMemberRole,
} from '@prisma/client';
import { AccessRequestsService } from './access-requests.service';
import { AGREEMENT_VERSION } from './license-terms';

describe('AccessRequestsService security boundaries', () => {
  const prisma = {
    $transaction: jest.fn(),
    user: { findFirst: jest.fn(), findUnique: jest.fn() },
    accessRequest: {
      findFirst: jest.fn(),
      findUnique: jest.fn(),
      findUniqueOrThrow: jest.fn(),
      create: jest.fn(),
      updateMany: jest.fn(),
    },
    accessRequestToken: {
      findUnique: jest.fn(),
      updateMany: jest.fn(),
      create: jest.fn(),
    },
    accessRequestEmailDelivery: { upsert: jest.fn() },
    portalOrganization: {
      create: jest.fn(),
      findUniqueOrThrow: jest.fn(),
      update: jest.fn(),
    },
    organizationMembership: {
      findUnique: jest.fn(),
      upsert: jest.fn(),
    },
  };
  const email = {
    sendSubmissionReceipt: jest.fn(),
    sendApproval: jest.fn(),
    sendActivation: jest.fn(),
  };
  const audit = { record: jest.fn() };
  const service = new AccessRequestsService(
    prisma as never,
    email as never,
    audit as never,
  );

  beforeEach(() => {
    jest.resetAllMocks();
    process.env.FRONTEND_URL = 'http://localhost:5173';
    prisma.$transaction.mockImplementation(
      (work: (tx: typeof prisma) => unknown) => Promise.resolve(work(prisma)),
    );
    prisma.user.findFirst.mockResolvedValue(null);
    prisma.accessRequest.findFirst.mockResolvedValue(null);
    prisma.accessRequestEmailDelivery.upsert.mockResolvedValue({});
  });

  it('rejects expired tokens even for read-only resolution', async () => {
    prisma.accessRequestToken.findUnique.mockResolvedValue({
      id: 't1',
      expiresAt: new Date(Date.now() - 1),
      usedAt: null,
      accessRequest: {
        status: AccessRequestStatus.APPROVED,
        email: 'researcher@example.com',
      },
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
      accessRequest: {
        status: AccessRequestStatus.APPROVED,
        email: 'researcher@example.com',
      },
    });
    prisma.accessRequestToken.updateMany.mockResolvedValue({ count: 0 });

    await expect(
      service.consumeApprovalToken('a'.repeat(32)),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('transitions only an agreement-accepted request into payment pending', async () => {
    prisma.accessRequest.updateMany.mockResolvedValue({ count: 0 });
    await expect(
      service.attachCheckoutSession('ar1', 'cs1', 'ANNUAL'),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(prisma.accessRequest.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          status: AccessRequestStatus.AGREEMENT_ACCEPTED,
          stripeCheckoutSessionId: null,
        }),
      }),
    );
  });

  describe('admin review decisions', () => {
    const receivedRequest = {
      id: 'request-1',
      tier: AccessRequestTier.SHIELD,
      status: AccessRequestStatus.RECEIVED,
      referenceNumber: 42,
      fullName: 'Researcher One',
      email: 'researcher@example.com',
      organization: 'Example University',
      intendedUse: 'Study coordinated smishing campaigns.',
      reason: 'Support a non-commercial thesis evaluation.',
      approvedAt: null,
      approvedBy: null,
      declinedAt: null,
      declinedReason: null,
      billingPeriod: null,
      activatedAt: null,
      createdAt: new Date('2026-09-29T00:00:00.000Z'),
      updatedAt: new Date('2026-09-29T00:00:00.000Z'),
    };

    beforeEach(() => {
      prisma.$transaction.mockImplementation(
        (work: (tx: typeof prisma) => unknown) => Promise.resolve(work(prisma)),
      );
      prisma.accessRequest.findUnique.mockResolvedValue(receivedRequest);
      prisma.accessRequest.updateMany.mockResolvedValue({ count: 1 });
      prisma.accessRequestToken.updateMany.mockResolvedValue({ count: 0 });
      prisma.accessRequestToken.create.mockResolvedValue({ id: 'token-1' });
    });

    it('approves a received request once and mints one expiring token atomically', async () => {
      prisma.accessRequest.findUnique
        .mockResolvedValueOnce(receivedRequest)
        .mockResolvedValueOnce({
          ...receivedRequest,
          status: AccessRequestStatus.APPROVED,
          approvedAt: new Date(),
          approvedBy: 'admin-1',
        });

      await expect(service.approve('request-1', 'admin-1')).resolves.toEqual(
        expect.objectContaining({
          request: expect.objectContaining({
            id: 'request-1',
            status: AccessRequestStatus.APPROVED,
          }),
          emailDelivery: {
            status: 'sent',
            to: 'researcher@example.com',
          },
        }),
      );
      expect(prisma.accessRequest.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            status: {
              in: [
                AccessRequestStatus.RECEIVED,
                AccessRequestStatus.UNDER_REVIEW,
                AccessRequestStatus.MORE_INFO_REQUIRED,
              ],
            },
          }),
        }),
      );
      expect(prisma.accessRequestToken.create).toHaveBeenCalledTimes(1);
      // Account-first: activation happens while signed in, so the email
      // links to the authenticated page and carries no bearer token.
      expect(email.sendApproval).toHaveBeenCalledWith(
        expect.objectContaining({
          to: 'researcher@example.com',
          approvalUrl: 'http://localhost:5173/activation',
        }),
      );
      expect(audit.record).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'APPLICATION_APPROVED',
          actorUserId: 'admin-1',
          accessRequestId: 'request-1',
        }),
        prisma,
      );
    });

    it('does not mint another token after the request leaves review', async () => {
      prisma.accessRequest.findUnique.mockResolvedValue({
        ...receivedRequest,
        status: AccessRequestStatus.APPROVED,
      });
      prisma.accessRequest.updateMany.mockResolvedValue({ count: 0 });

      await expect(
        service.approve('request-1', 'admin-1'),
      ).rejects.toBeInstanceOf(BadRequestException);
      expect(prisma.accessRequestToken.create).not.toHaveBeenCalled();
    });

    it('keeps approval state explicit when email delivery fails', async () => {
      prisma.accessRequest.findUnique
        .mockResolvedValueOnce(receivedRequest)
        .mockResolvedValueOnce({
          ...receivedRequest,
          status: AccessRequestStatus.APPROVED,
          approvedAt: new Date(),
          approvedBy: 'admin-1',
        });
      email.sendApproval.mockRejectedValueOnce(new Error('smtp unavailable'));

      await expect(service.approve('request-1', 'admin-1')).resolves.toEqual(
        expect.objectContaining({
          emailDelivery: {
            status: 'failed',
            to: 'researcher@example.com',
          },
        }),
      );
    });

    it('rotates and resends an approval link without exposing its token', async () => {
      const approvedRequest = {
        ...receivedRequest,
        status: AccessRequestStatus.APPROVED,
        approvedAt: new Date(),
        approvedBy: 'admin-1',
      };
      prisma.accessRequest.findUnique.mockResolvedValue(approvedRequest);

      const result = await service.resendApprovalEmail('request-1');

      expect(prisma.accessRequestToken.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { accessRequestId: 'request-1', usedAt: null },
        }),
      );
      expect(prisma.accessRequestToken.create).toHaveBeenCalledTimes(1);
      expect(result).toEqual(
        expect.objectContaining({
          emailDelivery: {
            status: 'sent',
            to: 'researcher@example.com',
          },
        }),
      );
      expect(result).not.toHaveProperty('approvalToken');
      expect(result).not.toHaveProperty('checkoutPath');
    });

    it('cannot decline an active paid request', async () => {
      prisma.accessRequest.findUnique.mockResolvedValue({
        ...receivedRequest,
        status: AccessRequestStatus.ACTIVE,
      });
      prisma.accessRequest.updateMany.mockResolvedValue({ count: 0 });

      await expect(
        service.decline('request-1', 'admin-1', 'No longer eligible'),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('asks for more information only before a decision', async () => {
      prisma.accessRequest.findUniqueOrThrow.mockResolvedValue({
        ...receivedRequest,
        status: AccessRequestStatus.MORE_INFO_REQUIRED,
      });

      await expect(
        service.requestMoreInfo('request-1', '  How will exports be stored?  '),
      ).resolves.toEqual(
        expect.objectContaining({
          status: AccessRequestStatus.MORE_INFO_REQUIRED,
          reference: 'BAI-2026-00042',
        }),
      );
      expect(prisma.accessRequest.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            id: 'request-1',
            status: {
              in: [
                AccessRequestStatus.RECEIVED,
                AccessRequestStatus.UNDER_REVIEW,
              ],
            },
          },
          data: expect.objectContaining({
            infoRequestMessage: 'How will exports be stored?',
          }),
        }),
      );

      prisma.accessRequest.updateMany.mockResolvedValue({ count: 0 });
      await expect(
        service.requestMoreInfo('request-1', 'Too late to ask this.'),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('moves a request back into review after more information', async () => {
      prisma.accessRequest.findUniqueOrThrow.mockResolvedValue({
        ...receivedRequest,
        status: AccessRequestStatus.UNDER_REVIEW,
      });

      await service.startReview('request-1');
      expect(prisma.accessRequest.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            id: 'request-1',
            status: {
              in: [
                AccessRequestStatus.RECEIVED,
                AccessRequestStatus.MORE_INFO_REQUIRED,
              ],
            },
          },
          data: { status: AccessRequestStatus.UNDER_REVIEW },
        }),
      );
    });
  });

  describe('acceptAgreement', () => {
    const approved = {
      id: 'request-1',
      tier: AccessRequestTier.SHIELD,
      status: AccessRequestStatus.APPROVED,
      referenceNumber: 7,
      email: 'owner@example.com',
      organization: 'Example Org',
      billingPeriod: null,
      approvedAt: new Date(),
      activatedAt: null,
      agreementAcceptedAt: null,
      agreementVersion: null,
      createdAt: new Date('2026-09-29T00:00:00.000Z'),
    };

    beforeEach(() => {
      prisma.accessRequestToken.findUnique.mockResolvedValue({
        id: 't1',
        expiresAt: new Date(Date.now() + 60_000),
        usedAt: null,
        accessRequest: approved,
      });
      prisma.accessRequest.updateMany.mockResolvedValue({ count: 1 });
      prisma.accessRequest.findUniqueOrThrow.mockResolvedValue({
        ...approved,
        status: AccessRequestStatus.AGREEMENT_ACCEPTED,
        agreementAcceptedAt: new Date(),
        agreementVersion: AGREEMENT_VERSION,
      });
    });

    it('rejects a stale terms version without touching the request', async () => {
      await expect(
        service.acceptAgreement('a'.repeat(32), '1999-01'),
      ).rejects.toBeInstanceOf(ConflictException);
      expect(prisma.accessRequest.updateMany).not.toHaveBeenCalled();
    });

    it('moves only an approved request to agreement accepted', async () => {
      await expect(
        service.acceptAgreement('a'.repeat(32), AGREEMENT_VERSION),
      ).resolves.toEqual(
        expect.objectContaining({
          status: 'agreement_accepted',
          reference: 'BAI-2026-00007',
          scope: expect.objectContaining({ name: 'Shield Subscription' }),
        }),
      );
      expect(prisma.accessRequest.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'request-1', status: AccessRequestStatus.APPROVED },
          data: expect.objectContaining({
            status: AccessRequestStatus.AGREEMENT_ACCEPTED,
            agreementVersion: AGREEMENT_VERSION,
          }),
        }),
      );
    });

    it('is idempotent for a repeat acceptance of the same version', async () => {
      prisma.accessRequestToken.findUnique.mockResolvedValue({
        id: 't1',
        expiresAt: new Date(Date.now() + 60_000),
        usedAt: null,
        accessRequest: {
          ...approved,
          status: AccessRequestStatus.AGREEMENT_ACCEPTED,
          agreementVersion: AGREEMENT_VERSION,
        },
      });

      await service.acceptAgreement('a'.repeat(32), AGREEMENT_VERSION);
      expect(prisma.accessRequest.updateMany).not.toHaveBeenCalled();
    });

    it('refuses once the approval token has been used by checkout', async () => {
      prisma.accessRequestToken.findUnique.mockResolvedValue({
        id: 't1',
        expiresAt: new Date(Date.now() + 60_000),
        usedAt: new Date(),
        accessRequest: approved,
      });

      await expect(
        service.acceptAgreement('a'.repeat(32), AGREEMENT_VERSION),
      ).rejects.toBeInstanceOf(BadRequestException);
    });
  });

  describe('one open request per account', () => {
    it('refuses to approve while the same account has another open request', async () => {
      prisma.accessRequest.findUnique.mockResolvedValue({
        id: 'request-2',
        status: AccessRequestStatus.RECEIVED,
        email: 'ana@uni.edu.ph',
        portalUserId: 'user-1',
      });
      prisma.accessRequest.findFirst.mockResolvedValue({ id: 'request-1' });

      await expect(
        service.approve('request-2', 'admin-1'),
      ).rejects.toBeInstanceOf(ConflictException);
      expect(prisma.accessRequest.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            id: { not: 'request-2' },
            OR: expect.arrayContaining([{ portalUserId: 'user-1' }]),
          }),
        }),
      );
      expect(prisma.accessRequest.updateMany).not.toHaveBeenCalled();
    });
  });

  describe('claimActivePaidAccess', () => {
    const activeRequest = {
      id: 'access-12345678',
      tier: AccessRequestTier.SHIELD,
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
        shieldApprovedAt: new Date(),
        shieldReviewDecision: 'APPROVED',
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
        role: OrganizationMemberRole.SHIELD,
      });
    });

    it('atomically claims a provisioned workspace and creates Shield membership', async () => {
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
            role: OrganizationMemberRole.SHIELD,
          }),
        }),
      );
      expect(prisma.portalOrganization.create).not.toHaveBeenCalled();
      expect(prisma.$transaction).toHaveBeenCalledWith(
        expect.any(Function),
        expect.objectContaining({ isolationLevel: 'Serializable' }),
      );
    });

    it('returns the existing Shield membership on an exact replay', async () => {
      prisma.accessRequest.findFirst.mockResolvedValue({
        ...activeRequest,
        portalUserId: 'user-1',
        portalOrganizationId: 'org-1',
      });
      prisma.organizationMembership.findUnique.mockResolvedValue({
        id: 'membership-1',
        organizationId: 'org-1',
        userId: 'user-1',
        role: OrganizationMemberRole.SHIELD,
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
