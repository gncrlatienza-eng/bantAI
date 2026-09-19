import { Test } from '@nestjs/testing';

import { PrismaService } from '../../database/prisma.service';
import { CampaignsService } from '../campaigns/campaigns.service';
import { VerificationService } from '../verification/verification.service';
import { AiService } from '../ai/ai.service';
import { SmsService } from './sms.service';

describe('SmsService', () => {
  const prisma = {
    blockedNumber: { findUnique: jest.fn(), upsert: jest.fn() },
    smsMessage: { findUnique: jest.fn(), create: jest.fn() },
    messageFeature: { create: jest.fn() },
    classification: { create: jest.fn() },
    explainableIndicator: { create: jest.fn() },
    alert: { create: jest.fn(), findMany: jest.fn() },
    $transaction: jest.fn(),
  };
  const campaigns = {
    findByDomains: jest.fn(),
    getActiveDomains: jest.fn().mockResolvedValue(new Set<string>()),
  };
  const verification = {
    isConfirmedFraud: jest.fn(),
    verifySender: jest.fn(),
  };
  const ai = { classifyMasked: jest.fn() };
  let service: SmsService;
  const dto = {
    sender: '09171234567',
    maskedBody: '[ON_DEVICE_CLASSIFICATION]',
    sourceId: 'device:1',
    label: 'Scam' as const,
    score: 0.95,
    bucket: 'blocked' as const,
    domains: [],
    receivedAt: new Date().toISOString(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    prisma.$transaction.mockImplementation(
      (work: (tx: typeof prisma) => unknown) => work(prisma),
    );
    prisma.blockedNumber.findUnique.mockResolvedValue(null);
    verification.isConfirmedFraud.mockResolvedValue(false);
    verification.verifySender.mockResolvedValue({ familiarity: 'unknown' });
    ai.classifyMasked.mockResolvedValue(null);
    prisma.smsMessage.findUnique.mockResolvedValue(null);
    prisma.smsMessage.create.mockResolvedValue({ id: 'm1' });
    prisma.classification.create.mockResolvedValue({ id: 'c1' });
    const module = await Test.createTestingModule({
      providers: [
        SmsService,
        { provide: PrismaService, useValue: prisma },
        { provide: CampaignsService, useValue: campaigns },
        { provide: VerificationService, useValue: verification },
        { provide: AiService, useValue: ai },
      ],
    }).compile();
    service = module.get(SmsService);
  });

  it('stores masked text and an HMAC sender pseudonym atomically', async () => {
    await service.ingest('u1', dto);
    expect(prisma.smsMessage.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          sender: expect.not.stringContaining('0917'),
          body: '[ON_DEVICE_CLASSIFICATION]',
          trusted: false,
        }),
      }),
    );
    expect(prisma.classification.create).toHaveBeenCalled();
    expect(prisma.alert.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: { messageId: 'm1', status: 'Pending' } }),
    );
  });

  it('returns a successful duplicate response without recreating dependent records', async () => {
    prisma.smsMessage.findUnique.mockResolvedValue({ id: 'existing' });
    await expect(service.ingest('u1', dto)).resolves.toMatchObject({
      messageId: 'existing',
      duplicate: true,
    });
    expect(prisma.smsMessage.create).not.toHaveBeenCalled();
  });

  it('alerts for reviewed corroborated fraud evidence without silently blocking', async () => {
    verification.isConfirmedFraud.mockResolvedValue(true);
    await expect(
      service.ingest('u1', {
        ...dto,
        label: 'Ham',
        score: 0.99,
        bucket: 'safe',
      }),
    ).resolves.toMatchObject({ action: 'alert' });
    expect(prisma.blockedNumber.upsert).not.toHaveBeenCalled();
  });

  it('uses a valid server model result instead of device telemetry', async () => {
    ai.classifyMasked.mockResolvedValue({
      label: 'Scam',
      score: 0.97,
      bucket: 'blocked',
      indicators: [{ tag: 'Urgency cue', weight: 0.7 }],
      explanationMethod: 'shap',
    });
    await expect(
      service.ingest('u1', {
        ...dto,
        label: 'Ham',
        score: 0.1,
        bucket: 'safe',
      }),
    ).resolves.toMatchObject({
      classification: { label: 'Scam', score: 0.97 },
      classificationSource: 'model',
      action: 'alert',
    });
    expect(prisma.explainableIndicator.create).toHaveBeenCalledWith({
      data: {
        classificationId: 'c1',
        indicators: [{ tag: 'Urgency cue', weight: 0.7 }],
      },
    });
  });

  it('never auto-blocks based only on device fallback metadata', async () => {
    await expect(service.ingest('u1', dto)).resolves.toMatchObject({
      action: 'alert',
      classificationSource: 'device_fallback',
    });
    expect(prisma.blockedNumber.upsert).not.toHaveBeenCalled();
  });
});
