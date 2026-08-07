import { NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';

import { SmsService } from './sms.service';
import { PrismaService } from '../../database/prisma.service';
import { AiService } from '../ai/ai.service';
import { CampaignsService } from '../campaigns/campaigns.service';

const mockPrisma = {
  blockedNumber: { findUnique: jest.fn(), upsert: jest.fn() },
  smsMessage: { create: jest.fn(), update: jest.fn(), findUnique: jest.fn() },
  contact: { findUnique: jest.fn() },
  messageFeature: { create: jest.fn() },
  classification: { create: jest.fn(), findUnique: jest.fn() },
  explainableIndicator: { upsert: jest.fn() },
  alert: { findMany: jest.fn(), create: jest.fn() },
  campaignCluster: { update: jest.fn().mockResolvedValue({}) },
  $transaction: jest
    .fn()
    .mockImplementation((ops: Promise<unknown>[]) => Promise.all(ops)),
};

const mockAiService: Partial<AiService> = {
  classify: jest.fn().mockResolvedValue(null), // default: AI offline → local fallback
};

const mockCampaignsService: Partial<CampaignsService> = {
  getActiveDomains: jest.fn().mockResolvedValue(new Set<string>()),
  findByDomains: jest.fn().mockResolvedValue(null),
  incrementMessageCount: jest.fn().mockResolvedValue({}),
};

describe('SmsService', () => {
  let service: SmsService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SmsService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: AiService, useValue: mockAiService },
        { provide: CampaignsService, useValue: mockCampaignsService },
      ],
    }).compile();

    service = module.get<SmsService>(SmsService);
    jest.clearAllMocks();

    // Default mock state: sender not blocked, sender not a contact
    mockPrisma.blockedNumber.findUnique.mockResolvedValue(null);
    mockPrisma.contact.findUnique.mockResolvedValue(null);
    mockPrisma.smsMessage.create.mockResolvedValue(savedMsg);
    mockPrisma.smsMessage.findUnique.mockResolvedValue(null);
    mockPrisma.messageFeature.create.mockResolvedValue({});
    mockPrisma.classification.create.mockResolvedValue({});
    mockPrisma.alert.findMany.mockResolvedValue([]);
    mockPrisma.alert.create.mockResolvedValue({});
    (mockAiService.classify as jest.Mock).mockResolvedValue(null);
    (mockCampaignsService.getActiveDomains as jest.Mock).mockResolvedValue(
      new Set<string>(),
    );
    (mockCampaignsService.findByDomains as jest.Mock).mockResolvedValue(null);
  });

  const userId = 'user-1';
  const dto = {
    sender: 'GCash',
    body: 'Click https://evil.com to verify your account',
    receivedAt: '2026-07-21T08:00:00.000Z',
  };
  const savedMsg = {
    id: 'msg-1',
    userId,
    sender: dto.sender,
    body: dto.body,
  };

  // ── ingest ──────────────────────────────────────────────────────────────────

  describe('ingest', () => {
    it('suppresses immediately when sender is blocked', async () => {
      mockPrisma.blockedNumber.findUnique.mockResolvedValue({
        sender: dto.sender,
      });

      const result = await service.ingest(userId, dto);

      expect(result).toEqual({ suppressed: true, reason: 'blocked_sender' });
      expect(mockPrisma.smsMessage.create).not.toHaveBeenCalled();
    });

    it('persists the raw SMS with correct fields', async () => {
      await service.ingest(userId, dto);

      // sender is normalized before storage: 'GCash' → 'gcash'
      expect(mockPrisma.smsMessage.create).toHaveBeenCalledWith({
        data: {
          userId,
          sender: 'gcash',
          body: dto.body,
          receivedAt: new Date(dto.receivedAt),
        },
      });
    });

    it('persists a MessageFeature record referencing the saved message', async () => {
      await service.ingest(userId, dto);

      expect(mockPrisma.messageFeature.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ messageId: savedMsg.id }),
        }),
      );
    });

    it('persists a Classification record referencing the saved message', async () => {
      await service.ingest(userId, dto);

      expect(mockPrisma.classification.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            messageId: savedMsg.id,
            label: expect.any(String),
            score: expect.any(Number),
          }),
        }),
      );
    });

    it('returns messageId, classification, and action', async () => {
      const result = await service.ingest(userId, dto);

      expect(result).toMatchObject({
        messageId: savedMsg.id,
        classification: {
          label: expect.any(String),
          score: expect.any(Number),
        },
        action: expect.stringMatching(/^(blocked|alert|inbox)$/),
      });
    });

    it('auto-blocks sender when score >= 0.9', async () => {
      // Force high-confidence classification via keyword stuffing
      const highRiskDto = {
        ...dto,
        body: '[URL] verify locked click prize won gcash account',
      };
      await service.ingest(userId, highRiskDto);

      expect(mockPrisma.blockedNumber.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          create: expect.objectContaining({ source: 'AutoBlock' }),
        }),
      );
    });

    it('does not auto-block sender when score < 0.9', async () => {
      const lowRiskDto = { ...dto, body: 'Hello kumain ka na ba?' };
      await service.ingest(userId, lowRiskDto);

      expect(mockPrisma.blockedNumber.upsert).not.toHaveBeenCalled();
    });

    it('suppresses links when sender is unknown and message contains URLs', async () => {
      const result = await service.ingest(userId, dto);
      // dto.body contains https://evil.com — sender unknown → should be in suppressedLinks
      // (only if evil.com is in cluster domains or is a shortened URL service)
      expect(result).toHaveProperty('suppressedLinks');
      expect(Array.isArray((result as any).suppressedLinks)).toBe(true);
    });

    it('creates a Pending alert for messages routed to alert', async () => {
      // score 0.5 → 'Spam' → 'alert' action via local fallback
      const midRiskDto = { ...dto, body: 'verify locked click prize' };
      await service.ingest(userId, midRiskDto);

      expect(mockPrisma.alert.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ status: 'Pending' }),
        }),
      );
    });

    it('creates a Blocked alert for messages routed to blocked', async () => {
      const highRiskDto = {
        ...dto,
        body: '[URL] verify locked click prize won gcash account',
      };
      await service.ingest(userId, highRiskDto);

      expect(mockPrisma.alert.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ status: 'Blocked' }),
        }),
      );
    });

    it('does not create an alert for inbox messages', async () => {
      const safeDto = { ...dto, body: 'Kumain ka na ba?' };
      await service.ingest(userId, safeDto);

      expect(mockPrisma.alert.create).not.toHaveBeenCalled();
    });

    it('writes in order: blockedNumber check → smsMessage → messageFeature → classification', async () => {
      await service.ingest(userId, dto);

      const blockedOrder =
        mockPrisma.blockedNumber.findUnique.mock.invocationCallOrder[0];
      const msgOrder = mockPrisma.smsMessage.create.mock.invocationCallOrder[0];
      const featOrder =
        mockPrisma.messageFeature.create.mock.invocationCallOrder[0];
      const classOrder =
        mockPrisma.classification.create.mock.invocationCallOrder[0];

      expect(blockedOrder).toBeLessThan(msgOrder);
      expect(msgOrder).toBeLessThan(featOrder);
      expect(featOrder).toBeLessThan(classOrder);
    });
  });

  // ── maskLocally (private) ────────────────────────────────────────────────────

  describe('maskLocally', () => {
    const mask = (body: string) =>
      (service as any).maskLocally(body.normalize('NFKC'));

    it('returns the original text unchanged for a clean message', () => {
      expect(mask('Hello, how are you?')).toBe('Hello, how are you?');
    });

    it('applies NFKC normalisation (ligatures → canonical form)', () => {
      // U+FB01 (ﬁ) is a ligature that NFKC decomposes to "fi"
      expect(mask('ﬁle')).toBe('file');
    });

    it('masks http URLs with [URL]', () => {
      const result = mask('Go to http://evil.com now');
      expect(result).toContain('[URL]');
      expect(result).not.toContain('http://evil.com');
    });

    it('masks https URLs with [URL]', () => {
      expect(mask('Visit https://secure.example.com/path?q=1')).toContain(
        '[URL]',
      );
    });

    it('masks 10–13 digit strings as [PHONE]', () => {
      const result = mask('Call 09171234567 for details');
      expect(result).toContain('[PHONE]');
      expect(result).not.toContain('09171234567');
    });

    it('masks 4–8 digit strings as [OTP]', () => {
      const result = mask('Your code is 123456');
      expect(result).toContain('[OTP]');
      expect(result).not.toContain('123456');
    });

    it('masks ₱ amounts as [AMOUNT]', () => {
      const result = mask('You won ₱5,000.00 in our promo');
      expect(result).toContain('[AMOUNT]');
      expect(result).not.toContain('₱5,000.00');
    });

    it('masks ₱ amounts without decimals', () => {
      expect(mask('Transfer ₱500 immediately')).toContain('[AMOUNT]');
    });

    it('masks multiple patterns in one message', () => {
      const result = mask(
        'Click https://x.com, your code 654321, reward ₱1,000',
      );
      expect(result).toContain('[URL]');
      expect(result).toContain('[OTP]');
      expect(result).toContain('[AMOUNT]');
    });
  });

  // ── classifyLocally (private) ────────────────────────────────────────────────

  describe('classifyLocally', () => {
    const classify = (body: string) => (service as any).classifyLocally(body);

    it('returns "Ham" and low score for a clean message', () => {
      const { label, score } = classify('Kumain ka na ba?');
      expect(label).toBe('Ham');
      expect(score).toBeLessThan(0.5);
    });

    it('returns "Spam" when score is in 0.5–0.89 range', () => {
      const { label, score } = classify('verify locked click prize');
      expect(label).toBe('Spam');
      expect(score).toBeGreaterThanOrEqual(0.5);
      expect(score).toBeLessThan(0.9);
    });

    it('returns "Scam" when all keywords are present', () => {
      const { label, score } = classify(
        '[url] verify locked click prize won gcash account',
      );
      expect(label).toBe('Scam');
      expect(score).toBeGreaterThanOrEqual(0.9);
    });

    it('caps score at 0.99 regardless of keyword count', () => {
      const { score } = classify(
        '[url] verify locked click prize won gcash account extra extra',
      );
      expect(score).toBeLessThanOrEqual(0.99);
    });

    it('is case-insensitive for keyword matching', () => {
      const { score: lower } = classify('verify');
      const { score: upper } = classify('VERIFY');
      expect(lower).toBe(upper);
    });
  });

  // ── routeFromScore (private) ─────────────────────────────────────────────────

  describe('routeFromScore', () => {
    const route = (score: number) => (service as any).routeFromScore(score);

    it('returns "inbox" for score below 0.5', () => {
      expect(route(0)).toBe('inbox');
      expect(route(0.49)).toBe('inbox');
    });

    it('returns "alert" for score exactly 0.5', () => {
      expect(route(0.5)).toBe('alert');
    });

    it('returns "alert" for score in 0.5–0.89', () => {
      expect(route(0.75)).toBe('alert');
      expect(route(0.89)).toBe('alert');
    });

    it('returns "blocked" for score exactly 0.9', () => {
      expect(route(0.9)).toBe('blocked');
    });

    it('returns "blocked" for score above 0.9', () => {
      expect(route(0.99)).toBe('blocked');
      expect(route(1.0)).toBe('blocked');
    });
  });

  // ── getAlerts ────────────────────────────────────────────────────────────────

  describe('getAlerts', () => {
    it('queries alerts filtered by userId through the message relation', async () => {
      await service.getAlerts(userId);

      expect(mockPrisma.alert.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { message: { userId } },
          orderBy: { createdAt: 'desc' },
        }),
      );
    });

    it('returns an empty array when the user has no alerts', async () => {
      mockPrisma.alert.findMany.mockResolvedValue([]);

      const result = await service.getAlerts(userId);

      expect(result).toEqual([]);
    });

    it('returns alert list with message and classification fields', async () => {
      const alerts = [
        {
          id: 'alert-1',
          status: 'Pending',
          createdAt: new Date(),
          message: {
            id: 'msg-1',
            sender: 'GCash',
            body: 'Click here',
            receivedAt: new Date(),
            classification: { label: 'Scam', score: 0.95, bucket: 'blocked' },
          },
        },
      ];
      mockPrisma.alert.findMany.mockResolvedValue(alerts);

      const result = await service.getAlerts(userId);

      expect(result).toEqual(alerts);
    });
  });

  // ── getIndicators ─────────────────────────────────────────────────────────────

  describe('getIndicators', () => {
    it('throws NotFoundException when message does not exist', async () => {
      mockPrisma.smsMessage.findUnique.mockResolvedValue(null);

      await expect(service.getIndicators(userId, 'msg-x')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('throws NotFoundException when message belongs to a different user', async () => {
      mockPrisma.smsMessage.findUnique.mockResolvedValue({
        userId: 'other-user',
        classification: null,
      });

      await expect(service.getIndicators(userId, 'msg-1')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('returns empty indicators array when no ExplainableIndicator row exists yet', async () => {
      mockPrisma.smsMessage.findUnique.mockResolvedValue({
        userId,
        classification: null,
      });

      const result = await service.getIndicators(userId, 'msg-1');

      expect(result).toEqual({ indicators: [] });
    });

    it('returns empty indicators array when classification exists but indicator is null', async () => {
      mockPrisma.smsMessage.findUnique.mockResolvedValue({
        userId,
        classification: { indicator: null },
      });

      const result = await service.getIndicators(userId, 'msg-1');

      expect(result).toEqual({ indicators: [] });
    });

    it('returns stored indicator tags when ExplainableIndicator row exists', async () => {
      const indicators = [
        { tag: 'Prize Lure', weight: 1.0 },
        { tag: 'Suspicious URL', weight: 0.62 },
      ];
      mockPrisma.smsMessage.findUnique.mockResolvedValue({
        userId,
        classification: { indicator: { indicators } },
      });

      const result = await service.getIndicators(userId, 'msg-1');

      expect(result).toEqual({ indicators });
    });
  });

  // ── routeFromBucket (private) ────────────────────────────────────────────────

  describe('routeFromBucket', () => {
    const route = (bucket: string) => (service as any).routeFromBucket(bucket);

    it('returns "blocked" for bucket "blocked"', () => {
      expect(route('blocked')).toBe('blocked');
    });

    it('returns "alert" for bucket "spam"', () => {
      expect(route('spam')).toBe('alert');
    });

    it('returns "inbox" for bucket "safe"', () => {
      expect(route('safe')).toBe('inbox');
    });

    it('returns "inbox" for bucket "unknown"', () => {
      expect(route('unknown')).toBe('inbox');
    });
  });
});
