import { ConflictException } from '@nestjs/common';
import { ShieldReviewDecision } from '@prisma/client';

import { LegacyLicenseReviewService } from './legacy-license-review.service';

describe('LegacyLicenseReviewService', () => {
  const prisma = {
    $transaction: jest.fn(),
    license: {
      findUnique: jest.fn(),
      findMany: jest.fn(),
      updateMany: jest.fn(),
    },
  };
  const audit = { record: jest.fn() };
  const service = new LegacyLicenseReviewService(
    prisma as never,
    audit as never,
  );
  const evidence = {
    reason: 'Signed contract permits Shield intelligence access.',
    evidenceReference: 'CONTRACT-2026-001',
  };

  beforeEach(() => {
    jest.resetAllMocks();
    prisma.$transaction.mockImplementation(
      (work: (tx: typeof prisma) => unknown) => Promise.resolve(work(prisma)),
    );
    prisma.license.findUnique.mockResolvedValue({
      id: 'license-1',
      legacyTier: 'RESEARCH',
      shieldReviewDecision: ShieldReviewDecision.PENDING,
      organizationId: 'org-1',
      accessRequestId: 'request-1',
    });
    prisma.license.updateMany.mockResolvedValue({ count: 1 });
  });

  it('identifies the account and request behind each historical license', async () => {
    prisma.license.findMany.mockResolvedValue([
      {
        id: 'license-1',
        legacyTier: 'RESEARCH',
        organization: { name: 'BantAI QA' },
        accessRequest: {
          email: 'qa@example.org',
          fullName: 'QA Reviewer',
          referenceNumber: 41,
          createdAt: new Date('2026-09-30T00:00:00Z'),
        },
      },
    ]);

    await expect(service.list()).resolves.toEqual([
      {
        id: 'license-1',
        legacyTier: 'RESEARCH',
        organizationName: 'BantAI QA',
        accountEmail: 'qa@example.org',
        applicantName: 'QA Reviewer',
        requestReference: 'BAI-2026-00041',
      },
    ]);
  });

  it('records explicit approval and its evidence in the same transaction', async () => {
    await service.review('license-1', 'admin-1', {
      ...evidence,
      decision: ShieldReviewDecision.APPROVED,
    });
    expect(prisma.license.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'license-1', shieldReviewDecision: 'PENDING' },
        data: expect.objectContaining({
          shieldReviewDecision: 'APPROVED',
          shieldApprovedAt: expect.any(Date),
          shieldReviewedByUserId: 'admin-1',
        }),
      }),
    );
    expect(audit.record).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'LICENSE_SHIELD_REVIEWED',
        metadata: expect.objectContaining({
          legacyTier: 'RESEARCH',
          evidenceReference: evidence.evidenceReference,
        }),
      }),
      prisma,
    );
  });

  it('withdraws Shield approval when a contract is rejected', async () => {
    prisma.license.findUnique.mockResolvedValue({
      id: 'license-1',
      legacyTier: 'RESEARCH',
      shieldReviewDecision: ShieldReviewDecision.APPROVED,
      organizationId: 'org-1',
      accessRequestId: 'request-1',
    });
    await service.review('license-1', 'admin-1', {
      ...evidence,
      decision: ShieldReviewDecision.REJECTED,
    });
    expect(prisma.license.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          shieldReviewDecision: 'REJECTED',
          shieldApprovedAt: null,
        }),
      }),
    );
  });

  it('rejects a stale concurrent decision without emitting an audit event', async () => {
    prisma.license.updateMany.mockResolvedValue({ count: 0 });
    await expect(
      service.review('license-1', 'admin-1', {
        ...evidence,
        decision: ShieldReviewDecision.APPROVED,
      }),
    ).rejects.toBeInstanceOf(ConflictException);
    expect(audit.record).not.toHaveBeenCalled();
  });
});
