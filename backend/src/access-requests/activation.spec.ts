import {
  AccessRequestStatus,
  AccessRequestTier,
  LicenseStatus,
} from '@prisma/client';

import { AccessRequestsService } from './access-requests.service';

/*
 * Webhook activation (account-first lifecycle, audit §A.3): reuse the
 * applicant's workspace, make the applicant its owner, and keep license state
 * off the application record.
 */
describe('AccessRequestsService activation and license lifecycle', () => {
  const prisma = {
    $transaction: jest.fn(),
    accessRequest: {
      findUnique: jest.fn(),
      updateMany: jest.fn(),
      update: jest.fn(),
    },
    portalOrganization: { findUnique: jest.fn(), create: jest.fn() },
    license: { upsert: jest.fn(), findUnique: jest.fn(), update: jest.fn() },
    organizationMembership: {
      findUnique: jest.fn(),
      findFirst: jest.fn(),
      create: jest.fn(),
    },
    accessRequestEmailDelivery: { upsert: jest.fn() },
  };
  const email = { sendActivation: jest.fn() };
  const audit = { record: jest.fn() };
  const service = new AccessRequestsService(
    prisma as never,
    email as never,
    audit as never,
  );

  const pending = {
    id: 'request-2',
    tier: AccessRequestTier.SHIELD,
    legacyTier: null,
    status: AccessRequestStatus.PAYMENT_PENDING,
    organization: 'Example University',
    billingPeriod: 'ANNUAL',
    expiresAt: null,
    portalUserId: 'user-1',
    portalOrganizationId: 'org-1',
    license: null,
  };

  beforeEach(() => {
    jest.resetAllMocks();
    prisma.$transaction.mockImplementation(
      (work: (tx: typeof prisma) => unknown) => Promise.resolve(work(prisma)),
    );
    prisma.accessRequest.findUnique.mockImplementation(
      ({ where }: { where: { id?: string } }) =>
        Promise.resolve(where.id ? null : pending),
    );
    prisma.accessRequest.updateMany.mockResolvedValue({ count: 1 });
    prisma.license.upsert.mockResolvedValue({ id: 'license-2' });
    prisma.organizationMembership.findUnique.mockResolvedValue(null);
    prisma.organizationMembership.findFirst.mockResolvedValue(null);
    // Post-commit activation email is covered elsewhere.
    jest
      .spyOn(service as never, 'deliverActivation')
      .mockResolvedValue({ status: 'sent' } as never);
  });

  it('reactivates the returning applicant’s active workspace instead of creating one', async () => {
    prisma.portalOrganization.findUnique.mockResolvedValue({
      id: 'org-1',
      isActive: true,
    });
    prisma.organizationMembership.findUnique.mockResolvedValue({ id: 'm-1' });

    const result = await service.activateFromWebhook({
      checkoutSessionId: 'cs_test_2',
    });

    expect(result).toMatchObject({ activated: true, organizationId: 'org-1' });
    expect(prisma.portalOrganization.create).not.toHaveBeenCalled();
    expect(prisma.license.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        create: expect.objectContaining({
          organizationId: 'org-1',
          status: LicenseStatus.ACTIVE,
          shieldApprovedAt: expect.any(Date),
        }),
      }),
    );
    // Existing membership is kept as-is; no duplicate owner row.
    expect(prisma.organizationMembership.create).not.toHaveBeenCalled();
    expect(audit.record).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'LICENSE_ACTIVATED',
        metadata: expect.objectContaining({ reusedWorkspace: true }),
      }),
      prisma,
    );
  });

  it('keeps a paid legacy request outside Shield after webhook activation', async () => {
    prisma.accessRequest.findUnique.mockImplementation(
      ({ where }: { where: { id?: string } }) =>
        Promise.resolve(
          where.id ? null : { ...pending, legacyTier: 'RESEARCH' },
        ),
    );
    prisma.portalOrganization.findUnique.mockResolvedValue({
      id: 'org-1',
      isActive: true,
    });

    await expect(
      service.activateFromWebhook({ checkoutSessionId: 'cs_test_legacy' }),
    ).resolves.toMatchObject({ activated: true, shieldReviewRequired: true });

    expect(prisma.license.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        create: expect.objectContaining({
          legacyTier: 'RESEARCH',
          shieldApprovedAt: null,
        }),
        update: expect.not.objectContaining({
          shieldApprovedAt: expect.anything(),
        }),
      }),
    );
    expect(email.sendActivation).not.toHaveBeenCalled();
  });

  it('never revives a workspace an administrator deactivated', async () => {
    prisma.portalOrganization.findUnique.mockResolvedValue({
      id: 'org-1',
      isActive: false,
    });
    prisma.portalOrganization.create.mockResolvedValue({ id: 'org-new' });

    const result = await service.activateFromWebhook({
      checkoutSessionId: 'cs_test_2',
    });
    expect(result).toMatchObject({ organizationId: 'org-new' });
    expect(prisma.organizationMembership.create).toHaveBeenCalledWith({
      data: { organizationId: 'org-new', userId: 'user-1', role: 'SHIELD' },
    });
  });

  it('makes a first-time applicant the owner of the new workspace in the same transaction', async () => {
    prisma.accessRequest.findUnique.mockImplementation(
      ({ where }: { where: { id?: string } }) =>
        Promise.resolve(
          where.id ? null : { ...pending, portalOrganizationId: null },
        ),
    );
    prisma.portalOrganization.create.mockResolvedValue({ id: 'org-new' });

    await service.activateFromWebhook({ checkoutSessionId: 'cs_test_2' });
    expect(prisma.organizationMembership.create).toHaveBeenCalledWith({
      data: { organizationId: 'org-new', userId: 'user-1', role: 'SHIELD' },
    });
  });

  it('does not activate anything that is not awaiting payment', async () => {
    prisma.accessRequest.findUnique.mockImplementation(
      ({ where }: { where: { id?: string } }) =>
        Promise.resolve(
          where.id
            ? null
            : { ...pending, status: AccessRequestStatus.AGREEMENT_ACCEPTED },
        ),
    );
    await expect(
      service.activateFromWebhook({ checkoutSessionId: 'cs_test_2' }),
    ).resolves.toEqual({ activated: false });
    expect(prisma.license.upsert).not.toHaveBeenCalled();
  });

  it('records billing changes on the license only, never rewriting the application', async () => {
    prisma.license.findUnique.mockResolvedValue({
      id: 'license-1',
      status: LicenseStatus.ACTIVE,
      organizationId: 'org-1',
      accessRequestId: 'request-1',
      lastStripeEventCreated: 1,
    });
    await service.updateSubscriptionFromWebhook({
      stripeSubscriptionId: 'sub_1',
      status: LicenseStatus.EXPIRED,
      stripeEventCreated: 2,
      validUntil: new Date('2026-09-01'),
    });
    expect(prisma.license.update).toHaveBeenCalled();
    expect(prisma.accessRequest.update).not.toHaveBeenCalled();
    expect(audit.record).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'LICENSE_EXPIRED',
        licenseId: 'license-1',
      }),
      prisma,
    );
  });
});
