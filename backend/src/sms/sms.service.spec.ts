import { Test } from '@nestjs/testing';

import { PrismaService } from '../../database/prisma.service';
import { CampaignsService } from '../campaigns/campaigns.service';
import { VerificationService } from '../verification/verification.service';
import { EmergingWavesService } from '../campaigns/emerging-waves.service';
import { AiService } from '../ai/ai.service';
import { SmsService } from './sms.service';
import { CloudVerificationService } from '../cloud-verification/cloud-verification.service';

describe('SmsService', () => {
  const prisma = {
    blockedNumber: { findUnique: jest.fn(), upsert: jest.fn() },
    smsMessage: {
      findUnique: jest.fn(),
      findMany: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      updateMany: jest.fn(),
      count: jest.fn(),
    },
    messageFeature: { create: jest.fn() },
    classification: {
      create: jest.fn(),
      update: jest.fn(),
      findMany: jest.fn(),
      findFirst: jest.fn(),
      groupBy: jest.fn(),
    },
    explainableIndicator: { create: jest.fn(), upsert: jest.fn() },
    alert: {
      create: jest.fn(),
      deleteMany: jest.fn(),
      findMany: jest.fn(),
      findFirst: jest.fn(),
    },
    campaignCluster: { update: jest.fn() },
    $queryRaw: jest.fn(),
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
  const ai = {
    classifyMasked: jest.fn(),
    classifyPinned: jest.fn((message: string, domains: string[]) =>
      ai.classifyMasked(message, domains),
    ),
  };
  const cloudVerificationJob = {
    id: '11111111-1111-4111-8111-111111111111',
    status: 'pending',
    attempts: 0,
    lastError: null,
    retryAfter: null,
    modelVersion: 'v-test',
    approvedArtifactDigest: 'a'.repeat(64),
    updatedAt: new Date('2026-10-05T00:00:00.000Z'),
  };
  const cloudVerification = {
    identity: jest.fn(() => ({
      modelVersion: 'v-test',
      approvedArtifactDigest: 'a'.repeat(64),
    })),
    createJobInTransaction: jest.fn(() =>
      Promise.resolve(cloudVerificationJob),
    ),
    publishAfterCommit: jest.fn(() => Promise.resolve(cloudVerificationJob)),
    present: jest.fn((job: typeof cloudVerificationJob) => job),
  };
  const emergingWaves = { schedule: jest.fn() };
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
    prisma.smsMessage.updateMany.mockResolvedValue({ count: 1 });
    prisma.$queryRaw.mockResolvedValue([]);
    prisma.classification.create.mockResolvedValue({ id: 'c1' });
    campaigns.findActiveById.mockResolvedValue(null);
    campaigns.findByDomains.mockResolvedValue(null);
    const module = await Test.createTestingModule({
      providers: [
        SmsService,
        { provide: PrismaService, useValue: prisma },
        { provide: CampaignsService, useValue: campaigns },
        { provide: VerificationService, useValue: verification },
        { provide: AiService, useValue: ai },
        { provide: EmergingWavesService, useValue: emergingWaves },
        { provide: CloudVerificationService, useValue: cloudVerification },
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

  it('records a classified message from a blocked sender without creating another alert', async () => {
    prisma.blockedNumber.findUnique.mockResolvedValue({ id: 'blocked-1' });
    await expect(service.ingest('u1', dto)).resolves.toMatchObject({
      suppressed: true,
      reason: 'blocked_sender',
      messageId: 'm1',
      classification: { label: 'Scam' },
    });
    expect(prisma.smsMessage.create).toHaveBeenCalled();
    expect(prisma.classification.create).toHaveBeenCalled();
    expect(prisma.alert.create).not.toHaveBeenCalled();
  });

  it('re-masks a raw SMS sent under maskedBody before the AI call and storage', async () => {
    const raw =
      'Hi Juan, GCash locked. Verify at https://gcash-verify.example/login or call 0917 123 4567. OTP: 482913, acct 1234567890, ₱5,000.00, juan@mail.com';
    await service.ingest('u1', { ...dto, maskedBody: raw });

    const masked =
      'Hi Juan, GCash locked. Verify at [URL] or call [PHONE]. OTP: [OTP], acct [NUMBER], [AMOUNT], [EMAIL]';
    expect(ai.classifyMasked).toHaveBeenCalledWith(masked, []);
    expect(prisma.smsMessage.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ body: masked }),
      }),
    );
    expect(prisma.messageFeature.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        normalizedBody: masked,
        maskedBody: masked,
      }),
    });
    const persisted = JSON.stringify([
      prisma.smsMessage.create.mock.calls,
      prisma.messageFeature.create.mock.calls,
    ]);
    for (const secret of [
      'gcash-verify',
      '0917',
      '482913',
      '1234567890',
      '5,000',
      'juan@mail.com',
    ]) {
      expect(persisted).not.toContain(secret);
    }
  });

  it('sends only normalized hostnames to the AI domain tier', async () => {
    await service.ingest('u1', {
      ...dto,
      domains: [
        'WWW.GCash-Verify.PH',
        'gcash-verify.ph',
        'https://evil.example/login?user=juan',
        'bit.ly',
      ],
    });
    expect(ai.classifyMasked).toHaveBeenCalledWith(expect.any(String), [
      'gcash-verify.ph',
      'bit.ly',
    ]);
  });

  it('rejects a body that is empty after masking', async () => {
    await expect(
      service.ingest('u1', { ...dto, maskedBody: ' \n\t ' }),
    ).rejects.toThrow('empty after masking');
    expect(prisma.smsMessage.create).not.toHaveBeenCalled();
  });

  it('returns a successful duplicate response without recreating dependent records', async () => {
    prisma.smsMessage.findUnique.mockResolvedValue({
      id: 'existing',
      trusted: true,
      clusterId: null,
      campaignMatchSource: null,
      classification: { id: 'c1' },
      alerts: [],
    });
    await expect(service.ingest('u1', dto)).resolves.toMatchObject({
      messageId: 'existing',
      duplicate: true,
    });
    expect(prisma.smsMessage.create).not.toHaveBeenCalled();
  });

  const aiMatch = (clusterId: string, matchReason = 'embedding') => ({
    clusterId,
    similarity: 0.999,
    matched: true,
    shouldBuffer: false,
    lexicalSimilarity: 0.5,
    matchReason,
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
      campaign: aiMatch('k1'),
    });
    campaigns.findActiveById.mockResolvedValue(cluster);
    prisma.$queryRaw.mockResolvedValue([{ id: 'k1' }]);

    await expect(service.ingest('u1', dto)).resolves.toMatchObject({
      campaign: cluster,
      campaignId: 'k1',
      campaignMatchSource: 'model',
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
    prisma.$queryRaw.mockResolvedValue([{ id: 'k2' }]);

    await expect(
      service.ingest('u1', { ...dto, domains: ['Track-Parcel.example'] }),
    ).resolves.toMatchObject({
      campaign: cluster,
      campaignMatchSource: 'domain_fallback',
    });
    expect(campaigns.findByDomains).toHaveBeenCalledWith([
      'track-parcel.example',
    ]);
  });

  it('links an unlinked duplicate once its campaign exists, without new records', async () => {
    prisma.smsMessage.findUnique.mockResolvedValue({
      id: 'existing',
      trusted: true,
      clusterId: null,
      campaignMatchSource: null,
      classification: { id: 'c0' },
      alerts: [],
    });
    ai.classifyMasked.mockResolvedValue({
      label: 'Scam',
      score: 0.97,
      bucket: 'blocked',
      indicators: [],
      explanationMethod: 'shap',
      campaign: aiMatch('k1', 'hybrid'),
    });
    campaigns.findActiveById.mockResolvedValue({
      id: 'k1',
      label: 'x',
      category: 'Other scam',
    });
    prisma.$queryRaw.mockResolvedValue([{ id: 'k1' }]);

    await expect(service.ingest('u1', dto)).resolves.toMatchObject({
      messageId: 'existing',
      duplicate: true,
      campaign: { id: 'k1' },
    });
    expect(prisma.smsMessage.update).toHaveBeenCalledWith({
      where: { id: 'existing' },
      data: { clusterId: 'k1', campaignMatchSource: 'model' },
    });
    expect(prisma.smsMessage.create).not.toHaveBeenCalled();
    // Re-linking one user's own row never inflates the campaign's global count.
    expect(prisma.campaignCluster.update).not.toHaveBeenCalled();
  });

  it('returns no campaign when neither the AI nor a domain matched', async () => {
    await expect(service.ingest('u1', dto)).resolves.toMatchObject({
      campaign: null,
    });
  });

  it('schedules emerging-wave grouping for a scam no campaign matched', async () => {
    await service.ingest('u1', dto);
    expect(emergingWaves.schedule).toHaveBeenCalledTimes(1);
  });

  it('does not schedule grouping for a matched scam or a non-scam', async () => {
    ai.classifyMasked.mockResolvedValue({
      label: 'Scam',
      score: 0.97,
      bucket: 'blocked',
      indicators: [],
      campaign: aiMatch('k1'),
    });
    campaigns.findActiveById.mockResolvedValue({ id: 'k1' });
    prisma.$queryRaw.mockResolvedValue([{ id: 'k1' }]);
    await service.ingest('u1', dto);

    ai.classifyMasked.mockResolvedValue(null);
    await service.ingest('u1', { ...dto, sourceId: 'device:2', label: 'Ham' });

    expect(emergingWaves.schedule).not.toHaveBeenCalled();
  });

  it('upgrades a historical device fallback when the model becomes available', async () => {
    prisma.smsMessage.findUnique.mockResolvedValue({
      id: 'existing',
      trusted: false,
      clusterId: null,
      campaignMatchSource: null,
      classification: { id: 'old-classification' },
      alerts: [],
    });
    ai.classifyMasked.mockResolvedValue({
      label: 'Scam',
      score: 0.98,
      bucket: 'blocked',
      indicators: [],
      campaign: null,
    });
    await expect(
      service.ingest('u1', { ...dto, label: 'Ham' }),
    ).resolves.toMatchObject({
      messageId: 'existing',
      duplicate: true,
      classificationSource: 'model',
      classification: { label: 'Scam' },
    });
    expect(prisma.classification.update).toHaveBeenCalledWith({
      where: { id: 'old-classification' },
      data: {
        label: 'Scam',
        score: 0.98,
        bucket: 'blocked',
        createdAt: expect.any(Date),
      },
    });
    expect(prisma.smsMessage.updateMany).toHaveBeenCalledWith({
      where: { id: 'existing', trusted: false },
      data: { trusted: true },
    });
    expect(prisma.alert.create).toHaveBeenCalledWith({
      data: { messageId: 'existing', status: 'Pending' },
    });
    expect(prisma.smsMessage.create).not.toHaveBeenCalled();
  });

  it('does not promote a fallback twice when another retry wins', async () => {
    prisma.smsMessage.findUnique.mockResolvedValue({
      id: 'existing',
      trusted: false,
      clusterId: null,
      campaignMatchSource: null,
      classification: { id: 'old-classification' },
      alerts: [],
    });
    prisma.smsMessage.updateMany.mockResolvedValue({ count: 0 });
    ai.classifyMasked.mockResolvedValue({
      label: 'Scam',
      score: 0.98,
      bucket: 'blocked',
      indicators: [],
      campaign: null,
    });
    await service.ingest('u1', dto);
    expect(prisma.classification.update).not.toHaveBeenCalled();
    expect(prisma.alert.create).not.toHaveBeenCalled();
  });

  it('repairs a legacy duplicate message with no classification', async () => {
    prisma.smsMessage.findUnique.mockResolvedValue({
      id: 'legacy',
      trusted: false,
      clusterId: null,
      campaignMatchSource: null,
      classification: null,
      alerts: [],
    });
    await expect(service.ingest('u1', dto)).resolves.toMatchObject({
      messageId: 'legacy',
      duplicate: true,
    });
    expect(prisma.classification.create).toHaveBeenCalledWith({
      data: {
        messageId: 'legacy',
        label: 'Scam',
        score: 0.95,
        bucket: 'blocked',
      },
    });
    expect(prisma.alert.create).toHaveBeenCalledWith({
      data: { messageId: 'legacy', status: 'Pending' },
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

  it('trusts exactly the messages the server model classified', async () => {
    await service.ingest('u1', dto);
    expect(prisma.smsMessage.create.mock.calls[0][0].data.trusted).toBe(false);

    ai.classifyMasked.mockResolvedValue({
      label: 'Ham',
      score: 0.93,
      bucket: 'safe',
      indicators: [],
      campaign: null,
    });
    await service.ingest('u1', { ...dto, sourceId: 'device:2' });
    expect(prisma.smsMessage.create.mock.calls[1][0].data.trusted).toBe(true);
  });

  it('uses a valid server model result instead of device telemetry', async () => {
    ai.classifyMasked.mockResolvedValue({
      label: 'Scam',
      score: 0.97,
      bucket: 'blocked',
      indicators: [{ tag: 'Urgency cue', weight: 0.7 }],
      explanationMethod: 'shap',
      campaign: null,
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

  it('pages alerts with a createdAt cursor when one is given', async () => {
    prisma.alert.findMany.mockResolvedValue([]);
    const at = new Date('2026-10-01T00:00:00.000Z');
    await service.getAlerts('u1', {
      before: at.toISOString(),
      beforeId: 'a5',
      limit: 20,
    });
    expect(prisma.alert.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          OR: [{ createdAt: { lt: at } }, { createdAt: at, id: { lt: 'a5' } }],
        }),
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        take: 20,
      }),
    );
  });

  it('finds the alert for one of the caller own messages, or 404s', async () => {
    prisma.alert.findFirst.mockResolvedValueOnce({ id: 'a1' });
    await expect(service.getAlertForMessage('u1', 'm1')).resolves.toEqual({
      id: 'a1',
    });
    expect(prisma.alert.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          messageId: 'm1',
          message: expect.objectContaining({ userId: 'u1' }),
        }),
      }),
    );
    prisma.alert.findFirst.mockResolvedValueOnce(null);
    await expect(service.getAlertForMessage('u1', 'm2')).rejects.toThrow(
      'No alert for message m2',
    );
  });

  it('persists an authoritative AI campaign match after resolving it against the active registry', async () => {
    const campaignId = '11111111-1111-4111-8111-111111111111';
    ai.classifyMasked.mockResolvedValue({
      label: 'Scam',
      score: 0.98,
      bucket: 'blocked',
      indicators: [],
      explanationMethod: 'keyword-fallback',
      campaign: {
        clusterId: campaignId,
        similarity: 0.999,
        matched: true,
        shouldBuffer: false,
        lexicalSimilarity: 0.7,
        matchReason: 'hybrid',
      },
    });
    campaigns.findActiveById.mockResolvedValue({ id: campaignId });
    prisma.$queryRaw.mockResolvedValue([{ id: campaignId }]);

    await expect(service.ingest('u1', dto)).resolves.toMatchObject({
      campaignId,
      campaignMatchSource: 'model',
    });
    expect(campaigns.findActiveById).toHaveBeenCalledWith(campaignId);
    expect(campaigns.findByDomains).not.toHaveBeenCalled();
    expect(prisma.smsMessage.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ clusterId: campaignId }),
      }),
    );
    expect(prisma.campaignCluster.update).toHaveBeenCalledWith({
      where: { id: campaignId },
      data: { messageCount: { increment: 1 } },
    });
  });

  it('falls back to a server-side domain match when the model campaign is stale or inactive', async () => {
    const staleId = '22222222-2222-4222-8222-222222222222';
    ai.classifyMasked.mockResolvedValue({
      label: 'Spam',
      score: 0.92,
      bucket: 'spam',
      indicators: [],
      explanationMethod: 'keyword-fallback',
      campaign: {
        clusterId: staleId,
        similarity: 0.999,
        matched: true,
        shouldBuffer: false,
        lexicalSimilarity: 0,
        matchReason: 'embedding',
      },
    });
    campaigns.findActiveById.mockResolvedValue(null);
    campaigns.findByDomains.mockResolvedValue({ id: 'domain-campaign' });
    prisma.$queryRaw.mockResolvedValue([{ id: 'domain-campaign' }]);

    await expect(
      service.ingest('u1', { ...dto, domains: ['example.test'] }),
    ).resolves.toMatchObject({
      campaignId: 'domain-campaign',
      campaignMatchSource: 'domain_fallback',
    });
    expect(prisma.campaignCluster.update).not.toHaveBeenCalled();
  });

  it('drops a campaign assignment if archival wins before the ingest lock', async () => {
    campaigns.findByDomains.mockResolvedValue({ id: 'archived-campaign' });
    prisma.$queryRaw.mockResolvedValue([]);
    await expect(
      service.ingest('u1', { ...dto, domains: ['example.test'] }),
    ).resolves.toMatchObject({
      campaignId: null,
      campaignMatchSource: null,
    });
    expect(prisma.smsMessage.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          clusterId: null,
          campaignMatchSource: null,
        }),
      }),
    );
  });

  it("includes only the requesting user's own report on each alert", async () => {
    prisma.alert.findMany.mockResolvedValue([]);
    await service.getAlerts('u1');
    const args = prisma.alert.findMany.mock.calls[0][0];
    expect(args.select.message.select.reports).toEqual({
      where: { userId: 'u1' },
      select: {
        reportedLabel: true,
        status: true,
        createdAt: true,
        note: true,
        adminNote: true,
        updatedAt: true,
      },
      take: 1,
    });
  });

  it('does not persist a campaign for an unmatched model decision', async () => {
    ai.classifyMasked.mockResolvedValue({
      label: 'Spam',
      score: 0.91,
      bucket: 'spam',
      indicators: [],
      explanationMethod: 'keyword-fallback',
      campaign: {
        clusterId: null,
        similarity: 0.5,
        matched: false,
        shouldBuffer: true,
        lexicalSimilarity: 0,
        matchReason: null,
      },
    });

    await expect(service.ingest('u1', dto)).resolves.toMatchObject({
      campaignId: null,
      campaignMatchSource: null,
    });
    expect(campaigns.findActiveById).not.toHaveBeenCalled();
    expect(prisma.campaignCluster.update).not.toHaveBeenCalled();
  });

  it('never auto-blocks based only on device fallback metadata', async () => {
    await expect(service.ingest('u1', dto)).resolves.toMatchObject({
      action: 'alert',
      classificationSource: 'device_fallback',
    });
    expect(prisma.blockedNumber.upsert).not.toHaveBeenCalled();
  });

  // Alerts are smishing only (see routeFromLabel). A device heuristic hit
  // (current builds send label Spam, score 0) or a low-confidence Scam is
  // shown as suspicious on the phone itself; it does not create an Alert row.
  // A device-fallback Scam at >= 0.9 still alerts (test above).
  it.each(['Spam', 'Scam'] as const)(
    'stores a low-confidence device-fallback %s without an alert, whatever its bucket',
    async (label) => {
      await expect(
        service.ingest('u1', { ...dto, label, score: 0.7, bucket: 'unknown' }),
      ).resolves.toMatchObject({
        action: 'inbox',
        classificationSource: 'device_fallback',
      });

      expect(prisma.classification.create).toHaveBeenCalled();
      expect(prisma.alert.create).not.toHaveBeenCalled();
    },
  );

  it('does not create an alert for a device-fallback Ham', async () => {
    await expect(
      service.ingest('u1', {
        ...dto,
        label: 'Ham',
        score: 0.99,
        bucket: 'unknown',
      }),
    ).resolves.toMatchObject({ action: 'inbox' });

    expect(prisma.alert.create).not.toHaveBeenCalled();
  });

  it('keeps server-model bucket routing authoritative', async () => {
    ai.classifyMasked.mockResolvedValue({
      label: 'Scam',
      score: 0.65,
      bucket: 'unknown',
      indicators: [],
      campaign: null,
    });

    await expect(service.ingest('u1', dto)).resolves.toMatchObject({
      action: 'inbox',
      classificationSource: 'model',
    });
    expect(prisma.alert.create).not.toHaveBeenCalled();
  });

  it('returns a bounded, privacy-minimized admin classification log', async () => {
    const receivedAt = new Date('2026-09-28T00:00:00.000Z');
    const createdAt = new Date('2026-09-28T00:01:00.000Z');
    prisma.classification.findMany.mockResolvedValue([
      {
        id: 'c1',
        messageId: 'm1',
        label: 'Scam',
        score: 0.97,
        bucket: 'blocked',
        createdAt,
        message: {
          receivedAt,
          alerts: [{ status: 'Pending' }],
          cloudVerifications: [{ status: 'pending' as const }],
        },
      },
    ]);

    await expect(service.getAdminClassifications()).resolves.toEqual([
      {
        id: 'c1',
        messageId: 'm1',
        label: 'Scam',
        score: 0.97,
        bucket: 'blocked',
        createdAt,
        receivedAt,
        alertStatus: 'Pending',
        verificationStatus: 'pending',
      },
    ]);
    expect(prisma.classification.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        orderBy: { createdAt: 'desc' },
        take: 100,
      }),
    );
    const select = prisma.classification.findMany.mock.calls[0][0].select;
    expect(select).not.toHaveProperty('message.body');
    expect(select).not.toHaveProperty('message.sender');
    expect(select.message.select).not.toHaveProperty('user');
    expect(select.message.select).not.toHaveProperty('sourceId');
  });

  it('pages historical Scam and Spam classifications without exposing SMS content', async () => {
    const createdAt = new Date('2026-10-01T00:00:00.000Z');
    const receivedAt = new Date('2026-09-01T00:00:00.000Z');
    const records = ['c1', 'c2', 'c3'].map((id) => ({
      id,
      messageId: `m-${id}`,
      label: 'Scam',
      score: 0.9,
      bucket: 'blocked',
      createdAt,
      message: {
        receivedAt,
        alerts: [{ status: 'Pending' }],
        cloudVerifications: [],
      },
    }));
    prisma.classification.findMany.mockResolvedValue(records);

    await expect(
      service.getAdminClassificationHistory({ label: 'threats', limit: 2 }),
    ).resolves.toEqual({
      // The admin view flattens the joined message into receivedAt/alertStatus.
      items: records.slice(0, 2).map((row) => {
        const record: Partial<typeof row> = { ...row };
        delete record.message;
        return {
          ...record,
          receivedAt,
          alertStatus: 'Pending',
          verificationStatus: null,
        };
      }),
      nextCursor: 'c2',
    });
    const query = prisma.classification.findMany.mock.calls[0][0];
    expect(query.where).toEqual({ label: { in: ['Scam', 'Spam'] } });
    expect(query.orderBy).toEqual([{ createdAt: 'desc' }, { id: 'desc' }]);
    expect(query.take).toBe(3);
    expect(query.select.message.select).not.toHaveProperty('body');
    expect(query.select.message.select).not.toHaveProperty('sender');
  });

  it('rejects invalid classification history filters and page sizes', async () => {
    await expect(
      service.getAdminClassificationHistory({ label: 'Unknown' }),
    ).rejects.toThrow('Invalid classification filter');
    await expect(
      service.getAdminClassificationHistory({ limit: 101 }),
    ).rejects.toThrow('Limit must be between 1 and 100');
    expect(prisma.classification.findMany).not.toHaveBeenCalled();
  });

  it('summarizes mobile sync without exposing user or message content', async () => {
    const latest = new Date('2026-09-28T00:01:00.000Z');
    prisma.smsMessage.count.mockResolvedValue(3);
    prisma.smsMessage.findMany.mockResolvedValue([
      { userId: 'u1' },
      { userId: 'u2' },
    ]);
    prisma.classification.groupBy.mockResolvedValue([
      { label: 'Scam', _count: { _all: 1 } },
      { label: 'Spam', _count: { _all: 1 } },
      { label: 'Ham', _count: { _all: 1 } },
    ]);
    prisma.classification.findFirst.mockResolvedValue({ createdAt: latest });
    prisma.classification.findMany.mockResolvedValue([]);

    await expect(service.getAdminMobileSync()).resolves.toEqual({
      totalMessages: 3,
      syncedAccounts: 2,
      classifiedMessages: 3,
      scamCount: 1,
      spamCount: 1,
      hamCount: 1,
      latestSyncAt: latest,
      recent: [],
    });

    expect(prisma.smsMessage.findMany).toHaveBeenCalledWith({
      distinct: ['userId'],
      select: { userId: true },
    });
    expect(prisma.classification.groupBy).toHaveBeenCalledWith({
      by: ['label'],
      _count: { _all: true },
    });
  });
});
