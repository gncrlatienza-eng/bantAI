import { BadRequestException } from '@nestjs/common';
import { Test } from '@nestjs/testing';

import { PrismaService } from '../../database/prisma.service';
import { AuditService } from '../audit/audit.service';
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
    smsMessage: { findMany: jest.fn(), count: jest.fn(), groupBy: jest.fn() },
    classification: { groupBy: jest.fn() },
    $transaction: jest.fn(),
  };
  const audit = { record: jest.fn() };
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
        { provide: AuditService, useValue: audit },
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

  it('rejects reports about alphanumeric brand sender IDs', async () => {
    await expect(service.reportFraud('u1', 'GCash')).rejects.toBeInstanceOf(
      BadRequestException,
    );
    expect(prisma.senderReport.create).not.toHaveBeenCalled();
  });

  describe('confirmFraud with corroborating reports', () => {
    beforeEach(() => {
      prisma.senderReport.findUnique.mockResolvedValue({
        id: 'r1',
        sender: 'fingerprint',
        reportWindow: '1',
        status: 'Pending',
      });
      prisma.senderReport.count.mockResolvedValue(3);
    });

    it('marks the sender as fraud', async () => {
      prisma.trustedOrganization.findFirst.mockResolvedValue(null);
      await expect(
        service.confirmFraud('r1', 'admin', 'verified'),
      ).resolves.toEqual({ reportId: 'r1', status: 'fraud', reportCount: 3 });
      expect(prisma.senderVerificationCache.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { sender: 'fingerprint' },
          create: expect.objectContaining({
            status: 'fraud',
            source: 'corroborated-admin-review',
          }),
        }),
      );
    });

    it('refuses to mark an active trusted organization as fraud', async () => {
      prisma.trustedOrganization.findFirst.mockResolvedValue({ id: 'org1' });
      await expect(
        service.confirmFraud('r1', 'admin', 'verified'),
      ).rejects.toBeInstanceOf(BadRequestException);
      expect(prisma.senderVerificationCache.upsert).not.toHaveBeenCalled();
      expect(prisma.$transaction).not.toHaveBeenCalled();
    });
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

  describe('findSenderReportDetail', () => {
    it("shows the number's reports and what it sent, masked and audited", async () => {
      prisma.senderReport.findUnique.mockResolvedValue({
        sender: 'hmac-1',
        reportWindow: '690',
      });
      prisma.senderReport.findMany.mockResolvedValue([
        { id: 'r1', status: 'Pending', createdAt: new Date() },
      ]);
      prisma.smsMessage.findMany.mockResolvedValue([
        {
          id: 'm1',
          body: 'Call me at 09171234567 to claim',
          receivedAt: new Date(),
          classification: { label: 'Scam', score: 1 },
          cluster: null,
        },
      ]);
      prisma.smsMessage.count.mockResolvedValue(14);
      prisma.smsMessage.groupBy.mockResolvedValue([
        { userId: 'u1' },
        { userId: 'u2' },
      ]);
      prisma.classification.groupBy.mockResolvedValue([
        { label: 'Scam', _count: { _all: 14 } },
      ]);

      const detail = await service.findSenderReportDetail('r1', 'admin-1');

      expect(prisma.smsMessage.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: { sender: 'hmac-1' }, take: 20 }),
      );
      expect(detail).toMatchObject({
        reportWindow: '690',
        reporterCount: 1,
        requiredReports: 2,
        messageTotal: 14,
        recipientCount: 2,
        labelCounts: { Scam: 14 },
      });
      // Re-masked on the way out, like every other admin message view.
      expect(detail.messages[0].body).not.toContain('09171234567');
      expect(audit.record).toHaveBeenCalledWith(
        expect.objectContaining({
          actorUserId: 'admin-1',
          metadata: expect.objectContaining({
            source: 'admin-sender-report-detail',
            count: 1,
          }),
        }),
      );
    });

    it('404s an unknown report', async () => {
      prisma.senderReport.findUnique.mockResolvedValue(null);
      await expect(
        service.findSenderReportDetail('missing', 'admin-1'),
      ).rejects.toThrow('Sender report not found.');
    });
  });
});
