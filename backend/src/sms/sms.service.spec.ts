import { Test } from '@nestjs/testing';

import { PrismaService } from '../../database/prisma.service';
import { CampaignsService } from '../campaigns/campaigns.service';
import { VerificationService } from '../verification/verification.service';
import { AiService } from '../ai/ai.service';
import { SmsService } from './sms.service';

describe('SmsService', () => {
  const prisma = {
    blockedNumber: { findUnique: jest.fn(), upsert: jest.fn() },
    smsMessage: { findUnique: jest.fn(), create: jest.fn(), update: jest.fn() },
    messageFeature: { create: jest.fn() },
    classification: { create: jest.fn() },
    explainableIndicator: { create: jest.fn() },
    alert: { create: jest.fn(), findMany: jest.fn() },
    $transaction: jest.fn(),
  };
  const campaigns = {
    findByDomains: jest.fn(),
    findActiveById: jest.fn(),
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
    campaigns.findByDomains.mockResolvedValue(null);
    campaigns.findActiveById.mockResolvedValue(null);
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

  it('links the campaign the AI matched and returns it to the client', async () => {
    const cluster = {
      id: 'k1',
      label: 'E-wallet phishing (GCash)',
      category: 'E-wallet phishing',
    };
    ai.classifyMasked.mockResolvedValue({
      label: 'Scam',
      score: 0.97,
      bucket: 'blocked',
      indicators: [],
      explanationMethod: 'shap',
      campaign: { clusterId: 'k1', matchReason: 'embedding' },
    });
    campaigns.findActiveById.mockResolvedValue(cluster);

    await expect(service.ingest('u1', dto)).resolves.toMatchObject({
      campaign: cluster,
    });
    expect(campaigns.findActiveById).toHaveBeenCalledWith('k1');
    expect(campaigns.findByDomains).not.toHaveBeenCalled();
    expect(prisma.smsMessage.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ clusterId: 'k1' }),
      }),
    );
  });

  it('falls back to a shared domain when the AI matched no active campaign', async () => {
    const cluster = {
      id: 'k2',
      label: 'Parcel scam',
      category: 'Parcel / delivery scam',
    };
    campaigns.findByDomains.mockResolvedValue(cluster);

    await expect(
      service.ingest('u1', { ...dto, domains: ['Track-Parcel.example'] }),
    ).resolves.toMatchObject({ campaign: cluster });
    expect(campaigns.findByDomains).toHaveBeenCalledWith([
      'track-parcel.example',
    ]);
  });

  it('links an unlinked duplicate once its campaign exists, without new records', async () => {
    prisma.smsMessage.findUnique.mockResolvedValue({
      id: 'existing',
      clusterId: null,
    });
    ai.classifyMasked.mockResolvedValue({
      label: 'Scam',
      score: 0.97,
      bucket: 'blocked',
      indicators: [],
      explanationMethod: 'shap',
      campaign: { clusterId: 'k1', matchReason: 'hybrid' },
    });
    campaigns.findActiveById.mockResolvedValue({
      id: 'k1',
      label: 'x',
      category: 'Other scam',
    });

    await expect(service.ingest('u1', dto)).resolves.toMatchObject({
      messageId: 'existing',
      duplicate: true,
      campaign: { id: 'k1' },
    });
    expect(prisma.smsMessage.update).toHaveBeenCalledWith({
      where: { id: 'existing' },
      data: { clusterId: 'k1' },
    });
    expect(prisma.smsMessage.create).not.toHaveBeenCalled();
  });

  it('returns no campaign when neither the AI nor a domain matched', async () => {
    await expect(service.ingest('u1', dto)).resolves.toMatchObject({
      campaign: null,
    });
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

  it('files model Spam (promos) in the inbox without creating an alert', async () => {
    ai.classifyMasked.mockResolvedValue({
      label: 'Spam',
      score: 0.99,
      bucket: 'spam',
      indicators: [],
      explanationMethod: 'keyword-fallback',
    });
    await expect(service.ingest('u1', dto)).resolves.toMatchObject({
      classification: { label: 'Spam', score: 0.99, bucket: 'spam' },
      action: 'inbox',
    });
    expect(prisma.alert.create).not.toHaveBeenCalled();
  });

  it('leaves an uncertain Scam for client review without creating an alert', async () => {
    ai.classifyMasked.mockResolvedValue({
      label: 'Scam',
      score: 0.62,
      bucket: 'unknown',
      indicators: [],
      explanationMethod: 'keyword-fallback',
    });
    await expect(service.ingest('u1', dto)).resolves.toMatchObject({
      classification: { label: 'Scam', bucket: 'unknown' },
      action: 'inbox',
    });
    expect(prisma.alert.create).not.toHaveBeenCalled();
  });

  it('does not alert on Spam from a client that sends no bucket', async () => {
    await expect(
      service.ingest('u1', {
        ...dto,
        label: 'Spam',
        score: 0.8,
        bucket: undefined,
      }),
    ).resolves.toMatchObject({ action: 'inbox' });
    expect(prisma.alert.create).not.toHaveBeenCalled();
  });

  it('lists only smishing alerts, excluding legacy promo alerts', async () => {
    prisma.alert.findMany.mockResolvedValue([]);
    await service.getAlerts('u1');
    expect(prisma.alert.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          message: {
            userId: 'u1',
            NOT: { classification: { is: { bucket: 'spam' } } },
          },
        },
      }),
    );
  });

  it('never auto-blocks based only on device fallback metadata', async () => {
    await expect(service.ingest('u1', dto)).resolves.toMatchObject({
      action: 'alert',
      classificationSource: 'device_fallback',
    });
    expect(prisma.blockedNumber.upsert).not.toHaveBeenCalled();
  });
});
