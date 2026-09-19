import { BadRequestException } from '@nestjs/common';
import { Test } from '@nestjs/testing';

import { PrismaService } from '../../database/prisma.service';
import { SenderReputationService } from './sender-reputation.service';
import { VerificationService } from './verification.service';

describe('VerificationService', () => {
  const prisma = {
    senderReport: {
      create: jest.fn(),
      count: jest.fn(),
      findUnique: jest.fn(),
      findMany: jest.fn(),
      updateMany: jest.fn(),
    },
    senderVerificationCache: { upsert: jest.fn(), findUnique: jest.fn() },
    contact: {
      findUnique: jest.fn(),
      deleteMany: jest.fn(),
      createMany: jest.fn(),
    },
    trustedOrganization: {
      findFirst: jest.fn(),
      upsert: jest.fn(),
      findMany: jest.fn(),
      update: jest.fn(),
    },
    $transaction: jest.fn(),
  };
  const senderReputation = { lookup: jest.fn() };
  let service: VerificationService;

  beforeEach(async () => {
    jest.clearAllMocks();
    prisma.$transaction.mockResolvedValue([]);
    const module = await Test.createTestingModule({
      providers: [
        VerificationService,
        { provide: PrismaService, useValue: prisma },
        { provide: SenderReputationService, useValue: senderReputation },
      ],
    }).compile();
    service = module.get(VerificationService);
  });

  it('records an attributed, windowed pending report without altering reputation', async () => {
    prisma.senderReport.create.mockResolvedValue({});
    prisma.senderReport.count.mockResolvedValue(1);
    await expect(
      service.reportFraud('u1', '09171234567'),
    ).resolves.toMatchObject({ status: 'pending_review', reportCount: 1 });
    expect(prisma.senderVerificationCache.upsert).not.toHaveBeenCalled();
    expect(prisma.senderReport.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          userId: 'u1',
          reportWindow: expect.any(String),
        }),
      }),
    );
  });

  it('requires independent corroboration before an admin can establish global fraud status', async () => {
    prisma.senderReport.findUnique.mockResolvedValue({
      id: 'r1',
      sender: 'fingerprint',
      reportWindow: '1',
      status: 'Pending',
    });
    prisma.senderReport.count.mockResolvedValue(1);
    await expect(
      service.confirmFraud('r1', 'admin', 'verified'),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(prisma.senderVerificationCache.upsert).not.toHaveBeenCalled();
  });

  it('returns a vetted organization separately from risk and never treats it as a fraud override', async () => {
    prisma.senderVerificationCache.findUnique.mockResolvedValue(null);
    prisma.trustedOrganization.findFirst.mockResolvedValue({
      id: 'org1',
      name: 'Example Bank',
      officialDomains: ['example.ph'],
      evidenceType: 'government_registry',
    });
    await expect(
      service.verifySender('u1', 'EXAMPLEBANK'),
    ).resolves.toMatchObject({
      status: 'verified',
      familiarity: 'verified_organization',
      risk: 'unknown',
      organization: { name: 'Example Bank' },
    });
  });

  it('caches an external high-risk result without treating it as an approved global fraud verdict', async () => {
    prisma.senderVerificationCache.findUnique.mockResolvedValue(null);
    prisma.trustedOrganization.findFirst.mockResolvedValue(null);
    prisma.contact.findUnique.mockResolvedValue(null);
    senderReputation.lookup.mockResolvedValue({
      status: 'fraud',
      source: 'ipqs-phone-reputation',
      expiresAt: new Date(Date.now() + 60_000),
    });

    await expect(
      service.verifySender('u1', '09171234567'),
    ).resolves.toMatchObject({
      status: 'fraud',
      source: 'ipqs-phone-reputation',
      risk: 'external_high_risk',
      familiarity: 'unknown',
    });
    expect(prisma.senderVerificationCache.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        create: expect.objectContaining({ source: 'ipqs-phone-reputation' }),
      }),
    );
  });

  it('recognizes only a current administrator-reviewed fraud entry as confirmed', async () => {
    prisma.senderVerificationCache.findUnique.mockResolvedValue({
      status: 'fraud',
      source: 'corroborated-admin-review',
      expiresAt: new Date(Date.now() + 60_000),
    });
    await expect(service.isConfirmedFraud('09171234567')).resolves.toBe(true);
    prisma.senderVerificationCache.findUnique.mockResolvedValue({
      status: 'fraud',
      source: 'ipqs-phone-reputation',
      expiresAt: new Date(Date.now() + 60_000),
    });
    await expect(service.isConfirmedFraud('09171234567')).resolves.toBe(false);
    prisma.senderVerificationCache.findUnique.mockResolvedValue({
      status: 'fraud',
      source: 'corroborated-admin-review',
      expiresAt: new Date(Date.now() - 60_000),
    });
    await expect(service.isConfirmedFraud('09171234567')).resolves.toBe(false);
  });
});
